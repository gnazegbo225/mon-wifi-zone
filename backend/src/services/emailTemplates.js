// Contenu des emails envoyés aux promoteurs : sobre, en tutoiement comme l'application, avec une version
// texte pour les messageries qui n'affichent pas le HTML. Tout texte venant d'un utilisateur est échappé.
const env = require('../config/env');

const BRAND = '#0f2a5c';
const ACCENT = '#ff8a00';
const MUTED = '#5b6475';
const LINE = '#dfe3ea';

const METHOD_LABEL = { wave_ci: 'Wave', orange_ci: 'Orange Money', mtn_ci: 'MTN MoMo', bank_transfer: 'virement bancaire' };

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const price = (n) => `${Number(n).toLocaleString('fr-FR').replace(/ /g, ' ')} F`;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const appLink = (path) => `${env.frontendUrl}${path}`;

/**
 * Mise en page commune. Chaque bloc de `lines` est un paragraphe de texte brut (échappé ici).
 * @param {{ title: string, name?: string, lines: string[], button?: { label: string, url: string }, footer?: string }} content
 * @returns {{ html: string, text: string }}
 */
function layout({ title, name, lines, button, footer }) {
  const hello = name ? `Bonjour ${firstName(name)},` : 'Bonjour,';
  const paragraphs = [hello, ...lines]
    .map((l) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1a2233;">${escapeHtml(l)}</p>`)
    .join('');
  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:14px;background:${ACCENT};">
         <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;color:${BRAND};text-decoration:none;">${escapeHtml(button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${MUTED};">Le bouton ne marche pas ? Copie ce lien dans ton navigateur :<br><span style="word-break:break-all;">${escapeHtml(button.url)}</span></p>`
    : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:24px;">
      <tr><td style="padding:32px 28px 8px;">
        <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:${BRAND};">monwifi<span style="color:${ACCENT};">zone</span></p>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;color:${BRAND};">${escapeHtml(title)}</h1>
        ${paragraphs}${cta}
      </td></tr>
      <tr><td style="padding:16px 28px 28px;border-top:1px solid ${LINE};font-size:13px;line-height:20px;color:${MUTED};">
        ${escapeHtml(footer || 'Tu reçois cet email parce que tu as un compte promoteur sur monwifizone.')}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = [title, '', hello, '', ...lines.flatMap((l) => [l, '']), ...(button ? [`${button.label} : ${button.url}`, ''] : []), footer || 'Tu reçois cet email parce que tu as un compte promoteur sur monwifizone.'].join('\n');
  return { html, text };
}

const templates = {
  passwordReset: ({ name, link }) => ({
    subject: 'Choisis un nouveau mot de passe',
    ...layout({
      title: 'Nouveau mot de passe',
      name,
      lines: ['Tu as demandé à changer ton mot de passe monwifizone. Le lien ci-dessous marche une seule fois, pendant 30 minutes.'],
      button: { label: 'Choisir un nouveau mot de passe', url: link },
      footer: 'Tu n’as rien demandé ? Ignore cet email : ton mot de passe ne change pas.',
    }),
  }),

  verifyEmail: ({ name, link }) => ({
    subject: 'Confirme ton adresse email',
    ...layout({
      title: 'Confirme ton adresse email',
      name,
      lines: ['Un clic suffit pour confirmer que cette adresse est bien la tienne. Elle est nécessaire pour retirer ton argent.', 'Le lien marche pendant 3 jours.'],
      button: { label: 'Confirmer mon adresse', url: link },
      footer: 'Tu n’as pas créé de compte monwifizone ? Ignore cet email.',
    }),
  }),

  emailChanged: ({ name, newEmail }) => ({
    subject: 'Ton adresse de connexion a changé',
    ...layout({
      title: 'Ton adresse de connexion a changé',
      name,
      lines: [
        `Ton compte monwifizone se connecte maintenant avec l’adresse ${newEmail}. Cette adresse-ci ne recevra plus nos emails.`,
        'Si ce n’est pas toi, réponds vite à cet email ou contacte le support : quelqu’un connaît peut-être ton mot de passe.',
      ],
    }),
  }),

  vendorApproved: ({ name }) => ({
    subject: 'Ton compte est vérifié',
    ...layout({
      title: 'Ton compte est vérifié',
      name,
      lines: ['Bonne nouvelle : ton dossier est validé. Tu peux maintenant retirer l’argent de tes ventes, vers ton compte de retrait.'],
      button: { label: 'Voir mes finances', url: appLink('/espace/finances') },
    }),
  }),

  vendorRejected: ({ name, reason }) => ({
    subject: 'Ton dossier doit être corrigé',
    ...layout({
      title: 'Ton dossier doit être corrigé',
      name,
      lines: [`Nous n’avons pas pu valider ton dossier. Motif : ${reason}`, 'Corrige-le dans Mon compte, puis envoie-le à nouveau. Tes ventes continuent pendant ce temps.'],
      button: { label: 'Corriger mon dossier', url: appLink('/espace/compte') },
    }),
  }),

  vendorSuspended: ({ name, reason }) => ({
    subject: 'Ton compte est suspendu',
    ...layout({
      title: 'Ton compte est suspendu',
      name,
      lines: [`Ton compte promoteur et ceux de tes employés sont suspendus. Motif : ${reason}`, 'Pour en parler, réponds à cet email.'],
    }),
  }),

  vendorReactivated: ({ name }) => ({
    subject: 'Ton compte est de nouveau actif',
    ...layout({
      title: 'Ton compte est de nouveau actif',
      name,
      lines: ['Ton compte promoteur est réactivé. Toi et tes employés pouvez de nouveau vous connecter.'],
      button: { label: 'Me connecter', url: appLink('/connexion') },
    }),
  }),

  withdrawalPaid: ({ name, amount, method, reference }) => ({
    subject: `Ton retrait de ${price(amount)} est payé`,
    ...layout({
      title: `Retrait de ${price(amount)} payé`,
      name,
      lines: [
        `Nous avons envoyé ${price(amount)} par ${METHOD_LABEL[method] || method} vers ton compte de retrait.`,
        `Référence du transfert : ${reference}. Garde-la si tu dois nous contacter.`,
      ],
      button: { label: 'Voir mes finances', url: appLink('/espace/finances') },
    }),
  }),

  withdrawalRejected: ({ name, amount, reason }) => ({
    subject: `Ton retrait de ${price(amount)} n’a pas été accepté`,
    ...layout({
      title: 'Retrait non accepté',
      name,
      lines: [`Ta demande de retrait de ${price(amount)} n’a pas été acceptée. Motif : ${reason}`, 'Le montant est revenu dans ton solde disponible.'],
      button: { label: 'Voir mes finances', url: appLink('/espace/finances') },
    }),
  }),
};

module.exports = { templates, escapeHtml };
