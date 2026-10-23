import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import PricingFormDialog from '../components/PricingFormDialog';
import Spinner from '../components/Spinner';
import { AlertIcon, CheckIcon, PencilIcon, PlusIcon, PowerIcon, TagIcon } from '../components/icons';
import { getPricings, getZones, setPricingActive } from '../services/api';

const priceFormat = new Intl.NumberFormat('fr-FR');

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'inactive', label: 'Désactivés' },
];

const EMPTY_FILTER_TEXT = {
  active: 'Aucun forfait actif. Active un forfait pour que tes clients puissent l’acheter.',
  inactive: 'Aucun forfait désactivé.',
};

// Même ordre que le backend : actifs d'abord, puis du moins cher au plus cher.
function sortPricings(list) {
  return [...list].sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.amount - b.amount);
}

export default function ForfaitsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [pricings, setPricings] = useState(null);
  const [zones, setZones] = useState([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null : fermé, 'new' : création, objet : modification
  const [togglingId, setTogglingId] = useState(null);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPricings(), getZones()])
      .then(([p, z]) => {
        if (cancelled) return;
        setPricings(p);
        setZones(z);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Le message de confirmation disparaît tout seul.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function retry() {
    setFailed(false);
    setPricings(null);
    setAttempt((n) => n + 1);
  }

  function handleSaved(saved, mode) {
    setPricings((list) =>
      mode === 'created' ? sortPricings([...list, saved]) : list.map((p) => (p.id === saved.id ? saved : p)),
    );
    setEditing(null);
    setNotice({
      type: 'success',
      text: mode === 'created' ? 'Forfait créé. Tes clients peuvent déjà l’acheter.' : 'Modifications enregistrées.',
    });
  }

  async function toggle(pricing) {
    const activate = pricing.is_active === false;
    setTogglingId(pricing.id);
    setNotice(null);
    try {
      const saved = await setPricingActive(pricing.id, activate);
      setPricings((list) => list.map((p) => (p.id === saved.id ? saved : p)));
      setNotice({
        type: 'success',
        text: activate ? 'Forfait activé. Tes clients peuvent l’acheter.' : 'Forfait désactivé. Tes clients ne le voient plus.',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err?.status === 0
            ? 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.'
            : 'Le changement n’a pas marché. Réessaie dans un instant.',
      });
    } finally {
      setTogglingId(null);
    }
  }

  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const counts = {
    all: pricings?.length || 0,
    active: pricings?.filter((p) => p.is_active !== false).length || 0,
    inactive: pricings?.filter((p) => p.is_active === false).length || 0,
  };
  const visible = (pricings || []).filter((p) =>
    filter === 'active' ? p.is_active !== false : filter === 'inactive' ? p.is_active === false : true,
  );

  return (
    <div className="max-w-6xl space-y-4">
      {/* Barre d'outils : filtres + bouton de création */}
      {isAdmin && pricings && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="group"
            aria-label="Filtrer les forfaits"
            className="grid grid-cols-3 gap-1 rounded-full border border-line bg-white p-1 sm:inline-grid sm:w-auto"
          >
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition sm:px-4 ${
                  filter === key ? 'bg-brand font-bold text-white' : 'text-muted hover:text-brand'
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-sm ${filter === key ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}
                >
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEditing('new')}
            disabled={zones.length === 0}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-brand">
              <PlusIcon className="size-4" />
            </span>
            Nouveau forfait
          </button>
        </div>
      )}

      {isAdmin && pricings && zones.length === 0 && (
        <p className="text-sm text-muted">Crée d’abord une zone WiFi pour pouvoir ajouter un forfait.</p>
      )}

      {/* Message après une action */}
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
            notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertIcon className="mt-px size-5 shrink-0" />
          ) : (
            <CheckIcon className="mt-px size-5 shrink-0" />
          )}
          <p>{notice.text}</p>
        </div>
      )}

      {failed ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <AlertIcon className="mt-px size-5 shrink-0" />
          <div>
            <p>On n'arrive pas à charger les forfaits. Vérifie ta connexion.</p>
            <button type="button" onClick={retry} className="mt-2 font-bold underline underline-offset-2">
              Réessayer
            </button>
          </div>
        </div>
      ) : pricings === null ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-5 text-brand" />
          Un instant, on charge les forfaits…
        </p>
      ) : pricings.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <TagIcon className="size-7" />
          </span>
          <p className="mt-4 text-lg font-bold text-brand">Aucun forfait pour l'instant</p>
          <p className="mt-1 max-w-xs text-base text-muted">
            {isAdmin ? 'Crée ton premier forfait pour commencer à vendre des tickets.' : 'Les forfaits apparaîtront ici.'}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-base text-muted">
          {EMPTY_FILTER_TEXT[filter]}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <PricingCard
              key={p.id}
              pricing={p}
              zoneName={zoneName[p.wifi_zone_id]}
              isAdmin={isAdmin}
              toggling={togglingId === p.id}
              onEdit={() => setEditing(p)}
              onToggle={() => toggle(p)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <PricingFormDialog
          pricing={editing === 'new' ? null : editing}
          zones={zones}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function PricingCard({ pricing: p, zoneName, isAdmin, toggling, onEdit, onToggle }) {
  const active = p.is_active !== false;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-3xl border p-5 pl-6 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] transition ${
        active ? 'border-line bg-white' : 'border-dashed border-line bg-white/60'
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${active ? 'bg-accent' : 'bg-line'}`} />

      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-sm font-bold text-success">
            <CheckIcon className="size-4" /> Actif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-0.5 text-sm font-bold text-muted ring-1 ring-line">
            <PowerIcon className="size-4" /> Désactivé
          </span>
        )}
        {zoneName && <span className="truncate text-sm text-muted">{zoneName}</span>}
      </div>

      <p className={`mt-3 text-lg font-bold ${active ? 'text-brand' : 'text-muted'}`}>{p.name}</p>
      <p className={`mt-1 text-2xl font-bold ${active ? 'text-ink' : 'text-muted'}`}>
        {priceFormat.format(p.amount)} <span className="text-base">FCFA</span>
      </p>
      <p className="mt-1 text-sm text-muted">{[p.duration_label, p.speed_label].filter(Boolean).join(' · ')}</p>

      {isAdmin && p.ticket_profile && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          Profil MikroTik
          <code className="rounded-lg bg-brand-soft px-2 py-0.5 font-mono text-sm text-brand">{p.ticket_profile}</code>
        </p>
      )}

      {isAdmin && (
        <div className="mt-auto flex gap-2 pt-5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Modifier ${p.name}`}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-line text-sm font-bold text-brand transition hover:bg-brand-soft"
          >
            <PencilIcon className="size-4" />
            Modifier
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            aria-label={`${active ? 'Désactiver' : 'Activer'} ${p.name}`}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition disabled:cursor-wait ${
              active
                ? 'border border-line text-ink hover:border-danger hover:text-danger'
                : 'bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {toggling ? <Spinner className="size-4" /> : <PowerIcon className="size-4" />}
            {active ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      )}
    </li>
  );
}
