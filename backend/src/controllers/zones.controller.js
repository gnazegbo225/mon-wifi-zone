const supabase = require('../config/supabase');
const { whereTicketStatus } = require('../utils/ticketStatus');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// owner_id n'est jamais renvoyé : inutile pour le client.
const PUBLIC_COLUMNS = 'id, name, country, city, created_at';
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, is_active`;

function badRequest(res, field, message) {
  return res.status(400).json({ error: message, field });
}

// Vérifie le corps d'un POST ou d'un PUT. Renvoie { value } ou { field, message }.
function validateZone(body) {
  const b = body || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  const name = text(b.name);
  if (!name || name.length > 100) {
    return { field: 'name', message: 'Donne un nom à la zone (100 caractères maximum).' };
  }

  const city = text(b.city);
  if (!city || city.length > 100) {
    return { field: 'city', message: 'Écris la ville de la zone (100 caractères maximum).' };
  }

  const country = text(b.country).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return { field: 'country', message: 'Le pays doit être un code de 2 lettres. Par exemple : CI.' };
  }

  return { value: { name, city, country } };
}

// Ce qui est relié à chaque zone : ses forfaits et ses tickets.
// Les forfaits sont peu nombreux : on les lit en une fois.
// Les tickets peuvent être des milliers : on ne fait que les compter, zone par zone.
async function zoneStats(zoneIds) {
  if (zoneIds.length === 0) return {};

  const { data: pricings, error } = await supabase
    .from('pricings')
    .select('wifi_zone_id, is_active')
    .in('wifi_zone_id', zoneIds);
  if (error) throw error;

  // Une réservation expirée compte comme libre.
  const now = new Date();
  const countTickets = async (zoneId, status) => {
    let query = supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('wifi_zone_id', zoneId);
    if (status) query = whereTicketStatus(query, status, now);
    const { count, error: countError } = await query;
    if (countError) throw countError;
    return count;
  };

  const entries = await Promise.all(
    zoneIds.map(async (zoneId) => {
      const zonePricings = pricings.filter((p) => p.wifi_zone_id === zoneId);
      const [total, free, sold] = await Promise.all([
        countTickets(zoneId),
        countTickets(zoneId, 'free'),
        countTickets(zoneId, 'sold'),
      ]);
      return [
        zoneId,
        {
          pricings_total: zonePricings.length,
          pricings_active: zonePricings.filter((p) => p.is_active).length,
          tickets_total: total,
          tickets_free: free,
          tickets_sold: sold,
        },
      ];
    }),
  );

  return Object.fromEntries(entries);
}

async function withStats(zone) {
  const stats = await zoneStats([zone.id]);
  return { ...zone, stats: stats[zone.id] };
}

// GET /api/zones
// Public : zones actives seulement.
// Admin connecté : toutes les zones (actives et désactivées), avec is_active
// et stats (nombre de forfaits et de tickets reliés à la zone).
async function listZones(req, res) {
  const isAdmin = req.user?.role === 'admin';

  let query = supabase.from('wifi_zones').select(isAdmin ? ADMIN_COLUMNS : PUBLIC_COLUMNS);
  if (isAdmin) {
    query = query.order('is_active', { ascending: false });
  } else {
    query = query.eq('is_active', true);
  }
  query = query.order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  if (!isAdmin) return res.json({ zones: data });

  const stats = await zoneStats(data.map((z) => z.id));
  res.json({ zones: data.map((z) => ({ ...z, stats: stats[z.id] })) });
}

// POST /api/zones (admin) : crée une zone, active par défaut. Elle appartient à l'admin connecté.
async function createZone(req, res) {
  const { value, field, message } = validateZone(req.body);
  if (!value) return badRequest(res, field, message);

  const { data, error } = await supabase
    .from('wifi_zones')
    .insert({ ...value, owner_id: req.user.id, is_active: true })
    .select(ADMIN_COLUMNS)
    .single();

  if (error) throw error;

  res.status(201).json({ zone: await withStats(data) });
}

// PUT /api/zones/:id (admin) : modifie le nom, la ville et le pays.
// L'état actif / désactivé ne change pas ici : voir setZoneStatus.
async function updateZone(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Zone introuvable' });

  const { value, field, message } = validateZone(req.body);
  if (!value) return badRequest(res, field, message);

  const { data, error } = await supabase
    .from('wifi_zones')
    .update(value)
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Zone introuvable' });

  res.json({ zone: await withStats(data) });
}

// PATCH /api/zones/:id/status (admin) : { is_active: true | false }
// On ne supprime jamais une zone : on la désactive. Ses forfaits gardent leur
// propre état, mais ne sont plus proposés aux clients tant que la zone est désactivée.
async function setZoneStatus(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Zone introuvable' });

  const isActive = req.body?.is_active;
  if (typeof isActive !== 'boolean') {
    return badRequest(res, 'is_active', 'is_active doit valoir true ou false.');
  }

  const { data, error } = await supabase
    .from('wifi_zones')
    .update({ is_active: isActive })
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Zone introuvable' });

  res.json({ zone: await withStats(data) });
}

module.exports = { listZones, createZone, updateZone, setZoneStatus };
