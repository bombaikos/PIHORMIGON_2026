// Rangos de los gauges del Análisis tensional, sobre un oráculo de pertenencia en el espacio de deformaciones.
// Variables normalizadas u = v/escala (v = ε_cdg, κx, κy); el dominio se supone estrellado respecto del origen (todos los
// límites son homogéneos: escalar el plano por t ≤ 1 no lo saca) y, con candados, respecto del punto actual.
// Rango total de una variable: valores con algún estado admisible, con las demás libres (las bloqueadas, fijas).
// Banda: valores con las otras dos en su valor actual. Reajuste: estado admisible más próximo, midiendo cada variable
// en proporción a su rango total.

export const TOPE = 2; // |u| ≤ TOPE: acota los dominios sin límite (p. ej. sin armadura en tracción)

const PASOS = 48;

/** Oráculo sobre u, acotado a la caja |u| ≤ TOPE. */
const acota = (en) => (u) => u.every((x) => Math.abs(x) <= TOPE + 1e-12) && en(u);

/** Intervalo conexo de u[i] que contiene u (admisible), con las otras componentes fijas; bisección en cada extremo. */
export function bandaEje(en, u, i) {
  const f = acota(en);
  const lado = (s) => {
    let ok = u[i];
    let mal = null;
    for (let k = 1; k <= PASOS; k++) {
      const x = u[i] + (s * (TOPE * 2) * k) / PASOS;
      const q = u.slice(); q[i] = x;
      if (f(q)) ok = x; else { mal = x; break; }
    }
    if (mal === null) return ok;
    for (let k = 0; k < 40; k++) { const m = (ok + mal) / 2; const q = u.slice(); q[i] = m; if (f(q)) ok = m; else mal = m; }
    return ok;
  };
  return [lado(-1), lado(1)];
}

/** Distancia radial desde c (admisible) en la dirección d hasta el borde del dominio. */
function radial(f, c, d) {
  const pun = (t) => c.map((x, k) => x + t * d[k]);
  const T = TOPE * 4;
  let ok = 0;
  let mal = null;
  for (let k = 1; k <= 24; k++) { const t = (T * k) / 24; if (f(pun(t))) ok = t; else { mal = t; break; } }
  if (mal === null) return ok;
  for (let k = 0; k < 40; k++) { const m = (ok + mal) / 2; if (f(pun(m))) ok = m; else mal = m; }
  return ok;
}

const norma = (v) => Math.hypot(...v);
const unit = (v) => { const n = norma(v) || 1; return v.map((x) => x / n); };

/** Direcciones del subespacio de los ejes libres: 1 → ±eje; 2 → circunferencia; 3 → esfera (espiral de Fibonacci). */
function direcciones(libres) {
  const n = libres.length;
  const emb = (w) => { const d = [0, 0, 0]; libres.forEach((j, k) => { d[j] = w[k]; }); return d; };
  if (n === 1) return [emb([1]), emb([-1])];
  if (n === 2) return Array.from({ length: 360 }, (_, k) => emb([Math.cos((2 * Math.PI * k) / 360), Math.sin((2 * Math.PI * k) / 360)]));
  const N = 1200;
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: N }, (_, k) => { const z = 1 - (2 * (k + 0.5)) / N; const r = Math.sqrt(1 - z * z); return emb([r * Math.cos(ga * k), r * Math.sin(ga * k), z]); });
}

/** Perturbaciones de d dentro del subespacio libre, de tamaño ang (rad). */
function vecinas(d, libres, ang) {
  const n = libres.length;
  if (n === 1) return [d];
  const w = libres.map((j) => d[j]);
  const emb = (v) => { const o = [0, 0, 0]; libres.forEach((j, k) => { o[j] = v[k]; }); return o; };
  if (n === 2) { const a = Math.atan2(w[1], w[0]); return [-1, 1].map((s) => emb([Math.cos(a + s * ang), Math.sin(a + s * ang)])); }
  const aux = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit([w[1] * aux[2] - w[2] * aux[1], w[2] * aux[0] - w[0] * aux[2], w[0] * aux[1] - w[1] * aux[0]]);
  const e2 = [w[1] * e1[2] - w[2] * e1[1], w[2] * e1[0] - w[0] * e1[2], w[0] * e1[1] - w[1] * e1[0]];
  const out = [];
  for (let k = 0; k < 8; k++) {
    const f = (2 * Math.PI * k) / 8;
    out.push(emb(unit(w.map((x, m) => x + ang * (Math.cos(f) * e1[m] + Math.sin(f) * e2[m])))));
  }
  return out;
}

