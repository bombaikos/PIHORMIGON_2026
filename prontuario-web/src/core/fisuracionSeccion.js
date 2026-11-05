// ELS ▸ Fisuración de una sección real (rectangular, T o pilar): el estado fisurado (x, σs, ε1) sale del motor de
// Estado tensional (src/core/estadoTensional.js) con ley lineal, γC = αcc = 1 y γS = 1; las fórmulas de wk son las de fisuracion.js.
// Entrada en m, kN, MPa; las magnitudes de salida van en mm y MPa (sentido N-mm-MPa del EC-2).
// Convención: compresión positiva; M > 0 traciona la cara inferior (el motor usa Mx > 0 = comprime la cara superior, igual).
import { modeloTensional, estadoTensional } from './estadoTensional.js';
import { propsHormigon, wkNorma, areaBarra } from './fisuracion.js';

export const NORMAS_FIS = ['EHE08', 'EC2-2004', 'EC2-2023'];
const MM = 1000;

/** Modelo tensional de servicio (lineal, sin factores de seguridad) de la geometría dada. */
export function modeloServicio(geo, mats, fck) {
  const { fctm } = propsHormigon(fck, (geo.caja.ymax - geo.caja.ymin) * MM);
  return modeloTensional(geo, mats.hormigon, mats.acero, { gammaC: 1, alfaCC: 1, gammaS: 1, phi: 0, lineal: true, fctm });
}

/** Área (mm²) de hormigón entre la cara traccionada y la profundidad hef (mm); trap: trapecios con la cara traccionada en y = h. */
function areaHasta(trap, h, hef) {
  const y0 = h - hef / MM;
  let A = 0;
  for (const t of trap) {
    const a = Math.max(t.y1, y0);
    const b = Math.min(t.y2, h);
    if (b <= a) continue;
    const w = (y) => t.b1 + ((t.b2 - t.b1) * (y - t.y1)) / (t.y2 - t.y1 || 1);
    A += ((w(a) + w(b)) / 2) * (b - a);
  }
  return A * 1e6;
}

/** Primer lecho traccionado: barras a menos de ø de la capa más próxima a la cara traccionada. */
function primerLecho(geo, signo, barras) {
  const { ymin, ymax } = geo.caja;
  const dy = (b) => (signo > 0 ? ymax - b.y : b.y - ymin);
  const trac = barras.filter((b) => b.eps < 0);
  if (!trac.length) return null;
  const d0 = Math.min(...trac.map(dy));
  const fi0 = Math.max(...trac.map((b) => b.fi));
  const lecho = trac.filter((b) => dy(b) <= d0 + fi0 / MM + 1e-9);
  const n = lecho.length;
  const fiEq = lecho.reduce((a, b) => a + b.fi ** 2, 0) / lecho.reduce((a, b) => a + b.fi, 0);
  const xs = lecho.map((b) => b.x).sort((a, c) => a - c);
  const sep = xs.length > 1 ? Math.max(...xs.slice(1).map((v, i) => v - xs[i])) * MM : null;
  return {
    n, fi: fiEq, As1: lecho.reduce((a, b) => a + b.A, 0) * 1e6,
    ay: lecho.reduce((a, b) => a + dy(b), 0) / n * MM,
    c: d0 * MM - fi0 / 2, sep, sigma: -lecho.reduce((a, b) => a + b.sigma, 0) / n,
  };
}

/** Une las barras de la geometría con su estado (eps, sigma) del motor. */
function barrasConEstado(geo, est) {
  return geo.barras.map((b, i) => ({ ...b, eps: est.barras[i].eps, sigma: est.barras[i].sigma }));
}

/** Resumen para la figura: x [mm], deformaciones de la cara de arriba y de abajo [‰], σ de la armadura traccionada y de la comprimida [MPa]. */
function resumenEstado(F, L, signo) {
  const comp = F.barras.filter((b) => b.sigma > 0);
  const A = comp.reduce((a, b) => a + b.A, 0);
  return {
    x: Number.isFinite(F.x) && F.x > 0 ? F.x * MM : 0,
    eArriba: (signo > 0 ? F.eSup : F.eInf) * 1000, eAbajo: (signo > 0 ? F.eInf : F.eSup) * 1000,
    ss: L ? L.sigma : 0, sp: A > 0 ? comp.reduce((a, b) => a + b.sigma * b.A, 0) / A : 0,
  };
}

/**
 * Cálculo completo para un esfuerzo.
 * @param {Object} c  { geo, mats, v (datosViga con el signo de M), fck, mod? }
 * @param {{M:number,N?:number,larga?:boolean,directa?:boolean,buenaAdh?:boolean}} o  M en kN·m (con signo), N en kN (compresión +)
 */
/** Estado fisurado para (N, Mx); si el Newton directo no converge, continuación desde N = 0 en pasos. */
function estadoFisurado(mod, N, Mx) {
  const r = estadoTensional(mod, { tipo: 'NM', N, Mx, My: 0 }, { fisurada: true });
  if (r.ok || N === 0) return r;
  let q = estadoTensional(mod, { tipo: 'NM', N: 0, Mx, My: 0 }, { fisurada: true });
  for (let i = 1; i <= 20 && q.ok; i++) q = estadoTensional(mod, { tipo: 'NM', N: (N * i) / 20, Mx, My: 0 }, { fisurada: true, ini: q.plano });
  return q;
}

