// Client Supabase côté serveur, avec la clé service_role.
// Cette clé passe outre la Row Level Security : elle ne doit JAMAIS aller au navigateur.
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
