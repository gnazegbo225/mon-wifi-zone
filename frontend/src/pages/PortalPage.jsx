import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '../assets/logo.svg?raw';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/FormDialog';
import Spinner from '../components/Spinner';
import { AlertIcon, CheckIcon, DownloadIcon, WifiIcon } from '../components/icons';
import { buildLoginHtml, buildRloginHtml, renderPreview } from '../portal/templates';
import { getZones } from '../services/api';
import { formatPhone } from '../utils/format';

const FRONTEND_URL = (import.meta.env.VITE_FRONTEND_URL || '').replace(/\/+$/, '');
const API_URL = import.meta.env.VITE_API_URL || '';

// Valeurs d'exemple pour l'aperçu (MikroTik remplit ces balises sur le routeur).
const PREVIEW_ERROR = 'invalid username or password';

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function cleanPhone(value) {
  return value.replace(/[\s.\-()]/g, '');
}

function download(fileName, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PortalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [zones, setZones] = useState(null);
  const [failed, setFailed] = useState(false);
  const [zoneId, setZoneId] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [previewError, setPreviewError] = useState(false);
  const [downloaded, setDownloaded] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getZones()
      .then((z) => {
        if (cancelled) return;
        setZones(z);
        // Une seule zone : on la choisit d'office, avec le numéro de son gérant.
        if (z.length === 1) {
          setZoneId(z[0].id);
          setPhone(formatPhone(z[0].manager_phone || ''));
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const zone = zones?.find((z) => z.id === zoneId) || null;
  const phoneValue = cleanPhone(phone);
  const phoneValid = /^\+?[0-9]{8,15}$/.test(phoneValue);
  const buyUrl = zone && FRONTEND_URL ? `${FRONTEND_URL}/buy/${zone.id}` : '';
  const retrieveUrl = zone && FRONTEND_URL ? `${FRONTEND_URL}/retrieve/${zone.id}` : '';

  // Le fichier généré, recalculé à chaque changement (aussi utilisé pour l'aperçu).
  const loginHtml = useMemo(() => {
    if (!zone || !FRONTEND_URL) return '';
    return buildLoginHtml({
      logoSvg,
      zoneName: zone.name,
      buyUrl,
      retrieveUrl,
      supportPhone: phoneValid ? phoneValue : '0000000000',
    });
  }, [zone, buyUrl, retrieveUrl, phoneValid, phoneValue]);

  const previewHtml = useMemo(
    () =>
      loginHtml
        ? renderPreview(loginHtml, {
            'chap-id': '',
            error: previewError ? PREVIEW_ERROR : '',
            trial: 'no',
            username: '',
            'link-login-only': '#',
            'link-orig': '',
          })
        : '',
    [loginHtml, previewError],
  );

  function chooseZone(id) {
    setZoneId(id);
    setErrors((e) => ({ ...e, zone_id: undefined }));
    setDownloaded([]);
    // Le numéro du gérant de la zone est proposé, tant que l'admin n'a pas tapé le sien.
    const next = zones.find((z) => z.id === id);
    if (!phoneTouched) setPhone(formatPhone(next?.manager_phone || ''));
  }

  function handleDownload(which) {
    const found = {};
    if (!zone) found.zone_id = 'Choisis la zone de ce portail.';
    if (!phoneValue) found.manager_phone = 'Écris le numéro d’assistance affiché à tes clients.';
    else if (!phoneValid) found.manager_phone = 'Ce numéro n’est pas valide. Par exemple : 07 07 07 07 07.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (which === 'login') download('login.html', loginHtml);
    else download('rlogin.html', buildRloginHtml());
    setDownloaded((list) => [...new Set([...list, which])]);
  }

  if (!isAdmin) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-base text-muted">
        Cette page est réservée à l’administrateur.
      </p>
    );
  }

  const whitelist = [hostOf(FRONTEND_URL), hostOf(API_URL)].filter((h, i, list) => h && list.indexOf(h) === i);

  return (
    <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        {!FRONTEND_URL && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <p>
              L’adresse du site manque : ajoute <code className="font-mono">VITE_FRONTEND_URL</code> dans la configuration du
              frontend, puis redéploie.
            </p>
          </div>
        )}

        {/* Réglages */}
        <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
          <h2 className="text-lg font-bold text-brand">Ton portail</h2>
          <p className="text-sm text-muted">La page que voient tes clients quand ils se connectent au WiFi.</p>

          {failed ? (
            <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
              <AlertIcon className="mt-px size-5 shrink-0" />
              <p>On n’arrive pas à charger les zones. Vérifie ta connexion et recharge la page.</p>
            </div>
          ) : zones === null ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-5 text-brand" />
              Un instant, on charge les zones…
            </p>
          ) : zones.length === 0 ? (
            <p className="mt-4 text-base text-muted">
              Aucune zone.{' '}
              <Link to="/dashboard/zones" className="font-bold text-brand underline underline-offset-2">
                Crée d’abord une zone
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <Field id="portal-zone" label="Zone WiFi" name="zone_id" error={errors.zone_id}>
                {(props) => (
                  <select {...props} value={zoneId} onChange={(e) => chooseZone(e.target.value)}>
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

              <Field
                id="portal-phone"
                label="Numéro d’assistance"
                name="manager_phone"
                error={errors.manager_phone}
                hint="Affiché en bas du portail : « Besoin d’aide ? Appelle le … »."
              >
                {(props) => (
                  <input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    maxLength={22}
                    placeholder="07 07 07 07 07"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneTouched(true);
                      setErrors((er) => ({ ...er, manager_phone: undefined }));
                    }}
                  />
                )}
              </Field>

              {zone && FRONTEND_URL && (
                <dl className="space-y-2 rounded-2xl bg-page p-3 text-sm">
                  <div>
                    <dt className="text-muted">Bouton « Acheter un ticket »</dt>
                    <dd className="font-mono break-all text-ink">{buyUrl}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Bouton « Récupérer mon ticket »</dt>
                    <dd className="font-mono break-all text-ink">{retrieveUrl}</dd>
                  </div>
                </dl>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['login', 'login.html', 'La page de connexion'],
                  ['rlogin', 'rlogin.html', 'La redirection vers la connexion'],
                ].map(([key, fileName, text]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDownload(key)}
                    disabled={!FRONTEND_URL}
                    className="flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-left text-white shadow-[0_10px_24px_-12px_rgba(15,42,92,0.8)] transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent">
                      {downloaded.includes(key) ? <CheckIcon className="size-5" /> : <DownloadIcon className="size-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-base font-bold">{fileName}</span>
                      <span className="block text-sm text-white/80">
                        {downloaded.includes(key) ? 'Téléchargé' : text}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Installation */}
        <section className="rounded-3xl border border-line bg-gradient-to-b from-brand-soft to-white p-4 sm:p-5">
          <h2 className="text-lg font-bold text-brand">Installer sur le routeur</h2>
          <ol className="mt-3 space-y-3 text-sm text-ink">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">1</span>
              <span>
                Dans Winbox, ouvre <strong>Files</strong>, puis le dossier <code className="font-mono">hotspot</code>. Remplace
                <code className="font-mono"> login.html</code> et <code className="font-mono">rlogin.html</code> par les
                nouveaux. Garde le fichier <code className="font-mono">md5.js</code> : la page en a besoin.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">2</span>
              <span>
                Ajoute ces adresses à la liste blanche (<strong>walled garden</strong>) du hotspot, sinon tes clients ne
                pourront pas acheter avant d’être connectés :
                <span className="mt-2 flex flex-wrap gap-2">
                  {whitelist.length > 0 ? (
                    whitelist.map((host) => (
                      <code key={host} className="rounded-lg bg-white px-2 py-0.5 font-mono text-sm text-brand ring-1 ring-line">
                        {host}
                      </code>
                    ))
                  ) : (
                    <span className="text-muted">l’adresse du site et celle de l’API.</span>
                  )}
                </span>
              </span>
            </li>
          </ol>
        </section>
      </div>

      {/* Aperçu */}
      <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand">Aperçu</h2>
          <div role="group" aria-label="Type d’aperçu" className="flex rounded-full border border-line p-0.5 text-sm">
            {[
              [false, 'Normal'],
              [true, 'Avec erreur'],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setPreviewError(value)}
                aria-pressed={previewError === value}
                className={`rounded-full px-3 py-1 transition ${
                  previewError === value ? 'bg-brand font-bold text-white' : 'text-muted hover:text-brand'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-ink/90 bg-page">
          {previewHtml ? (
            <iframe
              title="Aperçu du portail captif"
              srcDoc={previewHtml}
              sandbox=""
              className="block h-[600px] w-full"
            />
          ) : (
            <div className="flex h-[600px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                <WifiIcon className="size-6" />
              </span>
              Choisis une zone pour voir le portail.
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          Sur le routeur, MikroTik remplace lui-même les balises <code className="font-mono">$(…)</code>.
        </p>
      </section>
    </div>
  );
}
