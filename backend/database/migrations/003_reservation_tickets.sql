-- =============================================================================
-- Migration 003 — réservation sans conflit et règles de cohérence des tickets
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 002.
--
-- REMPLACE LA MIGRATION 001 (qui n'a jamais été exécutée : ne l'exécute pas).
-- Elle en reprend les règles utiles, corrigées pour la nouvelle réservation :
--   1. Le forfait d'un ticket / d'un paiement appartient à la même zone.
--   2. Un profil MikroTik désigne un seul forfait par zone.
--   3. Un paiement ne peut être relié qu'à un seul ticket.
--   4. Le statut d'un ticket est cohérent avec ses autres colonnes.
--      Différence avec la 001 : un ticket « reserved » n'a pas encore de
--      paiement (le paiement n'est relié qu'à la vente, par confirm_ticket).
--   5. Deux fonctions :
--      reserve_ticket(zone, forfait, minutes) : réserve un ticket libre et
--        renvoie son id (NULL s'il n'y en a plus). FOR UPDATE SKIP LOCKED.
--      confirm_ticket(ticket, paiement) : passe le ticket réservé en « sold ».
--
-- Tout est dans une transaction : si une étape échoue (par exemple des données
-- existantes qui ne respectent pas une règle), rien n'est appliqué.
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Forfait et zone cohérents
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricings_id_wifi_zone_id_key') THEN
        ALTER TABLE pricings
            ADD CONSTRAINT pricings_id_wifi_zone_id_key UNIQUE (id, wifi_zone_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_pricing_same_zone_fkey') THEN
        ALTER TABLE tickets
            ADD CONSTRAINT tickets_pricing_same_zone_fkey
            FOREIGN KEY (pricing_id, wifi_zone_id)
            REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_pricing_same_zone_fkey') THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_pricing_same_zone_fkey
            FOREIGN KEY (pricing_id, wifi_zone_id)
            REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT;
    END IF;

-- -----------------------------------------------------------------------------
-- 2. Un profil MikroTik = un seul forfait par zone
-- -----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricings_zone_profile_key') THEN
        ALTER TABLE pricings
            ADD CONSTRAINT pricings_zone_profile_key UNIQUE (wifi_zone_id, ticket_profile);
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Un paiement → un seul ticket
-- L'index unique remplace l'index simple (il sert aussi aux recherches).
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS tickets_payment_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_payment_id_key
    ON tickets (payment_id)
    WHERE payment_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Statut cohérent
--   free     : pas de paiement, pas de réservation, pas de date de vente
--   reserved : une date de fin de réservation (pas encore de paiement relié)
--   sold     : relié à un paiement, avec une date de vente
-- -----------------------------------------------------------------------------
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_coherence_check;

ALTER TABLE tickets
    ADD CONSTRAINT tickets_status_coherence_check CHECK (
        (status = 'free'
            AND payment_id IS NULL AND reserved_until IS NULL AND sold_at IS NULL)
     OR (status = 'reserved'
            AND reserved_until IS NOT NULL AND sold_at IS NULL)
     OR (status = 'sold'
            AND payment_id IS NOT NULL AND reserved_until IS NULL AND sold_at IS NOT NULL)
    );

-- -----------------------------------------------------------------------------
-- 5. Fonctions. Les anciennes fonctions de la 001 sont retirées si elles existent.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS reserve_ticket(uuid, integer);
DROP FUNCTION IF EXISTS sell_ticket(uuid, text);
DROP FUNCTION IF EXISTS release_expired_reservations();

-- -----------------------------------------------------------------------------
-- Réservation et vente sans conflit
--
-- Le client Supabase (JavaScript) ne gère pas les transactions : ces fonctions
-- s'exécutent d'un bloc dans Postgres. FOR UPDATE SKIP LOCKED garantit que
-- deux clients qui achètent au même moment ne reçoivent jamais le même ticket.
--
-- Appel depuis le backend :
--   supabase.rpc('reserve_ticket', { p_zone_id, p_pricing_id, p_minutes })
--   supabase.rpc('confirm_ticket', { p_ticket_id, p_payment_id })
-- -----------------------------------------------------------------------------

-- Réserve un ticket libre du forfait demandé, pour p_minutes minutes.
-- Un ticket « reserved » dont le délai est dépassé compte comme libre.
-- Renvoie l'id du ticket réservé, ou NULL s'il n'y a plus de ticket libre.
-- Aucun repli vers un autre forfait : seul le forfait demandé est servi.
CREATE OR REPLACE FUNCTION reserve_ticket(p_zone_id uuid, p_pricing_id uuid, p_minutes integer DEFAULT 10)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_ticket_id uuid;
BEGIN
    IF p_minutes IS NULL OR p_minutes <= 0 THEN
        RAISE EXCEPTION 'p_minutes doit être supérieur à 0';
    END IF;

    -- Le forfait doit appartenir à la zone, et les deux doivent être en vente.
    PERFORM 1
       FROM pricings p
       JOIN wifi_zones z ON z.id = p.wifi_zone_id
      WHERE p.id = p_pricing_id
        AND p.wifi_zone_id = p_zone_id
        AND p.is_active
        AND z.is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Forfait % introuvable ou pas en vente dans la zone %', p_pricing_id, p_zone_id;
    END IF;

    -- Prend le plus ancien ticket disponible, en sautant ceux qu'un autre
    -- client est en train de prendre au même instant.
    SELECT id INTO v_ticket_id
      FROM tickets
     WHERE wifi_zone_id = p_zone_id
       AND pricing_id   = p_pricing_id
       AND (status = 'free' OR (status = 'reserved' AND reserved_until < now()))
     ORDER BY created_at, id
     LIMIT 1
       FOR UPDATE SKIP LOCKED;

    IF v_ticket_id IS NULL THEN
        RETURN NULL; -- plus de ticket disponible pour ce forfait
    END IF;

    UPDATE tickets
       SET status = 'reserved',
           reserved_until = now() + make_interval(mins => p_minutes),
           payment_id = NULL
     WHERE id = v_ticket_id;

    RETURN v_ticket_id;
END;
$$;

COMMENT ON FUNCTION reserve_ticket(uuid, uuid, integer) IS
    'Réserve un ticket libre du forfait (FOR UPDATE SKIP LOCKED). Renvoie son id, ou NULL s''il n''y en a plus. Aucun repli vers un autre forfait.';


-- Vend un ticket réservé : il passe en « sold » et est relié au paiement.
-- Refuse si le ticket n'est pas réservé, si sa réservation a expiré, ou si le
-- paiement concerne un autre forfait. Renvoie le ticket vendu.
-- Rappeler la fonction avec le même paiement renvoie le même ticket.
CREATE OR REPLACE FUNCTION confirm_ticket(p_ticket_id uuid, p_payment_id uuid)
RETURNS tickets
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_ticket  tickets%ROWTYPE;
    v_payment payments%ROWTYPE;
BEGIN
    SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket introuvable : %', p_ticket_id;
    END IF;

    -- Appel répété pour le même paiement : on renvoie le ticket déjà vendu.
    IF v_ticket.status = 'sold' THEN
        IF v_ticket.payment_id = p_payment_id THEN
            RETURN v_ticket;
        END IF;
        RAISE EXCEPTION 'Le ticket % est déjà vendu', p_ticket_id;
    END IF;

    IF v_ticket.status <> 'reserved' THEN
        RAISE EXCEPTION 'Le ticket % n''est pas réservé', p_ticket_id;
    END IF;
    IF v_ticket.reserved_until < now() THEN
        RAISE EXCEPTION 'La réservation du ticket % a expiré', p_ticket_id;
    END IF;

    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable : %', p_payment_id;
    END IF;
    IF v_payment.status IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'Le paiement % a échoué ou a été annulé', p_payment_id;
    END IF;
    IF v_payment.pricing_id <> v_ticket.pricing_id OR v_payment.wifi_zone_id <> v_ticket.wifi_zone_id THEN
        RAISE EXCEPTION 'Le paiement % ne correspond pas au forfait du ticket %', p_payment_id, p_ticket_id;
    END IF;

    UPDATE tickets
       SET status = 'sold',
           sold_at = now(),
           reserved_until = NULL,
           payment_id = p_payment_id
     WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    RETURN v_ticket;
END;
$$;

COMMENT ON FUNCTION confirm_ticket(uuid, uuid) IS
    'Vend un ticket réservé et le relie au paiement. Refuse une réservation expirée ou un paiement d''un autre forfait.';


-- Ces fonctions ne doivent être appelables que par le backend (service_role).
-- Par défaut, Supabase les rendrait accessibles aux clés anon et authenticated.
REVOKE ALL ON FUNCTION reserve_ticket(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION confirm_ticket(uuid, uuid)          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION reserve_ticket(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_ticket(uuid, uuid)          TO service_role;

COMMIT;
