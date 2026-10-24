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
--
-- Ce fichier décrit l'état final de la base. Il sert à créer une base neuve.
-- Une base existante se met à jour avec les fichiers de migrations/ (002, 003).
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
    -- false : zone désactivée, ses forfaits ne sont plus proposés aux clients.
    -- On désactive au lieu de supprimer.
    is_active   boolean     NOT NULL DEFAULT true,
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
    is_active       boolean NOT NULL DEFAULT true,
    -- Sert de cible aux clés (pricing_id, wifi_zone_id) de tickets et payments :
    -- un ticket ou un paiement ne peut pas pointer vers le forfait d'une autre zone.
    CONSTRAINT pricings_id_wifi_zone_id_key UNIQUE (id, wifi_zone_id),
    -- Un profil MikroTik désigne un seul forfait par zone (il relie chaque ticket à son forfait).
    CONSTRAINT pricings_zone_profile_key UNIQUE (wifi_zone_id, ticket_profile)
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
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
    -- Le forfait payé appartient à la zone du paiement.
    CONSTRAINT payments_pricing_same_zone_fkey
        FOREIGN KEY (pricing_id, wifi_zone_id)
        REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT
);

CREATE INDEX payments_wifi_zone_id_idx ON payments (wifi_zone_id, created_at DESC);
CREATE INDEX payments_owner_id_idx     ON payments (owner_id, created_at DESC);
CREATE INDEX payments_pricing_id_idx   ON payments (pricing_id);

COMMENT ON TABLE payments IS
    'Paiements des clients (en attente, réussis, échoués ou annulés). Le nom et la durée du forfait sont copiés au moment de la vente pour garder un historique fiable.';


-- -----------------------------------------------------------------------------
-- tickets : les identifiants WiFi (username / password) importés depuis MikroTik.
-- Cycle de vie : free (libre) → reserved (réservé pendant le paiement) → sold (vendu).
-- Un ticket reserved dont reserved_until est dépassé compte comme libre.
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
    CONSTRAINT tickets_zone_username_key UNIQUE (wifi_zone_id, username),
    -- Le forfait du ticket appartient à la zone du ticket.
    CONSTRAINT tickets_pricing_same_zone_fkey
        FOREIGN KEY (pricing_id, wifi_zone_id)
        REFERENCES pricings (id, wifi_zone_id) ON DELETE RESTRICT,
    -- Statut cohérent avec les autres colonnes :
    --   free     : pas de paiement, pas de réservation, pas de date de vente
    --   reserved : une date de fin de réservation (le paiement n'est relié qu'à la vente)
    --   sold     : relié à un paiement, avec une date de vente
    -- Effet voulu : on ne peut pas supprimer un paiement relié à un ticket vendu
    -- (le ON DELETE SET NULL violerait cette règle).
    CONSTRAINT tickets_status_coherence_check CHECK (
        (status = 'free'
            AND payment_id IS NULL AND reserved_until IS NULL AND sold_at IS NULL)
     OR (status = 'reserved'
            AND reserved_until IS NOT NULL AND sold_at IS NULL)
     OR (status = 'sold'
            AND payment_id IS NOT NULL AND reserved_until IS NULL AND sold_at IS NOT NULL)
    )
);

-- Index partiel : trouver rapidement un ticket libre pour une zone et un forfait
CREATE INDEX tickets_free_by_zone_pricing_idx
    ON tickets (wifi_zone_id, pricing_id)
    WHERE status = 'free';

-- Un paiement ne peut être relié qu'à un seul ticket (sert aussi aux recherches).
CREATE UNIQUE INDEX tickets_payment_id_key
    ON tickets (payment_id)
    WHERE payment_id IS NOT NULL;

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
