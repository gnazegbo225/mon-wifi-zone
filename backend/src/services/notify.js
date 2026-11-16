// Emails envoyés aux comptes : confirmation d'adresse, et notifications des promoteurs (dossier, suspension,
// retraits). Toujours « sans risque » : une erreur est écrite dans les journaux, jamais renvoyée à l'appelant.
const supabase = require('../config/supabase');
const env = require('../config/env');
const { sendEmail } = require('./email');
const { templates } = require('./emailTemplates');
const { createToken } = require('./accountTokens');

// Adresse et nom d'un compte (pour un promoteur : le nom de sa CNI s'il l'a donné).
async function recipient(userId) {
  const [{ data: user, error }, { data: profile }] = await Promise.all([
    supabase.from('users').select('id, email, full_name, role').eq('id', userId).maybeSingle(),
    supabase.from('vendor_profiles').select('legal_name').eq('user_id', userId).maybeSingle(),
  ]);
  if (error) throw error;
  return user ? { ...user, name: profile?.legal_name || user.full_name } : null;
}

/**
 * Envoie l'email `template` au compte. Ne lève jamais d'erreur.
 * @param {string} userId
 * @param {keyof templates} template
 * @param {object} data champs du modèle (le nom est ajouté ici)
 * @param {{ to?: string }} options autre adresse (ex : l'ancienne adresse après un changement)
 */
async function notify(userId, template, data = {}, { to } = {}) {
  try {
    const user = await recipient(userId);
    if (!user) return { sent: false, skipped: 'no_user' };
    const message = templates[template]({ name: user.name, ...data });
    return await sendEmail({ to: to || user.email, ...message });
  } catch (err) {
    console.error(`Email « ${template} » non envoyé au compte ${userId} :`, err.message);
    return { sent: false, skipped: 'error' };
  }
}

// Envoie le lien de confirmation de l'adresse actuelle du compte. Ne lève jamais d'erreur.
async function sendEmailVerification(userId) {
  try {
    const user = await recipient(userId);
    if (!user) return { sent: false, skipped: 'no_user' };
    const token = await createToken(user.id, 'email_verify', user.email);
    const link = `${env.frontendUrl}/email/confirmer?token=${encodeURIComponent(token)}`;
    return await sendEmail({ to: user.email, ...templates.verifyEmail({ name: user.name, link }) });
  } catch (err) {
    console.error(`Email de confirmation non envoyé au compte ${userId} :`, err.message);
    return { sent: false, skipped: 'error' };
  }
}

module.exports = { notify, sendEmailVerification };
