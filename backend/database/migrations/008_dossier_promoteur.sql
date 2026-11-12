-- =============================================================================
-- Migration 008 — dossier de vérification des promoteurs
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 007.
--
--   1. vendor_profiles : identité (CNI), photos (recto, verso, selfie) et compte de retrait.
--      Les photos sont dans le stockage privé « kyc-documents » : seul le backend y accède,
--      le super admin les voit par un lien temporaire.
--   2. verification_events : historique des vérifications (qui, quand, liste de contrôle, motif).
--   3. Fonctions :
--        submit_vendor_profile(promoteur)              envoie le dossier complet au super admin
--        set_vendor_status(promoteur, statut, auteur…)  approuver, rejeter, suspendre, réactiver
--   4. Stockage privé kyc-documents (Supabase Storage).
--
-- Un promoteur inscrit (pending_review) peut déjà vendre ; il ne peut retirer qu'une fois approuvé.
-- Tout est dans une transaction. Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Dossier du promoteur
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_profiles (
    user_id          uuid        PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
    legal_name       text,       -- nom complet, tel qu'écrit sur la CNI
    business_name    text,       -- nom commercial (facultatif)
    city             text,
    id_type          text        NOT NULL DEFAULT 'cni' CHECK (id_type IN ('cni')),
    id_number        text,
    -- Chemins dans le stockage privé kyc-documents (jamais d'adresse publique).
    id_front_path    text,
    id_back_path     text,
    selfie_path      text,
    -- Compte de retrait par défaut (les retraits en copient les coordonnées).
    payout_method    text        CHECK (payout_method IN ('bank_transfer', 'mtn_ci', 'wave_ci', 'orange_ci')),
    payout_phone     text        CHECK (payout_phone IS NULL OR payout_phone ~ '^\+?[0-9]{8,15}$'),
    bank_name        text,
    account_holder   text,
    account_number   text,
    -- Rempli à l'envoi du dossier ; remis à NULL si le promoteur le modifie après un rejet.
    submitted_at     timestamptz,
    reviewed_by      uuid        REFERENCES users (id),
    reviewed_at      timestamptz,
    rejection_reason text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vendor_profiles_set_updated_at ON vendor_profiles;
CREATE TRIGGER vendor_profiles_set_updated_at
    BEFORE UPDATE ON vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS vendor_profiles_submitted_idx ON vendor_profiles (submitted_at) WHERE submitted_at IS NOT NULL;

COMMENT ON TABLE vendor_profiles IS
    'Dossier de vérification d''un promoteur : identité (CNI), photos dans le stockage privé kyc-documents, compte de retrait par défaut.';

-- -----------------------------------------------------------------------------
-- 2. Historique des vérifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_events (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    from_status  text        NOT NULL,
    to_status    text        NOT NULL,
    actor_id     uuid        NOT NULL REFERENCES users (id),
    -- submitted : dossier envoyé ; review : décision du super admin ; status : suspension / réactivation.
    kind         text        NOT NULL CHECK (kind IN ('submitted', 'review', 'status')),
    note         text,
    -- Liste de contrôle cochée par le super admin (ex : {"id_readable": true, "selfie_matches": true}).
    checklist    jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_events_vendor_idx ON verification_events (vendor_id, created_at);

COMMENT ON TABLE verification_events IS 'Historique de la vérification de chaque promoteur : envois du dossier, décisions, suspensions.';

-- -----------------------------------------------------------------------------
-- 3. Fonctions
-- -----------------------------------------------------------------------------

-- Envoie le dossier au super admin. Refuse un dossier incomplet.
-- Erreurs : profile:not_vendor · profile:already_approved · profile:suspended · profile:incomplete (DETAIL = champs manquants)
CREATE OR REPLACE FUNCTION submit_vendor_profile(p_vendor_id uuid)
RETURNS vendor_profiles
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user    users%ROWTYPE;
    v_profile vendor_profiles%ROWTYPE;
    v_missing text[] := '{}';
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_vendor_id FOR UPDATE;
    IF NOT FOUND OR v_user.role <> 'vendor' THEN
        RAISE EXCEPTION 'profile:not_vendor';
    END IF;
    IF v_user.account_status = 'approved' THEN
        RAISE EXCEPTION 'profile:already_approved';
    END IF;
    IF v_user.account_status = 'suspended' THEN
        RAISE EXCEPTION 'profile:suspended';
    END IF;

    SELECT * INTO v_profile FROM vendor_profiles WHERE user_id = p_vendor_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile:incomplete' USING DETAIL = 'legal_name,city,id_number,id_front,id_back,selfie,payout';
    END IF;

    IF length(trim(COALESCE(v_profile.legal_name, ''))) = 0 THEN v_missing := array_append(v_missing, 'legal_name'); END IF;
    IF length(trim(COALESCE(v_profile.city, ''))) = 0 THEN v_missing := array_append(v_missing, 'city'); END IF;
    IF length(trim(COALESCE(v_profile.id_number, ''))) = 0 THEN v_missing := array_append(v_missing, 'id_number'); END IF;
    IF v_profile.id_front_path IS NULL THEN v_missing := array_append(v_missing, 'id_front'); END IF;
    IF v_profile.id_back_path IS NULL THEN v_missing := array_append(v_missing, 'id_back'); END IF;
    IF v_profile.selfie_path IS NULL THEN v_missing := array_append(v_missing, 'selfie'); END IF;
    IF v_profile.payout_method IS NULL
       OR (v_profile.payout_method = 'bank_transfer'
           AND (v_profile.bank_name IS NULL OR v_profile.account_holder IS NULL OR v_profile.account_number IS NULL))
       OR (v_profile.payout_method <> 'bank_transfer' AND v_profile.payout_phone IS NULL) THEN
        v_missing := array_append(v_missing, 'payout');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'profile:incomplete' USING DETAIL = array_to_string(v_missing, ',');
    END IF;

    UPDATE vendor_profiles
       SET submitted_at = now(), rejection_reason = NULL
     WHERE user_id = p_vendor_id
    RETURNING * INTO v_profile;

    -- Après un rejet, le dossier corrigé repart en vérification.
    UPDATE users SET account_status = 'pending_review' WHERE id = p_vendor_id;

    INSERT INTO verification_events (vendor_id, from_status, to_status, actor_id, kind)
    VALUES (p_vendor_id, v_user.account_status, 'pending_review', p_vendor_id, 'submitted');

    RETURN v_profile;
END;
$$;

-- Décision du super admin sur un promoteur. Transitions :
--   pending_review → approved (dossier envoyé) · rejected (motif)
--   approved → suspended (motif) ; suspended → approved
-- Erreurs : vendor:not_found · vendor:forbidden · vendor:bad_transition · vendor:not_submitted · vendor:reason_required
CREATE OR REPLACE FUNCTION set_vendor_status(
    p_vendor_id uuid,
    p_status    text,
    p_actor_id  uuid,
    p_note      text,
    p_checklist jsonb
)
RETURNS users
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user    users%ROWTYPE;
    v_profile vendor_profiles%ROWTYPE;
    v_from    text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_actor_id AND role = 'super_admin' AND account_status = 'approved') THEN
        RAISE EXCEPTION 'vendor:forbidden';
    END IF;

    SELECT * INTO v_user FROM users WHERE id = p_vendor_id FOR UPDATE;
    IF NOT FOUND OR v_user.role <> 'vendor' THEN
        RAISE EXCEPTION 'vendor:not_found';
    END IF;
    v_from := v_user.account_status;

    IF NOT (
        (v_from = 'pending_review' AND p_status IN ('approved', 'rejected'))
     OR (v_from = 'approved'       AND p_status = 'suspended')
     OR (v_from = 'suspended'      AND p_status = 'approved')
    ) THEN
        RAISE EXCEPTION 'vendor:bad_transition' USING DETAIL = v_from || ' → ' || p_status;
    END IF;

    IF p_status IN ('rejected', 'suspended') AND length(trim(COALESCE(p_note, ''))) = 0 THEN
        RAISE EXCEPTION 'vendor:reason_required';
    END IF;

    -- Une première approbation exige un dossier envoyé.
    IF v_from = 'pending_review' THEN
        SELECT * INTO v_profile FROM vendor_profiles WHERE user_id = p_vendor_id FOR UPDATE;
        IF NOT FOUND OR v_profile.submitted_at IS NULL THEN
            RAISE EXCEPTION 'vendor:not_submitted';
        END IF;
        UPDATE vendor_profiles
           SET reviewed_by = p_actor_id,
               reviewed_at = now(),
               rejection_reason = CASE WHEN p_status = 'rejected' THEN trim(p_note) ELSE NULL END
         WHERE user_id = p_vendor_id;
    END IF;

    UPDATE users SET account_status = p_status WHERE id = p_vendor_id RETURNING * INTO v_user;

    INSERT INTO verification_events (vendor_id, from_status, to_status, actor_id, kind, note, checklist)
    VALUES (
        p_vendor_id, v_from, p_status, p_actor_id,
        CASE WHEN v_from = 'pending_review' THEN 'review' ELSE 'status' END,
        NULLIF(trim(COALESCE(p_note, '')), ''),
        p_checklist
    );

    RETURN v_user;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Stockage privé des pièces (Supabase Storage). Ignoré hors Supabase.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('kyc-documents', 'kyc-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
        ON CONFLICT (id) DO NOTHING;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Accès : seul le backend (service_role)
-- -----------------------------------------------------------------------------
ALTER TABLE vendor_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION submit_vendor_profile(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_vendor_status(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_vendor_profile(uuid)                      TO service_role;
GRANT EXECUTE ON FUNCTION set_vendor_status(uuid, text, uuid, text, jsonb) TO service_role;

COMMIT;
