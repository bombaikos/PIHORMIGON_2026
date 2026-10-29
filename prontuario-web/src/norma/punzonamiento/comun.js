// Geometría común del punzonamiento (los seis tipos de pilar): perímetros a una distancia δ de la cara del pilar,
// perímetro de la cara u0 y su inverso (δ a partir de un perímetro). Unidades: mm.
//
// Convenio de dibujo y de datos: el pilar rectangular tiene c1 paralelo al borde libre y c2 perpendicular a él
// (hacia el interior de la losa). El pilar va a ras del borde (borde) o de los dos bordes (esquina); el circular
// es tangente a ellos. El perímetro es siempre el geométrico mínimo (línea envolvente a δ de la cara, cortada por
// el borde): EHE-08 46.2 y fig. 46.2; EC-2 2004 6.4.2(1) y fig. 6.13/6.15; EC-2 2023 8.4.2(2) y fig. 8.18.
// En el pilar circular de borde y esquina NO se aplica el sumando D del Prontuario 3.1 (José Luis, 19/10/2026).

import { ErrorClave } from '../../core/errores.js';

export const TIPOS = ['rect', 'circ'];
export const POSICIONES = ['interior', 'borde', 'esquina'];
/** β simplificado con momento transferido (EHE-08 46.3; EC-2 2004 fig. 6.21N; EC-2 2023 tabla 8.3). */
export const BETA_APROX = { interior: 1.15, borde: 1.4, esquina: 1.5 };

/** Comprueba los datos geométricos del pilar. */
export function validarPilar(x) {
  if (!TIPOS.includes(x.tipo) || !POSICIONES.includes(x.pos)) throw new ErrorClave('pun.errTipo');
  if (x.tipo === 'rect') {
    if (!(x.c1 > 0) || !(x.c2 > 0)) throw new ErrorClave('pun.errPilar');
  } else if (!(x.D > 0)) throw new ErrorClave('pun.errPilar');
  if (!(x.d > 0)) throw new ErrorClave('pun.errD');
}

/** β = asin(a/R) del arco del pilar circular tangente a un borde (a = D/2, R = D/2 + δ). */
const beta = (a, R) => Math.asin(Math.min(1, a / R));

/**
 * Longitud del contorno a la distancia δ de la cara del pilar. `tope3d` (mm, EC-2 2023 8.4.2(3)) limita cada
 * tramo recto; con 0 o sin él, no se limita.
 */
export function perimetro(x, delta, tope3d = 0) {
  validarPilar(x);
  const lim = (v) => (tope3d > 0 ? Math.min(v, tope3d) : v);
  if (x.tipo === 'rect') {
    const a = lim(x.c1);
    const b = lim(x.c2);
    if (x.pos === 'interior') return 2 * (a + b) + 2 * Math.PI * delta;
    if (x.pos === 'borde') return a + 2 * b + Math.PI * delta;
    return a + b + (Math.PI * delta) / 2;
  }
  const a = x.D / 2;
  const R = a + delta;
  if (x.pos === 'interior') return 2 * Math.PI * R;
  if (x.pos === 'borde') return R * (Math.PI + 2 * beta(a, R));
  // Esquina: pilar tangente a dos bordes, centro a (a, a) de la esquina
  if (R > a * Math.SQRT2) return R * (Math.PI / 2 + 2 * beta(a, R));
  return arcoEsquinaNumerico(a, R);
}

/** Arco de circunferencia (centro a, a; radio R) dentro del cuadrante x, y ≥ 0, por muestreo (caso degenerado R ≤ a√2). */
function arcoEsquinaNumerico(a, R) {
  const N = 20000;
  let n = 0;
  for (let i = 0; i < N; i++) {
    const t = ((i + 0.5) / N) * 2 * Math.PI;
    if (a + R * Math.cos(t) >= 0 && a + R * Math.sin(t) >= 0) n++;
  }
  return (n / N) * 2 * Math.PI * R;
}

/**
 * Perímetro de la cara del pilar que entra en la comprobación de la biela (u0 en EHE-08 46.4.3 y EC-2 2004 6.4.5(3);
 * b0 en el EC-2 2023). `norma`: 'EHE-08' | 'EC2-2004' | 'EC2-2023'. En los circulares de borde y esquina se toma la
 * parte de la cara que ve el perímetro de control (mismo ángulo).
 */
