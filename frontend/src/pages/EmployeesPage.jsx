// Employés (/espace/employes) : le promoteur crée les comptes de ses employés, leur confie des zones,
// suit leurs ventes (= ventes de leurs zones), les désactive ou les réactive, et leur donne un nouveau
// mot de passe. Un employé voit le stock de ses zones et importe des tickets ; il n'a accès ni aux
// finances, ni aux forfaits, ni au portail, ni au dossier.
import { useCallback, useEffect, useState } from 'react';
import FormDialog, { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { createEmployee, getEmployees, resetEmployeePassword, setEmployeeActive, setEmployeeZones } from '../services/api';
import { formatPhone, formatPrice } from '../utils/format';

const PERIODS = [
  { key: 'today', label: 'Aujourd’hui' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Ce mois' },
];

const NO_SALES = { count: 0, amount: 0, by_zone: [], by_pricing: [] };

const tickets = (n) => `${n.toLocaleString('fr-FR')} ticket${n > 1 ? 's' : ''}`;

// Mot de passe provisoire lisible (sans 0/O, 1/l) : à donner à l'employé, qui le gardera.
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function activity(e) {
  if (e.online) return 'En ligne';
  if (!e.last_seen_at) return 'Jamais connecté';
  return `Vu le ${dateTime.format(new Date(e.last_seen_at))}`;
}

function PasswordField({ id, value, onChange, error }) {
  return (
    <Field id={id} label="Mot de passe provisoire" name="password" error={error} hint="8 caractères minimum. Donne-le à ton employé.">
      {(props) => (
        <>
          <input {...props} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} />
          <button type="button" onClick={() => onChange(generatePassword())} className="shrink-0 text-sm font-bold text-brand">
            Générer
          </button>
        </>
      )}
    </Field>
  );
}

function AddDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: generatePassword() });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: typeof e === 'string' ? e : e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const employee = await createEmployee(form);
      onCreated(employee, form);
    } catch (err) {
      setError({ field: err.field, message: err.message });
      setSaving(false);
    }
  }

  const fieldError = (key) => (error?.field === key ? error.message : null);
  return (
    <FormDialog
      title="Ajouter un employé"
      subtitle="Il se connectera sur la page de connexion habituelle."
      submitLabel="Créer le compte"
      saving={saving}
      formError={error && !['full_name', 'email', 'phone', 'password'].includes(error.field) ? error.message : null}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field id="emp_name" label="Nom complet" name="full_name" error={fieldError('full_name')}>
        {(props) => <input {...props} value={form.full_name} onChange={set('full_name')} />}
      </Field>
      <Field id="emp_email" label="Email" name="email" error={fieldError('email')}>
        {(props) => <input {...props} type="email" inputMode="email" autoCapitalize="none" spellCheck="false" value={form.email} onChange={set('email')} />}
      </Field>
      <Field id="emp_phone" label="Téléphone" name="phone" optional error={fieldError('phone')}>
        {(props) => <input {...props} type="tel" inputMode="tel" placeholder="07 00 00 00 00" value={form.phone} onChange={set('phone')} />}
      </Field>
      <PasswordField id="emp_password" value={form.password} onChange={set('password')} error={fieldError('password')} />
    </FormDialog>
  );
}

function PasswordDialog({ employee, onClose, onDone }) {
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await resetEmployeePassword(employee.id, password);
      onDone(password);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Nouveau mot de passe"
      subtitle={`Pour ${employee.full_name}. L’ancien ne marchera plus.`}
      submitLabel="Enregistrer"
      saving={saving}
      formError={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <PasswordField id="new_password" value={password} onChange={setPassword} />
    </FormDialog>
  );
}

