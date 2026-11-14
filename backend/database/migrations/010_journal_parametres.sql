-- =============================================================================
-- Migration 010 — journal des actions du super admin et modification des paramètres
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 009.
--
--   1. audit_log : chaque action du super admin (connexion, vérification, suspension, retrait,
--      correction de solde, paramètres…), en ajout seulement : ni modifiable ni supprimable.
--   2. set_platform_setting(clé, valeur, auteur) : change un paramètre dans des bornes sûres
--      et l'inscrit au journal, dans la même transaction.
--
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Journal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     uuid        NOT NULL REFERENCES users (id),
    -- Ex : vendor.approve, withdrawal.paid, adjustment.create, setting.update, admin.login
    action       text        NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
    target_type  text        CHECK (target_type IN ('vendor', 'withdrawal', 'setting', 'account')),
    target_id    text,
    -- Ce qu'il faut pour relire l'action sans jointure : nom du promoteur, montant, ancienne et nouvelle valeur…
    details      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ip           text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log (target_type, target_id);

COMMENT ON TABLE audit_log IS
    'Journal des actions du super admin, en ajout seulement. Chaque ligne dit qui a fait quoi, sur quoi, quand et depuis quelle adresse IP.';

CREATE OR REPLACE FUNCTION audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Le journal ne se modifie pas et ne s''efface pas.';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Modification d'un paramètre (bornes sûres, inscrite au journal)
--   commission_rate_bps : 0 à 3 000 (0 à 30 %)
--   min_withdrawal      : 100 à 1 000 000 F
--   hold_hours          : 0 à 720 h (30 jours)
-- Erreurs : setting:forbidden · setting:unknown · setting:out_of_range (DETAIL = « min-max »)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_platform_setting(p_key text, p_value integer, p_actor_id uuid, p_ip text)
RETURNS platform_settings
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_old     integer;
    v_min     integer;
    v_max     integer;
    v_setting platform_settings%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_actor_id AND role = 'super_admin' AND account_status = 'approved') THEN
        RAISE EXCEPTION 'setting:forbidden';
    END IF;

    SELECT CASE p_key WHEN 'commission_rate_bps' THEN 0 WHEN 'min_withdrawal' THEN 100 WHEN 'hold_hours' THEN 0 END,
           CASE p_key WHEN 'commission_rate_bps' THEN 3000 WHEN 'min_withdrawal' THEN 1000000 WHEN 'hold_hours' THEN 720 END
      INTO v_min, v_max;
    IF v_min IS NULL THEN
        RAISE EXCEPTION 'setting:unknown';
    END IF;
    IF p_value IS NULL OR p_value < v_min OR p_value > v_max THEN
        RAISE EXCEPTION 'setting:out_of_range' USING DETAIL = v_min || '-' || v_max;
    END IF;

    SELECT value INTO v_old FROM platform_settings WHERE key = p_key FOR UPDATE;
    IF v_old IS NOT DISTINCT FROM p_value THEN
        SELECT * INTO v_setting FROM platform_settings WHERE key = p_key;
        RETURN v_setting; -- rien ne change : rien à journaliser
    END IF;

    INSERT INTO platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, p_value, p_actor_id, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING * INTO v_setting;

    INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip)
    VALUES (p_actor_id, 'setting.update', 'setting', p_key, jsonb_build_object('key', p_key, 'old', v_old, 'new', p_value), p_ip);

    RETURN v_setting;
END;
$$;

REVOKE ALL ON FUNCTION set_platform_setting(text, integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_platform_setting(text, integer, uuid, text) TO service_role;

COMMIT;
