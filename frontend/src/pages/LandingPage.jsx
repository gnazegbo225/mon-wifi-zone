// Page d'accueil publique (monwifizone.org/).
// Parti pris : beaucoup d'espace, de grands titres, peu de mots, aucun effet décoratif.
// Seule animation : un fondu discret à l'apparition de chaque bloc (coupé si l'appareil demande moins de mouvement).
import { MotionConfig, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import heroImageSmall from '../assets/hero-720.webp';
import heroImage from '../assets/hero.webp';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';

function Reveal({ children, delay = 0, className = '', as = 'div' }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </Tag>
  );
}

// Petit libellé au-dessus des titres de section.
function Eyebrow({ children, light = false }) {
  return <p className={`text-sm font-bold ${light ? 'text-white/60' : 'text-muted'}`}>{children}</p>;
}

const STEPS = [
  { title: 'Ajoute ta zone', text: 'Son nom, sa ville, l’adresse de ton routeur.' },
  { title: 'Crée tes forfaits', text: 'Fixe tes prix et importe tes tickets MikroTik.' },
  { title: 'Installe ton portail', text: 'Ta page de connexion et ta liste blanche, prêtes à coller.' },
  { title: 'Encaisse', text: 'Tes clients payent. Le ticket arrive tout seul.' },
];

