// Une relecture d'un paiement chez Moneroo : source, date, avant → après, résultat.
import { Link } from 'react-router-dom';
import { OUTCOME, PAYMENT_STATUS, SOURCE_LABEL, TONE_CLASS, formatDateTime } from './devFormat';

export default function EventRow({ e, showPayment = false }) {
  const outcome = OUTCOME[e.outcome];
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0">
        <p className="text-ink">
          <span className="font-bold">{SOURCE_LABEL[e.source]}</span>
          {e.event && <span className="text-muted"> · {e.event}</span>}
        </p>
        <p className="text-muted">
          {formatDateTime(e.created_at)}
          {e.duration_ms != null && ` · ${e.duration_ms} ms`}
          {e.status_before && e.status_after && ` · ${PAYMENT_STATUS[e.status_before]?.label || e.status_before} → ${PAYMENT_STATUS[e.status_after]?.label || e.status_after}`}
        </p>
        {e.error && <p className="mt-1 break-all text-danger">{e.error}</p>}
        {showPayment &&
          (e.payment_id ? (
            <Link to={`/dev/paiements/${e.payment_id}`} className="font-bold text-brand underline-offset-4 hover:underline">
              Voir le paiement
            </Link>
          ) : (
            <p className="font-mono text-muted">{e.provider_payment_id}</p>
          ))}
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 font-bold ${TONE_CLASS[outcome.tone]}`}>{outcome.label}</span>
    </li>
  );
}
