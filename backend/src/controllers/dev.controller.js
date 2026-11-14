// Espace développeur (/api/dev) : l'accès technique. Santé de l'API et de la base, configuration,
// relectures des paiements chez Moneroo (webhooks, page de retour), paiements bloqués et resynchronisation.
// Aucune donnée sensible : pas de secret (seulement « présent / absent »), numéros des clients masqués,
// jamais le mot de passe d'un ticket.
const supabase = require('../config/supabase');
const env = require('../config/env');
const { callRpc } = require('../services/rpc');
const { syncAndLog } = require('../services/syncLog');
const { probe } = require('../services/moneroo');
const { record } = require('../services/audit');
const { rejectedWebhooks } = require('./webhook.controller');
const { maskPhone } = require('../utils/phone');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;
const STUCK_MINUTES = 15;
const STARTED_AT = new Date();
const PAYMENT_COLUMNS =
  'id, created_at, completed_at, status, amount, pricing_name, payment_method, provider_payment_id, transaction_id, phone, wifi_zone_id, owner_id';
const EVENT_COLUMNS = 'id, created_at, source, event, provider_payment_id, payment_id, outcome, status_before, status_after, error, duration_ms';
const PROBLEMS = ['unknown_payment', 'amount_mismatch', 'no_ticket', 'error'];
const NOT_FOUND = { error: 'Paiement introuvable.' };

const page = (req) => Math.max(1, Number.parseInt(req.query.page, 10) || 1);

// Configuration : jamais la valeur d'un secret, seulement s'il est présent.
function configChecks() {
  const production = env.nodeEnv === 'production';
  return [
    { key: 'MONEROO_SECRET_KEY', ok: Boolean(env.monerooSecretKey), value: env.monerooSecretKey ? 'présente' : 'absente' },
    { key: 'MONEROO_WEBHOOK_SECRET', ok: Boolean(env.monerooWebhookSecret), value: env.monerooWebhookSecret ? 'présent' : 'absent' },
    { key: 'MONEROO_BASE_URL', ok: true, value: env.monerooBaseUrl },
    { key: 'PAYMENT_CURRENCY', ok: env.paymentCurrency === 'XOF', value: env.paymentCurrency || 'absente' },
    {
      key: 'MONEROO_TEST_METHODS',
      ok: !(production && env.monerooTestMethods.length),
      value: env.monerooTestMethods.length ? env.monerooTestMethods.join(', ') : 'vide',
    },
    { key: 'FRONTEND_URL', ok: Boolean(env.frontendUrl), value: env.frontendUrl || 'absente' },
    { key: 'CORS_ORIGIN', ok: env.corsOrigin !== '*' || !production, value: [].concat(env.corsOrigin).join(', ') },
    { key: 'ADMIN_JWT_SECRET', ok: Boolean(env.adminJwtSecret), value: env.adminJwtSecret ? 'présent' : 'absent' },
    { key: 'MFA_ENCRYPTION_KEY', ok: /^[0-9a-f]{64}$/i.test(env.mfaEncryptionKey), value: env.mfaEncryptionKey ? 'présente' : 'absente' },
  ];
}

async function databaseCheck() {
  const started = Date.now();
  try {
    const { error } = await supabase.from('platform_settings').select('key').limit(1);
    if (error) return { ok: false, latency_ms: Date.now() - started, error: error.message };
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - started, error: err.message };
  }
}

// GET /api/dev/overview
async function getOverview(req, res) {
  const [database, { data: stats }] = await Promise.all([databaseCheck(), callRpc('dev_overview', { p_stuck_minutes: STUCK_MINUTES })]);
  const memory = process.memoryUsage();
  res.json({
    api: {
      started_at: STARTED_AT.toISOString(),
      uptime_s: Math.round(process.uptime()),
      node: process.version,
      env: env.nodeEnv,
      commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null,
      memory_mb: Math.round(memory.rss / 1024 / 1024),
    },
    database,
    config: configChecks(),
    webhooks: { rejected: rejectedWebhooks() },
    stats,
    stuck_minutes: STUCK_MINUTES,
  });
}

// GET /api/dev/moneroo : Moneroo répond-il, et accepte-t-il la clé ?
async function checkMoneroo(req, res) {
  res.json(await probe());
}

// Ajoute à chaque paiement le nom de sa zone et de son promoteur ; masque le numéro du client.
async function decorate(payments) {
  const zoneIds = [...new Set(payments.map((p) => p.wifi_zone_id))];
  const ownerIds = [...new Set(payments.map((p) => p.owner_id))];
  const [{ data: zones, error: zonesError }, { data: owners, error: ownersError }] = await Promise.all([
    zoneIds.length ? supabase.from('wifi_zones').select('id, name').in('id', zoneIds) : { data: [] },
    ownerIds.length ? supabase.from('users').select('id, full_name').in('id', ownerIds) : { data: [] },
  ]);
  if (zonesError) throw zonesError;
  if (ownersError) throw ownersError;
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));
  const ownerName = new Map(owners.map((o) => [o.id, o.full_name]));
  return payments.map(({ phone, ...p }) => ({
    ...p,
    customer: maskPhone(phone),
    zone_name: zoneName.get(p.wifi_zone_id) || null,
    vendor_name: ownerName.get(p.owner_id) || null,
    // Jamais arrivé chez Moneroo (l'initialisation a échoué) : rien à relire.
    syncable: !String(p.provider_payment_id).startsWith('pending:'),
  }));
}

