-- =============================================================================
-- Migration 012 — espace développeur
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 011.
--
--   1. payment_sync_events : chaque relecture d'un paiement chez Moneroo (webhook, page /merci quand
--      elle change le statut, ou bouton « Resynchroniser » du développeur) et son résultat.
--   2. Le compte développeur a toujours une double authentification (comme le super admin).
--   3. Le journal accepte les actions sur un paiement (resynchronisation par le développeur).
--   4. dev_overview() : les chiffres de santé des paiements (en attente, payés sans ticket, webhooks…),
--      et dev_payments_without_ticket() : la liste des paiements réussis restés sans ticket.
--
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Relectures des paiements chez Moneroo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_sync_events (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    -- webhook : envoyé par Moneroo ; return_page : page /merci du client ; developer : bouton de l'espace développeur
    source               text        NOT NULL CHECK (source IN ('webhook', 'return_page', 'developer')),
    event                text,
    provider_payment_id  text,
    payment_id           uuid        REFERENCES payments (id) ON DELETE SET NULL,
    -- updated : statut changé ; unchanged : rien à faire ; unknown_payment : paiement inconnu de la base ;
    -- amount_mismatch : montant ou devise différents (ticket refusé) ; no_ticket : payé mais plus de ticket ;
    -- error : Moneroo injoignable ou erreur inattendue
    outcome              text        NOT NULL
                                     CHECK (outcome IN ('updated', 'unchanged', 'unknown_payment', 'amount_mismatch', 'no_ticket', 'error')),
    status_before        text,
    status_after         text,
    error                text,
    duration_ms          integer,
    actor_id             uuid        REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS payment_sync_events_created_idx ON payment_sync_events (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_sync_events_payment_idx ON payment_sync_events (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_sync_events_source_idx  ON payment_sync_events (source, created_at DESC);

COMMENT ON TABLE payment_sync_events IS
    'Relectures des paiements chez Moneroo (webhook, page de retour, développeur) et leur résultat. Sert au diagnostic.';

-- Paiements encore en attente (recherche des paiements bloqués).
CREATE INDEX IF NOT EXISTS payments_pending_idx ON payments (created_at) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 2. Double authentification obligatoire pour le développeur
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_developer_mfa_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_developer_mfa_check CHECK (role <> 'developer' OR mfa_secret IS NOT NULL);
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Journal : actions sur un paiement
-- -----------------------------------------------------------------------------
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_target_type_check
    CHECK (target_type IN ('vendor', 'withdrawal', 'setting', 'account', 'payment'));

-- -----------------------------------------------------------------------------
-- 4. Santé des paiements
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dev_overview(p_stuck_minutes integer DEFAULT 15)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'payments', jsonb_build_object(
            'pending_stuck',   (SELECT count(*) FROM payments WHERE status = 'pending' AND created_at <  now() - make_interval(mins => p_stuck_minutes)),
            'pending_recent',  (SELECT count(*) FROM payments WHERE status = 'pending' AND created_at >= now() - make_interval(mins => p_stuck_minutes)),
            'completed_24h',   (SELECT count(*) FROM payments WHERE status = 'completed' AND completed_at >= now() - interval '24 hours'),
            'failed_24h',      (SELECT count(*) FROM payments WHERE status IN ('failed', 'cancelled') AND created_at >= now() - interval '24 hours'),
            'without_ticket',  (SELECT count(*) FROM payments p
                                 WHERE p.status = 'completed'
                                   AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.payment_id = p.id))
        ),
        'syncs', jsonb_build_object(
            'last_webhook_at',  (SELECT max(created_at) FROM payment_sync_events WHERE source = 'webhook'),
            'webhooks_24h',     (SELECT count(*) FROM payment_sync_events WHERE source = 'webhook' AND created_at >= now() - interval '24 hours'),
            'return_page_24h',  (SELECT count(*) FROM payment_sync_events WHERE source = 'return_page' AND created_at >= now() - interval '24 hours'),
            'problems_24h',     (SELECT count(*) FROM payment_sync_events
                                  WHERE outcome IN ('unknown_payment', 'amount_mismatch', 'no_ticket', 'error')
                                    AND created_at >= now() - interval '24 hours')
        )
    )
$$;

REVOKE ALL ON FUNCTION dev_overview(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dev_overview(integer) TO service_role;

-- Paiements réussis sans ticket (stock épuisé au moment du paiement), les plus récents d'abord.
CREATE OR REPLACE FUNCTION dev_payments_without_ticket(p_limit integer, p_offset integer)
RETURNS SETOF payments
LANGUAGE sql
STABLE
AS $$
    SELECT p.*
      FROM payments p
     WHERE p.status = 'completed'
       AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.payment_id = p.id)
     ORDER BY p.completed_at DESC
     LIMIT p_limit OFFSET p_offset
$$;

REVOKE ALL ON FUNCTION dev_payments_without_ticket(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dev_payments_without_ticket(integer, integer) TO service_role;

COMMIT;
