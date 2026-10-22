import { NavLink, Outlet } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import { HomeIcon, LogoutIcon, TagIcon, TicketIcon } from './icons';

const MENU = [
  { to: '/dashboard', label: 'Tableau de bord', short: 'Accueil', icon: HomeIcon, end: true },
  { to: '/dashboard/forfaits', label: 'Forfaits', short: 'Forfaits', icon: TagIcon },
  { to: '/dashboard/tickets', label: 'Tickets', short: 'Tickets', icon: TicketIcon },
];

const ROLE_LABEL = { admin: 'Administrateur', vendeur: 'Vendeur' };

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// Mise en page de l'espace connecté.
// Téléphone : en-tête en haut + menu fixé en bas (facile à atteindre au pouce).
// Grand écran : menu à gauche.
export default function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu latéral (tablette et ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="px-6 py-6">
          <img src={logo} alt="monwifizone" className="h-8 w-auto" />
        </div>
        <nav aria-label="Menu principal" className="flex-1 space-y-1 px-3">
          {MENU.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-base transition ${
                  isActive ? 'bg-brand font-bold text-white' : 'text-ink hover:bg-brand-soft'
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
        <div className="border-t border-line p-4">
          <UserBadge user={user} />
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-bold text-brand transition hover:bg-brand-soft"
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
          <div className="flex min-w-0 items-center gap-2">
            <UserBadge user={user} compact />
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

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-10 md:pt-10 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Menu du bas (téléphone) */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-3">
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
                        isActive ? 'bg-brand-soft' : ''
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

function UserBadge({ user, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white ring-2 ring-accent ring-offset-2"
      >
        {initials(user?.full_name)}
      </span>
      <div className="min-w-0 text-left">
        <p className={`truncate font-bold text-ink ${compact ? 'max-w-[9rem] text-sm' : 'text-base'}`}>
          {user?.full_name}
        </p>
        {!compact && <p className="truncate text-sm text-muted">{ROLE_LABEL[user?.role] || user?.role}</p>}
      </div>
    </div>
  );
}