export function perimetroCara(x, norma, d) {
  validarPilar(x);
  if (norma === 'EC2-2023') {
    const lim = (v) => Math.min(v, 3 * d);
    if (x.tipo === 'rect') {
      const a = lim(x.c1);
      const b = lim(x.c2);
      return x.pos === 'interior' ? 2 * (a + b) : x.pos === 'borde' ? a + 2 * b : a + b;
    }
    return caraCircular(x, 0.5 * d);
  }
  if (x.tipo === 'rect') {
    const { c1, c2 } = x;
    if (x.pos === 'interior') return 2 * (c1 + c2);
    if (norma === 'EHE-08') {
      // 46.4.3: borde c1 + 2c2 con 1,5d como máximo a cada lado; esquina, cada lado con 1,5d como máximo
      if (x.pos === 'borde') return c1 + 2 * Math.min(c2, 1.5 * d);
      return Math.min(c1, 1.5 * d) + Math.min(c2, 1.5 * d);
    }
    // EC-2 2004 6.4.5(3): borde (paralelo + 3d) ≤ (paralelo + 2 perpendiculares); esquina 3d ≤ c1 + c2
    if (x.pos === 'borde') return c1 + Math.min(3 * d, 2 * c2);
    return Math.min(3 * d, c1 + c2);
  }
  return caraCircular(x, 2 * d);
}

/** Parte de la cara del pilar circular bajo el perímetro de control a δ (en radio a). */
function caraCircular(x, delta) {
  const a = x.D / 2;
  if (x.pos === 'interior') return 2 * Math.PI * a;
  const R = a + delta;
  if (x.pos === 'borde') return a * (Math.PI + 2 * beta(a, R));
  return R > a * Math.SQRT2 ? a * (Math.PI / 2 + 2 * beta(a, R)) : (arcoEsquinaNumerico(a, R) / R) * a;
}

/** Distancia δ (mm) a la que el contorno mide `u` (inversa de perimetro, por bisección). */
export function deltaDePerimetro(x, u, tope3d = 0) {
  const u00 = perimetro(x, 0, tope3d);
  if (u <= u00) return 0;
  let lo = 0;
  let hi = 1;
  while (perimetro(x, hi, tope3d) < u && hi < 1e7) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (perimetro(x, m, tope3d) < u) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Contorno a δ como polilínea (para dibujar y repartir ramas), coordenadas en mm con el origen en la esquina de la
 * losa más cercana: el borde libre es y = 0 (borde y esquina) y, en la esquina, también x = 0. Devuelve los puntos en
 * sentido antihorario; en el interior, la curva cerrada.
 */
export function contorno(x, delta, paso = 4) {
  validarPilar(x);
  const pts = [];
  const cerrado = x.pos === 'interior';
  if (x.tipo === 'rect') {
    const { c1, c2 } = x;
    // Pilar con su esquina inferior izquierda en el origen (a ras del borde en y = 0, y de x = 0 en la esquina)
    const X0 = 0;
    const X1 = c1;
    const Y0 = 0;
    const Y1 = c2;
    // Curva envolvente antihoraria desde la mitad del lado inferior (fuera de la losa en borde y esquina)
    const cx = (X0 + X1) / 2;
    const tramo = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / paso));
      for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
    };
    const arco = (px, py, a0, a1) => {
      const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * delta) / paso));
      for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([px + delta * Math.cos(a), py + delta * Math.sin(a)]); }
    };
    tramo(cx, Y0 - delta, X1, Y0 - delta);
    arco(X1, Y0, -Math.PI / 2, 0);
    tramo(X1 + delta, Y0, X1 + delta, Y1);
    arco(X1, Y1, 0, Math.PI / 2);
    tramo(X1, Y1 + delta, X0, Y1 + delta);
    arco(X0, Y1, Math.PI / 2, Math.PI);
    tramo(X0 - delta, Y1, X0 - delta, Y0);
    arco(X0, Y0, Math.PI, 1.5 * Math.PI);
    tramo(X0, Y0 - delta, cx, Y0 - delta);
    return recortar(pts, x.pos, cerrado);
  }
  const a = x.D / 2;
  const R = a + delta;
  const cx = a;
  const cy = a;
  const ini = x.pos === 'esquina' ? -0.75 * Math.PI : -0.5 * Math.PI;
  const n = Math.max(24, Math.ceil((2 * Math.PI * R) / paso));
  for (let i = 0; i <= n; i++) {
    const t = ini + (2 * Math.PI * i) / n;
    pts.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
  }
  return recortar(pts, x.pos, cerrado);
}

