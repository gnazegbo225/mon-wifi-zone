// Périmètre d'un compte de l'espace promoteur : les zones de son promoteur (wifi_zones.owner_id).
// req.user.ownerId vaut l'id du promoteur, ou celui de son employeur pour un employé (voir auth.js).
// Un employé affecté à des zones (req.user.zoneIds) ne voit que celles-là.
// Une zone hors du périmètre est traitée comme inexistante : on ne révèle pas qu'elle existe.
const supabase = require('../config/supabase');

// Restreint une requête sur wifi_zones au périmètre du compte.
function inScope(req, query) {
  const q = query.eq('owner_id', req.user.ownerId);
  return req.user.zoneIds ? q.in('id', req.user.zoneIds) : q;
}

// La zone si elle est dans le périmètre du compte, sinon null.
async function ownedZone(req, zoneId, columns = 'id, is_active') {
  const { data, error } = await inScope(req, supabase.from('wifi_zones').select(columns).eq('id', zoneId)).maybeSingle();
  if (error) throw error;
  return data;
}

// Identifiants de toutes les zones du périmètre du compte.
async function ownedZoneIds(req) {
  const { data, error } = await inScope(req, supabase.from('wifi_zones').select('id'));
  if (error) throw error;
  return data.map((z) => z.id);
}

module.exports = { inScope, ownedZone, ownedZoneIds };
