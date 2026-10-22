import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ChevronRightIcon, TagIcon, TicketIcon } from '../components/icons';

const SHORTCUTS = [
  {
    to: '/dashboard/forfaits',
    title: 'Forfaits',
    text: 'Vois les forfaits proposés à tes clients.',
    icon: TagIcon,
  },
  {
    to: '/dashboard/tickets',
    title: 'Tickets',
    text: 'Suis les tickets WiFi vendus et disponibles.',
    icon: TicketIcon,
  },
];

export default function DashboardHome() {
  const { user } = useAuth();
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || '';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-brand">Bonjour {firstName} 👋</h1>
      <p className="mt-1 text-base text-muted">Tu es connecté. Voici ton espace.</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map(({ to, title, text, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-[0_4px_16px_-8px_rgba(15,42,92,0.15)] transition hover:border-brand/30 hover:shadow-[0_10px_24px_-10px_rgba(15,42,92,0.25)]"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-accent">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-brand">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4">
        <h2 className="text-lg font-bold text-brand">Ton compte</h2>
        <dl className="mt-3 space-y-2 text-base">
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-muted">Email</dt>
            <dd className="min-w-0 break-all text-ink">{user?.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-muted">Rôle</dt>
            <dd className="text-ink">{user?.role === 'admin' ? 'Administrateur' : 'Vendeur'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
