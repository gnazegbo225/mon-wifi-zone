// P1 du parcours client : « Le paiement n'a pas marché » (/paiement/echec?pid=…).
import { Navigate, useNavigate } from 'react-router-dom';
import { ClientLayout, Loading, PrimaryButton, ResultIcon, Title } from '../client/ClientLayout';
import { readLastPurchase } from '../client/lastPurchase';
import { usePayment } from '../client/usePayment';

export default function PaymentFailedPage() {
  const { pid, result, error } = usePayment();
  const navigate = useNavigate();

  if (!result && !error) {
    return (
      <ClientLayout>
        <Loading />
      </ClientLayout>
    );
  }

  const payment = result?.payment;
  const query = `?pid=${encodeURIComponent(pid || '')}`;
  // On ne montre l'échec que s'il est réel : un paiement réussi ou en cours va sur sa page.
  if (payment?.status === 'completed') return <Navigate to={`/paiement/succes${query}`} replace />;
  if (payment?.status === 'pending') return <Navigate to={`/merci${query}`} replace />;

  // « Réessayer » : retour au choix du forfait, avec le même forfait et le même numéro.
  const last = readLastPurchase();
  const zoneId = payment?.zone_id || last.zoneId;
  const pricingId = payment?.pricing_id || last.pricingId;
  const retryUrl = zoneId ? `/buy/${zoneId}${pricingId ? `?pricing=${pricingId}` : ''}` : null;

  return (
    <ClientLayout supportPhone={payment?.manager_phone}>
      <div className="flex flex-col gap-4 text-center">
        <ResultIcon type="error" />
        <Title>Le paiement n’a pas marché</Title>
        <p className="font-bold">Ton argent n’a pas été pris.</p>
        <p>
          {payment?.status === 'cancelled'
            ? 'Tu as annulé le paiement. Tu peux réessayer quand tu veux.'
            : 'Vérifie ton compte Mobile Money et réessaie.'}
        </p>
        {retryUrl && <PrimaryButton onClick={() => navigate(retryUrl)}>Réessayer</PrimaryButton>}
      </div>
    </ClientLayout>
  );
}
