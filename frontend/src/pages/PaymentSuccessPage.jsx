// E5 du parcours client : « Paiement reçu », avec le ticket (/paiement/succes?pid=…).
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClientLayout, Loading, PrimaryButton, ResultIcon, SecondaryButton, Title } from '../client/ClientLayout';
import { formatPrice } from '../utils/format';
import { usePayment } from '../client/usePayment';

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

export default function PaymentSuccessPage() {
  const { pid, result, error } = usePayment();

  if (error) {
    return (
      <ClientLayout>
        <div className="flex flex-col gap-3 text-center">
          <Title>{error === 'notFound' ? 'On ne trouve pas ce paiement' : 'Pas de connexion'}</Title>
          <p>
            {error === 'notFound'
              ? 'Le lien est peut-être incomplet. Si tu as payé, contacte le gérant de la zone.'
              : 'Vérifie ta connexion, puis recharge cette page. Ton ticket ne sera pas perdu.'}
          </p>
        </div>
      </ClientLayout>
    );
  }
  if (!result) {
    return (
      <ClientLayout>
        <Loading text="Un instant, on récupère ton ticket…" />
      </ClientLayout>
    );
  }

  const { payment, ticket, router_host: routerHost } = result;
  const query = `?pid=${encodeURIComponent(pid)}`;
  if (payment.status === 'pending') return <Navigate to={`/merci${query}`} replace />;
  if (payment.status !== 'completed') return <Navigate to={`/paiement/echec${query}`} replace />;

  const forfait = `Forfait ${payment.pricing_duration_label || payment.pricing_name} — ${formatPrice(payment.amount)}`;

  // Payé, mais plus aucun ticket pour ce forfait (cas rare) : le gérant doit intervenir.
  if (!ticket) {
    return (
      <ClientLayout supportPhone={payment.manager_phone}>
        <div className="flex flex-col gap-4 text-center">
          <ResultIcon type="success" />
          <Title>Paiement reçu</Title>
          <p>Ton ticket n’est pas encore prêt. Ton argent n’est pas perdu.</p>
          <p>
            {payment.manager_phone ? 'Appelle le gérant' : 'Montre cette page au gérant'} de la zone {payment.zone_name}. Il te
            donnera ton code.
          </p>
          <p className="rounded-2xl bg-page px-4 py-3 text-sm text-muted">
            {forfait}
            <br />
            Référence : {payment.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </ClientLayout>
    );
  }

  // Sur les tickets MikroTik, l'identifiant et le mot de passe sont souvent le même code.
  const singleCode = ticket.username === ticket.password;

  return (
    <ClientLayout supportPhone={payment.manager_phone}>
      <div className="flex flex-col gap-4 text-center">
        <ResultIcon type="success" />
        <Title>Paiement reçu</Title>
        <p>{singleCode ? 'Voici ton code :' : 'Voici ton ticket :'}</p>

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
          <PrimaryButton onClick={() => window.location.assign(hotspotLoginUrl(routerHost, ticket))}>
            Me connecter maintenant
          </PrimaryButton>
        )}

        <CopyButton
          text={singleCode ? ticket.username : `${ticket.username} ${ticket.password}`}
          label={singleCode ? 'Copier le code' : 'Copier le ticket'}
          doneLabel={singleCode ? 'Code copié ✓' : 'Ticket copié ✓'}
        />

        <p className="text-sm text-muted">{forfait}</p>
        <p className="text-sm text-muted">Garde ce code : prends une capture d’écran de cette page.</p>
      </div>
    </ClientLayout>
  );
}
