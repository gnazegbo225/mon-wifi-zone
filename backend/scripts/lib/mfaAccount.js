// Création d'un compte protégé par double authentification (super admin, développeur), ou nouvelle
// double authentification pour un compte existant (téléphone perdu). Utilisé par :
//   scripts/create-super-admin.js et scripts/create-developer.js
// MFA_ENCRYPTION_KEY doit être définie dans .env (la même que sur le serveur).
const bcrypt = require('bcryptjs');
const env = require('../../src/config/env');
const supabase = require('../../src/config/supabase');
const { seal } = require('../../src/utils/secretBox');
const { generateSecret, otpauthUrl } = require('../../src/utils/totp');

const MIN_PASSWORD = 12;

function printMfa(email, secret, issuer) {
  console.log('\nDouble authentification : ajoute ce compte dans Google Authenticator (ou équivalent).');
  console.log('  « + » > « Saisir une clé de configuration » :');
  console.log(`    Nom du compte : ${issuer}`);
  console.log(`    Clé           : ${secret.match(/.{1,4}/g).join(' ')}`);
  console.log('    Type          : basé sur l’heure');
  console.log(`  Ou ouvre ce lien sur le téléphone : ${otpauthUrl({ secret, account: email, issuer })}`);
  console.log('\nCette clé ne sera plus jamais affichée. Ne la partage avec personne.\n');
}

/**
 * @param {{ role: string, envPrefix: string, label: string, defaultName: string, issuerSuffix: string }} options
 *   envPrefix : SUPER_ADMIN → lit SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME.
 */
async function createMfaAccount({ role, envPrefix, label, defaultName, issuerSuffix }) {
  if (!/^[0-9a-f]{64}$/i.test(env.mfaEncryptionKey)) {
    console.error('MFA_ENCRYPTION_KEY manque ou est invalide dans .env (64 caractères hexadécimaux).');
    process.exit(1);
  }

  const issuer = `${env.platformName} ${issuerSuffix}`;
  const email = (process.env[`${envPrefix}_EMAIL`] || '').trim().toLowerCase();
  if (!email) {
    console.error(`${envPrefix}_EMAIL obligatoire.`);
    process.exit(1);
  }

  const { data: existing, error: findError } = await supabase.from('users').select('id, role').eq('email', email).maybeSingle();
  if (findError) throw findError;

  const secret = generateSecret();

  if (process.env.RESET_MFA === '1') {
    if (!existing || existing.role !== role) {
      console.error(`Aucun compte ${label} avec l’adresse ${email}.`);
      process.exit(1);
    }
    const { error } = await supabase
      .from('users')
      .update({ mfa_secret: seal(secret, env.mfaEncryptionKey), mfa_last_step: null, failed_logins: 0, locked_until: null })
      .eq('id', existing.id);
    if (error) throw error;
    console.log(`Nouvelle double authentification pour ${email}. L’ancienne ne marche plus.`);
    printMfa(email, secret, issuer);
    return;
  }

  if (existing) {
    console.error(`Un compte existe déjà pour ${email}. Utilise une autre adresse, dédiée au compte ${label}.`);
    process.exit(1);
  }

  const password = process.env[`${envPrefix}_PASSWORD`] || '';
  if (password.length < MIN_PASSWORD) {
    console.error(`${envPrefix}_PASSWORD obligatoire, ${MIN_PASSWORD} caractères minimum.`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(password, 12),
      full_name: process.env[`${envPrefix}_NAME`] || defaultName,
      role,
      account_status: 'approved',
      mfa_secret: seal(secret, env.mfaEncryptionKey),
    })
    .select('id, email, full_name, role')
    .single();
  if (error) throw error;

  console.log(`Compte ${label} créé :`, data);
  printMfa(email, secret, issuer);
}

function run(options) {
  createMfaAccount(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, createMfaAccount };
