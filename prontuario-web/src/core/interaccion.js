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
 * @param {{n?: number, yref?: number, simetrica?: boolean, tol?: number}} [opc]  n = puntos por rama; simetrica: solo se calcula M+;
 *   tol > 0: refinamiento adaptativo, se parte cada tramo hasta que la recta no se separe de la curva más de tol·M_máx
 */
export function diagramaNM(sec, { n = 60, yref = centroBruto(sec), simetrica = false, tol = 0 } = {}) {
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
    if (!(tol > 0)) return pts;
    // Refinamiento adaptativo: se añade el punto medio de cada tramo (en N) mientras se separe de la cuerda
    const lim = tol * Math.max(...pts.map((v) => Math.abs(v.M)), 1e-9);
    const medio = (a, b) => {
      const N = (a.N + b.N) / 2;
      const e = estadoUltimo(sec, -N, { signo, yref });
      return e.converge ? { N: -e.N, M: e.M, x: e.x, epsSup: e.epsSup, epsInf: e.epsInf, kappa: e.kappa } : null;
    };
    const afinar = (a, b, prof) => {
      if (prof >= 11 || Math.abs(a.N - b.N) < 1e-3) return [];
      const m = medio(a, b);
      if (!m || Math.abs(m.M - (a.M + b.M) / 2) <= lim) return [];
      return [...afinar(a, m, prof + 1), m, ...afinar(m, b, prof + 1)];
    };
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) out.push(...afinar(pts[i - 1], pts[i], 0), pts[i]);
    return out;
  };
  const pos = rama(1);
  // Con armadura simétrica respecto al eje de flexión la rama M− es la M+ cambiada de signo
  const neg = simetrica ? pos.map((v) => ({ ...v, M: -v.M, epsSup: v.epsInf, epsInf: v.epsSup, kappa: -v.kappa })) : rama(-1);
  return { Ncomp, Ntrac, pos, neg, yref };
}

/** Interpola linealmente M en una rama (puntos ordenados por N decreciente) para un axil N. */
export function momentoEn(rama, N) {
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

/** Coeficiente de seguridad a excentricidad constante: |OQ| / |OP| (≥ 1 cumple; 0 si el axil supera la capacidad). */
export function coeficienteNM(d, NEd, MEd) {
  if (NEd === 0 && MEd === 0) return Infinity;
  const r = comprobarNM(d, NEd, MEd);
  return r.ratio > 0 && Number.isFinite(r.ratio) ? 1 / r.ratio : 0;
}

/** Copia de la sección con la armadura multiplicada por k (la disposición se mantiene). */
export const escalarArmadura = (sec, k) => ({ ...sec, barras: sec.barras.map((b) => ({ ...b, A: b.A * k })) });

/** Sección sin armadura: contorno del hormigón solo. */
export const soloHormigon = (sec) => ({ ...sec, barras: [] });

/**
 * Dimensionamiento: menor factor k de la armadura dada (misma disposición) con el que todos los pares
 * (N, M) quedan dentro del contorno con coeficiente ≥ gamma. Devuelve k, 0 si basta sin armadura, o
 * Infinity si no se alcanza con k ≤ kMax.
 * @param {import('./seccion.js').Seccion} sec  con la armadura de referencia (k = 1)
 * @param {[number, number][]} pares
 */
export function dimensionarNM(sec, pares, { gamma = 1, kMax = 40, n = 60, simetrica = false } = {}) {
  const ok = (k) => {
    const d = diagramaNM(escalarArmadura(sec, k), { n, simetrica });
    return pares.every(([N, M]) => coeficienteNM(d, N, M) >= gamma - 1e-9);
  };
  if (ok(0)) return 0;
  if (!ok(kMax)) return Infinity;
  let lo = 0;
  let hi = kMax;
  for (let i = 0; i < 28 && hi - lo > 1e-4 * hi; i++) {
    const m = (lo + hi) / 2;
    if (ok(m)) hi = m; else lo = m;
  }
  return hi;
}
