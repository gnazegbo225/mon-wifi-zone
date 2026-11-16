import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import logoMark from '../assets/logo-mark.svg';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import { resendEmailVerification } from '../services/api';
import { AlertIcon, CoinsIcon, HomeIcon, LogoutIcon, MailIcon, MapPinIcon, TagIcon, TicketIcon, UserIcon, WifiIcon } from './icons';

const MENU = [
  { to: '/espace', label: 'Tableau de bord', short: 'Accueil', icon: HomeIcon, end: true },
  { to: '/espace/zones', label: 'Zones', short: 'Zones', icon: MapPinIcon },
  { to: '/espace/forfaits', label: 'Forfaits', short: 'Forfaits', icon: TagIcon, vendorOnly: true },
  { to: '/espace/tickets', label: 'Tickets', short: 'Tickets', icon: TicketIcon },
  { to: '/espace/portail', label: 'Portail captif', short: 'Portail', icon: WifiIcon, vendorOnly: true, desktopOnly: true },
  { to: '/espace/finances', label: 'Finances', short: 'Argent', icon: CoinsIcon, vendorOnly: true },
  { to: '/espace/employes', label: 'Employés', short: 'Équipe', icon: UserIcon, vendorOnly: true, desktopOnly: true },
  { to: '/espace/compte', label: 'Mon compte', short: 'Compte', icon: UserIcon, vendorOnly: true },
];

const PAGES = {
  '/espace/zones': { title: 'Zones', subtitle: 'Tes lieux de vente, avec leurs forfaits et leurs tickets.' },
  '/espace/forfaits': { title: 'Forfaits', subtitle: 'Crée et gère les tarifs que tes clients achètent.' },
  '/espace/portail': { title: 'Portail captif', subtitle: 'Crée la page de connexion WiFi de tes routeurs.' },
  '/espace/tickets': { title: 'Tickets', subtitle: 'Importe tes tickets MikroTik et suis ton stock.' },
  '/espace/compte': { title: 'Mon compte', subtitle: 'Ton dossier de vérification et ton compte de retrait.' },
  '/espace/finances': { title: 'Finances', subtitle: 'Ton solde, tes retraits et tes ventes.' },
  '/espace/employes': { title: 'Employés', subtitle: 'Les comptes de ton équipe.' },
};

// Rappel tant que le compte du promoteur n'est pas vérifié (sauf sur la page Mon compte).
function VerificationBanner({ user, pathname }) {
  if (user?.role !== 'vendor' || user.account_status === 'approved' || pathname.startsWith('/espace/compte')) return null;
  const rejected = user.account_status === 'rejected';
  return (
    <Link
      to="/espace/compte"
      className={`mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm transition hover:brightness-[0.98] ${
        rejected ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand'
      }`}
    >
      <AlertIcon className="mt-px size-5 shrink-0" />
      <span>
        {rejected
          ? 'Ton dossier doit être corrigé avant ton premier retrait. '
          : 'Ton compte n’est pas encore vérifié. Envoie ton dossier pour pouvoir retirer ton argent. '}
        <span className="font-bold underline underline-offset-2">Mon compte</span>
      </span>
    </Link>
  );
}

// Rappel tant que l'adresse email du promoteur n'est pas confirmée (exigée pour retirer de l'argent).
function EmailBanner({ user }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  if (user?.role !== 'vendor' || user.email_verified !== false) return null;

  async function resend() {
    setState('sending');
    try {
      await resendEmailVerification();
      setState('sent');
    } catch (err) {
      setMessage(err.message);
      setState('error');
    }
  }

  return (
    <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
      <p className="flex min-w-0 items-start gap-3">
        <MailIcon className="mt-px size-5 shrink-0 text-brand" />
        <span>
          {state === 'sent' ? (
            <>
              Email envoyé à <span className="font-bold break-all">{user.email}</span>. Regarde aussi dans les spams.
            </>
          ) : state === 'error' ? (
            message
          ) : (
            <>
              Confirme ton adresse <span className="font-bold break-all">{user.email}</span> : clique sur le lien que nous t’avons envoyé. C’est nécessaire pour retirer ton
              argent.
            </>
          )}
        </span>
      </p>
      {state !== 'sent' && (
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending'}
          className="ml-8 shrink-0 font-bold text-brand underline underline-offset-2 disabled:opacity-60 sm:ml-0"
        >
          {state === 'sending' ? 'Envoi…' : 'Renvoyer l’email'}
        </button>
      )}
    </div>
  );
}

