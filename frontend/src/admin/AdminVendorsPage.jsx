// Promoteurs (/admin/promoteurs) : statut, activité, zones, ventes et solde de chacun.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import { LoadError, Loading, OnlineDot, PageHeader, Tabs } from './AdminUI';
import { listVendors } from './adminApi';
import { STATUS_LABEL, lastSeen } from './adminFormat';

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'approved', label: 'Vérifiés' },
  { key: 'pending_review', label: 'En attente' },
  { key: 'rejected', label: 'Rejetés' },
  { key: 'suspended', label: 'Suspendus' },
];

const STATUS_TONE = {
  approved: 'bg-success-soft text-success',
  pending_review: 'bg-brand-soft text-brand',
  rejected: 'bg-danger-soft text-danger',
  suspended: 'bg-page text-muted ring-1 ring-line',
};

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    listVendors()
      .then(setVendors)
      .catch(() => setFailed(true));
  }, []);

  const shown = useMemo(() => {
    if (!vendors) return [];
    const term = search.trim().toLowerCase();
    return vendors
      .filter((v) => tab === 'all' || v.account_status === tab)
      .filter((v) => !term || [v.full_name, v.legal_name, v.email, v.phone, v.city].some((x) => x?.toLowerCase().includes(term)))
      .sort((a, b) => (b.stats?.gross || 0) - (a.stats?.gross || 0));
  }, [vendors, tab, search]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Promoteurs" title={vendors ? `${vendors.length} promoteur${vendors.length > 1 ? 's' : ''}` : 'Promoteurs'}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, email, téléphone, ville…"
          aria-label="Rechercher un promoteur"
          className="h-11 w-full rounded-full border border-line bg-white px-4 text-base outline-none focus:border-brand sm:w-72"
        />
      </PageHeader>

      <Tabs label="Statut" tabs={TABS} value={tab} onChange={setTab} />

      {failed ? (
        <LoadError />
      ) : !vendors ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">Aucun promoteur ici.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Promoteur</th>
                <th className="px-5 py-3 font-bold">Activité</th>
                <th className="px-5 py-3 font-bold">Statut</th>
                <th className="px-5 py-3 text-right font-bold">Zones</th>
                <th className="px-5 py-3 text-right font-bold">Ventes</th>
                <th className="px-5 py-3 text-right font-bold">Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((v) => (
                <tr key={v.id} className="transition hover:bg-page">
                  <td className="px-5 py-4">
                    <Link to={`/admin/promoteurs/${v.id}`} className="block">
                      <span className="block font-bold text-ink">{v.legal_name || v.full_name}</span>
                      <span className="block text-muted">{v.email}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2 text-ink">
                      <OnlineDot online={v.online} />
                      {lastSeen(v)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 font-bold ${STATUS_TONE[v.account_status]}`}>{STATUS_LABEL[v.account_status]}</span>
                  </td>
                  <td className="px-5 py-4 text-right text-ink">
                    {v.stats?.zones_active ?? 0}
                    <span className="text-muted"> / {v.stats?.zones_total ?? 0}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="block font-bold text-ink">{formatPrice(v.stats?.gross || 0)}</span>
                    <span className="block text-muted">{v.stats?.sales_count || 0} ventes</span>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-ink">{formatPrice(v.stats?.available || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
