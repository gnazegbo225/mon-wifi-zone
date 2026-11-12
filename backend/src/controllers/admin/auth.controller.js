// Connexion de l'espace super admin, en deux étapes :
//   1. POST /api/admin/auth/login { email, password } -> { mfa_required, mfa_token } (valable 5 minutes)
//   2. POST /api/admin/auth/mfa   { mfa_token, code } -> { token, user } (jeton admin, valable 1 h)
// Le mot de passe seul ne donne jamais accès. Les erreurs de code comptent dans le blocage après 5 échecs.
// Le compte n'est créé que par le script scripts/create-super-admin.js, jamais par une inscription.
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const supabase = require('../../config/supabase');
const { signToken } = require('../../middlewares/auth');
const { checkCredentials, findById, isLocked, registerFailure, registerSuccess, LOCKED_MESSAGE } = require('../../services/accounts');
const { open } = require('../../utils/secretBox');
const { verifyCode } = require('../../utils/totp');

const MFA_AUDIENCE = 'admin-mfa';
const MFA_TOKEN_TTL = '5m';

function configured(res) {
  if (env.adminJwtSecret && env.mfaEncryptionKey) return true;
  console.error('ADMIN_JWT_SECRET ou MFA_ENCRYPTION_KEY manque : la connexion super admin est désactivée.');
  res.status(503).json({ error: 'L’espace d’administration n’est pas encore configuré.' });
  return false;
}

function publicAdmin(user) {
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
}

// Étape 1 : mot de passe.
async function login(req, res) {
  if (!configured(res)) return;
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe obligatoires' });
  }

  const result = await checkCredentials(email, password, ['super_admin']);
  if (result.locked) return res.status(429).json({ error: LOCKED_MESSAGE });
  if (result.invalid) return res.status(401).json({ error: 'Identifiants incorrects' });

  const mfaToken = jwt.sign({}, env.adminJwtSecret, {
    subject: result.user.id,
    audience: MFA_AUDIENCE,
    expiresIn: MFA_TOKEN_TTL,
    algorithm: 'HS256',
  });
  res.json({ mfa_required: true, mfa_token: mfaToken });
}

// Étape 2 : code à 6 chiffres de l'application d'authentification.
async function verifyMfa(req, res) {
  if (!configured(res)) return;
  const { mfa_token: mfaToken, code } = req.body || {};

  let payload;
  try {
    payload = jwt.verify(String(mfaToken || ''), env.adminJwtSecret, { algorithms: ['HS256'], audience: MFA_AUDIENCE });
  } catch {
    return res.status(401).json({ error: 'Ta session a expiré. Reconnecte-toi.' });
  }

  const user = await findById(payload.sub);
  if (!user || user.role !== 'super_admin' || user.account_status !== 'approved') {
    return res.status(401).json({ error: 'Ta session a expiré. Reconnecte-toi.' });
  }
  if (isLocked(user)) return res.status(429).json({ error: LOCKED_MESSAGE });

  const step = verifyCode(open(user.mfa_secret, env.mfaEncryptionKey), String(code || '').replace(/\s/g, ''));
  if (step === null) {
    await registerFailure(user);
    return res.status(401).json({ error: 'Ce code ne marche pas. Vérifie-le et réessaie.', field: 'code' });
  }

  // Un code ne sert qu'une fois : on n'accepte qu'un pas plus récent que le dernier utilisé.
  const { data: claimed, error } = await supabase
    .from('users')
    .update({ mfa_last_step: step })
    .eq('id', user.id)
    .or(`mfa_last_step.is.null,mfa_last_step.lt.${step}`)
    .select('id');
  if (error) throw error;
  if (claimed.length === 0) {
    return res.status(401).json({ error: 'Ce code a déjà servi. Attends le suivant.', field: 'code' });
  }

  await registerSuccess(user);
  res.json({ token: signToken('admin', user), user: publicAdmin(user) });
}

// GET /api/admin/auth/me
async function me(req, res) {
  res.json({ user: publicAdmin({ id: req.user.id, email: req.user.email, full_name: req.user.fullName, role: req.user.role }) });
}

module.exports = { login, verifyMfa, me };
