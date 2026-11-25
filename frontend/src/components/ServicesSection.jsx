// Section « Services » de la page d'accueil : quatre tuiles en grille, dans le même langage que le hero,
// « Fonctionnement » et le pied de page (cartes blanches bordées, titres bleu nuit, pastille d'icône,
// orange réservé aux formes). Chaque tuile montre un petit aperçu de ce que le promoteur aura à l'écran.
import { motion } from 'framer-motion';
import { PaymentLogoList } from './PaymentLogos';
import { reveal } from './reveal';
import { ChartIcon, CheckIcon, PhoneIcon, TagIcon, TicketIcon, WifiIcon } from './icons';

const PLANS = [
  ['24 heures', '200 F'],
  ['3 jours', '500 F'],
  ['1 semaine', '1 500 F'],
];

const PORTAL_FILES = ['login.html', 'rlogin.html', 'Liste blanche'];

// Exemple de stock d'une zone : la barre et la légende se lisent ensemble.
const STOCK = [
  { label: 'Libres', value: 148, color: 'bg-brand' },
  { label: 'Réservés', value: 2, color: 'bg-accent' },
  { label: 'Vendus', value: 57, color: 'bg-success' },
];
const STOCK_TOTAL = STOCK.reduce((sum, s) => sum + s.value, 0);

// Une tuile : en-tête (pastille d'icône, titre, phrase) puis son aperçu, collé en bas.
function Tile({ icon: Icon, title, text, dark = false, delay = 0, className = '', children }) {
  return (
    <motion.article
      {...reveal(delay)}
      className={`flex flex-col gap-8 rounded-[28px] p-6 sm:p-8 lg:p-10 ${
        dark ? 'bg-brand text-white' : 'border border-line bg-white'
      } ${className}`}
    >
      <div>
        <span
          className={`grid size-11 place-items-center rounded-2xl ${dark ? 'bg-white/10 text-accent' : 'bg-brand-soft text-brand'}`}
        >
          <Icon className="size-6" />
        </span>
        <h3 className={`mt-5 text-2xl leading-tight font-bold ${dark ? '' : 'text-brand'}`}>{title}</h3>
        <p className={`mt-2 max-w-md ${dark ? 'text-white/70' : 'text-muted'}`}>{text}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </motion.article>
  );
}

export default function ServicesSection() {
  return (
    <section id="services" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-16 lg:px-10 lg:pt-12 lg:pb-24">
        <motion.div {...reveal()} className="max-w-3xl">
          <p className="text-sm font-bold text-muted">Services</p>
          <h2 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-balance text-brand lg:text-6xl">
            Tout pour vendre. Rien de trop.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted">Ce qu’il faut pour vendre tes tickets WiFi, et rien d’autre.</p>
        </motion.div>

        <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-3">
          {/* Paiement — grande tuile */}
          <Tile
            icon={PhoneIcon}
            title="Encaisse en Mobile Money."
            text="Ton client paie avec l’opérateur qu’il utilise déjà. Chaque paiement est vérifié avant de livrer le ticket."
            className="lg:col-span-2"
          >
            <PaymentLogoList />
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-sm font-bold text-success">
              <CheckIcon className="size-4" />
              Paiement vérifié, ticket livré
            </p>
          </Tile>

          {/* Tickets */}
          <Tile
            icon={TicketIcon}
            title="Tes tickets MikroTik, rangés."
            text="Importe ton fichier. Chaque ticket rejoint son forfait."
            delay={0.08}
          >
            <ul className="divide-y divide-line border-y border-line text-sm">
              {PLANS.map(([d, p]) => (
                <li key={d} className="flex items-center gap-3 py-3">
                  <TagIcon className="size-5 text-accent" />
                  <span className="flex-1 text-ink">{d}</span>
                  <span className="font-bold text-ink">{p}</span>
                </li>
              ))}
            </ul>
          </Tile>

          {/* Portail */}
          <Tile
            icon={WifiIcon}
            title="Ton portail, à tes couleurs."
            text="Ta page de connexion WiFi, prête à installer sur ton routeur."
            dark
          >
            <ul className="flex flex-wrap gap-2 text-sm">
              {PORTAL_FILES.map((f) => (
                <li key={f} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-bold text-white/90">
                  {f}
                </li>
              ))}
            </ul>
          </Tile>

          {/* Stock — grande tuile */}
          <Tile
            icon={ChartIcon}
            title="Ton stock, en direct."
            text="Sache à tout moment ce qui reste, zone par zone."
            delay={0.08}
            className="lg:col-span-2"
          >
            <div className="flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
              {STOCK.map((s) => (
                <span key={s.label} className={`${s.color} rounded-full`} style={{ flexGrow: s.value, minWidth: '0.5rem' }} />
              ))}
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-4">
              {STOCK.map((s) => (
                <div key={s.label}>
                  <dt className="flex items-center gap-2 text-sm text-muted">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${s.color}`} />
                    {s.label}
                  </dt>
                  <dd className="mt-1 text-4xl font-bold tracking-tight text-ink lg:text-5xl">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="sr-only">Sur {STOCK_TOTAL} tickets.</p>
          </Tile>
        </div>
      </div>
    </section>
  );
}
