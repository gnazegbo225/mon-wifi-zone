// Liens à usage unique envoyés par email (migration 013) : nouveau mot de passe, confirmation d'adresse.
// Le lien contient 32 octets aléatoires ; la base ne garde que leur empreinte SHA-256.
const crypto = require('node:crypto');
const supabase = require('../config/supabase');

const TTL_MINUTES = { password_reset: 30, email_verify: 3 * 24 * 60 };

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Crée un lien pour ce compte. Les liens précédents du même type, encore valables, sont annulés.
 * @returns {Promise<string>} le jeton à mettre dans le lien (jamais stocké en clair)
 */
async function createToken(userId, purpose, email = null) {
  const now = new Date().toISOString();
  const { error: revokeError } = await supabase
    .from('account_tokens')
    .update({ used_at: now })
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null);
  if (revokeError) throw revokeError;

  const token = crypto.randomBytes(32).toString('base64url');
  const { error } = await supabase.from('account_tokens').insert({
    user_id: userId,
    purpose,
    token_hash: hash(token),
    email,
    expires_at: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

/**
 * Utilise un lien : le marque comme utilisé, en une seule requête (deux clics simultanés : un seul gagne).
 * @returns {Promise<{ user_id, email } | null>} null si le lien est inconnu, expiré ou déjà utilisé
 */
async function consumeToken(token, purpose) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{30,100}$/.test(token)) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('account_tokens')
    .update({ used_at: now })
    .eq('token_hash', hash(token))
    .eq('purpose', purpose)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('user_id, email');
  if (error) throw error;
  return data[0] || null;
}

// Liens créés pour ce compte depuis `minutes` minutes (limite les envois répétés).
async function countRecent(userId, purpose, minutes) {
  const { count, error } = await supabase
    .from('account_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .gte('created_at', new Date(Date.now() - minutes * 60 * 1000).toISOString());
  if (error) throw error;
  return count || 0;
}

module.exports = { createToken, consumeToken, countRecent };
