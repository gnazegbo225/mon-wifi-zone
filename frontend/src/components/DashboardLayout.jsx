import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logoMark from '../assets/logo-mark.svg';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import { HomeIcon, LogoutIcon, MapPinIcon, TagIcon, TicketIcon } from './icons';

const MENU = [
  { to: '/dashboard', label: 'Tableau de bord', short: 'Accueil', icon: HomeIcon, end: true },
  { to: '/dashboard/zones', label: 'Zones', short: 'Zones', icon: MapPinIcon },
  { to: '/dashboard/forfaits', label: 'Forfaits', short: 'Forfaits', icon: TagIcon },
  { to: '/dashboard/tickets', label: 'Tickets', short: 'Tickets', icon: TicketIcon },
];

const PAGES = {
  '/dashboard/zones': { title: 'Zones', subtitle: 'Tes lieux de vente, avec leurs forfaits et leurs tickets.' },
  '/dashboard/forfaits': { title: 'Forfaits', subtitle: 'Crée et gère les tarifs que tes clients achètent.' },
  '/dashboard/tickets': { title: 'Tickets', subtitle: 'Les tickets WiFi vendus et disponibles.' },
};

const ROLE_LABEL = { admin: 'Administrateur', vendeur: 'Vendeur' };

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
          {MENU.map(({ to, label, icon: Icon, end }) => (
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

          <Outlet />
        </main>
      </div>

      {/* Menu du bas (téléphone) */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {MENU.map(({ to, short, icon: Icon, end }) => (
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
