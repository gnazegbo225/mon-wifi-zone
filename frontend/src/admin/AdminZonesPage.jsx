// Zones (/admin/zones) : toutes les zones de la plateforme, avec leur promoteur, leur stock et leurs ventes.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import { LoadError, Loading, PageHeader, Tabs } from './AdminUI';
import { listAllZones } from './adminApi';

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'Actives' },
  { key: 'empty', label: 'Sans stock' },
  { key: 'inactive', label: 'Désactivées' },
];

export default function AdminZonesPage() {
  const [zones, setZones] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    listAllZones()
      .then(setZones)
      .catch(() => setFailed(true));
  }, []);

  const shown = useMemo(() => {
    if (!zones) return [];
    const term = search.trim().toLowerCase();
    return zones
      .filter((z) => tab === 'all' || (tab === 'active' && z.is_active) || (tab === 'inactive' && !z.is_active) || (tab === 'empty' && z.is_active && z.tickets_free === 0))
      .filter((z) => !term || [z.name, z.city, z.owner_name].some((x) => x?.toLowerCase().includes(term)));
  }, [zones, tab, search]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Zones" title={zones ? `${zones.length} zone${zones.length > 1 ? 's' : ''}` : 'Zones'}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zone, ville, promoteur…"
          aria-label="Rechercher une zone"
          className="h-11 w-full rounded-full border border-line bg-white px-4 text-base outline-none focus:border-brand sm:w-72"
        />
      </PageHeader>

      <Tabs label="Filtre" tabs={TABS} value={tab} onChange={setTab} />

      {failed ? (
        <LoadError />
      ) : !zones ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">Aucune zone ici.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Zone</th>
                <th className="px-5 py-3 font-bold">Promoteur</th>
                <th className="px-5 py-3 text-right font-bold">Forfaits actifs</th>
                <th className="px-5 py-3 text-right font-bold">Tickets libres</th>
                <th className="px-5 py-3 text-right font-bold">Vendus</th>
                <th className="px-5 py-3 text-right font-bold">30 derniers jours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((z) => (
                <tr key={z.id} className="transition hover:bg-page">
                  <td className="px-5 py-4">
                    <span className="block font-bold text-ink">
                      {z.name}
                      {!z.is_active && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-sm font-normal text-muted ring-1 ring-line">Désactivée</span>}
                    </span>
                    <span className="text-muted">{z.city}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Link to={`/admin/promoteurs/${z.owner_id}`} className="font-bold text-brand">
                      {z.owner_name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right text-ink">{z.pricings_active}</td>
                  <td className={`px-5 py-4 text-right font-bold ${z.is_active && z.tickets_free === 0 ? 'text-danger' : 'text-ink'}`}>
                    {z.tickets_free}
                    {z.tickets_reserved > 0 && <span className="block font-normal text-muted">{z.tickets_reserved} réservés</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-ink">{z.tickets_sold}</td>
                  <td className="px-5 py-4 text-right">
                    <span className="block font-bold text-ink">{formatPrice(z.gross_30d)}</span>
                    <span className="text-muted">{z.sales_30d} ventes</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