/** Se queda con la parte de la polilínea dentro de la losa (y ≥ 0 en borde, x, y ≥ 0 en esquina). */
function recortar(pts, pos, cerrado) {
  if (cerrado) return pts;
  const dentro = ([px, py]) => py >= -1e-9 && (pos !== 'esquina' || px >= -1e-9);
  const res = pts.filter(dentro);
  return res;
}

/** Longitud de una polilínea. */
export function longitud(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** n puntos equiespaciados a lo largo de la polilínea (ramas de una fila de cercos). En cerrado, reparto cíclico. */
export function repartir(pts, n, cerrado) {
  if (!(n > 0) || pts.length < 2) return [];
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = acum[acum.length - 1];
  const paso = L / n;
  const res = [];
  for (let k = 0; k < n; k++) {
    const s = cerrado ? k * paso : (k + 0.5) * paso;
    let i = 1;
    while (i < acum.length - 1 && acum[i] < s) i++;
    const f = (s - acum[i - 1]) / Math.max(acum[i] - acum[i - 1], 1e-9);
    res.push([pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])]);
  }
  return res;
}

/** β según el modo de excentricidad: 'sin' (sin momento transferido), 'aprox' (valores simplificados) u 'otro' (editable). */
export function betaDe(norma, modo, pos, otro = 1) {
  if (modo === 'otro') return otro;
  if (modo === 'aprox') return BETA_APROX[pos];
  // Sin momento: 1,00; en el EC-2 2023 el pilar interior no baja de 1,05 (tabla 8.3, βe ≥ 1,05)
  return norma === 'EC2-2023' && pos === 'interior' ? 1.05 : 1;
}

/** Comprueba la armadura de punzonamiento (cercos verticales: ramas por perímetro, ø, separación radial y primera distancia). */
export function validarArmadura(a) {
  if (!a) throw new ErrorClave('pun.errArm');
  if (!(a.fi > 0) || !(a.ramas >= 1) || !(a.sr > 0) || !(a.a1 >= 0) || !(a.nPer >= 1)) throw new ErrorClave('pun.errArm');
}

/** Distancias δ (mm) de cada perímetro de cercos a la cara del pilar: a1, a1 + sr, … */
export const anillos = (a) => Array.from({ length: Math.max(0, Math.round(a.nPer)) }, (_, i) => a.a1 + i * a.sr);

/**
 * Número de perímetros de cercos para que el último llegue a `deltaMin` (mm) de la cara del pilar. Mínimo `minimo`.
 */
export function nPerimetrosPara(a, deltaMin, minimo = 1) {
  const n = deltaMin <= a.a1 ? 1 : Math.ceil((deltaMin - a.a1) / a.sr - 1e-9) + 1;
  return Math.max(minimo, n);
}

/** Redondea hacia arriba un número de ramas al par (reparto simétrico alrededor del pilar). */
export const alPar = (n) => (n % 2 === 0 ? n : n + 1);

/* ---------- Esquemas de armado: en cruz o en retícula rectangular ---------- */

/** Brazos de la cruz según la posición del pilar (el borde libre y la esquina quitan los que salen de la losa). */
export const BRAZOS = { interior: 4, borde: 3, esquina: 2 };
export const nBrazos = (pos) => BRAZOS[pos] ?? 4;

/** Ramas por perímetro de una retícula nx × ny: lados paralelos a x con nx ramas y paralelos a y con ny (las de las esquinas se comparten). */
export function ramasReticula(pos, nx, ny) {
  if (pos === 'interior') return 2 * nx + 2 * ny - 4;
  if (pos === 'borde') return nx + 2 * ny - 2;
  return nx + ny - 1;
}

