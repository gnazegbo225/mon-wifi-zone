// Inscription d'un promoteur (/inscription). Le compte est créé « en attente de vérification » :
// le promoteur peut préparer ses zones et vendre, et retirera son argent une fois son dossier vérifié.
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import logoMark from '../assets/logo-mark.svg';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import Spinner from '../components/Spinner';
import { AlertIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, PhoneIcon, UserIcon } from '../components/icons';
import { getCountries } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function check(form) {
  if (form.full_name.trim().length < 2) return { field: 'full_name', message: 'Écris ton nom complet.' };
  if (!EMAIL_REGEX.test(form.email.trim())) return { field: 'email', message: 'Cet email semble incomplet. Vérifie-le.' };
  const digits = form.phone.replace(/\D/g, '');
  const local = digits.startsWith('225') && digits.length === 13 ? digits.slice(3) : digits;
  if (local.length !== 10) return { field: 'phone', message: 'Ce numéro n’est pas complet. Il faut 10 chiffres.' };
  if (form.password.length < 8) return { field: 'password', message: 'Ton mot de passe doit avoir au moins 8 caractères.' };
  return null;
}

export default function RegisterPage() {
  const { user, signUp } = useAuth();
  const [countries, setCountries] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', country: 'CI' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null); // { field, message }
  const [submitting, setSubmitting] = useState(false);
  // Vient de s'inscrire : on l'envoie compléter son dossier (sinon, déjà connecté : tableau de bord).
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    getCountries()
      .then((list) => {
        setCountries(list);
        if (list.length > 0) setForm((f) => ({ ...f, country: list[0].code }));
      })
      .catch(() => setCountries([]));
  }, []);

  if (user) return <Navigate to={registered ? '/espace/compte' : '/espace'} replace />;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error?.field === key) setError(null);
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const problem = check(form);
    if (problem) return setError(problem);
    setError(null);
    setSubmitting(true);
    try {
      setRegistered(true);
      await signUp({ ...form, full_name: form.full_name.trim(), email: form.email.trim() });
    } catch (err) {
      setRegistered(false);
      setSubmitting(false);
      if (err.status === 0) return setError({ field: null, message: 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.' });
      setError({ field: err.field, message: err.message });
    }
  }

  const fieldClass = (field) =>
    `flex h-14 items-center gap-3 rounded-2xl border bg-white px-4 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${
      error?.field === field ? 'border-danger' : 'border-line'
    }`;
  const inputClass = 'h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted';
  const countryName = countries?.find((c) => c.code === form.country)?.name;

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <img src={logoMark} alt="" className="mx-auto size-14" />
        <h1 className="mt-6 text-center text-2xl font-bold text-brand">Deviens promoteur</h1>
        <p className="mt-2 text-center text-muted">Vends tes tickets WiFi en Mobile Money.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-3">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <AlertIcon className="mt-px size-5 shrink-0" />
              <p>{error.message}</p>
            </div>
          )}

          <label className={fieldClass('full_name')}>
            <UserIcon className="size-5 shrink-0 text-muted" />
            <span className="sr-only">Nom complet</span>
            <input autoComplete="name" placeholder="Ton nom complet" value={form.full_name} onChange={set('full_name')} className={inputClass} />
          </label>
          <label className={fieldClass('email')}>
            <MailIcon className="size-5 shrink-0 text-muted" />
            <span className="sr-only">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="Ton email"
              value={form.email}
              onChange={set('email')}
              className={inputClass}
            />
          </label>
          <label className={fieldClass('phone')}>
            <PhoneIcon className="size-5 shrink-0 text-muted" />
            <span className="sr-only">Téléphone</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="07 00 00 00 00" value={form.phone} onChange={set('phone')} className={inputClass} />
          </label>
          <label className={fieldClass('password')}>
            <LockIcon className="size-5 shrink-0 text-muted" />
            <span className="sr-only">Mot de passe</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mot de passe (8 caractères minimum)"
              value={form.password}
              onChange={set('password')}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:text-brand"
            >
              {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </label>

          <p className="px-1 text-sm text-muted">
            Pays : <span className="font-bold text-ink">{countryName || 'Côte d’Ivoire'}</span>. La plateforme est ouverte en
            Côte d’Ivoire pour l’instant.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-90"
          >
            {submitting ? (
              <>
                <Spinner className="size-5" /> Un instant…
              </>
            ) : (
              <>
                Créer mon compte <ArrowRightIcon className="size-5" />
              </>
            )}
          </button>

          <p className="pt-2 text-center text-sm text-muted">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="font-bold text-brand underline underline-offset-2">
              Connecte-toi
            </Link>
          </p>
        </form>
      </main>

      <footer className="flex justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img src={logo} alt="monwifizone" className="h-6 w-auto" />
      </footer>
    </div>
  );
}
