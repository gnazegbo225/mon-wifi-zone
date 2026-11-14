-- =============================================================================
-- Migration 009 — statistiques de supervision du super admin
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 008.
--
-- Uniquement des fonctions de lecture : chaque statistique est calculée par Postgres en une
-- requête, au lieu d'additionner des milliers de lignes dans le backend.
--   admin_overview(du, au)                 chiffres de la plateforme sur une période
--   admin_vendor_stats(promoteur)          zones, ventes et soldes de chaque promoteur (NULL = tous)
--   admin_zone_stats()                     forfaits, stock et ventes de chaque zone
--   admin_transactions_summary(filtres)    nombre et montants des paiements filtrés
--
-- Montants en FCFA. Fuseau : UTC, qui est l'heure de la Côte d'Ivoire.
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- Chiffres de la plateforme. p_from NULL = depuis la première vente.
-- Les ventes sont regroupées par jour (période de 92 jours au plus) ou par mois.
--   sales        ventes réussies de la période : nombre, montant encaissé, commissions gagnées
--   owed         argent dû aux promoteurs aujourd'hui : disponible, en attente (24 h), en cours de retrait
--   withdrawals  retraits à approuver, à payer, et payés pendant la période
--   vendors      promoteurs : total, par statut, en ligne (vus il y a moins de 5 min), nouveaux, actifs
--   series       ventes par jour ou par mois, pour le graphique
CREATE OR REPLACE FUNCTION admin_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_from   timestamptz := COALESCE(p_from, (SELECT min(completed_at) FROM payments WHERE status = 'completed'), now());
    v_to     timestamptz := COALESCE(p_to, now());
    v_bucket text := CASE WHEN COALESCE(p_to, now()) - COALESCE(p_from, '-infinity') > interval '92 days' THEN 'month' ELSE 'day' END;
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'bucket', v_bucket,
        'sales', (
            SELECT jsonb_build_object(
                'count', count(*),
                'gross', COALESCE(sum(amount), 0),
                'commission', COALESCE(sum(commission_amount), 0))
              FROM payments
             WHERE status = 'completed' AND completed_at >= v_from AND completed_at < v_to
        ),
        'owed', (
            SELECT jsonb_build_object(
                'available', COALESCE(sum(amount) FILTER (WHERE available_at <= now()), 0),
                'pending', COALESCE(sum(amount) FILTER (WHERE available_at > now()), 0))
              FROM ledger_entries
        ),
        'withdrawals', (
            SELECT jsonb_build_object(
                'pending_count', count(*) FILTER (WHERE status = 'pending'),
                'pending_amount', COALESCE(sum(amount) FILTER (WHERE status = 'pending'), 0),
                'approved_count', count(*) FILTER (WHERE status = 'approved'),
                'approved_amount', COALESCE(sum(amount) FILTER (WHERE status = 'approved'), 0),
                'paid_count', count(*) FILTER (WHERE status = 'paid' AND paid_at >= v_from AND paid_at < v_to),
                'paid_amount', COALESCE(sum(amount) FILTER (WHERE status = 'paid' AND paid_at >= v_from AND paid_at < v_to), 0))
              FROM withdrawals
        ),
        'vendors', (
            SELECT jsonb_build_object(
                'total', count(*),
                'approved', count(*) FILTER (WHERE account_status = 'approved'),
                'pending_review', count(*) FILTER (WHERE account_status = 'pending_review'),
                'rejected', count(*) FILTER (WHERE account_status = 'rejected'),
                'suspended', count(*) FILTER (WHERE account_status = 'suspended'),
                'online', count(*) FILTER (WHERE last_seen_at > now() - interval '5 minutes'),
                'new', count(*) FILTER (WHERE created_at >= v_from AND created_at < v_to),
                'active', (SELECT count(DISTINCT owner_id) FROM payments
                            WHERE status = 'completed' AND completed_at >= v_from AND completed_at < v_to))
              FROM users
             WHERE role = 'vendor'
        ),
        'dossiers_to_review', (
            SELECT count(*)
              FROM users u
              JOIN vendor_profiles p ON p.user_id = u.id
             WHERE u.role = 'vendor' AND u.account_status = 'pending_review' AND p.submitted_at IS NOT NULL
        ),
        'zones', (
            SELECT jsonb_build_object('total', count(*), 'active', count(*) FILTER (WHERE is_active)) FROM wifi_zones
        ),
        'series', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'period', to_char(b.start, CASE WHEN v_bucket = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END),
                       'count', COALESCE(s.n, 0),
                       'gross', COALESCE(s.gross, 0),
                       'commission', COALESCE(s.commission, 0)) ORDER BY b.start), '[]'::jsonb)
              FROM generate_series(date_trunc(v_bucket, v_from), v_to - interval '1 microsecond', ('1 ' || v_bucket)::interval) AS b(start)
              LEFT JOIN LATERAL (
                  SELECT count(*) AS n, sum(amount) AS gross, sum(commission_amount) AS commission
                    FROM payments
                   WHERE status = 'completed'
                     AND completed_at >= GREATEST(b.start, v_from)
                     AND completed_at < LEAST(b.start + ('1 ' || v_bucket)::interval, v_to)
              ) s ON true
        )
    ) INTO v_result;
    RETURN v_result;
END;
$$;

