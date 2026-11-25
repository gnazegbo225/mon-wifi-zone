// Géométrie isométrique du visuel du hero (planche de 1000 × 1000 unités).
// Chaque plaque est un carré arrondi dans un plan, projeté avec la même matrice isométrique 2:1 :
// faces, joints et incrustations tombent donc toujours juste.

export const ORANGE = '#FF8A00';
export const BRAND = '#0F2A5C';

const ISO_X = 0.866;
const ISO_Y = 0.5;

export const CX = 500;
export const CY = 500;

// Aplatissement des orbites (hauteur / largeur d'un cercle isométrique) et leurs rayons horizontaux.
export const RING_FLATTEN = 0.57;
export const RING_RX = [400, 530];

// Empilement, de bas en haut. L'espace entre la base et la plaque du milieu est le joint lumineux.
export const BASE = { half: 168, radius: 40, top: 475, depth: 34 };
export const SEAM_GAP = 9;
export const MID = { half: 151, radius: 36, top: BASE.top - SEAM_GAP - 28, depth: 28 };
export const CAP = { half: 101, radius: 28, top: MID.top - 14, depth: 14 };

// Serveur et navigateur peuvent différer au dernier chiffre : on arrondit.
export const round = (n) => Math.round(n * 100) / 100;

export const project = (x, y, cx = CX, cy = CY) => [cx + (x - y) * ISO_X, cy + (x + y) * ISO_Y];

// Carré arrondi dans le plan, parcouru une fois.
const footprint = (half, radius, steps = 14) => {
  const r = Math.min(radius, half);
  const c = half - r;
  const corners = [
    [c, c, 0],
    [-c, c, 90],
    [-c, -c, 180],
    [c, -c, 270],
  ];
  const pts = [];
  for (const [ox, oy, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = ((start + (90 * i) / steps) * Math.PI) / 180;
      pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
    }
  }
  return pts;
};

const toPath = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;

export const topPath = (slab, inset = 0, cx = CX, dy = 0) => {
  const half = slab.half - inset;
  const radius = Math.max(slab.radius - inset, 1);
  return toPath(footprint(half, radius).map(([x, y]) => project(x, y, cx, slab.top + dy)));
};

// Une forme convexe extrudée verticalement = l'enveloppe convexe de ses contours haut et bas.
const hull = (points) => {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(pts), ...build([...pts].reverse())];
};

export const bodyPath = (slab, inset = 0) => {
  const half = slab.half - inset;
  const radius = Math.max(slab.radius - inset, 1);
  const outline = footprint(half, radius);
  const upper = outline.map(([x, y]) => project(x, y, CX, slab.top));
  const lower = outline.map(([x, y]) => project(x, y, CX, slab.top + slab.depth));
  return toPath(hull([...upper, ...lower]));
};

// Un point sur une des deux faces visibles. u court le long de la face, v dans son épaisseur.
export const facePoint = (slab, side, u, v) => {
  const { half, top, depth } = slab;
  if (side === 'left') {
    const [x, y] = project(-half + 2 * half * u, half, CX, top);
    return [x, y + depth * v];
  }
  const [x, y] = project(half, half - 2 * half * u, CX, top);
  return [x, y + depth * v];
};

// Matrices qui couchent un rectangle local sur une face latérale ou sur un plan du dessus.
export const FACE_MATRIX = {
  left: `${ISO_X} ${ISO_Y} 0 1`,
  right: `${ISO_X} ${-ISO_Y} 0 1`,
  top: `${ISO_X} ${ISO_Y} ${-ISO_X} ${ISO_Y}`,
};

export const ringPoint = (rx, angleDeg) => {
  const a = (angleDeg * Math.PI) / 180;
  return [round(CX + rx * Math.cos(a)), round(CY + rx * RING_FLATTEN * Math.sin(a))];
};

export const ringPath = (rx) => {
  const ry = rx * RING_FLATTEN;
  return `M${CX + rx} ${CY}A${rx} ${ry} 0 1 1 ${CX - rx} ${CY}A${rx} ${ry} 0 1 1 ${CX + rx} ${CY}Z`;
};
