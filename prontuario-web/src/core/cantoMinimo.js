// Relación luz/canto útil por debajo de la cual no hace falta comprobar flechas (cálculo simplificado), una por norma:
//  · EHE-08, 50.2.2.1 (tabla 50.2.2.1.a y expresiones generales).
//  · EC-2 2004 + AN, 7.4.2 (ecuaciones 7.16.a/b, 7.17, tabla 7.4N; el AN adopta los K recomendados).
//  · EC-2 2023, 9.3.2 (tabla 9.3, con ωr y la proporción de sobrecarga).
// Quedan fuera los forjados de viguetas, las losas alveolares y las losas sobre apoyos aislados.
// Funciones puras. fck en MPa, cuantías en tanto por uno, luces en m.

import { ErrorClave } from './errores.js';

/** K de la tabla 50.2.2.1.a (EHE-08) y 7.4N (EC-2 2004): biapoyada, continua en un extremo, continua en ambos, voladizo. */
export const K = { biapoyada: 1.0, continuaUno: 1.3, continuaAmbos: 1.5, voladizo: 0.4 };

/**
 * Sistema estructural a efectos del canto mínimo. Un extremo se considera continuo si su momento es ≥ 85 % del de
 * empotramiento perfecto (EHE-08 50.2.2.1, nota 1). Con relIz/relDer = M/Mempotramiento de cada extremo (1 si el extremo está empotrado).
 * @param {'apoyo'|'empotramiento'|'libre'} izq
 * @param {'apoyo'|'empotramiento'|'libre'} der
 */
export function clasificarSistema(izq, der, relIz = 1, relDer = 1) {
  if (izq === 'libre' || der === 'libre') return 'voladizo';
  const continuo = (tipo, rel) => tipo === 'empotramiento' && rel >= 0.85;
  const n = continuo(izq, relIz) + continuo(der, relDer);
  return ['biapoyada', 'continuaUno', 'continuaAmbos'][n];
}

/**
 * l/d del EHE-08 (50.2.2.1) y del EC-2 2004 (7.16.a/b), que coinciden: K·[11 + 1,5√fck·ρ0/ρ + 3,2√fck·(ρ0/ρ − 1)^{3/2}] si ρ ≤ ρ0,
 * y K·[11 + 1,5√fck·ρ0/(ρ − ρ') + √fck/12·√(ρ'/ρ0)] si ρ > ρ0, con ρ0 = √fck·10⁻³.
 * Correcciones: ×0,8 con alas (b/bw > 3), ×310/σs, y solo EC-2: ×7/l o ×8,5/l con tabiques frágiles.
 * @param {Object} d
 * @param {number} d.fck
 * @param {number} d.rho  cuantía de tracción necesaria en centro de vano (en el arranque, voladizos)
 * @param {number} [d.rhoP=0]  cuantía de compresión necesaria
 * @param {'biapoyada'|'continuaUno'|'continuaAmbos'|'voladizo'} d.sistema
 * @param {number} [d.sigmaS]  tensión del acero en servicio (MPa); por defecto 310
 * @param {boolean} [d.alas=false]  ala/alma > 3
 */
export function relacionLuzCantoEC2(d) {
  const { fck, rho, rhoP = 0, sistema, sigmaS = 310, alas = false } = d;
  if (!(fck > 0) || !(rho > 0)) throw new ErrorClave('fle.err.cuantia');
  if (!(sistema in K)) throw new ErrorClave('fle.err.sistema');
  const raiz = Math.sqrt(fck);
  const rho0 = raiz * 1e-3;
  let r;
  if (rho <= rho0) r = 11 + (1.5 * raiz * rho0) / rho + 3.2 * raiz * Math.max(rho0 / rho - 1, 0) ** 1.5;
  else r = 11 + (1.5 * raiz * rho0) / (rho - rhoP) + (raiz / 12) * Math.sqrt(rhoP / rho0);
  let ld = K[sistema] * r * (310 / sigmaS);
  if (alas) ld *= 0.8;
  return ld;
}

/** Tensión del acero en servicio ≈ 310/σs = 500/fyk · As,nec/As,real (EHE-08 50.2.2.1; EC-2 7.17), devuelve σs en MPa. */
export const sigmaSEstimada = (fyk, AsNec, AsReal) => 310 / ((500 / fyk) * (AsNec / AsReal));

/** Corrección por tabiques frágiles (EC-2 2004 7.4.2(2)): vigas con l > 7 m (×7/l) y losas macizas con l > 8,5 m (×8,5/l). */
export const factorTabiques = (L, losa = false) => (losa ? (L > 8.5 ? 8.5 / L : 1) : L > 7 ? 7 / L : 1);

/* ---------------- EC-2 2023, tabla 9.3 ---------------- */

const OMEGA = [0.3, 0.2, 0.1];
const LL = [0.6, 0.45, 0.3];
/** Filas de la tabla 9.3: [ω = 0,3 | LL/TL 60, 45, 30 %], [ω = 0,2 | …], [ω = 0,1 | …]. */
const T93 = {
  biapoyada: [[15, 14, 12], [17, 15, 13], [22, 19, 17]],
  continuaUno: [[20, 18, 16], [22, 20, 17], [29, 25, 22]],
  continuaAmbos: [[23, 21, 18], [26, 23, 20], [33, 29, 26]],
  voladizo: [[7, 7, 6], [8, 7, 6], [10, 9, 8]],
};

function interp(xs, ys, x) {
  // xs puede ser decreciente: se trabaja sobre valores acotados al rango
  const lo = Math.min(xs[0], xs[xs.length - 1]), hi = Math.max(xs[0], xs[xs.length - 1]);
  const v = Math.min(hi, Math.max(lo, x));
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1], b = xs[i];
    if ((v - a) * (v - b) <= 0) return a === b ? ys[i] : ys[i - 1] + ((ys[i] - ys[i - 1]) * (v - a)) / (b - a);
  }
  return ys[ys.length - 1];
}

/**
 * l/d del EC-2 2023 (9.3.2, tabla 9.3), con interpolación bilineal y valores acotados a los de la tabla.
 * @param {Object} d
 * @param {number} d.omega  ωr = As,req/(bw·d)·fyd/fcd
 * @param {number} d.sobrecarga  LL/TL, proporción de sobrecarga frente a la carga total (0–1)
 * @param {'biapoyada'|'continuaUno'|'continuaAmbos'|'voladizo'} d.sistema
 * @param {number} [d.limite=250]  denominador a de la flecha total l/a (9.3.2(2): ×250/a)
 */
export function relacionLuzCanto2023({ omega, sobrecarga, sistema, limite = 250 }) {
  if (!(omega > 0)) throw new ErrorClave('fle.err.cuantia');
  if (!(sistema in T93)) throw new ErrorClave('fle.err.sistema');
  const porOmega = T93[sistema].map((fila) => interp(LL, fila, sobrecarga));
  return interp(OMEGA, porOmega, omega) * (250 / limite);
}

/** Cuantía mecánica ωr = ρ·fyd/fcd. */
export const omegaRequerida = (rho, fyd, fcd) => (rho * fyd) / fcd;
