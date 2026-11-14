// Mise en page de l'espace super admin, distincte de l'espace promoteur.
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import logo from '../assets/logo.svg';
import Spinner from '../components/Spinner';
import { useAdminAuth } from './useAdminAuth';

const MENU = [
  { to: '/admin', label: 'Vue d’ensemble', end: true },
  { to: '/admin/promoteurs', label: 'Promoteurs' },
  { to: '/admin/verifications', label: 'Vérifications' },
  { to: '/admin/retraits', label: 'Retraits' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/zones', label: 'Zones' },
  { to: '/admin/journal', label: 'Journal' },
  { to: '/admin/parametres', label: 'Paramètres' },
];

export default function AdminLayout() {
  const { admin, status, signOut } = useAdminAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner className="size-6 text-brand" />
      </div>
    );
  }
  if (!admin) return <Navigate to="/admin/connexion" replace />;

  return (
    <div className="min-h-dvh bg-page lg:flex">
      <aside className="flex flex-wrap items-center justify-between gap-4 bg-brand px-5 py-4 lg:sticky lg:flex-nowrap lg:top-0 lg:h-dvh lg:w-64 lg:flex-col lg:items-stretch lg:justify-start lg:px-6 lg:py-8">
        <div>
          <img src={logo} alt="monwifizone" className="h-7 w-auto rounded-md bg-white px-2 py-1" />
          <p className="mt-2 hidden text-sm text-white/60 lg:block">Administration</p>
        </div>
        <nav aria-label="Menu de l’administration" className="order-last -mx-2 flex w-full gap-1 overflow-x-auto lg:order-none lg:mx-0 lg:mt-10 lg:w-auto lg:flex-col">
          {MENU.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="lg:mt-auto">
          <p className="hidden truncate text-sm text-white/70 lg:block">{admin.full_name}</p>
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-bold text-white/80 transition hover:text-white lg:mt-2"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 lg:px-10 lg:py-12">
        <Outlet />
      </main>
    </div>
  );
}
