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

/* ---------------------------------------------------------------------------------------------------------------
 * Diagramas N–M: cortes de la superficie de rotura (N, Mx, My) por un plano Mx = constante o My = constante.
 * La superficie se muestrea una vez por modelo (N × θ) y se guarda; el corte para cada valor del momento fijo se
 * obtiene interpolando y es instantáneo. Los estados de cada punto (β, x, κ, ε) se calculan después en exacto.
 * ------------------------------------------------------------------------------------------------------------- */

const SUPERFICIES = new WeakMap();

/**
 * Superficie de rotura muestreada: nN axiles interiores entre la tracción y la compresión máximas (en los extremos
 * el contorno se reduce a un punto) y nT direcciones θ de la fibra más comprimida.
 * @returns {{Ns:number[], thetas:number[], Mx:number[][], My:number[][], Ntrac:number, Ncomp:number}}
 */
export function superficieEsviada(m, { nN = 33, nT = 48 } = {}) {
  const clave = `${nN}/${nT}`;
  const previa = SUPERFICIES.get(m);
  if (previa?.clave === clave) return previa.S;
  const { Ncomp, Ntrac } = axilesEsviada(m);
  const thetas = Array.from({ length: nT }, (_, j) => (2 * Math.PI * j) / nT);
  const Ns = [Ntrac];
  const Mx = [new Array(nT).fill(0)];
  const My = [new Array(nT).fill(0)];
  for (let i = 1; i <= nN; i++) {
    // Niveles algo más densos hacia los extremos (donde el diagrama se cierra) que en el centro
    const tt = i / (nN + 1);
    const N = Ntrac + (Ncomp - Ntrac) * (0.5 * tt + 0.25 * (1 - Math.cos(Math.PI * tt)));
    const fx = [];
    const fy = [];
    for (const th of thetas) {
      const e = estadoUltimoEsviada(m, N, th);
      fx.push(e.converge ? e.Mx : NaN);
      fy.push(e.converge ? e.My : NaN);
    }
    Ns.push(N); Mx.push(fx); My.push(fy);
  }
  Ns.push(Ncomp); Mx.push(new Array(nT).fill(0)); My.push(new Array(nT).fill(0));
  const S = { Ns, thetas, Mx, My, Ntrac, Ncomp };
  SUPERFICIES.set(m, { clave, S });
  return S;
}

/** Momentos mayores en valor absoluto de toda la superficie (para fijar los ejes de los diagramas). */
export function maximosSuperficie(S) {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < S.Ns.length; i++) for (let j = 0; j < S.thetas.length; j++) {
    if (Number.isFinite(S.Mx[i][j])) mx = Math.max(mx, Math.abs(S.Mx[i][j]));
    if (Number.isFinite(S.My[i][j])) my = Math.max(my, Math.abs(S.My[i][j]));
  }
  return { Mx: mx, My: my };
}

/** Cruces de la curva cerrada F(θ) = M0 en el nivel i: [{v, j, t}] con el otro momento v interpolado. */
function crucesNivel(S, i, fijo, M0) {
  const F = fijo === 'Mx' ? S.Mx[i] : S.My[i];
  const V = fijo === 'Mx' ? S.My[i] : S.Mx[i];
  const nT = F.length;
  const out = [];
  for (let j = 0; j < nT; j++) {
    const k = (j + 1) % nT;
    const a = F[j] - M0;
    const b = F[k] - M0;
    if (!Number.isFinite(a) || !Number.isFinite(b) || (a === 0 && b === 0)) continue;
    if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
      const t = a / (a - b);
      out.push({ v: V[j] + t * (V[k] - V[j]), j, t });
    }
  }
  return out;
}

/**
 * Diagrama N–M a Mx (o My) constante: la rama superior (mayor valor del otro momento) y la inferior, por axiles.
 * @param {'Mx'|'My'} fijo  momento que se mantiene constante, con valor M0
 * @returns {{N:number[], A:number[], B:number[], curva:number[][]}}  curva = [[N, M]] cerrada, M es el otro momento
 */
export function corteNM(S, fijo, M0) {
  const N = [];
  const A = [];
  const B = [];
  for (let i = 1; i < S.Ns.length - 1; i++) {
    const c = crucesNivel(S, i, fijo, M0);
    if (c.length < 2) continue;
    const vs = c.map((x) => x.v);
    N.push(S.Ns[i]); A.push(Math.max(...vs)); B.push(Math.min(...vs));
  }
  const curva = [];
  if (Math.abs(M0) < 1e-9) { curva.push([S.Ntrac, 0]); }
  N.forEach((n, k) => curva.push([n, A[k]]));
  if (Math.abs(M0) < 1e-9) { curva.push([S.Ncomp, 0]); }
  for (let k = N.length - 1; k >= 0; k--) curva.push([N[k], B[k]]);
  return { N, A, B, curva };
}

