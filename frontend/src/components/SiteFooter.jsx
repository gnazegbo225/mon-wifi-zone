// Pied de page du site public : logo et phrase d'accroche à gauche, colonnes de liens à droite,
// puis une ligne avec le copyright et les liens juridiques.
// Les liens commençant par « / » sans « # » passent par le routeur ; les autres (ancres, mailto) restent des <a>.
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { COMPANY } from '../legal/company';

const DEFAULT_SECTIONS = [
  {
    title: 'La plateforme',
    links: [
      { name: 'Services', href: '/#services' },
      { name: 'Fonctionnement', href: '/#fonctionnement' },
      { name: 'À propos', href: '/#a-propos' },
    ],
  },
  {
    title: 'Promoteurs',
    links: [
      { name: 'Devenir promoteur', href: '/inscription' },
      { name: 'Se connecter', href: '/connexion' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { name: 'Mot de passe oublié', href: '/mot-de-passe-oublie' },
      { name: 'Nous écrire', href: `mailto:${COMPANY.email}` },
    ],
  },
];

const DEFAULT_LEGAL_LINKS = [{ name: 'Conditions générales des promoteurs', href: '/conditions-promoteurs' }];

function FooterLink({ href, className, children }) {
  if (href.startsWith('/') && !href.includes('#')) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

// socialLinks : [{ icon: <svg …/>, href, label }]. Vide par défaut : rien ne s'affiche tant qu'il n'y a pas de vrais comptes.
export default function SiteFooter({
  description = 'Tickets, paiement Mobile Money et portail captif. Une seule plateforme pour tes zones WiFi.',
  sections = DEFAULT_SECTIONS,
  socialLinks = [],
  legalLinks = DEFAULT_LEGAL_LINKS,
}) {
  const year = new Date().getFullYear();
  const linkClass = 'transition hover:text-brand';

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-7xl px-5 pt-16 lg:px-10 lg:pt-24">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-20">
          {/* Marque */}
          <div className="flex max-w-sm flex-col gap-5">
            <Link to="/" aria-label="monwifizone, accueil" className="self-start">
              <img src={logo} alt="monwifizone" className="h-8 w-auto" />
            </Link>
            <p className="text-muted">{description}</p>
            {socialLinks.length > 0 && (
              <ul className="flex items-center gap-5 text-muted">
                {socialLinks.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} aria-label={s.label} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {s.icon}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Colonnes de liens */}
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:gap-x-16">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-bold text-brand">{section.title}</h2>
                <ul className="mt-4 space-y-3 text-sm text-muted">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <FooterLink href={link.href} className={linkClass}>
                        {link.name}
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Ligne du bas */}
        <div className="mt-16 flex flex-col gap-4 border-t border-line py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p className="order-2 md:order-1">© {year} monwifizone. Tous droits réservés.</p>
          <ul className="order-1 flex flex-wrap gap-x-6 gap-y-2 md:order-2">
            {legalLinks.map((link) => (
              <li key={link.name}>
                <FooterLink href={link.href} className={`underline-offset-2 hover:underline ${linkClass}`}>
                  {link.name}
                </FooterLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
