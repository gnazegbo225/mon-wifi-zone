// Espace promoteur : ses employés (/api/vendor/employees).
// Un employé se connecte dans l'espace promoteur et agit dans les zones de son promoteur, avec des
// droits réduits (voir les routes : pas de finances, de forfaits, de portail ni de dossier).
// On ne supprime pas un employé : on le désactive (son historique reste lié à son compte).
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { callRpc, sendHttpError } = require('../services/rpc');
const { periodStart } = require('./admin/overview.controller');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMPLOYEES = 20;
const COLUMNS = 'id, full_name, email, phone, account_status, last_login_at, last_seen_at, created_at';
const NOT_FOUND = { error: 'Employé introuvable.' };
const ONLINE_MS = 5 * 60 * 1000;
const PERIODS = ['today', '7d', '30d', 'month'];

const view = (e) => ({ ...e, active: e.account_status === 'approved', online: Boolean(e.last_seen_at) && Date.now() - new Date(e.last_seen_at).getTime() < ONLINE_MS });

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return 'Le mot de passe doit avoir au moins 8 caractères.';
  }
  return null;
}

// L'employé s'il appartient au promoteur connecté, sinon null.
async function ownEmployee(req, id) {
  if (!UUID_REGEX.test(id)) return null;
  const { data, error } = await supabase
    .from('users')
    .select(COLUMNS)
    .eq('id', id)
    .eq('role', 'employee')
    .eq('employer_id', req.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Ventes d'un employé = ventes réussies de ses zones, avec le détail par zone et par forfait.
// rows : sortie de vendor_zone_sales ; zoneNames : Map id → nom.
function salesOf(zoneIds, rows, zoneNames) {
  const mine = rows.filter((r) => zoneIds.includes(r.wifi_zone_id));
  const byZone = new Map(zoneIds.map((id) => [id, { zone_id: id, name: zoneNames.get(id) || '', count: 0, amount: 0 }]));
  const byPricing = new Map();
  for (const r of mine) {
    const count = Number(r.sales);
    const amount = Number(r.amount);
    const z = byZone.get(r.wifi_zone_id);
    z.count += count;
    z.amount += amount;
    const p = byPricing.get(r.pricing_name) || { name: r.pricing_name, count: 0, amount: 0 };
    p.count += count;
    p.amount += amount;
    byPricing.set(r.pricing_name, p);
  }
  const desc = (a, b) => b.amount - a.amount || b.count - a.count;
  return {
    count: mine.reduce((s, r) => s + Number(r.sales), 0),
    amount: mine.reduce((s, r) => s + Number(r.amount), 0),
    by_zone: [...byZone.values()].sort(desc),
    by_pricing: [...byPricing.values()].sort(desc),
  };
}

// Employés d'un promoteur avec leurs zones et leurs ventes sur la période. Sert aussi au super admin.
async function employeesWithSales(vendorId, period) {
  const from = periodStart(period);
  const [{ data: employees, error }, { data: zones, error: zonesError }, { data: rows }] = await Promise.all([
    supabase.from('users').select(COLUMNS).eq('role', 'employee').eq('employer_id', vendorId).order('created_at', { ascending: true }),
    supabase.from('wifi_zones').select('id, name, is_active').eq('owner_id', vendorId).order('name', { ascending: true }),
    callRpc('vendor_zone_sales', { p_owner_id: vendorId, p_from: from ? from.toISOString() : null, p_to: new Date().toISOString() }),
  ]);
  if (error) throw error;
  if (zonesError) throw zonesError;
  let links = [];
  if (employees.length) {
    const { data, error: linksError } = await supabase
      .from('employee_zones')
      .select('employee_id, wifi_zone_id')
      .in('employee_id', employees.map((e) => e.id));
    if (linksError) throw linksError;
    links = data;
  }

  const zoneNames = new Map(zones.map((z) => [z.id, z.name]));
  const ids = new Set(employees.map((e) => e.id));
  const zonesOf = new Map();
  for (const l of links) {
    if (!ids.has(l.employee_id) || !zoneNames.has(l.wifi_zone_id)) continue;
    zonesOf.set(l.employee_id, [...(zonesOf.get(l.employee_id) || []), l.wifi_zone_id]);
  }
  // Une zone confiée à plusieurs employés : ses ventes comptent pour chacun d'eux.
  const holders = new Map();
  for (const list of zonesOf.values()) for (const z of list) holders.set(z, (holders.get(z) || 0) + 1);

  return {
    zones,
    employees: employees.map((e) => {
      const zoneIds = (zonesOf.get(e.id) || []).sort((a, b) => zoneNames.get(a).localeCompare(zoneNames.get(b), 'fr'));
      return {
        ...view(e),
        zone_ids: zoneIds,
        shared_zone_ids: zoneIds.filter((z) => holders.get(z) > 1),
        sales: salesOf(zoneIds, rows || [], zoneNames),
      };
    }),
  };
}

// GET /api/vendor/employees?period=today|7d|30d|month (aujourd'hui par défaut)
async function listEmployees(req, res) {
  const period = req.query.period || 'today';
  if (!PERIODS.includes(period)) return res.status(400).json({ error: 'Période inconnue.' });
  const { zones, employees } = await employeesWithSales(req.user.id, period);
  res.json({ employees, zones, period, max: MAX_EMPLOYEES });
}

// PUT /api/vendor/employees/:id/zones { zone_ids: [...] } : remplace les zones confiées à l'employé.
// Liste vide : il revoit toutes les zones du promoteur.
async function setEmployeeZones(req, res) {
  const employee = await ownEmployee(req, req.params.id);
  if (!employee) return res.status(404).json(NOT_FOUND);
  const zoneIds = req.body?.zone_ids;
  if (!Array.isArray(zoneIds) || zoneIds.length > 100 || !zoneIds.every((z) => typeof z === 'string' && UUID_REGEX.test(z))) {
    return res.status(400).json({ error: 'zone_ids doit être une liste de zones.', field: 'zone_ids' });
  }
  // Tout ou rien, dans une seule transaction (migration 011) : une panne au milieu ne doit pas
  // laisser l'employé sans zone, donc avec accès à toutes.
  const wanted = [...new Set(zoneIds.map((z) => z.toLowerCase()))];
  const { data, httpError } = await callRpc('set_employee_zones', { p_vendor_id: req.user.id, p_employee_id: employee.id, p_zone_ids: wanted });
  if (httpError) return sendHttpError(res, httpError);
  res.json({ employee_id: employee.id, zone_ids: data || [] });
}

// POST /api/vendor/employees { full_name, email, phone?, password }
// Le promoteur choisit un mot de passe provisoire et le transmet lui-même à son employé.
async function createEmployee(req, res) {
  const b = req.body || {};
  const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : '';
  if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ error: 'Écris le nom de l’employé.', field: 'full_name' });
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(email) || email.length > 254) return res.status(400).json({ error: 'Cet email semble incomplet. Vérifie-le.', field: 'email' });
  const phone = String(b.phone || '').replace(/[\s.\-()]/g, '');
  if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ error: 'Ce numéro n’est pas valide.', field: 'phone' });
  const passwordError = checkPassword(b.password);
  if (passwordError) return res.status(400).json({ error: passwordError, field: 'password' });

  const { count, error: countError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'employee')
    .eq('employer_id', req.user.id);
  if (countError) throw countError;
  if (count >= MAX_EMPLOYEES) return res.status(409).json({ error: `Tu as déjà ${MAX_EMPLOYEES} employés : c’est le maximum.` });

  const inUse = { error: 'Un compte existe déjà avec cet email.', field: 'email' };
  const { data: existing, error: findError } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (findError) throw findError;
  if (existing) return res.status(409).json(inUse);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(b.password, 12),
      full_name: fullName,
      role: 'employee',
      account_status: 'approved',
      employer_id: req.user.id,
      phone: phone || null,
    })
    .select(COLUMNS)
    .single();
  if (error?.code === '23505') return res.status(409).json(inUse);
  if (error) throw error;
  res.status(201).json({ employee: view(data) });
}

