// Le visuel du hero : l'objet flotte doucement, s'incline vers la souris, et s'ouvre en cinq étapes
// quand on le survole (souris) ou qu'on le touche (téléphone, clavier).
// Les perles s'arrêtent quand l'objet est ouvert, hors de l'écran ou dans un onglet caché.
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CoreShadow, DepthBackdrop, OrbitalSystem, Particles, TechnicalBackdrop } from './Backdrops';
import { ExplodedCore, RestingCore } from './CoreParts';
import { EXPLODE, MOTION } from './layout';
import { StageCards, StageConnectors, StageList } from './Stages';

const subscribeToVisibility = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isPageVisible = () => !document.hidden;

const FILL = 'absolute inset-0 size-full overflow-visible';

// Chaque couche glisse d'une quantité différente selon le pointeur : c'est ce qui se lit comme de la profondeur.
function ParallaxLayer({ x, y, reach, children }) {
  const tx = useTransform(x, (v) => v * reach);
  const ty = useTransform(y, (v) => v * reach);
  return (
    <motion.div style={{ x: tx, y: ty }} className="pointer-events-none absolute inset-0">
      {children}
    </motion.div>
  );
}

// L'inclinaison vers le curseur et le flottement lent, partagés par tout ce qui bouge avec l'objet.
function Tilted({ rotateX, rotateY, children }) {
  return (
    <div className="pointer-events-none absolute inset-0 [perspective:1400px]">
      <motion.div style={{ rotateX, rotateY }} className="absolute inset-0">
        <div className="mw-float absolute inset-0">{children}</div>
      </motion.div>
    </div>
  );
}

function CursorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3.5 19 10l-6.2 1.8L10.5 18z" />
    </svg>
  );
}

