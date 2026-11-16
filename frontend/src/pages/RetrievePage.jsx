// « Récupérer mon ticket » (/retrieve/:zoneId) : lien du portail captif. Le client donne le numéro avec
// lequel il a payé et retrouve ses tickets de cette zone (achats réussis des 7 derniers jours).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClientLayout, PrimaryButton, SecondaryButton, Title } from '../client/ClientLayout';
import { readLastPurchase } from '../client/lastPurchase';
import { phoneError } from '../client/phone';
import { TicketView } from '../client/Ticket';
import Spinner from '../components/Spinner';
import { getPublicZone, retrieveTickets } from '../services/api';
import { formatPhone, formatPrice } from '../utils/format';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function Purchase({ purchase, routerHost, managerPhone, first }) {
  const [open, setOpen] = useState(first);
  const label = `${purchase.pricing_duration_label || purchase.pricing_name} — ${formatPrice(purchase.amount)}`;
  return (
    <li className="rounded-2xl border border-line p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-bold text-brand">{label}</span>
          <span className="text-sm text-muted">Payé le {dateTime.format(new Date(purchase.completed_at))}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-brand">{open ? 'Masquer' : 'Voir'}</span>
      </button>
      {open && (
        <div className="mt-4 text-center">
          {purchase.ticket ? (
            <TicketView ticket={purchase.ticket} routerHost={routerHost} />
          ) : (
            <p className="rounded-2xl bg-page px-4 py-3 text-sm">
              Ton ticket n’est pas encore prêt. Ton argent n’est pas perdu : {managerPhone ? 'appelle' : 'montre cette page à'} le gérant, il te donnera ton
              code. Référence : <span className="font-bold">{purchase.payment_id.slice(0, 8).toUpperCase()}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function RetrievePage() {
  const { zoneId } = useParams();
  const validZone = UUID_REGEX.test(zoneId || '');
  const [zone, setZone] = useState(null); // nom et téléphone du gérant, si la zone vend encore
  const [phone, setPhone] = useState(() => readLastPurchase().phone || '');
  const [phoneMessage, setPhoneMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null); // { phone, purchases, router_host, days, zone }

  useEffect(() => {
    if (!validZone) return undefined;
    let active = true;
    getPublicZone(zoneId)
      .then((data) => active && setZone(data.zone))
      .catch(() => {}); // zone désactivée : la recherche marche quand même
    return () => {
      active = false;
    };
  }, [zoneId, validZone]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const message = phoneError(phone);
    setPhoneMessage(message);
    if (message) return;
    setSearching(true);
    try {
      const data = await retrieveTickets(zoneId, phone);
      setResult({ ...data, phone });
      setZone((z) => z || data.zone);
    } catch (err) {
      if (err.field === 'phone') setPhoneMessage(err.message);
      else if (err.status === 404) setError('Cette zone WiFi n’existe pas. Vérifie le lien.');
      else if (err.status === 0) setError('On n’arrive pas à joindre le serveur. Vérifie ta connexion et réessaie.');
      else setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  const supportPhone = zone?.manager_phone || null;

  if (!validZone) {
    return (
      <ClientLayout>
        <div className="flex flex-col gap-3 text-center">
          <Title>Lien incomplet</Title>
          <p>Ouvre « Récupérer mon ticket » depuis la page de connexion du WiFi.</p>
        </div>
      </ClientLayout>
    );
  }

  if (result) {
    const found = result.purchases.length > 0;
    return (
      <ClientLayout supportPhone={supportPhone}>
        <div className="flex flex-col gap-5">
          <div>
            <Title>{found ? (result.purchases.length > 1 ? 'Tes tickets' : 'Ton ticket') : 'Aucun ticket trouvé'}</Title>
            <p className="mt-1 text-sm text-muted">
              {zone?.name ? `${zone.name} · ` : ''}
              {formatPhone(result.phone.replace(/[\s.\-()]/g, ''))}
            </p>
          </div>

          {found ? (
            <ul className="flex flex-col gap-3">
              {result.purchases.map((p, i) => (
                <Purchase key={p.payment_id} purchase={p} routerHost={result.router_host} managerPhone={supportPhone} first={i === 0} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-2">
              <p>Aucun ticket payé avec ce numéro ici, ces {result.days} derniers jours.</p>
              <p className="text-sm text-muted">
                Vérifie que c’est bien le numéro donné au moment de l’achat. Si tu as payé et que rien n’apparaît, garde le SMS de ton opérateur et contacte le
                gérant.
              </p>
            </div>
          )}

          <SecondaryButton
            onClick={() => {
              setPhone('');
              setResult(null);
            }}
          >
            Chercher avec un autre numéro
          </SecondaryButton>
          {!found && zone && (
            <Link to={`/buy/${zoneId}`} className="text-center text-sm font-bold text-brand underline">
              Acheter un ticket
            </Link>
          )}
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout supportPhone={supportPhone}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <Title>Récupérer mon ticket</Title>
          <p className="mt-1 text-sm text-muted">{zone?.name || 'Tu as déjà payé ? Retrouve ton code ici.'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="font-bold">
            Le numéro utilisé pour l’achat
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07 00 00 00 00"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneMessage) setPhoneMessage(null);
            }}
            aria-invalid={phoneMessage ? 'true' : 'false'}
            aria-describedby="phone-help"
            className={`min-h-12 rounded-2xl border-2 bg-white px-4 text-base outline-none focus:border-brand ${phoneMessage ? 'border-danger' : 'border-line'}`}
          />
          <p id="phone-help" className={`text-sm ${phoneMessage ? 'text-danger' : 'text-muted'}`}>
            {phoneMessage || 'Celui que tu as écrit avant de payer.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <PrimaryButton type="submit" disabled={searching}>
          {searching ? (
            <>
              <Spinner className="size-5" /> Un instant…
            </>
          ) : (
            'Retrouver mon ticket'
          )}
        </PrimaryButton>
      </form>
    </ClientLayout>
  );
}
