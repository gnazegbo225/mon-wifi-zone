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

// Renvoie { id, is_active } ou null si la zone n'existe pas.
async function findZone(zoneId) {
  const { data, error } = await supabase.from('wifi_zones').select('id, is_active').eq('id', zoneId).maybeSingle();
  if (error) throw error;
  return data;
}

// Un profil MikroTik désigne un seul forfait par zone : c'est lui qui relie chaque ticket importé
// à son forfait. excludeId : le forfait en cours de modification.
async function profileTaken(zoneId, ticketProfile, excludeId = null) {
  let query = supabase
    .from('pricings')
    .select('id')
    .eq('wifi_zone_id', zoneId)
    .eq('ticket_profile', ticketProfile)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data.length > 0;
}

const PROFILE_TAKEN_ERROR = {
  error: 'Un autre forfait de cette zone utilise déjà ce profil MikroTik. Choisis un autre profil.',
  field: 'ticket_profile',
};

const INACTIVE_ZONE_ERROR = {
  error: 'Cette zone est désactivée. Active-la d’abord sur la page Zones.',
  field: 'wifi_zone_id',
};

// GET /api/pricings
// Public : forfaits actifs des zones actives seulement, sans ticket_profile.
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
    // Un forfait d'une zone désactivée n'est plus proposé aux clients.
    const { data: zones, error: zonesError } = await supabase.from('wifi_zones').select('id').eq('is_active', true);
    if (zonesError) throw zonesError;
    if (zones.length === 0) return res.json({ pricings: [] });

    query = query.eq('is_active', true).in('wifi_zone_id', zones.map((z) => z.id));
  }
  query = query.order('amount', { ascending: true });

  if (zoneId) query = query.eq('wifi_zone_id', zoneId);

  const { data, error } = await query;

  if (error) throw error;

  res.json({ pricings: data });
}

// POST /api/pricings (admin) : crée un forfait, actif par défaut, dans une zone active.
async function createPricing(req, res) {
  const { value, field, message } = validatePricing(req.body);
  if (!value) return badRequest(res, field, message);

  const zone = await findZone(value.wifi_zone_id);
  if (!zone) return badRequest(res, 'wifi_zone_id', 'Cette zone WiFi n’existe pas.');
  if (!zone.is_active) return res.status(409).json(INACTIVE_ZONE_ERROR);
  if (await profileTaken(value.wifi_zone_id, value.ticket_profile)) return res.status(409).json(PROFILE_TAKEN_ERROR);

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

  const { data: current, error: currentError } = await supabase
    .from('pricings')
    .select('wifi_zone_id, ticket_profile')
    .eq('id', id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) return res.status(404).json({ error: 'Forfait introuvable' });

  const zone = await findZone(value.wifi_zone_id);
  if (!zone) return badRequest(res, 'wifi_zone_id', 'Cette zone WiFi n’existe pas.');
  // On peut corriger un forfait d'une zone désactivée, mais pas le déplacer vers une zone désactivée.
  if (!zone.is_active && value.wifi_zone_id !== current.wifi_zone_id) {
    return res.status(409).json(INACTIVE_ZONE_ERROR);
  }
  if (await profileTaken(value.wifi_zone_id, value.ticket_profile, id)) {
    return res.status(409).json(PROFILE_TAKEN_ERROR);
  }

  // Les tickets d'un forfait portent son profil MikroTik : on ne peut plus le changer une fois des tickets importés.
  if (value.ticket_profile !== current.ticket_profile) {
    const { count, error: countError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('pricing_id', id);
    if (countError) throw countError;
    if (count > 0) {
      return res.status(409).json({
        error: 'Ce forfait a déjà des tickets. Tu ne peux plus changer son profil MikroTik.',
        field: 'ticket_profile',
      });
    }
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

  // Réactiver un forfait n'a pas de sens si sa zone est désactivée : les clients ne le verraient pas.
  if (isActive) {
    const { data: current, error: currentError } = await supabase
      .from('pricings')
      .select('wifi_zones (is_active)')
      .eq('id', id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ error: 'Forfait introuvable' });
    if (current.wifi_zones && !current.wifi_zones.is_active) {
      return res.status(409).json(INACTIVE_ZONE_ERROR);
    }
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
