import { TicketIcon } from '../components/icons';

export default function TicketsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-brand">Tickets</h1>
      <p className="mt-1 text-base text-muted">Les tickets WiFi vendus et disponibles.</p>

      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <TicketIcon className="size-7" />
        </span>
        <p className="mt-4 text-lg font-bold text-brand">Bientôt ici</p>
        <p className="mt-1 max-w-xs text-base text-muted">Tu pourras bientôt voir et gérer tes tickets sur cette page.</p>
      </div>
    </div>
  );
}
