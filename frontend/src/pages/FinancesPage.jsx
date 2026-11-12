// Finances (/espace/finances) : solde du promoteur, demandes de retrait et ventes.
// Une vente devient retirable 24 h après le paiement ; l'argent part vers le compte de retrait
// vérifié du dossier (Mon compte).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormDialog, { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import {
  cancelVendorWithdrawal,
  getVendorBalance,
  getVendorSales,
  getVendorWithdrawals,
  requestVendorWithdrawal,
} from '../services/api';
import { formatPhone, formatPrice } from '../utils/format';
import { PAYOUT_LABEL, TONE_CLASS, WITHDRAWAL_STATUS } from '../utils/labels';

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatDate = (v) => (v ? dateTime.format(new Date(v)) : '—');

function destination(account) {
  if (!account) return null;
  if (account.payout_method === 'bank_transfer' || account.method === 'bank_transfer') {
    return `${account.bank_name} · ${account.account_number}`;
  }
  return `${PAYOUT_LABEL[account.payout_method || account.method]} · ${formatPhone(account.payout_phone || account.destination_phone)}`;
}

function Amount({ label, value, hint, highlight = false }) {
  return (
    <div className={`rounded-3xl p-5 ${highlight ? 'bg-brand text-white' : 'border border-line bg-white'}`}>
      <p className={`text-sm ${highlight ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${highlight ? 'text-white' : 'text-ink'}`}>{formatPrice(value)}</p>
      {hint && <p className={`mt-1 text-sm ${highlight ? 'text-white/70' : 'text-muted'}`}>{hint}</p>}
    </div>
  );
}

