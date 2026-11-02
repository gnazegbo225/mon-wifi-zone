// Lit une fois le paiement de l'adresse (?pid=…) pour les pages de succès et d'échec.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPaymentStatus } from '../services/api';

// Renvoie { pid, result, error } : result = { payment, ticket } une fois chargé ;
// error = 'notFound' ou 'network'.
export function usePayment() {
  const [searchParams] = useSearchParams();
  const pid = searchParams.get('pid');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(pid ? null : 'notFound');

  useEffect(() => {
    if (!pid) return undefined;
    let active = true;
    getPaymentStatus(pid)
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(err.status === 404 ? 'notFound' : 'network'));
    return () => {
      active = false;
    };
  }, [pid]);

  return { pid, result, error };
}
