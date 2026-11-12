// Codes à 6 chiffres de la double authentification (TOTP, RFC 6238), compatibles avec
// Google Authenticator, Microsoft Authenticator, etc. : HMAC-SHA1, un code toutes les 30 secondes.
const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function base32Decode(text) {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Secret base32 invalide');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

// Nouveau secret : 20 octets aléatoires, en base32 (ce que l'application d'authentification attend).
function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(value).padStart(DIGITS, '0');
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Vérifie un code. Accepte le pas courant et ses voisins (±30 s) pour tolérer un léger décalage d'horloge.
 * @returns {number|null} le pas qui correspond (pour refuser qu'un code serve deux fois), ou null.
 */
function verifyCode(secret, code, now = Date.now()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const step = currentStep(now);
  for (const candidate of [step - 1, step, step + 1]) {
    const expected = Buffer.from(codeAt(secret, candidate));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) return candidate;
  }
  return null;
}

// Lien à ouvrir ou à recopier dans l'application d'authentification.
function otpauthUrl({ secret, account, issuer }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}

module.exports = { generateSecret, verifyCode, codeAt, currentStep, otpauthUrl };
