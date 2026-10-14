// Modelo único de sección: contorno de hormigón (con huecos) y grupos de armadura.
// Sirve para las rectangulares (vigas y pilares), en T, circulares y genéricas del Prontuario 3.1.
//
// Coordenadas en m: x hacia la derecha, y hacia abajo desde la fibra superior (y = 0
// arriba), igual que el motor seccional. Los diámetros de barra se guardan en mm.

import { leerArmado, leerCapas, leerCara } from './armado.js';
import { err } from './errores.js';

/** Separación entre ejes de capas consecutivas de una misma cara si el proyecto no dice otra [m]. */
export const SEP_CAPAS = 0.05;

/**
 * @typedef {Object} Capa      Armadura en una cara: barras repartidas en el ancho
 * @property {'capa'} tipo
 * @property {'inf'|'sup'} cara
 * @property {string} texto   Una capa por sumando, de la cara hacia dentro: "5D20+2D16"; "1030" es un área en mm²
 * @property {number} d       Distancia de la cara al eje de la primera capa [m]; también es el recubrimiento lateral al eje
 *
 * @typedef {Object} Anillo    Barras repartidas en una circunferencia (secciones circulares)
 * @property {'anillo'} tipo
 * @property {string} texto
 * @property {number} r       Recubrimiento mecánico: del borde al eje de las barras [m]
 *
 * @typedef {Object} Caras     Secciones genéricas: una capa por cara del contorno exterior
 * @property {'caras'} tipo
 * @property {string[]} textos  Armadura de la cara i (del vértice i al i+1): "3D16" o vacío
 * @property {number} d         Distancia de las caras al eje de las barras [m]
 *
 * @typedef {Object} Perimetral  Pilares rectangulares: barras iguales en las cuatro caras
 * @property {'perimetral'} tipo
 * @property {number} nx   Barras en cada cara horizontal (superior e inferior), contando las esquinas
 * @property {number} ny   Barras en cada cara vertical (laterales), contando las esquinas
 * @property {number} fi   Diámetro común [mm]
 * @property {number} d    Distancia de las caras al eje de las barras [m]
 *
 * @typedef {Object} Puntual   Barras sueltas con posición (secciones genéricas)
 * @property {'puntual'} tipo
 * @property {{x:number,y:number,fi:number}[]} barras
 *
 * @typedef {Object} SeccionProyecto
 * @property {string} nombre
 * @property {'rectangular'|'pilar'|'T'|'circular'|'generica'} forma  rectangular = viga (caras superior e inferior); pilar = las cuatro caras
 * @property {Object} geo  {b,h} | {b,h,bw,hf} | {D} | {contorno, huecos}
 * @property {(Capa|Anillo|Puntual)[]} armado
 * @property {string} hormigon
 * @property {string} acero
 */

export const FORMAS = ['rectangular', 'pilar', 'T', 'circular', 'generica'];

/* ---------- contornos ---------- */

/** Polígono regular con la misma área que el círculo. */
export function poligonoCircular(D, n = 96, xc = D / 2, yc = D / 2) {
  const R = (D / 2) * Math.sqrt((2 * Math.PI) / (n * Math.sin((2 * Math.PI) / n)));
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [xc + R * Math.sin(a), yc - R * Math.cos(a)];
  });
}

/** Contornos de hormigón de una sección: [{pts, signo}] con signo −1 en los huecos. */
export function contornos(s) {
  const g = s.geo;
  switch (s.forma) {
    case 'rectangular':
    case 'pilar':
      return [{ pts: [[0, 0], [g.b, 0], [g.b, g.h], [0, g.h]], signo: 1 }];
    case 'T': {
      const a = (g.b - g.bw) / 2;
      return [{ pts: [[0, 0], [g.b, 0], [g.b, g.hf], [a + g.bw, g.hf], [a + g.bw, g.h], [a, g.h], [a, g.hf], [0, g.hf]], signo: 1 }];
    }
    case 'circular':
      return [{ pts: poligonoCircular(g.D), signo: 1 }];
    case 'generica':
      return [{ pts: g.contorno, signo: 1 }, ...(g.huecos ?? []).map((pts) => ({ pts, signo: -1 }))];
    default:
      throw new Error(`Forma de sección desconocida: ${s.forma}`);
  }
}

