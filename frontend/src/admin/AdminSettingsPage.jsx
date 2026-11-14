// Paramètres (/admin/parametres) : règles de la plateforme (commission, retrait minimum, attente)
// et compte du super admin. Chaque modification est inscrite au journal.
import { useEffect, useState } from 'react';
import EmailChangeForm from '../components/EmailChangeForm';
import { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { formatPrice } from '../utils/format';
import { LoadError, Loading, PageHeader } from './AdminUI';
import { getSettings, updateAdminEmail, updateSettings } from './adminApi';
import { formatDateTime } from './adminFormat';
import { useAdminAuth } from './useAdminAuth';

function toForm(s) {
  return {
    commission_percent: String(s.commission_percent).replace('.', ','),
    min_withdrawal: String(s.min_withdrawal),
    hold_hours: String(s.hold_hours),
  };
}

function RulesSection() {
  const [settings, setSettings] = useState(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null); // { field, message }
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setForm(toForm(s));
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <LoadError />;
  if (!settings) return <Loading />;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
    if (error?.field === key) setError(null);
  };
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  async function save(event) {
    event.preventDefault();
    const values = {
      commission_percent: Number(form.commission_percent.replace(',', '.')),
      min_withdrawal: Number(form.min_withdrawal),
      hold_hours: Number(form.hold_hours),
    };
    for (const [key, value] of Object.entries(values)) {
      if (form[key].trim() === '' || Number.isNaN(value)) return setError({ field: key, message: 'Écris un nombre.' });
    }
    setBusy(true);
    setError(null);
    try {
      const s = await updateSettings(values);
      setSettings(s);
      setForm(toForm(s));
      setSaved(true);
    } catch (err) {
      setError({ field: err.field, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key) => (error?.field === key ? error.message : null);
  const example = Math.round(1000 * Number(form.commission_percent.replace(',', '.')) / 100);

  return (
    <form onSubmit={save} noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="commission_percent" label="Commission" name="commission_percent" suffix="%" error={fieldError('commission_percent')} hint="Entre 0 et 30 %.">
          {(props) => <input {...props} inputMode="decimal" value={form.commission_percent} onChange={set('commission_percent')} />}
        </Field>
        <Field id="min_withdrawal" label="Retrait minimum" name="min_withdrawal" suffix="FCFA" error={fieldError('min_withdrawal')} hint="Entre 100 et 1 000 000 F.">
          {(props) => <input {...props} inputMode="numeric" value={form.min_withdrawal} onChange={set('min_withdrawal')} />}
        </Field>
        <Field id="hold_hours" label="Attente avant retrait" name="hold_hours" suffix="heures" error={fieldError('hold_hours')} hint="Entre 0 et 720 h.">
          {(props) => <input {...props} inputMode="numeric" value={form.hold_hours} onChange={set('hold_hours')} />}
        </Field>
      </div>

      <p className="mt-4 text-sm text-muted">
        {Number.isFinite(example) && `Sur un ticket à 1 000 F, la plateforme garde ${formatPrice(example)}. `}
        Les ventes déjà faites gardent la commission de leur jour.
      </p>
      {error && !['commission_percent', 'min_withdrawal', 'hold_hours'].includes(error.field) && (
        <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error.message}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          Enregistré. Les nouvelles règles s’appliquent tout de suite.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {settings.updated_at ? `Dernière modification : ${formatDateTime(settings.updated_at)}${settings.updated_by ? ` par ${settings.updated_by}` : ''}` : 'Valeurs de départ.'}
        </p>
        <button
          type="submit"
          disabled={!changed || busy}
          className="flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-bold text-white transition hover:bg-brand-hover disabled:opacity-40"
        >
          {busy && <Spinner className="size-5" />}
          Enregistrer les règles
        </button>
      </div>
    </form>
  );
}

export default function AdminSettingsPage() {
  const { admin, completeLogin } = useAdminAuth();

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader eyebrow="Paramètres" title="Réglages" />

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-bold text-brand">Règles de la plateforme</h2>
        <p className="mt-1 text-sm text-muted">Elles s’appliquent à tous les promoteurs. Chaque modification est inscrite au journal.</p>
        <div className="mt-6">
          <RulesSection />
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-bold text-brand">Ton compte</h2>
        <p className="mt-1 text-sm text-muted">
          Pour changer d’adresse, il faut ton mot de passe actuel et un code de ton application d’authentification.
        </p>
        <div className="mt-6">
          <EmailChangeForm
            withCode
            currentEmail={admin?.email}
            onSubmit={async (values) => {
              const updated = await updateAdminEmail(values);
              completeLogin(updated);
            }}
          />
        </div>
      </section>
    </div>
  );
}
