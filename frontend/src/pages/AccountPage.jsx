// Mon compte (/espace/compte) : dossier de vérification du promoteur.
// Identité (CNI), photos (recto, verso, selfie) et compte de retrait. Une fois envoyé, le dossier
// est vérifié par le super admin ; le premier retrait n'est possible qu'après son approbation.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import EmailChangeForm from '../components/EmailChangeForm';
import { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { AlertIcon, CameraIcon, CheckIcon } from '../components/icons';
import { getVendorProfile, submitVendorProfile, updateMyEmail, updateVendorProfile, uploadVendorDocument } from '../services/api';

const MAX_PHOTO = 5 * 1024 * 1024;

const PHOTOS = [
  { kind: 'id_front', label: 'Recto de ta CNI', hint: 'Toute la carte, bien lisible.', capture: 'environment' },
  { kind: 'id_back', label: 'Verso de ta CNI', hint: 'Toute la carte, bien lisible.', capture: 'environment' },
  { kind: 'selfie', label: 'Ton selfie', hint: 'Ton visage, en pleine lumière.', capture: 'user' },
];

const PAYOUT_METHODS = [
  { value: 'wave_ci', label: 'Wave' },
  { value: 'orange_ci', label: 'Orange Money' },
  { value: 'mtn_ci', label: 'MTN MoMo' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
];

const EMPTY = {
  legal_name: '',
  business_name: '',
  city: '',
  id_number: '',
  payout_method: '',
  payout_phone: '',
  bank_name: '',
  account_holder: '',
  account_number: '',
};

function toForm(profile) {
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, profile?.[k] ?? '']));
}

