// Liste blanche (walled garden) du hotspot MikroTik : les sites que le client doit pouvoir ouvrir
// AVANT d'être connecté, pour acheter un ticket. Tout le reste reste bloqué.
//
// Domaines relevés sur une vraie page de paiement Moneroo (checkout.moneroo.io) :
// statistiques (Clarity, Bing, Sentry) volontairement absentes, la page marche sans elles.
// Si un paiement bloque, regarde dans Winbox > IP > Hotspot > Hosts quel site manque, puis ajoute-le ici.

// Groupes fixes : [nom affiché dans le commentaire MikroTik, domaines exacts].
// Les domaines exacts vont dans « walled-garden ip » (indispensable pour le HTTPS) ;
// un « *.domaine » couvre en plus tous ses sous-domaines dans « walled-garden » (HTTP).
export const PAYMENT_HOSTS = [
  ['Moneroo', ['checkout.moneroo.io', 'api.moneroo.io', 'js.moneroo.io', 'assets.cdn.moneroo.io', 'cdn.axazara.com'], ['*.moneroo.io']],
  // Passerelle utilisée par Moneroo en mode live.
  ['FedaPay', ['process.fedapay.com', 'checkout.fedapay.com', 'api.fedapay.com', 'cdn.fedapay.com'], ['*.fedapay.com']],
  // Wave passe par Internet (page ou appli Wave) ; Orange, MTN et Moov passent par le réseau mobile (USSD).
  ['Wave', ['pay.wave.com', 'api.wave.com', 'wave.com'], ['*.wave.com']],
];

const TAG = 'monwifizone';

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// monwifizone.org ⇄ www.monwifizone.org : le site redirige de l'un vers l'autre, il faut les deux.
function withWww(host) {
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host === 'localhost') return host ? [host] : [];
  return host.startsWith('www.') ? [host.slice(4), host] : [host, `www.${host}`];
}

// Groupes de la plateforme (site + API) suivis des moyens de paiement.
export function walledGardenGroups({ frontendUrl, apiUrl }) {
  const site = withWww(hostOf(frontendUrl));
  const api = [hostOf(apiUrl)].filter(Boolean);
  return [
    ['Site monwifizone', site, []],
    ['API monwifizone', api.filter((h) => !site.includes(h)), []],
    ...PAYMENT_HOSTS,
  ].filter(([, hosts]) => hosts.length > 0);
}

/**
 * Script à coller dans le terminal MikroTik (RouterOS v6 et v7).
 * Il efface d'abord les anciennes lignes « monwifizone », puis les recrée : on peut le relancer sans doublon.
 */
export function buildWalledGardenScript({ frontendUrl, apiUrl, zoneName }) {
  const groups = walledGardenGroups({ frontendUrl, apiUrl });
  const lines = [
    `# Liste blanche du hotspot pour l'achat de tickets monwifizone${zoneName ? ` — zone ${zoneName}` : ''}`,
    '# A coller dans Winbox > New Terminal. Peut etre relance sans creer de doublon.',
    '',
    `/ip hotspot walled-garden remove [find where comment~"^${TAG}"]`,
    `/ip hotspot walled-garden ip remove [find where comment~"^${TAG}"]`,
    '',
    '# Sites ouverts en HTTPS (indispensable)',
    '/ip hotspot walled-garden ip',
  ];
  for (const [name, hosts] of groups) {
    for (const host of hosts) lines.push(`add action=accept dst-host=${host} comment="${TAG} - ${name}"`);
  }
  lines.push('', '# Sous-domaines (pages en HTTP et redirections)', '/ip hotspot walled-garden');
  for (const [name, hosts, wildcards] of groups) {
    for (const host of wildcards.length > 0 ? wildcards : hosts) lines.push(`add dst-host=${host} comment="${TAG} - ${name}"`);
  }
  lines.push('');
  return lines.join('\n');
}
