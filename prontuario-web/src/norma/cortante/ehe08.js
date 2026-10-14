// Esfuerzo cortante de piezas lineales según la EHE-08, art. 44.2 (comprobación a compresión oblicua del
// alma Vu1 y a tracción en el alma Vu2 = Vcu + Vsu). Puerto del módulo TT1 del Prontuario 3.1 (EHE-98) con
// los cambios de la EHE-08: mínimo de Vcu, K por tramos, σ'cd neto de la armadura comprimida, ξ ≤ 2,
// armadura mínima fct,m/7,5·b0 y separaciones st de 44.2.3.4.1.
// Unidades: MPa, mm y kN. Compresión positiva (el 3.1 usaba tracción positiva dentro de TT1).
// Textos de la norma: analisis/normativa/ehe-08/texto.txt, 44.2.3 (l.9780-10560).

import { EHE08 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';

export const COT_MIN = 0.5;
export const COT_MAX = 2.0;
/** Tope de fyα,d de las armaduras transversales (art. 40.2 y comentarios; decisión de José Luis, 14/10). */
export const FYD_TOPE = 400;
/** Cuantía geométrica máxima que se admite en las fórmulas de Vcu (44.2.3.2.1.2). */
export const RHO_MAX = 0.02;
export const REDUCCION_CIRCULAR = 0.85;
/** Separación máxima de la tabla de dimensionamiento: criterio propio del Prontuario (José Luis, 14/10). */
export const S_TABLA_MAX = 300;
export const S_TABLA_PASO = 50;

const rad = (g) => (g * Math.PI) / 180;
const cot = (g) => 1 / Math.tan(rad(g));

/**
 * Datos de la pieza.
 * @typedef {Object} DatosCortante
 * @property {number} fck        MPa
 * @property {number} fykCercos  MPa, acero de la armadura transversal
 * @property {number} [fykLong]  MPa, acero longitudinal (solo para A's en σ'cd)
 * @property {number} b0         mm, anchura neta mínima del alma (44.2.1)
 * @property {number} d          mm, canto útil
 * @property {number} Ac         mm², área total de hormigón
 * @property {number} [Asl]      mm², armadura longitudinal traccionada anclada (0 por defecto)
 * @property {number} [Asc]      mm², armadura comprimida A's para σ'cd (0 por defecto)
 * @property {number} [NEd]      kN, axil de cálculo, compresión positiva (0)
 * @property {number} [sigY]     MPa, tensión vertical (compresión +) para θe simplificado (0)
 * @property {number} cotTheta   0,5 a 2,0
 * @property {number} [alfa]     grados (45 a 90), inclinación de los cercos respecto al eje (90)
 * @property {number} [AswS]     mm²/mm, Σ Aα por unidad de longitud (0 = sin armadura)
 * @property {boolean} [circular] cercos circulares: Vsu × 0,85
 * @property {number} [z]        mm; por defecto 0,9 d
 */

/** Valores derivados comunes a todas las comprobaciones. */
export function parametros(x) {
  const { fck, fykCercos, b0, d } = x;
  if (!(fck > 0) || !(b0 > 0) || !(d > 0) || !(x.Ac > 0)) throw new ErrorClave('cor.errDatos');
  if (fck > EHE08.fckMax) throw new ErrorClave('cor.errFck', EHE08.fckMax);
  const gc = EHE08.gammaC;
  const gs = EHE08.gammaS;
  const fcd = (EHE08.alfaCC() * fck) / gc;
  const fctm = EHE08.fctm(fck);
  const fydLibre = fykCercos / gs;
  const fyd = Math.min(fydLibre, FYD_TOPE);
  const fydLong = Math.min((x.fykLong ?? fykCercos) / gs, FYD_TOPE);
  const NEd = x.NEd ?? 0;
  const Asc = x.Asc ?? 0;
  // σ'cd = (Nd − A's·fyd)/Ac, compresión positiva (44.2.3.1). La armadura comprimida solo descuenta con axil de
  // compresión y sin pasar de 0 (con N menor que A's·fyd no se puede suponer toda la armadura a fyd)
  const sigCd = NEd > 0 ? Math.max(0, (NEd * 1000 - Asc * fydLong) / x.Ac) : (NEd * 1000) / x.Ac;
  const sigCdLim = Math.min(sigCd, 0.3 * fcd, 12);
  const xi = Math.min(2, 1 + Math.sqrt(200 / d));
  const rhoBruta = (x.Asl ?? 0) / (x.b0 * x.d);
  const rho = Math.min(rhoBruta, RHO_MAX);
  const z = x.z ?? 0.9 * d;
  const f1cd = fck <= 60 ? 0.6 * fcd : Math.max(0.9 - fck / 200, 0.5) * fcd;
  return { fck, fcd, fctm, fyd, fydLibre, topada: fydLibre > FYD_TOPE, NEd, Asc, sigCd, sigCdLim, xi, rhoBruta, rho, rhoTopado: rhoBruta > RHO_MAX, z, f1cd, gc, b0, d };
}

/** Coeficiente K del esfuerzo axil (44.2.3.1). */
export function coefK(sigCd, fcd) {
  if (!(sigCd > 0)) return 1;
  const r = sigCd / fcd;
  if (r <= 0.25) return 1 + r;
  if (r <= 0.5) return 1.25;
  if (r <= 1) return 2.5 * (1 - r);
  return 0;
}

/**
 * cotg θe del método simplificado (44.2.3.2.2 a), acotado a [0,5; 2,0]. σxd y σyd son tensiones a nivel del
 * c.d.g. con la tracción positiva (como la norma); aquí entran con la compresión positiva y se cambian de signo.
 */
export function cotThetaE(fctm, sigX, sigY) {
  const sx = -sigX;
  const sy = -sigY;
  const rad2 = fctm * fctm - fctm * (sx + sy) + sx * sy;
  const v = Math.sqrt(Math.max(rad2, 0)) / (fctm - sy);
  return Math.min(COT_MAX, Math.max(COT_MIN, v));
}

/** β de la contribución del hormigón con armadura (44.2.3.2.2). */
export function coefBeta(cotTheta, cotE) {
  // cotθe = 0,5 o 2,0 anulan un denominador: allí el cociente vale 1 en el propio cotθe
  const den = cotTheta <= cotE ? 2 * cotE - 1 : cotE - 2;
  if (Math.abs(den) < 1e-12) return 1;
  const b = cotTheta <= cotE ? (2 * cotTheta - 1) / den : (cotTheta - 2) / den;
  return Math.min(1, Math.max(0, b));
}

/** Vu2 sin armadura de cortante en región fisurada (44.2.3.2.1.2), kN. */
export function Vu2SinArmadura(P) {
  const fcv = Math.min(P.fck, 60);
  const sig = 0.15 * P.sigCdLim;
  const conc = ((0.18 / P.gc) * P.xi * Math.cbrt(100 * P.rho * fcv)) + sig;
  const min = ((0.075 / P.gc) * Math.pow(P.xi, 1.5) * Math.sqrt(fcv)) + sig;
  return { Vu2: (Math.max(conc, min, 0) * P.b0 * P.d) / 1000, VcuConc: (Math.max(conc, 0) * P.b0 * P.d) / 1000, VcuMin: (Math.max(min, 0) * P.b0 * P.d) / 1000, minManda: min > conc };
}

/** Vcu con armadura de cortante (44.2.3.2.2), kN: la fórmula general lleva β; el mínimo, no (José Luis, 14/10). */
export function Vcu(P, beta) {
  const sig = 0.15 * P.sigCdLim;
  const conc = ((0.15 / P.gc) * P.xi * Math.cbrt(100 * P.rho * P.fck)) + sig;
  const min = ((0.075 / P.gc) * Math.pow(P.xi, 1.5) * Math.sqrt(P.fck)) + sig;
  const f = (P.b0 * P.d) / 1000;
  const c = Math.max(conc, 0) * beta * f;
  const m = Math.max(min, 0) * f;
  return { Vcu: Math.max(c, m), conc: c, min: m, minManda: m > c };
}

/** Separación longitudinal máxima entre cercos st (44.2.3.4.1), mm, según Vrd frente a Vu1. */
export function sepMaxima(Vrd, Vu1, d, alfa = 90) {
  const k = 1 + cot(alfa);
  if (Vrd <= Vu1 / 5) return Math.min(0.75 * d * k, 600);
  if (Vrd <= (2 / 3) * Vu1) return Math.min(0.6 * d * k, 450);
  return Math.min(0.3 * d * k, 300);
}

/** Armadura transversal mínima, mm²/mm: Σ Aα·fyα,d/senα ≥ fct,m/7,5·b0 (44.2.3.4.1). */
export function AswSMinima(P, alfa = 90) {
  return (P.fctm / 7.5 * P.b0 * Math.sin(rad(alfa))) / P.fyd;
}

/** Área de una rama de Ø mm y de n ramas por unidad de longitud con separación s. */
export const areaRama = (fi) => (Math.PI * fi * fi) / 4;
export const AswSDe = (fi, ramas, s) => (ramas * areaRama(fi)) / s;

/**
 * Comprobación a cortante. Con AswS = 0 o sinArmadura se calcula la pieza sin armadura de cortante (solo Vu2).
 * @param {DatosCortante & {VEd?: number, sinArmadura?: boolean}} x
 */
export function comprobar(x) {
  const P = parametros(x);
  const alfa = x.alfa ?? 90;
  const cotT = x.cotTheta ?? 1;
  if (!(cotT >= COT_MIN - 1e-9 && cotT <= COT_MAX + 1e-9)) throw new ErrorClave('cor.errCot', cotT);
  if (!(alfa >= 45 && alfa <= 90)) throw new ErrorClave('cor.errAlfa');
  const avisos = [];
  const VEd = x.VEd ?? NaN;
  if (P.topada) avisos.push({ clave: 'cor.av.fyd400', args: [P.fydLibre.toFixed(1)] });
  if (P.rhoTopado) avisos.push({ clave: 'cor.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (P.sigCd > 0.3 * P.fcd + 1e-9) avisos.push({ clave: 'cor.av.sigCd', args: [P.sigCd.toFixed(2), (0.3 * P.fcd).toFixed(2)] });
  if (P.sigCd < 0) avisos.push({ clave: 'cor.av.traccion' });
  if (P.sigCd > P.fcd) avisos.push({ clave: 'cor.av.axilGrande' });

  const sin = x.sinArmadura || !((x.AswS ?? 0) > 0);
  const K = coefK(P.sigCd, P.fcd);
  const cotA = cot(alfa);
  const fi = (cotT + cotA) / (1 + cotT * cotT);
  const Vu1 = (K * P.f1cd * P.b0 * P.d * fi) / 1000;
  const r = { P, K, Vu1, alfa, cotTheta: cotT, theta: (Math.atan(1 / cotT) * 180) / Math.PI, sinArmadura: sin, avisos, VEd };

  if (sin) {
    const s = Vu2SinArmadura(P);
    Object.assign(r, { Vu2: s.Vu2, VcuConc: s.VcuConc, VcuMin: s.VcuMin, minManda: s.minManda, Vsu: 0, Vcu: s.Vu2, beta: null, cotE: null, Vu: s.Vu2, mandaBiela: false });
    if (P.fck > 60) avisos.push({ clave: 'cor.av.fck60' });
    // 44.2.3.4.1: en elementos lineales debe disponerse armadura transversal efectiva
    avisos.push({ clave: 'cor.av.sinArm' });
  } else {
    const cotE = cotThetaE(P.fctm, P.NEd * 1000 / x.Ac, x.sigY ?? 0);
    const beta = coefBeta(cotT, cotE);
    const c = Vcu(P, beta);
    const reduc = x.circular ? REDUCCION_CIRCULAR : 1;
    const Vsu = (reduc * P.z * x.AswS * P.fyd * Math.sin(rad(alfa)) * (cotT + cotA)) / 1000;
    const Vu2 = c.Vcu + Vsu;
    Object.assign(r, { cotE, thetaE: (Math.atan(1 / cotE) * 180) / Math.PI, beta, Vcu: c.Vcu, VcuConc: c.conc, VcuMin: c.min, minManda: c.minManda, Vsu, reduc, Vu2, Vu: Math.min(Vu1, Vu2), mandaBiela: Vu1 < Vu2 });
    const mn = AswSMinima(P, alfa);
    r.minima = { AswSMin: mn, ok: x.AswS >= mn - 1e-12 };
    if (!r.minima.ok) avisos.push({ clave: 'cor.av.minima', args: [(x.AswS * 1000).toFixed(0), (mn * 1000).toFixed(0)] });
    if (alfa < 90) avisos.push({ clave: 'cor.av.tercio' });
  }
  if (Number.isFinite(VEd)) {
    r.aprov = VEd / r.Vu;
    r.sep = sepMaxima(VEd, Vu1, P.d, alfa);
    r.sepTrans = Math.min(P.d, 500);
    r.long = decalaje(VEd, r.Vsu, cotT, cotA, P.z);
  }
  return r;
}

/** ΔT y decalaje sd de la ley de momentos (44.2.3.4.2): ΔT = Vrd·cotθ − (Vsu/2)(cotθ + cotα); sd = z·ΔT/Vrd. */
export function decalaje(VEd, Vsu, cotT, cotA, z) {
  const dT = VEd * cotT - (Vsu / 2) * (cotT + cotA);
  return { dT, sd: VEd > 0 ? (dT * z) / VEd : 0 };
}

/**
 * Armadura transversal necesaria para VEd con el ángulo dado. Devuelve la necesaria por cálculo, la mínima
 * y la que manda, en mm²/mm.
 */
export function AswSNecesaria(x, VEd) {
  const c = comprobar({ ...x, VEd, AswS: 1e-6, sinArmadura: false });
  const P = c.P;
  const alfa = x.alfa ?? 90;
  const reduc = x.circular ? REDUCCION_CIRCULAR : 1;
  const unidad = (reduc * P.z * P.fyd * Math.sin(rad(alfa)) * (c.cotTheta + cot(alfa))) / 1000; // kN por mm²/mm
  const nec = Math.max(0, (VEd - c.Vcu) / unidad);
  const mn = AswSMinima(P, alfa);
  return { c, nec, mn, usar: Math.max(nec, mn), manda: nec >= mn ? 'calculo' : 'minima', Vcu: c.Vcu, Vu1: c.Vu1 };
}

/**
 * Dimensionamiento: armadura transversal para VEd (y tabla de cercos Ø × s).
 * @param {DatosCortante} x
 * @param {number} VEd
 * @param {{diametros?: number[], ramas?: number}} [o]
 */
export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20], ramas } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('cor.errVEd');
  const n = AswSNecesaria(x, VEd);
  const P = n.c.P;
  const alfa = x.alfa ?? 90;
  const sin = Vu2SinArmadura(P);
  const r = { P, VEd, Vu1: n.Vu1, Vcu: n.Vcu, AswSNec: n.nec, AswSMin: n.mn, AswS: n.usar, manda: n.manda, avisos: [...n.c.avisos.filter((a) => a.clave !== 'cor.av.minima')] };
  r.cotTheta = n.c.cotTheta; r.theta = n.c.theta; r.beta = n.c.beta; r.cotE = n.c.cotE; r.K = n.c.K; r.alfa = alfa;
  r.Vu2SinArm = sin.Vu2;
  if (VEd > n.Vu1) {
    r.caso = 'biela';
    return r;
  }
  r.caso = n.manda === 'minima' ? 'minima' : 'calculo';
  r.sinArmaduraBasta = VEd <= sin.Vu2;
  r.sMax = sepMaxima(VEd, n.Vu1, P.d, alfa);
  const sTope = Math.floor(Math.min(r.sMax, S_TABLA_MAX) / S_TABLA_PASO) * S_TABLA_PASO;
  const nr = ramas ?? (x.circular ? 2 : x.b0 < 500 ? 2 : 4);
  r.ramas = nr;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    const sOk = Math.floor(Math.min(sTope, (nr * Ab) / n.usar) / S_TABLA_PASO) * S_TABLA_PASO;
    if (sOk < S_TABLA_PASO) return { fi, ramas: nr, s: null };
    const AswS = AswSDe(fi, nr, sOk);
    const v = comprobar({ ...x, VEd, AswS, sinArmadura: false });
    return { fi, ramas: nr, s: sOk, AswS, Vsu: v.Vsu, Vu2: v.Vu2, Vu: v.Vu };
  });
  r.long = decalaje(VEd, (n.usar * P.z * P.fyd * Math.sin(rad(alfa)) * (n.c.cotTheta + cot(alfa)) * (x.circular ? REDUCCION_CIRCULAR : 1)) / 1000, n.c.cotTheta, cot(alfa), P.z);
  return r;
}

