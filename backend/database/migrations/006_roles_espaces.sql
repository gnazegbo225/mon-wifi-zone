-- =============================================================================
-- Migration 006 — rôles, statut des comptes, pays et sécurité de connexion
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 005.
--
--   1. countries : pays où la plateforme est ouverte (Côte d'Ivoire seulement pour l'instant).
--   2. users.role : super_admin, developer, vendor (promoteur), employee (employé d'un promoteur).
--      Les anciens comptes « admin » et « vendeur » deviennent « vendor » : ils gardent leurs zones.
--   3. users.account_status remplace is_active :
--        pending_review (inscrit, en attente de vérification), approved, rejected, suspended.
--   4. users.employer_id : le promoteur d'un employé.
--   5. users.country, phone, dates de connexion, blocage après échecs, double authentification.
--   6. wifi_zones.country doit être un pays connu, et le même que celui du promoteur.
--
-- Tout est dans une transaction : si une étape échoue, rien n'est appliqué.
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Pays
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
    code        char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
    name        text    NOT NULL,
    currency    char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    -- false : pays connu mais fermé aux inscriptions et aux nouvelles zones.
    is_enabled  boolean NOT NULL DEFAULT false
);

INSERT INTO countries (code, name, currency, is_enabled)
VALUES ('CI', 'Côte d’Ivoire', 'XOF', true)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE countries IS
    'Pays de la plateforme. Seuls les pays is_enabled acceptent de nouveaux promoteurs. Ajouter un pays = une ligne ici + ses moyens de paiement dans backend/src/config/countries.js.';

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Rôles
-- -----------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'vendor' WHERE role IN ('admin', 'vendeur');
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'vendor';
ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'developer', 'vendor', 'employee'));

-- -----------------------------------------------------------------------------
-- 3. Statut du compte (remplace is_active)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text;

DO $$
BEGIN
    -- Comptes existants : actifs → approuvés, désactivés → suspendus.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        UPDATE users
           SET account_status = CASE WHEN is_active THEN 'approved' ELSE 'suspended' END
         WHERE account_status IS NULL;
        ALTER TABLE users DROP COLUMN is_active;
    END IF;
END;
$$;

UPDATE users SET account_status = 'approved' WHERE account_status IS NULL;
ALTER TABLE users ALTER COLUMN account_status SET DEFAULT 'pending_review';
ALTER TABLE users ALTER COLUMN account_status SET NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users
    ADD CONSTRAINT users_account_status_check CHECK (
        account_status IN ('pending_review', 'approved', 'rejected', 'suspended')
        -- La vérification ne concerne que les promoteurs ; les autres sont approuvés ou suspendus.
        AND (role = 'vendor' OR account_status IN ('approved', 'suspended'))
    );

-- -----------------------------------------------------------------------------
-- 4. Employés
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS employer_id uuid REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employer_check;
ALTER TABLE users
    ADD CONSTRAINT users_employer_check CHECK ((role = 'employee') = (employer_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS users_employer_id_idx ON users (employer_id) WHERE employer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Pays, téléphone, connexion et sécurité
-- -----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS country        char(2) REFERENCES countries (code),
    ADD COLUMN IF NOT EXISTS phone          text,
    ADD COLUMN IF NOT EXISTS last_login_at  timestamptz,
    ADD COLUMN IF NOT EXISTS last_seen_at   timestamptz,
    ADD COLUMN IF NOT EXISTS failed_logins  integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until   timestamptz,
    -- Double authentification (super admin) : secret chiffré par le backend, jamais en clair.
    ADD COLUMN IF NOT EXISTS mfa_secret     text,
    -- Dernier pas de 30 s accepté : un même code ne sert qu'une fois.
    ADD COLUMN IF NOT EXISTS mfa_last_step  bigint;

-- Les promoteurs existants sont en Côte d'Ivoire.
UPDATE users SET country = 'CI' WHERE role = 'vendor' AND country IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_vendor_country_check;
ALTER TABLE users
    ADD CONSTRAINT users_vendor_country_check CHECK (role <> 'vendor' OR country IS NOT NULL);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_check;
ALTER TABLE users
    ADD CONSTRAINT users_phone_check CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$');

-- Le super admin se connecte toujours avec un second facteur.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_super_admin_mfa_check;
ALTER TABLE users
    ADD CONSTRAINT users_super_admin_mfa_check CHECK (role <> 'super_admin' OR mfa_secret IS NOT NULL);

COMMENT ON TABLE users IS
    'Comptes : super_admin (plateforme), developer (accès technique), vendor (promoteur, possède des zones), employee (employé d''un promoteur, employer_id). Statut : pending_review, approved, rejected, suspended.';

-- -----------------------------------------------------------------------------
-- 6. Pays des zones
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wifi_zones_country_fkey') THEN
        ALTER TABLE wifi_zones
            ADD CONSTRAINT wifi_zones_country_fkey FOREIGN KEY (country) REFERENCES countries (code);
    END IF;
END;
$$;

-- Une zone est dans le pays de son promoteur.
CREATE OR REPLACE FUNCTION check_zone_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_country char(2);
BEGIN
    SELECT country INTO v_country FROM users WHERE id = NEW.owner_id;
    IF v_country IS NOT NULL AND v_country <> NEW.country THEN
        RAISE EXCEPTION 'La zone doit être dans le pays de son promoteur (%)', v_country
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wifi_zones_check_country ON wifi_zones;
CREATE TRIGGER wifi_zones_check_country
    BEFORE INSERT OR UPDATE OF country, owner_id ON wifi_zones
    FOR EACH ROW EXECUTE FUNCTION check_zone_country();

COMMIT;