-- Zones, ventes et soldes de chaque promoteur (p_vendor_id NULL = tous).
CREATE OR REPLACE FUNCTION admin_vendor_stats(p_vendor_id uuid)
RETURNS TABLE (
    vendor_id      uuid,
    zones_total    bigint,
    zones_active   bigint,
    sales_count    bigint,
    gross          bigint,
    commissions    bigint,
    last_sale_at   timestamptz,
    available      bigint,
    pending        bigint,
    in_withdrawal  bigint,
    withdrawn      bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT u.id,
           COALESCE(z.total, 0), COALESCE(z.active, 0),
           COALESCE(p.n, 0), COALESCE(p.gross, 0), COALESCE(p.commission, 0), p.last_sale,
           COALESCE(l.available, 0), COALESCE(l.pending, 0),
           COALESCE(w.in_withdrawal, 0), COALESCE(w.withdrawn, 0)
      FROM users u
      LEFT JOIN (SELECT owner_id, count(*) AS total, count(*) FILTER (WHERE is_active) AS active
                   FROM wifi_zones GROUP BY owner_id) z ON z.owner_id = u.id
      LEFT JOIN (SELECT owner_id, count(*) AS n, sum(amount) AS gross, sum(commission_amount) AS commission,
                        max(completed_at) AS last_sale
                   FROM payments WHERE status = 'completed' GROUP BY owner_id) p ON p.owner_id = u.id
      LEFT JOIN (SELECT ledger_entries.vendor_id AS v,
                        sum(amount) FILTER (WHERE available_at <= now()) AS available,
                        sum(amount) FILTER (WHERE available_at > now()) AS pending
                   FROM ledger_entries GROUP BY ledger_entries.vendor_id) l ON l.v = u.id
      LEFT JOIN (SELECT withdrawals.vendor_id AS v,
                        sum(amount) FILTER (WHERE status IN ('pending', 'approved')) AS in_withdrawal,
                        sum(amount) FILTER (WHERE status = 'paid') AS withdrawn
                   FROM withdrawals GROUP BY withdrawals.vendor_id) w ON w.v = u.id
     WHERE u.role = 'vendor'
       AND (p_vendor_id IS NULL OR u.id = p_vendor_id);
$$;

-- Forfaits, stock et ventes des 30 derniers jours de chaque zone.
-- Un ticket réservé dont la réservation a expiré compte comme libre.
CREATE OR REPLACE FUNCTION admin_zone_stats()
RETURNS TABLE (
    zone_id           uuid,
    pricings_active   bigint,
    tickets_free      bigint,
    tickets_reserved  bigint,
    tickets_sold      bigint,
    sales_30d         bigint,
    gross_30d         bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT z.id,
           COALESCE(pr.active, 0),
           COALESCE(t.free, 0), COALESCE(t.reserved, 0), COALESCE(t.sold, 0),
           COALESCE(s.n, 0), COALESCE(s.gross, 0)
      FROM wifi_zones z
      LEFT JOIN (SELECT wifi_zone_id, count(*) FILTER (WHERE is_active) AS active
                   FROM pricings GROUP BY wifi_zone_id) pr ON pr.wifi_zone_id = z.id
      LEFT JOIN (SELECT wifi_zone_id,
                        count(*) FILTER (WHERE status = 'free' OR (status = 'reserved' AND reserved_until < now())) AS free,
                        count(*) FILTER (WHERE status = 'reserved' AND reserved_until >= now()) AS reserved,
                        count(*) FILTER (WHERE status = 'sold') AS sold
                   FROM tickets GROUP BY wifi_zone_id) t ON t.wifi_zone_id = z.id
      LEFT JOIN (SELECT wifi_zone_id, count(*) AS n, sum(amount) AS gross
                   FROM payments
                  WHERE status = 'completed' AND completed_at >= now() - interval '30 days'
                  GROUP BY wifi_zone_id) s ON s.wifi_zone_id = z.id;
$$;

-- Totaux des paiements filtrés (page Transactions). Filtres NULL = ignorés.
-- Période sur la date de création du paiement ; montants et commissions des paiements réussis seulement.
CREATE OR REPLACE FUNCTION admin_transactions_summary(
    p_from      timestamptz,
    p_to        timestamptz,
    p_status    text,
    p_vendor_id uuid,
    p_zone_id   uuid
)
RETURNS TABLE (total_count bigint, completed_count bigint, gross bigint, commission bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT count(*),
           count(*) FILTER (WHERE status = 'completed'),
           COALESCE(sum(amount) FILTER (WHERE status = 'completed'), 0),
           COALESCE(sum(commission_amount) FILTER (WHERE status = 'completed'), 0)
      FROM payments
     WHERE (p_from IS NULL OR created_at >= p_from)
       AND (p_to IS NULL OR created_at < p_to)
       AND (p_status IS NULL OR status = p_status)
       AND (p_vendor_id IS NULL OR owner_id = p_vendor_id)
       AND (p_zone_id IS NULL OR wifi_zone_id = p_zone_id);
$$;

CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_completed_idx ON payments (completed_at) WHERE status = 'completed';

REVOKE ALL ON FUNCTION admin_overview(timestamptz, timestamptz)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_vendor_stats(uuid)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_zone_stats()                                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_transactions_summary(timestamptz, timestamptz, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_overview(timestamptz, timestamptz)                        TO service_role;
GRANT EXECUTE ON FUNCTION admin_vendor_stats(uuid)                                         TO service_role;
GRANT EXECUTE ON FUNCTION admin_zone_stats()                                               TO service_role;
GRANT EXECUTE ON FUNCTION admin_transactions_summary(timestamptz, timestamptz, text, uuid, uuid) TO service_role;

COMMIT;
