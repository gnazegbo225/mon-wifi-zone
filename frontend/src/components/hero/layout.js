// Les réglages du visuel (en unités simples) et la disposition de la vue éclatée.
import { BASE, CAP, CX, MID } from './geometry';

// Même courbe que les fondus de la page d'accueil (Reveal), pour que tout bouge de la même façon.
export const EASE = [0.25, 0.1, 0.25, 1];

export const ARTBOARD = 1000;

export const MOTION = {
  // Flottement vertical de l'objet, en unités de la planche, et durée d'un aller.
  floatDistance: 10,
  floatSeconds: 6.5,
  // Inclinaison maximale vers le curseur, en degrés (garder sous ~4).
  tiltDegrees: 3.5,
  // Décalage des orbites et du décor par rapport à l'objet, en px : c'est ce qui donne la profondeur.
  ringParallax: 12,
  backdropParallax: 5,
  // Durée d'un tour de l'orbite intérieure (sens horaire) et extérieure (sens inverse).
  orbitSeconds: [70, 95],
  // Visibilité des orbites pendant que l'objet est ouvert.
  orbitOpenOpacity: 0.15,
};

// Les cinq étapes, de bas en haut : le WiFi du promoteur à la base, ses gains au sommet.
// La plaque du paiement est la plaque principale.
export const STAGES = [
  { title: 'Ton portail', text: 'Ta page WiFi', icon: 'wifi', side: 'right' },
  { title: 'Tes forfaits', text: 'Prix et tickets', icon: 'tag', side: 'left' },
  // Espaces insécables avant les « · » : une ligne ne commence jamais par un point.
  { title: 'Mobile Money', text: 'Wave · Orange · MTN · Moov', side: 'right', main: true },
  { title: 'Ton ticket', text: 'Livré tout de suite', icon: 'ticket', side: 'left' },
  { title: 'Tes gains', text: 'Solde et retraits', icon: 'coins', side: 'right' },
];

export const isMain = (stage) => Boolean(stage.main);

export const EXPLODE = {
  // Ressort de l'ouverture : moins raide = plus lent, plus amorti = moins de rebond.
  spring: { stiffness: 105, damping: 25, mass: 1 },
  // Écart entre deux plaques ouvertes, et surélévation de la plaque principale.
  gap: 94,
  mainLift: 12,
  // Hauteur de la plaque du haut une fois ouverte.
  topPlateY: 230,
  // Les plaques suivantes partent un peu après la plaque principale.
  stagger: 0.05,
  // Taille de chaque plaque ouverte (de bas en haut), choisie pour que tous les coins soient à la même
  // distance du centre : les traits vers les cartes ont la même longueur et laissent la place aux textes.
  scales: [0.56, 0.56, 0.63, 0.95, 0.95],
};

// Cartes des étapes, en % de la largeur du visuel. Le bord intérieur doit dégager les coins des plaques.
export const STAGE_CARDS = {
  // Pas de débord à gauche : sur tablette, le visuel occupe toute la largeur et la carte sortirait de l'écran.
  left: { edge: 0, width: 31 },
  right: { edge: 0, width: 31 },
  // Les cartes partent de quelques px vers l'objet et s'en écartent un peu en apparaissant.
  restInset: 10,
  outward: 2,
  // Durée du trajet d'une perle d'une carte à sa plaque.
  beadSeconds: 1.6,
};

// Les cinq plaques, découpées dans les trois blocs empilés : la base en donne deux, le milieu est la
// plaque principale, le dessus en donne deux. Empilées, elles redonnent exactement l'objet au repos.
export const PLATE_SLABS = [
  { ...BASE, top: BASE.top + 17, depth: 17 },
  { ...BASE, top: BASE.top, depth: 17 },
  MID,
  { ...CAP, top: CAP.top + 7, depth: 7 },
  { ...CAP, top: CAP.top, depth: 7 },
];

export const MAIN_PLATE = 2;

const TARGET_TOPS = PLATE_SLABS.map(
  (_, i) => EXPLODE.topPlateY + (PLATE_SLABS.length - 1 - i) * EXPLODE.gap - (i === MAIN_PLATE ? EXPLODE.mainLift : 0),
);

const TRAVEL = PLATE_SLABS.map((slab, i) => TARGET_TOPS[i] - slab.top);

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Avancement d'une plaque : 0 empilée, 1 ouverte. La plaque principale part la première.
export const plateProgress = (i, p) => {
  const delay = Math.abs(i - MAIN_PLATE) * EXPLODE.stagger;
  return clamp01((p - delay) / (1 - delay));
};

export const plateY = (i, p) => TRAVEL[i] * plateProgress(i, p);
export const plateScale = (i, p) => 1 + (EXPLODE.scales[i] - 1) * plateProgress(i, p);

// Abscisse de la pointe gauche ou droite d'une plaque ouverte (les coins arrondis la rentrent un peu).
const tipOffset = (i) => {
  const { half, radius } = PLATE_SLABS[i];
  return 0.866 * (2 * half - 0.586 * radius) * EXPLODE.scales[i];
};

export const tipX = (i, side) => CX + (side === 'right' ? 1 : -1) * tipOffset(i);

// Ordonnée des coins latéraux (à mi-épaisseur) d'une plaque ouverte.
export const cornerY = (i) => TARGET_TOPS[i] + PLATE_SLABS[i].depth / 2;
