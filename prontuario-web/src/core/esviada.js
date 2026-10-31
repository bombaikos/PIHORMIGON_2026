// Flexión compuesta esviada (N, Mx, My) en rotura. Mismo método que calcomun.pas del Prontuario 3.1 («esviada por β»):
// para cada dirección de la fibra más comprimida se gira la sección, se busca el estado último con el motor
// seccional de src/core/seccion.js (plano de deformaciones que equilibra N con la máxima curvatura) y se integran
// los esfuerzos en dos direcciones. El lugar de los (Mx, My) últimos a N constante es el contorno de interacción.
// Unidades: kN, m. Compresión positiva en todo el Prontuario: N > 0 comprime.
// Ejes de la sección: x hacia la derecha, y hacia abajo (como la geometría del proyecto).
//   Mx > 0 comprime la cara superior (momento respecto al eje horizontal)
//   My > 0 comprime la cara derecha (momento respecto al eje vertical)
// Momentos respecto al c.d.g. del hormigón bruto.

import { sigma, quiebros } from './materiales.js';
import { estadoUltimo } from './seccion.js';
import { axilesLimite } from './interaccion.js';
import { cortesEn, trapecios } from './geometria.js';

const GL = [[-Math.sqrt(3 / 5), 5 / 9], [0, 8 / 9], [Math.sqrt(3 / 5), 5 / 9]];
const GRAD = Math.PI / 180;

/**
 * Modelo de cálculo a partir de la geometría del proyecto.
 * @param {Object} geo  geometria(s): contornos [{pts, signo}], barras [{x,y,A}], franjas [{y,A,x1,x2}], caja
 * @param {Object} hormigon  material del motor
 * @param {Object} acero  material del motor
 * @param {number} [k]  factor de escala de la armadura (Dimensionar)
 */
export function modeloEsviada(geo, hormigon, acero, k = 1) {
  const puntos = geo.barras.map((b) => ({ x: b.x, y: b.y, A: b.A * k }));
  // Una franja (armadura dada como área) se reparte en varios puntos a lo largo de su ancho
  for (const f of geo.franjas ?? []) {
    const n = 11;
    for (let i = 0; i < n; i++) puntos.push({ x: f.x1 + ((i + 0.5) * (f.x2 - f.x1)) / n, y: f.y, A: (f.A * k) / n });
  }
  // C.d.g. del hormigón bruto (con huecos)
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  for (const c of geo.contornos) {
    const p = c.pts;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      const cr = x1 * y2 - x2 * y1;
      A += (c.signo * cr) / 2;
      Sx += (c.signo * cr * (x1 + x2)) / 6;
      Sy += (c.signo * cr * (y1 + y2)) / 6;
    }
  }
  const sg = Math.sign(A) || 1;
  const xc = Sx / A;
  const yc = Sy / A;
  const epsC2 = -hormigon.comp.find((p) => p[1] === Math.min(...hormigon.comp.map((q) => q[1])))[0];
  return { contornos: geo.contornos, puntos, hormigon, acero, xc, yc, epsC2, Ac: Math.abs(A), As: puntos.reduce((a, b) => a + b.A, 0), sg };
}

/** Giro: la fibra comprimida está en la dirección u = (cos θ, sin θ) de ejes x→, y↓. Devuelve las magnitudes del giro. */
function giro(m, theta) {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const vx = -uy;
  const vy = ux;
  const verts = m.contornos[0].pts;
  const s = verts.map((p) => ux * p[0] + uy * p[1]);
  const smax = Math.max(...s);
  const smin = Math.min(...s);
  return { ux, uy, vx, vy, smax, h: smax - smin };
}

/** Sección unidimensional del motor, girada: y = profundidad desde la fibra más comprimida en la dirección u. */
function seccionGirada(m, g) {
  const cs = m.contornos.map((c) => ({ signo: c.signo, pts: c.pts.map(([x, y]) => [g.vx * x + g.vy * y, g.smax - (g.ux * x + g.uy * y)]) }));
  return {
    trapecios: trapecios(cs).map((t) => ({ ...t, mat: m.hormigon })),
    barras: m.puntos.map((p) => ({ y: g.smax - (g.ux * p.x + g.uy * p.y), A: p.A, mat: m.acero })),
    h: g.h,
    epsC2: m.epsC2,
  };
}

