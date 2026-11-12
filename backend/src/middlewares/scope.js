// Périmètre d'un compte de l'espace promoteur : les zones de son promoteur (wifi_zones.owner_id).
// req.user.ownerId vaut l'id du promoteur, ou celui de son employeur pour un employé (voir auth.js).
// Une zone hors du périmètre est traitée comme inexistante : on ne révèle pas qu'elle existe.
const supabase = require('../config/supabase');

// La zone si elle appartient au promoteur du compte, sinon null.
async function ownedZone(req, zoneId, columns = 'id, is_active') {
  const { data, error } = await supabase
    .from('wifi_zones')
    .select(columns)
    .eq('id', zoneId)
    .eq('owner_id', req.user.ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Identifiants de toutes les zones du promoteur du compte.
async function ownedZoneIds(req) {
  const { data, error } = await supabase.from('wifi_zones').select('id').eq('owner_id', req.user.ownerId);
  if (error) throw error;
  return data.map((z) => z.id);
}

module.exports = { ownedZone, ownedZoneIds };
