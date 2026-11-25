// L'objet du hero : trois plaques en céramique claire empilées, un joint orange lumineux entre la base
// et le milieu, et sur le dessus le ticket bleu nuit avec les ondes WiFi en relief (le logo).
// Lumière venant du haut à gauche. La vue éclatée découpe le même objet en cinq plaques, une par étape.
import { motion, useTransform } from 'framer-motion';
import { BASE, BRAND, CAP, CX, FACE_MATRIX, MID, ORANGE, SEAM_GAP, bodyPath, facePoint, project, topPath } from './geometry';
import { MAIN_PLATE, PLATE_SLABS, clamp01, plateProgress, plateScale, plateY } from './layout';

const SEAM = { half: MID.half - 2, radius: MID.radius - 2, top: MID.top + MID.depth - 1, depth: SEAM_GAP + 1 };

function FaceMark({ slab, side, u, v, w, h, fill, glow = false }) {
  const [x, y] = facePoint(slab, side, u, v);
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) matrix(${FACE_MATRIX[side]} 0 0)`}>
      {glow && (
        <rect x={-w / 2 - 2} y={-h / 2 - 3} width={w + 4} height={h + 6} rx={h} fill={fill} filter="url(#mw-blur-sm)" opacity="0.75" />
      )}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} />
    </g>
  );
}

// Fine ligne de panneau le long d'une face.
function PanelLine({ slab, side, v, from = 0.14, to = 0.86 }) {
  const [x1, y1] = facePoint(slab, side, from, v);
  const [x2, y2] = facePoint(slab, side, to, v);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#A3ADBD" strokeWidth="0.9" opacity="0.55" />;
}

// Vis ronde encastrée dans un dessus, couchée dans le plan.
function Fastener({ slab, x, y }) {
  const [px, py] = project(x, y, CX, slab.top);
  return (
    <g transform={`translate(${px.toFixed(2)} ${py.toFixed(2)}) matrix(${FACE_MATRIX.top} 0 0)`}>
      <circle r="6.5" fill="url(#mw-hole)" stroke="#C5CDD8" strokeWidth="1" />
    </g>
  );
}

function SlabBody({ slab }) {
  const d = bodyPath(slab);
  return (
    <g>
      <path d={d} fill="url(#mw-side)" />
      <path d={d} fill="url(#mw-side-shade)" />
      <path d={d} fill="none" stroke="#CDD4DE" strokeWidth="1" opacity="0.85" />
    </g>
  );
}

function SlabTop({ slab, groove }) {
  return (
    <g>
      <path d={topPath(slab)} fill="url(#mw-bevel)" stroke="#D7DDE6" strokeWidth="1" />
      <path d={topPath(slab, 4.5)} fill="url(#mw-top)" stroke="#fff" strokeWidth="1" />
      {groove !== undefined && <path d={topPath(slab, groove)} fill="none" stroke="#D8DEE7" strokeWidth="1.2" />}
    </g>
  );
}

// Incrustation du dessus : bleu nuit comme le ticket du logo sur la plaque du sommet, claire ailleurs.
function Inlay({ slab, brand = false }) {
  return (
    <>
      <path
        d={topPath(slab, 19)}
        fill={brand ? 'url(#mw-inlay-brand)' : 'url(#mw-inlay)'}
        stroke={brand ? '#0A1E44' : '#DAE0E8'}
        strokeWidth="1.2"
      />
      <path d={topPath(slab, 20.5)} fill="none" stroke="#fff" strokeWidth="1" opacity={brand ? 0.22 : 0.9} />
    </>
  );
}

// Les ondes WiFi du logo (brand/logo-v2.svg), recentrées sur 0.
const ARCS = ['M-9.9 0.6a14 14 0 0 1 19.8 0', 'M-18.4 -7.9a26 26 0 0 1 36.8 0'];

function WifiShape({ color }) {
  return (
    <>
      <g fill="none" stroke={color} strokeWidth="6" strokeLinecap="round">
        {ARCS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx="0" cy="10.5" r="5" fill={color} />
    </>
  );
}

// Côtés de l'extrusion des ondes, de la couche du bas (plus sombre) vers le haut.
const MARK_SIDES = ['#9C5200', '#B05D00', '#C26700', '#D37200', '#E07A00', '#EB8100'];
const MARK_SCALE = 1.7;

// Les ondes en petit objet posé sur le ticket : extrusion en marches, dessus éclairé, ombre de contact.
// rotate(-45) : le haut des ondes pointe vers le fond de la scène.
function CoreMark({ x, y }) {
  const plane = (lift) => `translate(${x} ${y - lift}) matrix(${FACE_MATRIX.top} 0 0) rotate(-45) scale(${MARK_SCALE})`;
  return (
    <g>
      <g transform={`${plane(0)} translate(2.4 2.4)`} opacity="0.35" filter="url(#mw-blur-sm)">
        <WifiShape color="#04112A" />
      </g>
      {MARK_SIDES.map((fill, k) => (
        <g key={fill} transform={plane(k)}>
          <WifiShape color={fill} />
        </g>
      ))}
      <g transform={plane(MARK_SIDES.length)}>
        <WifiShape color="url(#mw-mark-top)" />
      </g>
    </g>
  );
}

function CoreDefs() {
  return (
    <defs>
      <linearGradient id="mw-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#F4F6FA" />
        <stop offset="0.46" stopColor="#E8ECF2" />
        <stop offset="0.5" stopColor="#D8DEE7" />
        <stop offset="1" stopColor="#E1E6ED" />
      </linearGradient>
      <linearGradient id="mw-side-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.45" stopColor="#5B6A85" stopOpacity="0" />
        <stop offset="1" stopColor="#5B6A85" stopOpacity="0.16" />
      </linearGradient>
      <linearGradient id="mw-bevel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#E2E7EE" />
      </linearGradient>
      <linearGradient id="mw-top" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#F0F3F7" />
      </linearGradient>
      <linearGradient id="mw-inlay" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#EBEFF4" />
        <stop offset="1" stopColor="#FFFFFF" />
      </linearGradient>
      <linearGradient id="mw-inlay-brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1D468C" />
        <stop offset="1" stopColor={BRAND} />
      </linearGradient>
      <linearGradient id="mw-seam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFD199" />
        <stop offset="0.5" stopColor={ORANGE} />
        <stop offset="1" stopColor="#FFAD4D" />
      </linearGradient>
      <linearGradient id="mw-slot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#46536B" />
        <stop offset="1" stopColor="#7C889D" />
      </linearGradient>
      <linearGradient id="mw-mark-top" gradientUnits="userSpaceOnUse" x1="-20" y1="-14" x2="20" y2="16">
        <stop offset="0" stopColor="#FFC673" />
        <stop offset="0.55" stopColor="#FF9A1F" />
        <stop offset="1" stopColor={ORANGE} />
      </linearGradient>
      <radialGradient id="mw-hole" cx="0.5" cy="0.4" r="0.7">
        <stop offset="0" stopColor="#D3DAE3" />
        <stop offset="1" stopColor="#F2F5F8" />
      </radialGradient>
      <filter id="mw-blur-sm" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <filter id="mw-blur-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <filter id="mw-blur-spill" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
    </defs>
  );
}

// Fentes d'aération de la base.
function BaseSlots() {
  return (
    <>
      {[0.5, 0.58, 0.66].map((u) => (
        <FaceMark key={`r${u}`} slab={BASE} side="right" u={u} v={0.62} w={4.5} h={4.5} fill="url(#mw-slot)" />
      ))}
      {[0.32, 0.4].map((u) => (
        <FaceMark key={`l${u}`} slab={BASE} side="left" u={u} v={0.62} w={4.5} h={4.5} fill="url(#mw-slot)" />
      ))}
    </>
  );
}

function BasePanels() {
  return (
    <>
      <PanelLine slab={BASE} side="left" v={0.3} />
      <PanelLine slab={BASE} side="right" v={0.3} />
    </>
  );
}

// La lumière du joint déborde sur la base et le long de son bord.
function SeamGlow() {
  return (
    <>
      <g className="mw-seam-pulse">
        <path d={topPath(MID, 4, CX, BASE.top - MID.top)} fill={ORANGE} opacity="0.24" filter="url(#mw-blur-spill)" />
        <path d={bodyPath(SEAM)} fill={ORANGE} opacity="0.6" filter="url(#mw-blur-glow)" />
      </g>
      <path d={bodyPath(SEAM)} fill="url(#mw-seam)" />
    </>
  );
}

// La plaque du milieu et ses détails (fentes, voyant orange, vis).
function MidPlate() {
  return (
    <>
      <SlabBody slab={MID} />
      <SlabTop slab={MID} groove={11} />
      <PanelLine slab={MID} side="left" v={0.78} />
      <PanelLine slab={MID} side="right" v={0.78} />
      <FaceMark slab={MID} side="left" u={0.62} v={0.42} w={34} h={7.5} fill="url(#mw-slot)" />
      <FaceMark slab={MID} side="left" u={0.34} v={0.42} w={5} h={5} fill="url(#mw-slot)" />
      <FaceMark slab={MID} side="left" u={0.42} v={0.42} w={5} h={5} fill="url(#mw-slot)" />
      <FaceMark slab={MID} side="right" u={0.44} v={0.42} w={5} h={5} fill="url(#mw-slot)" />
      <FaceMark slab={MID} side="right" u={0.52} v={0.42} w={5} h={5} fill="url(#mw-slot)" />
      <FaceMark slab={MID} side="right" u={0.68} v={0.42} w={22} h={4.5} fill="url(#mw-slot)" />
      <g className="mw-seam-pulse">
        <FaceMark slab={MID} side="left" u={0.2} v={0.42} w={7} h={2.6} fill={ORANGE} glow />
      </g>
      <Fastener slab={MID} x={0} y={-MID.half + 28} />
      <Fastener slab={MID} x={-MID.half + 28} y={0} />
      <Fastener slab={MID} x={MID.half - 28} y={0} />
      <Fastener slab={MID} x={0} y={MID.half - 28} />
    </>
  );
}

// L'objet au repos.
export function RestingCore(props) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <CoreDefs />
      <SlabBody slab={BASE} />
      <SlabTop slab={BASE} groove={10} />
      <BasePanels />
      <BaseSlots />
      <SeamGlow />
      <MidPlate />
      <SlabBody slab={CAP} />
      <SlabTop slab={CAP} />
      <Inlay slab={CAP} brand />
      <CoreMark x={CX} y={CAP.top} />
    </svg>
  );
}

// Épaisseur ajoutée à chaque plaque une fois ouverte (les fines plaques du dessus en gagnent le plus).
const SKIRT = [0, 4, 0, 10, 10];

function Plate({ index, progress, children }) {
  const y = useTransform(progress, (v) => plateY(index, v));
  const scale = useTransform(progress, (v) => plateScale(index, v));
  const apart = useTransform(progress, (v) => plateProgress(index, v));
  const shadow = useTransform(apart, (v) => v * 0.16);
  const slab = PLATE_SLABS[index];
  const skirt = SKIRT[index];

  return (
    <motion.g style={{ y, scale }}>
      {/* L'ombre douce que la plaque pose sur celle du dessous en s'écartant. */}
      {index > 0 && (
        <motion.path d={topPath(slab, -6, CX, slab.depth + 34)} fill="#4A5873" filter="url(#mw-blur-spill)" style={{ opacity: shadow }} />
      )}
      {skirt > 0 && (
        <motion.g style={{ opacity: apart }}>
          <SlabBody slab={{ ...slab, top: slab.top + slab.depth - 1, depth: skirt + 1 }} />
        </motion.g>
      )}
      {children}
    </motion.g>
  );
}

// Numéro de l'étape gravé dans le dessus de la plaque, près du coin avant.
function PlateNumber({ slab, n, main = false }) {
  const k = slab.half * 0.56;
  const [x, y] = project(k, k, CX, slab.top);
  const plane = `matrix(${FACE_MATRIX.top} 0 0) rotate(-45)`;
  const text = { textAnchor: 'middle', dominantBaseline: 'central', fontSize: 25, fontWeight: 700, letterSpacing: 2.5 };
  const label = String(n).padStart(2, '0');
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} aria-hidden="true">
      <text {...text} transform={`translate(0 0.9) ${plane}`} fill="#FFFFFF" opacity="0.95">
        {label}
      </text>
      <text {...text} transform={plane} fill={main ? ORANGE : '#C3CBD6'}>
        {label}
      </text>
    </g>
  );
}

// Un anneau orange s'allume sur la plaque principale quand l'objet s'ouvre.
function MainEmphasis({ progress }) {
  const on = useTransform(progress, (v) => clamp01((v - 0.5) / 0.4));
  const rim = useTransform(on, (v) => v * 0.9);
  const halo = useTransform(on, (v) => v * 0.55);
  const spill = useTransform(halo, (v) => v * 0.35);
  return (
    <g transform={`translate(${CX} ${MID.top}) matrix(${FACE_MATRIX.top} 0 0)`}>
      <motion.circle r="86" fill={ORANGE} filter="url(#mw-blur-spill)" style={{ opacity: spill }} />
      <motion.circle r="56" fill="none" stroke={ORANGE} strokeWidth="1.4" style={{ opacity: rim }} />
      <motion.circle r="38" fill="none" stroke={ORANGE} strokeWidth="1" strokeDasharray="3 6" style={{ opacity: halo }} />
      <motion.circle r="9" fill={ORANGE} style={{ opacity: rim }} />
    </g>
  );
}

// L'objet ouvert en cinq plaques, piloté par `progress` (0 empilé, 1 ouvert).
export function ExplodedCore({ progress, ...props }) {
  const strongGlow = useTransform(progress, (v) => clamp01((v - 0.4) / 0.5) * 0.6);
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <CoreDefs />

      <Plate index={0} progress={progress}>
        <SlabBody slab={PLATE_SLABS[0]} />
        <SlabTop slab={PLATE_SLABS[0]} groove={10} />
        <PlateNumber slab={PLATE_SLABS[0]} n={1} />
        <BaseSlots />
      </Plate>

      <Plate index={1} progress={progress}>
        <SlabBody slab={PLATE_SLABS[1]} />
        <SlabTop slab={PLATE_SLABS[1]} groove={10} />
        <PlateNumber slab={PLATE_SLABS[1]} n={2} />
        <BasePanels />
      </Plate>

      <Plate index={MAIN_PLATE} progress={progress}>
        <motion.path d={bodyPath(SEAM)} fill={ORANGE} filter="url(#mw-blur-glow)" style={{ opacity: strongGlow }} />
        <SeamGlow />
        <MidPlate />
        <PlateNumber slab={MID} n={3} main />
        <MainEmphasis progress={progress} />
      </Plate>

      <Plate index={3} progress={progress}>
        <SlabBody slab={PLATE_SLABS[3]} />
        <SlabTop slab={PLATE_SLABS[3]} />
        <Inlay slab={PLATE_SLABS[3]} />
        <PlateNumber slab={PLATE_SLABS[3]} n={4} />
      </Plate>

      <Plate index={4} progress={progress}>
        <SlabBody slab={PLATE_SLABS[4]} />
        <SlabTop slab={PLATE_SLABS[4]} />
        <Inlay slab={CAP} brand />
        <CoreMark x={CX} y={CAP.top} />
      </Plate>
    </svg>
  );
}
