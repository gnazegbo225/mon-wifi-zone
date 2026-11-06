// Page d'accueil publique (monwifizone.org/) : présente la plateforme et mène à l'espace gérant.
// Animations framer-motion : entrée du héros, révélation au défilement, léger parallaxe.
// MotionConfig reducedMotion="user" : aucune animation si le téléphone demande moins de mouvement.
import { MotionConfig, motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import {
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  CoinsIcon,
  MapPinIcon,
  PhoneIcon,
  RouterIcon,
  TicketIcon,
  WifiIcon,
} from '../components/icons';

const EASE = [0.22, 1, 0.36, 1];

// Apparition au défilement : le bloc monte et se dévoile une seule fois.
function Reveal({ children, delay = 0, className = '', as = 'div' }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

function SectionTitle({ title, text }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold text-brand sm:text-4xl">{title}</h2>
      <p className="mt-3 text-lg text-muted">{text}</p>
    </Reveal>
  );
}

const heroContainer = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } };
const heroItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const METHODS = ['Wave', 'Orange Money', 'MTN MoMo', 'Moov Money'];

const FEATURES = [
  {
    icon: WifiIcon,
    title: 'Portail captif',
    text: 'Ta page de connexion WiFi, à tes couleurs, prête à installer sur ton MikroTik.',
  },
  {
    icon: TicketIcon,
    title: 'Tickets MikroTik',
    text: 'Importe ton fichier de tickets. Chacun est rangé dans le bon forfait.',
  },
  {
    icon: CoinsIcon,
    title: 'Paiement Mobile Money',
    text: 'Wave, Orange Money, MTN et Moov. Chaque paiement est vérifié avant de livrer le ticket.',
  },
  {
    icon: ChartIcon,
    title: 'Stock en direct',
    text: 'Tickets libres, réservés et vendus, forfait par forfait.',
  },
  {
    icon: MapPinIcon,
    title: 'Plusieurs zones',
    text: 'Toutes tes zones WiFi au même endroit, chacune avec ses forfaits et son gérant.',
  },
  {
    icon: PhoneIcon,
    title: 'Pensé pour le téléphone',
    text: 'Gère tes zones depuis ton téléphone, où que tu sois.',
  },
];

const STEPS = [
  { title: 'Ajoute ta zone', text: 'Son nom, sa ville et l’adresse de ton routeur.' },
  { title: 'Crée tes forfaits', text: 'Fixe tes prix, puis importe tes tickets MikroTik.' },
  { title: 'Installe ton portail', text: 'Télécharge ta page de connexion et colle ta liste blanche.' },
  { title: 'Vends tes tickets', text: 'Tes clients payent en Mobile Money. Le ticket arrive tout seul.' },
];

