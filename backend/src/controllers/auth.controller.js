// Connexion de l'espace promoteur (rôles vendor et employee).
// Le super admin a sa propre connexion, séparée : voir controllers/admin/auth.controller.js.
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { signToken } = require('../middlewares/auth');
const { changeEmail, checkCredentials, findById, registerSuccess, LOCKED_MESSAGE } = require('../services/accounts');

const VENDOR_SPACE_ROLES = ['vendor', 'employee'];

// Ce que le frontend reçoit du compte connecté.
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    account_status: user.account_status,
    country: user.country,
  };
}

// POST /api/auth/login : { email, password } -> { token, user }
async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe obligatoires' });
  }

  const result = await checkCredentials(email, password, VENDOR_SPACE_ROLES);
  if (result.locked) return res.status(429).json({ error: LOCKED_MESSAGE });
  if (result.invalid) return res.status(401).json({ error: 'Identifiants incorrects' });

  const { user } = result;

  // Un employé ne peut plus se connecter si son promoteur est suspendu.
  if (user.role === 'employee') {
    const { data: employer, error } = await supabase
      .from('users')
      .select('account_status')
      .eq('id', user.employer_id)
      .maybeSingle();
    if (error) throw error;
    if (!employer || employer.account_status === 'suspended') {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
  }

  await registerSuccess(user);
  res.json({ token: signToken('vendor', user), user: publicUser(user) });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Numéro ivoirien : 10 chiffres, avec ou sans +225 → +225XXXXXXXXXX. Sinon null.
function normalizeCiPhone(value) {
  const digits = String(value || '').replace(/[\s.\-()]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('225') && digits.length === 13 ? digits.slice(3) : digits;
  return /^[0-9]{10}$/.test(local) ? `+225${local}` : null;
}

// GET /api/auth/countries : pays ouverts aux inscriptions.
async function listCountries(req, res) {
  const { data, error } = await supabase.from('countries').select('code, name').eq('is_enabled', true).order('name');
  if (error) throw error;
  res.json({ countries: data });
}

// POST /api/auth/register : { full_name, email, password, phone, country } -> { token, user }
// Le promoteur est créé « en attente de vérification » : il peut préparer ses zones et vendre,
// mais ne pourra retirer son argent qu'après la vérification de son dossier par le super admin.
async function register(req, res) {
  const b = req.body || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  const fullName = text(b.full_name);
  if (fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({ error: 'Écris ton nom complet.', field: 'full_name' });
  }
  const email = text(b.email).toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Cet email semble incomplet. Vérifie-le.', field: 'email' });
  }
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 72) {
    return res.status(400).json({ error: 'Ton mot de passe doit avoir au moins 8 caractères.', field: 'password' });
  }

  const country = text(b.country).toUpperCase();
  const { data: allowed, error: countryError } = await supabase
    .from('countries')
    .select('code')
    .eq('code', country)
    .eq('is_enabled', true)
    .maybeSingle();
  if (countryError) throw countryError;
  if (!allowed) {
    return res.status(400).json({ error: 'La plateforme n’est pas encore ouverte dans ce pays.', field: 'country' });
  }

  const phone = normalizeCiPhone(b.phone);
  if (!phone) {
    return res.status(400).json({ error: 'Ce numéro n’est pas complet. Il faut 10 chiffres.', field: 'phone' });
  }

  const { data: existing, error: findError } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email. Connecte-toi.', field: 'email' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(b.password, 12),
      full_name: fullName,
      role: 'vendor',
      account_status: 'pending_review',
      country,
      phone,
    })
    .select('id, email, full_name, role, account_status, country')
    .single();
  // 23505 : le même email inscrit au même instant par une autre requête.
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email. Connecte-toi.', field: 'email' });
  }
  if (error) throw error;

  const { error: profileError } = await supabase.from('vendor_profiles').insert({ user_id: user.id, legal_name: fullName });
  if (profileError) throw profileError;

  await registerSuccess(user);
  res.status(201).json({ token: signToken('vendor', user), user: publicUser(user) });
}

// GET /api/auth/me : le compte connecté (relu en base par requireAuth).
async function me(req, res) {
  const u = req.user;
  res.json({
    user: publicUser({
      id: u.id,
      email: u.email,
      full_name: u.fullName,
      role: u.role,
      account_status: u.accountStatus,
      country: u.country,
    }),
  });
}

// PUT /api/auth/email { new_email, confirm_email, password } -> { user }
// Change l'adresse de connexion du compte connecté, après vérification de son mot de passe actuel.
async function updateEmail(req, res) {
  const account = await findById(req.user.id);
  const b = req.body || {};
  const result = await changeEmail(account, { newEmail: b.new_email, confirmEmail: b.confirm_email, password: b.password });
  if (result.status) return res.status(result.status).json({ error: result.error, field: result.field });
  res.json({
    user: publicUser({
      id: req.user.id,
      email: result.email,
      full_name: req.user.fullName,
      role: req.user.role,
      account_status: req.user.accountStatus,
      country: req.user.country,
    }),
  });
}

module.exports = { login, me, register, listCountries, updateEmail };
