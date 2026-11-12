-- =============================================================================
-- Migration 007 — registre financier : commission, solde des promoteurs, retraits
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 006.
--
--   1. platform_settings : commission (8 %), retrait minimum (1 000 F), attente (24 h).
--      Modifiables sans toucher au code ; chaque vente garde le taux appliqué ce jour-là.
--   2. payments : taux et montant de la commission de chaque vente.
--   3. withdrawals + withdrawal_events : demandes de retrait et historique de chaque changement.
--   4. ledger_entries : registre des mouvements d'argent de chaque promoteur, en ajout seulement.
--      Le solde n'est jamais stocké : c'est la somme des mouvements.
--        sale (+)               vente, disponible 24 h après
--        commission (−)         8 % de la vente, même date de disponibilité
--        withdrawal_hold (−)    montant bloqué dès la demande de retrait
--        withdrawal_release (+) montant rendu si le retrait est rejeté ou annulé
--        adjustment (±)         correction manuelle du super admin, avec motif
--   5. Fonctions :
--        credit_sale(paiement)         inscrit vente + commission (une seule fois par paiement)
--        complete_payment(…)           appelle maintenant credit_sale
--        vendor_balance(promoteur)     en attente / disponible / retrait en cours / retiré
--        request_withdrawal(…)         demande de retrait, sous verrou (jamais au-delà du disponible)
--        set_withdrawal_status(…)      approuver, rejeter, marquer payé, annuler
--        add_adjustment(…)             correction manuelle
--   6. Rattrapage : les ventes déjà réalisées sont inscrites au registre.
--
-- Montants en FCFA, nombres entiers. Tout est dans une transaction. Le script peut être relancé.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Paramètres de la plateforme
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
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

-- -----------------------------------------------------------------------------
-- 2. Commission de chaque vente
-- -----------------------------------------------------------------------------
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS commission_rate_bps integer CHECK (commission_rate_bps BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS commission_amount   integer CHECK (commission_amount >= 0);

-- -----------------------------------------------------------------------------
-- 3. Retraits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawals (
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

CREATE INDEX IF NOT EXISTS withdrawals_vendor_idx ON withdrawals (vendor_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals (status, requested_at);

COMMENT ON TABLE withdrawals IS
    'Demandes de retrait des promoteurs : pending → approved → paid, ou rejected / cancelled. Le super admin fait le transfert à la main, puis saisit sa référence.';

CREATE TABLE IF NOT EXISTS withdrawal_events (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id  uuid        NOT NULL REFERENCES withdrawals (id) ON DELETE RESTRICT,
    from_status    text,
    to_status      text        NOT NULL,
    actor_id       uuid        NOT NULL REFERENCES users (id),
    note           text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawal_events_withdrawal_idx ON withdrawal_events (withdrawal_id, created_at);

COMMENT ON TABLE withdrawal_events IS 'Historique de chaque retrait : qui a changé son statut, quand, et pourquoi.';

-- -----------------------------------------------------------------------------
-- 4. Registre des mouvements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
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
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_type_key
    ON ledger_entries (payment_id, type) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_withdrawal_type_key
    ON ledger_entries (withdrawal_id, type) WHERE withdrawal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_entries_vendor_idx ON ledger_entries (vendor_id, available_at);

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

DROP TRIGGER IF EXISTS ledger_entries_no_change ON ledger_entries;
CREATE TRIGGER ledger_entries_no_change
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();

-- -----------------------------------------------------------------------------
-- 5. Fonctions
-- -----------------------------------------------------------------------------

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
-- 6. Rattrapage des ventes déjà réalisées (sans effet au 2e passage)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_id uuid;
BEGIN
    FOR v_id IN SELECT id FROM payments WHERE status = 'completed' ORDER BY completed_at LOOP
        PERFORM credit_sale(v_id);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Accès : seul le backend (service_role)
-- -----------------------------------------------------------------------------
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries    ENABLE ROW LEVEL SECURITY;

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

COMMIT;