/**
 * Esfuerzos de un plano de deformación (eps0 en la fibra comprimida, curvatura κ por metro de profundidad):
 * N y los momentos Mx, My respecto al c.d.g. del hormigón. Integra el hormigón por tramos entre vértices y quiebros.
 */
export function esfuerzosPlano(m, theta, eps0, kappa) {
  const g = giro(m, theta);
  const eps = (t) => eps0 + kappa * t;
  let F = 0; // compresión positiva
  let Fy = 0; // ∫ f·y dA
  let Fx = 0; // ∫ f·x dA
  // Cortes en profundidad t: vértices y quiebros del diagrama del hormigón
  const tv = new Set();
  const tof = (p) => g.smax - (g.ux * p[0] + g.uy * p[1]);
  for (const c of m.contornos) for (const p of c.pts) tv.add(tof(p));
  const ts = [...tv];
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const cortes = new Set(ts.map((v) => +v.toFixed(12)));
  if (kappa !== 0) for (const e of quiebros(m.hormigon)) { const t = (e - eps0) / kappa; if (t > t0 && t < t1) cortes.add(+t.toFixed(12)); }
  const lista = [...cortes].sort((a, b) => a - b);
  for (let i = 1; i < lista.length; i++) {
    const a = lista[i - 1];
    const b = lista[i];
    if (b - a <= 1e-14) continue;
    const mid = (a + b) / 2;
    const half = (b - a) / 2;
    for (const [xi, w] of GL) {
      const t = mid + half * xi;
      const f = -sigma(m.hormigon, eps(t));
      if (f === 0) continue;
      // Tramos del hormigón a esa profundidad, en ejes (x' = v·p, t): se vuelve a ejes de la sección
      const p0 = g.smax - t; // u·p
      let ancho = 0;
      let mom = 0; // ∫ x' dx'
      for (const c of m.contornos) {
        // Corte del polígono con la recta u·p = p0, en coordenadas (x', t) del polígono girado
        const rot = c.pts.map(([x, y]) => [g.vx * x + g.vy * y, g.smax - (g.ux * x + g.uy * y)]);
        for (const [xa, xb] of cortesEn(rot, t)) { ancho += c.signo * (xb - xa); mom += (c.signo * (xb * xb - xa * xa)) / 2; }
      }
      const dt = w * half;
      // Posición: p = u·(smax − t) + v·x'
      const dF = f * ancho * dt;
      const dFx = f * (g.ux * p0 * ancho + g.vx * mom) * dt;
      const dFy = f * (g.uy * p0 * ancho + g.vy * mom) * dt;
      F += dF;
      Fx += dFx;
      Fy += dFy;
    }
  }
  for (const p of m.puntos) {
    const t = g.smax - (g.ux * p.x + g.uy * p.y);
    const f = -sigma(m.acero, eps(t));
    F += f * p.A;
    Fx += f * p.A * p.x;
    Fy += f * p.A * p.y;
  }
  return { N: F, Mx: m.yc * F - Fy, My: Fx - m.xc * F };
}

/** Estado último con axil N (compresión positiva) cuando la fibra más comprimida está en la dirección θ. */
export function estadoUltimoEsviada(m, N, theta) {
  const g = giro(m, theta);
  const e = estadoUltimo(seccionGirada(m, g), -N, { signo: 1 });
  if (!e.converge) return { converge: false, theta };
  const r = esfuerzosPlano(m, theta, e.epsSup, e.kappa);
  return { converge: true, theta, N: r.N, Mx: r.Mx, My: r.My, x: e.x, epsSup: e.epsSup, kappa: e.kappa, epsInf: e.epsInf, h: g.h };
}

/** Axiles máximos de compresión y tracción de la sección (independientes de la dirección). */
export function axilesEsviada(m) {
  return axilesLimite(seccionGirada(m, giro(m, 0)));
}

/**
 * Contorno de interacción (Mx, My) a N constante: n direcciones equiespaciadas. Devuelve [] si N supera la capacidad.
 * @returns {{theta:number, Mx:number, My:number, x:number, epsSup:number, kappa:number}[]}
 */
export function contornoMxMy(m, N, { n = 72 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const e = estadoUltimoEsviada(m, N, (2 * Math.PI * i) / n);
    if (!e.converge) return [];
    pts.push(e);
  }
  return pts;
}

