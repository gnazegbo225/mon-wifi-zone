// Confirmation de l'adresse email (/email/confirmer?token=…) : lien reçu par email, valable 3 jours, une fois.
// Marche sans être connecté (le lien peut s'ouvrir sur un autre appareil que celui de l'espace promoteur).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AuthShell from '../components/AuthShell';
import { authButtonClass } from '../components/authStyles';
import Spinner from '../components/Spinner';
import { CheckIcon } from '../components/icons';
import { verifyEmail } from '../services/api';

// Un lien ne sert qu'une fois : en développement, React lance l'effet deux fois ; on ne l'envoie qu'une fois.
const requests = new Map();
function confirmOnce(token) {
  if (!requests.has(token)) requests.set(token, verifyEmail(token));
  return requests.get(token);
}

export default function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState(token ? { status: 'loading' } : { status: 'error' }); // loading | done | error

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    confirmOnce(token)
      .then((data) => {
        if (!active) return;
        setState({ status: 'done', email: data.email });
        refreshUser().catch(() => {}); // met à jour le bandeau si l'espace est ouvert dans ce navigateur
      })
      .catch((err) => active && setState({ status: 'error', network: err.status === 0 }));
    return () => {
      active = false;
    };
  }, [token, refreshUser]);

  if (state.status === 'loading') {
    return (
      <AuthShell title="Un instant…">
        <p className="flex items-center justify-center gap-2 text-muted">
          <Spinner className="size-5 text-brand" /> On confirme ton adresse.
        </p>
      </AuthShell>
    );
  }

  const next = user ? (
    <Link to="/espace" className={authButtonClass}>
      Aller à mon espace
    </Link>
  ) : (
    <Link to="/connexion" className={authButtonClass}>
      Me connecter
    </Link>
  );

  if (state.status === 'done') {
    return (
      <AuthShell title="Adresse confirmée">
        <div className="space-y-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <CheckIcon className="size-7" />
          </div>
          <p className="text-ink">
            Merci : <span className="font-bold break-all">{state.email}</span> est confirmée. Tu recevras ici les nouvelles de ton compte et de tes retraits.
          </p>
          {next}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={state.network ? 'Pas de connexion' : 'Lien expiré'}>
      <div className="space-y-6 text-center">
        <p className="text-ink">
          {state.network
            ? 'Le serveur ne répond pas. Vérifie ta connexion, puis rouvre le lien.'
            : 'Ce lien ne marche plus : il a déjà servi, ou il a plus de 3 jours. Connecte-toi : tu pourras recevoir un nouveau lien depuis ton espace.'}
        </p>
        {next}
      </div>
    </AuthShell>
  );
}
