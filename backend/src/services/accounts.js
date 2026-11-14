// Vérification des identifiants, commune à l'espace promoteur et à l'espace super admin.
// Après 5 échecs (mot de passe ou code de double authentification), le compte est bloqué 15 minutes.
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// Hash factice : quand l'email n'existe pas, on compare quand même, pour que la réponse prenne
// le même temps (on ne révèle pas quels emails existent).
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 10);

const LOGIN_COLUMNS =
  'id, email, password_hash, full_name, role, account_status, employer_id, country, failed_logins, locked_until, mfa_secret, mfa_last_step';

function isLocked(user, now = new Date()) {
  return Boolean(user?.locked_until && new Date(user.locked_until) > now);
}

async function findByEmail(email) {
  const { data, error } = await supabase.from('users').select(LOGIN_COLUMNS).eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('users').select(LOGIN_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Un échec de plus ; au 5e, le compte est bloqué et le compteur repart à zéro.
async function registerFailure(user) {
  const failed = (user.failed_logins || 0) + 1;
  const update =
    failed >= MAX_FAILED_LOGINS
      ? { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() }
      : { failed_logins: failed };
  const { error } = await supabase.from('users').update(update).eq('id', user.id);
  if (error) console.error('Échec de connexion non enregistré', user.id, error.message);
}

// Connexion réussie : compteur remis à zéro, date de connexion enregistrée.
async function registerSuccess(user) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({ failed_logins: 0, locked_until: null, last_login_at: now, last_seen_at: now })
    .eq('id', user.id);
  if (error) console.error('Connexion non enregistrée', user.id, error.message);
}

/**
 * Vérifie email + mot de passe pour un espace.
 * @param {string[]} roles rôles admis dans cet espace
 * @returns {Promise<{ user } | { locked: true } | { invalid: true }>}
 *   invalid : même réponse que l'email soit inconnu, le mot de passe faux, le rôle d'un autre espace
 *   ou le compte suspendu (on ne révèle pas ce qui ne va pas).
 */
async function checkCredentials(email, password, roles) {
  const user = await findByEmail(email.trim().toLowerCase());
  if (isLocked(user)) return { locked: true };

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    if (user) await registerFailure(user);
    return { invalid: true };
  }
  if (!roles.includes(user.role) || user.account_status === 'suspended') return { invalid: true };
  return { user };
}

const LOCKED_MESSAGE = `Trop d’essais. Réessaie dans ${LOCK_MINUTES} minutes.`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change l'adresse de connexion d'un compte, après avoir vérifié son mot de passe actuel.
 * Un mauvais mot de passe compte dans le blocage après 5 échecs.
 * @param {object} user ligne complète du compte (findById)
 * @returns {Promise<{ email } | { status, error, field }>}
 */
async function changeEmail(user, { newEmail, confirmEmail, password }) {
  const email = String(newEmail || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return { status: 400, error: 'Cette adresse email semble incomplète. Vérifie-la.', field: 'new_email' };
  }
  if (email !== String(confirmEmail || '').trim().toLowerCase()) {
    return { status: 400, error: 'Les deux adresses ne sont pas identiques.', field: 'confirm_email' };
  }
  if (email === user.email) {
    return { status: 400, error: 'C’est déjà ton adresse actuelle.', field: 'new_email' };
  }
  if (isLocked(user)) return { status: 429, error: LOCKED_MESSAGE, field: null };
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
    await registerFailure(user);
    // 400 et non 401 : le compte reste connecté, c'est seulement une erreur de saisie.
    return { status: 400, error: 'Ce mot de passe ne marche pas.', field: 'password' };
  }

  const { data: taken, error: findError } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (findError) throw findError;
  const inUse = { status: 409, error: 'Cette adresse est déjà utilisée par un autre compte.', field: 'new_email' };
  if (taken) return inUse;

  const { error } = await supabase.from('users').update({ email, failed_logins: 0 }).eq('id', user.id);
  if (error?.code === '23505') return inUse; // prise au même instant par une autre requête
  if (error) throw error;
  console.log(`Adresse de connexion changée pour le compte ${user.id} (${user.role}) : ${user.email} → ${email}`);
  return { email };
}

module.exports = { checkCredentials, findById, isLocked, registerFailure, registerSuccess, changeEmail, LOCKED_MESSAGE };
