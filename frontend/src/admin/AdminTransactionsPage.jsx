// Transactions (/admin/transactions) : tous les paiements de la plateforme, filtrables par période,
// statut, promoteur et zone. Les filtres vivent dans l'adresse (partageables, et liens depuis une fiche).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatPhone, formatPrice } from '../utils/format';
import { LoadError, Loading, PageHeader } from './AdminUI';
import { listAllZones, listTransactions, listVendors } from './adminApi';
import { PAYMENT_STATUS, PAYOUT_LABEL, TONE_CLASS, formatDateTime } from './adminFormat';

const FILTER_KEYS = ['from', 'to', 'status', 'vendor_id', 'zone_id'];

const selectClass = 'h-11 rounded-2xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand';

export default function AdminTransactionsPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const key = FILTER_KEYS.map((k) => filters[k]).join('|');

  const [vendors, setVendors] = useState([]);
  const [zones, setZones] = useState([]);
  const [result, setResult] = useState({ key: null, data: null, failed: false });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    listVendors().then(setVendors).catch(() => {});
    listAllZones().then(setZones).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const [from, to, status, vendorId, zoneId] = key.split('|');
    listTransactions({ from, to, status, vendorId, zoneId })
      .then((data) => active && setResult({ key, data, failed: false }))
      .catch(() => active && setResult({ key, data: null, failed: true }));
    return () => {
      active = false;
    };
  }, [key]);

  const data = result.key === key ? result.data : null;
  const zonesShown = filters.vendor_id ? zones.filter((z) => z.owner_id === filters.vendor_id) : zones;

  function setFilter(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    // Changer de promoteur remet le filtre de zone à zéro (la zone appartient à un promoteur).
    if (name === 'vendor_id') next.delete('zone_id');
    setParams(next, { replace: true });
  }

  async function more() {
    setLoadingMore(true);
    try {
      const next = await listTransactions({
        from: filters.from,
        to: filters.to,
        status: filters.status,
        vendorId: filters.vendor_id,
        zoneId: filters.zone_id,
        page: data.page + 1,
      });
      setResult((r) => ({ ...r, data: { ...next, transactions: [...r.data.transactions, ...next.transactions] } }));
    } finally {
      setLoadingMore(false);
    }
  }

  const hasFilter = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Transactions" title="Tous les paiements" />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Du</span>
          <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={selectClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Au</span>
          <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={selectClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Statut</span>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectClass}>
            <option value="">Tous</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Promoteur</span>
          <select value={filters.vendor_id} onChange={(e) => setFilter('vendor_id', e.target.value)} className={`${selectClass} max-w-56`}>
            <option value="">Tous</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.legal_name || v.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-muted">Zone</span>
          <select value={filters.zone_id} onChange={(e) => setFilter('zone_id', e.target.value)} className={`${selectClass} max-w-56`}>
            <option value="">Toutes</option>
            {zonesShown.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        {hasFilter && (
          <button type="button" onClick={() => setParams({}, { replace: true })} className="h-11 px-2 text-sm font-bold text-brand">
            Effacer les filtres
          </button>
        )}
      </div>

      {result.key === key && result.failed ? (
        <LoadError />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 rounded-3xl border border-line bg-white p-5 sm:grid-cols-4">
            {[
              ['Paiements', data.totals.count],
              ['Réussis', data.totals.completed],
              ['Encaissé', formatPrice(data.totals.gross)],
              ['Commissions', formatPrice(data.totals.commission)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-0.5 text-xl font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {data.transactions.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">Aucun paiement pour ces filtres.</p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-line bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-5 py-3 font-bold">Date</th>
                    <th className="px-5 py-3 font-bold">Promoteur · zone</th>
                    <th className="px-5 py-3 font-bold">Forfait</th>
                    <th className="px-5 py-3 font-bold">Client</th>
                    <th className="px-5 py-3 font-bold">Statut</th>
                    <th className="px-5 py-3 text-right font-bold">Montant</th>
                    <th className="px-5 py-3 text-right font-bold">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.transactions.map((t) => {
                    const st = PAYMENT_STATUS[t.status];
                    return (
                      <tr key={t.id}>
                        <td className="px-5 py-3 whitespace-nowrap text-ink">{formatDateTime(t.completed_at || t.created_at)}</td>
                        <td className="px-5 py-3">
                          <span className="block font-bold text-ink">{t.vendor_name}</span>
                          <span className="text-muted">{t.zone_name}</span>
                        </td>
                        <td className="px-5 py-3 text-ink">{t.pricing_name}</td>
                        <td className="px-5 py-3">
                          <span className="block whitespace-nowrap text-ink">{formatPhone(t.phone)}</span>
                          <span className="text-muted">{PAYOUT_LABEL[t.payment_method] || t.payment_method}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-3 py-1 font-bold ${TONE_CLASS[st.tone]}`}>{st.label}</span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-ink">{formatPrice(t.amount)}</td>
                        <td className="px-5 py-3 text-right text-muted">{t.commission_amount != null ? formatPrice(t.commission_amount) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.has_more && (
            <button
              type="button"
              onClick={more}
              disabled={loadingMore}
              className="h-11 w-full rounded-full border border-line bg-white font-bold text-brand transition hover:bg-brand-soft"
            >
              {loadingMore ? 'Un instant…' : 'Voir plus'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
