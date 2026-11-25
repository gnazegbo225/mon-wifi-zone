// Apparition au défilement commune à toute la page d'accueil : un fondu qui monte de 16 px,
// joué une seule fois, avec la même courbe que le hero.
import { EASE } from './hero/layout';

export const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.8, ease: EASE, delay },
});