export function fisuraSeccion(c, o) {
  const { geo, v, fck } = c;
  const { N = 0, larga = true, directa = true, buenaAdh = true } = o;
  const M = Math.abs(o.M);
  const signo = o.M >= 0 ? 1 : -1;
  const mod = c.mod ?? modeloServicio(geo, c.mats, fck);
  const h = v.h * MM;
  const m = propsHormigon(fck, h);
  const Mf = v.W * (m.fctfl * 1000 + N / v.Ac);
  const res = { Mfis: Mf, M, N, fck, m, h, b: v.b * MM, signo };
  if (M <= Mf) return { ...res, sinFisurar: true, wk: { EHE08: 0, 'EC2-2004': 0, 'EC2-2023': 0 } };
  const F = estadoFisurado(mod, N, signo * M);
  if (!F.ok) return { ...res, error: 'sin-equilibrio' };
  const Fr = estadoFisurado(mod, N, signo * Mf);
  const L = primerLecho(geo, signo, barrasConEstado(geo, F));
  if (!L) return { ...res, error: 'sin-traccion' };
  const Lr = Fr.ok ? primerLecho(geo, signo, barrasConEstado(geo, Fr)) : null;
  const trap = v.trapecios;
  const x = Number.isFinite(F.x) && F.x > 0 ? F.x * MM : 0;
  const e1 = Math.max(-F.eInf, 1e-9);
  const e2 = Math.max(F.eSup < 0 ? -F.eSup : 0, 0);
  const g = {
    b: v.b * MM, h, c: L.c, ay: L.ay, fi: L.fi, n: L.n, As1: L.As1, d: h - L.ay,
    s: L.sep ?? v.b * MM, areaEf: (hef) => areaHasta(trap, v.h, hef),
  };
  const e = { x, ss: L.sigma, ssr: Lr ? Lr.sigma : L.sigma, e1, e2 };
  const wk = {};
  const det = {};
  for (const n of NORMAS_FIS) {
    const r = wkNorma(n, g, e, { larga, directa, buenaAdh, fck });
    wk[n] = r.wk;
    det[n] = r;
  }
  const figura = { Mk: resumenEstado(F, L, signo), Mfis: resumenEstado(Fr.ok ? Fr : F, Lr ?? L, signo) };
  return { ...res, g, e, wk, det, estado: F, lecho: L, figura };
}

/** Curva wk(M) para las tres normas, con el mismo modelo; M de 0 a Mmax en n pasos (los puntos sin fisurar valen 0). */
export function curvaWk(c, o, Mmax, n = 36) {
  const mod = c.mod ?? modeloServicio(c.geo, c.mats, c.fck);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const M = (Mmax * i) / n;
    const r = fisuraSeccion({ ...c, mod }, { ...o, M: o.M >= 0 ? M : -M });
    pts.push({ M, wk: r.error ? null : r.sinFisurar ? { EHE08: 0, 'EC2-2004': 0, 'EC2-2023': 0 } : r.wk });
  }
  return pts;
}

/** Geometría con el primer lecho traccionado sustituido por n barras ø fi repartidas a la misma distancia ay. */
export function conLecho(c, signo, fi, n, estadoActual) {
  const { geo, v } = c;
  const L = primerLecho(geo, signo, barrasConEstado(geo, estadoActual));
  if (!L) return null;
  const { ymin, ymax } = geo.caja;
  const dy = (b) => (signo > 0 ? ymax - b.y : b.y - ymin);
  const fiMax = Math.max(...geo.barras.filter((b, i) => estadoActual.barras[i].eps < 0).map((b) => b.fi));
  const d0 = Math.min(...geo.barras.filter((b, i) => estadoActual.barras[i].eps < 0).map(dy));
  const lecho = (b, i) => estadoActual.barras[i].eps < 0 && dy(b) <= d0 + fiMax / MM + 1e-9;
  const resto = geo.barras.filter((b, i) => !lecho(b, i));
  const xc = (geo.caja.xmin + geo.caja.xmax) / 2;
  const w = v.b;
  const cMm = L.c / MM;
  const ini = xc - w / 2 + cMm + fi / 2 / MM;
  const paso = n > 1 ? (w - 2 * cMm - fi / MM) / (n - 1) : 0;
  const y = signo > 0 ? ymax - L.ay / MM : ymin + L.ay / MM;
  const nuevas = Array.from({ length: n }, (_, i) => ({ x: n > 1 ? ini + i * paso : xc, y, fi, A: areaBarra(fi) * 1e-6, grupo: -1 }));
  return { geo: { ...geo, barras: [...resto, ...nuevas] }, libre: n > 1 ? paso * MM - fi : Infinity };
}

/** Para cada ø de la serie, el menor número de barras (en un lecho) con wk ≤ wmáx según la norma. */
export function dimensionaSeccion(c, o, norma, wmax, diametros, nMax = 12) {
  const signo = o.M >= 0 ? 1 : -1;
  const base = fisuraSeccion(c, o);
  if (base.sinFisurar) return diametros.map((fi) => ({ fi, n: null, sinFisurar: true }));
  if (base.error) return diametros.map((fi) => ({ fi, n: null, error: base.error }));
  return diametros.map((fi) => {
    for (let n = 2; n <= nMax; n++) {
      const cand = conLecho(c, signo, fi, n, base.estado);
      if (!cand || (n > 2 && cand.libre < Math.max(fi, 20))) break;
      const r = fisuraSeccion({ ...c, geo: cand.geo, mod: undefined }, o);
      if (r.error) continue;
      if (r.sinFisurar || r.wk[norma] <= wmax) return { fi, n, As: n * areaBarra(fi), wk: r.sinFisurar ? 0 : r.wk[norma], libre: cand.libre };
    }
    return { fi, n: null };
  });
}
