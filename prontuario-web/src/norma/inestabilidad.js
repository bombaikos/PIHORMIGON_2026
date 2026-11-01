// Inestabilidad de soportes aislados (efectos de segundo orden), un programa por norma:
//  - EHE-08, art. 43: α de 43.1.1, esbeltez límite de 43.1.2 y excentricidad ficticia de 43.5.1 (flexión recta).
//  - EC-2 2004 + AN: 5.8.3 (esbeltez y longitud eficaz), 5.8.4 (fluencia) y 5.8.8 (curvatura nominal).
//  - EC-2 2023: 7.4.2, Anexo O (O.5 a O.7), curvatura nominal.
// Núcleo puro y sin DOM. Unidades: m, kN, kN·m, kN/m² (como el resto del motor). Compresión positiva.
// Las fórmulas que no se han podido verificar contra el texto legible están en analisis/formulas-por-verificar.md.

import { flexibilidad } from '../core/pandeo.js';

/** Excentricidad mínima [m]: EHE-08 42.2.1 máx{h/20; 2 cm}; EC-2 6.1(4) y EC-2 2023 8.1.1(5) máx{h/30; 20 mm}. */
export const excentricidadMinima = (norma, h) => Math.max(h / (norma === 'EHE-08' ? 20 : 30), 0.02);

const sgn = (x) => (x < 0 ? -1 : 1);

/** Pone los momentos extremos en orden (|M02| ≥ |M01|) y no menores que N·e_mín (se conserva el signo). */
function extremos(N, Ma, Mb, emin) {
  const lift = (M) => (Math.abs(M) < N * emin - 1e-9 ? sgn(M) * N * emin : M);
  const a = lift(Ma);
  const b = lift(Mb);
  const [M01, M02] = Math.abs(a) > Math.abs(b) ? [b, a] : [a, b];
  return { M01, M02, rm: M01 / M02, subeMin: a !== Ma || b !== Mb };
}

/* ---------------------------------------------------------------- EHE-08 */

/** Factor de longitud de pandeo α (EHE-08 43.1.1), en función de Ψ_A y Ψ_B. Ψ infinito = extremo articulado. */
export function alfaEHE(psiA, psiB, traslacional) {
  const big = 1e9; // Ψ → ∞ sin producir NaN
  const a = Math.min(psiA, big);
  const b = Math.min(psiB, big);
  const s = a + b;
  const p = a * b;
  if (traslacional) return Math.sqrt((7.5 + 4 * s + 1.6 * p) / (7.5 + s));
  return (0.64 + 1.4 * s + 3 * p) / (1.28 + 2 * s + 3 * p);
}

/** Coeficiente C de la esbeltez límite (EHE-08 43.1.2) según la disposición de la armadura, a partir de β. */
export const coeficienteC = (beta) => (beta <= 1.25 ? 0.24 : beta <= 2.5 ? 0.2 : 0.16);

/** Esbeltez límite inferior de EHE-08 43.1.2 y del AN de EC-2 2004 (5.8.3.1): λ = 35·√(C/ν)·√(1 + 0,24/(e2/h) + 3,4·(e1/e2 − 1)²). POR VERIFICAR. */
export function esbeltezLimiteEHE({ nu, C, e2h, e1e2 }) {
  return 35 * Math.sqrt(C / nu) * Math.sqrt(1 + 0.24 / e2h + 3.4 * (e1e2 - 1) ** 2);
}

function calcularEHE(e, b) {
  const { N, h, A, I, As, is, dd, fcd, fyd, Es, L, traslacional } = e;
  const i = Math.sqrt(I / A);
  const alfa = alfaEHE(e.psiA, e.psiB, traslacional);
  const l0 = alfa * L;
  const lambda = l0 / i;
  const nu = N / (A * fcd);
  const omega = (As * fyd) / (A * fcd);
  const beta = is > 0 ? dd ** 2 / (4 * is ** 2) : 1;
  const C = coeficienteC(beta);
  const e2 = b.M02 / N;
  const e1 = b.M01 / N;
  const r1 = traslacional ? 1 : e1 / e2; // en estructuras traslacionales e1/e2 = 1 (43.1.2)
  const lamLim = esbeltezLimiteEHE({ nu, C, e2h: Math.abs(e2) / h, e1e2: r1 });
  const ee = traslacional ? Math.abs(e2) : Math.max(0.6 * Math.abs(e2) + 0.4 * e1 * sgn(e2), 0.4 * Math.abs(e2));
  const out = { l0, lambda, alfa, lamLim, nu, omega, beta, C, ee, rExc: r1, i };
  if (lambda > 200) return { ...out, metodo: 'fuera', MEd: NaN, M0eq: NaN };
  if (lambda > 100) return { ...out, metodo: 'general', MEd: NaN, M0eq: NaN };
  const M0eq = N * Math.max(ee, b.emin);
  if (lambda <= lamLim && !e.forzar) return { ...out, metodo: 'ninguno', segundoOrden: false, etot: Math.max(ee, b.emin), MEd: M0eq, M0eq };
  // 43.5.1: e_tot = e_e + e_a (la fluencia queda cubierta por e_a)
  const epsY = fyd / Es;
  const ea = (1 + 0.12 * beta) * (epsY + 0.0035) * ((h + 20 * ee) / (h + 10 * ee)) * (l0 ** 2 / (50 * i));
  const etot = Math.max(ee, b.emin) + ea;
  return { ...out, metodo: 'aproximado', segundoOrden: true, epsY, ea, etot, MEd: N * etot, M0eq };
}

