// Le décor autour de l'objet : son ombre, les plans de verre et les points derrière, les lignes de
// construction, les deux orbites et leurs perles orange, et la grille isométrique au sol.
// Tout est très peu contrasté : l'œil ne le remarque qu'au second regard.
import { useEffect, useRef } from 'react';
import { BASE, CX, CY, RING_FLATTEN, RING_RX, ORANGE, ringPath, ringPoint, round, topPath } from './geometry';
import { MOTION } from './layout';

// Ombre de contact sous l'objet, posée au sol sous la base.
export function CoreShadow(props) {
  const floor = { ...BASE, top: BASE.top + BASE.depth + 30 };
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <defs>
        <filter id="mw-blur-lg" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter id="mw-blur-md" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <path d={topPath(floor, -14)} fill="#6C7890" opacity="0.2" filter="url(#mw-blur-lg)" />
      <path d={topPath(floor, 6)} fill="#3F4B61" opacity="0.22" filter="url(#mw-blur-md)" />
    </svg>
  );
}

const NODES = [
  [118, 132],
  [318, 82],
  [690, 96],
  [884, 188],
  [936, 470],
  [70, 512],
  [150, 858],
  [850, 846],
];

// Deux plans de verre debout derrière l'objet et quelques points isolés.
export function DepthBackdrop(props) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="mw-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <g fill="url(#mw-glass)" stroke="#DFE4EB" strokeWidth="1" opacity="0.35">
        <rect width="290" height="250" rx="22" transform="matrix(0.866 -0.5 0 1 232 300)" />
        <rect width="290" height="250" rx="22" transform="matrix(0.866 0.5 0 1 520 150)" />
      </g>
      <g fill="#fff" stroke="#C9D1DC" strokeWidth="1">
        {NODES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 3} opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}

// Semis de points déterministe : le même à chaque rendu.
const DOTS = Array.from({ length: 26 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  const r = 160 + ((i * 53) % 340);
  return [round(CX + r * Math.cos(a) * 1.02), round(CY + r * Math.sin(a) * RING_FLATTEN * 1.6), 0.8 + (i % 3) * 0.5];
});

const CROSSES = [
  [212, 292],
  [790, 690],
  [860, 430],
  [150, 560],
];

// Axes, points et petites croix de construction derrière l'objet.
export function TechnicalBackdrop(props) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="mw-axis-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C3CBD6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#C3CBD6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#C3CBD6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mw-axis-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C3CBD6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#C3CBD6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#C3CBD6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={CX - 0.5} y="110" width="1" height="780" fill="url(#mw-axis-v)" />
      <rect x="70" y={CY - 0.5} width="860" height="1" fill="url(#mw-axis-h)" />
      <g fill="#C3CBD6">
        {DOTS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={0.35 + (i % 4) * 0.12} />
        ))}
      </g>
      <g stroke="#C3CBD6" strokeWidth="1" opacity="0.5">
        {CROSSES.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} />
        ))}
      </g>
    </svg>
  );
}

// Les deux orbites autour de l'objet.
export function OrbitalSystem(props) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <g fill="none" stroke="#D3D9E2" strokeWidth="1">
        <ellipse cx={CX} cy={CY} rx={RING_RX[0]} ry={RING_RX[0] * RING_FLATTEN} opacity="0.8" />
        <ellipse cx={CX} cy={CY} rx={RING_RX[1]} ry={RING_RX[1] * RING_FLATTEN} opacity="0.65" />
      </g>
    </svg>
  );
}

// Perles régulièrement espacées : quatre sur l'orbite intérieure (sens horaire), cinq sur l'extérieure
// (sens inverse). Les perles d'une même orbite ont le même temps de tour, elles gardent leur écart.
const BEADS = [
  { ring: 0, angle: 20, size: 7 },
  { ring: 0, angle: 110, size: 5.5 },
  { ring: 0, angle: 200, size: 8 },
  { ring: 0, angle: 290, size: 6 },
  { ring: 1, angle: 60, size: 6 },
  { ring: 1, angle: 132, size: 8 },
  { ring: 1, angle: 204, size: 5.5 },
  { ring: 1, angle: 276, size: 7 },
  { ring: 1, angle: 348, size: 6.5 },
];

