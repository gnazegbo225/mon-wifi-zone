// E5 du parcours client : « Paiement reçu », avec le ticket (/paiement/succes?pid=…).
import { Navigate } from 'react-router-dom';
import { ClientLayout, Loading, ResultIcon, Title } from '../client/ClientLayout';
import { TicketView } from '../client/Ticket';
import { formatPrice } from '../utils/format';
import { usePayment } from '../client/usePayment';

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

  return (
    <ClientLayout supportPhone={payment.manager_phone}>
      <div className="flex flex-col gap-4 text-center">
        <ResultIcon type="success" />
        <Title>Paiement reçu</Title>
        <p>{ticket.username === ticket.password ? 'Voici ton code :' : 'Voici ton ticket :'}</p>

        <TicketView ticket={ticket} routerHost={routerHost} />

        <p className="text-sm text-muted">{forfait}</p>
        <p className="text-sm text-muted">Garde ce code : prends une capture d’écran de cette page.</p>
      </div>
    </ClientLayout>
  );
}
