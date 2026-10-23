import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { AlertIcon, CheckIcon, CloseIcon, TagIcon, TicketIcon } from '../components/icons';
import { getTicketStock, getZones, importTickets } from '../services/api';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const numberFormat = new Intl.NumberFormat('fr-FR');

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function TicketsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [zones, setZones] = useState([]);
  const [stock, setStock] = useState(null);
  const [stockFailed, setStockFailed] = useState(false);
  const [stockZone, setStockZone] = useState('');
  const [report, setReport] = useState(null); // { fileName, zoneId, ...rapport du backend }

  useEffect(() => {
    getZones()
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  const loadStock = useCallback(() => {
    setStockFailed(false);
    setStock(null);
    getTicketStock(stockZone || undefined)
      .then(setStock)
      .catch(() => setStockFailed(true));
  }, [stockZone]);

  useEffect(() => {
    let cancelled = false;
    getTicketStock(stockZone || undefined)
      .then((s) => {
        if (cancelled) return;
        setStockFailed(false);
        setStock(s);
      })
      .catch(() => !cancelled && setStockFailed(true));
    return () => {
      cancelled = true;
    };
  }, [stockZone]);

  function handleImported(result) {
    setReport(result);
    loadStock();
  }

  return (
    <div className="max-w-6xl space-y-4">
      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <ImportCard zones={zones} onImported={handleImported} />
          {report ? <ReportCard report={report} onClose={() => setReport(null)} /> : <FormatCard />}
        </div>
      )}

      <StockCard
        stock={stock}
        failed={stockFailed}
        zones={zones}
        zoneFilter={stockZone}
        onZoneFilter={setStockZone}
        onRetry={loadStock}
      />
    </div>
  );
}

// --- Import ------------------------------------------------------------------

function messageForError(err) {
  if (err?.status === 0) return 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.';
  if (err?.status === 403) return 'Seul un administrateur peut importer des tickets.';
  if (err?.status === 400 || err?.status === 409) return err.message;
  return 'L’import n’a pas marché. Réessaie dans un instant.';
}