// Bandeau d'état du dossier.
function StatusCard({ data }) {
  const { account_status: status, submitted_at: submitted, rejection_reason: reason } = data;
  const cards = {
    approved: ['success', 'Compte vérifié', 'Tu peux retirer ton argent quand tu veux.'],
    rejected: ['error', 'Dossier à corriger', reason || 'Corrige ton dossier, puis renvoie-le.'],
    review: ['info', 'Dossier en cours de vérification', 'On vérifie ton dossier. Tu peux continuer à vendre.'],
    todo: ['info', 'Complète ton dossier', 'Tu peux déjà vendre. Pour retirer ton argent, envoie ton dossier.'],
  };
  const key = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : submitted ? 'review' : 'todo';
  const [tone, title, text] = cards[key];
  const styles = {
    success: 'bg-success-soft text-success',
    error: 'bg-danger-soft text-danger',
    info: 'bg-brand-soft text-brand',
  };
  return (
    <div role="status" className={`flex items-start gap-3 rounded-3xl px-5 py-4 ${styles[tone]}`}>
      {tone === 'success' ? <CheckIcon className="mt-0.5 size-5 shrink-0" /> : <AlertIcon className="mt-0.5 size-5 shrink-0" />}
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-sm">{tone === 'error' ? `Motif : ${text}` : text}</p>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null); // { type, text }
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // kind
  const [previews, setPreviews] = useState({});
  const previewUrls = useRef({});

  useEffect(() => {
    getVendorProfile()
      .then((d) => {
        setData(d);
        setForm(toForm(d.profile));
      })
      .catch(() => setLoadError(true));
  }, []);

  // Aperçus locaux des photos envoyées : libérés en quittant la page.
  useEffect(() => () => Object.values(previewUrls.current).forEach((url) => URL.revokeObjectURL(url)), []);

  if (loadError) {
    return <p className="rounded-3xl bg-danger-soft p-5 text-danger">On n’arrive pas à charger ton dossier. Recharge la page.</p>;
  }
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant, on charge ton dossier…
      </p>
    );
  }

  const editable = data.editable;
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // Seulement les champs utiles au moyen de retrait choisi.
  function payload() {
    const isBank = form.payout_method === 'bank_transfer';
    return {
      legal_name: form.legal_name,
      business_name: form.business_name,
      city: form.city,
      id_number: form.id_number,
      payout_method: form.payout_method || null,
      payout_phone: isBank ? null : form.payout_phone,
      bank_name: isBank ? form.bank_name : null,
      account_holder: isBank ? form.account_holder : null,
      account_number: isBank ? form.account_number : null,
    };
  }

  async function save({ quiet = false } = {}) {
    const updated = await updateVendorProfile(payload());
    setData(updated);
    if (!quiet) setNotice({ type: 'success', text: 'Ton dossier est enregistré.' });
    return updated;
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      await save();
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setNotice(null);
    try {
      await save({ quiet: true });
      const sent = await submitVendorProfile();
      setData(sent);
      await refreshUser().catch(() => {});
      setNotice({ type: 'success', text: 'Dossier envoyé. On le vérifie, puis on te répond ici.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(kind, file) {
    if (!file) return;
    if (file.size > MAX_PHOTO) return setNotice({ type: 'error', text: 'La photo est trop lourde (5 Mo maximum).' });
    setUploading(kind);
    setNotice(null);
    try {
      setData(await uploadVendorDocument(kind, file));
      const url = URL.createObjectURL(file);
      if (previewUrls.current[kind]) URL.revokeObjectURL(previewUrls.current[kind]);
      previewUrls.current[kind] = url;
      setPreviews((p) => ({ ...p, [kind]: url }));
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setUploading(null);
    }
  }

  const isBank = form.payout_method === 'bank_transfer';

  return (
    <div className="max-w-3xl space-y-4">
      <StatusCard data={data} />

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 text-sm ${notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}
        >
          {notice.text}
        </p>
      )}

      <Section title="Ton identité" subtitle="Comme écrit sur ta carte nationale d’identité.">
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <Field id="legal_name" label="Nom complet" name="legal_name" error={errors.legal_name}>
            {(props) => <input {...props} autoComplete="name" value={form.legal_name} onChange={set('legal_name')} />}
          </Field>
          <Field id="id_number" label="Numéro de la CNI" name="id_number" error={errors.id_number}>
            {(props) => <input {...props} autoCapitalize="characters" value={form.id_number} onChange={set('id_number')} />}
          </Field>
          <Field id="city" label="Ville" name="city" error={errors.city}>
            {(props) => <input {...props} autoComplete="address-level2" value={form.city} onChange={set('city')} />}
          </Field>
          <Field id="business_name" label="Nom commercial" name="business_name" optional error={errors.business_name}>
            {(props) => <input {...props} value={form.business_name} onChange={set('business_name')} />}
          </Field>
        </fieldset>
      </Section>

      <Section title="Tes photos" subtitle="Elles restent privées : seule l’équipe de vérification les voit.">
        <div className="grid gap-3 sm:grid-cols-3">
          {PHOTOS.map(({ kind, label, hint, capture }) => {
            const done = data.documents[kind];
            return (
              <div key={kind} className={`flex flex-col rounded-2xl border p-4 ${done ? 'border-success/40 bg-success-soft/40' : 'border-line bg-page'}`}>
                <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-white">
                  {previews[kind] ? (
                    <img src={previews[kind]} alt="" className="size-full object-cover" />
                  ) : done ? (
                    <CheckIcon className="size-8 text-success" />
                  ) : (
                    <CameraIcon className="size-8 text-muted" />
                  )}
                  {uploading === kind && (
                    <span className="absolute inset-0 grid place-items-center bg-white/80">
                      <Spinner className="size-6 text-brand" />
                    </span>
                  )}
                </div>
                <p className="mt-3 font-bold text-ink">{label}</p>
                <p className="text-sm text-muted">{done ? 'Photo envoyée.' : hint}</p>
                {editable && (
                  <label className="mt-3 cursor-pointer rounded-full border border-brand px-4 py-2 text-center text-sm font-bold text-brand transition hover:bg-brand-soft">
                    {done ? 'Remplacer' : 'Ajouter une photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture={capture}
                      className="sr-only"
                      disabled={Boolean(uploading)}
                      onChange={(e) => {
                        handlePhoto(kind, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Ton compte de retrait" subtitle="C’est là que tu recevras ton argent. Il doit être à ton nom.">
        <fieldset disabled={!editable}>
          <legend className="sr-only">Moyen de retrait</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYOUT_METHODS.map(({ value, label }) => (
              <label
                key={value}
                className={`cursor-pointer rounded-2xl border px-3 py-3 text-center text-sm font-bold transition ${
                  form.payout_method === value ? 'border-brand bg-brand text-white' : 'border-line bg-page text-ink hover:border-brand'
                }`}
              >
                <input type="radio" name="payout_method" value={value} checked={form.payout_method === value} onChange={set('payout_method')} className="sr-only" />
                {label}
              </label>
            ))}
          </div>

          {form.payout_method && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {isBank ? (
                <>
                  <Field id="bank_name" label="Banque" name="bank_name" error={errors.bank_name}>
                    {(props) => <input {...props} value={form.bank_name} onChange={set('bank_name')} />}
                  </Field>
                  <Field id="account_holder" label="Titulaire du compte" name="account_holder" error={errors.account_holder}>
                    {(props) => <input {...props} value={form.account_holder} onChange={set('account_holder')} />}
                  </Field>
                  <div className="sm:col-span-2">
                    <Field id="account_number" label="Numéro de compte (RIB)" name="account_number" error={errors.account_number}>
                      {(props) => <input {...props} value={form.account_number} onChange={set('account_number')} />}
                    </Field>
                  </div>
                </>
              ) : (
                <Field id="payout_phone" label="Numéro du compte" name="payout_phone" error={errors.payout_phone}>
                  {(props) => <input {...props} type="tel" inputMode="tel" placeholder="07 00 00 00 00" value={form.payout_phone} onChange={set('payout_phone')} />}
                </Field>
              )}
            </div>
          )}
        </fieldset>
      </Section>

      {editable && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 rounded-full border border-line bg-white px-6 font-bold text-brand transition hover:bg-brand-soft disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || Boolean(uploading)}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
          >
            {saving && <Spinner className="size-5" />}
            Envoyer mon dossier
          </button>
        </div>
      )}

      <Section title="Ta connexion" subtitle="L’adresse email avec laquelle tu te connectes.">
        <EmailChangeForm
          currentEmail={user?.email}
          onSubmit={async (values) => {
            await updateMyEmail(values);
            await refreshUser().catch(() => {});
          }}
        />
      </Section>
    </div>
  );
}
