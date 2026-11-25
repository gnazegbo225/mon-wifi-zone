// Hero de la page d'accueil : le message à gauche, l'objet monwifizone à droite (dessous sur téléphone).
// Le texte apparaît en CSS dès le premier affichage, sans attendre le JavaScript, avec la même courbe
// que les fondus du reste de la page. Le fond passe sous l'en-tête, transparent tout en haut.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CoinsIcon, PhoneIcon, WifiIcon } from '../icons';
import { FloorGrid } from './Backdrops';
import CoreVisual from './CoreVisual';
import FlipLabel from './FlipLabel';
import './hero.css';

const FACTS = [
  { icon: PhoneIcon, value: '4 opérateurs', label: 'Wave, Orange, MTN, Moov' },
  { icon: CoinsIcon, value: '0 F', label: 'de frais de retrait' },
  { icon: WifiIcon, value: '24 h/24', label: 'tes ventes tournent' },
];

const rise = (delay) => ({ style: { animationDelay: `${delay}s` } });

function PlayIcon() {
  return (
    <svg viewBox="0 0 10 10" className="ml-px size-2" fill="currentColor" aria-hidden="true">
      <path d="M2 1.2v7.6L8.6 5z" />
    </svg>
  );
}

function HeroCopy({ ctaLink, ctaLabel }) {
  return (
    <div className="flex flex-col justify-center">
      <p {...rise(0.1)} className="mw-rise flex items-center gap-3 text-sm font-bold text-muted">
        <span aria-hidden="true" className="mw-dot size-2 rounded-full bg-accent" />
        Tickets WiFi · Mobile Money · Portail captif
      </p>

      <h1
        id="hero-title"
        {...rise(0.18)}
        className="mw-rise mt-6 text-[clamp(2.5rem,1.1rem+3.6vw,4.35rem)] leading-[1.05] font-bold tracking-tight text-balance text-brand"
      >
        Le WiFi qui se vend{' '}
        <span className="relative inline-block whitespace-nowrap">
          tout seul.
          {/* Trait orange sous les mots : l'orange reste une forme, jamais la couleur d'un texte sur fond clair. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 230 10"
            preserveAspectRatio="none"
            className="absolute -bottom-[0.1em] left-0 h-[0.18em] w-[92%] overflow-visible"
          >
            <path className="mw-underline" d="M3 7C60 2.5 150 1.5 227 5" pathLength="1" fill="none" stroke="#FF8A00" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </span>
      </h1>

      <p {...rise(0.3)} className="mw-rise mt-7 max-w-[30rem] text-lg leading-relaxed text-muted lg:text-xl">
        Tickets, paiement Mobile Money et portail captif. Une seule plateforme pour tes zones WiFi.
      </p>

      <div {...rise(0.4)} className="mw-rise mt-9 flex flex-wrap items-center gap-3">
        <Link
          to={ctaLink}
          className="mw-flip inline-flex h-13 items-center rounded-full bg-brand px-7 font-bold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-14"
        >
          <FlipLabel className="gap-2.5">
            {ctaLabel}
            <ArrowRightIcon className="size-5" />
          </FlipLabel>
        </Link>
        <a
          href="#fonctionnement"
          className="mw-flip inline-flex h-13 items-center rounded-full border border-line bg-white/60 px-6 font-bold text-brand transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-14"
        >
          <FlipLabel className="gap-3">
            <span className="grid size-5 place-items-center rounded-full border border-brand">
              <PlayIcon />
            </span>
            Comment ça marche
          </FlipLabel>
        </a>
      </div>

      <dl {...rise(0.58)} className="mw-rise mt-12 grid max-w-xl grid-cols-3 lg:mt-16">
        {FACTS.map(({ icon: Icon, value, label }, i) => (
          <div key={value} className={`flex flex-col gap-1 pr-3 sm:pr-6 ${i > 0 ? 'border-l border-line pl-4 sm:pl-6' : ''}`}>
            <Icon className="mb-2 size-8 text-brand" />
            <dd className="order-1 font-bold text-ink">{value}</dd>
            <dt className="order-2 text-sm text-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Diamètre du halo orange qui suit la souris, en px.
const SPOT = 340;

// La grille au sol, plus une copie orange vue à travers une fenêtre ronde qui suit le curseur.
// Fenêtre et grille ne bougent que par des transformations opposées : rien n'est redessiné.
// On écoute la section entière, car la grille est derrière le contenu et ne reçoit jamais le pointeur.
function HeroFloor() {
  const ref = useRef(null);
  const spotRef = useRef(null);
  const litRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const spot = spotRef.current;
    const lit = litRef.current;
    const section = el?.parentElement;
    if (!el || !spot || !lit || !section) return;

    // La grille orange a la taille de la section, pour que son motif tombe pile sur la grille grise.
    const resize = new ResizeObserver(([entry]) => {
      lit.style.width = `${entry.contentRect.width}px`;
      lit.style.height = `${entry.contentRect.height}px`;
    });
    resize.observe(section);

    let frame = 0;
    const handlePointerMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = section.getBoundingClientRect();
        const x = e.clientX - box.left - SPOT / 2;
        const y = e.clientY - box.top - SPOT / 2;
        spot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        lit.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
        el.dataset.spot = 'on';
      });
    };
    const handlePointerLeave = () => {
      cancelAnimationFrame(frame);
      el.dataset.spot = 'off';
    };

    section.addEventListener('pointermove', handlePointerMove);
    section.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      section.removeEventListener('pointermove', handlePointerMove);
      section.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" data-spot="off" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <FloorGrid id="mw-floor-cell" className="mw-floor absolute inset-0" />
      <div ref={spotRef} style={{ width: SPOT, height: SPOT }} className="mw-floor-spot">
        <div ref={litRef} className="mw-floor-lit">
          <FloorGrid id="mw-floor-cell-lit" stroke="#FF8A00" strokeWidth={1} className="block size-full" />
        </div>
      </div>
    </div>
  );
}

export default function Hero({ ctaLink, ctaLabel }) {
  return (
    <section id="top" aria-labelledby="hero-title" className="mw-hero-bg relative isolate -mt-14 overflow-x-clip pt-14">
      <HeroFloor />
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 pt-8 pb-16 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:px-10 lg:py-10 xl:gap-16">
        <HeroCopy ctaLink={ctaLink} ctaLabel={ctaLabel} />
        <CoreVisual />
      </div>
    </section>
  );
}
