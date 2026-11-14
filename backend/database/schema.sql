-- =============================================================================
-- Schéma de la base de données — plateforme de vente de tickets WiFi
-- Cible : PostgreSQL (Supabase)
--
-- Plateforme multi-promoteurs : chaque zone WiFi appartient à un promoteur
-- (owner_id). Le super admin supervise la plateforme depuis un espace séparé.
--
-- La Row Level Security est activée sur toutes les tables SANS aucune
-- politique : seul le backend (clé service_role) peut lire et écrire.
-- Les clés anon / authenticated n'ont accès à rien.
--
-- Ce fichier décrit l'état final de la base. Il sert à créer une base neuve.
-- Une base existante se met à jour avec les fichiers de migrations/ (002 à 010).
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
-- countries : pays de la plateforme. Seuls les pays is_enabled acceptent de
-- nouveaux promoteurs. Ajouter un pays = une ligne ici + ses moyens de paiement
-- dans backend/src/config/countries.js.
-- -----------------------------------------------------------------------------
CREATE TABLE countries (
    code        char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
    name        text    NOT NULL,
    currency    char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    is_enabled  boolean NOT NULL DEFAULT false
);

INSERT INTO countries (code, name, currency, is_enabled) VALUES ('CI', 'Côte d’Ivoire', 'XOF', true);


-- -----------------------------------------------------------------------------
-- users : les personnes qui se connectent.
--   super_admin : supervise la plateforme (espace /admin séparé, double authentification).
--   developer   : accès technique.
--   vendor      : promoteur, possède des zones WiFi.
--   employee    : employé d'un promoteur (employer_id), agit dans ses zones.
-- Statut : pending_review (inscrit, à vérifier), approved, rejected, suspended.
-- Le mot de passe n'est jamais stocké en clair, seulement son hash.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text        NOT NULL UNIQUE,
    password_hash   text        NOT NULL,
    full_name       text        NOT NULL,
    role            text        NOT NULL DEFAULT 'vendor'
                                CHECK (role IN ('super_admin', 'developer', 'vendor', 'employee')),
    account_status  text        NOT NULL DEFAULT 'pending_review',
    employer_id     uuid        REFERENCES users (id) ON DELETE RESTRICT,
    country         char(2)     REFERENCES countries (code),
    phone           text        CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$'),
    last_login_at   timestamptz,
    last_seen_at    timestamptz,
    failed_logins   integer     NOT NULL DEFAULT 0,
    locked_until    timestamptz,
    -- Double authentification : secret chiffré par le backend, jamais en clair.
    mfa_secret      text,
    -- Dernier pas de 30 s accepté : un même code ne sert qu'une fois.
    mfa_last_step   bigint,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_account_status_check CHECK (
        account_status IN ('pending_review', 'approved', 'rejected', 'suspended')
        AND (role = 'vendor' OR account_status IN ('approved', 'suspended'))
    ),
    CONSTRAINT users_employer_check CHECK ((role = 'employee') = (employer_id IS NOT NULL)),
    CONSTRAINT users_vendor_country_check CHECK (role <> 'vendor' OR country IS NOT NULL),
    CONSTRAINT users_super_admin_mfa_check CHECK (role <> 'super_admin' OR mfa_secret IS NOT NULL),
    CONSTRAINT users_developer_mfa_check CHECK (role <> 'developer' OR mfa_secret IS NOT NULL)
);

CREATE INDEX users_employer_id_idx ON users (employer_id) WHERE employer_id IS NOT NULL;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS
    'Comptes : super_admin (plateforme), developer (accès technique), vendor (promoteur, possède des zones), employee (employé d''un promoteur, employer_id). Statut : pending_review, approved, rejected, suspended.';


