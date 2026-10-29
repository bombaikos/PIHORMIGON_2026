// Rasante en juntas entre hormigones según la EHE-08, art. 47 (47.2.1 sin cosido; 47.2.2.1 y 47.2.2.2 con cosido,
// dos estados). Sustituye a TT5 del Prontuario 3.1, que es la formulación de la EHE-98 (una sola ecuación).
// Unidades: MPa, mm y kN. Compresión positiva. Textos: analisis/normativa/ehe-08/texto.txt, art. 47 (l.11459-11720).
//
// Lo que el texto extraído no deja leer y se ha deducido (VERIFICAR contra el BOE, analisis/formulas-por-verificar.md):
//  · 47.2.1: el factor (1,30 − 0,30·fck/25) se acota por abajo en 0,70 (hasta HA-50 coincide con la fórmula sin acotar).
//  · 47.2.2.1 / 47.2.2.2: el primer estado vale si τ_rd ≤ 2,5·β(1,30 − 0,30·fck/25)·f_ct,d; tabla 47.2.2.2: β 0,2/0,4
//    y μ 0,3/0,6 (1.er estado) o 0,6/0,9 (2.º). Cola de milano: β = 0,8 (47.2.1) con los μ de rugosidad alta.
//  · Límite superior de los dos estados: 0,25·f_cd.

