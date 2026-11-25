// Page d'accueil publique (monwifizone.org/).
// Parti pris : beaucoup d'espace, de grands titres, peu de mots. Seul le hero porte un visuel animé (components/hero).
// Animations : un fondu discret à l’apparition de chaque bloc, l’en-tête qui flotte au défilement (coupé si l'appareil demande moins de mouvement).
import { MotionConfig, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import LandingHeader from '../components/LandingHeader';
import { ArrowRightIcon } from '../components/icons';
import FlipLabel from '../components/hero/FlipLabel';
import Hero from '../components/hero/Hero';
import ProcessSection from '../components/process/ProcessSection';
import SiteFooter from '../components/SiteFooter';

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
function Eyebrow({ children }) {
  return <p className="text-sm font-bold text-muted">{children}</p>;
}

const VALUES = [
  { title: 'Simple', text: 'Pensé pour le téléphone. Rien à apprendre.' },
  { title: 'Fiable', text: 'Chaque paiement est vérifié avant de livrer un ticket.' },
  { title: 'D’ici', text: 'Conçu en Côte d’Ivoire, pour le Mobile Money d’ici.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  // Bouton principal : s'inscrire si on n'a pas encore de compte.
  const ctaLink = user ? '/espace' : '/inscription';
  const ctaLabel = user ? 'Mon tableau de bord' : 'Devenir promoteur';

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-white text-ink">
        <LandingHeader />

        <Hero ctaLink={ctaLink} ctaLabel={ctaLabel} />

        {/* Services */}
        <section id="services" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 pt-10 pb-16 lg:px-10 lg:pt-12 lg:pb-24">
            <Reveal className="max-w-3xl">
              <Eyebrow>Services</Eyebrow>
              <h2 className="text-balance mt-3 text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
                Tout pour vendre. Rien de trop.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-3">
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

        <ProcessSection />

        {/* À propos */}
        <section id="a-propos" className="scroll-mt-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:gap-x-24 lg:gap-y-12 lg:px-10 lg:py-24">
            <Reveal>
              <Eyebrow>À propos</Eyebrow>
              <h2 className="text-balance mt-3 text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
                Internet, accessible à chacun.
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="lg:pt-8">
              <p className="text-xl leading-relaxed text-ink">
                monwifizone est né en Côte d’Ivoire. Une idée simple : un gérant doit
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
          <Reveal className="mx-auto max-w-3xl px-5 py-16 text-center lg:py-24">
            <h2 className="text-balance text-4xl leading-tight font-bold tracking-tight text-brand lg:text-6xl">
              Ta zone, ouverte jour et nuit.
            </h2>
            <Link
              to={ctaLink}
              className="mw-flip mt-10 inline-flex h-14 items-center rounded-full bg-brand px-7 font-bold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <FlipLabel className="gap-2.5">
                {ctaLabel}
                <ArrowRightIcon className="size-5" />
              </FlipLabel>
            </Link>
          </Reveal>
        </section>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