-- -----------------------------------------------------------------------------
-- wifi_zones : un point d'accès WiFi (un lieu) qui vend des tickets.
-- Chaque zone appartient à un utilisateur (owner_id).
-- -----------------------------------------------------------------------------
CREATE TABLE wifi_zones (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    country     char(2)     NOT NULL REFERENCES countries (code),
    city        text        NOT NULL,
    owner_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    -- false : zone désactivée, ses forfaits ne sont plus proposés aux clients.
    -- On désactive au lieu de supprimer.
    is_active   boolean     NOT NULL DEFAULT true,
    -- Adresse IP (v4 ou v6) ou nom DNS du routeur MikroTik. Jamais renvoyée aux clients.
    -- NULL accepté pour les zones créées avant la migration 004 ; le backend l'exige.
    router_host    text     CHECK (router_host IS NULL
                                   OR (length(router_host) BETWEEN 2 AND 253 AND router_host !~ '\s')),
    -- Téléphone du gérant : chiffres seulement, avec + en option. Exigé par le backend.
    manager_phone  text     CHECK (manager_phone IS NULL OR manager_phone ~ '^\+?[0-9]{8,15}$'),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wifi_zones_owner_id_idx ON wifi_zones (owner_id);

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

CREATE TRIGGER wifi_zones_check_country
    BEFORE INSERT OR UPDATE OF country, owner_id ON wifi_zones
    FOR EACH ROW EXECUTE FUNCTION check_zone_country();

COMMENT ON TABLE wifi_zones IS
    'Zones WiFi (lieux) qui vendent des tickets. Chaque zone appartient à un promoteur (owner_id), dans son pays.';


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
    -- Commission de la plateforme sur cette vente : taux du jour (8 % = 800) et montant arrondi au franc.
    commission_rate_bps     integer     CHECK (commission_rate_bps BETWEEN 0 AND 10000),
    commission_amount       integer     CHECK (commission_amount >= 0),
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



-- -----------------------------------------------------------------------------
-- Registre financier (migration 007) : commission, solde des promoteurs, retraits.
-- Le solde n'est jamais stocké : c'est la somme des mouvements de ledger_entries.
-- -----------------------------------------------------------------------------
CREATE TABLE platform_settings (
    key         text        PRIMARY KEY,
    value       integer     NOT NULL CHECK (value >= 0),
    updated_by  uuid        REFERENCES users (id),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
    ('commission_rate_bps', 800),   -- 8 % en points de base (1 % = 100)
    ('min_withdrawal', 1000),       -- FCFA
    ('hold_hours', 24)              -- heures avant qu'une vente soit retirable
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE platform_settings IS
    'Réglages de la plateforme : commission_rate_bps (8 % = 800), min_withdrawal (FCFA), hold_hours (attente avant retrait).';

CREATE OR REPLACE FUNCTION platform_setting(p_key text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_value integer;
BEGIN
    SELECT value INTO v_value FROM platform_settings WHERE key = p_key;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Réglage introuvable : %', p_key;
    END IF;
    RETURN v_value;
END;
$$;

CREATE TABLE withdrawals (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount              integer     NOT NULL CHECK (amount > 0),
    method              text        NOT NULL CHECK (method IN ('bank_transfer', 'mtn_ci', 'wave_ci', 'orange_ci')),
    -- Coordonnées copiées au moment de la demande : l'historique reste juste si le promoteur les change.
    destination_phone   text        CHECK (destination_phone IS NULL OR destination_phone ~ '^\+?[0-9]{8,15}$'),
    bank_name           text,
    account_holder      text,
    account_number      text,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
    requested_at        timestamptz NOT NULL DEFAULT now(),
    reviewed_by         uuid        REFERENCES users (id),
    reviewed_at         timestamptz,
    paid_by             uuid        REFERENCES users (id),
    paid_at             timestamptz,
    transfer_reference  text,
    admin_note          text,
    rejection_reason    text,
    cancelled_at        timestamptz,
    CONSTRAINT withdrawals_destination_check CHECK (
        (method = 'bank_transfer' AND bank_name IS NOT NULL AND account_holder IS NOT NULL AND account_number IS NOT NULL)
     OR (method <> 'bank_transfer' AND destination_phone IS NOT NULL)
    ),
    CONSTRAINT withdrawals_paid_check CHECK (
        status <> 'paid' OR (paid_at IS NOT NULL AND paid_by IS NOT NULL AND length(trim(transfer_reference)) > 0)
    ),
    CONSTRAINT withdrawals_rejected_check CHECK (
        status <> 'rejected' OR length(trim(rejection_reason)) > 0
    )
);

CREATE INDEX withdrawals_vendor_idx ON withdrawals (vendor_id, requested_at DESC);
CREATE INDEX withdrawals_status_idx ON withdrawals (status, requested_at);

COMMENT ON TABLE withdrawals IS
    'Demandes de retrait des promoteurs : pending → approved → paid, ou rejected / cancelled. Le super admin fait le transfert à la main, puis saisit sa référence.';

CREATE TABLE withdrawal_events (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id  uuid        NOT NULL REFERENCES withdrawals (id) ON DELETE RESTRICT,
    from_status    text,
    to_status      text        NOT NULL,
    actor_id       uuid        NOT NULL REFERENCES users (id),
    note           text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX withdrawal_events_withdrawal_idx ON withdrawal_events (withdrawal_id, created_at);

COMMENT ON TABLE withdrawal_events IS 'Historique de chaque retrait : qui a changé son statut, quand, et pourquoi.';

CREATE TABLE ledger_entries (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id      uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    type           text        NOT NULL
                               CHECK (type IN ('sale', 'commission', 'withdrawal_hold', 'withdrawal_release', 'adjustment')),
    amount         integer     NOT NULL,
    -- Date à partir de laquelle le mouvement compte dans le solde retirable.
    available_at   timestamptz NOT NULL DEFAULT now(),
    payment_id     uuid        REFERENCES payments (id) ON DELETE RESTRICT,
    withdrawal_id  uuid        REFERENCES withdrawals (id) ON DELETE RESTRICT,
    created_by     uuid        REFERENCES users (id),
    note           text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ledger_entries_sign_check CHECK (
        (type = 'sale'               AND amount > 0  AND payment_id IS NOT NULL)
     OR (type = 'commission'         AND amount <= 0 AND payment_id IS NOT NULL)
     OR (type = 'withdrawal_hold'    AND amount < 0  AND withdrawal_id IS NOT NULL)
     OR (type = 'withdrawal_release' AND amount > 0  AND withdrawal_id IS NOT NULL)
     OR (type = 'adjustment'         AND amount <> 0 AND created_by IS NOT NULL AND length(trim(note)) > 0)
    )
);

-- Une vente n'est créditée qu'une fois, sa commission prélevée qu'une fois ; un retrait n'est bloqué
-- et rendu qu'une fois. Ce sont ces index qui empêchent tout double crédit.
CREATE UNIQUE INDEX ledger_entries_payment_type_key
    ON ledger_entries (payment_id, type) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_entries_withdrawal_type_key
    ON ledger_entries (withdrawal_id, type) WHERE withdrawal_id IS NOT NULL;
CREATE INDEX ledger_entries_vendor_idx ON ledger_entries (vendor_id, available_at);

COMMENT ON TABLE ledger_entries IS
    'Registre des mouvements d''argent de chaque promoteur, en ajout seulement. Solde = somme des montants. Une correction passe par un mouvement adjustment, jamais par une modification.';

-- Le registre ne se modifie jamais et ne se supprime jamais.
CREATE OR REPLACE FUNCTION ledger_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Le registre ne se modifie pas : ajoute un mouvement de correction (adjustment).';
END;
$$;

CREATE TRIGGER ledger_entries_no_change
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();


-- Inscrit une vente réussie au registre du promoteur : + montant, − commission, disponibles après l'attente.
-- La commission est arrondie au franc le plus proche. Sans effet si la vente est déjà inscrite.
CREATE OR REPLACE FUNCTION credit_sale(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_payment    payments%ROWTYPE;
    v_rate       integer;
    v_commission integer;
    v_available  timestamptz;
BEGIN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.status <> 'completed' THEN
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM ledger_entries WHERE payment_id = p_payment_id AND type = 'sale') THEN
        RETURN;
    END IF;

    v_rate := COALESCE(v_payment.commission_rate_bps, platform_setting('commission_rate_bps'));
    v_commission := (v_payment.amount * v_rate + 5000) / 10000;
    v_available := COALESCE(v_payment.completed_at, now()) + make_interval(hours => platform_setting('hold_hours'));

    UPDATE payments
       SET commission_rate_bps = v_rate,
           commission_amount = v_commission
     WHERE id = p_payment_id;

    INSERT INTO ledger_entries (vendor_id, type, amount, available_at, payment_id)
    VALUES (v_payment.owner_id, 'sale', v_payment.amount, v_available, p_payment_id);

    INSERT INTO ledger_entries (vendor_id, type, amount, available_at, payment_id)
    VALUES (v_payment.owner_id, 'commission', -v_commission, v_available, p_payment_id);
END;
$$;

-- complete_payment (migration 005) + inscription de la vente au registre, dans la même transaction.
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
        PERFORM credit_sale(p_payment_id); -- sans effet si déjà inscrite
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

    -- Le promoteur est crédité même sans ticket (stock épuisé) : le client a payé, le gérant le servira.
    PERFORM credit_sale(p_payment_id);

    RETURN v_ticket_id;
END;
$$;

-- Les montants d'un promoteur. Rien n'est stocké : tout vient du registre et des retraits.
--   pending_amount     ventes nettes encore dans les 24 h d'attente
--   available_amount   retirable maintenant (les retraits en cours sont déjà déduits)
--   in_withdrawal      retraits demandés ou approuvés, pas encore payés
--   withdrawn          retraits payés
--   gross_sales        total des ventes ; commissions : total prélevé
CREATE OR REPLACE FUNCTION vendor_balance(p_vendor_id uuid)
RETURNS TABLE (
    pending_amount   bigint,
    available_amount bigint,
    in_withdrawal    bigint,
    withdrawn        bigint,
    gross_sales      bigint,
    commissions      bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        COALESCE(SUM(l.amount) FILTER (WHERE l.available_at >  now()), 0),
        COALESCE(SUM(l.amount) FILTER (WHERE l.available_at <= now()), 0),
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE vendor_id = p_vendor_id AND status IN ('pending', 'approved')),
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE vendor_id = p_vendor_id AND status = 'paid'),
        COALESCE(SUM(l.amount) FILTER (WHERE l.type = 'sale'), 0),
        COALESCE(-SUM(l.amount) FILTER (WHERE l.type = 'commission'), 0)
      FROM ledger_entries l
     WHERE l.vendor_id = p_vendor_id;
$$;

-- Demande de retrait. Le promoteur est verrouillé le temps du calcul : deux demandes simultanées
-- ne peuvent jamais dépasser le disponible. Erreurs (message) :
--   withdrawal:not_vendor · withdrawal:not_approved · withdrawal:below_minimum
--   withdrawal:insufficient_balance · withdrawal:invalid_method · withdrawal:invalid_destination
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_vendor_id        uuid,
    p_amount           integer,
    p_method           text,
    p_phone            text,
    p_bank_name        text,
    p_account_holder   text,
    p_account_number   text
)
RETURNS withdrawals
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user       users%ROWTYPE;
    v_available  bigint;
    v_minimum    integer := platform_setting('min_withdrawal');
    v_withdrawal withdrawals%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_vendor_id FOR UPDATE;
    IF NOT FOUND OR v_user.role <> 'vendor' THEN
        RAISE EXCEPTION 'withdrawal:not_vendor';
    END IF;
    IF v_user.account_status <> 'approved' THEN
        RAISE EXCEPTION 'withdrawal:not_approved';
    END IF;
    IF p_method IS NULL OR p_method NOT IN ('bank_transfer', 'mtn_ci', 'wave_ci', 'orange_ci') THEN
        RAISE EXCEPTION 'withdrawal:invalid_method';
    END IF;
    IF p_amount IS NULL OR p_amount < v_minimum THEN
        RAISE EXCEPTION 'withdrawal:below_minimum' USING DETAIL = v_minimum::text;
    END IF;

    SELECT available_amount INTO v_available FROM vendor_balance(p_vendor_id);
    IF p_amount > v_available THEN
        RAISE EXCEPTION 'withdrawal:insufficient_balance' USING DETAIL = v_available::text;
    END IF;

    BEGIN
        INSERT INTO withdrawals (vendor_id, amount, method, destination_phone, bank_name, account_holder, account_number)
        VALUES (
            p_vendor_id, p_amount, p_method,
            CASE WHEN p_method = 'bank_transfer' THEN NULL ELSE NULLIF(trim(p_phone), '') END,
            CASE WHEN p_method = 'bank_transfer' THEN NULLIF(trim(p_bank_name), '') END,
            CASE WHEN p_method = 'bank_transfer' THEN NULLIF(trim(p_account_holder), '') END,
            CASE WHEN p_method = 'bank_transfer' THEN NULLIF(trim(p_account_number), '') END
        )
        RETURNING * INTO v_withdrawal;
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'withdrawal:invalid_destination';
    END;

    INSERT INTO ledger_entries (vendor_id, type, amount, withdrawal_id)
    VALUES (p_vendor_id, 'withdrawal_hold', -p_amount, v_withdrawal.id);

    INSERT INTO withdrawal_events (withdrawal_id, from_status, to_status, actor_id)
    VALUES (v_withdrawal.id, NULL, 'pending', p_vendor_id);

    RETURN v_withdrawal;
END;
$$;

-- Fait avancer un retrait. Transitions permises :
--   pending  → approved (super admin) · rejected (super admin, motif) · cancelled (le promoteur)
--   approved → paid (super admin, référence du transfert) · rejected (super admin, motif)
-- Un retrait rejeté ou annulé rend son montant au solde disponible. « paid » est définitif.
-- Erreurs : withdrawal:not_found · withdrawal:forbidden · withdrawal:bad_transition
--           withdrawal:reference_required · withdrawal:reason_required
CREATE OR REPLACE FUNCTION set_withdrawal_status(
    p_withdrawal_id uuid,
    p_status        text,
    p_actor_id      uuid,
    p_reference     text,
    p_note          text
)
RETURNS withdrawals
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_w      withdrawals%ROWTYPE;
    v_actor  users%ROWTYPE;
    v_from   text;
BEGIN
    SELECT * INTO v_w FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'withdrawal:not_found';
    END IF;
    SELECT * INTO v_actor FROM users WHERE id = p_actor_id;
    IF NOT FOUND OR v_actor.account_status = 'suspended' THEN
        RAISE EXCEPTION 'withdrawal:forbidden';
    END IF;

    -- Qui peut faire quoi.
    IF p_status = 'cancelled' THEN
        IF v_actor.id <> v_w.vendor_id THEN
            RAISE EXCEPTION 'withdrawal:forbidden';
        END IF;
    ELSIF v_actor.role <> 'super_admin' THEN
        RAISE EXCEPTION 'withdrawal:forbidden';
    END IF;

    -- Transitions permises.
    IF NOT (
        (v_w.status = 'pending'  AND p_status IN ('approved', 'rejected', 'cancelled'))
     OR (v_w.status = 'approved' AND p_status IN ('paid', 'rejected'))
    ) THEN
        RAISE EXCEPTION 'withdrawal:bad_transition' USING DETAIL = v_w.status || ' → ' || p_status;
    END IF;

    IF p_status = 'paid' AND length(trim(COALESCE(p_reference, ''))) = 0 THEN
        RAISE EXCEPTION 'withdrawal:reference_required';
    END IF;
    IF p_status = 'rejected' AND length(trim(COALESCE(p_note, ''))) = 0 THEN
        RAISE EXCEPTION 'withdrawal:reason_required';
    END IF;

    v_from := v_w.status;

    UPDATE withdrawals
       SET status             = p_status,
           reviewed_by        = CASE WHEN p_status IN ('approved', 'rejected') THEN p_actor_id ELSE reviewed_by END,
           reviewed_at        = CASE WHEN p_status IN ('approved', 'rejected') THEN now() ELSE reviewed_at END,
           paid_by            = CASE WHEN p_status = 'paid' THEN p_actor_id ELSE paid_by END,
           paid_at            = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
           transfer_reference = CASE WHEN p_status = 'paid' THEN trim(p_reference) ELSE transfer_reference END,
           rejection_reason   = CASE WHEN p_status = 'rejected' THEN trim(p_note) ELSE rejection_reason END,
           admin_note         = CASE WHEN p_status IN ('approved', 'paid') AND p_note IS NOT NULL THEN p_note ELSE admin_note END,
           cancelled_at       = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
     WHERE id = p_withdrawal_id
    RETURNING * INTO v_w;

    -- Rejeté ou annulé : le montant bloqué revient au solde.
    IF p_status IN ('rejected', 'cancelled') THEN
        INSERT INTO ledger_entries (vendor_id, type, amount, withdrawal_id)
        VALUES (v_w.vendor_id, 'withdrawal_release', v_w.amount, v_w.id);
    END IF;

    INSERT INTO withdrawal_events (withdrawal_id, from_status, to_status, actor_id, note)
    VALUES (v_w.id, v_from, p_status, p_actor_id, COALESCE(NULLIF(trim(p_reference), ''), NULLIF(trim(p_note), '')));

    RETURN v_w;
END;
$$;

-- Correction manuelle du solde d'un promoteur (super admin seulement, motif obligatoire).
-- Exemple : remboursement d'un client, erreur de saisie. Le registre garde la trace.
CREATE OR REPLACE FUNCTION add_adjustment(p_vendor_id uuid, p_amount integer, p_actor_id uuid, p_note text)
RETURNS ledger_entries
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_entry ledger_entries%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_actor_id AND role = 'super_admin' AND account_status = 'approved') THEN
        RAISE EXCEPTION 'adjustment:forbidden';
    END IF;
    -- Même verrou que request_withdrawal : une correction et une demande de retrait ne se croisent pas.
    PERFORM 1 FROM users WHERE id = p_vendor_id AND role = 'vendor' FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'adjustment:not_vendor';
    END IF;
    IF p_amount IS NULL OR p_amount = 0 THEN
        RAISE EXCEPTION 'adjustment:zero_amount';
    END IF;
    IF length(trim(COALESCE(p_note, ''))) = 0 THEN
        RAISE EXCEPTION 'adjustment:reason_required';
    END IF;

    INSERT INTO ledger_entries (vendor_id, type, amount, created_by, note)
    VALUES (p_vendor_id, 'adjustment', p_amount, p_actor_id, trim(p_note))
    RETURNING * INTO v_entry;
    RETURN v_entry;
END;
$$;


-- -----------------------------------------------------------------------------
-- Dossier de vérification des promoteurs (migration 008).
-- -----------------------------------------------------------------------------
CREATE TABLE vendor_profiles (
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

CREATE TRIGGER vendor_profiles_set_updated_at
    BEFORE UPDATE ON vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX vendor_profiles_submitted_idx ON vendor_profiles (submitted_at) WHERE submitted_at IS NOT NULL;

COMMENT ON TABLE vendor_profiles IS
    'Dossier de vérification d''un promoteur : identité (CNI), photos dans le stockage privé kyc-documents, compte de retrait par défaut.';

CREATE TABLE verification_events (
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

CREATE INDEX verification_events_vendor_idx ON verification_events (vendor_id, created_at);

COMMENT ON TABLE verification_events IS 'Historique de la vérification de chaque promoteur : envois du dossier, décisions, suspensions.';


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
-- Statistiques de supervision du super admin (migration 009), en lecture seule.
-- -----------------------------------------------------------------------------
-- Chiffres de la plateforme. p_from NULL = depuis la première vente.
-- Les ventes sont regroupées par jour (période de 92 jours au plus) ou par mois.
--   sales        ventes réussies de la période : nombre, montant encaissé, commissions gagnées
--   owed         argent dû aux promoteurs aujourd'hui : disponible, en attente (24 h), en cours de retrait
--   withdrawals  retraits à approuver, à payer, et payés pendant la période
--   vendors      promoteurs : total, par statut, en ligne (vus il y a moins de 5 min), nouveaux, actifs
--   series       ventes par jour ou par mois, pour le graphique
CREATE OR REPLACE FUNCTION admin_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_from   timestamptz := COALESCE(p_from, (SELECT min(completed_at) FROM payments WHERE status = 'completed'), now());
    v_to     timestamptz := COALESCE(p_to, now());
    v_bucket text := CASE WHEN COALESCE(p_to, now()) - COALESCE(p_from, '-infinity') > interval '92 days' THEN 'month' ELSE 'day' END;
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'bucket', v_bucket,
        'sales', (
            SELECT jsonb_build_object(
                'count', count(*),
                'gross', COALESCE(sum(amount), 0),
                'commission', COALESCE(sum(commission_amount), 0))
              FROM payments
             WHERE status = 'completed' AND completed_at >= v_from AND completed_at < v_to
        ),
        'owed', (
            SELECT jsonb_build_object(
                'available', COALESCE(sum(amount) FILTER (WHERE available_at <= now()), 0),
                'pending', COALESCE(sum(amount) FILTER (WHERE available_at > now()), 0))
              FROM ledger_entries
        ),
        'withdrawals', (
            SELECT jsonb_build_object(
                'pending_count', count(*) FILTER (WHERE status = 'pending'),
                'pending_amount', COALESCE(sum(amount) FILTER (WHERE status = 'pending'), 0),
                'approved_count', count(*) FILTER (WHERE status = 'approved'),
                'approved_amount', COALESCE(sum(amount) FILTER (WHERE status = 'approved'), 0),
                'paid_count', count(*) FILTER (WHERE status = 'paid' AND paid_at >= v_from AND paid_at < v_to),
                'paid_amount', COALESCE(sum(amount) FILTER (WHERE status = 'paid' AND paid_at >= v_from AND paid_at < v_to), 0))
              FROM withdrawals
        ),
        'vendors', (
            SELECT jsonb_build_object(
                'total', count(*),
                'approved', count(*) FILTER (WHERE account_status = 'approved'),
                'pending_review', count(*) FILTER (WHERE account_status = 'pending_review'),
                'rejected', count(*) FILTER (WHERE account_status = 'rejected'),
                'suspended', count(*) FILTER (WHERE account_status = 'suspended'),
                'online', count(*) FILTER (WHERE last_seen_at > now() - interval '5 minutes'),
                'new', count(*) FILTER (WHERE created_at >= v_from AND created_at < v_to),
                'active', (SELECT count(DISTINCT owner_id) FROM payments
                            WHERE status = 'completed' AND completed_at >= v_from AND completed_at < v_to))
              FROM users
             WHERE role = 'vendor'
        ),
        'dossiers_to_review', (
            SELECT count(*)
              FROM users u
              JOIN vendor_profiles p ON p.user_id = u.id
             WHERE u.role = 'vendor' AND u.account_status = 'pending_review' AND p.submitted_at IS NOT NULL
        ),
        'zones', (
            SELECT jsonb_build_object('total', count(*), 'active', count(*) FILTER (WHERE is_active)) FROM wifi_zones
        ),
        'series', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'period', to_char(b.start, CASE WHEN v_bucket = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END),
                       'count', COALESCE(s.n, 0),
                       'gross', COALESCE(s.gross, 0),
                       'commission', COALESCE(s.commission, 0)) ORDER BY b.start), '[]'::jsonb)
              FROM generate_series(date_trunc(v_bucket, v_from), v_to - interval '1 microsecond', ('1 ' || v_bucket)::interval) AS b(start)
              LEFT JOIN LATERAL (
                  SELECT count(*) AS n, sum(amount) AS gross, sum(commission_amount) AS commission
                    FROM payments
                   WHERE status = 'completed'
                     AND completed_at >= GREATEST(b.start, v_from)
                     AND completed_at < LEAST(b.start + ('1 ' || v_bucket)::interval, v_to)
              ) s ON true
        )
    ) INTO v_result;
    RETURN v_result;
