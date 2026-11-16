// Nouveau mot de passe (/mot-de-passe/nouveau?token=…) : lien reçu par email, valable 30 minutes, une fois.
// Les sessions ouvertes avec l'ancien mot de passe sont fermées par le serveur.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AuthShell from '../components/AuthShell';
import { authButtonClass, authFieldClass, authInputClass } from '../components/authStyles';
import Spinner from '../components/Spinner';
import { AlertIcon, CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from '../components/icons';
import { resetPassword } from '../services/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null); // { field, message }
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(!token);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 8) return setError({ field: 'password', message: 'Ton mot de passe doit avoir au moins 8 caractères.' });
    if (password !== confirm) return setError({ field: 'confirm', message: 'Les deux mots de passe ne sont pas identiques.' });
    setError(null);
    setSaving(true);
    try {
      await resetPassword(token, password);
      signOut(); // l'ancienne session de ce navigateur ne vaut plus
      setDone(true);
    } catch (err) {
      if (err.field === 'token') setExpired(true);
      else setError({ field: err.field, message: err.status === 0 ? 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.' : err.message });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Mot de passe changé">
        <div className="space-y-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <CheckIcon className="size-7" />
          </div>
          <p className="text-ink">Tu peux te connecter avec ton nouveau mot de passe.</p>
          <Link to="/connexion" className={authButtonClass}>
            Me connecter
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (expired) {
    return (
      <AuthShell title="Lien expiré">
        <div className="space-y-6 text-center">
          <p className="text-ink">Ce lien ne marche plus : il a déjà servi, ou ses 30 minutes sont passées.</p>
          <Link to="/mot-de-passe-oublie" className={authButtonClass}>
            Recevoir un nouveau lien
          </Link>
        </div>
      </AuthShell>
    );
  }

  const field = (id, value, setValue, placeholder, invalid) => (
    <div className={authFieldClass(invalid)}>
      <LockIcon className="size-5 shrink-0 text-muted" />
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={invalid || undefined}
        className={authInputClass}
      />
    </div>
  );

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="8 caractères au moins. Tes autres sessions seront fermées.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <p>{error.message}</p>
          </div>
        )}
        {field('password', password, setPassword, 'Nouveau mot de passe', error?.field === 'password')}
        {field('confirm', confirm, setConfirm, 'Encore une fois', error?.field === 'confirm')}
        <button type="button" onClick={() => setShow((s) => !s)} className="flex items-center gap-2 text-sm font-bold text-brand">
          {show ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          {show ? 'Cacher les mots de passe' : 'Afficher les mots de passe'}
        </button>
        <button type="submit" disabled={saving} className={authButtonClass}>
          {saving && <Spinner className="size-5" />}
          Enregistrer
        </button>
      </form>
    </AuthShell>
  );
}
