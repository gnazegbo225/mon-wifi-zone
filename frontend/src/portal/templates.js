// Génère les fichiers du portail captif MikroTik (login.html et rlogin.html),
// à partir des modèles de hotspot/reference/ et de la charte (brand/).
//
// Règles :
// - Toutes les balises $(...) de MikroTik, le bloc CHAP et /md5.js sont gardés à l'identique.
// - Aucune ressource externe : police du téléphone, CSS et logo SVG intégrés au fichier.
//   (Sur le portail, le client n'a pas encore Internet.)
// - Les textes saisis par l'admin sont échappés, et leurs « $ » neutralisés pour que
//   MikroTik ne les prenne jamais pour une balise.
//
// Module sans dépendance (ni React, ni Vite) : il est aussi utilisé par
// scripts/check-portal-tags.mjs pour vérifier les balises.

// Couleurs de brand/charte.md.
const COLORS = {
  brand: '#0F2A5C',
  accent: '#FF8A00',
  page: '#F7F8FA',
  ink: '#1A2233',
  muted: '#5B6475',
  line: '#DFE3EA',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
};

export function escapeForPortal(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\$/g, '&#36;');
}

// « 0707070707 » → « 07 07 07 07 07 » ; « +2250707070707 » → « +225 07 07 07 07 07 ».
function displayPhone(phone) {
  const pairs = (digits) => digits.replace(/(\d{2})(?=\d)/g, '$1 ');
  return phone.startsWith('+') ? `+${phone.slice(1, 4)} ${pairs(phone.slice(4))}` : pairs(phone);
}

// Le logo de brand/ (SVG) devient une balise <svg> intégrée, avec une classe pour la taille.
function inlineLogo(svg) {
  return svg
    .replace(/<\?xml[^>]*>\s*/i, '')
    .trim()
    .replace(/<svg\b/, '<svg class="logo"');
}

/**
 * @param {object} options
 * @param {string} options.logoSvg       contenu de brand/logo-v2.svg
 * @param {string} options.zoneName      nom de la zone (affiché sous le titre)
 * @param {string} options.buyUrl        lien « Acheter un ticket »
 * @param {string} options.retrieveUrl   lien « Récupérer mon ticket »
 * @param {string} options.supportPhone  numéro d'assistance, chiffres avec + en option
 */
export function buildLoginHtml({ logoSvg, zoneName, buyUrl, retrieveUrl, supportPhone }) {
  const c = COLORS;
  const zone = escapeForPortal(zoneName);
  const buy = escapeForPortal(buyUrl);
  const retrieve = escapeForPortal(retrieveUrl);
  const phoneHref = escapeForPortal(supportPhone);
  const phoneText = escapeForPortal(displayPhone(supportPhone));

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${c.page}" />
    <title>${zone} - Connexion WiFi</title>
    <style>
        /* Police du téléphone uniquement : le client n'a pas encore Internet. */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }

        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
            background: ${c.page};
            color: ${c.ink};
            font-size: 16px;
            line-height: 1.5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color-scheme: light;
        }

        .ie-fixMinHeight { flex: 1; display: flex; align-items: flex-start; justify-content: center; width: 100%; }
        .main { width: 100%; display: flex; flex-direction: column; align-items: center; padding: 24px 16px; }

        .logo { display: block; height: 40px; width: auto; margin: 0 auto 20px; }

        .wrap {
            width: 100%;
            max-width: 400px;
            background: #FFFFFF;
            border: 1px solid ${c.line};
            border-radius: 16px;
            padding: 24px 20px;
        }

        h1 { font-size: 24px; font-weight: 700; color: ${c.brand}; text-align: center; line-height: 1.3; }
        .zone { text-align: center; color: ${c.muted}; font-size: 14px; margin-top: 4px; margin-bottom: 16px; }

        .info { text-align: center; color: ${c.ink}; font-size: 16px; margin-bottom: 20px; }
        .info a { color: ${c.brand}; font-weight: 700; }

        /* Erreur : couleur + icône, jamais la couleur seule (charte). */
        .info.alert {
            background: ${c.dangerSoft};
            color: ${c.danger};
            border-radius: 12px;
            padding: 12px 14px;
            text-align: left;
        }
        .info.alert::before { content: "\\2715\\00a0\\00a0"; font-weight: 700; }

        .wifi-container { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }

        .wifi-button {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 48px;
            padding: 12px 16px;
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            text-decoration: none;
            border-radius: 999px;
        }

        /* Bouton orange : texte bleu nuit, jamais blanc (contraste, charte). */
        .wifi-button-primary { background: ${c.accent}; color: ${c.brand}; }
        .wifi-button-secondary { background: #FFFFFF; border: 2px solid ${c.brand}; color: ${c.brand}; }

        .sep {
            display: flex; align-items: center; gap: 10px;
            color: ${c.muted}; font-size: 14px; margin-bottom: 14px;
        }
        .sep::before, .sep::after { content: ""; flex: 1; height: 1px; background: ${c.line}; }

        label { display: block; position: relative; margin-bottom: 12px; }
        label img.ico { display: none; }

        input[type="text"], input[type="password"] {
            width: 100%;
            min-height: 48px;
            padding: 12px 14px;
            border: 1px solid ${c.line};
            border-radius: 12px;
            font-size: 16px; /* 16px minimum : évite le zoom auto sur iOS */
            font-family: inherit;
            color: ${c.ink};
            background: ${c.page};
        }
        input[type="text"]:focus, input[type="password"]:focus {
            outline: none; border-color: ${c.brand}; background: #FFFFFF;
        }

        input[type="submit"] {
            width: 100%;
            min-height: 48px;
            padding: 12px;
            background: ${c.brand};
            color: #FFFFFF;
            border: none;
            border-radius: 999px;
            font-size: 16px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            margin-top: 4px;
            -webkit-appearance: none;
            appearance: none;
        }

        .help { margin-top: 20px; text-align: center; font-size: 14px; color: ${c.muted}; }
        .help a { color: ${c.brand}; font-weight: 700; text-decoration: none; white-space: nowrap; }
    </style>
</head>
<body>
    $(if chap-id)
    <form name="sendin" action="$(link-login-only)" method="post" style="display:none">
        <input type="hidden" name="username" />
        <input type="hidden" name="password" />
        <input type="hidden" name="dst" value="$(link-orig)" />
        <input type="hidden" name="popup" value="true" />
    </form>
    <script src="/md5.js"></script>
    <script>
        function doLogin() {
            document.sendin.username.value = document.login.username.value;
            document.sendin.password.value = hexMD5('$(chap-id)' + document.login.password.value + '$(chap-challenge)');
            document.sendin.submit();
            return false;
        }
    </script>
    $(endif)
    <div class="ie-fixMinHeight">
        <div class="main">
            ${inlineLogo(logoSvg)}
            <div class="wrap">
                <form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif)>
                    <input type="hidden" name="dst" value="$(link-orig)" />
                    <input type="hidden" name="popup" value="true" />
                    <h1>Bienvenue sur monwifizone</h1>
                    <p class="zone">${zone}</p>
                    <p class="info $(if error)alert$(endif)">
                        $(if error == "")Internet rapide, payé en Mobile Money. $(if trial == 'yes')<br />Essai gratuit disponible : <a href="$(link-login-only)?dst=$(link-orig-esc)&amp;username=T-$(mac-esc)">clique ici</a>.$(endif)
                        $(endif)
                        $(if error)$(error)$(endif)
                    </p>
                    <div class="wifi-container">
                        <a href="${buy}" class="wifi-button wifi-button-primary">
                            Acheter un ticket
                        </a>
                        <a href="${retrieve}" class="wifi-button wifi-button-secondary">
                            Récupérer mon ticket
                        </a>
                    </div>
                    <div class="sep">J’ai déjà un code</div>
                    <label>
                        <input name="username" type="text" value="$(username)" placeholder="Nom d’utilisateur" autocapitalize="none" autocomplete="off" spellcheck="false" />
                    </label>
                    <label>
                        <input name="password" type="password" placeholder="Mot de passe" />
                    </label>
                    <input type="submit" value="Me connecter" />
                </form>
                <p class="help">
                    Besoin d’aide ? Appelle le <a href="tel:${phoneHref}">${phoneText}</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;
}