/* ---------------------------------------------------------------- EC-2 (2004 + AN y 2023) */

/** Longitud eficaz (EC-2 5.8.3.2(3), fórmulas 5.15 y 5.16; EC-2 2023 O.9 y, provisionalmente, 5.16 para O.10). */
export function longitudEficaz(L, k1, k2, traslacional) {
  const f = (k) => (Number.isFinite(k) ? k / (1 + k) : 1);
  if (!traslacional) {
    const g = (k) => (Number.isFinite(k) ? 1 + k / (0.45 + k) : 2);
    return 0.5 * L * Math.sqrt(g(k1) * g(k2));
  }
  const prodSuma = Number.isFinite(k1) && Number.isFinite(k2) ? (k1 * k2) / (k1 + k2) : Number.isFinite(k1) ? k1 : Number.isFinite(k2) ? k2 : Infinity;
  const a = Number.isFinite(prodSuma) ? Math.sqrt(1 + 10 * prodSuma) : Infinity;
  return L * Math.max(a, (1 + f(k1)) * (1 + f(k2)));
}

/** Coeficiente de fluencia eficaz φef (EC-2 5.8.4(2), EC-2 2023 7.4.2(3)): φ∞ por la proporción de carga permanente. */
export function fluenciaEficaz({ phiInf, pPerm, lambda, M0, N, h }) {
  // EC-2 5.8.4(4): se puede ignorar si φ∞ ≤ 2, λ ≤ 75 y M0Ed/NEd ≤ h
  const ignorable = phiInf <= 2 && lambda <= 75 && Math.abs(M0) / N <= h;
  return { phiEf: ignorable ? 0 : phiInf * pPerm, ignorable };
}

function calcularEC2(e, b, v2023) {
  const { N, h, A, I, As, is, dd, fcd, fyd, Es, L, traslacional, fck } = e;
  const i = Math.sqrt(I / A);
  const k1 = flexibilidad(e.psiA, traslacional);
  const k2 = flexibilidad(e.psiB, traslacional);
  const l0 = longitudEficaz(L, k1, k2, traslacional);
  const lambda = l0 / i;
  const n = N / (A * fcd);
  const omega = (As * fyd) / (A * fcd);
  const beta = is > 0 ? dd ** 2 / (4 * is ** 2) : 1;
  const C = coeficienteC(beta);
  const braced = !traslacional;
  const M0 = braced ? Math.max(0.6 * b.M02 + 0.4 * b.M01, 0.4 * b.M02) : b.M02; // M0e (5.32); en traslacionales, el mayor
  const fl = fluenciaEficaz({ phiInf: e.phiInf, pPerm: e.pPerm, lambda, M0, N, h });
  // forzar: la curva del diagrama no salta cuando la norma permitiría despreciar la fluencia (5.8.4(4)) o el segundo orden
  const ignorable = e.forzar ? false : fl.ignorable;
  const phiEf = e.forzar ? e.phiInf * e.pPerm : fl.phiEf;
  const out = { l0, lambda, k1, k2, n, omega, beta, C, phiEf, fluenciaIgnorable: ignorable, i, M0 };
  let lamLim;
  if (v2023) {
    // O.6: λlim = 20·A·B·C/√n con A = 1/(1+0,2·φef), B = √(1+2ω), C = 1,7 − rm (rm = 1 en traslacionales)
    const rm = braced ? b.rm : 1;
    const Cc = 1.7 - rm;
    lamLim = (20 * (1 / (1 + 0.2 * phiEf)) * Math.sqrt(1 + 2 * omega) * Cc) / Math.sqrt(n);
    Object.assign(out, { rmUsado: rm, Clim: Cc });
  } else {
    const e2 = b.M02 / N;
    const r1 = traslacional ? 1 : b.M01 / b.M02;
    lamLim = esbeltezLimiteEHE({ nu: n, C, e2h: Math.abs(e2) / h, e1e2: r1 });
  }
  out.lamLim = lamLim;
  if (lambda > 200) return { ...out, metodo: 'fuera', MEd: NaN, M0eq: NaN };
  if (lambda <= lamLim && !e.forzar) { const M = Math.max(Math.abs(b.M02), N * b.emin); return { ...out, metodo: 'ninguno', segundoOrden: false, MEd: M, M0eq: M }; }
  // Curvatura nominal
  const epsYd = fyd / Es;
  const ddEf = v2023 ? (e.forma === 'circular' ? 2 * is : h / 2 + is) : null; // O.20; en 5.8.8.3(2) d = h/2 + i_s
  const d = h / 2 + is;
  const r0 = v2023 ? (2 * epsYd) / ddEf : epsYd / (0.45 * d);
  const nu = 1 + omega;
  const Kr = Math.min((nu - n) / (nu - 0.4), 1);
  const betaFck = 0.35 + fck / 200 - lambda / 150;
  const Kphi = Math.max(1 + betaFck * phiEf, 1);
  const curv = Kr * Kphi * r0;
  // c = 10, y hasta 8 si el momento de primer orden es constante (5.8.8.2(4)); se interpola con r_m para que el contorno no tenga saltos
  const cc = v2023 ? (braced ? 8 : 10) : (braced ? 10 - 2 * Math.min(Math.max(b.rm, 0), 1) : 10);
  const e2 = (curv * l0 ** 2) / cc;
  const M2 = N * e2;
  let MEd;
  let Cm = null;
  if (v2023) {
    const rm = Math.abs(b.M02) < 0.05 * N * h ? 1 : b.rm;
    Cm = Math.max(0.6 + 0.4 * rm, 0.4);
    const M0Ed = braced ? Cm * b.M02 : b.M02;
    MEd = Math.max(M0Ed + M2, Math.abs(b.M02));
    out.M0 = M0Ed;
  } else {
    MEd = Math.max(M0 + M2, Math.abs(b.M02));
  }
  const M0eq = Math.max(out.M0, N * b.emin);
  return { ...out, metodo: 'curvatura', segundoOrden: true, epsYd, r0, d, Kr, Kphi, betaFck, curv, c: cc, e2, M2, Cm, MEd: Math.max(MEd, N * b.emin), M0eq };
}

