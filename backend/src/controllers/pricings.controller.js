const supabase = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 2147483647; // Plus grand entier accepté par la colonne integer.

// Colonnes visibles par tout le monde. ticket_profile (profil MikroTik) reste interne.
const PUBLIC_COLUMNS = 'id, wifi_zone_id, name, amount, duration_label, speed_label';
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, ticket_profile, is_active`;

function badRequest(res, field, message) {
  return res.status(400).json({ error: message, field });
}

// Vérifie le corps d'un POST ou d'un PUT. Renvoie { value } ou { field, message }.
function validatePricing(body) {
  const b = body || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  if (typeof b.wifi_zone_id !== 'string' || !UUID_REGEX.test(b.wifi_zone_id)) {
    return { field: 'wifi_zone_id', message: 'Choisis une zone WiFi valide.' };
  }

  const name = text(b.name);
  if (!name || name.length > 100) {
    return { field: 'name', message: 'Donne un nom au forfait (100 caractères maximum).' };
  }

  // Montant : un vrai nombre entier (pas de texte, pas de virgule), en FCFA, plus grand que 0.
  if (typeof b.amount !== 'number' || !Number.isInteger(b.amount) || b.amount <= 0 || b.amount > MAX_AMOUNT) {
    return { field: 'amount', message: 'Le montant doit être un nombre entier de FCFA, plus grand que 0.' };
  }

  const durationLabel = text(b.duration_label);
  if (!durationLabel || durationLabel.length > 50) {
    return { field: 'duration_label', message: 'Écris la durée du forfait. Par exemple : 1 heure.' };
  }

  if (b.speed_label != null && typeof b.speed_label !== 'string') {
    return { field: 'speed_label', message: 'Le débit doit être un texte. Par exemple : 5 Mbps.' };
  }
  const speedLabel = text(b.speed_label);
  if (speedLabel.length > 50) {
    return { field: 'speed_label', message: 'Le débit est trop long (50 caractères maximum).' };
  }

  const ticketProfile = text(b.ticket_profile);
  if (!ticketProfile || ticketProfile.length > 64) {
    return { field: 'ticket_profile', message: 'Le profil MikroTik est obligatoire (64 caractères maximum).' };
  }

  return {
    value: {
      wifi_zone_id: b.wifi_zone_id,
      name,
      amount: b.amount,
      duration_label: durationLabel,
      speed_label: speedLabel || null,
      ticket_profile: ticketProfile,
    },
  };
}

async function zoneExists(zoneId) {
  const { data, error } = await supabase.from('wifi_zones').select('id').eq('id', zoneId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// GET /api/pricings
// Public : forfaits actifs seulement, sans ticket_profile.
// Admin connecté : tous les forfaits (actifs et désactivés), avec ticket_profile et is_active.
// Filtre optionnel : ?zone_id=<uuid>.
async function listPricings(req, res) {
  const { zone_id: zoneId } = req.query;

  if (zoneId !== undefined && !UUID_REGEX.test(zoneId)) {
    return res.status(400).json({ error: 'zone_id invalide' });
  }

  const isAdmin = req.user?.role === 'admin';

  let query = supabase.from('pricings').select(isAdmin ? ADMIN_COLUMNS : PUBLIC_COLUMNS);

  if (isAdmin) {
    query = query.order('is_active', { ascending: false });
  } else {
    query = query.eq('is_active', true);
  }
  query = query.order('amount', { ascending: true });

  if (zoneId) query = query.eq('wifi_zone_id', zoneId);

  const { data, error } = await query;

  if (error) throw error;

  res.json({ pricings: data });
}

// POST /api/pricings (admin) : crée un forfait, actif par défaut.
async function createPricing(req, res) {
  const { value, field, message } = validatePricing(req.body);
  if (!value) return badRequest(res, field, message);

  if (!(await zoneExists(value.wifi_zone_id))) {
    return badRequest(res, 'wifi_zone_id', 'Cette zone WiFi n’existe pas.');
  }

  const { data, error } = await supabase
    .from('pricings')
    .insert({ ...value, is_active: true })
    .select(ADMIN_COLUMNS)
    .single();

  if (error) throw error;

  res.status(201).json({ pricing: data });
}

// PUT /api/pricings/:id (admin) : remplace les informations d'un forfait.
// L'état actif / désactivé ne change pas ici : voir setPricingStatus.
async function updatePricing(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Forfait introuvable' });

  const { value, field, message } = validatePricing(req.body);
  if (!value) return badRequest(res, field, message);

  if (!(await zoneExists(value.wifi_zone_id))) {
    return badRequest(res, 'wifi_zone_id', 'Cette zone WiFi n’existe pas.');
  }

  const { data, error } = await supabase
    .from('pricings')
    .update(value)
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  // 23503 : des tickets ou paiements sont liés à ce forfait ET à son ancienne zone.
  if (error?.code === '23503') {
    return res.status(409).json({
      error: 'Ce forfait a déjà des tickets ou des paiements. Tu ne peux plus changer sa zone.',
      field: 'wifi_zone_id',
    });
  }
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Forfait introuvable' });

  res.json({ pricing: data });
}

// PATCH /api/pricings/:id/status (admin) : { is_active: true | false }
// On ne supprime jamais un forfait (tickets et paiements y sont liés) : on le désactive.
async function setPricingStatus(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Forfait introuvable' });

  const isActive = req.body?.is_active;
  if (typeof isActive !== 'boolean') {
    return badRequest(res, 'is_active', 'is_active doit valoir true ou false.');
  }

  const { data, error } = await supabase
    .from('pricings')
    .update({ is_active: isActive })
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Forfait introuvable' });

  res.json({ pricing: data });
}

module.exports = { listPricings, createPricing, updatePricing, setPricingStatus };
