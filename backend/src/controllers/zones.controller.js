const supabase = require('../config/supabase');

// GET /api/zones : liste des zones WiFi, triées par nom.
// owner_id n'est pas renvoyé : inutile pour le client.
async function listZones(req, res) {
  const { data, error } = await supabase
    .from('wifi_zones')
    .select('id, name, country, city, created_at')
    .order('name', { ascending: true });

  if (error) throw error;

  res.json({ zones: data });
}

module.exports = { listZones };