// PATCH /api/vendor/employees/:id/status { active: true | false }
// Désactivé : l'employé perd l'accès dès sa requête suivante (le compte est relu à chaque requête).
async function setEmployeeStatus(req, res) {
  const employee = await ownEmployee(req, req.params.id);
  if (!employee) return res.status(404).json(NOT_FOUND);
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'active doit valoir true ou false.', field: 'active' });

  const { data, error } = await supabase
    .from('users')
    .update({ account_status: req.body.active ? 'approved' : 'suspended' })
    .eq('id', employee.id)
    .eq('employer_id', req.user.id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  res.json({ employee: view(data) });
}

// POST /api/vendor/employees/:id/password { password } : nouveau mot de passe (employé qui l'a oublié).
// Débloque aussi le compte s'il était bloqué après 5 échecs.
async function resetEmployeePassword(req, res) {
  const employee = await ownEmployee(req, req.params.id);
  if (!employee) return res.status(404).json(NOT_FOUND);
  const passwordError = checkPassword(req.body?.password);
  if (passwordError) return res.status(400).json({ error: passwordError, field: 'password' });

  const { error } = await supabase
    .from('users')
    .update({ password_hash: await bcrypt.hash(req.body.password, 12), failed_logins: 0, locked_until: null })
    .eq('id', employee.id)
    .eq('employer_id', req.user.id);
  if (error) throw error;
  res.json({ employee: view(employee) });
}

module.exports = { listEmployees, createEmployee, setEmployeeStatus, resetEmployeePassword, setEmployeeZones, employeesWithSales, PERIODS };