/**
 * Aprovechamiento de un par (Mx, My) a su axil N: razón |OP| / |OQ| con Q el corte del rayo OP con el contorno de
 * interacción (≤ 1 cumple). Q se halla buscando la dirección θ de la fibra comprimida cuyo momento último tiene la
 * dirección de OP; sin calcular el contorno entero.
 * @returns {{ratio:number, Q:number[]|null, e:Object|null}}  e = estado último en Q
 */
export function razonMxMy(m, N, Mx, My) {
  const r = Math.hypot(Mx, My);
  const { Ncomp, Ntrac } = axilesEsviada(m);
  if (N > Ncomp + 1e-9 || N < Ntrac - 1e-9) return { ratio: Infinity, Q: null, e: null };
  if (r < 1e-9) return { ratio: 0, Q: [0, 0], e: null };
  // El ángulo del momento último crece con θ: cruz > 0 si el momento último va por detrás de OP
  const cruz = (e) => e.Mx * My - e.My * Mx;
  const th0 = Math.atan2(-Mx, My); // la fibra comprimida cae del lado de OP; el desvío por asimetría lo corrige la búsqueda
  const e0 = estadoUltimoEsviada(m, N, th0);
  if (!e0.converge) return { ratio: Infinity, Q: null, e: null };
  const paso = (15 * Math.PI) / 180;
  let lo = th0;
  let hi = th0;
  let elo = e0;
  let ehi = e0;
  if (cruz(e0) > 0) {
    for (let i = 0; i < 12 && cruz(ehi) > 0; i++) { lo = hi; elo = ehi; hi += paso; ehi = estadoUltimoEsviada(m, N, hi); if (!ehi.converge) return { ratio: Infinity, Q: null, e: null }; }
  } else {
    for (let i = 0; i < 12 && cruz(elo) < 0; i++) { hi = lo; ehi = elo; lo -= paso; elo = estadoUltimoEsviada(m, N, lo); if (!elo.converge) return { ratio: Infinity, Q: null, e: null }; }
  }
  let mejor = cruz(elo) * cruz(ehi) <= 0 ? (Math.abs(cruz(elo)) < Math.abs(cruz(ehi)) ? elo : ehi) : e0;
  for (let it = 0; it < 40 && hi - lo > 1e-6; it++) {
    const th = (lo + hi) / 2;
    const e = estadoUltimoEsviada(m, N, th);
    if (!e.converge) break;
    mejor = e;
    if (cruz(e) > 0) lo = th; else hi = th;
  }
  const lam = Math.hypot(mejor.Mx, mejor.My);
  return { ratio: r / Math.max(lam, 1e-12), Q: [mejor.Mx, mejor.My], e: mejor };
}

/** Coeficiente de seguridad γ = |OQ| / |OP| (≥ 1 cumple). Infinity si el par es nulo; 0 si N supera la capacidad. */
export function coeficienteMxMy(m, N, Mx, My) {
  if (Math.hypot(Mx, My) < 1e-9) return Number.isFinite(N) && N >= axilesEsviada(m).Ntrac && N <= axilesEsviada(m).Ncomp ? Infinity : 0;
  const { ratio } = razonMxMy(m, N, Mx, My);
  return ratio > 0 && Number.isFinite(ratio) ? 1 / ratio : 0;
}

/**
 * Dimensionamiento: menor factor k de la armadura dada (misma disposición) con el que el par queda dentro del
 * contorno con coeficiente ≥ gamma. 0 si basta sin armadura; Infinity si no se alcanza con k ≤ kMax.
 */
export function dimensionarEsviada(geo, hormigon, acero, N, Mx, My, { gamma = 1, kMax = 40, tol = 2e-3 } = {}) {
  const ok = (k) => coeficienteMxMy(modeloEsviada(geo, hormigon, acero, k), N, Mx, My) >= gamma - 1e-9;
  if (ok(0)) return 0;
  if (!ok(kMax)) return Infinity;
  let lo = 0;
  let hi = kMax;
  for (let i = 0; i < 30 && hi - lo > tol * hi; i++) {
    const m = (lo + hi) / 2;
    if (ok(m)) hi = m; else lo = m;
  }
  return hi;
}
