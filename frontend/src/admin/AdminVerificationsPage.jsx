// Vérifications (/admin/verifications) : les dossiers envoyés par les promoteurs, les plus anciens d'abord.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { formatPhone } from '../utils/format';
import { STATUS_LABEL, since } from './adminFormat';
import { listVendors } from './adminApi';

const TABS = [
  { key: 'pending_review', label: 'À vérifier' },
  { key: 'rejected', label: 'Rejetés' },
  { key: 'approved', label: 'Vérifiés' },
];

export default function AdminVerificationsPage() {
  const [tab, setTab] = useState('pending_review');
  // Résultat du dernier chargement, avec l'onglet auquel il correspond.
  const [result, setResult] = useState({ tab: null, vendors: null, failed: false });

  useEffect(() => {
    let active = true;
    listVendors({ status: tab, submitted: tab === 'pending_review' })
      .then((list) => active && setResult({ tab, vendors: list, failed: false }))
      .catch(() => active && setResult({ tab, vendors: null, failed: true }));
    return () => {
      active = false;
    };
  }, [tab]);

  const current = result.tab === tab;
  const vendors = current ? result.vendors : null;
  const failed = current && result.failed;

  return (
    <div>
      <p className="text-sm font-bold text-muted">Vérifications</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand lg:text-4xl">Dossiers des promoteurs</h1>

      <div role="tablist" className="mt-8 flex gap-1 border-b border-line">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold transition ${
              tab === key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {failed ? (
          <p className="rounded-2xl bg-danger-soft p-4 text-danger">On n’arrive pas à charger les dossiers. Recharge la page.</p>
        ) : !vendors ? (
          <p className="flex items-center gap-2 text-muted">
            <Spinner className="size-5 text-brand" /> Un instant…
          </p>
        ) : vendors.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">
            {tab === 'pending_review' ? 'Aucun dossier à vérifier.' : 'Aucun dossier ici.'}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {vendors.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/admin/verifications/${v.id}`}
                  className="grid gap-1 px-5 py-4 transition hover:bg-page sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center sm:gap-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{v.legal_name || v.full_name}</span>
                    <span className="block truncate text-sm text-muted">{v.email}</span>
                  </span>
                  <span className="text-sm text-ink">{formatPhone(v.phone) || '—'}</span>
                  <span className="text-sm text-muted">
                    {tab === 'pending_review' ? `Envoyé ${since(v.submitted_at)}` : `${v.city || '—'}`}
                  </span>
                  <span className="text-sm font-bold text-brand">{tab === 'pending_review' ? 'Vérifier ›' : STATUS_LABEL[v.account_status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
