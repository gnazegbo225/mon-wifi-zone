// Page d'accueil publique (monwifizone.org/).
// Parti pris : beaucoup d'espace, de grands titres, peu de mots. Seul le hero porte un visuel animé (components/hero).
// Animations : un fondu discret à l’apparition de chaque bloc, l’en-tête qui flotte au défilement (coupé si l'appareil demande moins de mouvement).
import { MotionConfig, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AboutSection from '../components/AboutSection';
import LandingHeader from '../components/LandingHeader';
import { ArrowRightIcon } from '../components/icons';
import FlipLabel from '../components/hero/FlipLabel';
import Hero from '../components/hero/Hero';
import ProcessSection from '../components/process/ProcessSection';
import ServicesSection from '../components/ServicesSection';
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

        <ServicesSection />

        <ProcessSection />

        <AboutSection />

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
