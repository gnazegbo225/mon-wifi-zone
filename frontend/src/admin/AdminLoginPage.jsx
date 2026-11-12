// Connexion de l'espace super admin, en deux étapes : mot de passe, puis code de l'application d'authentification.
// Aucune adresse email n'est écrite dans le frontend : le rôle est vérifié par le serveur.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import Spinner from '../components/Spinner';
import { adminLogin, adminVerifyCode } from './adminApi';
import { useAdminAuth } from './useAdminAuth';

function messageFor(err) {
  if (err?.status === 0) return 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.';
  if (err?.status === 401 && !err.field) return 'Cet email ou ce mot de passe ne marche pas.';
  if (err?.status === 503) return 'L’administration n’est pas encore configurée sur le serveur.';
  return err?.message || 'Un souci de notre côté. Réessaie dans un instant.';
}

const inputClass =
  'h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10';

export default function AdminLoginPage() {
  const { admin, completeLogin } = useAdminAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('password'); // password | code
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/admin" replace />;

  async function submitPassword(event) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return setError('Écris ton email et ton mot de passe.');
    setError(null);
    setBusy(true);
    try {
      setMfaToken(await adminLogin(email.trim(), password));
      setPassword('');
      setStep('code');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError('Le code a 6 chiffres.');
    setError(null);
    setBusy(true);
    try {
      completeLogin(await adminVerifyCode(mfaToken, code));
      navigate('/admin', { replace: true });
    } catch (err) {
      setCode('');
      // Session intermédiaire expirée (5 min) : on reprend au mot de passe.
      if (err?.status === 401 && !err.field) {
        setStep('password');
        setError('Ta session a expiré. Reconnecte-toi.');
      } else {
        setError(messageFor(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand px-5 py-10">
      <main className="w-full max-w-sm rounded-[28px] bg-white p-8">
        <img src={logo} alt="monwifizone" className="h-7 w-auto" />
        <h1 className="mt-8 text-2xl font-bold text-brand">Administration</h1>
        <p className="mt-1 text-sm text-muted">
          {step === 'password' ? 'Accès réservé.' : 'Écris le code de ton application d’authentification.'}
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {step === 'password' ? (
          <form key="password" onSubmit={submitPassword} noValidate className="mt-6 space-y-3">
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="sr-only">Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              {busy && <Spinner className="size-5" />}
              Continuer
            </button>
          </form>
        ) : (
          <form key="code" onSubmit={submitCode} noValidate className="mt-6 space-y-3">
            <label className="block">
              <span className="sr-only">Code à 6 chiffres</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              {busy && <Spinner className="size-5" />}
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('password');
                setCode('');
                setError(null);
              }}
              className="w-full py-2 text-sm font-bold text-muted transition hover:text-brand"
            >
              Recommencer
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
