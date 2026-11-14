// Relectures Moneroo (/dev/relectures) : chaque relecture d'un paiement chez Moneroo, par le webhook,
// la page de retour du client ou le développeur, avec son résultat. Les plus récentes d'abord.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadError, Loading, PageHeader, Segmented } from '../admin/AdminUI';
import EventRow from './EventRow';
import { listEvents } from './devApi';

const SOURCES = [
  { key: '', label: 'Toutes' },
  { key: 'webhook', label: 'Webhooks' },
  { key: 'return_page', label: 'Page de retour' },
  { key: 'developer', label: 'Développeur' },
];

export default function DevEventsPage() {
  const [params, setParams] = useSearchParams();
  const source = SOURCES.some((s) => s.key === params.get('source')) ? params.get('source') : '';
  const problems = params.get('problemes') === '1';
  const key = `${source}|${problems}`;
  const [result, setResult] = useState({ key: null, data: null, failed: false });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    listEvents({ source, problems })
      .then((data) => alive && setResult({ key, data, failed: false }))
      .catch(() => alive && setResult({ key, data: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [key, source, problems]);

  const data = result.key === key ? result.data : null;

  function update(next) {
    const merged = { source, problems, ...next };
    const p = {};
    if (merged.source) p.source = merged.source;
    if (merged.problems) p.problemes = '1';
    setParams(p, { replace: true });
  }

  async function more() {
    setLoadingMore(true);
    try {
      const next = await listEvents({ source, problems, page: data.page + 1 });
      setResult((r) => ({ ...r, data: { ...next, events: [...r.data.events, ...next.events] } }));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Espace développeur" title="Relectures Moneroo" />
      <p className="max-w-3xl text-sm text-muted">
        À chaque webhook, le serveur relit le paiement chez Moneroo avant de délivrer un ticket. La page de retour du client fait de même quand le webhook tarde : seules ses relectures qui changent un statut sont inscrites.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Segmented options={SOURCES} value={source} onChange={(s) => update({ source: s })} label="Origine" />
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" checked={problems} onChange={(e) => update({ problems: e.target.checked })} className="size-5 accent-brand" />
          Problèmes seulement
        </label>
      </div>

      {result.key === key && result.failed ? (
        <LoadError />
      ) : !data ? (
        <Loading />
      ) : data.events.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">Aucune relecture.</p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-3xl border border-line bg-white px-6 text-sm">
            {data.events.map((e) => (
              <EventRow key={e.id} e={e} showPayment />
            ))}
          </ul>
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