function WithdrawDialog({ data, onClose, onDone }) {
  const available = data.balance.available_amount;
  const min = data.rules.min_withdrawal;
  const [amount, setAmount] = useState(String(available));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value < min) return setError(`Le retrait minimum est de ${formatPrice(min)}.`);
    if (value > available) return setError(`Tu peux retirer au plus ${formatPrice(available)}.`);
    setSaving(true);
    setError(null);
    try {
      await requestVendorWithdrawal(value);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Demander un retrait"
      subtitle={`Disponible : ${formatPrice(available)}`}
      submitLabel="Envoyer la demande"
      saving={saving}
      formError={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field id="amount" label="Montant" name="amount" suffix="FCFA" hint={`Minimum ${formatPrice(min)}. Sans frais : tu reçois exactement ce montant.`}>
        {(props) => (
          <input {...props} type="number" inputMode="numeric" min={min} max={available} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
      </Field>
      <div className="rounded-2xl bg-page px-4 py-3 text-sm">
        <p className="text-muted">Vers ton compte de retrait</p>
        <p className="mt-0.5 font-bold text-ink">{destination(data.payout_account)}</p>
      </div>
    </FormDialog>
  );
}

export default function FinancesPage() {
  const [data, setData] = useState(null);
  const [withdrawals, setWithdrawals] = useState(null);
  const [sales, setSales] = useState(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const reload = useCallback(() => {
    Promise.all([getVendorBalance(), getVendorWithdrawals(), getVendorSales()])
      .then(([b, w, s]) => {
        setData(b);
        setWithdrawals(w);
        setSales(s);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(reload, [reload]);

  if (failed) return <p className="rounded-3xl bg-danger-soft p-5 text-danger">On n’arrive pas à charger tes finances. Recharge la page.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant, on calcule ton solde…
      </p>
    );
  }

  const { balance, rules } = data;
  const approved = data.account_status === 'approved';
  const canWithdraw = approved && data.payout_account && balance.available_amount >= rules.min_withdrawal;

  async function cancel(id) {
    setNotice(null);
    try {
      await cancelVendorWithdrawal(id);
      setNotice({ type: 'success', text: 'Demande annulée. Le montant est de nouveau disponible.' });
      reload();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function moreSales() {
    setLoadingMore(true);
    try {
      const next = await getVendorSales({ page: sales.page + 1 });
      setSales((s) => ({ ...next, sales: [...s.sales, ...next.sales] }));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-8">
      {/* Solde */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="col-span-2 lg:col-span-1">
            <Amount highlight label="Disponible" value={balance.available_amount} hint="Retirable maintenant" />
          </div>
          <Amount label="En attente" value={balance.pending_amount} hint={`Ventes de moins de ${rules.hold_hours} h`} />
          <Amount label="Retrait en cours" value={balance.in_withdrawal} />
          <div className="col-span-2 lg:col-span-1">
            <Amount label="Déjà retiré" value={balance.withdrawn} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Ventes : {formatPrice(balance.gross_sales)} · Commission de la plateforme ({rules.commission_percent} %) :{' '}
          {formatPrice(balance.commissions)}
        </p>
      </section>

      {/* Retrait */}
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-brand">Retirer ton argent</h2>
          <p className="mt-1 text-sm text-muted">
            {!approved ? (
              <>
                Ton compte doit être vérifié avant ton premier retrait.{' '}
                <Link to="/espace/compte" className="font-bold text-brand underline underline-offset-2">
                  Mon compte
                </Link>
              </>
            ) : !data.payout_account ? (
              'Ajoute ton compte de retrait dans Mon compte.'
            ) : balance.available_amount < rules.min_withdrawal ? (
              `Tu pourras retirer dès ${formatPrice(rules.min_withdrawal)} disponibles. Sans frais.`
            ) : (
              <>Vers {destination(data.payout_account)}. Sans frais.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog(true)}
          disabled={!canWithdraw}
          className="h-12 shrink-0 rounded-full bg-brand px-6 font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Demander un retrait
        </button>
      </section>

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 text-sm ${notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}
        >
          {notice.text}
        </p>
      )}

      {/* Retraits */}
      <section>
        <h2 className="text-lg font-bold text-brand">Tes retraits</h2>
        {withdrawals.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-line bg-white p-6 text-center text-muted">Aucun retrait pour l’instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {withdrawals.map((w) => {
              const status = WITHDRAWAL_STATUS[w.status];
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{formatPrice(w.amount)}</p>
                    <p className="text-sm text-muted">
                      {formatDate(w.requested_at)} · {destination(w)}
                    </p>
                    {w.status === 'paid' && <p className="text-sm text-success">Payé le {formatDate(w.paid_at)} · Réf. {w.transfer_reference}</p>}
                    {w.status === 'rejected' && <p className="text-sm text-danger">Motif : {w.rejection_reason}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                  {w.status === 'pending' && (
                    <button type="button" onClick={() => cancel(w.id)} className="text-sm font-bold text-muted transition hover:text-danger">
                      Annuler
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ventes */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-brand">Tes ventes</h2>
          <p className="text-sm text-muted">
            {sales.totals.count} vente{sales.totals.count > 1 ? 's' : ''} · {formatPrice(sales.totals.net)} pour toi
          </p>
        </div>
        {sales.sales.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-line bg-white p-6 text-center text-muted">
            Pas encore de vente. Elles s’afficheront ici dès le premier ticket vendu.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
              {sales.sales.map((s) => {
                const waiting = new Date(s.available_at) > new Date();
                return (
                  <li key={s.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:gap-6">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {s.pricing_name} · {s.zone_name}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(s.completed_at)}
                        {s.customer ? ` · ${s.customer}` : ''}
                      </p>
                    </div>
                    <p className="text-sm text-muted">
                      {formatPrice(s.amount)} − {formatPrice(s.commission)}
                    </p>
                    <div className="sm:text-right">
                      <p className="font-bold text-ink">{formatPrice(s.net)}</p>
                      <p className="text-sm text-muted">{waiting ? `Disponible le ${formatDate(s.available_at)}` : 'Disponible'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {sales.has_more && (
              <button
                type="button"
                onClick={moreSales}
                disabled={loadingMore}
                className="mt-3 h-11 w-full rounded-full border border-line bg-white font-bold text-brand transition hover:bg-brand-soft"
              >
                {loadingMore ? 'Un instant…' : 'Voir plus de ventes'}
              </button>
            )}
          </>
        )}
      </section>

      {dialog && (
        <WithdrawDialog
          data={data}
          onClose={() => setDialog(false)}
          onDone={() => {
            setDialog(false);
            setNotice({ type: 'success', text: 'Demande envoyée. Tu seras payé après vérification.' });
            reload();
          }}
        />
      )}
    </div>
  );
}