// GET /api/dev/payments?view=stuck|no_ticket|failed|recent&q=…&page=1
// q : identifiant du paiement, identifiant Moneroo, ou chiffres du numéro du client.
async function listPayments(req, res) {
  const view = req.query.view || 'stuck';
  if (!['stuck', 'no_ticket', 'failed', 'recent'].includes(view)) return res.status(400).json({ error: 'Vue inconnue.' });
  const p = page(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length > 100) return res.status(400).json({ error: 'Recherche trop longue.' });

  let rows;
  if (view === 'no_ticket' && !q) {
    const { data, error } = await supabase.rpc('dev_payments_without_ticket', { p_limit: PAGE_SIZE + 1, p_offset: (p - 1) * PAGE_SIZE });
    if (error) throw error;
    rows = data;
  } else {
    let query = supabase.from('payments').select(PAYMENT_COLUMNS);
    if (q) {
      const digits = q.replace(/\D/g, '');
      if (UUID_REGEX.test(q)) query = query.or(`id.eq.${q.toLowerCase()},provider_payment_id.eq.${q}`);
      else if (/^[\d\s+.-]+$/.test(q) && digits.length >= 4) query = query.ilike('phone', `%${digits}%`);
      else if (/^[\w:-]+$/.test(q)) query = query.eq('provider_payment_id', q);
      else return res.json({ payments: [], page: p, has_more: false });
    } else if (view === 'stuck') {
      query = query.eq('status', 'pending').lt('created_at', new Date(Date.now() - STUCK_MINUTES * 60000).toISOString());
    } else if (view === 'failed') {
      query = query.in('status', ['failed', 'cancelled']);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).range((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
    if (error) throw error;
    rows = data;
  }

  res.json({ payments: await decorate(rows.slice(0, PAGE_SIZE)), page: p, has_more: rows.length > PAGE_SIZE });
}

async function paymentDetail(id) {
  const { data: payment, error } = await supabase.from('payments').select(PAYMENT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!payment) return null;
  const [[decorated], { data: ticket, error: ticketError }, { data: events, error: eventsError }] = await Promise.all([
    decorate([payment]),
    supabase.from('tickets').select('id, username, status, sold_at').eq('payment_id', id).maybeSingle(),
    supabase.from('payment_sync_events').select(EVENT_COLUMNS).eq('payment_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  if (ticketError) throw ticketError;
  if (eventsError) throw eventsError;
  return { payment: decorated, ticket: ticket || null, events };
}

// GET /api/dev/payments/:id : le paiement, son ticket (sans mot de passe) et ses relectures.
async function getPayment(req, res) {
  if (!UUID_REGEX.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  const detail = await paymentDetail(req.params.id);
  if (!detail) return res.status(404).json(NOT_FOUND);
  res.json(detail);
}

// POST /api/dev/payments/:id/sync : relit le paiement chez Moneroo et applique son statut.
// Même règle que le webhook : on croit Moneroo, jamais l'écran. Inscrit au journal du super admin.
async function syncPayment(req, res) {
  if (!UUID_REGEX.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  const { data: payment, error } = await supabase.from('payments').select('id, status, amount, provider_payment_id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!payment) return res.status(404).json(NOT_FOUND);
  if (payment.provider_payment_id.startsWith('pending:')) {
    return res.status(409).json({ error: 'Ce paiement n’est jamais arrivé chez Moneroo : il n’y a rien à relire.' });
  }
  if (!env.monerooSecretKey) return res.status(503).json({ error: 'MONEROO_SECRET_KEY manque sur le serveur.' });

  let result;
  try {
    result = await syncAndLog(payment.provider_payment_id, { source: 'developer', actorId: req.user.id });
  } catch (err) {
    return res.status(502).json({ error: `Moneroo n’a pas répondu : ${err.message}` });
  }
  await record(req, 'payment.sync', {
    targetType: 'payment',
    targetId: payment.id,
    details: { amount: payment.amount, before: payment.status, after: result?.status ?? payment.status, outcome: result?.outcome ?? 'unknown_payment', remote: result?.remoteStatus ?? null },
  });
  res.json({ result: result && { outcome: result.outcome, status: result.status, remote_status: result.remoteStatus }, ...(await paymentDetail(payment.id)) });
}

// GET /api/dev/events?source=webhook|return_page|developer&problems=1&page=1 : relectures, les plus récentes d'abord.
async function listEvents(req, res) {
  const p = page(req);
  const { source } = req.query;
  if (source !== undefined && !['webhook', 'return_page', 'developer'].includes(source)) return res.status(400).json({ error: 'Source inconnue.' });
  let query = supabase.from('payment_sync_events').select(EVENT_COLUMNS);
  if (source) query = query.eq('source', source);
  if (req.query.problems === '1') query = query.in('outcome', PROBLEMS);
  const { data, error } = await query.order('created_at', { ascending: false }).range((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  if (error) throw error;
  res.json({ events: data.slice(0, PAGE_SIZE), page: p, has_more: data.length > PAGE_SIZE });
}

module.exports = { getOverview, checkMoneroo, listPayments, getPayment, syncPayment, listEvents };
