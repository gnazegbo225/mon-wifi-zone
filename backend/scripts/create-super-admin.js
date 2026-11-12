// Crée le compte super admin, avec sa double authentification. C'est la SEULE façon de créer ce compte :
// il n'existe aucune inscription super admin, et le frontend ne contient aucune adresse email.
//
// Usage (à lancer depuis backend/, le mot de passe passe par une variable d'environnement) :
//   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... SUPER_ADMIN_NAME="..." node scripts/create-super-admin.js
// Téléphone perdu : régénère le secret de double authentification d'un super admin existant :
//   SUPER_ADMIN_EMAIL=... RESET_MFA=1 node scripts/create-super-admin.js
//
// MFA_ENCRYPTION_KEY doit être définie dans .env (la même que sur le serveur).
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const supabase = require('../src/config/supabase');
const { seal } = require('../src/utils/secretBox');
const { generateSecret, otpauthUrl } = require('../src/utils/totp');

const MIN_PASSWORD = 12;

function printMfa(email, secret) {
  console.log('\nDouble authentification : ajoute ce compte dans Google Authenticator (ou équivalent).');
  console.log('  « + » > « Saisir une clé de configuration » :');
  console.log(`    Nom du compte : ${env.platformName} admin`);
  console.log(`    Clé           : ${secret.match(/.{1,4}/g).join(' ')}`);
  console.log('    Type          : basé sur l’heure');
  console.log(`  Ou ouvre ce lien sur le téléphone : ${otpauthUrl({ secret, account: email, issuer: `${env.platformName} admin` })}`);
  console.log('\nCette clé ne sera plus jamais affichée. Ne la partage avec personne.\n');
}

async function main() {
  if (!/^[0-9a-f]{64}$/i.test(env.mfaEncryptionKey)) {
    console.error('MFA_ENCRYPTION_KEY manque ou est invalide dans .env (64 caractères hexadécimaux).');
    process.exit(1);
  }

  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.error('SUPER_ADMIN_EMAIL obligatoire.');
    process.exit(1);
  }

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();
  if (findError) throw findError;

  const secret = generateSecret();

  if (process.env.RESET_MFA === '1') {
    if (!existing || existing.role !== 'super_admin') {
      console.error(`Aucun super admin avec l’adresse ${email}.`);
      process.exit(1);
    }
    const { error } = await supabase
      .from('users')
      .update({ mfa_secret: seal(secret, env.mfaEncryptionKey), mfa_last_step: null, failed_logins: 0, locked_until: null })
      .eq('id', existing.id);
    if (error) throw error;
    console.log(`Nouvelle double authentification pour ${email}. L’ancienne ne marche plus.`);
    printMfa(email, secret);
    return;
  }

  if (existing) {
    console.error(`Un compte existe déjà pour ${email}. Utilise une autre adresse, dédiée au super admin.`);
    process.exit(1);
  }

  const password = process.env.SUPER_ADMIN_PASSWORD || '';
  if (password.length < MIN_PASSWORD) {
    console.error(`SUPER_ADMIN_PASSWORD obligatoire, ${MIN_PASSWORD} caractères minimum.`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(password, 12),
      full_name: process.env.SUPER_ADMIN_NAME || 'Super admin',
      role: 'super_admin',
      account_status: 'approved',
      mfa_secret: seal(secret, env.mfaEncryptionKey),
    })
    .select('id, email, full_name, role')
    .single();
  if (error) throw error;

  console.log('Compte super admin créé :', data);
  printMfa(email, secret);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
