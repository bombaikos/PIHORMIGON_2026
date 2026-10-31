// ELS ▸ Estado tensional: tensiones y deformaciones de una sección de forma cualquiera en servicio.
// Se apoya en el integrador de esviada.js (esfuerzosPlano: N, Mx, My de un plano de deformaciones) y le añade
//   · una ley de servicio del hormigón (Sargin del material, o lineal), con γC, αcc y φ como datos;
//   · la regla de estado: sección sin fisurar (con rama de tracción hasta fctm) o fisurada (sin tracción);
//   · tres formas de dar el estado: (N, Mx, My), (ε_cdg, κx, κy) y (ε_sup, β, x), y el paso entre ellas.
//
// Unidades del núcleo: kN y m (como el resto del motor). Deformaciones absolutas (no ‰), curvaturas en 1/m,
// ángulos en radianes; las tensiones del resultado van en MPa. La conversión a ‰ y grados es de la interfaz.
// Convención del Prontuario (como esviada.js): compresión positiva; x a la derecha, y hacia abajo;
//   Mx > 0 comprime la cara superior; My > 0 comprime la cara derecha; momentos respecto al c.d.g. del hormigón bruto.
// Plano de deformaciones (compresión +):  ε(x, y) = ε_cdg + ky·(x − xc) − kx·(y − yc)   (κ en 1/m, x e y en m).
// Dirección de la fibra más comprimida: u = (cos β, −sin β) en ejes x→, y↓ (β antihorario desde +x; β = 90° es la cara superior).
// ε_sup es la deformación en esa fibra y x la profundidad de la fibra neutra medida desde ella (x = ε_sup/|κ|; negativa
// si toda la sección está en tracción, infinita con deformación uniforme).
//
// Internamente los materiales siguen la convención de materiales.js (compresión negativa, kN/m²).

import { sigma, quiebros } from './materiales.js';
import { modeloEsviada, esfuerzosPlano } from './esviada.js';

/** Fuera de este rango de deformación la rama de compresión se mantiene plana (la ley de servicio no cae a 0 de golpe). */
const EPS_EXT = 0.05;
const SIN_TRACCION = [[0, 0], [0.0005, 0]];

// ---------------------------------------------------------------- leyes de servicio

/**
 * Leyes de servicio del hormigón a partir del material de la sección.
 * Cada punto (ε, σ) del diagrama del material pasa a (ε·(1+φ), σ·f): se estira el eje de deformaciones por (1+φ)
 * (fluencia, método del módulo efectivo) y se escalan las tensiones por f = αcc/γC (propiedades minoradas o características
 * según lo que ponga el usuario). Con la ley lineal el diagrama es una recta de pendiente f·Ecm/(1+φ).
 * Los diagramas de rotura parábola-rectángulo ya llevan αcc/γC dentro (fcd): no se les aplica f y se avisa.
 * La rama de tracción es elástica hasta fctm (σ = f·fctm en ε = (1+φ)·fctm/Ecm).
 * @param {Object} mat   hormigón de materiales.js (diag 'EC2', 'puntos' o 'PR')
 * @param {{gammaC:number, alfaCC:number, phi?:number, lineal?:boolean, fctm?:number}} o  fctm en MPa
 * @returns {{integra:Object, fisurada:Object, epsCr:number, factor:number, phi:number, pendiente:number, avisos:string[]}}
 *   integra: tracción elástica sin límite (para la prueba de fisuración); fisurada: sin tracción.
 */
export function leyServicio(mat, { gammaC, alfaCC, phi = 0, lineal = false, fctm } = {}) {
  if (!(mat?.E > 0)) throw new Error('El hormigón no tiene módulo de deformación');
  if (!(phi >= 0)) throw new Error('φ debe ser ≥ 0');
  const avisos = [];
  const pr = mat.diag !== 'EC2' && mat.diag !== 'puntos';
  if (pr) avisos.push('PR');
  if (lineal) avisos.push('lineal');
  let factor = 1;
  if (!pr) {
    if (!(gammaC > 0) || !(alfaCC > 0)) throw new Error('γC y αcc deben ser positivos');
    factor = alfaCC / gammaC;
  }
  const ft = fctm ?? (mat.tracc?.[1]?.[1] > 0 ? mat.tracc[1][1] / 1000 : undefined);
  if (!(ft > 0)) throw new Error('Falta fctm para la rama de tracción');
  const f1 = 1 + phi;
  const pendiente = (factor * mat.E) / f1; // módulo secante inicial del servicio [kN/m²]
  const epsCr = (ft * 1000 * f1) / mat.E; // deformación de fisuración (sobre la curva estirada)
  const comp = lineal
    ? [[0, 0], [-EPS_EXT, -pendiente * EPS_EXT]]
    : [...mat.comp.map(([e, s]) => [e * f1, s * factor])];
  if (!lineal) comp.push([-EPS_EXT, comp[comp.length - 1][1]]);
  const base = { tipo: 'hormigon', nombre: mat.nombre, E: mat.E, diag: lineal ? 'lineal' : mat.diag, roturaComp: false, roturaTracc: false, fk: mat.fk, gamma: 1, alfa: 1 };
  return {
    integra: { ...base, comp, tracc: [[0, 0], [1, pendiente]] },
    fisurada: { ...base, comp, tracc: SIN_TRACCION },
    epsCr, factor, phi, pendiente, avisos,
  };
}

