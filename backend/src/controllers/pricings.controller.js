const supabase = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/pricings : liste des forfaits actifs, du moins cher au plus cher.
// Filtre optionnel : ?zone_id=<uuid> pour ne garder que les forfaits d'une zone.
// ticket_profile (profil MikroTik) n'est pas renvoyé : c'est interne.
async function listPricings(req, res) {
  const { zone_id: zoneId } = req.query;

  if (zoneId !== undefined && !UUID_REGEX.test(zoneId)) {
    return res.status(400).json({ error: 'zone_id invalide' });
  }

  let query = supabase
    .from('pricings')
    .select('id, wifi_zone_id, name, amount, duration_label, speed_label')
    .eq('is_active', true)
    .order('amount', { ascending: true });

  if (zoneId) query = query.eq('wifi_zone_id', zoneId);

  const { data, error } = await query;

  if (error) throw error;

  res.json({ pricings: data });
}

module.exports = { listPricings };
