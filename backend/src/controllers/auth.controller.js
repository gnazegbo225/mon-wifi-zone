// Connexion de l'espace promoteur (rôles vendor et employee).
// Le super admin a sa propre connexion, séparée : voir controllers/admin/auth.controller.js.
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { signToken } = require('../middlewares/auth');
const env = require('../config/env');
const { changeEmail, checkCredentials, findByEmail, findById, registerSuccess, LOCKED_MESSAGE } = require('../services/accounts');
const { consumeToken, countRecent, createToken } = require('../services/accountTokens');
const { sendEmail } = require('../services/email');
const { templates } = require('../services/emailTemplates');
const { notify, sendEmailVerification } = require('../services/notify');

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
    // Adresse confirmée par le lien reçu par email : exigée pour retirer de l'argent.
    email_verified: Boolean(user.email_verified_at),
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
    .select('id, email, full_name, role, account_status, country, email_verified_at')
    .single();
  // 23505 : le même email inscrit au même instant par une autre requête.
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email. Connecte-toi.', field: 'email' });
  }
  if (error) throw error;

  const { error: profileError } = await supabase.from('vendor_profiles').insert({ user_id: user.id, legal_name: fullName });
  if (profileError) throw profileError;

  await registerSuccess(user);
  sendEmailVerification(user.id); // sans attendre : un email raté ne bloque pas l'inscription
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
      email_verified_at: u.emailVerified ? true : null,
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
  // L'ancienne adresse est prévenue ; la nouvelle reçoit son lien de confirmation.
  notify(req.user.id, 'emailChanged', { newEmail: result.email }, { to: account.email });
  sendEmailVerification(req.user.id);
  res.json({
    user: publicUser({
      id: req.user.id,
      email: result.email,
      full_name: req.user.fullName,
      role: req.user.role,
      account_status: req.user.accountStatus,
      country: req.user.country,
      email_verified_at: null,
    }),
  });
}

// --- Mot de passe oublié ------------------------------------------------------

const FORGOT_DONE = {
  ok: true,
  message: 'Si un compte promoteur existe avec cette adresse, tu vas recevoir un email avec un lien. Regarde aussi dans les spams.',
};

// POST /api/auth/password/forgot { email } -> toujours la même réponse (on ne révèle pas quels comptes existent).
// Seuls les promoteurs reçoivent un lien : un employé demande un nouveau mot de passe à son promoteur.
async function forgotPassword(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Cet email semble incomplet. Vérifie-le.', field: 'email' });
  }
  const user = await findByEmail(email);
  if (user && user.role === 'vendor' && user.account_status !== 'suspended') {
    // Sans attendre : la réponse prend le même temps, que le compte existe ou non.
    sendResetLink(user).catch((err) => console.error(`Lien de mot de passe non envoyé au compte ${user.id} :`, err.message));
  }
  res.json(FORGOT_DONE);
}

// 3 liens par heure au plus pour un même compte.
async function sendResetLink(user) {
  if ((await countRecent(user.id, 'password_reset', 60)) >= 3) return;
  const token = await createToken(user.id, 'password_reset');
  const link = `${env.frontendUrl}/mot-de-passe/nouveau?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, ...templates.passwordReset({ name: user.full_name, link }) });
}

// POST /api/auth/password/reset { token, password } : nouveau mot de passe avec le lien reçu.
// Débloque le compte et ferme les sessions ouvertes avec l'ancien mot de passe.
async function resetPassword(req, res) {
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Ton mot de passe doit avoir au moins 8 caractères.', field: 'password' });
  }
  const expired = { error: 'Ce lien ne marche plus : il a déjà servi ou il a expiré. Demande-en un nouveau.', field: 'token' };
  const used = await consumeToken(req.body?.token, 'password_reset');
  if (!used) return res.status(400).json(expired);
  const user = await findById(used.user_id);
  if (!user || user.role !== 'vendor' || user.account_status === 'suspended') return res.status(400).json(expired);

  const { error } = await supabase
    .from('users')
    .update({
      password_hash: await bcrypt.hash(password, 12),
      password_changed_at: new Date().toISOString(),
      failed_logins: 0,
      locked_until: null,
      // Le lien est arrivé dans cette boîte : l'adresse est confirmée du même coup.
      email_verified_at: user.email_verified_at || new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) throw error;
  res.json({ ok: true });
}

// --- Confirmation de l'adresse email ----------------------------------------

// POST /api/auth/email/verify { token } : sans connexion (le lien peut s'ouvrir sur un autre appareil).
async function verifyEmail(req, res) {
  const expired = { error: 'Ce lien ne marche plus : il a déjà servi ou il a expiré. Connecte-toi pour en recevoir un nouveau.' };
  const used = await consumeToken(req.body?.token, 'email_verify');
  if (!used) return res.status(400).json(expired);
  const user = await findById(used.user_id);
  // L'adresse a changé depuis l'envoi du lien : il ne confirme rien.
  if (!user || user.email !== used.email) return res.status(400).json(expired);
  if (!user.email_verified_at) {
    const { error } = await supabase.from('users').update({ email_verified_at: new Date().toISOString() }).eq('id', user.id);
    if (error) throw error;
  }
  res.json({ ok: true, email: user.email });
}

// POST /api/auth/email/verify/resend (connecté) : renvoie le lien, 3 fois par heure au plus.
async function resendVerification(req, res) {
  if (req.user.emailVerified) return res.status(409).json({ error: 'Ton adresse est déjà confirmée.' });
  if ((await countRecent(req.user.id, 'email_verify', 60)) >= 3) {
    return res.status(429).json({ error: 'Tu as déjà demandé plusieurs emails. Attends un peu, et regarde dans tes spams.' });
  }
  const result = await sendEmailVerification(req.user.id);
  if (!result.sent) return res.status(503).json({ error: 'L’email n’a pas pu partir. Réessaie dans quelques minutes.' });
  res.json({ ok: true, email: req.user.email });
}

module.exports = { login, me, register, listCountries, updateEmail, forgotPassword, resetPassword, verifyEmail, resendVerification };