// Téléphone du héros : l'écran « Paiement reçu » du parcours client.
function HeroPhone() {
  return (
    <div className="relative mx-auto w-[240px] sm:w-[260px]">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-[40px] border-[9px] border-ink bg-page p-3.5 shadow-[0_40px_80px_-30px_rgba(15,42,92,0.6)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-ink/15" />
        <img src={logo} alt="" className="mx-auto h-5 w-auto" />
        <div className="mt-3 rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-line">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-success-soft text-success">
            <CheckIcon className="size-6" />
          </div>
          <p className="mt-2 text-lg font-bold text-brand">Paiement reçu</p>
          <p className="text-sm text-muted">Voici ton code :</p>
          <div className="relative mt-3 rounded-2xl border-2 border-dashed border-brand bg-brand-soft py-2.5">
            <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full border-2 border-brand bg-white" />
            <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full border-2 border-brand bg-white" />
            <p className="text-2xl font-bold tracking-wider text-brand">4821-7730</p>
          </div>
          <div className="mt-3 rounded-2xl bg-accent py-2.5 text-sm font-bold text-brand">Me connecter maintenant</div>
          <p className="mt-2 text-sm text-muted">Forfait 24 h — 200 F</p>
        </div>
      </motion.div>
    </div>
  );
}

// Visuel du héros : un grand cadre arrondi (comme une photo), le téléphone au centre, des pastilles autour.
function HeroVisual() {
  return (
    <div className="relative isolate overflow-hidden rounded-[32px] bg-gradient-to-br from-brand to-[#1d3f7f] px-6 py-10 shadow-[0_30px_70px_-30px_rgba(15,42,92,0.7)] sm:py-12">
      {/* Ondes WiFi qui pulsent derrière le téléphone */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 grid place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute size-[380px] rounded-full border-2 border-accent/50"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.3], opacity: [0.8, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: 'easeOut' }}
          />
        ))}
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-10 size-64 rounded-full bg-accent/15 blur-2xl" />
      </div>

      <HeroPhone />

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
        className="absolute top-8 left-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-brand shadow-lg sm:top-12 sm:left-6"
      >
        <span className="size-2.5 rounded-full bg-accent" /> Payé avec Wave
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.15, duration: 0.6, ease: EASE }}
        className="absolute right-4 bottom-8 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-success shadow-lg sm:right-6 sm:bottom-12"
      >
        <CheckIcon className="size-4" /> Ticket envoyé
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 90]);

  const spaceLink = user ? '/dashboard' : '/login';
  const spaceLabel = user ? 'Mon tableau de bord' : 'Espace gérant';

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh overflow-x-clip bg-white text-ink">
        {/* En-tête */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link to="/" aria-label="monwifizone, accueil" className="shrink-0">
              <img src={logo} alt="monwifizone" className="h-8 w-auto" />
            </Link>
            <nav className="hidden items-center gap-8 md:flex">
              <a href="#fonctionnalites" className="text-sm text-muted transition hover:text-brand">
                Fonctionnalités
              </a>
              <a href="#etapes" className="text-sm text-muted transition hover:text-brand">
                Comment ça marche
              </a>
            </nav>
            <div className="flex items-center gap-3">
              {!user && (
                <Link to="/login" className="hidden text-sm font-bold text-brand sm:block">
                  Se connecter
                </Link>
              )}
              <Link
                to={spaceLink}
                className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover"
              >
                {spaceLabel}
              </Link>
            </div>
          </div>
        </header>

        {/* Héros */}
        <section ref={heroRef}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
            <motion.div variants={heroContainer} initial="hidden" animate="show">
              <motion.p
                variants={heroItem}
                className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand"
              >
                <WifiIcon className="size-4" />
                Tickets WiFi + Mobile Money
              </motion.p>
              <motion.h1
                variants={heroItem}
                className="mt-5 text-4xl leading-[1.1] font-bold tracking-tight text-ink sm:text-5xl lg:text-[56px]"
              >
                Gère tes zones WiFi.{' '}
                <span className="relative text-brand">
                  Vends tes tickets en Mobile Money.
                  <svg aria-hidden="true" viewBox="0 0 200 12" className="absolute -bottom-2 left-0 h-3 w-2/3" preserveAspectRatio="none">
                    <motion.path
                      d="M2 9 Q 100 1 198 7"
                      fill="none"
                      stroke="#FF8A00"
                      strokeWidth="5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.8, duration: 0.9, ease: EASE }}
                    />
                  </svg>
                </span>
              </motion.h1>
              <motion.p variants={heroItem} className="mt-6 max-w-xl text-lg text-muted">
                Tes clients achètent leur ticket depuis ton portail WiFi. Le paiement est vérifié, le code arrive tout
                seul. Toi, tu n’as rien à faire, même la nuit.
              </motion.p>
              <motion.div variants={heroItem} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={spaceLink}
                  className="group flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-brand shadow-[0_14px_30px_-12px_rgba(255,138,0,0.7)] transition hover:brightness-95"
                >
                  {spaceLabel}
                  <ArrowRightIcon className="size-5 transition group-hover:translate-x-1" />
                </Link>
                <a
                  href="#etapes"
                  className="flex min-h-12 items-center justify-center rounded-full border border-line bg-white px-6 font-bold text-brand transition hover:border-brand"
                >
                  Comment ça marche
                </a>
              </motion.div>
              <motion.ul variants={heroItem} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {['Paiement vérifié', 'Ticket en quelques secondes', 'Compatible MikroTik'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-success" /> {t}
                  </li>
                ))}
              </motion.ul>
            </motion.div>

            <motion.div
              style={{ y: visualY }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            >
              <HeroVisual />
            </motion.div>
          </div>
        </section>

        {/* Moyens de paiement */}
        <section className="border-y border-line">
          <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
            <p className="text-sm font-bold tracking-[0.16em] text-muted uppercase">Tes clients payent avec</p>
            <ul className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {METHODS.map((m) => (
                <li key={m} className="rounded-full bg-page px-4 py-2 text-sm font-bold text-brand ring-1 ring-line">
                  {m}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctionnalites" className="scroll-mt-20 bg-page">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionTitle
              title="Tout ce qu’il te faut"
              text="Une seule plateforme pour vendre, encaisser et suivre tes zones WiFi."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }, i) => (
                <Reveal key={title} delay={(i % 3) * 0.1}>
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="h-full rounded-3xl bg-white p-6 shadow-[0_4px_16px_-10px_rgba(15,42,92,0.25)] ring-1 ring-line transition-shadow hover:shadow-[0_20px_40px_-20px_rgba(15,42,92,0.35)]"
                  >
                    <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 font-bold text-brand">{title}</h3>
                    <p className="mt-2 text-sm text-muted">{text}</p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 4 étapes */}
        <section id="etapes" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionTitle title="Prêt à vendre en 4 étapes" text="De ta zone WiFi à ton premier ticket vendu." />

            <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {/* Trait qui relie les étapes, tracé au défilement */}
              <motion.span
                aria-hidden="true"
                className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-0.5 origin-left bg-brand lg:block"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
              />
              {STEPS.map(({ title, text }, i) => (
                <Reveal key={title} as="li" delay={0.2 + i * 0.18} className="relative text-center">
                  <div className="relative mx-auto grid size-14 place-items-center rounded-full border-2 border-brand bg-white text-sm font-bold text-brand shadow-[0_0_0_6px_white]">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mt-4 font-bold text-brand">{title}</h3>
                  <p className="mx-auto mt-2 max-w-[220px] text-sm text-muted">{text}</p>
                </Reveal>
              ))}
            </ol>

            {/* Côté client : ce que vit l'acheteur, en une ligne */}
            <Reveal className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-3xl bg-page p-5 ring-1 ring-line sm:flex-row sm:p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-accent">
                <RouterIcon className="size-6" />
              </div>
              <p className="text-center text-muted sm:text-left">
                <strong className="text-brand">Et pour ton client ?</strong> Il se connecte à ton WiFi, choisit son
                forfait, paye, et reçoit son code. Un bouton le connecte en un geste.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Appel final */}
        <section className="bg-page">
          <Reveal className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-24">
            <h2 className="text-3xl font-bold text-brand sm:text-4xl">Ta zone WiFi vend pendant que tu vis.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Connecte-toi pour ajouter tes zones, tes forfaits et tes tickets.
            </p>
            <Link
              to={spaceLink}
              className="group mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 font-bold text-brand shadow-[0_14px_30px_-12px_rgba(255,138,0,0.7)] transition hover:brightness-95"
            >
              {spaceLabel}
              <ArrowRightIcon className="size-5 transition group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </section>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
            <img src={logo} alt="monwifizone" className="h-6 w-auto" />
            <p>© {new Date().getFullYear()} monwifizone · Lumière d’Afrique Energy</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
