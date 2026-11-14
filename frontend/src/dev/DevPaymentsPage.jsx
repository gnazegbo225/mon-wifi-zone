// Paiements (/dev/paiements) : bloqués en attente, payés sans ticket, échoués, récents ; recherche
// par identifiant, identifiant Moneroo ou chiffres du numéro du client.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadError, Loading, PageHeader, Tabs } from '../admin/AdminUI';
import { formatPrice } from '../utils/format';
import { listPayments } from './devApi';
import { PAYMENT_STATUS, TONE_CLASS, formatDateTime, since } from './devFormat';

const VIEWS = [
  { key: 'stuck', label: 'Bloqués' },
  { key: 'no_ticket', label: 'Payés sans ticket' },
  { key: 'failed', label: 'Échoués' },
  { key: 'recent', label: 'Récents' },
];

const EMPTY = {
  stuck: 'Aucun paiement bloqué.',
  no_ticket: 'Tous les paiements réussis ont leur ticket.',
  failed: 'Aucun paiement échoué.',
  recent: 'Aucun paiement.',
};

export default function DevPaymentsPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((v) => v.key === params.get('vue')) ? params.get('vue') : 'stuck';
  const q = params.get('q') || '';
  const key = `${view}|${q}`;
  const [draft, setDraft] = useState(q);
  const [result, setResult] = useState({ key: null, data: null, failed: false });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    listPayments({ view, q })
      .then((data) => alive && setResult({ key, data, failed: false }))
      .catch(() => alive && setResult({ key, data: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [key, view, q]);

  const data = result.key === key ? result.data : null;

  async function more() {
    setLoadingMore(true);
    try {
      const next = await listPayments({ view, q, page: data.page + 1 });
      setResult((r) => ({ ...r, data: { ...next, payments: [...r.data.payments, ...next.payments] } }));
    } finally {
      setLoadingMore(false);
    }
  }

  function search(event) {
    event.preventDefault();
    const value = draft.trim();
    setParams(value ? { q: value } : { vue: view }, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Espace développeur" title="Paiements" />

      <form onSubmit={search} className="flex max-w-xl gap-2">
        <label className="flex-1">
          <span className="sr-only">Rechercher un paiement</span>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Identifiant, identifiant Moneroo ou numéro"
            className="h-11 w-full rounded-full border border-line bg-white px-5 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </label>
        <button type="submit" className="h-11 rounded-full bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-hover">
          Rechercher
        </button>
      </form>

      {q ? (
        <p className="text-sm text-muted">
          Résultats pour « <span className="font-bold text-ink">{q}</span> » ·{' '}
          <button
            type="button"
            className="font-bold text-brand"
            onClick={() => {
              setDraft('');
              setParams({ vue: view }, { replace: true });
            }}
          >
            Effacer
          </button>
        </p>
      ) : (
        <Tabs tabs={VIEWS} value={view} onChange={(v) => setParams({ vue: v }, { replace: true })} label="Paiements à afficher" />
      )}

      {result.key === key && result.failed ? (
        <LoadError />
      ) : !data ? (
        <Loading />
      ) : data.payments.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">{q ? 'Aucun paiement trouvé.' : EMPTY[view]}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-3xl border border-line bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Créé</th>
                  <th className="px-5 py-3 font-bold">Promoteur · zone</th>
                  <th className="px-5 py-3 font-bold">Forfait</th>
                  <th className="px-5 py-3 font-bold">Client</th>
                  <th className="px-5 py-3 font-bold">Statut</th>
                  <th className="px-5 py-3 font-bold">Moneroo</th>
                  <th className="px-5 py-3 text-right font-bold">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.payments.map((p) => {
                  const st = PAYMENT_STATUS[p.status];
                  return (
                    <tr key={p.id} className="transition hover:bg-page">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link to={`/dev/paiements/${p.id}`} className="font-bold text-brand underline-offset-4 hover:underline">
                          {formatDateTime(p.created_at)}
                        </Link>
                        <span className="block text-muted">{since(p.created_at)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="block font-bold text-ink">{p.vendor_name}</span>
                        <span className="text-muted">{p.zone_name}</span>
                      </td>
                      <td className="px-5 py-3 text-ink">{p.pricing_name}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-ink">{p.customer || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-3 py-1 font-bold whitespace-nowrap ${TONE_CLASS[st.tone]}`}>{st.label}</span>
                      </td>
                      <td className="max-w-48 truncate px-5 py-3 font-mono text-muted">{p.syncable ? p.provider_payment_id : 'jamais créé'}</td>
                      <td className="px-5 py-3 text-right font-bold text-ink">{formatPrice(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
