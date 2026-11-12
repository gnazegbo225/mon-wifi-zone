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

module.exports = { checkCredentials, findById, isLocked, registerFailure, registerSuccess, LOCKED_MESSAGE };
