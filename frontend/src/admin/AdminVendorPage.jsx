// Fiche d'un promoteur (/admin/promoteurs/:id) : activité, chiffres, zones, ventes, retraits,
// et suspension ou réactivation du compte.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatPhone, formatPrice } from '../utils/format';
import { Kpi, LoadError, Loading, OnlineDot } from './AdminUI';
import { getVendor, reactivateVendor, suspendVendor } from './adminApi';
import { PAYOUT_LABEL, STATUS_LABEL, TONE_CLASS, WITHDRAWAL_STATUS, formatDateTime, lastSeen } from './adminFormat';

function Section({ title, action, children }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold text-brand">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }) => <p className="text-sm text-muted">{children}</p>;

export default function AdminVendorPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getVendor(id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);
  useEffect(load, [load]);

  if (failed) return <LoadError>Promoteur introuvable.</LoadError>;
  if (!data) return <Loading />;

  const { vendor, profile, stats, zones, withdrawals, recent_sales: sales } = data;
  const status = vendor.account_status;
  const s = stats || {};

  async function changeStatus() {
    setBusy(true);
    setError(null);
    try {
      setData(status === 'suspended' ? await reactivateVendor(id, reason) : await suspendVendor(id, reason));
      setConfirming(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/promoteurs" className="text-sm font-bold text-muted transition hover:text-brand">
          ‹ Promoteurs
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand lg:text-4xl">{profile.legal_name || vendor.full_name}</h1>
            <p className="mt-2 text-muted">
              {vendor.email} · {formatPhone(vendor.phone) || '—'}
              {profile.city ? ` · ${profile.city}` : ''}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink">
              <OnlineDot online={vendor.online} /> {lastSeen(vendor)} · inscrit le {formatDateTime(vendor.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand ring-1 ring-line">{STATUS_LABEL[status]}</span>
            <Link to={`/admin/verifications/${vendor.id}`} className="text-sm font-bold text-brand underline underline-offset-2">
              Voir le dossier
            </Link>
            {(status === 'approved' || status === 'suspended') && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`h-10 rounded-full px-4 text-sm font-bold transition ${
                  status === 'suspended' ? 'bg-brand text-white hover:bg-brand-hover' : 'text-danger hover:bg-danger-soft'
                }`}
              >
                {status === 'suspended' ? 'Réactiver' : 'Suspendre'}
              </button>
            )}
          </div>
        </div>

        {confirming && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changeStatus();
            }}
            className="mt-6 rounded-3xl border border-line bg-white p-5"
          >
            <label htmlFor="status-reason" className="block text-sm font-bold text-ink">
              {status === 'suspended' ? 'Note (facultatif)' : 'Motif de la suspension'}
            </label>
            <p className="mt-1 text-sm text-muted">
              {status === 'suspended'
                ? 'Le promoteur et ses employés retrouvent l’accès tout de suite.'
                : 'Le promoteur et ses employés perdent l’accès tout de suite. Ses zones restent en vente tant que tu ne les désactives pas.'}
            </p>
            <input
              id="status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 h-12 w-full rounded-2xl border border-line bg-page px-3 text-base outline-none focus:border-brand focus:bg-white"
            />
            {error && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="h-11 rounded-full border border-line px-5 font-bold text-brand">
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy || (status !== 'suspended' && !reason.trim())}
                className={`h-11 rounded-full px-5 font-bold text-white disabled:opacity-50 ${status === 'suspended' ? 'bg-brand' : 'bg-danger'}`}
              >
                {status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}
              </button>
            </div>
          </form>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi highlight label="Ventes" value={formatPrice(s.gross || 0)} hint={`${s.sales_count || 0} tickets · commission ${formatPrice(s.commissions || 0)}`} />
        <Kpi label="Disponible" value={formatPrice(s.available || 0)} hint={`En attente : ${formatPrice(s.pending || 0)}`} />
        <Kpi label="Retraits en cours" value={formatPrice(s.in_withdrawal || 0)} />
        <Kpi label="Déjà retiré" value={formatPrice(s.withdrawn || 0)} hint={s.last_sale_at ? `Dernière vente : ${formatDateTime(s.last_sale_at)}` : 'Aucune vente'} />
      </section>

      <Section title={`Zones (${zones.length})`}>
        {zones.length === 0 ? (
          <Empty>Aucune zone.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 font-bold">Zone</th>
                  <th className="pb-2 text-right font-bold">Forfaits actifs</th>
                  <th className="pb-2 text-right font-bold">Tickets libres</th>
                  <th className="pb-2 text-right font-bold">Vendus</th>
                  <th className="pb-2 text-right font-bold">30 derniers jours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td className="py-3">
                      <span className="font-bold text-ink">{z.name}</span>
                      <span className="text-muted"> · {z.city}</span>
                      {!z.is_active && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-muted ring-1 ring-line">Désactivée</span>}
                    </td>
                    <td className="py-3 text-right">{z.pricings_active}</td>
                    <td className={`py-3 text-right font-bold ${z.tickets_free === 0 ? 'text-danger' : 'text-ink'}`}>{z.tickets_free}</td>
                    <td className="py-3 text-right">{z.tickets_sold}</td>
                    <td className="py-3 text-right">{formatPrice(z.gross_30d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Dernières ventes"
          action={
            <Link to={`/admin/transactions?vendor_id=${vendor.id}`} className="text-sm font-bold text-brand">
              Toutes ›
            </Link>
          }
        >
          {sales.length === 0 ? (
            <Empty>Aucune vente.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {sales.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-3">
                  <span>
                    <span className="block font-bold text-ink">
                      {p.pricing_name} · {p.zone_name}
                    </span>
                    <span className="text-muted">{formatDateTime(p.completed_at)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold text-ink">{formatPrice(p.amount)}</span>
                    <span className="text-muted">− {formatPrice(p.commission_amount || 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Retraits">
          {withdrawals.length === 0 ? (
            <Empty>Aucun retrait.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {withdrawals.map((w) => {
                const st = WITHDRAWAL_STATUS[w.status];
                return (
                  <li key={w.id}>
                    <Link to={`/admin/retraits/${w.id}`} className="flex items-center justify-between gap-4 py-3">
                      <span>
                        <span className="block font-bold text-ink">{formatPrice(w.amount)}</span>
                        <span className="text-muted">
                          {formatDateTime(w.requested_at)} · {PAYOUT_LABEL[w.method]}
                        </span>
                      </span>
                      <span className={`rounded-full px-3 py-1 font-bold ${TONE_CLASS[st.tone]}`}>{st.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
