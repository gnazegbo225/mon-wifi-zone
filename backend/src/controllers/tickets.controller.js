const supabase = require('../config/supabase');
const { parseCsv, isBlankRecord } = require('../utils/csv');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_COLUMNS = ['username', 'password', 'profile'];
const MAX_FIELD_LENGTH = 64;
const MAX_TICKETS = 20000;
const INSERT_BATCH = 500;

// Lit les lignes du CSV et les classe : tickets valides, lignes invalides.
// Renvoie { error } si le fichier lui-même ne convient pas (pas d'en-tête, colonnes manquantes…).
function readTicketRows(text) {
  const records = parseCsv(text).records.filter((r) => !isBlankRecord(r));
  if (records.length === 0) return { error: 'Le fichier est vide.' };

  // En-tête : noms de colonnes sans tenir compte des majuscules ni des espaces.
  const [header, ...rows] = records;
  const columns = header.fields.map((f) => f.trim().toLowerCase());
  const index = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, columns.indexOf(c)]));
  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === -1);
  if (missing.length > 0) {
    return {
      error: `Colonnes manquantes : ${missing.join(', ')}. La première ligne doit contenir Username, Password et Profile.`,
    };
  }

  if (rows.length === 0) return { error: 'Le fichier ne contient aucun ticket, seulement l’en-tête.' };
  if (rows.length > MAX_TICKETS) {
    return { error: `Trop de lignes : ${MAX_TICKETS} tickets maximum par fichier. Coupe-le en plusieurs fichiers.` };
  }

  const valid = [];
  const invalid = [];
  for (const { line, fields } of rows) {
    const value = (column) => (fields[index[column]] ?? '').trim();
    const username = value('username');
    const password = value('password');
    const profile = value('profile');

    let reason = null;
    if (fields.length < columns.length) reason = 'colonnes manquantes';
    else if (!username) reason = 'nom d’utilisateur vide';
    else if (!password) reason = 'mot de passe vide';
    else if (!profile) reason = 'profil vide';
    else if ([username, password, profile].some((v) => v.length > MAX_FIELD_LENGTH)) {
      reason = `valeur trop longue (${MAX_FIELD_LENGTH} caractères maximum)`;
    }

    if (reason) invalid.push({ line, reason });
    else valid.push({ line, username, password, profile });
  }

  return { valid, invalid };
}

// POST /api/tickets/import (admin)
// multipart/form-data : file (le CSV) + zone_id.
// Chaque ticket est rattaché au forfait de la zone dont le ticket_profile est égal à son profil.
// Un ticket sans forfait correspondant n'est pas importé. Rien n'est jamais écrasé.
async function importTickets(req, res) {
  const zoneId = req.body?.zone_id;
  if (typeof zoneId !== 'string' || !UUID_REGEX.test(zoneId)) {
    return res.status(400).json({ error: 'Choisis une zone WiFi valide.', field: 'zone_id' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Ajoute un fichier CSV.', field: 'file' });
  }

  const { data: zone, error: zoneError } = await supabase.from('wifi_zones').select('id').eq('id', zoneId).maybeSingle();
  if (zoneError) throw zoneError;
  if (!zone) return res.status(400).json({ error: 'Cette zone WiFi n’existe pas.', field: 'zone_id' });

  const { valid, invalid, error } = readTicketRows(req.file.buffer.toString('utf8'));
  if (error) return res.status(400).json({ error, field: 'file' });

  // Forfaits de la zone, par profil MikroTik.
  const { data: pricings, error: pricingsError } = await supabase
    .from('pricings')
    .select('id, ticket_profile')
    .eq('wifi_zone_id', zoneId);
  if (pricingsError) throw pricingsError;

  const pricingsByProfile = new Map();
  for (const p of pricings) {
    pricingsByProfile.set(p.ticket_profile, [...(pricingsByProfile.get(p.ticket_profile) || []), p.id]);
  }

  // Deux forfaits avec le même profil : on ne saurait pas à quel forfait rattacher le ticket.
  const ambiguous = [...new Set(valid.map((t) => t.profile))].filter((p) => pricingsByProfile.get(p)?.length > 1);
  if (ambiguous.length > 0) {
    return res.status(409).json({
      error: `Plusieurs forfaits de cette zone utilisent le profil ${ambiguous.join(', ')}. Corrige les forfaits, puis réimporte.`,
      field: 'file',
    });
  }

  const duplicates = [];
  const withoutPricing = new Map(); // profil -> nombre de tickets ignorés
  const seen = new Set();
  const toInsert = [];

  for (const t of valid) {
    if (seen.has(t.username)) {
      duplicates.push(t.username); // Répété dans le fichier : on garde la première ligne.
      continue;
    }
    seen.add(t.username);

    const pricingId = pricingsByProfile.get(t.profile)?.[0];
    if (!pricingId) {
      withoutPricing.set(t.profile, (withoutPricing.get(t.profile) || 0) + 1);
      continue;
    }

    toInsert.push({
      wifi_zone_id: zoneId,
      pricing_id: pricingId,
      username: t.username,
      password: t.password,
      profile: t.profile,
    });
  }

  // Les tickets déjà présents dans la zone (même username) sont ignorés, jamais écrasés.
  // La base renvoie seulement les lignes vraiment insérées : les autres sont des doublons.
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const batch = toInsert.slice(i, i + INSERT_BATCH);
    const { data, error: insertError } = await supabase
      .from('tickets')
      .upsert(batch, { onConflict: 'wifi_zone_id,username', ignoreDuplicates: true })
      .select('username');
    if (insertError) throw insertError;

    imported += data.length;
    const inserted = new Set(data.map((d) => d.username));
    for (const t of batch) if (!inserted.has(t.username)) duplicates.push(t.username);
  }

  res.json({
    report: {
      imported,
      duplicates,
      profiles_without_pricing: [...withoutPricing].map(([profile, count]) => ({ profile, count })),
      invalid_lines: invalid,
    },
  });
}

// GET /api/tickets/stock (connecté) : nombre de tickets par forfait et par statut.
// Filtre optionnel : ?zone_id=<uuid>. Ne renvoie jamais les identifiants des tickets.
async function getStock(req, res) {
  const { zone_id: zoneId } = req.query;
  if (zoneId !== undefined && !UUID_REGEX.test(zoneId)) {
    return res.status(400).json({ error: 'zone_id invalide' });
  }

  let query = supabase
    .from('pricings')
    .select('id, wifi_zone_id, name, amount, is_active')
    .order('wifi_zone_id')
    .order('amount', { ascending: true });
  if (zoneId) query = query.eq('wifi_zone_id', zoneId);

  const { data: pricings, error } = await query;
  if (error) throw error;

  // Les tickets peuvent être des milliers : on les compte, forfait par forfait.
  const count = async (pricingId, status) => {
    const { count: n, error: countError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('pricing_id', pricingId)
      .eq('status', status);
    if (countError) throw countError;
    return n;
  };

  const stock = await Promise.all(
    pricings.map(async (p) => {
      const [free, reserved, sold] = await Promise.all([count(p.id, 'free'), count(p.id, 'reserved'), count(p.id, 'sold')]);
      return {
        pricing_id: p.id,
        wifi_zone_id: p.wifi_zone_id,
        name: p.name,
        amount: p.amount,
        is_active: p.is_active,
        free,
        reserved,
        sold,
      };
    }),
  );

  res.json({ stock });
}

module.exports = { importTickets, getStock };
