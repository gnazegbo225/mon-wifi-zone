// Section « À propos » de la page d'accueil : l'histoire en quelques lignes à gauche, les trois engagements
// à droite. Même langage que « Services » et « Fonctionnement » : cartes blanches bordées, pastille d'icône
// bleue, orange réservé aux formes.
import { motion } from 'framer-motion';
import { CheckIcon, MapPinIcon, PhoneIcon } from './icons';
import { reveal } from './reveal';

const VALUES = [
  { icon: PhoneIcon, title: 'Simple', text: 'Pensé pour le téléphone. Rien à apprendre.' },
  { icon: CheckIcon, title: 'Fiable', text: 'Chaque paiement est vérifié avant de livrer un ticket.' },
  { icon: MapPinIcon, title: 'D’ici', text: 'Conçu en Côte d’Ivoire, pour le Mobile Money d’ici.' },
];

export default function AboutSection() {
  return (
    <section id="a-propos" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16 lg:px-10 lg:py-24">
        <div>
          <motion.div {...reveal()}>
            <p className="text-sm font-bold text-muted">À propos</p>
            <h2 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-balance text-brand lg:text-6xl">
              Internet, accessible à chacun.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              monwifizone est né en Côte d’Ivoire. Une idée simple : un gérant doit pouvoir vendre ses tickets sans être
              sur place, et chaque client doit se connecter en quelques secondes, avec le Mobile Money qu’il utilise déjà.
            </p>
          </motion.div>
        </div>

        <ul className="grid gap-4">
          {VALUES.map(({ icon: Icon, title, text }, i) => (
            <motion.li
              key={title}
              {...reveal(0.08 * i)}
              className="flex items-start gap-5 rounded-[28px] border border-line bg-white p-6 sm:p-8"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon className="size-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-brand">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
