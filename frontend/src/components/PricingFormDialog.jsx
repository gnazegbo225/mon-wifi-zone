import { useRef, useState } from 'react';
import { createPricing, updatePricing } from '../services/api';
import FormDialog, { Field } from './FormDialog';

const MAX_AMOUNT = 2147483647;
const FIELDS = ['wifi_zone_id', 'name', 'amount', 'duration_label', 'speed_label', 'ticket_profile'];

function initialValues(pricing, zones, defaultZoneId) {
  const activeZones = zones.filter((z) => z.is_active !== false);
  return {
    wifi_zone_id: pricing?.wifi_zone_id || defaultZoneId || (activeZones.length === 1 ? activeZones[0].id : ''),
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
// Un forfait appartient toujours à une zone précise. Une zone désactivée ne peut pas
// recevoir de nouveau forfait (seul un forfait qui y est déjà peut la garder).
export default function PricingFormDialog({ pricing, zones, defaultZoneId, onClose, onSaved }) {
  const formRef = useRef(null);
  const isEdit = Boolean(pricing);

  const [values, setValues] = useState(() => initialValues(pricing, zones, defaultZoneId));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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
    <FormDialog
      title={isEdit ? 'Modifier le forfait' : 'Nouveau forfait'}
      subtitle={isEdit ? 'Change les informations puis enregistre.' : 'Il sera tout de suite en vente.'}
      submitLabel={isEdit ? 'Enregistrer' : 'Créer le forfait'}
      saving={saving}
      formError={formError}
      formRef={formRef}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Field id="pricing-wifi_zone_id" label="Zone WiFi" name="wifi_zone_id" error={errors.wifi_zone_id}>
        {(props) => (
          <select {...props} value={values.wifi_zone_id} onChange={(e) => setField('wifi_zone_id', e.target.value)}>
            <option value="">Choisis une zone</option>
            {zones.map((z) => {
              const inactive = z.is_active === false;
              return (
                <option key={z.id} value={z.id} disabled={inactive && z.id !== pricing?.wifi_zone_id}>
                  {z.name} — {z.city}
                  {inactive ? ' (désactivée)' : ''}
                </option>
              );
            })}
          </select>
        )}
      </Field>

      <Field id="pricing-name" label="Nom du forfait" name="name" error={errors.name}>
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

      <Field id="pricing-amount" label="Prix" name="amount" error={errors.amount} hint="En FCFA, sans centimes." suffix="FCFA">
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
        <Field id="pricing-duration_label" label="Durée" name="duration_label" error={errors.duration_label}>
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

        <Field id="pricing-speed_label" label="Débit" name="speed_label" error={errors.speed_label} optional>
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
        id="pricing-ticket_profile"
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
    </FormDialog>
  );
}