/**
 * Rangos de un estado admisible p (u), con candados.
 * @param {(u:number[])=>boolean} en  oráculo en u
 * @param {number[]} p  estado actual (u)
 * @param {boolean[]} bloqueo
 * @returns {{total:number[][]|null, banda:number[][]|null, ext:{max:number[][], min:number[][]}|null, dentro:boolean}}
 */
export function rangos(en, p, bloqueo) {
  const f = acota(en);
  const dentro = f(p);
  const libres = [0, 1, 2].filter((j) => !bloqueo[j]);
  if (!libres.length) return { total: p.map((x) => [x, x]), banda: p.map((x) => [x, x]), ext: null, dentro };
  let c = p;
  if (!dentro) {
    if (libres.length < 3) return { total: null, banda: null, ext: null, dentro };
    c = [0, 0, 0];
  }
  const maxP = {};
  const minP = {};
  const pon = (b) => { for (const j of libres) { if (!maxP[j] || b[j] > maxP[j][j]) maxP[j] = b; if (!minP[j] || b[j] < minP[j][j]) minP[j] = b; } };
  const punto = (d) => { const r = radial(f, c, d); return c.map((x, k) => x + r * d[k]); };
  const dirs = direcciones(libres);
  const pts = dirs.map((d) => ({ d, b: punto(d) }));
  for (const q of pts) pon(q.b);
  // Refinado local alrededor de cada extremo: los máximos de una variable están en vértices del dominio
  const refina = (sentido, j) => {
    let mejor = (sentido > 0 ? maxP : minP)[j];
    let d = unit(mejor.map((x, k) => x - c[k]));
    let ang = libres.length === 3 ? 0.06 : 0.015;
    for (let ronda = 0; ronda < 7; ronda++) {
      for (const dd of vecinas(d, libres, ang)) {
        const b = punto(dd);
        if (sentido * (b[j] - mejor[j]) > 1e-12) { mejor = b; d = dd; }
      }
      ang *= 0.45;
    }
    (sentido > 0 ? maxP : minP)[j] = mejor;
  };
  if (libres.length > 1) for (const j of libres) { refina(1, j); refina(-1, j); }
  const total = [0, 1, 2].map((j) => (bloqueo[j] ? [p[j], p[j]] : [minP[j][j], maxP[j][j]]));
  const ext = { max: [0, 1, 2].map((j) => maxP[j] ?? null), min: [0, 1, 2].map((j) => minP[j] ?? null) };
  const banda = dentro ? [0, 1, 2].map((j) => (bloqueo[j] ? [p[j], p[j]] : bandaEje(en, p, j))) : null;
  return { total, banda, ext, dentro };
}

/**
 * Lleva u[i] al valor nuevo y reajusta lo mínimo las otras variables libres para seguir en el dominio.
 * @returns {number[]|null} nuevo estado, o null si no se puede (variable bloqueada o rebanada sin estados admisibles)
 */
