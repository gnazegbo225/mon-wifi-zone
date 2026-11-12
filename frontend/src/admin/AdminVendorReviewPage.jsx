// Vérification d'un dossier (/admin/verifications/:id) : identité, photos (liens temporaires),
// liste de contrôle, puis Approuver (tous les points cochés) ou Rejeter (avec un motif).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { formatPhone } from '../utils/format';
import { approveVendor, getVendor, rejectVendor } from './adminApi';
import { CHECKLIST_LABEL, PAYOUT_LABEL, STATUS_LABEL, formatDateTime } from './adminFormat';

const PHOTOS = [
  ['id_front', 'CNI, recto'],
  ['id_back', 'CNI, verso'],
  ['selfie', 'Selfie'],
];

const EVENT_LABEL = {
  submitted: 'Dossier envoyé',
  'review:approved': 'Approuvé',
  'review:rejected': 'Rejeté',
  'status:suspended': 'Suspendu',
  'status:approved': 'Réactivé',
};

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-bold break-words text-ink">{value || '—'}</dd>
    </div>
  );
}

export default function AdminVendorReviewPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getVendor(id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);
  useEffect(load, [load]);

  if (failed) return <p className="rounded-2xl bg-danger-soft p-4 text-danger">Dossier introuvable.</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner className="size-5 text-brand" /> Un instant…
      </p>
    );
  }

  const { vendor, profile, documents, events } = data;
  const status = vendor.account_status;
  const canDecide = status === 'pending_review' && Boolean(profile.submitted_at);
  const allChecked = data.checklist.every((k) => checked[k]);
  const isBank = profile.payout_method === 'bank_transfer';

  async function decide(action) {
    setBusy(true);
    setError(null);
    try {
      const result = action === 'approve' ? await approveVendor(id, checked) : await rejectVendor(id, reason, checked);
      setData(result);
      setRejecting(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/admin/verifications" className="text-sm font-bold text-muted transition hover:text-brand">
        ‹ Vérifications
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand lg:text-4xl">{profile.legal_name || vendor.full_name}</h1>
          <p className="mt-2 text-muted">
            {vendor.email} · {formatPhone(vendor.phone) || '—'}
          </p>
        </div>
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand ring-1 ring-line">{STATUS_LABEL[status]}</span>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Photos */}
          <section className="grid gap-4 sm:grid-cols-3">
            {PHOTOS.map(([kind, label]) => (
              <figure key={kind} className="overflow-hidden rounded-3xl border border-line bg-white">
                {documents[kind] ? (
                  <a href={documents[kind]} target="_blank" rel="noreferrer" title="Ouvrir en grand">
                    <img src={documents[kind]} alt={label} className="aspect-[4/3] w-full bg-page object-contain" />
                  </a>
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-page text-sm text-muted">Pas de photo</div>
                )}
                <figcaption className="px-4 py-3 text-sm font-bold text-ink">{label}</figcaption>
              </figure>
            ))}
          </section>
          <p className="-mt-3 text-sm text-muted">Les liens des photos expirent après 5 minutes : recharge la page si une photo ne s’affiche plus.</p>

          {/* Identité et compte de retrait */}
          <section className="grid gap-6 rounded-3xl border border-line bg-white p-6 sm:grid-cols-2">
            <dl className="space-y-4">
              <h2 className="font-bold text-brand">Identité</h2>
              <Info label="Nom (comme sur la CNI)" value={profile.legal_name} />
              <Info label="Numéro de CNI" value={profile.id_number} />
              <Info label="Ville" value={profile.city} />
              <Info label="Nom commercial" value={profile.business_name} />
              <Info label="Nom à l’inscription" value={vendor.full_name} />
            </dl>
            <dl className="space-y-4">
              <h2 className="font-bold text-brand">Compte de retrait</h2>
              <Info label="Moyen" value={PAYOUT_LABEL[profile.payout_method]} />
              {isBank ? (
                <>
                  <Info label="Banque" value={profile.bank_name} />
                  <Info label="Titulaire" value={profile.account_holder} />
                  <Info label="Numéro de compte" value={profile.account_number} />
                </>
              ) : (
                <Info label="Numéro" value={formatPhone(profile.payout_phone)} />
              )}
              <Info label="Inscrit le" value={formatDateTime(vendor.created_at)} />
              <Info label="Dossier envoyé le" value={formatDateTime(profile.submitted_at)} />
            </dl>
          </section>

          {/* Historique */}
          {events.length > 0 && (
            <section className="rounded-3xl border border-line bg-white p-6">
              <h2 className="font-bold text-brand">Historique</h2>
              <ol className="mt-4 space-y-3">
                {events.map((e) => (
                  <li key={e.created_at} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="text-ink">
                      <span className="font-bold">{EVENT_LABEL[e.kind === 'submitted' ? 'submitted' : `${e.kind}:${e.to_status}`] || e.to_status}</span>
                      {e.note && <span className="text-muted"> — {e.note}</span>}
                    </span>
                    <span className="text-muted">{formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Décision */}
        <aside className="h-fit rounded-3xl border border-line bg-white p-6 xl:sticky xl:top-8">
          <h2 className="font-bold text-brand">Décision</h2>
          {!canDecide ? (
            <p className="mt-3 text-sm text-muted">
              {status === 'pending_review' ? 'Le promoteur n’a pas encore envoyé son dossier.' : `Dossier ${STATUS_LABEL[status].toLowerCase()}.`}
            </p>
          ) : (
            <>
              <fieldset className="mt-4 space-y-3">
                <legend className="sr-only">Points à vérifier</legend>
                {data.checklist.map((key) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[key])}
                      onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                      className="mt-0.5 size-5 shrink-0 accent-brand"
                    />
                    {CHECKLIST_LABEL[key]}
                  </label>
                ))}
              </fieldset>

              {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

              {rejecting ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-sm font-bold text-ink" htmlFor="reason">
                    Motif du rejet (le promoteur le verra)
                  </label>
                  <textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex : la photo du recto de la CNI est floue."
                    className="w-full rounded-2xl border border-line bg-page p-3 text-base outline-none focus:border-brand focus:bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRejecting(false)}
                      disabled={busy}
                      className="h-11 flex-1 rounded-full border border-line font-bold text-brand transition hover:bg-brand-soft"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('reject')}
                      disabled={busy || !reason.trim()}
                      className="h-11 flex-1 rounded-full bg-danger font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    onClick={() => decide('approve')}
                    disabled={busy || !allChecked}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy && <Spinner className="size-5" />}
                    Approuver le promoteur
                  </button>
                  {!allChecked && <p className="text-center text-sm text-muted">Coche chaque point pour approuver.</p>}
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="h-12 w-full rounded-full font-bold text-danger transition hover:bg-danger-soft"
                  >
                    Rejeter le dossier
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