const VALUES = [
  { title: 'Simple', text: 'Pensé pour le téléphone. Rien à apprendre.' },
  { title: 'Fiable', text: 'Chaque paiement est vérifié avant de livrer un ticket.' },
  { title: 'D’ici', text: 'Conçu en Côte d’Ivoire, pour le Mobile Money d’ici.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const spaceLink = user ? '/dashboard' : '/login';
  const spaceLabel = user ? 'Mon tableau de bord' : 'Espace gérant';

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-white text-ink">
        {/* En-tête */}
        <header className="sticky top-0 z-30 border-b border-line/60 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 lg:px-10">
            <Link to="/" aria-label="monwifizone, accueil">
              <img src={logo} alt="monwifizone" className="h-7 w-auto" />
            </Link>
            <nav className="hidden items-center gap-10 text-sm text-muted md:flex">
              <a href="#services" className="transition hover:text-ink">
                Services
              </a>
              <a href="#fonctionnement" className="transition hover:text-ink">
                Fonctionnement
              </a>
              <a href="#a-propos" className="transition hover:text-ink">
                À propos
              </a>
            </nav>
            <Link to={spaceLink} className="text-sm font-bold text-brand transition hover:text-brand-hover">
              {spaceLabel}
            </Link>
          </div>
        </header>

        {/* Héros */}
        <section className="mx-auto max-w-7xl px-5 pt-20 lg:px-10 lg:pt-28">
          <Reveal className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-5xl leading-[1.05] font-bold tracking-tight text-brand sm:text-6xl lg:text-7xl">
              Le WiFi qui se vend tout seul.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
              Tickets, paiement Mobile Money et portail captif. Une seule plateforme pour tes zones WiFi.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
              <Link
                to={spaceLink}
                className="rounded-full bg-brand px-7 py-3.5 font-bold text-white transition hover:bg-brand-hover"
              >
                {spaceLabel}
              </Link>
              <a href="#services" className="font-bold text-brand transition hover:text-brand-hover">
                Découvrir ›
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="mt-16 lg:mt-20">
            <img
              src={heroImage}
              srcSet={`${heroImageSmall} 720w, ${heroImage} 1200w`}
              sizes="(min-width: 1280px) 1200px, 100vw"
              width="1200"
              height="900"
              alt="Un gérant de zone WiFi configure son routeur depuis son ordinateur portable."
              fetchPriority="high"
              className="aspect-[4/3] w-full rounded-[28px] object-cover sm:aspect-[16/9]"
              style={{ objectPosition: 'center 45%' }}
            />
          </Reveal>
        </section>

        {/* Services */}
        <section id="services" className="scroll-mt-14">
          <div className="mx-auto max-w-7xl px-5 py-28 lg:px-10 lg:py-40">
            <Reveal className="max-w-3xl">
              <Eyebrow>Services</Eyebrow>
              <h2 className="text-balance mt-3 text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
                Tout pour vendre. Rien de trop.
              </h2>
            </Reveal>

            <div className="mt-16 grid gap-5 lg:grid-cols-3">
              {/* Paiement — grande tuile */}
              <Reveal className="flex flex-col justify-between gap-12 rounded-[28px] bg-page p-8 lg:col-span-2 lg:p-12">
                <div className="max-w-md">
                  <h3 className="text-2xl font-bold text-brand lg:text-3xl">Encaisse en Mobile Money.</h3>
                  <p className="mt-3 text-muted">Chaque paiement est vérifié avant de livrer le ticket.</p>
                </div>
                <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-2xl font-bold text-ink sm:grid-cols-4 lg:text-3xl">
                  {['Wave', 'Orange', 'MTN', 'Moov'].map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Reveal>

              {/* Tickets */}
              <Reveal delay={0.1} className="flex flex-col justify-between gap-12 rounded-[28px] bg-page p-8 lg:p-10">
                <div>
                  <h3 className="text-2xl font-bold text-brand">Tes tickets MikroTik, rangés.</h3>
                  <p className="mt-3 text-muted">Importe ton fichier. Chaque ticket rejoint son forfait.</p>
                </div>
                <dl className="divide-y divide-line border-y border-line text-sm">
                  {[
                    ['24 heures', '200 F'],
                    ['3 jours', '500 F'],
                    ['1 semaine', '1 500 F'],
                  ].map(([d, p]) => (
                    <div key={d} className="flex justify-between py-3">
                      <dt className="text-muted">{d}</dt>
                      <dd className="font-bold text-ink">{p}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>

              {/* Portail */}
              <Reveal className="flex flex-col justify-between gap-12 rounded-[28px] bg-brand p-8 text-white lg:p-10">
                <div>
                  <h3 className="text-2xl font-bold">Ton portail, à tes couleurs.</h3>
                  <p className="mt-3 text-white/70">Ta page de connexion WiFi, prête à installer sur ton routeur.</p>
                </div>
                <p className="text-sm text-white/60">login.html · rlogin.html · liste blanche</p>
              </Reveal>

              {/* Stock — grande tuile */}
              <Reveal delay={0.1} className="flex flex-col justify-between gap-12 rounded-[28px] bg-page p-8 lg:col-span-2 lg:p-12">
                <div className="max-w-md">
                  <h3 className="text-2xl font-bold text-brand lg:text-3xl">Ton stock, en direct.</h3>
                  <p className="mt-3 text-muted">Sache à tout moment ce qui reste, zone par zone.</p>
                </div>
                <dl className="grid grid-cols-3 gap-6">
                  {[
                    ['148', 'Libres'],
                    ['2', 'Réservés'],
                    ['57', 'Vendus'],
                  ].map(([n, l]) => (
                    <div key={l}>
                      <dd className="text-4xl font-bold tracking-tight text-ink lg:text-6xl">{n}</dd>
                      <dt className="mt-1 text-sm text-muted">{l}</dt>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Fonctionnement */}
        <section id="fonctionnement" className="scroll-mt-14 bg-brand text-white">
          <div className="mx-auto max-w-7xl px-5 py-28 lg:px-10 lg:py-40">
            <Reveal className="max-w-3xl">
              <Eyebrow light>Fonctionnement</Eyebrow>
              <h2 className="text-balance mt-3 text-4xl leading-tight font-bold tracking-tight lg:text-6xl">
                Prêt en quatre étapes.
              </h2>
            </Reveal>

            <ol className="mt-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
              {STEPS.map(({ title, text }, i) => (
                <Reveal
                  key={title}
                  as="li"
                  delay={i * 0.08}
                  className="border-t border-white/15 pt-6 lg:border-t-0 lg:border-l lg:px-8 lg:pt-0 lg:first:border-l-0 lg:first:pl-0"
                >
                  <p className="text-5xl font-bold text-accent lg:text-6xl">{i + 1}</p>
                  <h3 className="mt-8 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-white/70">{text}</p>
                </Reveal>
              ))}
            </ol>

            <Reveal className="mt-24 max-w-2xl border-t border-white/15 pt-10">
              <p className="text-2xl leading-snug font-bold lg:text-3xl">
                Pour ton client, c’est encore plus simple : il se connecte, il paye, il navigue.
              </p>
            </Reveal>
          </div>
        </section>

        {/* À propos */}
        <section id="a-propos" className="scroll-mt-14">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 py-28 lg:grid-cols-2 lg:gap-24 lg:px-10 lg:py-40">
            <Reveal>
              <Eyebrow>À propos</Eyebrow>
              <h2 className="text-balance mt-3 text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
                Internet, accessible à chacun.
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="lg:pt-10">
              <p className="text-xl leading-relaxed text-ink">
                monwifizone est né en Côte d’Ivoire, chez Lumière d’Afrique Energy. Une idée simple : un gérant doit
                pouvoir vendre ses tickets sans être sur place, et chaque client doit se connecter en quelques secondes,
                avec le Mobile Money qu’il utilise déjà.
              </p>
            </Reveal>

            <dl className="grid gap-10 border-t border-line pt-10 sm:grid-cols-3 lg:col-span-2">
              {VALUES.map(({ title, text }, i) => (
                <Reveal key={title} delay={i * 0.08}>
                  <dt className="text-xl font-bold text-brand">{title}</dt>
                  <dd className="mt-2 text-muted">{text}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Appel final */}
        <section className="bg-page">
          <Reveal className="mx-auto max-w-3xl px-5 py-28 text-center lg:py-36">
            <h2 className="text-balance text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
              Ta zone, ouverte jour et nuit.
            </h2>
            <Link
              to={spaceLink}
              className="mt-10 inline-block rounded-full bg-brand px-7 py-3.5 font-bold text-white transition hover:bg-brand-hover"
            >
              {spaceLabel}
            </Link>
          </Reveal>
        </section>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between lg:px-10">
            <img src={logo} alt="monwifizone" className="h-6 w-auto" />
            <p>© {new Date().getFullYear()} monwifizone · Lumière d’Afrique Energy</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