export function reajusta(en, p, i, nuevo, bloqueo, r) {
  if (bloqueo[i]) return null;
  const f = acota(en);
  const libres = [0, 1, 2].filter((j) => !bloqueo[j]);
  const otras = libres.filter((j) => j !== i);
  const lim = r.total?.[i];
  const v = lim ? Math.min(lim[1], Math.max(lim[0], nuevo)) : nuevo;
  const p1 = p.slice(); p1[i] = v;
  if (f(p1)) return p1;
  if (!otras.length) { const b = bandaEje(en, p, i); const q = p.slice(); q[i] = Math.min(b[1], Math.max(b[0], v)); return q; }
  const R = (j) => (r.total ? Math.max(r.total[j][1] - r.total[j][0], 1e-9) : TOPE * 2);
  const dist = (a) => Math.sqrt(otras.reduce((s, j) => s + ((a[j] - p[j]) / R(j)) ** 2, 0));
  // Punto admisible q de la rebanada: sobre el segmento entre los extremos de u[i]
  let q = null;
  const eMax = r.ext?.max[i];
  const eMin = r.ext?.min[i];
  if (eMax && eMin && eMax[i] !== eMin[i]) {
    const s = (v - eMin[i]) / (eMax[i] - eMin[i]);
    const cand = eMin.map((x, k) => x + s * (eMax[k] - x));
    cand[i] = v;
    for (const j of [0, 1, 2]) if (bloqueo[j]) cand[j] = p[j];
    if (f(cand)) q = cand;
  }
  if (!q) {
    let mejor = Infinity;
    const N = otras.length === 1 ? 400 : 40;
    const val = (a) => -TOPE + (2 * TOPE * a) / (N - 1);
    for (let a = 0; a < N; a++) for (let b = 0; b < (otras.length === 1 ? 1 : N); b++) {
      const cand = p1.slice();
      cand[otras[0]] = val(a);
      if (otras.length === 2) cand[otras[1]] = val(b);
      const e = dist(cand);
      if (e < mejor && f(cand)) { mejor = e; q = cand; }
    }
  }
  if (!q) return null;
  if (otras.length === 1) {
    const j = otras[0];
    const b = bandaEje(en, q, j);
    const out = q.slice(); out[j] = Math.min(b[1], Math.max(b[0], p[j]));
    return out;
  }
  // Dos libres: borde de la rebanada alrededor de q; el punto más cercano a p (en la métrica de rangos)
  const base = (k) => { const a = (2 * Math.PI * k) / 360; const d = [0, 0, 0]; d[otras[0]] = Math.cos(a); d[otras[1]] = Math.sin(a); return d; };
  const borde = (d) => { const t = radial(f, q, d); return q.map((x, k) => x + t * d[k]); };
  let mejor = null;
  let md = Infinity;
  let mdir = null;
  for (let k = 0; k < 360; k++) { const d = base(k); const b = borde(d); const e = dist(b); if (e < md) { md = e; mejor = b; mdir = d; } }
  let ang = 0.012;
  for (let ronda = 0; ronda < 8; ronda++) {
    const a0 = Math.atan2(mdir[otras[1]], mdir[otras[0]]);
    for (const s of [-1, 1]) {
      const d = [0, 0, 0]; d[otras[0]] = Math.cos(a0 + s * ang); d[otras[1]] = Math.sin(a0 + s * ang);
      const b = borde(d); const e = dist(b);
      if (e < md) { md = e; mejor = b; mdir = d; }
    }
    ang *= 0.5;
  }
  // El punto más cercano a p está en el borde; si p mismo (sobre la rebanada) ya cabe, no se mueve
  const p0 = p1.slice();
  return f(p0) ? p0 : mejor;
}

// ---------------------------------------------------------------- variables con coordenadas no lineales (modo ε_sup, β, x)
// Aquí el dominio no se supone estrellado en las variables de la regleta (β es cíclica y el origen es degenerado): se explora
// con barridos de cada variable sobre una rejilla de las otras libres y se afina el extremo con bisección y búsqueda local.

const NB = 64; // muestras por barrido de una variable
const NG = 16; // puntos por variable libre en la rejilla de las otras

/** Valores de la variable j: en [lo, hi]; si es cíclica, hi no se repite (es lo mismo que lo). */
const valor = (d, k, N) => d.lo + ((d.hi - d.lo) * k) / (d.cic ? N : N - 1 || 1);

/**
 * Tramos admisibles de la variable j con las demás fijas en p: [{a, b}] dentro de [lo, hi] (un tramo que cruza el origen
 * de una variable cíclica sale partido en dos). Los extremos se afinan por bisección.
 */
