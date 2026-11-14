-- =============================================================================
-- Migration 011 — zones confiées aux employés et ventes par zone
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 010.
--
--   1. employee_zones : les zones dont un employé s'occupe. Un employé affecté ne voit que ses
--      zones ; un employé sans aucune zone voit toutes les zones de son promoteur.
--      La base refuse une zone qui n'appartient pas au promoteur de l'employé.
--   2. vendor_zone_sales(promoteur, début, fin) : ventes réussies par zone et par forfait,
--      pour afficher les ventes de chaque employé (= ventes de ses zones).
--   3. set_employee_zones(promoteur, employé, zones) : remplace les zones d'un employé, tout ou rien.
--
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

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

COMMIT;
