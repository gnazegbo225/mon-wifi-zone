// Un retrait (/admin/retraits/:id) : où envoyer l'argent, le solde du promoteur, l'historique,
// et l'action du moment : approuver ou rejeter, puis marquer payé avec la référence du transfert.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { formatPhone, formatPrice } from '../utils/format';
import { PAYOUT_LABEL, TONE_CLASS, WITHDRAWAL_STATUS, formatDateTime } from './adminFormat';
import { approveWithdrawal, getWithdrawal, markWithdrawalPaid, rejectWithdrawal } from './adminApi';

const EVENT_LABEL = {
  pending: 'Demande envoyée',
  approved: 'Approuvé',
  paid: 'Payé',
  rejected: 'Rejeté',
  cancelled: 'Annulé par le promoteur',
};

function Copyable({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-page px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="truncate text-lg font-bold text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(String(value).replace(/\s/g, ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // presse-papiers refusé : la valeur reste lisible
          }
        }}
        className="shrink-0 text-sm font-bold text-brand"
      >
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

export default function AdminWithdrawalPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState(null); // reject | pay
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getWithdrawal(id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);
  useEffect(load, [load]);

  if (failed) return <p className="rounded-2xl bg-danger-soft p-4 text-danger">Retrait introuvable.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant…
      </p>
    );
  }

  const { withdrawal: w, vendor_balance: balance, events } = data;
  const status = WITHDRAWAL_STATUS[w.status];
  const isBank = w.method === 'bank_transfer';

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      setData(await action());
      setMode(null);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/admin/retraits" className="text-sm font-bold text-muted transition hover:text-brand">
        ‹ Retraits
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-bold tracking-tight text-brand">{formatPrice(w.amount)}</p>
          <p className="mt-2 text-muted">
            {w.vendor.name} · {w.vendor.email} · {formatPhone(w.vendor.phone) || '—'}
          </p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${TONE_CLASS[status.tone]}`}>{status.label}</span>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Où envoyer */}
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-bold text-brand">Envoyer vers · {PAYOUT_LABEL[w.method]}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {isBank ? (
                <>
                  <Copyable label="Banque" value={w.bank_name} />
                  <Copyable label="Titulaire" value={w.account_holder} />
                  <div className="sm:col-span-2">
                    <Copyable label="Numéro de compte" value={w.account_number} />
                  </div>
                </>
              ) : (
                <Copyable label="Numéro" value={formatPhone(w.destination_phone)} />
              )}
              <Copyable label="Montant exact" value={w.amount} />
            </div>
            <p className="mt-3 text-sm text-muted">Ces coordonnées ont été vérifiées avec le dossier du promoteur.</p>
          </section>

          {/* Solde du promoteur */}
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-bold text-brand">Solde du promoteur</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Disponible', balance.available_amount],
                ['En attente', balance.pending_amount],
                ['Retraits en cours', balance.in_withdrawal],
                ['Déjà retiré', balance.withdrawn],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-ink">{formatPrice(value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Historique */}
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-bold text-brand">Historique</h2>
            <ol className="mt-4 space-y-3">
              {events.map((e) => (
                <li key={e.created_at + e.to_status} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-ink">
                    <span className="font-bold">{EVENT_LABEL[e.to_status]}</span>
                    {e.actor_name && <span className="text-muted"> · {e.actor_name}</span>}
                    {e.note && <span className="text-muted"> — {e.note}</span>}
                  </span>
                  <span className="text-muted">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Action */}
        <aside className="h-fit rounded-3xl border border-line bg-white p-6 xl:sticky xl:top-8">
          <h2 className="font-bold text-brand">Action</h2>

          {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          {w.status === 'paid' && (
            <p className="mt-3 text-sm text-ink">
              Payé le {formatDateTime(w.paid_at)}. Référence : <span className="font-bold">{w.transfer_reference}</span>
            </p>
          )}
          {w.status === 'rejected' && <p className="mt-3 text-sm text-ink">Rejeté : {w.rejection_reason}</p>}
          {w.status === 'cancelled' && <p className="mt-3 text-sm text-muted">Annulé par le promoteur.</p>}

          {(w.status === 'pending' || w.status === 'approved') && mode === null && (
            <div className="mt-5 space-y-2">
              {w.status === 'pending' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => approveWithdrawal(id))}
                  className="h-12 w-full rounded-full bg-brand font-bold text-white transition hover:bg-brand-hover disabled:opacity-50"
                >
                  Approuver
                </button>
              ) : (
                <>
                  <p className="pb-2 text-sm text-muted">Fais le transfert, puis confirme-le ici avec sa référence.</p>
                  <button
                    type="button"
                    onClick={() => setMode('pay')}
                    className="h-12 w-full rounded-full bg-brand font-bold text-white transition hover:bg-brand-hover"
                  >
                    Marquer comme payé
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setMode('reject')}
                className="h-12 w-full rounded-full font-bold text-danger transition hover:bg-danger-soft"
              >
                Rejeter
              </button>
            </div>
          )}

          {mode && (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => (mode === 'pay' ? markWithdrawalPaid(id, text) : rejectWithdrawal(id, text)));
              }}
            >
              <label htmlFor="action-text" className="block text-sm font-bold text-ink">
                {mode === 'pay' ? 'Référence du transfert' : 'Motif du rejet (le promoteur le verra)'}
              </label>
              {mode === 'pay' ? (
                <input
                  id="action-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ex : référence Wave ou n° de virement"
                  className="h-12 w-full rounded-2xl border border-line bg-page px-3 text-base outline-none focus:border-brand focus:bg-white"
                />
              ) : (
                <textarea
                  id="action-text"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-2xl border border-line bg-page p-3 text-base outline-none focus:border-brand focus:bg-white"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  disabled={busy}
                  className="h-11 flex-1 rounded-full border border-line font-bold text-brand transition hover:bg-brand-soft"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  className={`h-11 flex-1 rounded-full font-bold text-white transition disabled:opacity-50 ${mode === 'pay' ? 'bg-brand hover:bg-brand-hover' : 'bg-danger hover:brightness-95'}`}
                >
                  {mode === 'pay' ? 'Confirmer le paiement' : 'Rejeter'}
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
