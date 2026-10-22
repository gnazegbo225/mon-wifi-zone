// Crée un compte administrateur dans la table users.
// Usage (le mot de passe passe par une variable d'environnement, jamais dans le code) :
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." node scripts/create-admin.js
const bcrypt = require('bcryptjs');
const supabase = require('../src/config/supabase');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const fullName = process.env.ADMIN_NAME || 'Administrateur';

  if (!email || password.length < 8) {
    console.error('ADMIN_EMAIL obligatoire et ADMIN_PASSWORD d au moins 8 caracteres.');
    process.exit(1);
  }

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    console.error(`Un compte existe deja pour ${email}.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('users')
    .insert({ email, password_hash: passwordHash, full_name: fullName, role: 'admin' })
    .select('id, email, full_name, role')
    .single();

  if (error) throw error;

  console.log('Compte admin cree :', data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
