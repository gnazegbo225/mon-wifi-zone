// Changement de l'adresse de connexion : nouvelle adresse (deux fois), mot de passe actuel,
// et pour le super admin le code de l'application d'authentification.
// onSubmit({ new_email, confirm_email, password, code? }) renvoie une promesse ; une erreur porte message et field.
import { useState } from 'react';
import { Field } from './FormDialog';
import Spinner from './Spinner';

const EMPTY = { new_email: '', confirm_email: '', password: '', code: '' };

export default function EmailChangeForm({ currentEmail, withCode = false, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState(null); // { field, message }
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: key === 'code' ? e.target.value.replace(/\D/g, '') : e.target.value }));
    if (error?.field === key) setError(null);
  };

  async function submit(event) {
    event.preventDefault();
    if (values.new_email.trim().toLowerCase() !== values.confirm_email.trim().toLowerCase()) {
      return setError({ field: 'confirm_email', message: 'Les deux adresses ne sont pas identiques.' });
    }
    setBusy(true);
    setError(null);
    try {
      const { code, ...rest } = values;
      await onSubmit(withCode ? { ...rest, code } : rest);
      setValues(EMPTY);
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError({ field: err.field, message: err.status === 0 ? 'Le serveur ne répond pas. Réessaie.' : err.message });
      if (err.field === 'code') setValues((v) => ({ ...v, code: '' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">Adresse de connexion</p>
          <p className="truncate font-bold text-ink">{currentEmail}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(false);
            }}
            className="h-11 rounded-full border border-line bg-white px-5 font-bold text-brand transition hover:bg-brand-soft"
          >
            Changer d’adresse
          </button>
        )}
      </div>

      {done && (
        <p role="status" className="mt-4 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          C’est fait. Utilise ta nouvelle adresse à ta prochaine connexion.
        </p>
      )}

      {open && (
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          {error && !['new_email', 'confirm_email', 'password', 'code'].includes(error.field) && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new_email" label="Nouvelle adresse" name="new_email" error={error?.field === 'new_email' ? error.message : null}>
              {(props) => (
                <input {...props} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck="false" value={values.new_email} onChange={set('new_email')} />
              )}
            </Field>
            <Field id="confirm_email" label="Retape la nouvelle adresse" name="confirm_email" error={error?.field === 'confirm_email' ? error.message : null}>
              {(props) => (
                <input {...props} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck="false" value={values.confirm_email} onChange={set('confirm_email')} />
              )}
            </Field>
            <Field id="current_password" label="Ton mot de passe actuel" name="password" error={error?.field === 'password' ? error.message : null}>
              {(props) => <input {...props} type="password" autoComplete="current-password" value={values.password} onChange={set('password')} />}
            </Field>
            {withCode && (
              <Field
                id="email_code"
                label="Code de ton application d’authentification"
                name="code"
                error={error?.field === 'code' ? error.message : null}
              >
                {(props) => <input {...props} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={values.code} onChange={set('code')} />}
              </Field>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setValues(EMPTY);
                setError(null);
              }}
              disabled={busy}
              className="h-12 rounded-full border border-line bg-white px-6 font-bold text-brand transition hover:bg-brand-soft"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !values.new_email || !values.confirm_email || !values.password || (withCode && values.code.length !== 6)}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-bold text-white transition hover:bg-brand-hover disabled:opacity-50"
            >
              {busy && <Spinner className="size-5" />}
              Enregistrer la nouvelle adresse
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
