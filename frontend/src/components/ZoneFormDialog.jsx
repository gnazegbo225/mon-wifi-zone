import { useRef, useState } from 'react';
import { createZone, updateZone } from '../services/api';
import FormDialog, { Field } from './FormDialog';

const FIELDS = ['name', 'city', 'country'];

// Messages au ton de la charte : on tutoie, phrases courtes, on dit quoi faire.
function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Donne un nom à la zone. Par exemple : Maquis Chez Tanti.';
  if (!values.city.trim()) errors.city = 'Écris la ville. Par exemple : Abidjan.';
  if (!/^[A-Za-z]{2}$/.test(values.country.trim())) {
    errors.country = 'Écris le code du pays en 2 lettres. Par exemple : CI.';
  }
  return errors;
}

function messageForError(err) {
  if (err?.status === 0) return 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.';
  if (err?.status === 403) return 'Seul un administrateur peut gérer les zones.';
  if (err?.status === 404) return 'Cette zone n’existe plus. Ferme et recharge la page.';
  if (err?.status === 400) return err.message;
  return 'Un souci de notre côté. Réessaie dans un instant.';
}

// Formulaire de création / modification d'une zone WiFi.
export default function ZoneFormDialog({ zone, onClose, onSaved }) {
  const formRef = useRef(null);
  const isEdit = Boolean(zone);

  const [values, setValues] = useState({
    name: zone?.name || '',
    city: zone?.city || '',
    country: zone?.country || 'CI',
  });
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
      name: values.name.trim(),
      city: values.city.trim(),
      country: values.country.trim().toUpperCase(),
    };

    setSaving(true);
    try {
      const saved = isEdit ? await updateZone(zone.id, payload) : await createZone(payload);
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
      title={isEdit ? 'Modifier la zone' : 'Nouvelle zone'}
      subtitle={isEdit ? 'Change les informations puis enregistre.' : 'Ajoute ensuite ses forfaits.'}
      submitLabel={isEdit ? 'Enregistrer' : 'Créer la zone'}
      saving={saving}
      formError={formError}
      formRef={formRef}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Field id="zone-name" label="Nom de la zone" name="name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={100}
            placeholder="Maquis Chez Tanti"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
          />
        )}
      </Field>

      <Field id="zone-city" label="Ville" name="city" error={errors.city}>
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={100}
            autoComplete="address-level2"
            placeholder="Abidjan"
            value={values.city}
            onChange={(e) => setField('city', e.target.value)}
          />
        )}
      </Field>

      <Field
        id="zone-country"
        label="Pays"
        name="country"
        error={errors.country}
        hint="Code à 2 lettres. Côte d’Ivoire : CI, Sénégal : SN."
      >
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={2}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            placeholder="CI"
            value={values.country}
            onChange={(e) => setField('country', e.target.value.toUpperCase())}
            className={`${props.className} font-bold tracking-widest uppercase`}
          />
        )}
      </Field>
    </FormDialog>
  );
}