/** Menor retícula (lo más cuadrada posible) con al menos n ramas por perímetro. */
export function rejillaPara(pos, n) {
  let mejor = null;
  for (let nx = 2; nx <= 40; nx++) {
    for (let ny = 2; ny <= 40; ny++) {
      const tot = ramasReticula(pos, nx, ny);
      if (tot < n) continue;
      const clave = [tot, Math.abs(nx - ny)];
      if (!mejor || clave[0] < mejor.clave[0] || (clave[0] === mejor.clave[0] && clave[1] < mejor.clave[1])) mejor = { nx, ny, ramas: tot, clave };
    }
  }
  return mejor ? { nx: mejor.nx, ny: mejor.ny, ramas: mejor.ramas } : { nx: 40, ny: 40, ramas: ramasReticula(pos, 40, 40) };
}

/** Ramas por perímetro que dan el esquema de armado: cruz, las que se pidan (al menos una por brazo); retícula, nx × ny. */
export function ramasDe(a, pos, nNecesario) {
  if (a?.esq === 'ret') return rejillaPara(pos, Math.max(nNecesario, 4));
  return { ramas: Math.max(Math.ceil(nNecesario - 1e-9), nBrazos(pos)) };
}

/** Semiancho de la cara del pilar (mm) y centro del pilar en el sistema del contorno (origen en la esquina inferior izquierda). */
function pilarCentro(x) {
  return x.tipo === 'rect' ? { cx: x.c1 / 2, cy: x.c2 / 2, hx: x.c1 / 2, hy: x.c2 / 2 } : { cx: x.D / 2, cy: x.D / 2, hx: x.D / 2, hy: x.D / 2 };
}

/**
 * Posiciones de los cercos en cruz: `n` ramas por perímetro repartidas entre los brazos (los que salen por los ejes del
 * pilar); las de cada brazo van en fila transversal (separación `sl`), a las distancias δ de la cara.
 */
/** Margen a cada lado del pilar sin barras en las bandas de la cruz (25 mm, José Luis y Pepiño 29/10/2026). */
export const MARGEN_BANDA = 25;
/** Ancho de la banda de un brazo de la cruz: el del pilar medido en perpendicular al brazo, menos el margen a cada lado. */
export const anchoBanda = (x, ux) => {
  const { hx, hy } = pilarCentro(x);
  return Math.max(0, 2 * (Math.abs(ux) ? hy : hx) - 2 * MARGEN_BANDA);
};

/**
 * Ramas de la cruz: en cada brazo, `k` ramas por perímetro repartidas a lo ancho de la banda (la del pilar menos 25 mm por
 * lado). El último parámetro (separación lateral) ya no se usa y se conserva por compatibilidad.
 */
export function cercosCruz(x, deltas, n, _sl) {
  const { cx, cy, hx, hy } = pilarCentro(x);
  const brazos = [[1, 0], [0, 1]];
  if (x.pos !== 'esquina') brazos.push([-1, 0]);
  if (x.pos === 'interior') brazos.push([0, -1]);
  const pts = [];
  brazos.forEach(([ux, uy], i) => {
    const k = Math.floor(n / brazos.length) + (i < n % brazos.length ? 1 : 0);
    const cara = Math.abs(ux) * hx + Math.abs(uy) * hy;
    const sepLat = k > 1 ? anchoBanda(x, ux) / (k - 1) : 0;
    for (const dl of deltas) {
      for (let j = 0; j < k; j++) {
        const lat = (j - (k - 1) / 2) * sepLat;
        pts.push([cx + ux * (cara + dl) - uy * lat, cy + uy * (cara + dl) + ux * lat]);
      }
    }
  });
  return pts;
}

/** Contorno rectangular de esquinas vivas a δ de la cara (o de la caja del pilar circular), recortado por los bordes libres. */
export function contornoRect(x, delta) {
  const { cx, cy, hx, hy } = pilarCentro(x);
  const x0 = cx - hx - delta;
  const x1 = cx + hx + delta;
  const y0 = cy - hy - delta;
  const y1 = cy + hy + delta;
  if (x.pos === 'interior') return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  if (x.pos === 'borde') return [[x0, 0], [x0, y1], [x1, y1], [x1, 0]];
  return [[x1, 0], [x1, y1], [0, y1]];
}

