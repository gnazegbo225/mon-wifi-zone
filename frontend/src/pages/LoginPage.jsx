import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import logoMark from '../assets/logo-mark.svg';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import Spinner from '../components/Spinner';
import { AlertIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Messages au ton de la charte : on tutoie, phrases courtes, on dit quoi faire.
function messageForError(error) {
  if (error?.status === 0) return 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.';
  if (error?.status === 401) return 'Cet email ou ce mot de passe ne marche pas. Vérifie-les et réessaie.';
  if (error?.status === 400) return 'Écris ton email et ton mot de passe pour continuer.';
  return 'Un souci de notre côté. Réessaie dans un instant.';
}

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null); // { field: 'email' | 'password' | 'both' | null, message }
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) return setError({ field: 'email', message: 'Écris ton email pour continuer.' });
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return setError({ field: 'email', message: 'Cet email semble incomplet. Vérifie-le.' });
    }
    if (!password) return setError({ field: 'password', message: 'Écris ton mot de passe pour continuer.' });

    setError(null);
    setSubmitting(true);
    try {
      await signIn(cleanEmail, password, remember);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // Champs en rouge seulement si ce sont eux le problème (pas pour une panne réseau).
      setError({ field: err?.status === 401 ? 'both' : null, message: messageForError(err) });
      setSubmitting(false);
    }
  }

  const fieldClass = (field) =>
    `flex h-14 items-center gap-3 rounded-2xl border bg-white/80 px-4 shadow-[0_2px_12px_-4px_rgba(15,42,92,0.12)] backdrop-blur transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${
      error?.field === field || error?.field === 'both' ? 'border-danger' : 'border-white'
    }`;

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#eef2f8] to-page">
      {/* Formes décoratives (inspiration : cercles doux aux coins). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 size-64 rounded-full bg-brand-soft ring-[18px] ring-white/60" />
        <div className="absolute top-40 -right-16 size-32 rounded-full bg-gradient-to-br from-white to-brand-soft shadow-[0_10px_40px_-10px_rgba(15,42,92,0.25)]" />
        <div className="absolute -right-20 -bottom-24 size-72 rounded-full bg-gradient-to-tl from-brand-soft to-white ring-1 ring-white" />
        <div className="absolute bottom-24 -left-10 size-20 rounded-full bg-accent-soft" />
        <div className="absolute top-28 left-8 size-3 rounded-full bg-accent" />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10 sm:max-w-md sm:px-8">
        {/* Tuile du logo */}
        <div className="mx-auto mb-7 grid size-28 place-items-center rounded-[32px] border border-white bg-white/70 shadow-[0_18px_40px_-14px_rgba(15,42,92,0.35)] backdrop-blur-md">
          <img src={logoMark} alt="" className="size-16" />
        </div>

        <h1 className="text-center text-2xl font-bold text-brand">Content de te revoir</h1>
        <p className="mt-2 text-center text-sm tracking-[0.18em] text-muted uppercase">Connecte-toi pour continuer</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              <AlertIcon className="mt-px size-5 shrink-0" />
              <p>{error.message}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <div className={fieldClass('email')}>
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
                aria-invalid={error?.field === 'email' || undefined}
                className="h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Mot de passe
            </label>
            <div className={fieldClass('password')}>
              <LockIcon className="size-5 shrink-0 text-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ton mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error?.field === 'password' || undefined}
                className="h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
              </button>
            </div>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-3 py-1 text-sm text-ink select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-5 cursor-pointer rounded-md accent-brand"
            />
            Rester connecté
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="group relative flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-brand to-[#1d4489] px-16 text-base font-bold text-white shadow-[0_14px_30px_-10px_rgba(15,42,92,0.6)] transition hover:to-brand active:scale-[0.99] disabled:cursor-wait disabled:opacity-90 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand/30"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-5" />
                Un instant, on vérifie…
              </span>
            ) : (
              <>
                Me connecter
                <span className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/15 transition group-hover:translate-x-0.5">
                  <ArrowRightIcon className="size-5" />
                </span>
              </>
            )}
          </button>

          <p className="pt-1 text-center text-sm text-muted">
            Mot de passe oublié ? Demande à ton administrateur.
          </p>
        </form>
      </main>

      <footer className="flex flex-col items-center gap-2 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img src={logo} alt="monwifizone" className="h-7 w-auto" />
        <p className="text-sm text-muted">Ton espace vendeur</p>
      </footer>
    </div>
  );
}