/** ¿Está el punto (N, M) dentro del polígono cerrado `curva`? */
export function dentroCurva(curva, N, M) {
  let dentro = false;
  for (let i = 0, j = curva.length - 1; i < curva.length; j = i++) {
    const [xi, yi] = curva[i];
    const [xj, yj] = curva[j];
    if ((yi > M) !== (yj > M) && N < ((xj - xi) * (M - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Cortes del rayo λ·(N, M), λ > 0, con el polígono: lista de λ ordenada. */
function cortesRayo(curva, N, M) {
  const out = [];
  for (let i = 0; i < curva.length; i++) {
    const [x1, y1] = curva[i];
    const [x2, y2] = curva[(i + 1) % curva.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const den = N * dy - M * dx;
    if (Math.abs(den) < 1e-12) continue;
    const lam = (x1 * dy - y1 * dx) / den;
    const u = (x1 * M - y1 * N) / den;
    if (lam > 0 && u >= -1e-9 && u <= 1 + 1e-9) out.push({ lam, i });
  }
  return out.sort((a, b) => a.lam - b.lam);
}

/**
 * Coeficiente de seguridad en el plano N–M a excentricidad constante y momento fijo: γ = λ con λ·(N, M) sobre el
 * diagrama (la misma idea que |OQ|/|OP| en Mx–My). Si el punto está dentro, el corte más lejano (≥ 1); si no, el
 * más cercano por debajo de 1 (0 si no hay).
 */
export function coeficienteNM(curva, N, M) {
  return cruceRayo(curva, N, M).g;
}

/** Corte elegido del rayo con el polígono: {g, i} con i el índice del lado de `curva` donde corta (-1 si no hay). */
function cruceRayo(curva, N, M) {
  const cortes = cortesRayo(curva, N, M);
  if (dentroCurva(curva, N, M)) return cortes.length ? { g: Math.max(cortes[cortes.length - 1].lam, 1), i: cortes[cortes.length - 1].i } : { g: Infinity, i: -1 };
  const menores = cortes.filter((c) => c.lam <= 1);
  return menores.length ? { g: menores[menores.length - 1].lam, i: menores[menores.length - 1].i } : { g: 0, i: -1 };
}

/**
 * Razón N–M exacta de un punto (N, M): γ = λ con λ·(N, M) sobre el diagrama a `fijo` = M0 constante. Parte del corte
 * del polígono muestreado y lo afina con el estado último exacto (secante en λ).
 * @returns {{g:number, Q:number[]|null, e:Object|null}}  Q = [N, M] del corte; e = estado último en Q
 */
export function razonNM(m, S, corte, fijo, M0, N, M) {
  const { g, i } = cruceRayo(corte.curva, N, M);
  if (!(g > 0) || !Number.isFinite(g) || i < 0) return { g, Q: null, e: null };
  const rama = i < corte.N.length + (Math.abs(M0) < 1e-9 ? 1 : 0) ? 'A' : 'B';
  const var_ = fijo === 'Mx' ? 'My' : 'Mx';
  const res = (lam) => {
    const e = estadoEnPlano(m, S, lam * N, fijo, M0, rama);
    return e ? { e, r: e[var_] - lam * M } : null;
  };
  let l0 = g;
  let r0 = res(l0);
  if (!r0) return { g, Q: null, e: null };
  let l1 = g * 1.01;
  let r1 = res(l1);
  for (let it = 0; it < 4 && r1 && Math.abs(r1.r) > 1e-4 * Math.max(1, Math.abs(M)); it++) {
    const den = r1.r - r0.r;
    if (Math.abs(den) < 1e-14) break;
    const l2 = l1 - (r1.r * (l1 - l0)) / den;
    l0 = l1; r0 = r1; l1 = l2; r1 = res(l1);
  }
  const best = r1 && Math.abs(r1.r) <= Math.abs(r0.r) ? { l: l1, ...r1 } : { l: l0, ...r0 };
  return { g: best.l, Q: [best.l * N, best.e[var_]], e: best.e };
}

/**
 * Estado último exacto a axil N con el momento `fijo` igual a M0, en la rama pedida ('A' = mayor otro momento,
 * 'B' = menor): se busca θ por bisección entre las direcciones vecinas de la superficie muestreada.
 * @returns {Object|null} estadoUltimoEsviada en ese θ
 */
export function estadoEnPlano(m, S, N, fijo, M0, rama = 'A') {
  // Nivel de superficie más cercano para acotar θ
  let ib = 1;
  for (let i = 1; i < S.Ns.length - 1; i++) if (Math.abs(S.Ns[i] - N) < Math.abs(S.Ns[ib] - N)) ib = i;
  const c = crucesNivel(S, ib, fijo, M0);
  if (c.length < 2) return null;
  const sel = rama === 'A' ? c.reduce((p, q) => (q.v > p.v ? q : p)) : c.reduce((p, q) => (q.v < p.v ? q : p));
  const dT = (2 * Math.PI) / S.thetas.length;
  let lo = S.thetas[sel.j] - 0.5 * dT;
  let hi = S.thetas[sel.j] + 1.5 * dT;
  const f = (th) => {
    const e = estadoUltimoEsviada(m, N, th);
    return e.converge ? { e, d: (fijo === 'Mx' ? e.Mx : e.My) - M0 } : null;
  };
  let flo = f(lo);
  let fhi = f(hi);
  if (!flo || !fhi || flo.d * fhi.d > 0) {
    // El cruce puede haberse movido de intervalo: se amplía una vez a ±2 pasos
    lo -= dT; hi += dT; flo = f(lo); fhi = f(hi);
    if (!flo || !fhi || flo.d * fhi.d > 0) return null;
  }
  let mejor = Math.abs(flo.d) < Math.abs(fhi.d) ? flo.e : fhi.e;
  for (let it = 0; it < 40 && hi - lo > 1e-7; it++) {
    const th = (lo + hi) / 2;
    const r = f(th);
    if (!r) break;
    mejor = r.e;
    if (Math.abs(r.d) < 1e-6) break;
    if (r.d * flo.d > 0) { lo = th; flo = r; } else hi = th;
  }
  return mejor;
}
