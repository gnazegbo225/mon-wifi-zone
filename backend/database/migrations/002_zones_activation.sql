-- =============================================================================
-- Migration 002 — activer / désactiver une zone WiFi
-- À exécuter une seule fois dans l'éditeur SQL de Supabase, après la migration 001.
--
-- On ne supprime jamais une zone (ses forfaits, tickets et paiements y sont liés) :
-- on la désactive.
--
-- Quand une zone est désactivée :
--   - ses forfaits disparaissent pour les clients, mais gardent leur propre
--     état actif / désactivé (la réactivation de la zone remet tout comme avant) ;
--   - on ne peut pas y créer ni y réactiver un forfait (règle vérifiée par le backend).
--
-- Les zones existantes restent actives (valeur par défaut true).
-- Le script peut être relancé sans risque (IF NOT EXISTS).
-- =============================================================================

BEGIN;

ALTER TABLE wifi_zones
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN wifi_zones.is_active IS
    'false : zone désactivée. Ses forfaits ne sont plus proposés aux clients. On désactive au lieu de supprimer.';

COMMIT;
