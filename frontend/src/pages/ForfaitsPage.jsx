import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import PricingFormDialog from '../components/PricingFormDialog';
import Spinner from '../components/Spinner';
import { AlertIcon, CloseIcon, MapPinIcon, PencilIcon, PlusIcon, PowerIcon, TagIcon } from '../components/icons';
import { FilterTabs, Notice, StatusBadge } from '../components/ui';
import { getPricings, getZones, setPricingActive } from '../services/api';

const priceFormat = new Intl.NumberFormat('fr-FR');

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'inactive', label: 'Désactivés' },
];

const EMPTY_FILTER_TEXT = {
  all: 'Aucun forfait dans cette zone pour l’instant.',
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [pricings, setPricings] = useState(null);
  const [zones, setZones] = useState([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null : fermé, 'new' : création, objet : modification
  const [togglingId, setTogglingId] = useState(null);
  const [notice, setNotice] = useState(null);

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
            : err?.status === 409
              ? err.message
              : 'Le changement n’a pas marché. Réessaie dans un instant.',
      });
    } finally {
      setTogglingId(null);
    }
  }

  const zonesById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const hasActiveZone = zones.some((z) => z.is_active !== false);

  // Filtre par zone (?zone=<id>), par exemple depuis « Voir ses forfaits » sur la page Zones.
  const zoneFilter = zonesById[searchParams.get('zone')] || null;
  const inZone = (pricings || []).filter((p) => !zoneFilter || p.wifi_zone_id === zoneFilter.id);

  const counts = {
    all: inZone.length,
    active: inZone.filter((p) => p.is_active !== false).length,
    inactive: inZone.filter((p) => p.is_active === false).length,
  };
  const visible = inZone.filter((p) =>
    filter === 'active' ? p.is_active !== false : filter === 'inactive' ? p.is_active === false : true,
  );

  return (
    <div className="max-w-6xl space-y-4">
      {/* Barre d'outils : filtres + bouton de création */}
      {isAdmin && pricings && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs label="Filtrer les forfaits" options={FILTERS} value={filter} counts={counts} onChange={setFilter} />
          <button
            type="button"
            onClick={() => setEditing('new')}
            disabled={!hasActiveZone}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-brand">
              <PlusIcon className="size-4" />
            </span>
            Nouveau forfait
          </button>
        </div>
      )}

      {isAdmin && pricings && !hasActiveZone && (
        <p className="text-sm text-muted">
          Un forfait appartient toujours à une zone.{' '}
          <Link to="/dashboard/zones" className="font-bold text-brand underline underline-offset-2">
            Crée ou active d’abord une zone
          </Link>
          .
        </p>
      )}

      {zoneFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1 pr-1 pl-3 text-sm text-ink">
            <MapPinIcon className="size-4 shrink-0 text-brand" />
            <span className="truncate">
              Zone : <strong className="text-brand">{zoneFilter.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              aria-label="Voir les forfaits de toutes les zones"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-brand"
            >
              <CloseIcon className="size-4" />
            </button>
          </span>
          {zoneFilter.is_active === false && (
            <span className="text-sm text-muted">Zone désactivée : ses forfaits ne sont pas proposés aux clients.</span>
          )}
        </div>
      )}

      <Notice notice={notice} />

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
              zone={zonesById[p.wifi_zone_id]}
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
          defaultZoneId={zoneFilter?.is_active !== false ? zoneFilter?.id : undefined}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function PricingCard({ pricing: p, zone, isAdmin, toggling, onEdit, onToggle }) {
  const active = p.is_active !== false;
  const zoneActive = zone?.is_active !== false;
  // Un forfait est en vente seulement s'il est actif ET que sa zone est active.
  const onSale = active && zoneActive;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-3xl border p-5 pl-6 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] transition ${
        onSale ? 'border-line bg-white' : 'border-dashed border-line bg-white/60'
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${onSale ? 'bg-accent' : 'bg-line'}`} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge active={active} />
        {zone && <span className="truncate text-sm text-muted">{zone.name}</span>}
      </div>

      <p className={`mt-3 text-lg font-bold ${onSale ? 'text-brand' : 'text-muted'}`}>{p.name}</p>
      <p className={`mt-1 text-2xl font-bold ${onSale ? 'text-ink' : 'text-muted'}`}>
        {priceFormat.format(p.amount)} <span className="text-base">FCFA</span>
      </p>
      <p className="mt-1 text-sm text-muted">{[p.duration_label, p.speed_label].filter(Boolean).join(' · ')}</p>

      {isAdmin && p.ticket_profile && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          Profil MikroTik
          <code className="rounded-lg bg-brand-soft px-2 py-0.5 font-mono text-sm text-brand">{p.ticket_profile}</code>
        </p>
      )}

      {isAdmin && !zoneActive && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-page px-3 py-2 text-sm text-muted">
          <PowerIcon className="mt-px size-4 shrink-0" />
          Sa zone est désactivée : ce forfait n’est pas proposé aux clients.
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
            // Réactiver un forfait n'a pas de sens tant que sa zone est désactivée.
            disabled={toggling || (!active && !zoneActive)}
            title={!active && !zoneActive ? 'Active d’abord sa zone sur la page Zones.' : undefined}
            aria-label={`${active ? 'Désactiver' : 'Activer'} ${p.name}`}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