export function tramosEje(en, dom, p, j, N = NB) {
  const d = dom[j];
  const eval1 = (x) => { const q = p.slice(); q[j] = x; return en(q); };
  const xs = Array.from({ length: N }, (_, k) => valor(d, k, N));
  const ok = xs.map(eval1);
  const afina = (bueno, malo) => { for (let i = 0; i < 30; i++) { const m = (bueno + malo) / 2; if (eval1(m)) bueno = m; else malo = m; } return bueno; };
  const out = [];
  let ini = null;
  for (let k = 0; k < N; k++) {
    if (ok[k] && ini === null) ini = k;
    if ((!ok[k] || k === N - 1) && ini !== null) {
      const fin = ok[k] ? k : k - 1;
      const a = ini > 0 ? afina(xs[ini], xs[ini - 1]) : xs[ini];
      let b = fin < N - 1 ? afina(xs[fin], xs[fin + 1]) : xs[fin];
      if (fin === N - 1 && d.cic) b = d.hi;
      out.push({ a, b });
      ini = null;
    }
  }
  if (d.cic && out.length > 1 && ok[0] && ok[N - 1]) {
    // El tramo del final y el del principio son uno solo que cruza el origen: se dejan como dos tramos
    out[0].a = d.lo;
  }
  return out;
}

/** Tramo (o tramos, si cruza el origen de una variable cíclica) que contiene el valor actual de la variable j. */
function tramosContiene(tr, x, d) {
  const dentro = tr.filter((t) => x >= t.a - 1e-9 && x <= t.b + 1e-9);
  if (d.cic && dentro.length) {
    const ext = [...dentro];
    if (dentro.some((t) => t.a <= d.lo + 1e-9)) ext.push(...tr.filter((t) => t.b >= d.hi - 1e-9 && !dentro.includes(t)));
    if (dentro.some((t) => t.b >= d.hi - 1e-9)) ext.push(...tr.filter((t) => t.a <= d.lo + 1e-9 && !dentro.includes(t)));
    return [...new Set(ext)];
  }
  return dentro;
}

/**
 * Rangos de las variables de un estado p con dominio dom = [{lo, hi, cic}] y candados.
 * @returns {{total:number[][]|null, banda:number[][][]|null, dentro:boolean}}  banda: por variable, lista de tramos [a, b]
 */
export function rangosGeneral(en, dom, p, bloqueo) {
  const dentro = en(p);
  const libres = [0, 1, 2].filter((j) => !bloqueo[j]);
  const banda = dentro ? [0, 1, 2].map((j) => {
    if (bloqueo[j]) return [[p[j], p[j]]];
    return tramosContiene(tramosEje(en, dom, p, j), p[j], dom[j]).map((t) => [t.a, t.b]);
  }) : null;
  const total = [0, 1, 2].map((j) => {
    if (bloqueo[j]) return [p[j], p[j]];
    if (dom[j].cic) return [dom[j].lo, dom[j].hi]; // con las demás libres, toda dirección tiene algún estado admisible
    const otras = libres.filter((k) => k !== j);
    let lo = Infinity;
    let hi = -Infinity;
    let mejorHi = null;
    let mejorLo = null;
    const barre = (q) => { for (const t of tramosEje(en, dom, q, j, NB)) { if (t.a < lo) { lo = t.a; mejorLo = q; } if (t.b > hi) { hi = t.b; mejorHi = q; } } };
    const grid = (k) => Array.from({ length: NG }, (_, m) => valor(dom[k], m, NG));
    if (!otras.length) barre(p);
    else if (otras.length === 1) for (const x of grid(otras[0])) { const q = p.slice(); q[otras[0]] = x; barre(q); }
    else for (const x of grid(otras[0])) for (const y of grid(otras[1])) { const q = p.slice(); q[otras[0]] = x; q[otras[1]] = y; barre(q); }
    // Afinado local alrededor de los puntos que dieron los extremos
    for (const [sent, q0] of [[1, mejorHi], [-1, mejorLo]]) {
      if (!q0 || !otras.length) continue;
      let q = q0;
      let paso = otras.map((k) => (dom[k].hi - dom[k].lo) / NG);
      let mejor = sent > 0 ? hi : lo;
      for (let ronda = 0; ronda < 6; ronda++) {
        const vecinos = [];
        for (const [i, k] of otras.entries()) for (const s of [-1, 1]) { const v = q.slice(); v[k] = q[k] + s * paso[i]; if (dom[k].cic) v[k] = ((v[k] - dom[k].lo) % (dom[k].hi - dom[k].lo) + (dom[k].hi - dom[k].lo)) % (dom[k].hi - dom[k].lo) + dom[k].lo; else v[k] = Math.min(dom[k].hi, Math.max(dom[k].lo, v[k])); vecinos.push(v); }
        if (otras.length === 2) for (const sa of [-1, 1]) for (const sb of [-1, 1]) { const v = q.slice(); v[otras[0]] += sa * paso[0]; v[otras[1]] += sb * paso[1]; if (otras.every((k) => dom[k].cic || (v[k] >= dom[k].lo && v[k] <= dom[k].hi))) vecinos.push(v); }
        for (const v of vecinos) {
          for (const t of tramosEje(en, dom, v, j, 48)) {
            const val = sent > 0 ? t.b : t.a;
            if (sent * (val - mejor) > 1e-12) { mejor = val; q = v; }
          }
        }
        paso = paso.map((x) => x * 0.5);
      }
      if (sent > 0) hi = Math.max(hi, mejor); else lo = Math.min(lo, mejor);
    }
    return Number.isFinite(lo) ? [lo, hi] : [p[j], p[j]];
  });
  return { total, banda, dentro };
}