export default function CoreVisual() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const pointerType = useRef('mouse');
  const visualRef = useRef(null);
  const reduce = useReducedMotion() ?? false;

  // La marge couvre l'orbite extérieure, qui déborde un peu du visuel.
  const onScreen = useInView(visualRef, { initial: true, margin: '40px' });
  const pageVisible = useSyncExternalStore(subscribeToVisibility, isPageVisible, () => true);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 55, damping: 18, mass: 0.9 });
  const y = useSpring(py, { stiffness: 55, damping: 18, mass: 0.9 });
  const rotateY = useTransform(x, (v) => v * MOTION.tiltDegrees);

  // 0 = empilé, 1 = ouvert. Un seul ressort mène les plaques, les traits, les cartes et l'ombre.
  const target = useMotionValue(0);
  const progress = useSpring(target, reduce ? { duration: 0.01 } : EXPLODE.spring);

  // Ouvert, l'objet se penche aussi un peu en arrière : c'est ce qui donne la profondeur en plus.
  const rotateX = useTransform([y, progress], ([v, p]) => v * -MOTION.tiltDegrees + p * 4);
  const restOpacity = useTransform(progress, [0, 0.04], [1, 0]);
  const explodedOpacity = useTransform(progress, [0, 0.03], [0, 1]);
  const shadowOpacity = useTransform(progress, [0, 1], [1, 0.55]);
  const orbitOpacity = useTransform(progress, [0, 0.6], [1, MOTION.orbitOpenOpacity]);
  const hintOpacity = useTransform(progress, [0, 0.25], [1, 0]);

  const beadsPaused = open || !onScreen || !pageVisible;

  useEffect(() => {
    target.set(open ? 1 : 0);
  }, [open, target]);

  const handlePointerMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - box.left) / box.width - 0.5) * 2);
    py.set(((e.clientY - box.top) / box.height - 0.5) * 2);
  };

  const handlePointerLeave = () => {
    px.set(0);
    py.set(0);
    setOpen(false);
  };

  // Survoler une carte allume son trait et ouvre l'objet, comme survoler l'objet lui-même.
  const handleCardHover = (index) => {
    setHovered(index);
    if (index !== null && !reduce) setOpen(true);
  };

  // La souris ouvre au survol. Le toucher et le clavier n'ont pas de survol : ils ouvrent et ferment au clic.
  const handleCoreClick = (e) => {
    if (e.detail === 0 || pointerType.current !== 'mouse') setOpen((v) => !v);
  };

  return (
    <>
      <div
        ref={visualRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="mw-enter @container relative -my-[6%] -ml-[12.5%] aspect-square w-[125%] max-w-none md:mx-auto md:my-0 md:w-full md:max-w-[840px] lg:mx-0 lg:w-[104%] lg:max-w-none"
      >
        <div className="absolute inset-0">
          <div aria-hidden="true" className="mw-halo pointer-events-none absolute inset-[6%]" />

          <div className="mw-fade-edge absolute inset-0">
            <ParallaxLayer x={x} y={y} reach={-MOTION.backdropParallax}>
              <DepthBackdrop className={FILL} />
              <TechnicalBackdrop className={FILL} />
            </ParallaxLayer>
          </div>

          {/* Les orbites restent hors du calque estompé : l'orbite extérieure déborde du visuel. */}
          <ParallaxLayer x={x} y={y} reach={MOTION.ringParallax}>
            <motion.div style={{ opacity: orbitOpacity }} className="absolute inset-0">
              <OrbitalSystem className={FILL} />
              <Particles half="back" animate={!reduce} paused={beadsPaused} className={FILL} />
            </motion.div>
          </ParallaxLayer>

          <motion.div style={{ opacity: shadowOpacity }} className="absolute inset-0">
            <CoreShadow className={`pointer-events-none ${FILL}`} />
          </motion.div>

          <Tilted rotateX={rotateX} rotateY={rotateY}>
            <motion.div style={{ opacity: restOpacity }} className="absolute inset-0">
              <RestingCore className={FILL} />
            </motion.div>
            <motion.div style={{ opacity: explodedOpacity }} className="absolute inset-0">
              <ExplodedCore progress={progress} className={FILL} />
            </motion.div>
            <StageConnectors progress={progress} active={open && !reduce} hovered={hovered} />
          </Tilted>

          <ParallaxLayer x={x} y={y} reach={MOTION.ringParallax}>
            <motion.div style={{ opacity: orbitOpacity }} className="absolute inset-0">
              <Particles half="front" animate={!reduce} paused={beadsPaused} className={FILL} />
            </motion.div>
          </ParallaxLayer>

          {/* Les cartes suivent la même inclinaison, dans un calque au-dessus de l'orbite avant. */}
          <Tilted rotateX={rotateX} rotateY={rotateY}>
            <StageCards progress={progress} open={open} hovered={hovered} onHover={handleCardHover} />
          </Tilted>
        </div>

        {/* Petite invitation sous l'objet. Sans survol possible (écran tactile), on dit de toucher. */}
        <motion.p
          aria-hidden="true"
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute top-[84%] left-1/2 m-0 flex -translate-x-1/2 items-center gap-1.5 text-sm whitespace-nowrap text-muted"
        >
          <CursorIcon />
          <span className="[@media(hover:none)]:hidden">Survole pour voir comment ça marche</span>
          <span className="hidden [@media(hover:none)]:inline">Touche pour voir comment ça marche</span>
        </motion.p>

        <button
          type="button"
          aria-expanded={open}
          aria-label="Ouvrir le schéma : comment monwifizone marche, étape par étape"
          onPointerDown={(e) => {
            pointerType.current = e.pointerType;
          }}
          onPointerEnter={(e) => e.pointerType === 'mouse' && !reduce && setOpen(true)}
          onClick={handleCoreClick}
          onBlur={() => setOpen(false)}
          className="absolute top-[30%] left-[22%] h-[44%] w-[56%] cursor-default rounded-[3rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        />
      </div>
      <StageList reduce={reduce} />
    </>
  );
}
