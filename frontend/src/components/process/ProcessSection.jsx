// Section « Fonctionnement » de la page d'accueil : les quatre étapes du promoteur à gauche, et à droite
// une petite scène animée qui montre l'étape en cours. Tant que la section est à l'écran, les étapes
// défilent seules (une barre orange montre le temps restant) ; un clic choisit une étape et la rejoue.
// Si l'appareil demande moins de mouvement : pas de défilement automatique, scènes affichées figées.
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { FloorGrid } from '../hero/Backdrops';
import { EASE } from '../hero/layout';
import { reveal } from '../reveal';
import { CheckIcon, PhoneIcon, WifiIcon } from '../icons';
import { CashScene, PlansScene, PortalScene, ZoneScene } from './ProcessScenes';
import './process.css';

const STEPS = [
  { title: 'Ajoute ta zone', text: 'Son nom, sa ville, l’adresse de ton routeur.', scene: ZoneScene },
  { title: 'Crée tes forfaits', text: 'Fixe tes prix et importe tes tickets MikroTik.', scene: PlansScene },
  { title: 'Installe ton portail', text: 'Ta page de connexion et ta liste blanche, prêtes à coller.', scene: PortalScene },
  { title: 'Encaisse', text: 'Tes clients payent. Le ticket arrive tout seul.', scene: CashScene },
];

// Durée d'une étape quand elles défilent seules.
const STEP_MS = 6000;

function GlobeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.5 5.1 3.5 8.5s-1.1 6.2-3.5 8.5c-2.4-2.3-3.5-5.1-3.5-8.5s1.1-6.2 3.5-8.5Z" />
    </svg>
  );
}

const CLIENT_STEPS = [
  { icon: WifiIcon, label: 'Il se connecte' },
  { icon: PhoneIcon, label: 'Il paye' },
  { icon: GlobeIcon, label: 'Il navigue' },
];

// Le parcours du client en trois temps, avec un point orange qui va de l'un à l'autre.
function ClientStrip() {
  return (
    <motion.div
      {...reveal(0.1)}
      className="mt-10 rounded-[28px] border border-line bg-white p-6 lg:mt-12 lg:flex lg:items-center lg:gap-12 lg:p-8"
    >
      <p className="text-xl leading-snug font-bold text-brand lg:max-w-xs lg:text-2xl">Pour ton client, c’est encore plus simple.</p>
      <ol className="relative mt-6 grid grid-cols-3 lg:mt-0 lg:flex-1">
        <span aria-hidden="true" className="absolute top-6 right-[16.66%] left-[16.66%] border-t-2 border-dashed border-line" />
        <span aria-hidden="true" className="proc-travel absolute top-6 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        {CLIENT_STEPS.map(({ icon: Icon, label }) => (
          <li key={label} className="relative flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-full bg-brand text-white ring-4 ring-white">
              <Icon className="size-6" />
            </span>
            <span className="mt-3 text-sm font-bold text-ink sm:text-base">{label}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

export default function ProcessSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  // Change à chaque clic : relance la scène et la barre de temps, même sur l'étape déjà affichée.
  const [run, setRun] = useState(0);
  const running = inView && !reduce;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [running, active, run]);

  const select = (i) => {
    setActive(i);
    setRun((r) => r + 1);
  };

  const Scene = STEPS[active].scene;

  return (
    <section id="fonctionnement" ref={ref} className="scroll-mt-20 bg-page">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
        <motion.div {...reveal()} className="max-w-3xl">
          <p className="text-sm font-bold text-muted">Fonctionnement</p>
          <h2 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-balance text-brand lg:text-6xl">
            Prêt en quatre étapes.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted">Quelques minutes pour tout installer. Ensuite, tes ventes tournent seules.</p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
          {/* Les étapes. Le trait orange entre les pastilles avance avec l'étape en cours. */}
          <ol className="order-2 space-y-2 lg:order-1">
            {STEPS.map((step, i) => {
              const isActive = i === active;
              const done = i < active;
              return (
                <motion.li key={step.title} {...reveal(i * 0.08)} className="relative">
                  {i < STEPS.length - 1 && (
                    <span aria-hidden="true" className="absolute top-10 left-10 h-[calc(100%+0.5rem)] w-0.5 -translate-x-1/2 bg-line">
                      <motion.span
                        className="block h-full w-full origin-top bg-accent"
                        initial={false}
                        animate={{ scaleY: done ? 1 : 0 }}
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`relative w-full rounded-2xl p-5 text-left transition-[background-color,box-shadow] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      isActive ? 'bg-white shadow-xl ring-1 shadow-brand/5 ring-line' : 'hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-300 ${
                          isActive ? 'bg-brand text-white' : done ? 'bg-brand-soft text-brand' : 'bg-white text-muted ring-1 ring-line'
                        }`}
                      >
                        {done ? <CheckIcon className="size-5" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 pt-1.5">
                        <span className="block text-lg font-bold text-brand">{step.title}</span>
                        <span className="mt-1 block text-muted">{step.text}</span>
                      </span>
                    </span>
                    {isActive && running && (
                      <span aria-hidden="true" className="mt-4 ml-14 block h-1 overflow-hidden rounded-full bg-line/70">
                        <motion.span
                          key={`${active}-${run}`}
                          className="block h-full origin-left rounded-full bg-accent"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                        />
                      </span>
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ol>

          {/* La scène de l'étape en cours. */}
          <motion.div
            {...reveal(0.1)}
            role="img"
            aria-label={`Illustration de l’étape ${active + 1} : ${STEPS[active].title}`}
            className="relative order-1 h-[27rem] overflow-hidden rounded-[28px] border border-line bg-white sm:h-[28rem] lg:order-2 lg:h-[32rem]"
          >
            <FloorGrid id="proc-floor" className="proc-floor absolute inset-0" />
            <div aria-hidden="true" className="proc-glow absolute inset-0" />
            <p aria-hidden="true" className="absolute top-5 left-5 flex items-center gap-2 text-sm font-bold text-muted">
              <span className="mw-dot size-2 rounded-full bg-accent" />
              Étape {active + 1} sur {STEPS.length}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${active}-${run}`}
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center px-6 pt-12 pb-10"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <Scene animated={!reduce} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        <ClientStrip />
      </div>
    </section>
  );
}