/**
 * cotg θ óptimo (rejilla de 0,01). Con VEd y armadura dada (comprobación) el que da mayor Vu = min(Vu1, Vu2);
 * en dimensionamiento (dim = true) el que pide menos armadura entre los que cumplen Vu1.
 */
export function cotOptimo(x, { VEd, dim = false } = {}) {
  let mejor = null;
  for (let c = COT_MIN; c <= COT_MAX + 1e-9; c += 0.01) {
    const cotTheta = Math.round(c * 100) / 100;
    let valor;
    try {
      if (dim) {
        const n = AswSNecesaria({ ...x, cotTheta }, VEd);
        if (VEd > n.Vu1) continue;
        valor = -n.usar;
      } else {
        valor = comprobar({ ...x, cotTheta, VEd }).Vu;
      }
    } catch { continue; }
    // A igualdad se prefiere el valor más cercano a 1 (45°)
    if (!mejor || valor > mejor.valor + 1e-9 || (Math.abs(valor - mejor.valor) <= 1e-9 && Math.abs(cotTheta - 1) < Math.abs(mejor.cotTheta - 1))) mejor = { cotTheta, valor };
  }
  return mejor?.cotTheta ?? 1;
}

/** Ángulo θ (°) de una cotg θ. */
export const thetaDe = (cotT) => (Math.atan(1 / cotT) * 180) / Math.PI;
