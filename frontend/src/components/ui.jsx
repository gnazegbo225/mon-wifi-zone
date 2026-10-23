// Petits éléments partagés par les pages de gestion (forfaits, zones…).
import { AlertIcon, CheckIcon, PowerIcon } from './icons';

// Filtres en pastilles : Tous / Actifs / Désactivés, avec le nombre d'éléments.
// options : [{ key, label }], counts : { [key]: nombre }
export function FilterTabs({ label, options, value, counts, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-3 gap-1 rounded-full border border-line bg-white p-1 sm:inline-grid sm:w-auto"
    >
      {options.map(({ key, label: optionLabel }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition sm:px-4 ${
            value === key ? 'bg-brand font-bold text-white' : 'text-muted hover:text-brand'
          }`}
        >
          {optionLabel}
          <span
            className={`rounded-full px-1.5 text-sm ${value === key ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}
          >
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  );
}

// Pastille d'état : toujours un mot + une icône, jamais seulement une couleur (charte).
export function StatusBadge({ active, activeLabel = 'Actif', inactiveLabel = 'Désactivé' }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-sm font-bold text-success">
      <CheckIcon className="size-4" /> {activeLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-0.5 text-sm font-bold text-muted ring-1 ring-line">
      <PowerIcon className="size-4" /> {inactiveLabel}
    </span>
  );
}

// Message après une action. notice : { type: 'success' | 'error', text }
export function Notice({ notice }) {
  if (!notice) return null;
  const isError = notice.type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
        isError ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
      }`}
    >
      {isError ? <AlertIcon className="mt-px size-5 shrink-0" /> : <CheckIcon className="mt-px size-5 shrink-0" />}
      <p>{notice.text}</p>
    </div>
  );
}
