// Employés (/espace/employes) : le promoteur crée les comptes de ses employés, les désactive ou les
// réactive, et leur donne un nouveau mot de passe. Un employé voit les zones et le stock et importe des
// tickets ; il n'a accès ni aux finances, ni aux forfaits, ni au portail, ni au dossier.
import { useEffect, useState } from 'react';
import FormDialog, { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { createEmployee, getEmployees, resetEmployeePassword, setEmployeeActive } from '../services/api';
import { formatPhone } from '../utils/format';

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

export default function EmployeesPage() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [notice, setNotice] = useState(null); // { text, secret? }
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getEmployees()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="rounded-3xl bg-danger-soft p-5 text-danger">On n’arrive pas à charger tes employés. Recharge la page.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant…
      </p>
    );
  }

  const replace = (employee) => setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === employee.id ? employee : e)) }));

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
            Un employé voit tes zones et ton stock, et importe des tickets. Il n’a pas accès à ton argent, à tes forfaits ni à ton portail.
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

      {data.employees.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-8 text-center text-muted">Pas encore d’employé.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {data.employees.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
              <div className="min-w-0 flex-1">
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
              </div>
              <div className="flex gap-2">
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
          ))}
        </ul>
      )}
      {full && <p className="text-sm text-muted">Tu as atteint le maximum de {data.max} employés.</p>}

      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onCreated={(employee, form) => {
            setAdding(false);
            setData((d) => ({ ...d, employees: [...d.employees, employee] }));
            setNotice({ text: `Compte créé pour ${employee.full_name}. Donne-lui ces informations :`, secret: { email: employee.email, password: form.password } });
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
