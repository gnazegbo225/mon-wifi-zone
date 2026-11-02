// E2 + E3 du parcours client : choisir un forfait, donner son numéro, payer.
// Le moyen de paiement (Wave, Orange, MTN, Moov, carte) se choisit ensuite sur la page Moneroo.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ClientLayout, Loading, PrimaryButton, SecondaryButton, Title } from '../client/ClientLayout';
import { formatPrice } from '../utils/format';
import { readLastPurchase, saveLastPurchase } from '../client/lastPurchase';
import Spinner from '../components/Spinner';
import { createPaymentIntent, getPublicZone } from '../services/api';

// 10 chiffres (07 07 07 07 07), avec +225 en option.
function phoneError(value) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('225') && digits.length > 10 ? digits.slice(3) : digits;
  if (!value.trim()) return 'Écris ton numéro de téléphone.';
  if (local.length !== 10) return 'Ce numéro n’est pas complet. Il faut 10 chiffres.';
  return null;
}

export default function BuyPage() {
  const { zoneId } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('pricing'));
  const [phone, setPhone] = useState(() => readLastPurchase().phone || '');
  const [phoneMessage, setPhoneMessage] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicZone(zoneId)
      .then((result) => active && setData(result))
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err.status === 404
            ? 'Cette zone WiFi n’existe pas, ou elle ne vend plus de tickets.'
            : 'On n’arrive pas à charger les forfaits. Vérifie ta connexion et réessaie.',
        );
      });
    return () => {
      active = false;
    };
  }, [zoneId]);

  const pricings = data?.pricings || [];
  const selected = pricings.find((p) => p.id === selectedId && p.available > 0) || null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const error = phoneError(phone);
    setPhoneMessage(error);
    if (error || !selected) return;

    setSubmitting(true);
    try {
      const { checkout_url: checkoutUrl } = await createPaymentIntent({ zoneId, pricingId: selected.id, phone });
      saveLastPurchase({ zoneId, pricingId: selected.id, phone });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setSubmitting(false);
      if (err.field === 'phone') return setPhoneMessage(err.message);
      if (err.message === 'Épuisé') {
        setData((d) => ({ ...d, pricings: d.pricings.map((p) => (p.id === selected.id ? { ...p, available: 0 } : p)) }));
        return setSubmitError('Ce forfait vient d’être épuisé. Choisis-en un autre.');
      }
      setSubmitError(err.status === 0 ? 'On n’arrive pas à joindre le serveur. Vérifie ta connexion et réessaie.' : err.message);
    }
  }

  if (loadError) {
    return (
      <ClientLayout>
        <div className="flex flex-col gap-4 text-center">
          <Title>Oups</Title>
          <p>{loadError}</p>
          <SecondaryButton onClick={() => window.location.reload()}>Réessayer</SecondaryButton>
        </div>
      </ClientLayout>
    );
  }

  if (!data) {
    return (
      <ClientLayout>
        <Loading text="Un instant, on charge les forfaits…" />
      </ClientLayout>
    );
  }

  return (
    <ClientLayout supportPhone={data.zone.manager_phone}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <Title>Choisis ton forfait</Title>
          <p className="mt-1 text-sm text-muted">{data.zone.name}</p>
        </div>

        {pricings.length === 0 ? (
          <p className="rounded-2xl bg-page p-4">Aucun forfait n’est en vente ici pour le moment.</p>
        ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Forfaits</legend>
            {pricings.map((p) => {
              const soldOut = p.available <= 0;
              const isSelected = selected?.id === p.id;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                    soldOut
                      ? 'cursor-not-allowed border-line bg-page opacity-70'
                      : isSelected
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-white hover:border-brand'
                  }`}
                >
                  <input
                    type="radio"
                    name="pricing"
                    value={p.id}
                    checked={isSelected}
                    disabled={soldOut}
                    onChange={() => setSelectedId(p.id)}
                    className="size-5 accent-brand"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold text-brand">{p.duration_label || p.name}</span>
                    <span className="text-sm text-muted">
                      {soldOut ? 'Épuisé' : [p.name !== p.duration_label && p.name, p.speed_label].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-lg font-bold text-brand">{formatPrice(p.amount)}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="font-bold">
            Ton numéro de téléphone
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
            className={`min-h-12 rounded-2xl border-2 bg-white px-4 text-base outline-none focus:border-brand ${
              phoneMessage ? 'border-danger' : 'border-line'
            }`}
          />
          <p id="phone-help" className={`text-sm ${phoneMessage ? 'text-danger' : 'text-muted'}`}>
            {phoneMessage || 'Il sert à retrouver ton ticket si tu fermes la page.'}
          </p>
        </div>

        {submitError && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {submitError}
          </p>
        )}

        <PrimaryButton type="submit" disabled={!selected || submitting}>
          {submitting ? (
            <>
              <Spinner className="size-5" /> Un instant…
            </>
          ) : selected ? (
            `Payer ${formatPrice(selected.amount)}`
          ) : (
            'Choisis un forfait'
          )}
        </PrimaryButton>
        <p className="text-center text-sm text-muted">Tu choisiras Wave, Orange Money, MTN ou Moov à l’étape suivante.</p>
      </form>
    </ClientLayout>
  );
}