import { EHE08 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { tauDe, esfuerzoDe, rhoDe, factorAlfa, validar, tablaCosido, comprobarAlfa, rhoLineal } from './comun.js';

export const ID = 'EHE-08';
export const RHO_MIN = 0.001;
/** Tope de f_yα,d del cosido (art. 40.2 y comentarios; mismo criterio que Cortante). */
export const FYD_TOPE = 400;
export const ALFA_MIN = 45;
export const ALFA_MAX = 135;
/** Espesor medio mínimo de cada hormigón y mínimo local (47.2). */
export const ESP_MIN = 50;
export const ESP_LOCAL = 30;
export const RUGOSIDADES = {
  baja: { beta: 0.2, mu1: 0.3, mu2: 0.6 },
  alta: { beta: 0.4, mu1: 0.6, mu2: 0.9 },
  cola: { beta: 0.8, mu1: 0.6, mu2: 0.9 },
};
export const RUGOSIDAD_DEFECTO = 'alta';

/** Valores derivados comunes. */
export function parametros(x) {
  validar(x);
  const R = RUGOSIDADES[x.rug];
  if (!R) throw new ErrorClave('ras.errRug');
  if (x.fck > EHE08.fckMax) throw new ErrorClave('ras.errFck', EHE08.fckMax);
  const alfa = x.alfa ?? 90;
  comprobarAlfa(alfa, ALFA_MIN, ALFA_MAX);
  const gc = EHE08.gammaC;
  const fcd = (EHE08.alfaCC() * x.fck) / gc;
  const fctd = EHE08.fctk05(x.fck) / gc;
  const fydLibre = x.fykCosido / EHE08.gammaS;
  const fyd = Math.min(fydLibre, FYD_TOPE);
  const sigN = x.sigN ?? 0;
  const factor = Math.max(0.7, 1.3 - (0.3 * x.fck) / 25);
  const tracc = sigN < 0;
  // Cohesión β·(1,30 − 0,30·fck/25)·f_ct,d: nula con tracción normal; la mitad con cargas de fatiga o dinámicas
  const coh = tracc ? 0 : R.beta * factor * fctd * (x.fatiga ? 0.5 : 1);
  return { fck: x.fck, fcd, fctd, fyd, fydLibre, topada: fydLibre > FYD_TOPE, sigN, tracc, R, factor, coh, alfa, lim: 0.25 * fcd, gc };
}

/**
 * Resistencia a rasante, MPa, para una cuantía ρ y una tensión de cálculo τ_rd (que decide el estado).
 * estado 0 = sin cosido contabilizable (47.2.1), 1 = cohesión + cosido con μ bajo (47.2.2.1), 2 = solo cosido (47.2.2.2).
 */
export function resistencia(P, rho, tauEd) {
  if (!(rho >= RHO_MIN)) return { estado: 0, tauRd: P.coh, coh: P.coh, fric: 0, cosido: 0, mu: null, lim: P.lim, limita: false, contabiliza: false };
  const estado = tauEd <= 2.5 * P.coh ? 1 : 2;
  const mu = estado === 1 ? P.R.mu1 : P.R.mu2;
  const coh = estado === 1 ? P.coh : 0;
  const cosido = rho * P.fyd * factorAlfa(mu, P.alfa);
  const fric = mu * P.sigN;
  const suma = Math.max(0, coh + cosido + fric);
  return { estado, tauRd: Math.min(suma, P.lim), suma, coh, fric, cosido, mu, lim: P.lim, limita: suma > P.lim, contabiliza: true };
}

/** Separación máxima del cosido (47.3): mín(canto de la sección compuesta; 4 × menor espesor; 600 mm). */
export function sepMaxima(x) {
  const c = [600];
  if (x.h > 0) c.push(x.h);
  if (x.emin > 0) c.push(4 * x.emin);
  return Math.min(...c);
}

function avisos(x, P, rho, sinArm) {
  const a = [];
  if (P.tracc) a.push({ clave: 'ras.av.traccion', args: [] });
  if (!sinArm && !(rho >= RHO_MIN)) a.push({ clave: 'ras.av.rhoMin', args: [rho * 1000, RHO_MIN * 1000] });
  if (x.emin > 0 && x.emin < ESP_MIN) a.push({ clave: x.emin >= ESP_LOCAL ? 'ras.av.espLocal' : 'ras.av.espesor', args: [x.emin, ESP_MIN, ESP_LOCAL] });
  const sMax = sepMaxima(x);
  if (!sinArm && x.arm?.s > sMax) a.push({ clave: 'ras.av.sep', args: [x.arm.s, sMax] });
  return a;
}

/** Comprobación de una junta con (o sin) cosido. */
export function comprobar(x) {
  const P = parametros(x);
  const sinArm = !!x.sinArmadura;
  const rho = sinArm ? 0 : rhoDe(x.arm, x.b);
  const tauEd = tauDe(x.REd, x.b, x.L);
  const r = resistencia(P, rho, tauEd);
  const Ru = esfuerzoDe(r.tauRd, x.b, x.L);
  const aprov = r.tauRd > 0 ? tauEd / r.tauRd : Infinity;
  const manda = r.limita ? 'limite' : r.contabiliza ? 'cosido' : 'cohesion';
  return { P, tauEd, tauRd: r.tauRd, Ru, REd: x.REd, Rmax: esfuerzoDe(P.lim, x.b, x.L), aprov, rho, res: r, manda, formula: r.estado === 1 ? '47.2.2.1' : r.estado === 2 ? '47.2.2.2' : '47.2.1', sMax: sepMaxima(x), avisos: avisos(x, P, rho, sinArm), norma: ID };
}

/**
 * Dimensionado: la cuantía ρ del cosido (y, por Ø, la separación) que resiste R_Ed.
 * caso: 'limite' (supera 0,25·f_cd), 'sin' (basta la cohesión, 47.2.1) o 'calculo'.
 */
export function dimensionar(x, REd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  const P = parametros(x);
  const tauEd = tauDe(REd, x.b, x.L);
  const base = { P, tauEd, REd, Rmax: esfuerzoDe(P.lim, x.b, x.L), norma: ID, sMax: sepMaxima(x), avisos: avisos(x, P, 0, true) };
  if (tauEd > P.lim + 1e-12) return { ...base, caso: 'limite' };
  if (tauEd <= P.coh + 1e-12) return { ...base, caso: 'sin', tauSin: P.coh };
  const estado = tauEd <= 2.5 * P.coh ? 1 : 2;
  const mu = estado === 1 ? P.R.mu1 : P.R.mu2;
  const fijo = (estado === 1 ? P.coh : 0) + mu * P.sigN;
  const pend = P.fyd * factorAlfa(mu, P.alfa);
  const rhoCalc = rhoLineal(tauEd, fijo, pend);
  if (!Number.isFinite(rhoCalc)) return { ...base, caso: 'limite' };
  const rhoNec = Math.max(rhoCalc, RHO_MIN);
  return { ...base, caso: 'calculo', estado, mu, rhoCalc, rhoNec, minimaManda: rhoCalc < RHO_MIN, AswSNec: rhoNec * x.b * 1000, tabla: tablaCosido(rhoNec, x, diametros, base.sMax) };
}