/* ---------------------------------------------------------------- Entrada común */

/**
 * @param {Object} e
 * @param {'EHE-08'|'EC2-2004'|'EC2-2023'} e.norma
 * @param {number} e.L altura libre [m]
 * @param {boolean} e.traslacional
 * @param {number} e.psiA @param {number} e.psiB  relaciones de rigidez en los extremos (Infinity = articulado)
 * @param {number} e.h canto en el plano de flexión [m]; e.A área [m²]; e.I inercia [m⁴]
 * @param {number} e.As área total de armadura [m²]; e.is radio de giro de la armadura [m]; e.dd distancia entre barras extremas [m]
 * @param {number} e.fck [MPa]; e.fcd, e.fyd, e.Es [kN/m²]
 * @param {number} e.N axil de cálculo [kN] (compresión positiva); e.M1, e.M2 momentos en los extremos [kN·m] con su signo
 * @param {number} e.phiInf φ(∞,t0) @param {number} e.pPerm proporción de la carga que es permanente (0–1)
 * @param {boolean} [e.forzar] calcula siempre el segundo orden (sin el criterio de esbeltez límite ni la excepción de fluencia): el contorno reducido es continuo, como en el 3.1
 */
export function calcularInestabilidad(e) {
  const avisos = [];
  if (!(e.N > 0)) return { valido: false, motivo: 'traccion', avisos };
  const emin = excentricidadMinima(e.norma, e.h);
  const b = { ...extremos(e.N, e.M1, e.M2, emin), emin };
  if (b.subeMin) avisos.push({ clave: 'ine.av.eMin', args: [emin * 1000] });
  const r = e.norma === 'EHE-08' ? calcularEHE(e, b) : calcularEC2(e, b, e.norma === 'EC2-2023');
  if (r.metodo === 'general') avisos.push({ clave: 'ine.av.general' });
  if (r.metodo === 'fuera') avisos.push({ clave: 'ine.av.fuera' });
  if (e.norma === 'EC2-2023' && e.traslacional) avisos.push({ clave: 'ine.av.O10' });
  return { valido: true, norma: e.norma, N: e.N, ...b, ...r, avisos };
}

/**
 * Contorno N–M reducido por los efectos de segundo orden: a cada punto (N, M_Rd) del contorno de la sección se le resta el
 * momento de segundo orden ΔM = M_Ed − M0eq que corresponde a ese axil (con los mismos momentos extremos y la misma geometría).
 * Un punto (N, M0eq) dentro del contorno reducido equivale a M_Ed ≤ M_Rd. Donde el método no se puede aplicar (esbeltez
 * mayor de 100 en EHE-08 o de 200) o el axil no es de compresión, no hay reducción y el punto se devuelve con ΔM = 0 y `ok: false`.
 * @param {Object} e  la misma entrada que calcularInestabilidad
 * @param {{N:number, M:number}[]} rama  contorno M ≥ 0 de la sección
 */
export function contornoReducido(e, rama) {
  return rama.map((p) => {
    if (!(p.N > 0)) return { N: p.N, M: p.M, dM: 0, ok: false };
    const r = calcularInestabilidad({ ...e, N: p.N });
    if (!r.valido || !Number.isFinite(r.MEd)) return { N: p.N, M: p.M, dM: 0, ok: false };
    const dM = Math.max(r.MEd - r.M0eq, 0);
    return { N: p.N, M: Math.max(p.M - dM, 0), dM, ok: true };
  });
}
