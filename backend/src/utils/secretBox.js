// Chiffre les secrets stockés en base (ex : secret de double authentification) avec AES-256-GCM.
// La clé (MFA_ENCRYPTION_KEY, 64 caractères hexadécimaux) ne vit que dans l'environnement du serveur :
// une fuite de la base seule ne suffit pas à générer des codes.
const crypto = require('node:crypto');

function keyFrom(hexKey) {
  if (!/^[0-9a-f]{64}$/i.test(hexKey || '')) {
    throw new Error('MFA_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux (32 octets).');
  }
  return Buffer.from(hexKey, 'hex');
}

// Renvoie « iv.tag.chiffré » en base64url.
function seal(plainText, hexKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(hexKey), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64url')).join('.');
}

function open(sealed, hexKey) {
  const [iv, tag, encrypted] = String(sealed).split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(hexKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { seal, open };
