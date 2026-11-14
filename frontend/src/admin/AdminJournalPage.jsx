// Journal (/admin/journal) : chaque action du super admin, la plus récente d'abord.
// Le journal ne se modifie pas et ne s'efface pas (base de données).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadError, Loading, PageHeader, Tabs } from './AdminUI';
import { listAudit } from './adminApi';
import { AUDIT_FAMILIES, AUDIT_LABEL, auditLink, describeAudit, formatDateTime } from './adminFormat';

export default function AdminJournalPage() {
  const [family, setFamily] = useState('');
  const [result, setResult] = useState({ family: null, data: null, failed: false });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    listAudit({ action: family })
      .then((data) => active && setResult({ family, data, failed: false }))
      .catch(() => active && setResult({ family, data: null, failed: true }));
    return () => {
      active = false;
    };
  }, [family]);

  const data = result.family === family ? result.data : null;

  async function more() {
    setLoadingMore(true);
    try {
      const next = await listAudit({ action: family, page: data.page + 1 });
      setResult((r) => ({ ...r, data: { ...next, entries: [...r.data.entries, ...next.entries] } }));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Journal" title="Actions du super admin" />
      <p className="-mt-2 max-w-2xl text-muted">Qui a fait quoi, et quand. Les lignes ne peuvent être ni modifiées ni effacées.</p>

      <Tabs label="Type d’action" tabs={AUDIT_FAMILIES} value={family} onChange={setFamily} />

      {result.family === family && result.failed ? (
        <LoadError />
      ) : !data ? (
        <Loading />
      ) : data.entries.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">Aucune action ici pour l’instant.</p>
      ) : (
        <>
          <ol className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {data.entries.map((e) => {
              const link = auditLink(e);
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{AUDIT_LABEL[e.action] || e.action}</span>
                    <span className="block truncate text-sm text-muted">{describeAudit(e)}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm text-muted">
                    <span className="block">{formatDateTime(e.created_at)}</span>
                    <span className="block">
                      {e.actor_name}
                      {e.ip ? ` · ${e.ip}` : ''}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={e.id}>
                  {link ? (
                    <Link to={link} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-page">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-4 px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
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