function ImportCard({ zones, onImported }) {
  const inputRef = useRef(null);
  const [zoneId, setZoneId] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Une seule zone : on la choisit d'office.
  const selectedZone = zoneId || (zones.length === 1 ? zones[0].id : '');

  function pickFile(picked) {
    if (!picked) return;
    setFile(picked);
    setErrors((e) => ({ ...e, file: undefined }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const found = {};
    if (!selectedZone) found.zone_id = 'Choisis la zone de ces tickets.';
    if (!file) found.file = 'Choisis le fichier CSV exporté de MikroTik.';
    else if (!/\.(csv|txt)$/i.test(file.name)) found.file = 'Ce fichier n’est pas un CSV. Choisis un fichier .csv.';
    else if (file.size > MAX_FILE_SIZE) found.file = 'Ce fichier est trop lourd (5 Mo maximum). Coupe-le en plusieurs fichiers.';
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const result = await importTickets(selectedZone, file);
      onImported({ ...result, fileName: file.name, zoneId: selectedZone });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      const message = messageForError(err);
      if (err?.field === 'zone_id' || err?.field === 'file') setErrors({ [err.field]: message });
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
      <h2 className="text-lg font-bold text-brand">Importer des tickets</h2>
      <p className="text-sm text-muted">Depuis le fichier CSV exporté de ton routeur MikroTik.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {formError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <p>{formError}</p>
          </div>
        )}

        <Field id="import-zone" label="Zone WiFi" name="zone_id" error={errors.zone_id}>
          {(props) => (
            <select
              {...props}
              value={selectedZone}
              onChange={(e) => {
                setZoneId(e.target.value);
                setErrors((er) => ({ ...er, zone_id: undefined }));
              }}
            >
              <option value="">Choisis une zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {z.city}
                  {z.is_active === false ? ' (désactivée)' : ''}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-bold text-ink">Fichier CSV</p>
          <label
            htmlFor="import-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition focus-within:ring-4 focus-within:ring-brand/10 ${
              errors.file
                ? 'border-danger bg-danger-soft/40'
                : dragging
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-page hover:border-brand/40'
            }`}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-accent">
              <TicketIcon className="size-6" />
            </span>
            {file ? (
              <>
                <span className="mt-3 max-w-full truncate text-base font-bold text-ink">{file.name}</span>
                <span className="text-sm text-muted">{formatSize(file.size)} · Touche pour changer de fichier</span>
              </>
            ) : (
              <>
                <span className="mt-3 text-base font-bold text-brand">Choisis ton fichier CSV</span>
                <span className="text-sm text-muted">ou dépose-le ici · 5 Mo maximum</span>
              </>
            )}
            <input
              ref={inputRef}
              id="import-file"
              name="file"
              type="file"
              accept=".csv,.txt,text/csv"
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? 'import-file-error' : undefined}
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {errors.file && (
            <p id="import-file-error" className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
              <AlertIcon className="mt-px size-4 shrink-0" />
              {errors.file}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover disabled:cursor-wait"
        >
          {saving && <Spinner className="size-5" />}
          {saving ? 'Un instant, on importe…' : 'Importer les tickets'}
        </button>
      </form>
    </section>
  );
}

// Rappel du format attendu, affiché tant qu'aucun import n'a été fait.
function FormatCard() {
  return (
    <section className="rounded-3xl border border-line bg-gradient-to-b from-brand-soft to-white p-4 sm:p-5">
      <h2 className="text-lg font-bold text-brand">Le format du fichier</h2>
      <p className="text-sm text-muted">Trois colonnes, séparées par des virgules ou des points-virgules.</p>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 font-mono text-sm leading-relaxed text-ink">
        {'Username,Password,Profile\nk7m2p9,4821,1h\nq3x8w1,7730,24h'}
      </pre>
      <ul className="mt-4 space-y-2 text-sm text-ink">
        <li className="flex gap-2">
          <CheckIcon className="mt-px size-4 shrink-0 text-success" />
          Le profil doit être le profil MikroTik d’un forfait de la zone.
        </li>
        <li className="flex gap-2">
          <CheckIcon className="mt-px size-4 shrink-0 text-success" />
          Tu peux réimporter un fichier : les tickets déjà présents sont ignorés.
        </li>
      </ul>
    </section>
  );
}

// --- Rapport -----------------------------------------------------------------

const VISIBLE_NAMES = 24;

function ReportCard({ report, onClose }) {
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);
  const duplicateNames = [...new Set(report.duplicates)];
  const shownDuplicates = showAllDuplicates ? duplicateNames : duplicateNames.slice(0, VISIBLE_NAMES);
  const missingProfiles = report.profiles_without_pricing;
  const skippedForProfile = missingProfiles.reduce((sum, p) => sum + p.count, 0);
  const allGood = report.duplicates.length === 0 && missingProfiles.length === 0 && report.invalid_lines.length === 0;

  return (
    <section
      aria-live="polite"
      className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-brand">Rapport d’import</h2>
          <p className="truncate text-sm text-muted">{report.fileName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le rapport"
          className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-brand-soft hover:text-brand"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {/* Résultat principal */}
      <div
        className={`mt-4 flex items-center gap-3 rounded-2xl p-4 ${report.imported > 0 ? 'bg-success-soft text-success' : 'bg-page text-ink'}`}
      >
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${report.imported > 0 ? 'bg-success text-white' : 'bg-white text-muted ring-1 ring-line'}`}
        >
          {report.imported > 0 ? <CheckIcon className="size-6" /> : <TicketIcon className="size-6" />}
        </span>
        <div>
          <p className="text-2xl leading-tight font-bold">{numberFormat.format(report.imported)}</p>
          <p className="text-sm">
            {report.imported === 0
              ? 'Aucun ticket importé.'
              : report.imported === 1
                ? 'ticket importé. Il est prêt à la vente.'
                : 'tickets importés. Ils sont prêts à la vente.'}
          </p>
        </div>
      </div>

      {allGood && report.imported > 0 && <p className="mt-3 text-sm text-muted">Tout le fichier a été importé.</p>}

      <div className="mt-4 space-y-4">
        {missingProfiles.length > 0 && (
          <ReportSection
            title="Profils sans forfait"
            count={skippedForProfile}
            countLabel={skippedForProfile > 1 ? 'tickets non importés' : 'ticket non importé'}
          >
            <p className="text-sm text-muted">
              Aucun forfait de cette zone n’a ces profils.{' '}
              <Link
                to={`/dashboard/forfaits?zone=${report.zoneId}`}
                className="font-bold text-brand underline underline-offset-2"
              >
                Crée le forfait
              </Link>{' '}
              avec ce profil MikroTik, puis réimporte le fichier.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missingProfiles.map((p) => (
                <li key={p.profile} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-ink">
                  <code className="font-mono font-bold text-brand">{p.profile}</code> · {p.count} ticket{p.count > 1 ? 's' : ''}
                </li>
              ))}
            </ul>
          </ReportSection>
        )}

        {report.duplicates.length > 0 && (
          <ReportSection
            title="Doublons ignorés"
            count={report.duplicates.length}
            countLabel={report.duplicates.length > 1 ? 'lignes' : 'ligne'}
          >
            <p className="text-sm text-muted">Ces tickets existent déjà dans la zone, ou sont en double dans le fichier.</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {shownDuplicates.map((name) => (
                <li key={name} className="rounded-lg bg-page px-2 py-0.5 font-mono text-sm text-ink ring-1 ring-line">
                  {name}
                </li>
              ))}
            </ul>
            {duplicateNames.length > VISIBLE_NAMES && (
              <button
                type="button"
                onClick={() => setShowAllDuplicates((v) => !v)}
                className="mt-2 text-sm font-bold text-brand underline underline-offset-2"
              >
                {showAllDuplicates ? 'Voir moins' : `Voir les ${duplicateNames.length - VISIBLE_NAMES} autres`}
              </button>
            )}
          </ReportSection>
        )}

        {report.invalid_lines.length > 0 && (
          <ReportSection
            title="Lignes invalides"
            count={report.invalid_lines.length}
            countLabel={report.invalid_lines.length > 1 ? 'lignes ignorées' : 'ligne ignorée'}
          >
            <p className="text-sm text-muted">Corrige ces lignes dans le fichier, puis réimporte-le.</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {report.invalid_lines.map((l) => (
                <li key={l.line} className="flex gap-2 text-ink">
                  <span className="shrink-0 font-bold text-danger">Ligne {l.line}</span>
                  <span className="text-muted">{l.reason}</span>
                </li>
              ))}
            </ul>
          </ReportSection>
        )}
      </div>
    </section>
  );
}