const ROLE_LABEL = { vendor: 'Promoteur', employee: 'Employé' };

const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Mise en page de l'espace connecté.
// Téléphone : en-tête en haut + menu fixé en bas (facile à atteindre au pouce).
// Grand écran : menu dans un panneau à gauche, titre et utilisateur en haut.
export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  // Forfaits et portail captif : le promoteur seulement, pas ses employés.
  const menu = MENU.filter((item) => !item.vendorOnly || user?.role === 'vendor');
  // Barre du bas (téléphone) : sans le portail captif, qui se prépare sur ordinateur (fichiers du routeur).
  const mobileMenu = menu.filter((item) => !item.desktopOnly);
  const { pathname } = useLocation();

  const firstName = user?.full_name?.trim().split(/\s+/)[0] || '';
  const page = PAGES[pathname.replace(/\/+$/, '')] || {
    title: 'Tableau de bord',
    subtitle: `Bonjour ${firstName} · ${capitalize(dateFormat.format(new Date()))}`,
  };

  return (
    <div className="min-h-dvh md:flex md:gap-6 md:p-4">
      {/* Menu latéral (tablette et ordinateur) */}
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-3xl border border-line bg-white p-4 shadow-[0_8px_30px_-16px_rgba(15,42,92,0.2)] md:flex">
        <div className="flex items-center gap-3 px-2 pt-2 pb-6">
          <img src={logo} alt="monwifizone" className="h-9 w-auto" />
        </div>

        <p className="px-3 pb-2 text-sm tracking-wider text-muted uppercase">Menu</p>
        <nav aria-label="Menu principal" className="space-y-1">
          {menu.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-3 text-base transition ${
                  isActive
                    ? 'bg-brand font-bold text-white shadow-[0_8px_20px_-10px_rgba(15,42,92,0.7)]'
                    : 'text-ink hover:bg-brand-soft'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`size-5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Carte compte, en bas du menu */}
        <div className="relative mt-auto overflow-hidden rounded-3xl bg-brand p-4 text-white">
          <div
            aria-hidden="true"
            className="absolute -top-10 -right-10 size-32 rounded-full border-[14px] border-white/5"
          />
          <span className="grid size-10 place-items-center rounded-xl bg-white">
            <img src={logoMark} alt="" className="size-7" />
          </span>
          <p className="mt-3 truncate text-lg font-bold">{user?.full_name}</p>
          <p className="truncate text-sm text-white/75">{user?.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-3 py-2.5 text-sm font-bold text-brand transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogoutIcon className="size-5" />
            Me déconnecter
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête (téléphone) */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:hidden">
          <img src={logo} alt="monwifizone" className="h-7 w-auto shrink-0" />
          <div className="flex min-w-0 items-center gap-1">
            <Avatar user={user} />
            <p className="ml-2 max-w-[8rem] truncate text-sm font-bold text-ink">{user?.full_name}</p>
            <button
              type="button"
              onClick={signOut}
              aria-label="Me déconnecter"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-brand transition hover:bg-brand-soft"
            >
              <LogoutIcon className="size-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-2 md:pt-2 md:pb-4">
          {/* Titre de la page + utilisateur connecté */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-brand">{page.title}</h1>
              <p className="mt-1 text-sm text-muted">{page.subtitle}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 rounded-full border border-line bg-white py-1.5 pr-4 pl-1.5 md:flex">
              <Avatar user={user} />
              <div className="min-w-0">
                <p className="max-w-[12rem] truncate text-sm font-bold text-ink">{user?.full_name}</p>
                <p className="text-sm text-muted">{ROLE_LABEL[user?.role] || user?.role}</p>
              </div>
            </div>
          </div>

          <EmailBanner user={user} />
          <VerificationBanner user={user} pathname={pathname} />
          <Outlet />
        </main>
      </div>

      {/* Menu du bas (téléphone) */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileMenu.length}, minmax(0, 1fr))` }}>
          {mobileMenu.map(({ to, short, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-sm transition ${
                    isActive ? 'font-bold text-brand' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-8 w-14 place-items-center rounded-full transition ${
                        isActive ? 'bg-brand text-accent' : ''
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    {short}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Avatar({ user }) {
  return (
    <span
      aria-label={user?.full_name}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white ring-2 ring-accent ring-offset-2"
    >
      {initials(user?.full_name)}
    </span>
  );
}
