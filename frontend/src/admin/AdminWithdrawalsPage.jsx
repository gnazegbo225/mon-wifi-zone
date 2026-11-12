// Retraits (/admin/retraits) : à approuver, à payer, payés, rejetés ou annulés.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { formatPhone, formatPrice } from '../utils/format';
import { PAYOUT_LABEL, TONE_CLASS, WITHDRAWAL_STATUS, formatDateTime, since } from './adminFormat';
import { listWithdrawals } from './adminApi';

const TABS = [
  { key: 'pending', label: 'À approuver' },
  { key: 'approved', label: 'À payer' },
  { key: 'paid', label: 'Payés' },
  { key: 'rejected,cancelled', label: 'Rejetés et annulés' },
];

function destination(w) {
  return w.method === 'bank_transfer' ? `${w.bank_name} · ${w.account_number}` : `${PAYOUT_LABEL[w.method]} · ${formatPhone(w.destination_phone)}`;
}

export default function AdminWithdrawalsPage() {
  const [tab, setTab] = useState('pending');
  const [result, setResult] = useState({ tab: null, data: null, failed: false });

  useEffect(() => {
    let active = true;
    listWithdrawals(tab)
      .then((data) => active && setResult({ tab, data, failed: false }))
      .catch(() => active && setResult({ tab, data: null, failed: true }));
    return () => {
      active = false;
    };
  }, [tab]);

  const current = result.tab === tab;
  const data = current ? result.data : null;
  const toProcess = tab === 'pending' || tab === 'approved';

  return (
    <div>
      <p className="text-sm font-bold text-muted">Retraits</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-brand lg:text-4xl">Demandes de retrait</h1>
        {data && toProcess && data.withdrawals.length > 0 && (
          <p className="text-muted">
            {data.withdrawals.length} demande{data.withdrawals.length > 1 ? 's' : ''} ·{' '}
            <span className="font-bold text-ink">{formatPrice(data.total)}</span>
          </p>
        )}
      </div>

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${
              tab === key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {current && result.failed ? (
          <p className="rounded-2xl bg-danger-soft p-4 text-danger">On n’arrive pas à charger les retraits. Recharge la page.</p>
        ) : !data ? (
          <p className="flex items-center gap-2 text-muted">
            <Spinner className="size-5 text-brand" /> Un instant…
          </p>
        ) : data.withdrawals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted">
            {toProcess ? 'Rien à traiter pour l’instant.' : 'Aucun retrait ici.'}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {data.withdrawals.map((w) => {
              const status = WITHDRAWAL_STATUS[w.status];
              return (
                <li key={w.id}>
                  <Link
                    to={`/admin/retraits/${w.id}`}
                    className="grid gap-1 px-5 py-4 transition hover:bg-page sm:grid-cols-[1.3fr_1.3fr_0.8fr_auto] sm:items-center sm:gap-6"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-ink">{w.vendor.name}</span>
                      <span className="block truncate text-sm text-muted">{w.vendor.email}</span>
                    </span>
                    <span className="truncate text-sm text-ink">{destination(w)}</span>
                    <span className="text-sm text-muted">
                      {toProcess ? `Demandé ${since(w.requested_at)}` : formatDateTime(w.paid_at || w.reviewed_at || w.cancelled_at)}
                    </span>
                    <span className="flex items-center gap-3 sm:justify-end">
                      <span className="text-lg font-bold text-ink">{formatPrice(w.amount)}</span>
                      {!toProcess && <span className={`rounded-full px-3 py-1 text-sm font-bold ${TONE_CLASS[status.tone]}`}>{status.label}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
