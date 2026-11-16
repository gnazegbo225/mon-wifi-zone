// Mot de passe oublié (/mot-de-passe-oublie) : le promoteur reçoit un lien par email.
// Même message que l'adresse ait un compte ou non : on ne révèle pas qui est inscrit.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { authButtonClass, authFieldClass, authInputClass } from '../components/authStyles';
import Spinner from '../components/Spinner';
import { AlertIcon, CheckIcon, MailIcon } from '../components/icons';
import { forgotPassword } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // message du serveur

  async function handleSubmit(event) {
    event.preventDefault();
    const clean = email.trim();
    if (!EMAIL_REGEX.test(clean)) return setError('Écris l’adresse email de ton compte.');
    setError(null);
    setSending(true);
    try {
      const data = await forgotPassword(clean);
      setDone(data.message);
    } catch (err) {
      setError(err.status === 0 ? 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.' : err.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Regarde tes emails">
        <div className="space-y-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <CheckIcon className="size-7" />
          </div>
          <p className="text-ink">{done}</p>
          <p className="text-sm text-muted">Le lien marche une seule fois, pendant 30 minutes.</p>
          <Link to="/connexion" className="inline-block font-bold text-brand underline underline-offset-2">
            Retour à la connexion
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Écris ton adresse email : tu vas recevoir un lien pour choisir un nouveau mot de passe.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <div className={authFieldClass(Boolean(error))}>
          <MailIcon className="size-5 shrink-0 text-muted" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="Ton email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>
        <button type="submit" disabled={sending} className={authButtonClass}>
          {sending && <Spinner className="size-5" />}
          Recevoir le lien
        </button>
        <p className="text-center text-sm text-muted">Employé ? Demande un nouveau mot de passe à ton promoteur.</p>
        <p className="text-center text-sm">
          <Link to="/connexion" className="font-bold text-brand underline underline-offset-2">
            Retour à la connexion
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