function ZonesDialog({ employee, zones, onClose, onDone }) {
  const [selected, setSelected] = useState(() => new Set(employee.zone_ids));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setEmployeeZones(employee.id, [...selected]);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Zones confiées"
      subtitle={`${employee.full_name} ne verra que ces zones, et leurs ventes lui seront attribuées.`}
      submitLabel="Enregistrer"
      saving={saving}
      formError={error}
      onSubmit={submit}
      onClose={onClose}
    >
      {zones.length === 0 ? (
        <p className="text-muted">Tu n’as pas encore de zone.</p>
      ) : (
        <fieldset>
          <legend className="sr-only">Zones</legend>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {zones.map((z) => (
              <li key={z.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-page">
                  <input type="checkbox" checked={selected.has(z.id)} onChange={() => toggle(z.id)} className="size-5 accent-brand" />
                  <span className="flex-1 font-bold text-ink">{z.name}</span>
                  {!z.is_active && <span className="text-sm text-muted">Désactivée</span>}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Aucune case cochée : il voit toutes tes zones, et aucune vente ne lui est attribuée.</p>
        </fieldset>
      )}
    </FormDialog>
  );
}

function SalesList({ title, items }) {
  const sold = items.filter((i) => i.count > 0);
  return (
    <div>
      <h3 className="font-bold text-brand">{title}</h3>
      <ul className="mt-1 divide-y divide-line">
        {sold.map((i) => (
          <li key={i.zone_id || i.name} className="flex justify-between gap-4 py-1.5">
            <span className="truncate text-ink">{i.name}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {tickets(i.count)} · <span className="font-bold text-ink">{formatPrice(i.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SalesDetail({ sales }) {
  if (sales.count === 0) return <p className="text-sm text-muted">Aucune vente sur la période.</p>;
  return (
    <div className="grid gap-6 text-sm sm:grid-cols-2">
      <SalesList title="Par zone" items={sales.by_zone} />
      <SalesList title="Par forfait" items={sales.by_pricing} />
    </div>
  );
}

export default function EmployeesPage() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState(null); // { text, secret?, error? }
  const [busyId, setBusyId] = useState(null);

  // « loading » est allumé par l'action qui demande le rechargement (changement de période, zones).
  const load = useCallback((p) => {
    return getEmployees(p)
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  if (failed) return <p className="rounded-3xl bg-danger-soft p-5 text-danger">On n’arrive pas à charger tes employés. Recharge la page.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant…
      </p>
    );
  }

  // La réponse d'une action ne contient ni les zones ni les ventes : on garde celles déjà affichées.
  const replace = (employee) =>
    setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === employee.id ? { ...e, ...employee } : e)) }));
  const zoneName = new Map(data.zones.map((z) => [z.id, z.name]));

  async function toggle(employee) {
    setBusyId(employee.id);
    setNotice(null);
    try {
      replace(await setEmployeeActive(employee.id, !employee.active));
    } catch (err) {
      setNotice({ text: err.message, error: true });
    } finally {
      setBusyId(null);
    }
  }

  const full = data.employees.length >= data.max;

  return (
    <div className="max-w-4xl space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-brand">Ton équipe</h2>
          <p className="mt-1 text-sm text-muted">
            Confie une ou plusieurs zones à chaque employé : il ne voit qu’elles, et tu suis ses ventes. Il n’a pas accès à ton argent, à tes forfaits ni à ton portail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={full}
          className="h-12 shrink-0 rounded-full bg-brand px-6 font-bold text-white transition hover:bg-brand-hover disabled:opacity-40"
        >
          Ajouter un employé
        </button>
      </section>

      {notice && (
        <div role={notice.error ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm ${notice.error ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
          <p>{notice.text}</p>
          {notice.secret && (
            <p className="mt-2">
              Identifiant : <span className="font-bold">{notice.secret.email}</span> · Mot de passe : <span className="font-bold select-all">{notice.secret.password}</span>
            </p>
          )}
        </div>
      )}

      {data.employees.length > 0 && (
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Période des ventes" className="flex w-full gap-1 rounded-full border border-line bg-white p-1 sm:inline-flex sm:w-auto">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => {
                  if (p.key === period) return;
                  setLoading(true);
                  setPeriod(p.key);
                }}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-2 text-sm transition sm:flex-none sm:px-4 ${period === p.key ? 'bg-brand font-bold text-white' : 'text-muted hover:text-brand'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {loading && <Spinner className="size-5 text-brand" />}
        </div>
      )}

      {data.employees.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-8 text-center text-muted">Pas encore d’employé.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {data.employees.map((e) => {
            const open = openId === e.id;
            const assigned = e.zone_ids.length > 0;
            const shared = e.shared_zone_ids.map((z) => zoneName.get(z));
            return (
              <li key={e.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-bold text-ink">
                      {e.full_name}
                      {!e.active && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-sm font-normal text-muted ring-1 ring-line">Désactivé</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {e.email}
                      {e.phone ? ` · ${formatPhone(e.phone)}` : ''}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <span aria-hidden="true" className={`size-2 rounded-full ${e.online ? 'bg-success' : 'bg-line'}`} />
                      {activity(e)}
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {assigned ? e.zone_ids.map((z) => zoneName.get(z)).join(', ') : <span className="text-muted">Toutes les zones · aucune zone confiée</span>}
                    </p>
                  </div>
                  {assigned ? (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : e.id)}
                      aria-expanded={open}
                      className="-mx-3 shrink-0 rounded-2xl px-3 py-1 text-left transition hover:bg-page sm:mx-0 sm:text-right"
                    >
                      <span className="block text-sm text-muted">Ventes de ses zones</span>
                      <span className="block text-xl font-bold tabular-nums text-brand">{formatPrice(e.sales.amount)}</span>
                      <span className="block text-sm text-muted">
                        {tickets(e.sales.count)} · <span className="font-bold text-brand">{open ? 'Masquer' : 'Détail'}</span>
                      </span>
                    </button>
                  ) : (
                    <p className="max-w-56 text-sm text-muted sm:text-right">Confie-lui une zone pour suivre ses ventes.</p>
                  )}
                </div>
                {shared.length > 0 && (
                  <p className="mt-2 text-sm text-muted">
                    {shared.join(', ')} {shared.length > 1 ? 'sont aussi confiées' : 'est aussi confiée'} à un autre employé : ses ventes comptent pour chacun.
                  </p>
                )}
                {open && (
                  <div className="mt-4 rounded-2xl bg-page p-4">
                    <SalesDetail sales={e.sales} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAssigning(e)} className="h-10 rounded-full border border-line px-4 text-sm font-bold text-brand transition hover:bg-brand-soft">
                    Zones
                  </button>
                  <button type="button" onClick={() => setResetting(e)} className="h-10 rounded-full border border-line px-4 text-sm font-bold text-brand transition hover:bg-brand-soft">
                    Mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(e)}
                    disabled={busyId === e.id}
                    className={`h-10 rounded-full px-4 text-sm font-bold transition disabled:opacity-50 ${e.active ? 'text-danger hover:bg-danger-soft' : 'bg-brand text-white hover:bg-brand-hover'}`}
                  >
                    {e.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {full && <p className="text-sm text-muted">Tu as atteint le maximum de {data.max} employés.</p>}

      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onCreated={(employee, form) => {
            setAdding(false);
            setData((d) => ({ ...d, employees: [...d.employees, { ...employee, zone_ids: [], shared_zone_ids: [], sales: NO_SALES }] }));
            setNotice({ text: `Compte créé pour ${employee.full_name}. Donne-lui ces informations :`, secret: { email: employee.email, password: form.password } });
          }}
        />
      )}
      {assigning && (
        <ZonesDialog
          employee={assigning}
          zones={data.zones}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setNotice({ text: `Zones de ${assigning.full_name} enregistrées.` });
            setAssigning(null);
            setLoading(true);
            load(period);
          }}
        />
      )}
      {resetting && (
        <PasswordDialog
          employee={resetting}
          onClose={() => setResetting(null)}
          onDone={(password) => {
            setNotice({ text: `Nouveau mot de passe pour ${resetting.full_name} :`, secret: { email: resetting.email, password } });
            setResetting(null);
          }}
        />
      )}
    </div>
  );
}