// rlogin.html : page technique qui renvoie tout de suite le client vers la connexion.
// Identique au modèle ; seul le corps de page reçoit un lien de secours aux couleurs
// de la charte, au cas où le téléphone ignorerait la redirection automatique.
export function buildRloginHtml() {
  const c = COLORS;
  return `$(if http-status == 302)Hotspot login required$(endif)
$(if http-header == "Location")$(link-redirect)$(endif)
<html>
<!--
<?xml version="1.0" encoding="UTF-8"?>
  <WISPAccessGatewayParam
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="http://$(hostname)/xml/WISPAccessGatewayParam.xsd">
    <Redirect>
	<AccessProcedure>1.0</AccessProcedure>
	<AccessLocation>$(location-id)</AccessLocation>
	<LocationName>$(location-name)</LocationName>
	<LoginURL>$(link-login-only)?target=xml</LoginURL>
	<MessageType>100</MessageType>
	<ResponseCode>0</ResponseCode>
    </Redirect>
  </WISPAccessGatewayParam>
-->
<head>
<title>...</title>
<meta http-equiv="refresh" content="0; url=$(link-redirect)">
<meta http-equiv="pragma" content="no-cache">
<meta http-equiv="expires" content="-1">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:40px 16px;background:${c.page};color:${c.ink};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;text-align:center;">
<p>Un instant…</p>
<p style="margin-top:12px;"><a href="$(link-redirect)" style="color:${c.brand};font-weight:700;">Continuer</a></p>
</body>
</html>
`;
}

// Liste des balises $(...) d'un texte, dans l'ordre (sert à la vérification).
export function mikrotikTags(text) {
  return text.match(/\$\([^)]*\)/g) || [];
}

// Aperçu dans le tableau de bord : imite MikroTik en évaluant les $(if …)…$(endif)
// et en remplaçant les variables par des valeurs d'exemple. N'est jamais téléchargé.
export function renderPreview(html, vars) {
  const tokens = html.split(/(\$\([^)]*\))/);
  const stack = [true];
  let out = '';
  const evaluate = (condition) => {
    const m = condition.match(/^([\w-]+)\s*==\s*["'](.*)["']$/);
    if (m) return String(vars[m[1]] ?? '') === m[2];
    return Boolean(vars[condition.trim()]);
  };
  for (const token of tokens) {
    const tag = token.match(/^\$\((.*)\)$/);
    if (!tag) {
      if (stack.every(Boolean)) out += token;
      continue;
    }
    const body = tag[1].trim();
    if (body.startsWith('if ')) stack.push(evaluate(body.slice(3).trim()));
    else if (body === 'endif') stack.pop();
    else if (stack.every(Boolean)) out += escapeForPortal(vars[body] ?? '');
  }
  return out;
}
