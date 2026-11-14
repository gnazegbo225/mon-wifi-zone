// Espace super admin : paramètres de la plateforme (/api/admin/settings) et journal (/api/admin/audit).
const supabase = require('../../config/supabase');
const { callRpc, sendHttpError } = require('../../services/rpc');

const PAGE_SIZE = 50;

// Les paramètres, tels que les voit l'interface (commission en pourcentage).
async function readSettings() {
  const { data, error } = await supabase.from('platform_settings').select('key, value, updated_by, updated_at');
  if (error) throw error;
  const byKey = Object.fromEntries(data.map((s) => [s.key, s]));
  const last = data.filter((s) => s.updated_by).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  let updatedBy = null;
  if (last) {
    const { data: who } = await supabase.from('users').select('full_name').eq('id', last.updated_by).maybeSingle();
    updatedBy = who?.full_name || null;
  }
  return {
    commission_percent: (byKey.commission_rate_bps?.value ?? 0) / 100,
    min_withdrawal: byKey.min_withdrawal?.value ?? 0,
    hold_hours: byKey.hold_hours?.value ?? 0,
    updated_at: last?.updated_at || null,
    updated_by: updatedBy,
  };
}

// GET /api/admin/settings
async function getSettings(req, res) {
  res.json({ settings: await readSettings() });
}

// PUT /api/admin/settings { commission_percent, min_withdrawal, hold_hours }
// Chaque valeur changée passe par set_platform_setting (bornes vérifiées, journal dans la même transaction).
// Les ventes déjà faites gardent la commission de leur jour.
async function updateSettings(req, res) {
  const b = req.body || {};
  const wanted = [];
  if (b.commission_percent !== undefined) {
    const bps = Math.round(Number(b.commission_percent) * 100);
    if (!Number.isFinite(Number(b.commission_percent)) || Math.abs(bps - Number(b.commission_percent) * 100) > 1e-6) {
      return res.status(400).json({ error: 'La commission doit avoir au plus deux décimales. Par exemple : 8 ou 8,5.', field: 'commission_percent' });
    }
    wanted.push(['commission_rate_bps', bps, 'commission_percent']);
  }
  for (const key of ['min_withdrawal', 'hold_hours']) {
    if (b[key] === undefined) continue;
    if (!Number.isInteger(b[key])) return res.status(400).json({ error: 'Écris un nombre entier.', field: key });
    wanted.push([key, b[key], key]);
  }

  for (const [key, value, field] of wanted) {
    const { httpError } = await callRpc('set_platform_setting', { p_key: key, p_value: value, p_actor_id: req.user.id, p_ip: req.ip || null });
    if (httpError) {
      // La base parle en points de base (0 à 3 000) : l'interface, en pourcentage.
      const error = key === 'commission_rate_bps' && httpError.status === 400 ? 'La commission doit être entre 0 et 30 %.' : httpError.error;
      return sendHttpError(res, { ...httpError, error, field });
    }
  }
  res.json({ settings: await readSettings() });
}

// GET /api/admin/audit?action=withdrawal.paid&page=1 (action peut être un préfixe : withdrawal)
// Le journal, le plus récent d'abord, 50 par page, avec le nom de l'auteur.
async function listAudit(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  if (action && !/^[a-z_]+(\.[a-z_]+)?$/.test(action)) return res.status(400).json({ error: 'Action inconnue.' });

  let query = supabase.from('audit_log').select('id, actor_id, action, target_type, target_id, details, ip, created_at');
  if (action) query = action.includes('.') ? query.eq('action', action) : query.ilike('action', `${action}.%`);
  const { data, error } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (error) throw error;

  const hasMore = data.length > PAGE_SIZE;
  const rows = data.slice(0, PAGE_SIZE);
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const { data: actors, error: actorsError } = actorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', actorIds)
    : { data: [], error: null };
  if (actorsError) throw actorsError;
  const names = new Map(actors.map((a) => [a.id, a.full_name]));

  res.json({ entries: rows.map((r) => ({ ...r, actor_name: names.get(r.actor_id) || null })), page, has_more: hasMore });
}

module.exports = { getSettings, updateSettings, listAudit };
