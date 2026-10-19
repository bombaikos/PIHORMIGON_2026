// Diagrama de interacción N-M de una sección en rotura (flexión compuesta recta), con el motor
// seccional de src/core/seccion.js. Para cada axil busca el estado último (la máxima curvatura para
// la que existe un plano admisible que equilibra el axil) con momento positivo (comprime la cara
// superior) y con momento negativo. Unidades: kN, m. Aquí, como en todo el Prontuario, la
// compresión es positiva: N > 0 comprime; M > 0 comprime la cara superior.

import { esfuerzos, estadoUltimo, intervaloEpsSup } from './seccion.js';

/** Profundidad del c.d.g. del hormigón bruto (sin armaduras), respecto a la cara superior. */
export function centroBruto(sec) {
  let A = 0;
  let S = 0;
  for (const t of sec.trapecios) {
    const h = t.y2 - t.y1;
    const a = ((t.b1 + t.b2) / 2) * h;
    if (!(a > 0)) continue;
    A += a;
    S += a * (t.y1 + (h * (t.b1 + 2 * t.b2)) / (3 * (t.b1 + t.b2)));
  }
  return S / A;
}

/** Axiles extremos de la sección: compresión centrada (todo en ε = −εc2) y tracción pura (solo acero). */
export function axilesLimite(sec) {
  const [lo, hi] = intervaloEpsSup(sec, 0);
  return { Ncomp: -esfuerzos(sec, lo, 0, 0).N, Ntrac: -esfuerzos(sec, hi, 0, 0).N };
}

/**
 * Contorno de interacción. Devuelve dos ramas (M+ y M−) con puntos {N, M, x, epsSup, epsInf}, N y M
 * en el convenio del Prontuario, ordenados de compresión máxima a tracción máxima. M se toma respecto
 * al c.d.g. del hormigón bruto (yref).
 * @param {import('./seccion.js').Seccion} sec
 * @param {{n?: number, yref?: number}} [opc]  n = puntos por rama
 */
export function diagramaNM(sec, { n = 60, yref = centroBruto(sec) } = {}) {
  const { Ncomp, Ntrac } = axilesLimite(sec); // Ncomp > 0, Ntrac < 0
  const rama = (signo) => {
    // Extremos: compresión centrada y tracción pura (curvatura nula, sin estado último con κ ≠ 0)
    const [lo, hi] = intervaloEpsSup(sec, 0);
    const extremo = (eps) => { const r = esfuerzos(sec, eps, 0, yref); return { N: -r.N, M: r.M, x: eps < 0 ? Infinity : -Infinity, epsSup: eps, epsInf: eps, kappa: 0 }; };
    const pts = [extremo(lo)];
    for (let i = 1; i < n; i++) {
      // Más densidad cerca de los extremos
      const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
      const N = Ncomp + (Ntrac - Ncomp) * u;
      const e = estadoUltimo(sec, -N, { signo, yref });
      if (!e.converge) continue;
      pts.push({ N: -e.N, M: e.M, x: e.x, epsSup: e.epsSup, epsInf: e.epsInf, kappa: e.kappa });
    }
    pts.push(extremo(hi));
    return pts;
  };
  return { Ncomp, Ntrac, pos: rama(1), neg: rama(-1), yref };
}

/** Interpola linealmente M en una rama (puntos ordenados por N decreciente) para un axil N. */
function momentoEn(rama, N) {
  for (let i = 1; i < rama.length; i++) {
    const a = rama[i - 1];
    const b = rama[i];
    if (N <= a.N && N >= b.N) return a.N === b.N ? a.M : a.M + ((b.M - a.M) * (N - a.N)) / (b.N - a.N);
  }
  return NaN;
}

/**
 * Comprobación de un par (N_Ed, M_Ed). Devuelve el momento resistente al mismo axil (M_Rd, del lado del
 * signo de M_Ed) y el aprovechamiento por la recta que une el origen con el punto: |OP| / |OQ|, con Q
 * el corte con el contorno (≤ 1 cumple).
 */
export function comprobarNM(d, NEd, MEd) {
  const rama = MEd >= 0 ? d.pos : d.neg;
  const MRd = momentoEn(rama, NEd);
  if (!(NEd <= d.Ncomp && NEd >= d.Ntrac)) return { dentro: false, MRd: NaN, ratio: Infinity, Q: null };
  // Contorno cerrado: rama M+ de compresión a tracción y rama M− de vuelta
  const poli = [...d.pos, ...[...d.neg].reverse()].map((p) => [p.N, p.M]);
  let lam = Infinity;
  // Rayo O + t·(NEd, MEd): se busca el primer corte con el contorno
  for (let i = 0; i < poli.length; i++) {
    const [x1, y1] = poli[i];
    const [x2, y2] = poli[(i + 1) % poli.length];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const den = NEd * ey - MEd * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (x1 * ey - y1 * ex) / den;
    const u = (x1 * MEd - y1 * NEd) / den;
    if (t > 1e-12 && u >= -1e-9 && u <= 1 + 1e-9) lam = Math.min(lam, t);
  }
  const ratio = Number.isFinite(lam) ? 1 / lam : Infinity;
  return { dentro: ratio <= 1, MRd, ratio, Q: Number.isFinite(lam) ? [lam * NEd, lam * MEd] : null };
}
