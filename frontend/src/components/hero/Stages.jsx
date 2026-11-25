// Les cinq étapes de la vue éclatée : une carte à côté de chaque plaque (tablette et plus), reliée à son
// coin par un trait fin où court une perle ; sur téléphone, les cartes passent sous le visuel en grille.
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { CoinsIcon, TagIcon, TicketIcon, WifiIcon } from '../icons';
import { ORANGE } from './geometry';
import { ARTBOARD, EASE, STAGES, STAGE_CARDS, cornerY, isMain, tipX } from './layout';

const STAGE_ICONS = { wifi: WifiIcon, tag: TagIcon, ticket: TicketIcon, coins: CoinsIcon };

// Numéro et icône centrés chacun dans une case d'une ligne de haut, alignés sur leur texte.
// Tout est en em : la carte suit sa taille de police.
function StageCardBody({ index }) {
  const stage = STAGES[index];
  const main = isMain(stage);
  const Icon = stage.icon ? STAGE_ICONS[stage.icon] : null;

  return (
    <div className="grid grid-cols-[1.5em_minmax(0,1fr)] items-start gap-x-[0.5em]">
      <span className={`flex h-[1.35em] items-center tabular-nums ${main ? 'font-bold text-brand' : 'text-muted'}`}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <p className="text-[1.05em] leading-[1.3] font-bold tracking-[-0.01em] text-brand">{stage.title}</p>

      <span className="mt-[0.35em] flex h-[1.4em] items-center">
        {Icon ? (
          <Icon className="size-[1.2em] text-accent" />
        ) : (
          <span aria-hidden="true" className="mw-dot ml-[0.3em] size-[0.5em] rounded-full bg-accent" />
        )}
      </span>
      <p className="mt-[0.35em] leading-[1.4] text-muted">{stage.text}</p>
    </div>
  );
}

const pct = (n) => `${(n / ARTBOARD) * 100}%`;

// Les cartes de gauche s'écartent vers la gauche, celles de droite vers la droite.
const cardDirection = (index) => (STAGES[index].side === 'left' ? -1 : 1);

function StageCard({ index, progress, open, lit, onHover }) {
  const opacity = useTransform(progress, [0.35, 0.9], [0, 1]);
  const x = useTransform(
    progress,
    [0, 1],
    [-cardDirection(index) * STAGE_CARDS.restInset, cardDirection(index) * STAGE_CARDS.outward],
  );
  const stage = STAGES[index];
  const { edge, width } = STAGE_CARDS[stage.side];
  const left = stage.side === 'left' ? edge : 100 - edge - width;

  return (
    <li style={{ top: pct(cornerY(index)), left: `${left}%`, width: `${width}%` }} className="absolute -translate-y-1/2">
      <motion.div
        style={{ opacity, x }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(index)}
        onPointerLeave={() => onHover(null)}
        className={`mw-stage-card px-[0.9em] py-[0.8em] ${open ? 'pointer-events-auto' : ''} ${isMain(stage) ? 'mw-stage-card-main' : ''} ${
          lit ? 'mw-stage-card-lit' : ''
        }`}
      >
        <StageCardBody index={index} />
      </motion.div>
    </li>
  );
}

// Cartes flottantes à côté de leurs plaques, à partir de la tablette. La police suit la largeur du
// visuel (cqw) sans descendre sous 14 px.
export function StageCards({ progress, open, hovered, onHover }) {
  return (
    <ul
      aria-label="Comment ça marche"
      aria-hidden={!open}
      className="pointer-events-none absolute inset-0 m-0 hidden list-none p-0 text-[clamp(14px,1.9cqw,16px)] md:block"
    >
      {STAGES.map((stage, i) => (
        <StageCard key={stage.title} index={i} progress={progress} open={open} lit={hovered === i} onHover={onHover} />
      ))}
    </ul>
  );
}

// Où le trait touche le coin de la plaque et le point de la carte, en unités de la planche.
const lineEnds = (plate, card, side) => {
  const dir = side === 'right' ? 1 : -1;
  return { plateX: plate + dir * 7, nodeX: card - dir * 10 };
};

// Carte → point orange → trait fin → coin de sa plaque. Une perle parcourt le trait tant que c'est ouvert.
function StageConnector({ plate, card, y, side, index, main, lit, active, progress }) {
  const show = useTransform(progress, [0.55, 0.9], [0, 1]);
  const t = useMotionValue(0);
  const { plateX, nodeX } = lineEnds(plate, card, side);
  const beadX = useTransform(t, (k) => nodeX + (plateX - nodeX) * k);
  const beadOpacity = useTransform([t, show], ([k, s]) => s * Math.sin(Math.PI * k));

  useEffect(() => {
    if (!active) return;
    const controls = animate(t, [0, 1], {
      duration: STAGE_CARDS.beadSeconds,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 1.4,
      delay: 0.5 + index * 0.25,
    });
    return () => {
      controls.stop();
      t.set(0);
    };
  }, [active, index, t]);

  return (
    <motion.svg
      aria-hidden="true"
      viewBox={`0 0 ${ARTBOARD} ${ARTBOARD}`}
      style={{ opacity: show }}
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <line x1={plateX} x2={nodeX} y1={y} y2={y} stroke="#C9D1DC" strokeWidth="1" />
      <motion.line
        x1={plateX}
        x2={nodeX}
        y1={y}
        y2={y}
        stroke={ORANGE}
        strokeWidth="1.2"
        initial={false}
        animate={{ opacity: lit ? 0.9 : 0 }}
        transition={{ duration: 0.25 }}
      />
      <circle cx={plateX} cy={y} r="2.6" fill="#A3ADBD" />
      <motion.circle
        cx={nodeX}
        cy={y}
        r={main ? 10 : 8}
        fill={ORANGE}
        initial={false}
        animate={{ opacity: lit || main ? 0.22 : 0.12 }}
        transition={{ duration: 0.25 }}
      />
      <circle cx={nodeX} cy={y} r="3.6" fill={ORANGE} />
      <motion.circle cx={beadX} cy={y} r="2.6" fill={ORANGE} style={{ opacity: beadOpacity }} />
    </motion.svg>
  );
}

export function StageConnectors({ progress, active, hovered }) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      {STAGES.map((stage, i) => {
        const { edge, width } = STAGE_CARDS[stage.side];
        const cardEdge = stage.side === 'left' ? (edge + width) * 10 : (100 - edge - width) * 10;
        return (
          <StageConnector
            key={stage.title}
            plate={tipX(i, stage.side)}
            card={cardEdge}
            y={cornerY(i)}
            side={stage.side}
            index={i}
            main={isMain(stage)}
            lit={hovered === i}
            active={active}
            progress={progress}
          />
        );
      })}
    </div>
  );
}

// Sur téléphone, le visuel est trop étroit pour des cartes à côté : elles passent dessous, en grille.
export function StageList({ reduce }) {
  return (
    <motion.ul
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
      aria-label="Comment ça marche"
      className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 text-[14px] sm:grid-cols-2 md:hidden"
    >
      {STAGES.map((stage, i) => (
        <li key={stage.title} className={`mw-stage-card px-[1.05em] py-[0.95em] ${isMain(stage) ? 'mw-stage-card-main' : ''}`}>
          <StageCardBody index={i} />
        </li>
      ))}
    </motion.ul>
  );
}
