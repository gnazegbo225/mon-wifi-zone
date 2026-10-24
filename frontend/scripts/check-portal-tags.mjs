// Vérifie que le portail généré garde tout ce dont MikroTik a besoin.
// Usage (depuis frontend/) : node scripts/check-portal-tags.mjs
//
// - chaque balise $(...) des modèles de hotspot/reference/ est conservée (au moins autant de fois) ;
// - le bloc CHAP et la référence à /md5.js sont identiques au caractère près ;
// - aucune ressource externe (feuille de style, police, image, script hébergé) ;
// - un texte saisi contenant « $( » ne devient jamais une balise.
import fs from 'node:fs';
import { buildLoginHtml, buildRloginHtml, mikrotikTags } from '../src/portal/templates.js';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✕'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const count = (list) => list.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());

function compareTags(name, reference, generated) {
  const ref = count(mikrotikTags(reference));
  const gen = count(mikrotikTags(generated));
  const missing = [...ref].filter(([tag, n]) => (gen.get(tag) || 0) < n).map(([tag]) => tag);
  const added = [...gen].filter(([tag]) => !ref.has(tag)).map(([tag]) => tag);
  check(`${name} : toutes les balises du modèle sont conservées`, missing.length === 0, missing.join(' '));
  check(`${name} : aucune balise inventée`, added.length === 0, added.join(' '));
  console.log(`  Balises conservées (${ref.size} différentes) :`);
  for (const [tag, n] of ref) console.log(`    ${tag}  ×${n} dans le modèle, ×${gen.get(tag) || 0} généré`);
}

const options = {
  logoSvg: read('brand/logo-v2.svg'),
  zoneName: 'MONWIFIZONE JM',
  buyUrl: 'https://monwifizone.org/buy/00000000-0000-0000-0000-000000000000',
  retrieveUrl: 'https://monwifizone.org/retrieve/00000000-0000-0000-0000-000000000000',
  supportPhone: '+2250709179694',
};

// --- login.html ---------------------------------------------------------------
const refLogin = read('hotspot/reference/login.html');
const login = buildLoginHtml(options);
compareTags('login.html', refLogin, login);

const chapBlock = refLogin.slice(refLogin.indexOf('$(if chap-id)\n'), refLogin.indexOf('$(endif)\n') + '$(endif)'.length);
check('login.html : bloc CHAP identique au modèle', login.includes(chapBlock));
check('login.html : référence à /md5.js', login.includes('<script src="/md5.js"></script>'));
check(
  'login.html : formulaire avec onSubmit CHAP identique',
  login.includes('<form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif)>'),
);

// Aucune ressource externe : seuls les deux boutons pointent vers l'extérieur (ce sont des liens, pas des ressources).
const externalRefs = (login.match(/(?:src|href)="(?:https?:)?\/\/[^"]*"/g) || []).filter(
  (ref) => !ref.includes(options.buyUrl) && !ref.includes(options.retrieveUrl),
);
check('login.html : aucune ressource externe', externalRefs.length === 0, externalRefs.join(' '));
// url(#…) est une référence interne au SVG du logo (son masque), pas un fichier à charger.
check('login.html : ni <link>, ni @import, ni url() externe, ni image', !/<link\b|@import|url\((?!#)|<img\b/i.test(login));
check('login.html : logo SVG intégré', /<svg class="logo"[\s\S]*<\/svg>/.test(login));
check('login.html : police système uniquement', /font-family: system-ui/.test(login) && !/font-face/i.test(login));

// Texte piégé : un nom de zone « $(error) » ne doit pas créer de balise.
const trapped = buildLoginHtml({ ...options, zoneName: 'Piège $(error) <b>', supportPhone: '0707070707' });
check(
  'login.html : texte saisi neutralisé (« $( » et HTML échappés)',
  mikrotikTags(trapped).length === mikrotikTags(login).length && trapped.includes('Piège &#36;(error) &lt;b&gt;'),
);

// --- rlogin.html --------------------------------------------------------------
const refRlogin = read('hotspot/reference/rlogin.html');
const rlogin = buildRloginHtml();
compareTags('rlogin.html', refRlogin, rlogin);
const refHead = refRlogin.slice(0, refRlogin.indexOf('<meta http-equiv="expires" content="-1">'));
check('rlogin.html : en-tête WISPr et redirection identiques au modèle', rlogin.startsWith(refHead));

console.log(failures === 0 ? '\nRÉSULTAT : tout est bon.' : `\nRÉSULTAT : ${failures} vérification(s) en échec.`);
process.exitCode = failures === 0 ? 0 : 1;
