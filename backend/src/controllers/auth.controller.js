const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const env = require('../config/env');

// Hash factice : quand l'email n'existe pas, on fait quand même une comparaison
// pour que la réponse prenne le même temps (on ne révèle pas quels emails existent).
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 10);

// POST /api/auth/login : { email, password } -> { token, user }
async function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe obligatoires' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, role, is_active')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  // Même message dans tous les cas pour ne pas indiquer ce qui est faux.
  if (!user || !passwordOk || !user.is_active) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign({ email: user.email, role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
}

// GET /api/auth/me : renvoie l'utilisateur connecté (route protégée).
async function me(req, res) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) throw error;

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Compte introuvable ou désactivé' });
  }

  res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
}

module.exports = { login, me };