function cajaDe(cs) {
  const xs = cs.flatMap((c) => c.pts.map((p) => p[0]));
  const ys = cs.flatMap((c) => c.pts.map((p) => p[1]));
  return { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
}

/** Tramos ocupados por un contorno a la altura y: [[x1,x2],...]. */
function cortesEn(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  const t = [];
  for (let i = 0; i + 1 < xs.length; i += 2) t.push([xs[i], xs[i + 1]]);
  return t;
}

/** Ancho neto de hormigón a la altura y. */
export function anchoEn(cs, y) {
  let b = 0;
  for (const c of cs) for (const [a, z] of cortesEn(c.pts, y)) b += c.signo * (z - a);
  return b;
}

/** Tramo útil para repartir barras a la altura y (el más ancho del contorno exterior). */
function tramoEn(cs, y) {
  const t = cortesEn(cs[0].pts, y);
  if (!t.length) return null;
  return t.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
}

/* ---------- armadura ---------- */

/** Posiciones x de n barras iguales en [x1, x2] con recubrimiento lateral r: una en cada extremo y el resto equidistantes. */
function repartir(n, x1, x2, r) {
  const a = x1 + r;
  const z = Math.max(a, x2 - r);
  return Array.from({ length: n }, (_, i) => (n === 1 ? (x1 + x2) / 2 : a + ((z - a) * i) / (n - 1)));
}

/**
 * Geometría completa: contornos, barras con posición y franjas de área sin barras.
 * @returns {{contornos, caja, h, barras: {x,y,fi,A,grupo}[], franjas: {y,A,x1,x2,grupo}[], errores: {clave:string,args:any[]}[]}}
 */
export function geometria(s, { sep = SEP_CAPAS } = {}) {
  const cs = contornos(s);
  const caja = cajaDe(cs);
  const h = caja.ymax - caja.ymin;
  const barras = [];
  const franjas = [];
  const errores = [];
  const avisos = [];
  (s.armado ?? []).forEach((g, grupo) => {
    if (g.tipo === 'puntual') {
      for (const b of g.barras ?? []) barras.push({ x: b.x, y: b.y, fi: b.fi, A: (Math.PI * (b.fi / 1000) ** 2) / 4, grupo });
      return;
    }
    if (g.tipo === 'caras') {
      if (s.forma !== 'generica') { errores.push(err('geoErr.carasSoloGen')); return; }
      barrasCaras(cs[0].pts, g, grupo, barras, errores, avisos);
      return;
    }
    if (g.tipo === 'perimetral') {
      if (s.forma !== 'pilar') { errores.push(err('geoErr.perimSoloPilar')); return; }
      barrasPerimetrales(caja, g, grupo, barras, errores);
      return;
    }
    if (g.tipo === 'capa') {
      const r = leerCapas(g.texto);
      if (!r) { errores.push(err('geoErr.formatoCara', g.cara)); return; }
      if (r.error === 'err.unaBarra') errores.push(err('geoErr.unaBarraCara', g.cara));
      r.capas.forEach((c, k) => {
        const dk = g.d + k * sep;
        const y = g.cara === 'sup' ? caja.ymin + dk : caja.ymax - dk;
        const t = tramoEn(cs, y);
        if (!t) { errores.push(err('geoErr.capaFuera', k + 1, g.cara)); return; }
        if (c.n === undefined) { franjas.push({ y, A: c.A * 1e-6, x1: t[0] + g.d, x2: t[1] - g.d, grupo }); return; }
        const A = (Math.PI * (c.fi / 1000) ** 2) / 4;
        for (const x of repartir(c.n, t[0], t[1], g.d)) barras.push({ x, y, fi: c.fi, A, grupo, capa: k });
      });
      return;
    }
    const a = leerArmado(g.texto);
    if (!a) { errores.push(err('geoErr.formatoGrupo', grupo + 1)); return; }
    const fis = a.barras.flatMap((b) => Array(b.n).fill(b.fi));
    if (g.tipo === 'anillo') {
      if (s.forma !== 'circular') { errores.push(err('geoErr.anilloSoloCirc')); return; }
      const R = s.geo.D / 2 - g.r;
      const n = fis.length;
      fis.forEach((fi, i) => {
        const ang = (2 * Math.PI * i) / n;
        barras.push({ x: s.geo.D / 2 + R * Math.sin(ang), y: s.geo.D / 2 - R * Math.cos(ang), fi, A: (Math.PI * (fi / 1000) ** 2) / 4, grupo });
      });
      if (a.Aarea > 0) errores.push(err('geoErr.anilloBarras'));
    }
  });
  return { contornos: cs, caja, h, barras, franjas, errores, avisos };
}

/**
 * Pilar rectangular: nx barras en las caras superior e inferior y ny en las laterales, las de
 * las esquinas contadas en las dos; todas del mismo diámetro, sobre el rectángulo interior a d.
 */
function barrasPerimetrales(caja, g, grupo, barras, errores) {
  const nx = Math.round(g.nx);
  const ny = Math.round(g.ny);
  if (!(nx >= 2 && ny >= 2)) { errores.push(err('geoErr.perimMinimo')); return; }
  if (!(g.fi > 0)) { errores.push(err('geoErr.perimDiametro')); return; }
  const x1 = caja.xmin + g.d;
  const x2 = caja.xmax - g.d;
  const y1 = caja.ymin + g.d;
  const y2 = caja.ymax - g.d;
  if (!(x2 > x1 && y2 > y1)) { errores.push(err('geoErr.perimFuera')); return; }
  const A = (Math.PI * (g.fi / 1000) ** 2) / 4;
  const pon = (x, y, cara) => barras.push({ x, y, fi: g.fi, A, grupo, cara });
  for (let i = 0; i < nx; i++) {
    const x = x1 + ((x2 - x1) * i) / (nx - 1);
    pon(x, y1, 'sup');
    pon(x, y2, 'inf');
  }
  for (let j = 1; j < ny - 1; j++) {
    const y = y1 + ((y2 - y1) * j) / (ny - 1);
    pon(x1, y, 'lat');
    pon(x2, y, 'lat');
  }
}

/**
 * Barras de las caras de un polígono, sobre la paralela interior a distancia d. Cada cara manda
 * en su vértice de salida (lleva una barra en él) y reparte sus n barras equidistantes hacia
 * el siguiente vértice, sin ponerlo: esa barra la controla la cara siguiente de la lista.
 */
function barrasCaras(P, g, grupo, barras, errores, avisos) {
  const n = P.length;
  if (n < 3) return;
  // Normal interior: el lado izquierdo o el derecho según el sentido de recorrido
  let A = 0;
  for (let i = 0; i < n; i++) A += P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1];
  const sg = A > 0 ? 1 : -1;
  const normal = (i) => {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % n];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    return [(-(y2 - y1) / L) * sg, ((x2 - x1) / L) * sg];
  };
  // Vértices de la paralela interior: corte de las paralelas de las dos caras que llegan al vértice
  const Q = P.map((p, i) => {
    const a = normal((i - 1 + n) % n);
    const b = normal(i);
    const c = 1 + a[0] * b[0] + a[1] * b[1];
    if (c < 1e-6) return [p[0] + b[0] * g.d, p[1] + b[1] * g.d];
    return [p[0] + ((a[0] + b[0]) / c) * g.d, p[1] + ((a[1] + b[1]) / c) * g.d];
  });
  const puestas = [];
  (g.textos ?? []).forEach((txt, i) => {
    if (i >= n || !String(txt ?? '').trim()) return;
    const c = leerCara(txt);
    if (!c) { errores.push(err('geoErr.caraFormato', i + 1)); return; }
    if (c.error) { errores.push(err(c.error === 'err.unaBarra' ? 'geoErr.caraUnaBarra' : 'geoErr.caraUnaCapa', i + 1)); return; }
    if (c.vacia) return;
    const [a, z] = [Q[i], Q[(i + 1) % n]];
    let nb = c.n;
    if (nb === undefined) {
      // Diámetro y separación: se redondea el número de barras de la cara y se avisa si la separación real se aparta de la pedida
      const L = Math.hypot(z[0] - a[0], z[1] - a[1]);
      nb = Math.max(1, Math.round(L / c.sep));
      const real = L / nb;
      if (Math.abs(real - c.sep) > 0.2 * c.sep) avisos.push(err('geoAv.caraSep', i + 1, Math.round(L * 1000), Math.round(c.sep * 1000), nb, Math.round(real * 1000)));
    }
    for (let k = 0; k < nb; k++) {
      const u = k / nb; // la barra del vértice siguiente es de la cara siguiente
      const x = a[0] + (z[0] - a[0]) * u;
      const y = a[1] + (z[1] - a[1]) * u;
      const igual = puestas.find((b) => Math.hypot(b.x - x, b.y - y) < 1e-4);
      if (igual) { if (c.fi > igual.fi) Object.assign(igual, { fi: c.fi, A: (Math.PI * (c.fi / 1000) ** 2) / 4 }); continue; }
      puestas.push({ x, y, fi: c.fi, A: (Math.PI * (c.fi / 1000) ** 2) / 4, grupo, cara: i });
    }
  });
  barras.push(...puestas);
}