/** Acero de servicio: elástico lineal con su módulo (sin plastificación: si σs supera fyk, el resultado lo dice el que lo lee). */
export function aceroServicio(mat) {
  const E = mat.E;
  return { tipo: 'acero', nombre: mat.nombre, E, fk: mat.fk, gamma: 1, alfa: 1, comp: [[0, 0], [-1, -E]], tracc: [[0, 0], [1, E]], roturaComp: false, roturaTracc: false };
}

// ---------------------------------------------------------------- modelo

/**
 * @param {Object} geo  geometría del proyecto (contornos, barras, franjas), como en modeloEsviada
 * @param {Object} hormigonMat  hormigón de materiales.js
 * @param {Object} aceroMat  acero de materiales.js
 * @param {{gammaC:number, alfaCC:number, phi?:number, lineal?:boolean, fctm:number}} o
 */
export function modeloTensional(geo, hormigonMat, aceroMat, o) {
  const ley = leyServicio(hormigonMat, o);
  const ac = aceroServicio(aceroMat);
  const mI = modeloEsviada(geo, ley.integra, ac);
  const mF = modeloEsviada(geo, ley.fisurada, ac);
  const pts = geo.contornos.flatMap((c) => (c.signo > 0 ? c.pts : []));
  return { ley, acero: ac, mI, mF, xc: mI.xc, yc: mI.yc, vertices: pts, puntos: mI.puntos, Ac: mI.Ac };
}

// ---------------------------------------------------------------- planos

/** Profundidad máxima del c.d.g. respecto de la fibra más comprimida en la dirección u: smax − u·c. */
function distanciaCdg(mod, bet) {
  const ux = Math.cos(bet);
  const uy = -Math.sin(bet);
  const smax = Math.max(...mod.vertices.map((p) => ux * p[0] + uy * p[1]));
  return smax - (ux * mod.xc + uy * mod.yc);
}

const eps = (mod, pl, x, y) => pl.e0 + pl.ky * (x - mod.xc) - pl.kx * (y - mod.yc); // compresión +

/** Esfuerzos (N, Mx, My) de un plano (e0, kx, ky) con el modelo de leyes dado (mI o mF). */
export function esfuerzosDe(m, mod, pl) {
  const k = Math.hypot(pl.kx, pl.ky);
  if (k < 1e-12) {
    const r = esfuerzosPlano(m, 0, -pl.e0, 0);
    return r;
  }
  const bet = Math.atan2(pl.kx, pl.ky);
  const theta = -bet; // esviada.js: u = (cos θ, sin θ) con y hacia abajo
  const eTop = pl.e0 + k * distanciaCdg(mod, bet); // compresión +, en la fibra más comprimida
  return esfuerzosPlano(m, theta, -eTop, k); // esviada: compresión negativa, κ por metro de profundidad
}

/** Plano (e0, kx, ky) a partir de (ε_sup, β, x). */
export function planoDeSup(mod, eSup, beta, x) {
  const g = x === Infinity || x === -Infinity ? 0 : eSup / x;
  if (g < 0 || !Number.isFinite(g)) return null; // ε_sup y x de signo contrario, o x = 0 con ε_sup ≠ 0
  const e0 = eSup - g * distanciaCdg(mod, beta);
  return { e0, kx: g * Math.sin(beta), ky: g * Math.cos(beta) };
}

// ---------------------------------------------------------------- inverso: (N, Mx, My) → plano

function resuelve3(J, r) {
  const M = [0, 1, 2].map((i) => [J[0][i], J[1][i], J[2][i], r[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-14) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const c = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= c * M[i][j];
    }
  }
  return [0, 1, 2].map((i) => M[i][3] / M[i][i]);
}

/**
 * Newton amortiguado sobre (ε_cdg, κx, κy), con las variables en ‰ y ‰/m para que estén bien escaladas.
 * @returns {{e0:number,kx:number,ky:number}|null} null si no hay equilibrio con esa ley.
 */
