-- =============================================================================
-- Migration 001 — cohérence des tickets et réservation sans risque
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après schema.sql.
--
--   1. Le forfait d'un ticket / d'un paiement doit appartenir à la même zone.
--   2. Un paiement ne peut être lié qu'à un seul ticket.
--   3. Le statut d'un ticket doit être cohérent avec ses autres colonnes.
--   4. Fonctions SQL pour réserver et vendre un ticket sans conflit
--      quand plusieurs clients paient en même temps.
--
-- Tout est dans une transaction : si une étape échoue (par exemple des
-- données existantes qui ne respectent pas une règle), rien n'est appliqué.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Forfait et zone cohérents
-- Un ticket ou un paiement de la zone A ne peut pas pointer vers un forfait de
-- la zone B. On s'appuie sur le couple (id, wifi_zone_id) du forfait.
-- -----------------------------------------------------------------------------
ALTER TABLE pricings
    ADD CONSTRAINT pricings_id_wifi_zone_id_key UNIQUE (id, wifi_zone_id);

ALTER TABLE tickets
    ADD CONSTRAINT tickets_pricing_same_zone_fkey
    FOREIGN KEY (pricing_id, wifi_zone_id)
    REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT;

ALTER TABLE payments
    ADD CONSTRAINT payments_pricing_same_zone_fkey
    FOREIGN KEY (pricing_id, wifi_zone_id)
    REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT;


-- -----------------------------------------------------------------------------
-- 2. Un paiement → un seul ticket
-- Remplace l'index simple sur payment_id par un index unique (il sert aussi
-- aux recherches, l'ancien devient inutile).
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS tickets_payment_id_idx;

CREATE UNIQUE INDEX tickets_payment_id_key
    ON tickets (payment_id)
    WHERE payment_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. Statut cohérent
--   free     : aucun paiement, pas de réservation, pas de date de vente
--   reserved : lié à un paiement, avec une date de fin de réservation
--   sold     : lié à un paiement, avec une date de vente
-- Effet secondaire voulu : on ne peut plus supprimer un paiement lié à un
-- ticket réservé ou vendu (le ON DELETE SET NULL violerait cette règle).
-- -----------------------------------------------------------------------------
ALTER TABLE tickets
    ADD CONSTRAINT tickets_status_coherence_check CHECK (
        (status = 'free'
            AND payment_id IS NULL AND reserved_until IS NULL AND sold_at IS NULL)
     OR (status = 'reserved'
            AND payment_id IS NOT NULL AND reserved_until IS NOT NULL AND sold_at IS NULL)
     OR (status = 'sold'
            AND payment_id IS NOT NULL AND reserved_until IS NULL AND sold_at IS NOT NULL)
    );


-- -----------------------------------------------------------------------------
-- 4. Réservation et vente sans conflit
--
-- Le client Supabase (JavaScript) ne gère pas les transactions : ces fonctions
-- s'exécutent d'un bloc dans Postgres. FOR UPDATE SKIP LOCKED garantit que
-- deux clients qui paient au même moment ne reçoivent jamais le même ticket.
--
-- Appel depuis le backend :
--   supabase.rpc('reserve_ticket', { p_payment_id, p_minutes })
--   supabase.rpc('sell_ticket', { p_payment_id, p_transaction_id })
--   supabase.rpc('release_expired_reservations')
-- -----------------------------------------------------------------------------

-- Remet en « free » toutes les réservations expirées.
-- Renvoie le nombre de tickets libérés. Peut être appelée régulièrement (cron).
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE tickets
       SET status = 'free', reserved_until = NULL, payment_id = NULL
     WHERE status = 'reserved'
       AND reserved_until < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION release_expired_reservations() IS
    'Libère les tickets dont la réservation a expiré. Renvoie le nombre de tickets libérés.';


-- Réserve un ticket libre pour un paiement en attente (« pending »).
-- La zone et le forfait sont lus dans le paiement.
-- Renvoie le ticket réservé, ou aucune ligne s'il n'y a plus de ticket libre.
-- Si un ticket est déjà réservé pour ce paiement, prolonge sa réservation et
-- le renvoie (on peut donc rappeler la fonction sans risque).
CREATE OR REPLACE FUNCTION reserve_ticket(p_payment_id uuid, p_minutes integer DEFAULT 10)
RETURNS SETOF tickets
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_payment   payments%ROWTYPE;
    v_ticket_id uuid;
