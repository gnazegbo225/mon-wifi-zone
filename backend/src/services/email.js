// Seul fichier du backend qui envoie des emails (Resend : https://resend.com/docs/api-reference/emails/send-email).
// Un email raté ne fait jamais échouer l'action qui l'a déclenché : il est écrit dans les journaux du serveur.
const env = require('../config/env');

/**
 * @param {{ to: string, subject: string, html: string, text: string }} message
 * @returns {Promise<{ sent: boolean, id?: string, skipped?: string }>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (!env.resendApiKey || !env.emailFrom) {
    console.warn(`Email non envoyé (RESEND_API_KEY ou EMAIL_FROM manque) : « ${subject} » → ${to}`);
    return { sent: false, skipped: 'not_configured' };
  }
  try {
    const response = await fetch(`${env.resendApiUrl}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`Email non envoyé [${response.status}] « ${subject} » → ${to} : ${data?.message || 'réponse inattendue'}`);
      return { sent: false, skipped: 'provider_error' };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error(`Email non envoyé « ${subject} » → ${to} : ${err.message}`);
    return { sent: false, skipped: 'unreachable' };
  }
}

module.exports = { sendEmail };