function ReportSection({ title, count, countLabel, children }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <AlertIcon className="size-4 text-danger" />
          {title}
        </h3>
        <p className="text-sm text-muted">
          <strong className="text-ink">{numberFormat.format(count)}</strong> {countLabel}
        </p>
      </div>
      {children}
    </div>
  );
}

// --- Stock -------------------------------------------------------------------

function StockCard({ stock, failed, zones, zoneFilter, onZoneFilter, onRetry }) {
  const zonesById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const totals = (stock || []).reduce(
    (t, s) => ({ free: t.free + s.free, reserved: t.reserved + s.reserved, sold: t.sold + s.sold }),
    { free: 0, reserved: 0, sold: 0 },
  );

  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand">Stock par forfait</h2>
          <p className="text-sm text-muted">Tickets libres, réservés et vendus.</p>
        </div>
        {zones.length > 1 && (
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-page px-4 text-sm sm:w-64">
            <span className="sr-only">Zone</span>
            <select
              value={zoneFilter}
              onChange={(e) => onZoneFilter(e.target.value)}
              className="h-full w-full min-w-0 bg-transparent text-sm text-ink outline-none"
            >
              <option value="">Toutes les zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-4">
        {failed ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <div>
              <p>On n'arrive pas à charger le stock. Vérifie ta connexion.</p>
              <button type="button" onClick={onRetry} className="mt-2 font-bold underline underline-offset-2">
                Réessayer
              </button>
            </div>
          </div>
        ) : stock === null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-5 text-brand" />
            Un instant, on compte les tickets…
          </p>
        ) : stock.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <TagIcon className="size-6" />
            </span>
            <p className="mt-3 text-base text-muted">
              Aucun forfait. Les tickets sont rangés par forfait :{' '}
              <Link to="/dashboard/forfaits" className="font-bold text-brand underline underline-offset-2">
                crée d’abord tes forfaits
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 pr-2 pl-4 font-normal sm:pl-0">
                    Forfait
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-normal">
                    Libres
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-normal">
                    Réservés
                  </th>
                  <th scope="col" className="py-2 pr-4 pl-2 text-right font-normal sm:pr-0">
                    Vendus
                  </th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s) => {
                  const zone = zonesById[s.wifi_zone_id];
                  const onSale = s.is_active && zone?.is_active !== false;
                  return (
                    <tr key={s.pricing_id} className="border-b border-line last:border-0">
                      <th scope="row" className="py-3 pr-2 pl-4 font-normal sm:pl-0">
                        <span className={`block text-base font-bold ${onSale ? 'text-brand' : 'text-muted'}`}>{s.name}</span>
                        <span className="block text-sm text-muted">
                          {[zone?.name, `${numberFormat.format(s.amount)} FCFA`, onSale ? null : 'pas en vente']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </th>
                      <td className="px-2 py-3 text-right align-top tabular-nums">
                        <span className={`text-base font-bold ${s.free === 0 && onSale ? 'text-danger' : 'text-ink'}`}>
                          {numberFormat.format(s.free)}
                        </span>
                        {s.free === 0 && onSale && (
                          <span className="block text-sm text-danger">
                            ✕ {s.reserved + s.sold === 0 ? 'à importer' : 'épuisé'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right align-top text-base tabular-nums text-ink">
                        {numberFormat.format(s.reserved)}
                      </td>
                      <td className="py-3 pr-4 pl-2 text-right align-top text-base tabular-nums text-ink sm:pr-0">
                        {numberFormat.format(s.sold)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {stock.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-line font-bold text-ink">
                    <th scope="row" className="py-3 pr-2 pl-4 text-left sm:pl-0">
                      Total
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums">{numberFormat.format(totals.free)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{numberFormat.format(totals.reserved)}</td>
                    <td className="py-3 pr-4 pl-2 text-right tabular-nums sm:pr-0">{numberFormat.format(totals.sold)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
