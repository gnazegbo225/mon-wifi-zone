import { useEffect, useId, useRef } from 'react';
import Spinner from './Spinner';
import { AlertIcon, CloseIcon } from './icons';

// Fenêtre de formulaire partagée (forfaits, zones…).
// Téléphone : panneau qui monte du bas. Grand écran : fenêtre centrée.
// Se ferme avec Échap, un clic à côté ou le bouton Annuler (sauf pendant l'enregistrement).
export default function FormDialog({
  title,
  subtitle,
  submitLabel,
  saving,
  formError,
  formRef,
  onSubmit,
  onClose,
  children,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(e) => {
        // Clic sur le fond (en dehors du panneau) : on ferme.
        if (e.target === dialogRef.current && !saving) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink shadow-[0_-10px_40px_-10px_rgba(15,42,92,0.35)] backdrop:bg-brand/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex max-h-[92dvh] flex-col">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-3 pb-4 sm:pt-5">
          <div>
            <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-line sm:hidden" />
            <h2 id={titleId} className="text-lg font-bold text-brand">
              {title}
            </h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer"
            className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-brand-soft hover:text-brand"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        {/* Champs */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {formError && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <AlertIcon className="mt-px size-5 shrink-0" />
              <p>{formError}</p>
            </div>
          )}
          {children}
        </div>

        {/* Boutons */}
        <div className="flex gap-3 border-t border-line bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-12 flex-1 rounded-full border border-line text-base font-bold text-brand transition hover:bg-brand-soft"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover disabled:cursor-wait"
          >
            {saving && <Spinner className="size-5" />}
            {saving ? 'Un instant…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// Un champ avec son libellé, son aide et son message d'erreur.
// children reçoit les props à poser sur l'input ou le select (id, name, aria-*, className).
export function Field({ id, label, name, error, hint, suffix, optional = false, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const control = children({
    id,
    name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
    className: 'h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted',
  });

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-ink">
        {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
      </label>
      <div
        className={`flex h-12 items-center gap-2 rounded-2xl border bg-page px-4 transition focus-within:bg-white focus-within:ring-4 ${
          error ? 'border-danger focus-within:ring-danger/10' : 'border-line focus-within:border-brand focus-within:ring-brand/10'
        }`}
      >
        {control}
        {suffix && <span className="shrink-0 text-sm font-bold text-muted">{suffix}</span>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