BEGIN
    IF p_minutes IS NULL OR p_minutes <= 0 THEN
        RAISE EXCEPTION 'p_minutes doit être supérieur à 0';
    END IF;

    -- Verrouille le paiement : deux appels simultanés pour le même paiement
    -- passent l'un après l'autre.
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable : %', p_payment_id;
    END IF;
    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'Le paiement % n''est pas en attente (statut : %)',
            p_payment_id, v_payment.status;
    END IF;

    -- Déjà un ticket réservé pour ce paiement : on prolonge et on le renvoie.
    RETURN QUERY
        UPDATE tickets
           SET reserved_until = now() + make_interval(mins => p_minutes)
         WHERE payment_id = p_payment_id
           AND status = 'reserved'
        RETURNING *;
    IF FOUND THEN
        RETURN;
    END IF;

    -- Libère les réservations expirées de ce forfait pour les rendre disponibles.
    UPDATE tickets
       SET status = 'free', reserved_until = NULL, payment_id = NULL
     WHERE wifi_zone_id = v_payment.wifi_zone_id
       AND pricing_id   = v_payment.pricing_id
       AND status = 'reserved'
       AND reserved_until < now();

    -- Prend le plus ancien ticket libre, en sautant ceux qu'un autre client
    -- est déjà en train de prendre.
    SELECT id INTO v_ticket_id
      FROM tickets
     WHERE wifi_zone_id = v_payment.wifi_zone_id
       AND pricing_id   = v_payment.pricing_id
       AND status = 'free'
     ORDER BY created_at
     LIMIT 1
       FOR UPDATE SKIP LOCKED;

    IF v_ticket_id IS NULL THEN
        RETURN; -- plus de ticket libre : aucune ligne renvoyée
    END IF;

    RETURN QUERY
        UPDATE tickets
           SET status = 'reserved',
               payment_id = p_payment_id,
               reserved_until = now() + make_interval(mins => p_minutes)
         WHERE id = v_ticket_id
        RETURNING *;
END;
$$;

COMMENT ON FUNCTION reserve_ticket(uuid, integer) IS
    'Réserve un ticket libre pour un paiement en attente. Renvoie le ticket, ou rien s''il n''y en a plus.';


-- Valide un paiement et vend le ticket, dans une seule transaction :
--   - le paiement passe en « completed » ;
--   - le ticket réservé pour ce paiement passe en « sold ».
-- Si la réservation a expiré entre-temps et que le ticket a été repris, un
-- autre ticket libre est attribué : un client qui a payé reçoit toujours un
-- ticket tant qu'il en reste.
-- Renvoie le ticket vendu. Si plus aucun ticket n'est disponible, le paiement
-- est quand même marqué « completed » (l'argent est reçu) et la fonction ne
-- renvoie aucune ligne : le backend doit alors prévenir le gérant.
-- Rappeler la fonction pour un paiement déjà vendu renvoie le même ticket.
CREATE OR REPLACE FUNCTION sell_ticket(p_payment_id uuid, p_transaction_id text DEFAULT NULL)
RETURNS SETOF tickets
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_payment   payments%ROWTYPE;
    v_ticket_id uuid;
BEGIN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable : %', p_payment_id;
    END IF;
    IF v_payment.status NOT IN ('pending', 'completed') THEN
        RAISE EXCEPTION 'Le paiement % ne peut pas être validé (statut : %)',
            p_payment_id, v_payment.status;
    END IF;

    UPDATE payments
       SET status = 'completed',
           completed_at = COALESCE(completed_at, now()),
           transaction_id = COALESCE(p_transaction_id, transaction_id)
     WHERE id = p_payment_id;

    -- Déjà vendu (appel répété) : on renvoie le même ticket.
    RETURN QUERY SELECT * FROM tickets WHERE payment_id = p_payment_id AND status = 'sold';
    IF FOUND THEN
        RETURN;
    END IF;

    -- Cas normal : le ticket réservé pour ce paiement devient vendu.
    RETURN QUERY
        UPDATE tickets
           SET status = 'sold', sold_at = now(), reserved_until = NULL
         WHERE payment_id = p_payment_id
           AND status = 'reserved'
        RETURNING *;
    IF FOUND THEN
        RETURN;
    END IF;

    -- La réservation a été perdue : on prend un autre ticket libre
    -- (ou dont la réservation a expiré).
    SELECT id INTO v_ticket_id
      FROM tickets
     WHERE wifi_zone_id = v_payment.wifi_zone_id
       AND pricing_id   = v_payment.pricing_id
       AND (status = 'free' OR (status = 'reserved' AND reserved_until < now()))
     ORDER BY created_at
     LIMIT 1
       FOR UPDATE SKIP LOCKED;

    IF v_ticket_id IS NULL THEN
        RETURN; -- payé mais plus de ticket : aucune ligne renvoyée
    END IF;

    RETURN QUERY
        UPDATE tickets
           SET status = 'sold',
               sold_at = now(),
               reserved_until = NULL,
               payment_id = p_payment_id
         WHERE id = v_ticket_id
        RETURNING *;
END;
$$;

COMMENT ON FUNCTION sell_ticket(uuid, text) IS
    'Valide un paiement et vend son ticket en une seule transaction. Ne renvoie rien si aucun ticket n''est disponible.';


-- Ces fonctions ne doivent être appelables que par le backend (service_role).
-- Par défaut, Supabase les rendrait accessibles aux clés anon et authenticated.
REVOKE ALL ON FUNCTION release_expired_reservations()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reserve_ticket(uuid, integer)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sell_ticket(uuid, text)          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION release_expired_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION reserve_ticket(uuid, integer)  TO service_role;
GRANT EXECUTE ON FUNCTION sell_ticket(uuid, text)        TO service_role;

COMMIT;