/**
 * Cercos en retícula: nx ramas en cada lado paralelo a x y ny en cada lado paralelo a y (las esquinas se comparten), sobre el
 * contorno rectangular a δ de la cara. Los lados que llegan al borde libre dejan media separación hasta él.
 */
export function cercosReticula(x, delta, nx, ny) {
  const c = contornoRect(x, delta);
  const { cx, cy, hx, hy } = pilarCentro(x);
  const x0 = cx - hx - delta;
  const x1 = cx + hx + delta;
  const y0 = cy - hy - delta;
  const y1 = cy + hy + delta;
  void c;
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (n > 1 ? (i * (b - a)) / (n - 1) : 0));
  // desde la esquina `a` hacia el borde libre `b`, con media separación al final
  const haciaBorde = (a, b, n) => Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 0.5));
  const pts = [];
  if (x.pos === 'interior') {
    for (const xx of lin(x0, x1, nx)) { pts.push([xx, y0]); pts.push([xx, y1]); }
    for (const yy of lin(y0, y1, ny).slice(1, -1)) { pts.push([x0, yy]); pts.push([x1, yy]); }
  } else if (x.pos === 'borde') {
    for (const xx of lin(x0, x1, nx)) pts.push([xx, y1]);
    for (const yy of haciaBorde(y1, 0, ny).slice(1)) { pts.push([x0, yy]); pts.push([x1, yy]); }
  } else {
    for (const xx of haciaBorde(x1, 0, nx)) pts.push([xx, y1]);
    for (const yy of haciaBorde(y1, 0, ny).slice(1)) pts.push([x1, yy]);
  }
  return pts;
}

/**
 * Perímetro exterior de la cruz: envolvente convexa de los círculos de radio `kd` alrededor del último cerco de cada brazo
 * (EC-2, fig. 6.22), recortada por los bordes libres. Devuelve sus vértices y su longitud sin el tramo sobre el borde libre.
 */
export function envolventeCruz(x, dl, kd, n = 4, sl = 0) {
  const { hx, hy } = pilarCentro(x);
  const centros = cercosCruz(x, [dl], n, sl);
  const w = x.tipo === 'rect' ? [[0, 0], [x.c1, 0], [x.c1, x.c2], [0, x.c2]] : [];
  const cand = [...w];
  for (const [px, py] of centros) {
    for (let g = 0; g < 360; g += 5) cand.push([px + kd * Math.cos((g * Math.PI) / 180), py + kd * Math.sin((g * Math.PI) / 180)]);
  }
  if (x.tipo === 'circ') for (let g = 0; g < 360; g += 5) cand.push([hx + hx * Math.cos((g * Math.PI) / 180), hy + hy * Math.sin((g * Math.PI) / 180)]);
  const rec = cand.map(([px, py]) => [x.pos === 'esquina' ? Math.max(px, 0) : px, x.pos === 'interior' ? py : Math.max(py, 0)]);
  const casco = cascoConvexo(rec);
  const enBorde = ([px, py]) => (x.pos !== 'interior' && py <= 1e-6) || (x.pos === 'esquina' && px <= 1e-6);
  let long = 0;
  for (let i = 0; i < casco.length; i++) {
    const a = casco[i];
    const b = casco[(i + 1) % casco.length];
    if (enBorde(a) && enBorde(b)) continue;
    long += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { pts: casco, long, enBorde };
}

function cascoConvexo(P) {
  const p = P.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Longitud del perímetro exterior (a kd del último perímetro de cercos) según el esquema de armado. */
export function uExterior(x, a, dl, kd, tope3d = 0) {
  if (a?.esq === 'cruz') return envolventeCruz(x, dl, kd, a.ramas ?? nBrazos(x.pos), a.sr).long;
  return perimetro(x, dl + kd, tope3d);
}

/** Número de perímetros de cercos para que la longitud exterior alcance `uReq` (mm). */
export function nPerimetrosExt(x, a, kd, uReq, minimo = 1, tope3d = 0) {
  const ar = { ...a };
  for (let n = Math.max(1, minimo); n <= 40; n++) {
    if (uExterior(x, ar, a.a1 + (n - 1) * a.sr, kd, tope3d) >= uReq - 1e-6) return n;
  }
  return 40;
}
