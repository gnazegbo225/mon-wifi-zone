-- =============================================================================
-- Migration 013 — mot de passe oublié et confirmation de l'adresse email
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 012.
--
--   1. users.email_verified_at : date de confirmation de l'adresse (vide = pas encore confirmée).
--      Non bloquante : seul le retrait d'argent exige une adresse confirmée.
--   2. users.password_changed_at : un mot de passe changé ferme les sessions ouvertes avant.
--   3. account_tokens : liens envoyés par email (nouveau mot de passe, confirmation d'adresse).
--      Seule l'empreinte SHA-256 du lien est gardée ; chaque lien sert une fois et expire.
--
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at   timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS account_tokens (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     text        NOT NULL CHECK (purpose IN ('password_reset', 'email_verify')),
    -- Empreinte SHA-256 (hexadécimal) du lien : le lien lui-même n'est jamais stocké.
    token_hash  text        NOT NULL UNIQUE,
    -- Adresse à confirmer (email_verify) : le lien ne vaut plus si l'adresse a changé depuis.
    email       text,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_tokens_user_idx ON account_tokens (user_id, purpose, created_at DESC);

COMMENT ON TABLE account_tokens IS
    'Liens à usage unique envoyés par email (mot de passe oublié, confirmation d''adresse). Seule leur empreinte est stockée.';

COMMIT;
