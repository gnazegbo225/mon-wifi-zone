// Connexion de l'espace promoteur (rôles vendor et employee).
// Le super admin a sa propre connexion, séparée : voir controllers/admin/auth.controller.js.
const supabase = require('../config/supabase');
const { signToken } = require('../middlewares/auth');
const { checkCredentials, registerSuccess, LOCKED_MESSAGE } = require('../services/accounts');

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

module.exports = { login, me };
