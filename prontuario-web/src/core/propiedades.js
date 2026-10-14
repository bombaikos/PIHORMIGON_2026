// Características mecánicas de una sección: bruta, homogeneizada y fisurada, y momento de fisuración.
// Equivale a PropiedadesSeccionBruta / Homogeneizada / Fisurada de Unit4.pas (Prontuario 3.1).
// Unidades: m, m², m⁴, kN, kN·m. y hacia abajo desde la fibra superior.

import { esfuerzos } from './seccion.js';
import { seccionMotor, girar } from './geometria.js';

/** A, momentos estáticos y de inercia de los contornos respecto a los ejes x = 0, y = 0. */
function integrales(cs) {
  let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0;
  for (const c of cs) {
    let a = 0, sx = 0, sy = 0, ixx = 0, iyy = 0;
    const p = c.pts;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      const k = x1 * y2 - x2 * y1;
      a += k / 2;
      sx += ((y1 + y2) * k) / 6; // ∫y dA
      sy += ((x1 + x2) * k) / 6; // ∫x dA
      ixx += ((y1 * y1 + y1 * y2 + y2 * y2) * k) / 12; // ∫y² dA
      iyy += ((x1 * x1 + x1 * x2 + x2 * x2) * k) / 12; // ∫x² dA
    }
    const f = c.signo * Math.sign(a); // el sentido de recorrido no importa
    A += f * a; Sx += f * sx; Sy += f * sy; Ixx += f * ixx; Iyy += f * iyy;
  }
  return { A, Sx, Sy, Ixx, Iyy };
}

function terna(A, Sx, Sy, Ixx, Iyy, caja) {
  const yg = Sx / A;
  const xg = Sy / A;
  const Ix = Ixx - A * yg * yg; // flexión en el plano vertical (eje horizontal por el c.d.g.)
  const Iy = Iyy - A * xg * xg;
  return { A, xg: xg - caja.xmin, yg: yg - caja.ymin, Ix, Iy, rx: Math.sqrt(Ix / A), ry: Math.sqrt(Iy / A) };
}

/** Sección bruta de hormigón. */
export function bruta(geo) {
  const r = integrales(geo.contornos);
  return terna(r.A, r.Sx, r.Sy, r.Ixx, r.Iyy, geo.caja);
}

/** Sección homogeneizada con n = Es/Ec (las barras se suman con n·As, como en el original). */
export function homogeneizada(geo, Ec, Es) {
  const r = integrales(geo.contornos);
  const n = Es / Ec;
  const todas = [...geo.barras.map((b) => ({ x: b.x, y: b.y, A: b.A })), ...geo.franjas.map((f) => ({ x: (f.x1 + f.x2) / 2, y: f.y, A: f.A }))];
  for (const b of todas) {
    r.A += n * b.A; r.Sx += n * b.A * b.y; r.Sy += n * b.A * b.x;
    r.Ixx += n * b.A * b.y * b.y; r.Iyy += n * b.A * b.x * b.x;
  }
  return { ...terna(r.A, r.Sx, r.Sy, r.Ixx, r.Iyy, geo.caja), n };
}

/** Materiales lineales: hormigón sin resistencia a tracción y acero elástico indefinido. */
function lineal(E, conTraccion) {
  return {
    E,
    comp: [[0, 0], [-100, -100 * E]],
    tracc: conTraccion ? [[0, 0], [100, 100 * E]] : [[0, 0], [100, 0]],
    roturaComp: false,
    roturaTracc: false,
  };
}

/** εsup que equilibra el axil N (tracción positiva) para una curvatura dada. */
function planoLineal(sec, N, kappa, yref) {
  let lo = -1, hi = 1;
  for (let i = 0; i < 200 && hi - lo > 1e-16; i++) {
    const m = (lo + hi) / 2;
    if (esfuerzos(sec, m, kappa, yref).N < N) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Sección fisurada (hormigón sin tracción, acero lineal) con momento que comprime la cara superior.
 * Ifis = M / (κ·Ec) con M respecto al c.d.g. homogeneizado, como en el original.
 * @param {number} N  Axil, tracción positiva [kN]
 */
function fisuradaArriba(geo, Ec, Es, N, h, Mfis) {
  const sec = seccionMotor(geo, lineal(Ec, false), lineal(Es, true));
  // Con N = 0 la curvatura no influye. Con axil se toma la del instante de fisuración.
  const kappa = N === 0 || !(Mfis > 0) ? 1e-4 : Mfis / (Ec * h.Ix);
  const eps = planoLineal(sec, N, kappa, h.yg);
  const { M } = esfuerzos(sec, eps, kappa, h.yg);
  const x = eps < 0 ? -eps / kappa : 0;
  return { Ifis: M / (kappa * Ec), x: Math.min(x, geo.h) };
}

/**
 * Propiedades completas.
 * @param {Object} geo  geometria(s)
 * @param {{Ec:number, Es:number, fctm:number}} m  Ec y Es en kN/m², fctm en kN/m²
 * @param {number} [N=0]  Axil para la fisuración, tracción positiva [kN]
 */
/**
 * Resistencia media a flexotracción, fct,m,fl = max{(1,6 − h)·fct,m ; fct,m} con h en m
 * (EHE-08 39.1; UNE-EN 1992-1-1 (3.23); EN 1992-1-1:2023 (9.30): misma fórmula en las tres).
 */
export const fctmFlexotraccion = (fctm, h) => Math.max((1.6 - h) * fctm, fctm);

export function propiedades(geo, { Ec, Es, fctm }, N = 0) {
  const b = bruta(geo);
  const h = homogeneizada(geo, Ec, Es);
  const H = geo.h;
  // Momento de fisuración (positivo: tracciona la cara inferior)
  const MfisPos = (fctm - N / h.A) * h.Ix / (H - h.yg);
  const MfisNeg = (fctm - N / h.A) * h.Ix / h.yg;
  const pos = fisuradaArriba(geo, Ec, Es, N, h, MfisPos);
  const geoG = girar(geo);
  const hG = homogeneizada(geoG, Ec, Es);
  const neg = fisuradaArriba(geoG, Ec, Es, N, hG, MfisNeg);
  return {
    bruta: b,
    homogeneizada: h,
    fisurada: {
      positivo: { Mfis: MfisPos, Ifis: pos.Ifis, x: pos.x },
      negativo: { Mfis: MfisNeg, Ifis: neg.Ifis, x: neg.x },
    },
    h: H,
  };
}
