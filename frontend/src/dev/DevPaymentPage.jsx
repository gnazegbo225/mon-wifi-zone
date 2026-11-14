// Un paiement (/dev/paiements/:id) : détails, ticket (sans son mot de passe), historique des relectures
// chez Moneroo, et resynchronisation. Moneroo fait foi : le bouton relit le paiement chez Moneroo et
// applique son statut, exactement comme le webhook.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { LoadError, Loading, PageHeader } from '../admin/AdminUI';
import { formatPrice } from '../utils/format';
import { getPayment, syncPayment } from './devApi';
import EventRow from './EventRow';
import { PAYMENT_STATUS, TONE_CLASS, formatDateTime } from './devFormat';

function Row({ label, children, mono = false }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-ink ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}

const RESULT_TEXT = {
  updated: 'Statut mis à jour d’après Moneroo.',
  unchanged: 'Moneroo confirme le statut actuel : rien à changer.',
  no_ticket: 'Payé chez Moneroo, mais plus aucun ticket libre pour ce forfait : le promoteur doit servir le client.',
  amount_mismatch: 'Montant ou devise différents chez Moneroo : aucun ticket n’a été délivré.',
  unknown_payment: 'Moneroo ne relie ce paiement à aucun paiement de la base.',
};

export default function DevPaymentPage() {
  const { id } = useParams();
  const [state, setState] = useState({ id: null, data: null, failed: false });
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null); // { text, error? }

  useEffect(() => {
    let alive = true;
    getPayment(id)
      .then((data) => alive && setState({ id, data, failed: false }))
      .catch(() => alive && setState({ id, data: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [id]);

  const data = state.id === id ? state.data : null;

  async function sync() {
    setSyncing(true);
    setNotice(null);
    try {
      const { result, ...detail } = await syncPayment(id);
      setState({ id, data: detail, failed: false });
      setNotice({ text: RESULT_TEXT[result?.outcome || 'unknown_payment'], error: ['no_ticket', 'amount_mismatch', 'unknown_payment'].includes(result?.outcome) });
    } catch (err) {
      setNotice({ text: err.message, error: true });
    } finally {
      setSyncing(false);
    }
  }

  const back = (
    <Link to="/dev/paiements" className="text-sm font-bold text-brand">
      ← Paiements
    </Link>
  );

  if (state.id === id && state.failed) {
    return (
      <div className="space-y-6">
        {back}
        <LoadError>Paiement introuvable.</LoadError>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        {back}
        <Loading />
      </div>
    );
  }

  const { payment: p, ticket, events } = data;
  const st = PAYMENT_STATUS[p.status];

  return (
    <div className="space-y-6">
      {back}
      <PageHeader eyebrow={`${p.vendor_name} · ${p.zone_name}`} title={`${formatPrice(p.amount)} · ${p.pricing_name}`}>
        <span className={`rounded-full px-4 py-1.5 font-bold ${TONE_CLASS[st.tone]}`}>{st.label}</span>
      </PageHeader>

      {notice && (
        <p role={notice.error ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm ${notice.error ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-white p-6">
          <h2 className="font-bold text-brand">Détails</h2>
          <dl className="mt-2 divide-y divide-line text-sm">
            <Row label="Identifiant" mono>
              {p.id}
            </Row>
            <Row label="Identifiant Moneroo" mono>
              {p.syncable ? p.provider_payment_id : 'jamais créé chez Moneroo'}
            </Row>
            <Row label="Créé">{formatDateTime(p.created_at)}</Row>
            <Row label="Réussi">{formatDateTime(p.completed_at)}</Row>
            <Row label="Client">{p.customer || '—'}</Row>
            <Row label="Moyen">{p.payment_method}</Row>
            <Row label="Transaction" mono>
              {p.transaction_id || '—'}
            </Row>
            <Row label="Ticket">
              {ticket ? (
                <>
                  <span className="font-mono">{ticket.username}</span> · vendu le {formatDateTime(ticket.sold_at)}
                </>
              ) : p.status === 'completed' ? (
                <span className="font-bold text-danger">Aucun : stock vide au moment du paiement</span>
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6">
          <h2 className="font-bold text-brand">Resynchroniser</h2>
          <p className="mt-2 text-sm text-muted">
            Relit ce paiement chez Moneroo et applique son statut : réussi (ticket délivré), échoué ou annulé (ticket libéré). Le contenu de l’écran ne compte pas : seul Moneroo fait foi. L’action est inscrite au journal du super admin.
          </p>
          {p.syncable ? (
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="mt-5 flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              {syncing && <Spinner className="size-4" />}
              Resynchroniser avec Moneroo
            </button>
          ) : (
            <p className="mt-5 rounded-2xl bg-page p-4 text-sm text-muted">
              Ce paiement n’est jamais arrivé chez Moneroo (l’initialisation a échoué) : il n’y a rien à relire. Son ticket réservé se libère tout seul.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-bold text-brand">Relectures chez Moneroo ({events.length})</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucune relecture inscrite pour ce paiement.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
