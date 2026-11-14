// Santé (/dev) : API, base de données, Moneroo, paiements à surveiller, configuration du serveur.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { LoadError, Loading, PageHeader } from '../admin/AdminUI';
import { checkMoneroo, getOverview } from './devApi';
import { MONEROO_CHECK, TONE_CLASS, duration, since } from './devFormat';

function Badge({ ok, okLabel = 'OK', badLabel = 'À vérifier' }) {
  return <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${TONE_CLASS[ok ? 'success' : 'error']}`}>{ok ? okLabel : badLabel}</span>;
}

function Card({ title, ok, children, okLabel, badLabel }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-brand">{title}</h2>
        {ok !== undefined && <Badge ok={ok} okLabel={okLabel} badLabel={badLabel} />}
      </div>
      <div className="mt-4 space-y-1 text-sm text-muted">{children}</div>
    </section>
  );
}

// Un chiffre ; s'il y a un problème (alert), il passe en rouge et mène à la liste.
function Figure({ label, value, alert = false, to }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${alert ? 'text-danger' : 'text-ink'}`}>{value}</p>
    </>
  );
  const cls = `block rounded-2xl border p-4 ${alert ? 'border-danger/40 bg-danger-soft/50' : 'border-line bg-white'}`;
  return to ? (
    <Link to={to} className={`${cls} transition hover:border-brand`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function MonerooCard() {
  const [state, setState] = useState(null); // null | 'loading' | résultat
  async function run() {
    setState('loading');
    try {
      setState(await checkMoneroo());
    } catch (err) {
      setState({ ok: false, reason: 'request', message: err.message });
    }
  }
  const result = state && state !== 'loading' ? state : null;
  return (
    <Card title="Moneroo" ok={result ? result.ok : undefined} badLabel="Problème">
      {result ? (
        <>
          <p className="text-ink">{result.message || MONEROO_CHECK[result.reason]}</p>
          {result.http_status != null && (
            <p>
              Réponse HTTP {result.http_status} en {result.latency_ms} ms
            </p>
          )}
        </>
      ) : (
        <p>Vérifie que Moneroo répond et accepte la clé, sans créer de paiement.</p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={state === 'loading'}
        className="mt-3 flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-bold text-brand transition hover:bg-brand-soft disabled:opacity-60"
      >
        {state === 'loading' && <Spinner className="size-4" />}
        Tester Moneroo
      </button>
    </Card>
  );
}

export default function DevHealthPage() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      getOverview()
        .then((d) => {
          setData(d);
          setFailed(false);
        })
        .catch(() => setFailed(true))
        .finally(() => setRefreshing(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <PageHeader eyebrow="Espace développeur" title="Santé">
      <button
        type="button"
        onClick={() => {
          setRefreshing(true);
          load();
        }}
        disabled={refreshing}
        className="flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-brand transition hover:bg-brand-soft disabled:opacity-60"
      >
        {refreshing && <Spinner className="size-4" />}
        Actualiser
      </button>
    </PageHeader>
  );

  if (failed && !data) {
    return (
      <div className="space-y-8">
        {header}
        <LoadError>L’API ne répond pas, ou la base de données est injoignable.</LoadError>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-8">
        {header}
        <Loading />
      </div>
    );
  }

  const { api, database, config, webhooks, stats } = data;
  const p = stats.payments;
  const s = stats.syncs;
  const configOk = config.every((c) => c.ok);

  return (
    <div className="space-y-8">
      {header}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="API" ok>
          <p className="text-ink">En marche depuis {duration(api.uptime_s)}</p>
          <p>
            Node {api.node} · {api.env} · {api.memory_mb} Mo
          </p>
          <p>Version {api.commit ? <span className="font-mono text-ink">{api.commit}</span> : 'inconnue (hors Render)'}</p>
        </Card>
        <Card title="Base de données" ok={database.ok} badLabel="Problème">
          {database.ok ? <p className="text-ink">Répond en {database.latency_ms} ms</p> : <p className="text-danger">{database.error}</p>}
        </Card>
        <MonerooCard />
      </div>

      <section>
        <h2 className="font-bold text-brand">Paiements</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Figure label={`Bloqués (plus de ${data.stuck_minutes} min)`} value={p.pending_stuck} alert={p.pending_stuck > 0} to="/dev/paiements?vue=stuck" />
          <Figure label="Payés sans ticket" value={p.without_ticket} alert={p.without_ticket > 0} to="/dev/paiements?vue=no_ticket" />
          <Figure label="En cours" value={p.pending_recent} />
          <Figure label="Réussis sur 24 h" value={p.completed_24h} />
          <Figure label="Échoués sur 24 h" value={p.failed_24h} to="/dev/paiements?vue=failed" />
        </div>
      </section>

      <section>
        <h2 className="font-bold text-brand">Relectures Moneroo</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Figure label="Dernier webhook" value={s.last_webhook_at ? since(s.last_webhook_at) : 'Aucun'} />
          <Figure label="Webhooks sur 24 h" value={s.webhooks_24h} to="/dev/relectures?source=webhook" />
          <Figure label="Par la page de retour, 24 h" value={s.return_page_24h} to="/dev/relectures?source=return_page" />
          <Figure label="Problèmes sur 24 h" value={s.problems_24h} alert={s.problems_24h > 0} to="/dev/relectures?problemes=1" />
          <Figure label="Webhooks mal signés" value={webhooks.rejected.count} alert={webhooks.rejected.count > 0} />
        </div>
        {webhooks.rejected.count > 0 && (
          <p className="mt-3 text-sm text-muted">
            Depuis le démarrage, dernier {since(webhooks.rejected.last_at)}. Si Moneroo en est l’auteur, MONEROO_WEBHOOK_SECRET ne correspond pas au « Hash secret » du webhook.
          </p>
        )}
        {s.return_page_24h > 0 && s.webhooks_24h === 0 && (
          <p className="mt-3 text-sm text-muted">
            Des paiements ont été validés par la page de retour, mais aucun webhook n’est arrivé : vérifie l’adresse du webhook dans Moneroo.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-white">
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <h2 className="font-bold text-brand">Configuration du serveur</h2>
          <Badge ok={configOk} />
        </div>
        <ul className="divide-y divide-line border-t border-line text-sm">
          {config.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-3">
              <span className="font-mono text-ink">{c.key}</span>
              <span className="flex min-w-0 items-center gap-3">
                <span className="truncate text-muted">{c.value}</span>
                <Badge ok={c.ok} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
