import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertIcon, ChartIcon, ChevronRightIcon, CoinsIcon, MapPinIcon, TagIcon, TicketIcon } from '../components/icons';
import { getPricings, getTicketStock, getZones } from '../services/api';

const priceFormat = new Intl.NumberFormat('fr-FR');
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

// Les 6 derniers mois, pour l'axe du graphique des ventes.
function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => monthFormat.format(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)));
}

export default function DashboardHome() {
  const [zones, setZones] = useState(null);
  const [pricings, setPricings] = useState(null);
  const [ticketsSold, setTicketsSold] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getZones(), getPricings(), getTicketStock()])
      .then(([z, p, stock]) => {
        if (cancelled) return;
        // Un admin reçoit aussi les zones et forfaits désactivés : le tableau de bord ne compte
        // que ce qui est en vente (forfait actif dans une zone active).
        const activeZones = z.filter((zone) => zone.is_active !== false);
        const activeZoneIds = new Set(activeZones.map((zone) => zone.id));
        setZones(activeZones);
        setPricings(p.filter((pricing) => pricing.is_active !== false && activeZoneIds.has(pricing.wifi_zone_id)));
        setTicketsSold(stock.reduce((sum, s) => sum + s.sold, 0));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !failed && (zones === null || pricings === null);
  const cheapest = pricings?.length ? Math.min(...pricings.map((p) => p.amount)) : null;

  return (
    <div className="space-y-4">
      {failed && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <AlertIcon className="mt-px size-5 shrink-0" />
          <p>On n'arrive pas à charger tes chiffres. Vérifie ta connexion et recharge la page.</p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              highlight
              icon={TagIcon}
              label="Forfaits actifs"
              value={pricings?.length}
              hint="proposés à tes clients"
              loading={loading}
            />
            <StatCard icon={MapPinIcon} label="Zones WiFi" value={zones?.length} hint="lieux de vente" loading={loading} />
            <StatCard
              icon={CoinsIcon}
              label="Prix de départ"
              value={cheapest === null ? '—' : priceFormat.format(cheapest)}
              unit={cheapest === null ? '' : 'FCFA'}
              hint="forfait le moins cher"
              loading={loading}
            />
            <StatCard icon={TicketIcon} label="Tickets vendus" value={ticketsSold} hint="depuis le début" loading={loading} />
          </div>

          <SalesCard />
        </div>

        {/* Colonne de droite */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:content-start">
          <PricingsCard pricings={pricings} loading={loading} />
          <ZonesCard zones={zones} pricings={pricings} loading={loading} />
        </div>
      </div>
    </div>
  );
}

// Petits points décoratifs, à droite des cartes (inspiration).
function DotPattern({ className = 'text-brand/10' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 right-0 w-2/3 ${className}`}
      style={{
        backgroundImage: 'radial-gradient(currentColor 1.4px, transparent 1.4px)',
        backgroundSize: '14px 14px',
        maskImage: 'linear-gradient(to left, black, transparent)',
        WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
      }}
    />
  );
}

function StatCard({ icon: Icon, label, value, unit, hint, badge, highlight = false, loading = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 ${
        highlight
          ? 'bg-brand text-white shadow-[0_16px_32px_-16px_rgba(15,42,92,0.8)]'
          : 'border border-line bg-white shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)]'
      }`}
    >
      <DotPattern className={highlight ? 'text-white/10' : 'text-brand/[0.07]'} />
      <div className="relative flex items-start justify-between gap-2">
        <span
          className={`grid size-11 place-items-center rounded-2xl ${
            highlight ? 'bg-white/10 text-accent' : 'bg-brand-soft text-brand'
          }`}
        >
          <Icon className="size-6" />
        </span>
        {badge && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-brand">{badge}</span>
        )}
      </div>
      <p className={`relative mt-4 text-sm ${highlight ? 'text-white/80' : 'text-muted'}`}>{label}</p>
      {loading ? (
        <span className={`relative mt-1 block h-8 w-16 animate-pulse rounded-lg ${highlight ? 'bg-white/15' : 'bg-brand-soft'}`} />
      ) : (
        <p className="relative mt-0.5 text-[28px] leading-9 font-bold sm:text-3xl">
          {value ?? '—'}
          {unit && <span className="ml-1 text-base">{unit}</span>}
        </p>
      )}
      <p className={`relative mt-1 text-sm ${highlight ? 'text-white/75' : 'text-muted'}`}>{hint}</p>
    </div>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-brand">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

// Graphique des ventes : pas encore de données côté backend.
// On montre la forme du futur graphique, en pointillés, avec un message clair.
const GHOST_HEIGHTS = [
  [45, 70],
  [60, 40],
  [35, 55],
  [25, 20],
  [50, 85],
  [65, 35],
];

function SalesCard() {
  const months = lastSixMonths();

  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
      <CardHeader title="Ventes" subtitle="Suis tes ventes de tickets" />

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-brand" /> Tickets vendus
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-accent" /> Montant encaissé
        </span>
      </div>

      <div className="relative mt-4">
        <div aria-hidden="true" className="flex h-48 items-end justify-between gap-2 border-b border-line px-1 sm:h-56">
          {GHOST_HEIGHTS.map(([a, b], i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-1 sm:gap-1.5">
              <span
                className="w-3 rounded-full border-2 border-dashed border-brand/20 sm:w-5"
                style={{ height: `${a}%` }}
              />
              <span
                className="w-3 rounded-full border-2 border-dashed border-accent/40 sm:w-5"
                style={{ height: `${b}%` }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 flex justify-between px-1 text-sm text-muted">
          {months.map((m) => (
            <span key={m} className="flex-1 text-center">
              {m}
            </span>
          ))}
        </div>

        <div className="absolute inset-x-0 top-1/3 flex justify-center px-4">
          <div className="flex max-w-xs items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-[0_10px_30px_-12px_rgba(15,42,92,0.3)] backdrop-blur">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <ChartIcon className="size-5" />
            </span>
            <p className="text-sm text-ink">Pas encore de ventes. Elles s'afficheront ici dès le premier ticket vendu.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingsCard({ pricings, loading }) {
  const top = (pricings || []).slice(0, 5);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-brand-soft to-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
      <CardHeader
        title="Tes forfaits"
        subtitle="Prix proposés à tes clients"
        action={
          <Link
            to="/dashboard/forfaits"
            className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand transition hover:bg-brand hover:text-white"
          >
            Tout voir <ChevronRightIcon className="size-4" />
          </Link>
        }
      />

      {/* Gros chiffre, comme le graphique de l'inspiration */}
      <div className="my-5 flex items-center gap-4">
        <div className="relative grid size-24 shrink-0 place-items-center rounded-full bg-brand">
          <div className="absolute inset-2 rounded-full border-4 border-dashed border-accent/70" />
          <span className="text-3xl font-bold text-white">{loading ? '…' : (pricings?.length ?? '—')}</span>
        </div>
        <p className="text-sm text-muted">
          {pricings?.length
            ? 'Forfaits en vente en ce moment. Les moins chers en premier.'
            : 'Ajoute un forfait pour commencer à vendre des tickets.'}
        </p>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-11 animate-pulse rounded-xl bg-white/70" />
          ))}
        </ul>
      ) : top.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/70 p-4 text-center text-sm text-muted">
          Aucun forfait pour l'instant.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-base text-ink">{p.name}</p>
                {p.duration_label && <p className="truncate text-sm text-muted">{p.duration_label}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-brand">
                {priceFormat.format(p.amount)} F
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ZonesCard({ zones, pricings, loading }) {
  // Nombre de forfaits par zone, pour les barres.
  const countByZone = {};
  for (const p of pricings || []) countByZone[p.wifi_zone_id] = (countByZone[p.wifi_zone_id] || 0) + 1;
  const max = Math.max(1, ...Object.values(countByZone));

  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.2)] sm:p-5">
      <CardHeader title="Zones WiFi" subtitle="Tes lieux de vente" />

      {loading ? (
        <ul className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl bg-brand-soft" />
          ))}
        </ul>
      ) : !zones?.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">
          Aucune zone pour l'instant.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {zones.map((z) => {
            const count = countByZone[z.id] || 0;
            return (
              <li key={z.id} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">
                  {z.country}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-base text-ink">{z.name}</p>
                    <p className="shrink-0 text-sm text-muted">
                      {count} forfait{count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="truncate text-sm text-muted">{z.city}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