// Une petite sphère de verre orange : claire en haut à gauche, plus soutenue en bas à droite, un reflet net.
function Crystal({ size }) {
  return (
    <g filter="url(#mw-crystal-shadow)">
      <circle r={size * 1.55} fill="url(#mw-crystal-halo)" />
      <circle r={size} fill="url(#mw-crystal-body)" />
      <circle r={size} fill="url(#mw-crystal-refract)" />
      <circle r={size - 0.5} fill="none" stroke="url(#mw-crystal-rim)" strokeWidth="1" />
      <ellipse
        cx={-size * 0.32}
        cy={-size * 0.4}
        rx={size * 0.36}
        ry={size * 0.2}
        transform={`rotate(-30 ${-size * 0.32} ${-size * 0.4})`}
        fill="#FFFFFF"
        opacity="0.95"
      />
      <circle cx={size * 0.34} cy={-size * 0.5} r={Math.max(0.7, size * 0.07)} fill="#FFFFFF" opacity="0.85" />
    </g>
  );
}

// Les perles sont dessinées deux fois, derrière et devant l'objet, chacune coupée à sa moitié de la
// planche : une perle qui passe au fond de l'orbite glisse derrière l'objet. `paused` les fige sur place.
export function Particles({ half, animate, paused = false, ...props }) {
  const ref = useRef(null);
  const clipId = `mw-clip-${half}`;

  // Les perles tournent sur l'horloge d'animation de ce SVG : la mettre en pause les arrête toutes.
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [paused]);

  return (
    <svg ref={ref} viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <defs>
        <clipPath id={clipId}>
          {half === 'back' ? (
            <rect x="-200" y="-200" width="1400" height={CY + 200} />
          ) : (
            <rect x="-200" y={CY} width="1400" height="700" />
          )}
        </clipPath>
        <linearGradient id="mw-crystal-body" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#FFEBD1" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#FFB04D" stopOpacity="0.88" />
          <stop offset="1" stopColor="#EE7C00" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="mw-crystal-refract" cx="0.6" cy="0.78" r="0.45">
          <stop offset="0" stopColor="#FFF6EA" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFF6EA" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mw-crystal-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#C26500" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="mw-crystal-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.5" stopColor={ORANGE} stopOpacity="0.12" />
          <stop offset="1" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <filter id="mw-crystal-shadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#9A5200" floodOpacity="0.25" />
        </filter>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {BEADS.map((bead, i) => {
          const rx = RING_RX[bead.ring];
          const [x, y] = ringPoint(rx, bead.angle);
          const dur = MOTION.orbitSeconds[bead.ring];
          const reverse = bead.ring === 1;
          // Le tracé de l'orbite part de l'angle 0 dans le sens horaire ; un tour inversé part de l'autre bout.
          const start = bead.angle / 360;
          const begin = -dur * (reverse ? 1 - start : start);
          return (
            <g key={i} transform={animate ? undefined : `translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <Crystal size={bead.size} />
              {animate && (
                <animateMotion
                  dur={`${dur}s`}
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                  path={ringPath(rx)}
                  {...(reverse && { keyPoints: '1;0', keyTimes: '0;1', calcMode: 'linear' })}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Un losange du sol isométrique : les mêmes axes à 30° que l'objet.
const CELL = { w: 84, h: 48 };

export function FloorGrid({ id, stroke = '#CBD3DE', strokeWidth = 0.8, ...props }) {
  return (
    <svg aria-hidden="true" width="100%" height="100%" {...props}>
      <defs>
        <pattern id={id} width={CELL.w} height={CELL.h} patternUnits="userSpaceOnUse">
          <path
            d={`M0 ${CELL.h / 2}L${CELL.w / 2} 0L${CELL.w} ${CELL.h / 2}M0 ${CELL.h / 2}L${CELL.w / 2} ${CELL.h}L${CELL.w} ${CELL.h / 2}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
