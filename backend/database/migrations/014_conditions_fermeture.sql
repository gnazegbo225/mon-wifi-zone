-- =============================================================================
-- Migration 014 — conditions générales, fermeture de compte, suppression des pièces d'identité
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 013.
-- Copier TOUT le fichier (Ctrl+A), y compris cette première ligne de commentaire.
--
--   1. users.terms_version / terms_accepted_at : version des conditions acceptée par le promoteur, et quand.
--   2. Statut « closed » (compte fermé) et users.closed_at. Un compte fermé ne se rouvre pas.
--   3. close_vendor_account(promoteur, auteur, motif) : ferme le compte si plus rien n'est dû au promoteur
--      (solde disponible, en attente et retraits en cours à 0), et arrête ses zones.
--   4. vendor_profiles.documents_purged_at et vendor_kyc_to_purge(jours) : un an après la fermeture,
--      les photos de la CNI et le selfie sont supprimés (le serveur s'en charge chaque jour).
--
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Acceptation des conditions générales
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version     text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- -----------------------------------------------------------------------------
-- 2. Compte fermé
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (
    account_status IN ('pending_review', 'approved', 'rejected', 'suspended', 'closed')
    AND (role = 'vendor' OR account_status IN ('approved', 'suspended'))
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_closed_at_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_closed_at_check CHECK ((account_status = 'closed') = (closed_at IS NOT NULL));
    END IF;
END;
$$;

ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS documents_purged_at timestamptz;

-- -----------------------------------------------------------------------------
-- 3. Fermeture d'un compte promoteur
-- Erreurs : vendor:forbidden · vendor:not_found · vendor:already_closed · vendor:reason_required
--           vendor:payments_in_progress (un client est en train de payer)
--           vendor:balance_not_zero (DETAIL : disponible,en attente,retraits en cours)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION close_vendor_account(p_vendor_id uuid, p_actor_id uuid, p_reason text)
RETURNS users
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user    users%ROWTYPE;
    v_balance record;
    v_from    text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_actor_id AND role = 'super_admin' AND account_status = 'approved') THEN
        RAISE EXCEPTION 'vendor:forbidden';
    END IF;

    -- Verrou : aucune vente ni demande de retrait ne peut se glisser pendant la vérification du solde.
    SELECT * INTO v_user FROM users WHERE id = p_vendor_id FOR UPDATE;
    IF NOT FOUND OR v_user.role <> 'vendor' THEN
        RAISE EXCEPTION 'vendor:not_found';
    END IF;
    IF v_user.account_status = 'closed' THEN
        RAISE EXCEPTION 'vendor:already_closed';
    END IF;
    IF length(trim(COALESCE(p_reason, ''))) = 0 THEN
        RAISE EXCEPTION 'vendor:reason_required';
    END IF;

    SELECT * INTO v_balance FROM vendor_balance(p_vendor_id);
    IF v_balance.available_amount <> 0 OR v_balance.pending_amount <> 0 OR v_balance.in_withdrawal <> 0 THEN
        RAISE EXCEPTION 'vendor:balance_not_zero'
            USING DETAIL = v_balance.available_amount || ',' || v_balance.pending_amount || ',' || v_balance.in_withdrawal;
    END IF;

    -- Un client en train de payer (réservation de 15 min) : sa vente créditerait un compte fermé.
    IF EXISTS (SELECT 1 FROM payments WHERE owner_id = p_vendor_id AND status = 'pending' AND created_at > now() - interval '30 minutes') THEN
        RAISE EXCEPTION 'vendor:payments_in_progress';
    END IF;

    -- Les clients ne peuvent plus acheter dans ses zones.
    UPDATE wifi_zones SET is_active = false WHERE owner_id = p_vendor_id;

    v_from := v_user.account_status;
    UPDATE users SET account_status = 'closed', closed_at = now() WHERE id = p_vendor_id RETURNING * INTO v_user;

    INSERT INTO verification_events (vendor_id, from_status, to_status, actor_id, kind, note)
    VALUES (p_vendor_id, v_from, 'closed', p_actor_id, 'status', trim(p_reason));

    RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION close_vendor_account(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION close_vendor_account(uuid, uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Pièces d'identité à supprimer : comptes fermés depuis plus de p_days jours, pièces encore là.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vendor_kyc_to_purge(p_days integer)
RETURNS TABLE (user_id uuid, id_front_path text, id_back_path text, selfie_path text, closed_at timestamptz)
LANGUAGE sql
STABLE
AS $$
    SELECT p.user_id, p.id_front_path, p.id_back_path, p.selfie_path, u.closed_at
      FROM vendor_profiles p
      JOIN users u ON u.id = p.user_id
     WHERE u.account_status = 'closed'
       AND u.closed_at < now() - make_interval(days => p_days)
       AND p.documents_purged_at IS NULL
     ORDER BY u.closed_at
     LIMIT 200
$$;

REVOKE ALL ON FUNCTION vendor_kyc_to_purge(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION vendor_kyc_to_purge(integer) TO service_role;

COMMIT;
