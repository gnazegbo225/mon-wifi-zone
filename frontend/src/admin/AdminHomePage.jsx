// Vue d'ensemble (/admin) : ventes, revenus, commissions, argent dû aux promoteurs, ce qui attend
// une action, et l'activité des promoteurs, sur la période choisie.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import { Kpi, LoadError, Loading, PageHeader, Segmented } from './AdminUI';
import { getOverview } from './adminApi';

const PERIODS = [
  { key: 'today', label: 'Aujourd’hui' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'all', label: 'Tout' },
];

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

function periodLabel(period, bucket) {
  const d = new Date(`${period.length === 7 ? `${period}-01` : period}T00:00:00Z`);
  return bucket === 'month' ? monthFormat.format(d) : dayFormat.format(d);
}

// Barres des montants encaissés, par jour ou par mois.
function SalesChart({ series, bucket }) {
  const max = Math.max(1, ...series.map((s) => s.gross));
  // Trois repères (début, milieu, fin) : lisibles sur téléphone comme sur ordinateur.
  const marks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])].map((i) => series[i]);
  return (
    <div>
      <div className="flex h-56 items-end gap-1 border-b border-line">
        {series.map((s) => (
          <div key={s.period} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-brand/85 transition group-hover:bg-brand"
              style={{ height: s.gross > 0 ? `${Math.max(2, (s.gross / max) * 100)}%` : '2px', opacity: s.gross > 0 ? 1 : 0.25 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
              {periodLabel(s.period, bucket)} · {s.count} vente{s.count > 1 ? 's' : ''} · {formatPrice(s.gross)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        {marks.map((s) => (
          <span key={s.period}>{periodLabel(s.period, bucket)}</span>
        ))}
      </div>
    </div>
  );
}

function TodoLink({ to, count, label, amount }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition hover:bg-page">
      <span className="flex items-center gap-3">
        <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${count > 0 ? 'bg-accent text-brand' : 'bg-page text-muted'}`}>
          {count}
        </span>
        <span className="font-bold text-ink">{label}</span>
      </span>
      <span className="text-sm text-muted">{amount !== undefined ? formatPrice(amount) : ''} ›</span>
    </Link>
  );
}

export default function AdminHomePage() {
  const [period, setPeriod] = useState('30d');
  const [result, setResult] = useState({ period: null, data: null, failed: false });

  useEffect(() => {
    let active = true;
    getOverview(period)
      .then((data) => active && setResult({ period, data, failed: false }))
      .catch(() => active && setResult({ period, data: null, failed: true }));
    return () => {
      active = false;
    };
  }, [period]);

  const data = result.period === period ? result.data : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Vue d’ensemble" title="La plateforme">
        <Segmented label="Période" options={PERIODS} value={period} onChange={setPeriod} />
      </PageHeader>

      {result.period === period && result.failed ? (
        <LoadError />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi highlight label="Encaissé" value={formatPrice(data.sales.gross)} hint={`${data.sales.count} vente${data.sales.count > 1 ? 's' : ''}`} />
            <Kpi label="Commissions gagnées" value={formatPrice(data.sales.commission)} hint="Revenu de la plateforme" />
            <Kpi label="Dû aux promoteurs" value={formatPrice(data.owed.total)} hint="Pas encore versé" />
            <Kpi label="Retraits payés" value={formatPrice(data.withdrawals.paid_amount)} hint={`${data.withdrawals.paid_count} sur la période`} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-3xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold text-brand">Ventes</h2>
                <p className="text-sm text-muted">{data.bucket === 'month' ? 'Par mois' : 'Par jour'}</p>
              </div>
              <div className="mt-6">
                {data.sales.count === 0 ? (
                  <p className="grid h-56 place-items-center text-muted">Aucune vente sur cette période.</p>
                ) : (
                  <SalesChart series={data.series} bucket={data.bucket} />
                )}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-3xl border border-line bg-white p-3">
                <h2 className="px-4 pt-3 pb-2 font-bold text-brand">À traiter</h2>
                <TodoLink to="/admin/verifications" count={data.dossiers_to_review} label="Dossiers à vérifier" />
                <TodoLink to="/admin/retraits" count={data.withdrawals.pending_count} label="Retraits à approuver" amount={data.withdrawals.pending_amount} />
                <TodoLink to="/admin/retraits" count={data.withdrawals.approved_count} label="Retraits à payer" amount={data.withdrawals.approved_amount} />
              </section>

              <section className="rounded-3xl border border-line bg-white p-6">
                <h2 className="font-bold text-brand">Argent des promoteurs</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ['Disponible au retrait', data.owed.available],
                    ['En attente (24 h)', data.owed.pending],
                    ['Retraits en cours', data.owed.in_withdrawal],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-bold text-ink">{formatPrice(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>

          <section>
            <h2 className="font-bold text-brand">Promoteurs</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
              <Kpi label="Inscrits" value={data.vendors.total} hint={`${data.vendors.new} nouveau${data.vendors.new > 1 ? 'x' : ''} sur la période`} />
              <Kpi label="Vérifiés" value={data.vendors.approved} />
              <Kpi label="Actifs" value={data.vendors.active} hint="Au moins une vente" />
              <Kpi label="En ligne" value={data.vendors.online} hint="Ces 5 dernières minutes" />
              <Kpi label="Zones actives" value={data.zones.active} hint={`sur ${data.zones.total}`} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
