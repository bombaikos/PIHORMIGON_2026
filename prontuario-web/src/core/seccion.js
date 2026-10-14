// Motor seccional: equivalente a calcomun.pas (curvu, calcula_Ne, calcula_My).
// Ejes: y hacia abajo desde la fibra superior (y = 0 arriba). Deformación plana
// ε(y) = εsup + κ·y. κ > 0 comprime la cara superior (flexión positiva).
// Unidades: kN, m, kN/m². Tracción positiva. Momento positivo si comprime arriba.

import { sigma, limites, quiebros } from './materiales.js';

/**
 * @typedef {Object} Trapecio  Parte de hormigón (o de cualquier material) de ancho lineal en y
 * @property {number} y1 Profundidad superior
 * @property {number} y2 Profundidad inferior
 * @property {number} b1 Ancho en y1
 * @property {number} b2 Ancho en y2
 * @property {import('./materiales.js').Material} mat
 *
 * @typedef {Object} Barra  Armadura puntual
 * @property {number} y
 * @property {number} A   [m²]
 * @property {import('./materiales.js').Material} mat
 *
 * @typedef {Object} Seccion
 * @property {Trapecio[]} trapecios
 * @property {Barra[]} barras
 * @property {number} h  Canto total
 * @property {number} [epsC2] Si existe, aplica el pivote C a 3h/7 de la fibra más comprimida
 */

const GL = [
  [-Math.sqrt(3 / 5), 5 / 9],
  [0, 8 / 9],
  [Math.sqrt(3 / 5), 5 / 9],
];

function anchoEn(t, y) {
  if (t.y2 === t.y1) return t.b1;
  return t.b1 + ((t.b2 - t.b1) * (y - t.y1)) / (t.y2 - t.y1);
}

/** Área y momentos estáticos homogeneizados respecto al primer material (calcula_yg). */
export function centroHomogeneizado(sec) {
  const Eref = sec.trapecios[0].mat.E;
  let A = 0;
  let S = 0;
  for (const t of sec.trapecios) {
    const n = t.mat.E / Eref;
    const h = t.y2 - t.y1;
    const a = ((t.b1 + t.b2) / 2) * h;
    const yc = a > 0 ? t.y1 + (h * (t.b1 + 2 * t.b2)) / (3 * (t.b1 + t.b2)) : t.y1;
    A += n * a;
    S += n * a * yc;
  }
  for (const b of sec.barras) {
    const n = b.mat.E / Eref;
    A += n * b.A;
    S += n * b.A * b.y;
  }
  return { A, yg: S / A };
}

/**
 * Esfuerzos para un plano de deformación.
 * @param {Seccion} sec
 * @param {number} epsSup
 * @param {number} kappa
 * @param {number} yref  Profundidad del punto respecto al que se toman momentos
 * @returns {{N:number, M:number}}
 */
export function esfuerzos(sec, epsSup, kappa, yref) {
  let N = 0;
  let M = 0;
  for (const t of sec.trapecios) {
    const cortes = [t.y1, t.y2];
    if (kappa !== 0) {
      for (const e of quiebros(t.mat)) {
        const y = (e - epsSup) / kappa;
        if (y > t.y1 && y < t.y2) cortes.push(y);
      }
    }
    cortes.sort((a, b) => a - b);
    for (let i = 1; i < cortes.length; i++) {
      const a = cortes[i - 1];
      const b = cortes[i];
      if (b - a <= 0) continue;
      const mid = (a + b) / 2;
      const half = (b - a) / 2;
      for (const [xi, w] of GL) {
        const y = mid + half * xi;
        const s = sigma(t.mat, epsSup + kappa * y) * anchoEn(t, y) * w * half;
        N += s;
        M += s * (y - yref);
      }
    }
  }
  for (const b of sec.barras) {
    const s = sigma(b.mat, epsSup + kappa * b.y) * b.A;
    N += s;
    M += s * (b.y - yref);
  }
  return { N, M };
}

/** Restricciones de deformación (pivotes) como lista {y, min, max}. */
function restricciones(sec, kappa) {
  const r = [];
  for (const t of sec.trapecios) {
    const [mn, mx] = limites(t.mat);
    r.push({ y: t.y1, min: mn, max: mx }, { y: t.y2, min: mn, max: mx });
  }
  for (const b of sec.barras) {
    const [mn, mx] = limites(b.mat);
    r.push({ y: b.y, min: mn, max: mx });
  }
  if (sec.epsC2) {
    // Pivote C: ε ≥ -εc2 a 3h/7 de la fibra más comprimida (el "ficticio" del .sec).
    const y = kappa >= 0 ? (3 * sec.h) / 7 : (4 * sec.h) / 7;
    r.push({ y, min: -sec.epsC2, max: Infinity });
  }
  return r;
}

/** Intervalo admisible de εsup para una curvatura dada. */
export function intervaloEpsSup(sec, kappa) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const c of restricciones(sec, kappa)) {
    lo = Math.max(lo, c.min - kappa * c.y);
    hi = Math.min(hi, c.max - kappa * c.y);
  }
  return [lo, hi];
}

function resolverEpsSup(sec, kappa, Nd, lo, hi, yref) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 200 && b - a > 1e-15; i++) {
    const m = (a + b) / 2;
    if (esfuerzos(sec, m, kappa, yref).N < Nd) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * Estado último para un axil dado: la máxima curvatura del signo pedido para la que
 * existe un plano admisible con N = Nd (misma idea que curvu en calcomun.pas).
 * @param {Seccion} sec
 * @param {number} Nd  Axil de cálculo [kN], tracción positiva
 * @param {{signo?:1|-1, yref?:number}} [opc]
 */
export function estadoUltimo(sec, Nd, { signo = 1, yref } = {}) {
  const ref = yref ?? centroHomogeneizado(sec).yg;
  const factible = (k) => {
    let [lo, hi] = intervaloEpsSup(sec, k);
    if (!(lo <= hi)) return null;
    if (!Number.isFinite(lo)) lo = hi - 1;
    if (!Number.isFinite(hi)) hi = lo + 1;
    const Nlo = esfuerzos(sec, lo, k, ref).N;
    const Nhi = esfuerzos(sec, hi, k, ref).N;
    if (Nd < Nlo - 1e-9 || Nd > Nhi + 1e-9) return null;
    return [lo, hi];
  };
  let kOk = 1e-7 * signo;
  if (!factible(kOk)) {
    return { converge: false, motivo: 'El axil supera la capacidad de la sección' };
  }
  let kNo = 1 * signo;
  if (factible(kNo)) kOk = kNo;
  else {
    for (let i = 0; i < 200 && Math.abs(kNo - kOk) > 1e-12; i++) {
      const k = (kOk + kNo) / 2;
      if (factible(k)) kOk = k;
      else kNo = k;
    }
  }
  const [lo, hi] = factible(kOk);
  const epsSup = resolverEpsSup(sec, kOk, Nd, lo, hi, ref);
  const { N, M } = esfuerzos(sec, epsSup, kOk, ref);
  return {
    converge: true,
    kappa: kOk,
    epsSup,
    epsInf: epsSup + kOk * sec.h,
    x: kOk !== 0 ? -epsSup / kOk : Infinity,
    N,
    M,
    yref: ref,
  };
}

/** Deformación en una profundidad y para un plano (εsup, κ). */
export function deformacion(plano, y) {
  return plano.epsSup + plano.kappa * y;
}
