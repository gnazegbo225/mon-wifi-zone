import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Spinner from '../components/Spinner';
import ZoneFormDialog from '../components/ZoneFormDialog';
import { AlertIcon, ChevronRightIcon, MapPinIcon, PencilIcon, PlusIcon, PowerIcon } from '../components/icons';
import { FilterTabs, Notice, StatusBadge } from '../components/ui';
import { getZones, setZoneActive } from '../services/api';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'Actives' },
  { key: 'inactive', label: 'Désactivées' },
];

const EMPTY_FILTER_TEXT = {
  active: 'Aucune zone active. Active une zone pour que ses forfaits soient en vente.',
  inactive: 'Aucune zone désactivée.',
};

// Même ordre que le backend : actives d'abord, puis par nom.
function sortZones(list) {
  return [...list].sort(
    (a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.name.localeCompare(b.name, 'fr'),
  );
}

export default function ZonesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [zones, setZones] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null : fermé, 'new' : création, objet : modification
  const [togglingId, setTogglingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getZones()
      .then((z) => !cancelled && setZones(z))
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
    setZones(null);
    setAttempt((n) => n + 1);
  }

  function handleSaved(saved, mode) {
    setZones((list) => (mode === 'created' ? sortZones([...list, saved]) : list.map((z) => (z.id === saved.id ? saved : z))));
    setEditing(null);
    setNotice({
      type: 'success',
      text: mode === 'created' ? 'Zone créée. Ajoute-lui maintenant ses forfaits.' : 'Modifications enregistrées.',
    });
  }

  async function toggle(zone) {
    const activate = zone.is_active === false;
    setTogglingId(zone.id);
    setNotice(null);
    try {
      const saved = await setZoneActive(zone.id, activate);
      setZones((list) => list.map((z) => (z.id === saved.id ? saved : z)));
      setNotice({
        type: 'success',
        text: activate
          ? 'Zone activée. Ses forfaits actifs sont de nouveau en vente.'
          : 'Zone désactivée. Ses forfaits ne sont plus proposés aux clients.',
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

  const counts = {
    all: zones?.length || 0,
    active: zones?.filter((z) => z.is_active !== false).length || 0,
    inactive: zones?.filter((z) => z.is_active === false).length || 0,
  };
  const visible = (zones || []).filter((z) =>
    filter === 'active' ? z.is_active !== false : filter === 'inactive' ? z.is_active === false : true,
  );

  return (
    <div className="max-w-6xl space-y-4">
      {/* Barre d'outils : filtres + bouton de création */}
      {isAdmin && zones && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs label="Filtrer les zones" options={FILTERS} value={filter} counts={counts} onChange={setFilter} />
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-brand">
              <PlusIcon className="size-4" />
            </span>
            Nouvelle zone
          </button>
        </div>
      )}

      <Notice notice={notice} />

      {failed ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <AlertIcon className="mt-px size-5 shrink-0" />
          <div>
            <p>On n'arrive pas à charger les zones. Vérifie ta connexion.</p>
            <button type="button" onClick={retry} className="mt-2 font-bold underline underline-offset-2">
              Réessayer
            </button>
          </div>
        </div>
      ) : zones === null ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-5 text-brand" />
          Un instant, on charge les zones…
        </p>
      ) : zones.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MapPinIcon className="size-7" />
          </span>
          <p className="mt-4 text-lg font-bold text-brand">Aucune zone pour l'instant</p>
          <p className="mt-1 max-w-xs text-base text-muted">
            {isAdmin ? 'Crée ta première zone, puis ajoute ses forfaits.' : 'Les zones apparaîtront ici.'}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-base text-muted">
          {EMPTY_FILTER_TEXT[filter]}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((z) => (
            <ZoneCard
              key={z.id}
              zone={z}
              isAdmin={isAdmin}
              toggling={togglingId === z.id}
              onEdit={() => setEditing(z)}
              onToggle={() => toggle(z)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <ZoneFormDialog zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

function ZoneCard({ zone: z, isAdmin, toggling, onEdit, onToggle }) {
  const active = z.is_active !== false;
  const stats = z.stats;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-3xl border p-5 pl-6 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] ${
        active ? 'border-line bg-white' : 'border-dashed border-line bg-white/60'
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${active ? 'bg-accent' : 'bg-line'}`} />

      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ${
            active ? 'bg-brand text-white' : 'bg-page text-muted ring-1 ring-line'
          }`}
          title="Pays"
        >
          {z.country}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-lg leading-snug font-bold break-words ${active ? 'text-brand' : 'text-muted'}`}>{z.name}</p>
          <p className="truncate text-sm text-muted">{z.city}</p>
        </div>
        {isAdmin && <StatusBadge active={active} activeLabel="Active" inactiveLabel="Désactivée" />}
      </div>

      {/* Ce qui est relié à cette zone */}
      {stats && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-page p-3">
            <dt className="text-sm text-muted">Forfaits actifs</dt>
            <dd className="text-2xl font-bold text-ink">{stats.pricings_active}</dd>
            <dd className="text-sm text-muted">sur {stats.pricings_total} au total</dd>
          </div>
          <div className="rounded-2xl bg-page p-3">
            <dt className="text-sm text-muted">Tickets libres</dt>
            <dd className="text-2xl font-bold text-ink">{stats.tickets_free}</dd>
            <dd className="text-sm text-muted">
              {stats.tickets_sold} vendu{stats.tickets_sold > 1 ? 's' : ''} · {stats.tickets_total} au total
            </dd>
          </div>
        </dl>
      )}

      {isAdmin && !active && (
        <p className="mt-3 text-sm text-muted">Ses forfaits ne sont plus proposés aux clients.</p>
      )}

      <Link
        to={`/dashboard/forfaits?zone=${z.id}`}
        className="mt-3 flex items-center justify-between rounded-2xl px-1 py-2 text-sm font-bold text-brand transition hover:text-brand-hover"
      >
        Voir ses forfaits
        <ChevronRightIcon className="size-5" />
      </Link>

      {isAdmin && (
        <div className="mt-auto flex gap-2 pt-3">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Modifier ${z.name}`}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-line text-sm font-bold text-brand transition hover:bg-brand-soft"
          >
            <PencilIcon className="size-4" />
            Modifier
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            aria-label={`${active ? 'Désactiver' : 'Activer'} ${z.name}`}
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