/** Área total de armadura de un grupo [m²]. */
export function areaGrupo(geo, grupo) {
  return geo.barras.filter((b) => b.grupo === grupo).reduce((s, b) => s + b.A, 0)
    + geo.franjas.filter((f) => f.grupo === grupo).reduce((s, f) => s + f.A, 0);
}

/* ---------- traducción al motor seccional ---------- */

/** Trapecios horizontales exactos del contorno (el ancho es lineal entre vértices). */
export function trapecios(cs) {
  const ys = [...new Set(cs.flatMap((c) => c.pts.map((p) => p[1])))].sort((a, b) => a - b);
  const t = [];
  for (let i = 1; i < ys.length; i++) {
    const y1 = ys[i - 1];
    const y2 = ys[i];
    const e = (y2 - y1) * 1e-9;
    const b1 = anchoEn(cs, y1 + e);
    const b2 = anchoEn(cs, y2 - e);
    if (b1 > 0 || b2 > 0) t.push({ y1, y2, b1, b2 });
  }
  return t;
}

/** Sección del motor (src/core/seccion.js) a partir de la geometría y los materiales. */
export function seccionMotor(geo, hormigon, acero) {
  const y0 = geo.caja.ymin;
  return {
    trapecios: trapecios(geo.contornos).map((t) => ({ ...t, y1: t.y1 - y0, y2: t.y2 - y0, mat: hormigon })),
    barras: [
      ...geo.barras.map((b) => ({ y: b.y - y0, A: b.A, mat: acero })),
      ...geo.franjas.map((f) => ({ y: f.y - y0, A: f.A, mat: acero })),
    ],
    h: geo.h,
    epsC2: -hormigon.comp.find((p) => p[1] === Math.min(...hormigon.comp.map((q) => q[1])))[0],
  };
}

