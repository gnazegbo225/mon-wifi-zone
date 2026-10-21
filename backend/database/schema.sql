-- =============================================================================
-- Schéma de la base de données — plateforme de vente de tickets WiFi
-- Cible : PostgreSQL (Supabase)
--
-- Un seul gérant pour l'instant, mais chaque zone WiFi a un propriétaire
-- (owner_id) pour pouvoir accueillir plusieurs gérants plus tard.
--
-- La Row Level Security est activée sur toutes les tables SANS aucune
-- politique : seul le backend (clé service_role) peut lire et écrire.
-- Les clés anon / authenticated n'ont accès à rien.
-- =============================================================================

BEGIN;

-- gen_random_uuid() est natif depuis PostgreSQL 13, pgcrypto reste une sécurité.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Fonction utilitaire : met à jour updated_at automatiquement à chaque UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- users : les personnes qui se connectent au tableau de bord.
-- Un « admin » gère tout, un « vendeur » vend des tickets.
-- Le mot de passe n'est jamais stocké en clair, seulement son hash.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email          text        NOT NULL UNIQUE,
    password_hash  text        NOT NULL,
    full_name      text        NOT NULL,
    role           text        NOT NULL DEFAULT 'vendeur'
                               CHECK (role IN ('admin', 'vendeur')),
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS
    'Comptes qui se connectent au tableau de bord : admin (gère tout) ou vendeur (vend des tickets).';


-- -----------------------------------------------------------------------------
-- wifi_zones : un point d'accès WiFi (un lieu) qui vend des tickets.
-- Chaque zone appartient à un utilisateur (owner_id).
-- -----------------------------------------------------------------------------
CREATE TABLE wifi_zones (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    country     char(2)     NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    city        text        NOT NULL,
    owner_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wifi_zones_owner_id_idx ON wifi_zones (owner_id);

COMMENT ON TABLE wifi_zones IS
    'Zones WiFi (lieux) qui vendent des tickets. Chaque zone appartient à un gérant (owner_id). Pays en code ISO à 2 lettres (ex : CI).';


-- -----------------------------------------------------------------------------
-- pricings : les forfaits proposés dans une zone (ex : « 1 heure — 200 FCFA »).
-- ticket_profile = nom du profil MikroTik correspondant au forfait.
-- -----------------------------------------------------------------------------
CREATE TABLE pricings (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    wifi_zone_id    uuid    NOT NULL REFERENCES wifi_zones (id) ON DELETE RESTRICT,
    name            text    NOT NULL,
    amount          integer NOT NULL CHECK (amount > 0),
    duration_label  text    NOT NULL,
    speed_label     text,
    ticket_profile  text    NOT NULL,
    is_active       boolean NOT NULL DEFAULT true
);

CREATE INDEX pricings_wifi_zone_id_idx ON pricings (wifi_zone_id);

COMMENT ON TABLE pricings IS
    'Forfaits vendus dans une zone : prix en FCFA (entier, supérieur à 0), durée, débit et profil MikroTik associé.';


-- -----------------------------------------------------------------------------
-- payments : chaque tentative de paiement d'un client.
-- Le nom et la durée du forfait sont copiés au moment de la vente pour que
-- l'historique reste juste même si le forfait est modifié plus tard.
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_payment_id     text        NOT NULL UNIQUE,
    wifi_zone_id            uuid        NOT NULL REFERENCES wifi_zones (id) ON DELETE RESTRICT,
    owner_id                uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    pricing_id              uuid        NOT NULL REFERENCES pricings (id) ON DELETE RESTRICT,
    amount                  integer     NOT NULL CHECK (amount > 0),
    pricing_name            text        NOT NULL,
    pricing_duration_label  text        NOT NULL,
    phone                   text        NOT NULL,
    payment_method          text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    transaction_id          text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    completed_at            timestamptz,
    -- Un paiement « completed » doit avoir une date de fin
    CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX payments_wifi_zone_id_idx ON payments (wifi_zone_id, created_at DESC);
CREATE INDEX payments_owner_id_idx     ON payments (owner_id, created_at DESC);
CREATE INDEX payments_pricing_id_idx   ON payments (pricing_id);

COMMENT ON TABLE payments IS
    'Paiements des clients (en attente, réussis, échoués ou annulés). Le nom et la durée du forfait sont copiés au moment de la vente pour garder un historique fiable.';


-- -----------------------------------------------------------------------------
-- tickets : les identifiants WiFi (username / password) importés depuis MikroTik.
-- Cycle de vie : free (libre) → reserved (réservé pendant le paiement) → sold (vendu).
-- Un username ne peut apparaître qu'une fois par zone.
-- -----------------------------------------------------------------------------
CREATE TABLE tickets (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    wifi_zone_id    uuid        NOT NULL REFERENCES wifi_zones (id) ON DELETE RESTRICT,
    pricing_id      uuid        NOT NULL REFERENCES pricings (id) ON DELETE RESTRICT,
    username        text        NOT NULL,
    password        text        NOT NULL,
    profile         text        NOT NULL,
    status          text        NOT NULL DEFAULT 'free'
                                CHECK (status IN ('free', 'reserved', 'sold')),
    reserved_until  timestamptz,
    payment_id      uuid        REFERENCES payments (id) ON DELETE SET NULL,
    sold_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tickets_zone_username_key UNIQUE (wifi_zone_id, username)
);

-- Index partiel : trouver rapidement un ticket libre pour une zone et un forfait
CREATE INDEX tickets_free_by_zone_pricing_idx
    ON tickets (wifi_zone_id, pricing_id)
    WHERE status = 'free';

CREATE INDEX tickets_payment_id_idx ON tickets (payment_id);

COMMENT ON TABLE tickets IS
    'Tickets WiFi (identifiant + mot de passe MikroTik). Statut : free (libre), reserved (bloqué pendant un paiement), sold (vendu). Un username est unique dans une même zone.';


-- -----------------------------------------------------------------------------
-- payment_idempotency : évite de créer deux fois le même paiement si le
-- client clique deux fois ou si la requête est renvoyée.
-- -----------------------------------------------------------------------------
CREATE TABLE payment_idempotency (
    idempotency_key  text PRIMARY KEY,
    payment_id       uuid NOT NULL REFERENCES payments (id) ON DELETE CASCADE
);

CREATE INDEX payment_idempotency_payment_id_idx ON payment_idempotency (payment_id);

COMMENT ON TABLE payment_idempotency IS
    'Clés anti-doublon : une même clé renvoie toujours le même paiement, même si la requête est envoyée plusieurs fois.';


-- -----------------------------------------------------------------------------
-- Row Level Security : activée partout, aucune politique.
-- Résultat : accès refusé à anon / authenticated, seul service_role passe.
-- -----------------------------------------------------------------------------
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency ENABLE ROW LEVEL SECURITY;

COMMIT;
