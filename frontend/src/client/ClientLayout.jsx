// Cadre commun des pages client (achat, attente, ticket, échec) — brand/parcours-client.md, § 1.
// Police du téléphone (system-ui) : le client est encore sur le portail, sans vrai Internet.
import logo from '../assets/logo.svg';
import Spinner from '../components/Spinner';
import { formatPhone } from '../utils/format';

// supportPhone : numéro du gérant de la zone, affiché en bas (« Besoin d’aide ? Appelle le … »).
export function ClientLayout({ children, supportPhone }) {
  return (
    <div
      className="min-h-dvh bg-page px-4 py-6 text-base text-ink"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <img src={logo} alt="monwifizone" className="mx-auto h-10 w-auto" />
        <main className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line sm:p-6">{children}</main>
        {supportPhone && (
          <p className="text-center text-sm">
            Besoin d’aide ? Appelle le{' '}
            <a href={`tel:${supportPhone}`} className="font-bold whitespace-nowrap text-brand underline">
              {formatPhone(supportPhone)}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

// Bouton principal : fond orange, texte bleu nuit (jamais blanc sur orange), toute la largeur, 48 px.
export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-bold text-brand transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Bouton secondaire : fond blanc, bordure et texte bleu nuit.
export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand bg-white px-4 font-bold text-brand transition hover:bg-brand-soft ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Title({ children }) {
  return <h1 className="text-2xl font-bold text-brand">{children}</h1>;
}

// Chargement : roue orange + phrase courte.
export function Loading({ text = 'Un instant…' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
      <Spinner className="size-8 text-accent" />
      <p>{text}</p>
    </div>
  );
}

// Grande pastille ✓ verte ou ✕ rouge : jamais la couleur seule (charte).
export function ResultIcon({ type }) {
  const success = type === 'success';
  return (
    <div
      className={`mx-auto flex size-16 items-center justify-center rounded-full ${success ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {success ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </div>
  );
}

