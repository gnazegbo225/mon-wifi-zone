// Le ticket affiché au client (page de succès, « Récupérer mon ticket ») : cadre, copie, connexion directe.
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from './ClientLayout';

// Copie dans le presse-papiers ; le bouton affiche « … copié ✓ » pendant 2 secondes.
function CopyButton({ text, label, doneLabel }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // presse-papiers refusé (page non sécurisée…) : le code reste lisible à l'écran
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return <SecondaryButton onClick={copy}>{copied ? doneLabel : label}</SecondaryButton>;
}

// Le ticket, en gros, dans un cadre en forme de ticket (encoches sur les côtés, comme le logo).
function TicketBox({ children }) {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-brand bg-brand-soft px-6 py-5">
      <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border-2 border-brand bg-white" aria-hidden="true" />
      <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border-2 border-brand bg-white" aria-hidden="true" />
      {children}
    </div>
  );
}

// Adresse de connexion du hotspot MikroTik de la zone, ticket déjà rempli.
// Le routeur doit accepter la connexion « HTTP PAP » (IP > Hotspot > Server Profiles > Login).
function hotspotLoginUrl(routerHost, ticket) {
  const host = routerHost.includes(':') ? `[${routerHost}]` : routerHost; // IPv6 entre crochets
  const query = new URLSearchParams({ username: ticket.username, password: ticket.password });
  return `http://${host}/login?${query}`;
}

// Le ticket en gros, avec « Me connecter maintenant » (si l'adresse du routeur est connue) et la copie.
// Sur les tickets MikroTik, l'identifiant et le mot de passe sont souvent le même code.
export function TicketView({ ticket, routerHost }) {
  const singleCode = ticket.username === ticket.password;
  return (
    <div className="flex flex-col gap-4">
      <TicketBox>
        {singleCode ? (
          <p className="text-[32px] font-bold tracking-wide break-all text-brand">{ticket.username}</p>
        ) : (
          <dl className="flex flex-col gap-3 text-left">
            <div>
              <dt className="text-sm text-muted">Identifiant</dt>
              <dd className="text-2xl font-bold break-all text-brand">{ticket.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Mot de passe</dt>
              <dd className="text-2xl font-bold break-all text-brand">{ticket.password}</dd>
            </div>
          </dl>
        )}
      </TicketBox>

      {routerHost && (
        <PrimaryButton onClick={() => window.location.assign(hotspotLoginUrl(routerHost, ticket))}>Me connecter maintenant</PrimaryButton>
      )}

      <CopyButton
        text={singleCode ? ticket.username : `${ticket.username} ${ticket.password}`}
        label={singleCode ? 'Copier le code' : 'Copier le ticket'}
        doneLabel={singleCode ? 'Code copié ✓' : 'Ticket copié ✓'}
      />
    </div>
  );
}