function equilibrio(m, mod, N, Mx, My, ini = { e0: 0, kx: 0, ky: 0 }) {
  const aPl = (q) => ({ e0: q[0] * 1e-3, kx: q[1] * 1e-3, ky: q[2] * 1e-3 });
  const R = (q) => {
    const r = esfuerzosDe(m, mod, aPl(q));
    return [r.N - N, r.Mx - Mx, r.My - My];
  };
  const norma = (r) => Math.hypot(r[0], r[1], r[2]);
  const tol = 1e-7 * (1 + Math.hypot(N, Mx, My));
  let q = [ini.e0 * 1e3, ini.kx * 1e3, ini.ky * 1e3];
  let r = R(q);
  for (let it = 0; it < 80; it++) {
    const nr = norma(r);
    if (nr < tol) return aPl(q);
    const h = 1e-4;
    const J = [0, 1, 2].map((j) => {
      const q2 = q.slice();
      q2[j] += h;
      const r2 = R(q2);
      return r2.map((a, i) => (a - r[i]) / h);
    });
    const d = resuelve3(J, r);
    if (!d) return null;
    let l = 1;
    let ok = false;
    for (let k = 0; k < 20; k++) {
      const q2 = q.map((a, i) => a - l * d[i]);
      const r2 = R(q2);
      if (norma(r2) < nr) {
        q = q2;
        r = r2;
        ok = true;
        break;
      }
      l /= 2;
    }
    if (!ok) return null;
  }
  return norma(r) < 1e-4 * (1 + Math.hypot(N, Mx, My)) ? aPl(q) : null;
}

// ---------------------------------------------------------------- estado completo

const sigmaC = (mat, e) => -sigma(mat, -e) / 1000; // compresión +, MPa

/** Tensiones extremas del hormigón en el rango de deformaciones [eMin, eMax] (compresión +), con los quiebros de la ley. */
function extremosHormigon(mat, eMin, eMax) {
  const cand = [eMin, eMax, ...quiebros(mat).map((e) => -e).filter((e) => e > eMin && e < eMax)];
  const s = cand.map((e) => sigmaC(mat, e));
  return { max: Math.max(...s), min: Math.min(...s) };
}

/**
 * Estado de la sección.
 * @param {Object} mod  modeloTensional(...)
 * @param {{tipo:'NM', N:number, Mx:number, My:number} | {tipo:'eK', e0:number, kx:number, ky:number} | {tipo:'sup', eSup:number, beta:number, x:number}} dato
 *   N en kN (compresión +), momentos en kN·m, deformaciones absolutas, κ en 1/m, β en rad, x en m.
 * @returns {{ok:boolean, motivo?:string, ...}}  con ok = true: plano (e0, kx, ky), N, Mx, My, eSup, eInf, beta, x,
 *   fisurada, tensiones del hormigón (sigmaMax compresión, sigmaMin tracción, MPa), barras [{x, y, eps, sigma}] y avisos.
 */
export function estadoTensional(mod, dato) {
  const intenta = (m) => {
    if (dato.tipo === 'eK') return { e0: dato.e0, kx: dato.kx, ky: dato.ky };
    if (dato.tipo === 'sup') return planoDeSup(mod, dato.eSup, dato.beta, dato.x);
    return equilibrio(m, mod, dato.N, dato.Mx, dato.My);
  };
  // Regla de estado: primero la sección íntegra (tracción elástica); si la tracción supera la de fisuración, sin tracción.
  let fisurada = false;
  let m = mod.mI;
  let pl = intenta(m);
  const traccion = (p) => -Math.min(...mod.vertices.map(([x, y]) => eps(mod, p, x, y)));
  if (!pl || traccion(pl) > mod.ley.epsCr * (1 + 1e-9)) {
    fisurada = true;
    m = mod.mF;
    pl = intenta(m);
  }
  if (!pl) return { ok: false, motivo: dato.tipo === 'sup' ? 'incompatible' : 'sin-equilibrio' };
  return compone(mod, m, pl, fisurada);
}

function compone(mod, m, pl, fisurada) {
  const k = Math.hypot(pl.kx, pl.ky);
  const es = mod.vertices.map(([x, y]) => eps(mod, pl, x, y));
  const eSup = Math.max(...es);
  const eInf = Math.min(...es);
  let beta = k < 1e-12 ? null : (Math.atan2(pl.kx, pl.ky) + 2 * Math.PI) % (2 * Math.PI);
  if (beta !== null && beta > 2 * Math.PI - 1e-9) beta = 0;
  const g = k;
  const x = k < 1e-12 ? (eSup >= 0 ? Infinity : -Infinity) : eSup / g;
  const fz = esfuerzosDe(m, mod, pl);
  const ext = extremosHormigon(m.hormigon, eInf, eSup);
  const barras = mod.puntos.map((p) => {
    const e = eps(mod, pl, p.x, p.y);
    return { x: p.x, y: p.y, A: p.A, eps: e, sigma: -sigma(mod.acero, -e) / 1000 };
  });
  const avisos = [...mod.ley.avisos];
  if (eSup > 0.0035 * (1 + mod.ley.phi)) avisos.push('eps-cu');
  return {
    ok: true, plano: pl, e0: pl.e0, kx: pl.kx, ky: pl.ky, N: fz.N, Mx: fz.Mx, My: fz.My,
    eSup, eInf, beta, x, fisurada, sigmaMax: ext.max, sigmaMin: ext.min, barras, avisos,
    n: mod.acero.E / (mod.ley.pendiente),
  };
}
