-- =============================================================================
-- Migration 004 — adresse du routeur et téléphone du gérant de chaque zone
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 003.
--
--   router_host   : adresse IP (v4 ou v6) ou nom DNS du routeur MikroTik de la zone.
--   manager_phone : numéro de téléphone du gérant (chiffres, avec + en option).
--
-- Les colonnes acceptent NULL pour les zones déjà créées. Le backend les rend
-- obligatoires à chaque création et modification, et la page Zones signale
-- « À compléter » tant qu'elles sont vides.
-- Le format exact est vérifié par le backend ; la base garde un garde-fou simple.
-- Le script peut être relancé sans risque.
-- =============================================================================

BEGIN;

ALTER TABLE wifi_zones
    ADD COLUMN IF NOT EXISTS router_host   text,
    ADD COLUMN IF NOT EXISTS manager_phone text;

ALTER TABLE wifi_zones DROP CONSTRAINT IF EXISTS wifi_zones_router_host_check;
ALTER TABLE wifi_zones
    ADD CONSTRAINT wifi_zones_router_host_check
    CHECK (router_host IS NULL OR (length(router_host) BETWEEN 2 AND 253 AND router_host !~ '\s'));

ALTER TABLE wifi_zones DROP CONSTRAINT IF EXISTS wifi_zones_manager_phone_check;
ALTER TABLE wifi_zones
    ADD CONSTRAINT wifi_zones_manager_phone_check
    CHECK (manager_phone IS NULL OR manager_phone ~ '^\+?[0-9]{8,15}$');

COMMENT ON COLUMN wifi_zones.router_host IS
    'Adresse IP (v4 ou v6) ou nom DNS du routeur MikroTik de la zone. Jamais renvoyée aux clients.';
COMMENT ON COLUMN wifi_zones.manager_phone IS
    'Téléphone du gérant de la zone : chiffres seulement, avec + en option (ex : +2250707070707).';

COMMIT;
