import { useEffect, useState } from 'react';
import Spinner from '../components/Spinner';
import { AlertIcon } from '../components/icons';
import { getPricings } from '../services/api';

const priceFormat = new Intl.NumberFormat('fr-FR');

export default function ForfaitsPage() {
  const [pricings, setPricings] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPricings()
      .then((data) => !cancelled && setPricings(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setFailed(false);
    setPricings(null);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="max-w-5xl">
      <div>
        {failed ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <div>
              <p>On n'arrive pas à charger les forfaits. Vérifie ta connexion.</p>
              <button type="button" onClick={retry} className="mt-2 font-bold underline underline-offset-2">
                Réessayer
              </button>
            </div>
          </div>
        ) : pricings === null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-5 text-brand" />
            Un instant, on charge les forfaits…
          </p>
        ) : pricings.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-base text-muted">
            Aucun forfait pour l'instant.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pricings.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)]">
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
                <p className="text-lg font-bold text-brand">{p.name}</p>
                <p className="mt-1 text-2xl font-bold text-ink">
                  {priceFormat.format(p.amount)} <span className="text-base">FCFA</span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  {[p.duration_label, p.speed_label].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
