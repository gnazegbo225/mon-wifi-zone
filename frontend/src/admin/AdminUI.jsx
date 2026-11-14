// Petits éléments partagés par les pages de l'espace super admin.
import Spinner from '../components/Spinner';

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-muted">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand lg:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

// Onglets soulignés. tabs : [{ key, label }]
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(({ key, label: text }) => (
        <button
          key={key}
          role="tab"
          type="button"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${
            value === key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// Choix de période en pastilles (vue d'ensemble).
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-white p-1">
      {options.map(({ key, label: text }) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition sm:px-4 ${value === key ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// Un chiffre clé : libellé, valeur, précision.
export function Kpi({ label, value, hint, highlight = false }) {
  return (
    <div className={`rounded-3xl p-5 ${highlight ? 'bg-brand text-white' : 'border border-line bg-white'}`}>
      <p className={`text-sm ${highlight ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight lg:text-3xl ${highlight ? 'text-white' : 'text-ink'}`}>{value}</p>
      {hint && <p className={`mt-1 text-sm ${highlight ? 'text-white/70' : 'text-muted'}`}>{hint}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <p className="flex items-center gap-2 text-muted">
      <Spinner className="size-5 text-brand" /> Un instant…
    </p>
  );
}

export function LoadError({ children = 'On n’arrive pas à charger ces données. Recharge la page.' }) {
  return <p className="rounded-2xl bg-danger-soft p-4 text-danger">{children}</p>;
}

// Pastille en ligne (verte) ou non (grise), avec le texte à côté : jamais la couleur seule.
export function OnlineDot({ online }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-line'}`} />;
}
