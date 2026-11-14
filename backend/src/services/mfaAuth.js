// Connexion en deux étapes des espaces protégés par double authentification (super admin, développeur) :
//   1. POST …/auth/login { email, password } -> { mfa_required, mfa_token } (valable 5 minutes)
//   2. POST …/auth/mfa   { mfa_token, code } -> { token, user } (jeton de l'espace, valable 1 h)
// Le mot de passe seul ne donne jamais accès. Les erreurs de code comptent dans le blocage après 5 échecs.
// Ces comptes ne sont créés que par un script (scripts/create-super-admin.js, scripts/create-developer.js).
// Chaque espace a sa propre audience : un jeton, même intermédiaire, d'un espace est refusé par l'autre.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');
const { signToken } = require('../middlewares/auth');
const { changeEmail, checkCredentials, findById, isLocked, registerFailure, registerSuccess, LOCKED_MESSAGE } = require('./accounts');
const { record } = require('./audit');
const { open } = require('../utils/secretBox');
const { verifyCode } = require('../utils/totp');

const MFA_TOKEN_TTL = '5m';

function publicAdmin(user) {
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
}

/**
 * @param {{ space: 'admin'|'dev', role: string, loginAction: string, label: string }} options
 *   label : nom de l'espace dans le message « pas encore configuré ».
 */
function createMfaAuth({ space, role, loginAction, label }) {
  const MFA_AUDIENCE = `${space}-mfa`;

  function configured(res) {
    if (env.adminJwtSecret && env.mfaEncryptionKey) return true;
    console.error(`ADMIN_JWT_SECRET ou MFA_ENCRYPTION_KEY manque : la connexion ${space} est désactivée.`);
    res.status(503).json({ error: `${label} n’est pas encore configuré.` });
    return false;
  }

  // Étape 1 : mot de passe.
  async function login(req, res) {
    if (!configured(res)) return;
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe obligatoires' });
    }

    const result = await checkCredentials(email, password, [role]);
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
    if (!user || user.role !== role || user.account_status !== 'approved') {
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
    await record(req, loginAction, { targetType: 'account', targetId: user.id, actorId: user.id, details: { user_agent: req.get('user-agent') || undefined } });
    res.json({ token: signToken(space, user), user: publicAdmin(user) });
  }

  // GET …/auth/me
  async function me(req, res) {
    res.json({ user: publicAdmin({ id: req.user.id, email: req.user.email, full_name: req.user.fullName, role: req.user.role }) });
  }

  // PUT …/auth/email { new_email, confirm_email, password, code } -> { user }
  // Adresse de connexion : mot de passe actuel ET code de l'application d'authentification.
  async function updateEmail(req, res) {
    if (!configured(res)) return;
    const user = await findById(req.user.id);
    if (isLocked(user)) return res.status(429).json({ error: LOCKED_MESSAGE });

    const b = req.body || {};
    const step = verifyCode(open(user.mfa_secret, env.mfaEncryptionKey), String(b.code || '').replace(/\s/g, ''));
    // 400 et non 401 : la session reste ouverte, c'est seulement une erreur de saisie.
    if (step === null) {
      await registerFailure(user);
      return res.status(400).json({ error: 'Ce code ne marche pas. Vérifie-le et réessaie.', field: 'code' });
    }
    // Le même code ne sert qu'une fois, ici comme à la connexion.
    const { data: claimed, error } = await supabase
      .from('users')
      .update({ mfa_last_step: step })
      .eq('id', user.id)
      .or(`mfa_last_step.is.null,mfa_last_step.lt.${step}`)
      .select('id');
    if (error) throw error;
    if (claimed.length === 0) return res.status(400).json({ error: 'Ce code a déjà servi. Attends le suivant.', field: 'code' });

    const result = await changeEmail(user, { newEmail: b.new_email, confirmEmail: b.confirm_email, password: b.password });
    if (result.status) return res.status(result.status).json({ error: result.error, field: result.field });
    await record(req, 'account.email_change', { targetType: 'account', targetId: user.id, details: { old: user.email, new: result.email } });
    res.json({ user: publicAdmin({ ...user, email: result.email }) });
  }

  return { login, verifyMfa, me, updateEmail };
}

module.exports = { createMfaAuth };
