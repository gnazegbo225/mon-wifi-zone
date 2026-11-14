// Espace promoteur : ses employés (/api/vendor/employees).
// Un employé se connecte dans l'espace promoteur et agit dans les zones de son promoteur, avec des
// droits réduits (voir les routes : pas de finances, de forfaits, de portail ni de dossier).
// On ne supprime pas un employé : on le désactive (son historique reste lié à son compte).
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMPLOYEES = 20;
const COLUMNS = 'id, full_name, email, phone, account_status, last_login_at, last_seen_at, created_at';
const NOT_FOUND = { error: 'Employé introuvable.' };
const ONLINE_MS = 5 * 60 * 1000;

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

// GET /api/vendor/employees
async function listEmployees(req, res) {
  const { data, error } = await supabase
    .from('users')
    .select(COLUMNS)
    .eq('role', 'employee')
    .eq('employer_id', req.user.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  res.json({ employees: data.map(view), max: MAX_EMPLOYEES });
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

module.exports = { listEmployees, createEmployee, setEmployeeStatus, resetEmployeePassword };
