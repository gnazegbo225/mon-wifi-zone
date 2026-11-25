// Logos des moyens de paiement acceptés (sources dans src/assets/payments/SOURCES.md).
// Les logos ne sont jamais modifiés : chacun est posé sur son fond (le jaune de MTN, blanc pour les autres).
import moov from '../assets/payments/moov-money.png';
import mtn from '../assets/payments/mtn.svg';
import orange from '../assets/payments/orange-money.svg';
import wave from '../assets/payments/wave.png';

const METHODS = {
  wave: { name: 'Wave', src: wave, bg: 'bg-white', img: 'h-[70%]' },
  orange: { name: 'Orange Money', src: orange, bg: 'bg-white', img: 'h-[55%]' },
  mtn: { name: 'MTN Mobile Money', src: mtn, bg: 'bg-[#FFCB05]', img: 'h-[70%]' },
  moov: { name: 'Moov Money', src: moov, bg: 'bg-white', img: 'h-[105%]' },
};

const ORDER = ['wave', 'orange', 'mtn', 'moov'];

// Un logo dans sa pastille. La hauteur se règle avec className (ex : h-12) ; la largeur suit le logo.
export function PaymentLogo({ id, className = 'h-12', bordered = true }) {
  const m = METHODS[id];
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl px-3 ${bordered ? 'border border-line' : ''} ${m.bg} ${className}`}
    >
      <img src={m.src} alt={m.name} className={`w-auto ${m.img}`} />
    </span>
  );
}

// Les quatre logos en ligne, pour dire « tes clients payent avec… ».
export function PaymentLogoList({ className = '', size = 'h-12 w-32' }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Moyens de paiement acceptés">
      {ORDER.map((id) => (
        <li key={id}>
          <PaymentLogo id={id} className={size} />
        </li>
      ))}
    </ul>
  );
}
