-- =============================================================================
-- Migration 005 — validation d'un paiement réussi (webhook Moneroo)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 004.
--
-- complete_payment(paiement, méthode, transaction) : en une seule transaction,
--   1. passe le paiement en « completed » (méthode réelle, n° de transaction, date) ;
--   2. vend le ticket réservé pour ce paiement, même si les 15 minutes sont dépassées
--      (tant qu'aucun autre client ne l'a repris) ;
--   3. sinon, vend un autre ticket libre du MÊME forfait ;
--   4. s'il n'en reste aucun : le paiement est quand même « completed », la fonction
--      renvoie NULL (payé sans ticket : le gérant doit être prévenu).
-- Rappeler la fonction pour un paiement déjà validé renvoie le même ticket (ou NULL).
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION complete_payment(p_payment_id uuid, p_method text, p_transaction_id text)
RETURNS uuid
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

    -- Déjà validé (webhook reçu deux fois, ou page /merci) : même résultat.
    IF v_payment.status = 'completed' THEN
        SELECT id INTO v_ticket_id FROM tickets WHERE payment_id = p_payment_id AND status = 'sold';
        RETURN v_ticket_id;
    END IF;

    -- 1. Le ticket réservé pour ce paiement (reserve_ticket efface payment_id
    --    si un autre client l'a repris après expiration).
    SELECT id INTO v_ticket_id
      FROM tickets
     WHERE payment_id = p_payment_id
       AND status = 'reserved'
       FOR UPDATE SKIP LOCKED;

    -- 2. Sinon, un autre ticket disponible du même forfait.
    IF v_ticket_id IS NULL THEN
        SELECT id INTO v_ticket_id
          FROM tickets
         WHERE wifi_zone_id = v_payment.wifi_zone_id
           AND pricing_id   = v_payment.pricing_id
           AND (status = 'free' OR (status = 'reserved' AND reserved_until < now()))
         ORDER BY created_at, id
         LIMIT 1
           FOR UPDATE SKIP LOCKED;
    END IF;

    -- Un paiement « failed » ou « cancelled » qui réussit finalement chez Moneroo
    -- (rare, mais possible) est lui aussi validé : le client a payé.
    UPDATE payments
       SET status = 'completed',
           completed_at = now(),
           payment_method = COALESCE(NULLIF(p_method, ''), payment_method),
           transaction_id = COALESCE(NULLIF(p_transaction_id, ''), transaction_id)
     WHERE id = p_payment_id;

    IF v_ticket_id IS NOT NULL THEN
        UPDATE tickets
           SET status = 'sold',
               sold_at = now(),
               reserved_until = NULL,
               payment_id = p_payment_id
         WHERE id = v_ticket_id;
    END IF;

    RETURN v_ticket_id;
END;
$$;

COMMENT ON FUNCTION complete_payment(uuid, text, text) IS
    'Valide un paiement réussi et vend son ticket (ou un autre du même forfait). Renvoie l''id du ticket, ou NULL s''il n''y en a plus. Idempotent.';

REVOKE ALL ON FUNCTION complete_payment(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_payment(uuid, text, text) TO service_role;

COMMIT;
