import { useEffect, useId, useRef, useState } from 'react';
import { createPricing, updatePricing } from '../services/api';
import Spinner from './Spinner';
import { AlertIcon, CloseIcon } from './icons';

const MAX_AMOUNT = 2147483647;
const FIELDS = ['wifi_zone_id', 'name', 'amount', 'duration_label', 'speed_label', 'ticket_profile'];

function initialValues(pricing, zones) {
  return {
    wifi_zone_id: pricing?.wifi_zone_id || (zones.length === 1 ? zones[0].id : ''),
    name: pricing?.name || '',
    amount: pricing ? String(pricing.amount) : '',
    duration_label: pricing?.duration_label || '',
    speed_label: pricing?.speed_label || '',
    ticket_profile: pricing?.ticket_profile || '',
  };
}

// Messages au ton de la charte : on tutoie, phrases courtes, on dit quoi faire.
function validate(values) {
  const errors = {};
  if (!values.wifi_zone_id) errors.wifi_zone_id = 'Choisis la zone de ce forfait.';
  if (!values.name.trim()) errors.name = 'Donne un nom à ce forfait. Par exemple : Pass 1 heure.';

  const amount = values.amount.replace(/\s/g, '');
  if (!amount) errors.amount = 'Écris le prix en FCFA. Par exemple : 200.';
  else if (!/^\d+$/.test(amount)) errors.amount = 'Écris seulement des chiffres, sans virgule ni point. Par exemple : 200.';
  else if (Number(amount) <= 0) errors.amount = 'Le prix doit être plus grand que 0 FCFA.';
  else if (Number(amount) > MAX_AMOUNT) errors.amount = 'Ce prix est trop grand. Vérifie-le.';

  if (!values.duration_label.trim()) errors.duration_label = 'Écris la durée. Par exemple : 1 heure.';
  if (!values.ticket_profile.trim()) {
    errors.ticket_profile = 'Écris le profil MikroTik. C’est le nom du profil dans ton routeur.';
  }
  return errors;
}

function messageForError(err) {
  if (err?.status === 0) return 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.';
  if (err?.status === 403) return 'Seul un administrateur peut gérer les forfaits.';
  if (err?.status === 404) return 'Ce forfait n’existe plus. Ferme et recharge la page.';
  if (err?.status === 400 || err?.status === 409) return err.message;
  return 'Un souci de notre côté. Réessaie dans un instant.';
}

// Formulaire de création / modification d'un forfait.
// Téléphone : panneau qui monte du bas. Grand écran : fenêtre centrée.
export default function PricingFormDialog({ pricing, zones, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const titleId = useId();
  const isEdit = Boolean(pricing);

  const [values, setValues] = useState(() => initialValues(pricing, zones));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function setField(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  }

  function focusField(name) {
    formRef.current?.elements.namedItem(name)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const found = validate(values);
    setErrors(found);
    setFormError('');
    const firstInvalid = FIELDS.find((f) => found[f]);
    if (firstInvalid) return focusField(firstInvalid);

    const payload = {
      wifi_zone_id: values.wifi_zone_id,
      name: values.name.trim(),
      amount: Number(values.amount.replace(/\s/g, '')),
      duration_label: values.duration_label.trim(),
      speed_label: values.speed_label.trim() || null,
      ticket_profile: values.ticket_profile.trim(),
    };

    setSaving(true);
    try {
      const saved = isEdit ? await updatePricing(pricing.id, payload) : await createPricing(payload);
      onSaved(saved, isEdit ? 'updated' : 'created');
    } catch (err) {
      setSaving(false);
      const message = messageForError(err);
      if (err?.field && FIELDS.includes(err.field)) {
        setErrors((e) => ({ ...e, [err.field]: message }));
        focusField(err.field);
      } else {
        setFormError(message);
      }
    }
  }

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
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex max-h-[92dvh] flex-col">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-3 pb-4 sm:pt-5">
          <div>
            <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-line sm:hidden" />
            <h2 id={titleId} className="text-lg font-bold text-brand">
              {isEdit ? 'Modifier le forfait' : 'Nouveau forfait'}
            </h2>
            <p className="text-sm text-muted">
              {isEdit ? 'Change les informations puis enregistre.' : 'Il sera tout de suite en vente.'}
            </p>
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

          <Field label="Zone WiFi" name="wifi_zone_id" error={errors.wifi_zone_id}>
            {(props) => (
              <select
                {...props}
                value={values.wifi_zone_id}
                onChange={(e) => setField('wifi_zone_id', e.target.value)}
              >
                <option value="">Choisis une zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {z.city}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Nom du forfait" name="name" error={errors.name}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={100}
                placeholder="Pass 1 heure"
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            )}
          </Field>

          <Field label="Prix" name="amount" error={errors.amount} hint="En FCFA, sans centimes." suffix="FCFA">
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="200"
                value={values.amount}
                onChange={(e) => setField('amount', e.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Durée" name="duration_label" error={errors.duration_label}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  maxLength={50}
                  placeholder="1 heure"
                  value={values.duration_label}
                  onChange={(e) => setField('duration_label', e.target.value)}
                />
              )}
            </Field>

            <Field label="Débit" name="speed_label" error={errors.speed_label} optional>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  maxLength={50}
                  placeholder="5 Mbps"
                  value={values.speed_label}
                  onChange={(e) => setField('speed_label', e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field
            label="Profil MikroTik"
            name="ticket_profile"
            error={errors.ticket_profile}
            hint="Le nom exact du profil dans ton routeur. Tes clients ne le voient pas."
          >
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={64}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck="false"
                placeholder="1h-5mbps"
                value={values.ticket_profile}
                onChange={(e) => setField('ticket_profile', e.target.value)}
              />
            )}
          </Field>
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
            {saving ? 'Un instant…' : isEdit ? 'Enregistrer' : 'Créer le forfait'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// Un champ avec son libellé, son aide et son message d'erreur.
function Field({ label, name, error, hint, suffix, optional = false, children }) {
  const id = `pricing-${name}`;
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
