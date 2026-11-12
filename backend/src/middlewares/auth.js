// Authentification des deux espaces connectés, totalement séparés :
//   espace promoteur (/api/auth, /zones, /pricings, /tickets) : jeton signé avec JWT_SECRET,
//     audience « vendor », pour les rôles vendor (promoteur) et employee (son employé) ;
//   espace super admin (/api/admin) : jeton signé avec ADMIN_JWT_SECRET, audience « admin »,
//     pour le rôle super_admin, délivré seulement après la double authentification.
// Un jeton d'un espace est refusé par l'autre : secret et audience différents.
// À chaque requête, le compte est relu en base : une suspension ou un changement de rôle
// s'applique tout de suite, sans attendre l'expiration du jeton.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');

const SPACES = {
  vendor: { secret: () => env.jwtSecret, expiresIn: () => env.jwtExpiresIn, roles: ['vendor', 'employee'] },
  admin: { secret: () => env.adminJwtSecret, expiresIn: () => env.adminJwtExpiresIn, roles: ['super_admin'] },
};

const SEEN_EVERY_MS = 5 * 60 * 1000; // last_seen_at est mis à jour au plus toutes les 5 minutes.

const ACCOUNT_COLUMNS = 'id, email, full_name, role, account_status, employer_id, country, last_seen_at';

function signToken(space, user) {
  const { secret, expiresIn } = SPACES[space];
  return jwt.sign({ email: user.email, role: user.role }, secret(), {
    subject: user.id,
    audience: space,
    expiresIn: expiresIn(),
    algorithm: 'HS256',
  });
}

// Le compte du jeton, s'il peut encore utiliser cet espace. Un employé suit le statut de son promoteur.
async function loadAccount(space, userId) {
  const { data: user, error } = await supabase.from('users').select(ACCOUNT_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!user || !SPACES[space].roles.includes(user.role) || user.account_status === 'suspended') return null;

  if (user.role === 'employee') {
    const { data: employer, error: employerError } = await supabase
      .from('users')
      .select('account_status')
      .eq('id', user.employer_id)
      .maybeSingle();
    if (employerError) throw employerError;
    if (!employer || employer.account_status === 'suspended') return null;
  }
  return user;
}

// Trace d'activité pour le statut « en ligne », sans ralentir la requête.
function touchLastSeen(user) {
  const last = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
  if (Date.now() - last < SEEN_EVERY_MS) return;
  supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(({ error }) => error && console.error('last_seen_at non mis à jour', user.id, error.message));
}

function authenticate(space) {
  return async (req, res, next) => {
    if (!SPACES[space].secret()) {
      console.error(`Secret de jeton manquant pour l'espace ${space} (voir .env.example).`);
      return res.status(503).json({ error: 'Cet espace n’est pas encore configuré.' });
    }

    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    let payload;
    try {
      // On impose l'algorithme (refuse « none ») et l'audience (refuse le jeton de l'autre espace).
      payload = jwt.verify(token, SPACES[space].secret(), { algorithms: ['HS256'], audience: space });
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Token expiré' : 'Token invalide';
      return res.status(401).json({ error: message });
    }

    const user = await loadAccount(space, payload.sub);
    if (!user) return res.status(401).json({ error: 'Compte introuvable ou suspendu' });

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      accountStatus: user.account_status,
      country: user.country,
      // Propriétaire des zones sur lesquelles ce compte agit : lui-même, ou son promoteur pour un employé.
      ownerId: user.role === 'employee' ? user.employer_id : user.id,
    };
    touchLastSeen(user);
    next();
  };
}

// Espace promoteur : vendor ou employee.
const requireAuth = authenticate('vendor');

// Espace super admin : super_admin, jeton de l'espace admin.
const requireAdmin = authenticate('admin');

// Pour une route publique qui en montre plus à un promoteur connecté.
// Sans en-tête Authorization : on continue sans req.user. Avec un en-tête : il doit être valide.
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return requireAuth(req, res, next);
}

// À placer après requireAuth : limite une route à certains rôles.
// Exemple : router.post('/', requireAuth, requireRole('vendor'), createZone);
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { requireAuth, requireAdmin, optionalAuth, requireRole, signToken, SPACES };