/**
 * Lleva la variable i al valor nuevo y reajusta lo mínimo las otras libres (no bloqueadas) para seguir en el dominio.
 * @returns {number[]|null}
 */
export function reajustaGeneral(en, dom, p, i, nuevo, bloqueo, r) {
  if (bloqueo[i]) return null;
  const libres = [0, 1, 2].filter((j) => !bloqueo[j]);
  const otras = libres.filter((j) => j !== i);
  const lim = r.total?.[i];
  const v = lim && !dom[i].cic ? Math.min(lim[1], Math.max(lim[0], nuevo)) : nuevo;
  const p1 = p.slice(); p1[i] = v;
  if (en(p1)) return p1;
  if (!otras.length) return null;
  const R = (j) => Math.max((r.total ? r.total[j][1] - r.total[j][0] : dom[j].hi - dom[j].lo), 1e-9);
  const dist = (a) => Math.sqrt(otras.reduce((s, j) => { let dj = a[j] - p[j]; if (dom[j].cic) { const L = dom[j].hi - dom[j].lo; dj = ((dj + L / 2) % L + L) % L - L / 2; } return s + (dj / R(j)) ** 2; }, 0));
  const N = otras.length === 1 ? 400 : 48;
  const val = (a, j) => valor(dom[j], a, N);
  let q = null;
  let mejor = Infinity;
  for (let a = 0; a < N; a++) for (let b = 0; b < (otras.length === 1 ? 1 : N); b++) {
    const c = p1.slice();
    c[otras[0]] = val(a, otras[0]);
    if (otras.length === 2) c[otras[1]] = val(b, otras[1]);
    const e = dist(c);
    if (e < mejor && en(c)) { mejor = e; q = c; }
  }
  if (!q) return null;
  // Afinado: se acerca el punto admisible al estado anterior por bisección sobre el segmento y por pasos locales
  let paso = otras.map((j) => (dom[j].hi - dom[j].lo) / N);
  for (let ronda = 0; ronda < 8; ronda++) {
    for (const j of otras) for (const s of [-1, 1]) {
      const c = q.slice(); c[j] = q[j] + s * paso[otras.indexOf(j)];
      if (en(c) && dist(c) < dist(q)) q = c;
    }
    const lado = { ...q };
    void lado;
    paso = paso.map((x) => x * 0.55);
  }
  let ok = q;
  let mal = p1;
  for (let k = 0; k < 30; k++) {
    const m = ok.map((x, j) => (otras.includes(j) ? (x + mal[j]) / 2 : x));
    if (en(m)) ok = m; else mal = m;
  }
  return ok;
}