END;
$$;

-- Zones, ventes et soldes de chaque promoteur (p_vendor_id NULL = tous).
CREATE OR REPLACE FUNCTION admin_vendor_stats(p_vendor_id uuid)
RETURNS TABLE (
    vendor_id      uuid,
    zones_total    bigint,
    zones_active   bigint,
    sales_count    bigint,
    gross          bigint,
    commissions    bigint,
    last_sale_at   timestamptz,
    available      bigint,
    pending        bigint,
    in_withdrawal  bigint,
    withdrawn      bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT u.id,
           COALESCE(z.total, 0), COALESCE(z.active, 0),
           COALESCE(p.n, 0), COALESCE(p.gross, 0), COALESCE(p.commission, 0), p.last_sale,
           COALESCE(l.available, 0), COALESCE(l.pending, 0),
           COALESCE(w.in_withdrawal, 0), COALESCE(w.withdrawn, 0)
      FROM users u
      LEFT JOIN (SELECT owner_id, count(*) AS total, count(*) FILTER (WHERE is_active) AS active
                   FROM wifi_zones GROUP BY owner_id) z ON z.owner_id = u.id
      LEFT JOIN (SELECT owner_id, count(*) AS n, sum(amount) AS gross, sum(commission_amount) AS commission,
                        max(completed_at) AS last_sale
                   FROM payments WHERE status = 'completed' GROUP BY owner_id) p ON p.owner_id = u.id
      LEFT JOIN (SELECT ledger_entries.vendor_id AS v,
                        sum(amount) FILTER (WHERE available_at <= now()) AS available,
                        sum(amount) FILTER (WHERE available_at > now()) AS pending
                   FROM ledger_entries GROUP BY ledger_entries.vendor_id) l ON l.v = u.id
      LEFT JOIN (SELECT withdrawals.vendor_id AS v,
                        sum(amount) FILTER (WHERE status IN ('pending', 'approved')) AS in_withdrawal,
                        sum(amount) FILTER (WHERE status = 'paid') AS withdrawn
                   FROM withdrawals GROUP BY withdrawals.vendor_id) w ON w.v = u.id
     WHERE u.role = 'vendor'
       AND (p_vendor_id IS NULL OR u.id = p_vendor_id);
$$;

-- Forfaits, stock et ventes des 30 derniers jours de chaque zone.
-- Un ticket réservé dont la réservation a expiré compte comme libre.
CREATE OR REPLACE FUNCTION admin_zone_stats()
RETURNS TABLE (
    zone_id           uuid,
    pricings_active   bigint,
    tickets_free      bigint,
    tickets_reserved  bigint,
    tickets_sold      bigint,
    sales_30d         bigint,
    gross_30d         bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT z.id,
           COALESCE(pr.active, 0),
           COALESCE(t.free, 0), COALESCE(t.reserved, 0), COALESCE(t.sold, 0),
           COALESCE(s.n, 0), COALESCE(s.gross, 0)
      FROM wifi_zones z
      LEFT JOIN (SELECT wifi_zone_id, count(*) FILTER (WHERE is_active) AS active
                   FROM pricings GROUP BY wifi_zone_id) pr ON pr.wifi_zone_id = z.id
      LEFT JOIN (SELECT wifi_zone_id,
                        count(*) FILTER (WHERE status = 'free' OR (status = 'reserved' AND reserved_until < now())) AS free,
                        count(*) FILTER (WHERE status = 'reserved' AND reserved_until >= now()) AS reserved,
                        count(*) FILTER (WHERE status = 'sold') AS sold
                   FROM tickets GROUP BY wifi_zone_id) t ON t.wifi_zone_id = z.id
      LEFT JOIN (SELECT wifi_zone_id, count(*) AS n, sum(amount) AS gross
                   FROM payments
                  WHERE status = 'completed' AND completed_at >= now() - interval '30 days'
                  GROUP BY wifi_zone_id) s ON s.wifi_zone_id = z.id;
$$;

-- Totaux des paiements filtrés (page Transactions). Filtres NULL = ignorés.
-- Période sur la date de création du paiement ; montants et commissions des paiements réussis seulement.
CREATE OR REPLACE FUNCTION admin_transactions_summary(
    p_from      timestamptz,
    p_to        timestamptz,
    p_status    text,
    p_vendor_id uuid,
    p_zone_id   uuid
)
RETURNS TABLE (total_count bigint, completed_count bigint, gross bigint, commission bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT count(*),
           count(*) FILTER (WHERE status = 'completed'),
           COALESCE(sum(amount) FILTER (WHERE status = 'completed'), 0),
           COALESCE(sum(commission_amount) FILTER (WHERE status = 'completed'), 0)
      FROM payments
     WHERE (p_from IS NULL OR created_at >= p_from)
       AND (p_to IS NULL OR created_at < p_to)
       AND (p_status IS NULL OR status = p_status)
       AND (p_vendor_id IS NULL OR owner_id = p_vendor_id)
       AND (p_zone_id IS NULL OR wifi_zone_id = p_zone_id);
$$;

CREATE INDEX payments_created_at_idx ON payments (created_at DESC);
CREATE INDEX payments_status_completed_idx ON payments (completed_at) WHERE status = 'completed';

-- -----------------------------------------------------------------------------
-- Journal des actions du super admin (migration 010).
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     uuid        NOT NULL REFERENCES users (id),
    -- Ex : vendor.approve, withdrawal.paid, adjustment.create, setting.update, admin.login
    action       text        NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
    target_type  text        CONSTRAINT audit_log_target_type_check CHECK (target_type IN ('vendor', 'withdrawal', 'setting', 'account', 'payment')),
    target_id    text,
    -- Ce qu'il faut pour relire l'action sans jointure : nom du promoteur, montant, ancienne et nouvelle valeur…
    details      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ip           text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action, created_at DESC);
CREATE INDEX audit_log_target_idx ON audit_log (target_type, target_id);

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

CREATE TRIGGER audit_log_no_change
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();


-- -----------------------------------------------------------------------------
-- Modification d'un paramètre (bornes sûres, inscrite au journal)
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

-- Ces fonctions ne doivent être appelables que par le backend (service_role).
-- Par défaut, Supabase les rendrait accessibles aux clés anon et authenticated.
REVOKE ALL ON FUNCTION reserve_ticket(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION confirm_ticket(uuid, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION complete_payment(uuid, text, text)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION reserve_ticket(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_ticket(uuid, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION complete_payment(uuid, text, text)  TO service_role;


-- -----------------------------------------------------------------------------
-- Row Level Security : activée partout, aucune politique.
-- Résultat : accès refusé à anon / authenticated, seul service_role passe.
-- -----------------------------------------------------------------------------
ALTER TABLE countries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION platform_setting(text)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION credit_sale(uuid)                                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION complete_payment(uuid, text, text)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION vendor_balance(uuid)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION request_withdrawal(uuid, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_withdrawal_status(uuid, text, uuid, text, text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION add_adjustment(uuid, integer, uuid, text)                    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION platform_setting(text)                                       TO service_role;
GRANT EXECUTE ON FUNCTION credit_sale(uuid)                                            TO service_role;
GRANT EXECUTE ON FUNCTION complete_payment(uuid, text, text)                           TO service_role;
GRANT EXECUTE ON FUNCTION vendor_balance(uuid)                                         TO service_role;
GRANT EXECUTE ON FUNCTION request_withdrawal(uuid, integer, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION set_withdrawal_status(uuid, text, uuid, text, text)          TO service_role;
GRANT EXECUTE ON FUNCTION add_adjustment(uuid, integer, uuid, text)                    TO service_role;

REVOKE ALL ON FUNCTION submit_vendor_profile(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_vendor_status(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_vendor_profile(uuid)                      TO service_role;
GRANT EXECUTE ON FUNCTION set_vendor_status(uuid, text, uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION admin_overview(timestamptz, timestamptz)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_vendor_stats(uuid)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_zone_stats()                                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_transactions_summary(timestamptz, timestamptz, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_overview(timestamptz, timestamptz)                        TO service_role;
GRANT EXECUTE ON FUNCTION admin_vendor_stats(uuid)                                         TO service_role;
GRANT EXECUTE ON FUNCTION admin_zone_stats()                                               TO service_role;
GRANT EXECUTE ON FUNCTION admin_transactions_summary(timestamptz, timestamptz, text, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION set_platform_setting(text, integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_platform_setting(text, integer, uuid, text) TO service_role;

-- =============================================================================
-- Zones confiées aux employés, ventes par zone (migration 011)
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Zones confiées aux employés
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_zones (
    employee_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    wifi_zone_id  uuid        NOT NULL REFERENCES wifi_zones (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_id, wifi_zone_id)
);

CREATE INDEX IF NOT EXISTS employee_zones_zone_idx ON employee_zones (wifi_zone_id);

COMMENT ON TABLE employee_zones IS
    'Zones confiées à un employé. Affecté, il ne voit que ces zones ; sans affectation, toutes celles de son promoteur.';

-- L'employé et la zone appartiennent au même promoteur.
CREATE OR REPLACE FUNCTION check_employee_zone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM users u
          JOIN wifi_zones z ON z.owner_id = u.employer_id
         WHERE u.id = NEW.employee_id
           AND u.role = 'employee'
           AND z.id = NEW.wifi_zone_id
    ) THEN
        RAISE EXCEPTION 'employee_zone:not_same_vendor';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_zones_same_vendor ON employee_zones;
CREATE TRIGGER employee_zones_same_vendor
    BEFORE INSERT OR UPDATE ON employee_zones
    FOR EACH ROW EXECUTE FUNCTION check_employee_zone();

-- -----------------------------------------------------------------------------
-- 2. Ventes par zone et par forfait sur une période
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS payments_owner_completed_idx
    ON payments (owner_id, completed_at)
    WHERE status = 'completed';

CREATE OR REPLACE FUNCTION vendor_zone_sales(p_owner_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (wifi_zone_id uuid, pricing_name text, sales bigint, amount bigint)
LANGUAGE sql
STABLE
AS $$
    SELECT p.wifi_zone_id, p.pricing_name, count(*)::bigint, sum(p.amount)::bigint
      FROM payments p
     WHERE p.owner_id = p_owner_id
       AND p.status = 'completed'
       AND (p_from IS NULL OR p.completed_at >= p_from)
       AND p.completed_at < p_to
     GROUP BY p.wifi_zone_id, p.pricing_name
$$;

REVOKE ALL ON FUNCTION vendor_zone_sales(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION vendor_zone_sales(uuid, timestamptz, timestamptz) TO service_role;

-- Remplace les zones d'un employé, en une seule transaction. Tableau vide : plus aucune zone
-- (l'employé revoit toutes les zones de son promoteur). Renvoie les zones retenues.
CREATE OR REPLACE FUNCTION set_employee_zones(p_vendor_id uuid, p_employee_id uuid, p_zone_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
    v_ids uuid[] := ARRAY(SELECT DISTINCT unnest(coalesce(p_zone_ids, '{}'::uuid[])));
BEGIN
    PERFORM 1 FROM users
     WHERE id = p_employee_id AND role = 'employee' AND employer_id = p_vendor_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'employee_zone:not_found';
    END IF;
    IF (SELECT count(*) FROM wifi_zones WHERE owner_id = p_vendor_id AND id = ANY (v_ids)) <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'employee_zone:not_owned';
    END IF;

    DELETE FROM employee_zones WHERE employee_id = p_employee_id;
    INSERT INTO employee_zones (employee_id, wifi_zone_id)
    SELECT p_employee_id, z FROM unnest(v_ids) AS z;
    RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION set_employee_zones(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_employee_zones(uuid, uuid, uuid[]) TO service_role;

-- =============================================================================
-- Espace développeur : relectures des paiements chez Moneroo, santé des paiements (migration 012)
-- =============================================================================
CREATE TABLE payment_sync_events (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    -- webhook : envoyé par Moneroo ; return_page : page /merci du client ; developer : bouton de l'espace développeur
    source               text        NOT NULL CHECK (source IN ('webhook', 'return_page', 'developer')),
    event                text,
    provider_payment_id  text,
    payment_id           uuid        REFERENCES payments (id) ON DELETE SET NULL,
    -- updated : statut changé ; unchanged : rien à faire ; unknown_payment : paiement inconnu de la base ;
    -- amount_mismatch : montant ou devise différents (ticket refusé) ; no_ticket : payé mais plus de ticket ;
    -- error : Moneroo injoignable ou erreur inattendue
    outcome              text        NOT NULL
                                     CHECK (outcome IN ('updated', 'unchanged', 'unknown_payment', 'amount_mismatch', 'no_ticket', 'error')),
    status_before        text,
    status_after         text,
    error                text,
    duration_ms          integer,
    actor_id             uuid        REFERENCES users (id)
);

CREATE INDEX payment_sync_events_created_idx ON payment_sync_events (created_at DESC);
CREATE INDEX payment_sync_events_payment_idx ON payment_sync_events (payment_id, created_at DESC);
CREATE INDEX payment_sync_events_source_idx  ON payment_sync_events (source, created_at DESC);

COMMENT ON TABLE payment_sync_events IS
    'Relectures des paiements chez Moneroo (webhook, page de retour, développeur) et leur résultat. Sert au diagnostic.';

-- Paiements encore en attente (recherche des paiements bloqués).
CREATE INDEX payments_pending_idx ON payments (created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION dev_overview(p_stuck_minutes integer DEFAULT 15)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'payments', jsonb_build_object(
            'pending_stuck',   (SELECT count(*) FROM payments WHERE status = 'pending' AND created_at <  now() - make_interval(mins => p_stuck_minutes)),
            'pending_recent',  (SELECT count(*) FROM payments WHERE status = 'pending' AND created_at >= now() - make_interval(mins => p_stuck_minutes)),
            'completed_24h',   (SELECT count(*) FROM payments WHERE status = 'completed' AND completed_at >= now() - interval '24 hours'),
            'failed_24h',      (SELECT count(*) FROM payments WHERE status IN ('failed', 'cancelled') AND created_at >= now() - interval '24 hours'),
            'without_ticket',  (SELECT count(*) FROM payments p
                                 WHERE p.status = 'completed'
                                   AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.payment_id = p.id))
        ),
        'syncs', jsonb_build_object(
            'last_webhook_at',  (SELECT max(created_at) FROM payment_sync_events WHERE source = 'webhook'),
            'webhooks_24h',     (SELECT count(*) FROM payment_sync_events WHERE source = 'webhook' AND created_at >= now() - interval '24 hours'),
            'return_page_24h',  (SELECT count(*) FROM payment_sync_events WHERE source = 'return_page' AND created_at >= now() - interval '24 hours'),
            'problems_24h',     (SELECT count(*) FROM payment_sync_events
                                  WHERE outcome IN ('unknown_payment', 'amount_mismatch', 'no_ticket', 'error')
                                    AND created_at >= now() - interval '24 hours')
        )
    )
$$;

REVOKE ALL ON FUNCTION dev_overview(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dev_overview(integer) TO service_role;

-- Paiements réussis sans ticket (stock épuisé au moment du paiement), les plus récents d'abord.
CREATE OR REPLACE FUNCTION dev_payments_without_ticket(p_limit integer, p_offset integer)
RETURNS SETOF payments
LANGUAGE sql
STABLE
AS $$
    SELECT p.*
      FROM payments p
     WHERE p.status = 'completed'
       AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.payment_id = p.id)
     ORDER BY p.completed_at DESC
     LIMIT p_limit OFFSET p_offset
$$;

REVOKE ALL ON FUNCTION dev_payments_without_ticket(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dev_payments_without_ticket(integer, integer) TO service_role;

COMMIT;