/** Gira la sección 180° (para las propiedades con momento negativo). */
export function girar(geo) {
  const { xmin, xmax, ymin, ymax } = geo.caja;
  const g = (x, y) => [xmin + xmax - x, ymin + ymax - y];
  return {
    ...geo,
    contornos: geo.contornos.map((c) => ({ ...c, pts: c.pts.map(([x, y]) => g(x, y)) })),
    barras: geo.barras.map((b) => { const [x, y] = g(b.x, b.y); return { ...b, x, y }; }),
    franjas: geo.franjas.map((f) => ({ ...f, y: ymin + ymax - f.y, x1: xmin + xmax - f.x2, x2: xmin + xmax - f.x1 })),
  };
}

/* ---------- recubrimientos ---------- */

function distBorde(cs, x, y) {
  let d = Infinity;
  for (const c of cs) {
    const p = c.pts;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const L2 = dx * dx + dy * dy;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2)) : 0;
      d = Math.min(d, Math.hypot(x - x1 - u * dx, y - y1 - u * dy));
    }
  }
  return d;
}

/** Punto dentro del hormigón (regla par-impar sobre todos los contornos). */
export function dentro(cs, x, y) {
  let n = 0;
  for (const c of cs) for (const [a, z] of cortesEn(c.pts, y)) if (x > a && x < z) n++;
  return n % 2 === 1;
}

/**
 * Recubrimiento libre de cada barra (al borde más cercano, descontando ø/2 y el cerco).
 * @param {number} fiCerco  diámetro del cerco, mm
 * @returns {{c:number, barra:Object}|null}  el menor, en m
 */
export function recubrimientoMinimo(geo, fiCerco = 0) {
  let peor = null;
  for (const b of geo.barras) {
    const c = distBorde(geo.contornos, b.x, b.y) - b.fi / 2000 - fiCerco / 1000;
    if (!peor || c < peor.c) peor = { c, barra: b, fuera: !dentro(geo.contornos, b.x, b.y) };
  }
  return peor;
}
