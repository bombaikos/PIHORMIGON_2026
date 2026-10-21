// Piezas comunes del rasante en juntas entre hormigones (las tres normas): tensión de cálculo, cuantía de cosido
// ρ = A_sw/(s·b) y tabla de dimensionamiento por diámetro. Unidades: MPa, mm y kN. Compresión positiva.
// Convenio: la junta tiene ancho de contacto b y longitud de comprobación L (área A_i = b·L); R_Ed es el esfuerzo
// rasante de cálculo sobre esa longitud (decisión de José Luis, 20/10/2026: se da directo, sin V_Ed·β/(z·b)).
// El cosido son `ramas` barras de Ø que cruzan la junta cada `s` mm a lo largo de L.

import { ErrorClave } from '../../core/errores.js';
import { areaRama } from '../cortante/ehe08.js';

export { areaRama };
/** Separación máxima de la tabla de dimensionamiento: criterio propio del Prontuario (como en Cortante). */
export const S_TABLA_MAX = 300;
export const S_TABLA_PASO = 25;
export const S_TABLA_MIN = 50;

const rad = (g) => (g * Math.PI) / 180;

/** Tensión rasante de cálculo, MPa: R_Ed (kN) repartida en la superficie de contacto b·L. */
export const tauDe = (REd, b, L) => (REd * 1000) / (b * L);
/** Esfuerzo (kN) que corresponde a una tensión en la superficie b·L. */
export const esfuerzoDe = (tau, b, L) => (tau * b * L) / 1000;

/** Cuantía de cosido ρ = A_sw/(s·b), con A_sw el área de las barras que cruzan la junta en cada separación s. */
export function rhoDe(arm, b) {
  if (!arm || !(arm.s > 0) || !(arm.ramas > 0) || !(arm.fi > 0)) return 0;
  return (arm.ramas * areaRama(arm.fi)) / (arm.s * b);
}

/** (μ·senα + cosα): factor de la armadura inclinada del cosido. */
export const factorAlfa = (mu, alfa) => mu * Math.sin(rad(alfa)) + Math.cos(rad(alfa));

/** Comprobaciones de datos comunes. */
export function validar(x) {
  if (!(x.fck > 0) || !(x.fykCosido > 0)) throw new ErrorClave('ras.errDatos');
  if (!(x.b > 0) || !(x.L > 0)) throw new ErrorClave('ras.errGeom');
}

/**
 * Tabla de dimensionamiento: para cada Ø y el nº de ramas pedido, la mayor separación (múltiplo de S_TABLA_PASO,
 * sin pasar de sMax ni de S_TABLA_MAX) que da una cuantía ≥ ρ necesaria. s = null si ni la mínima basta.
 */
export function tablaCosido(rhoNec, x, diametros, sMax = Infinity) {
  const tope = Math.min(S_TABLA_MAX, sMax);
  return diametros.map((fi) => {
    const Asw = x.ramas * areaRama(fi);
    const sReq = Asw / (rhoNec * x.b);
    let s = Math.floor(Math.min(sReq, tope) / S_TABLA_PASO) * S_TABLA_PASO;
    if (s < S_TABLA_MIN) s = null;
    return { fi, ramas: x.ramas, Asw, sReq, s, rho: s ? Asw / (s * x.b) : null, AswS: s ? (Asw / s) * 1000 : null };
  });
}

/** Ángulo del cosido dentro del intervalo permitido. */
export function comprobarAlfa(alfa, min, max) {
  if (!(alfa >= min - 1e-9 && alfa <= max + 1e-9)) throw new ErrorClave('ras.errAlfa', min, max);
}

/** Resuelve la cuantía mínima de una resistencia lineal en ρ: fijo + ρ·pend ≥ tau. */
export function rhoLineal(tau, fijo, pend) {
  if (tau <= fijo + 1e-12) return 0;
  return pend > 1e-12 ? (tau - fijo) / pend : Infinity;
}
