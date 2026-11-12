// Crée un compte promoteur (vendor) déjà approuvé, en Côte d'Ivoire. Utile pour les tests.
// En production, les promoteurs s'inscrivent eux-mêmes et le super admin vérifie leur dossier.
// Usage (le mot de passe passe par une variable d'environnement, jamais dans le code) :
//   VENDOR_EMAIL=... VENDOR_PASSWORD=... VENDOR_NAME="..." node scripts/create-vendor.js
const bcrypt = require('bcryptjs');
const supabase = require('../src/config/supabase');

async function main() {
  const email = (process.env.VENDOR_EMAIL || '').trim().toLowerCase();
  const password = process.env.VENDOR_PASSWORD || '';
  const fullName = process.env.VENDOR_NAME || 'Promoteur';

  if (!email || password.length < 8) {
    console.error('VENDOR_EMAIL obligatoire et VENDOR_PASSWORD d au moins 8 caracteres.');
    process.exit(1);
  }

  const { data: existing, error: findError } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    console.error(`Un compte existe deja pour ${email}.`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(password, 12),
      full_name: fullName,
      role: 'vendor',
      account_status: 'approved',
      country: 'CI',
    })
    .select('id, email, full_name, role, account_status')
    .single();
  if (error) throw error;

  console.log('Compte promoteur cree :', data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
