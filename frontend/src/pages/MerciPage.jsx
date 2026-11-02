// E4 du parcours client : retour depuis Moneroo (/merci?pid=…).
// Interroge le backend toutes les 4 secondes, pendant 2 minutes au plus, puis envoie le client
// sur la page du ticket ou sur la page d'échec.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClientLayout, Loading, PrimaryButton, Title } from '../client/ClientLayout';
import { getPaymentStatus } from '../services/api';

const POLL_MS = 4000;
const MAX_WAIT_MS = 2 * 60 * 1000;

export default function MerciPage() {
  const [searchParams] = useSearchParams();
  const pid = searchParams.get('pid');
  const navigate = useNavigate();
  const [state, setState] = useState(pid ? 'waiting' : 'notFound'); // waiting | slow | notFound
  const [attempt, setAttempt] = useState(0); // relance l'attente après « Vérifier à nouveau »
  const [supportPhone, setSupportPhone] = useState(null);

  useEffect(() => {
    if (!pid) return undefined;
    let stopped = false;
    let timer;
    const startedAt = Date.now();

    async function check() {
      try {
        const { payment } = await getPaymentStatus(pid);
        if (stopped) return;
        setSupportPhone(payment.manager_phone);
        const query = `?pid=${encodeURIComponent(pid)}`;
        if (payment.status === 'completed') return navigate(`/paiement/succes${query}`, { replace: true });
        if (payment.status === 'failed' || payment.status === 'cancelled') {
          return navigate(`/paiement/echec${query}`, { replace: true });
        }
      } catch (err) {
        if (stopped) return;
        if (err.status === 404) return setState('notFound');
        // Réseau coupé un instant : on réessaie au prochain tour.
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) return setState('slow');
      timer = setTimeout(check, POLL_MS);
    }

    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pid, attempt, navigate]);

  if (state === 'notFound') {
    return (
      <ClientLayout supportPhone={supportPhone}>
        <div className="flex flex-col gap-3 text-center">
          <Title>On ne trouve pas ce paiement</Title>
          <p>Le lien est peut-être incomplet. Si tu as payé, garde le SMS de ton opérateur et contacte le gérant de la zone.</p>
        </div>
      </ClientLayout>
    );
  }

  if (state === 'slow') {
    return (
      <ClientLayout supportPhone={supportPhone}>
        <div className="flex flex-col gap-4 text-center">
          <Title>On attend encore la confirmation</Title>
          <p>Ton opérateur n’a pas encore répondu.</p>
          <p>Si tu as validé le paiement, ton ticket va arriver. Ne paye pas une deuxième fois.</p>
          <PrimaryButton
            onClick={() => {
              setState('waiting');
              setAttempt((n) => n + 1);
            }}
          >
            Vérifier à nouveau
          </PrimaryButton>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout supportPhone={supportPhone}>
      <div className="flex flex-col gap-2 text-center">
        <Loading text="Un instant, on vérifie ton paiement…" />
        <p className="text-sm text-muted">Ne ferme pas cette page.</p>
      </div>
    </ClientLayout>
  );
}
