// ELS · Estado tensional: deformaciones y tensiones de una sección cualquiera en servicio.
// La sección (geometría, armadura y materiales) viene de Secciones. El estado se da de tres maneras, siempre con regletas:
// (N, Mx, My), (ε_cdg, κx, κy) o (ε_sup, β, x). Motor: src/core/estadoTensional.js (kN, m; ε absolutas; κ en 1/m; β en rad).
// Dibujo: la sección se gira para que la fibra más comprimida quede arriba y la fibra neutra horizontal; el plano de
// deformaciones va a su derecha, perpendicular a la neutra. Compresión positiva; Mx > 0 comprime la cara superior;
// My > 0 comprime la cara derecha. Decisiones: analisis/estado-tensional-decisiones.md.

import { modeloTensional, estadoTensional } from '../../core/estadoTensional.js';
import { propiedadesHormigon, opcionesHormigon } from '../../core/materiales.js';
import { geometriaDe, materialesSeccion } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, qh, MAG, decimalAlCopiar } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { veredicto } from './flexion.js';
import { h, poner, campoNum, segmentado, grupo, aviso, regleta, tabla } from '../campos.js';

const FORMAS = ['rectangular', 'pilar', 'T', 'circular', 'generica'];
const X_INF = 100; // m (100 000 mm): a partir de aquí se toma deformación uniforme (x = ∞)
const RAD = Math.PI / 180;
const est = {
  i: null, para: null, modo: 'NM',
  N: 0, Mx: 0, My: 0, // kN, kN·m
  e0: 0, kx: 0, ky: 0, // absoluta, 1/m
  eSup: 0, beta: 90, x: Infinity, // absoluta, grados, m
  gammaC: null, alfaCC: null, phi: 0, lineal: false,
  ultimo: null,
};
export function reiniciar() { est.i = null; est.para = null; est.ultimo = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  return est.i >= 0 ? p.secciones[est.i] : null;
}

// ---------------------------------------------------------------- cálculo

let memo = { clave: '', c: null };
function calculo(p, s) {
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  const mats = materialesSeccion(p, s);
  const fck = mats.hormigon.fk / 1000;
  const prop = propiedadesHormigon(fck, p.norma, opcionesHormigon(mats.fichaH, p.norma));
  const gammaC = est.gammaC ?? prop.gammaC;
  const alfaCC = est.alfaCC ?? prop.alfa;
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, gammaC, alfaCC, est.phi, est.lineal]);
  if (memo.clave === clave) return memo.c;
  const mod = modeloTensional(geo, mats.hormigon, mats.acero, { gammaC, alfaCC, phi: est.phi, lineal: est.lineal, fctm: prop.fctm });
  const caja = geo.caja;
  const bx = caja.xmax - caja.xmin;
  const hy = caja.ymax - caja.ymin;
  const Ac = mod.Ac;
  const As = mod.puntos.reduce((a, b) => a + b.A, 0);
  const fyk = mats.acero.fk / 1000;
  const c = {
    geo, mats, mod, prop, gammaC, alfaCC, fck, bx, hy,
    // Recorrido de las regletas: del orden de lo que resiste la sección en servicio (0,6·fck; 0,8·fyk)
    rg: {
      N: [Math.round(-0.8 * fyk * As * 1000 / 10) * 10 || -100, Math.round((0.6 * fck * Ac * 1000) / 10) * 10],
      Mx: Math.ceil((0.6 * fck * 1000 * (Ac * hy) / 6) / 10) * 10 || 100,
      My: Math.ceil((0.6 * fck * 1000 * (Ac * bx) / 6) / 10) * 10 || 100,
      kx: 8 / hy, ky: 8 / bx,
    },
    lector: leyDe(mats.hormigon, est.lineal),
  };
  memo = { clave, c };
  return c;
}

const leyDe = (mat, lineal) => (lineal ? 'lineal' : mat.diag === 'EC2' ? 'sargin' : mat.diag === 'puntos' ? 'puntos' : 'PR');

/** El dato que entiende el motor, desde lo que hay en pantalla. */
function dato() {
  if (est.modo === 'NM') return { tipo: 'NM', N: est.N, Mx: est.Mx, My: est.My };
  if (est.modo === 'eK') return { tipo: 'eK', e0: est.e0, kx: est.kx, ky: est.ky };
  return { tipo: 'sup', eSup: est.eSup, beta: est.beta * RAD, x: est.x };
}

/** Pasa el estado calculado a las variables de los tres modos, para que al cambiar de modo no se pierda. */
function guarda(r) {
  est.N = r.N; est.Mx = r.Mx; est.My = r.My;
  est.e0 = r.e0; est.kx = r.kx; est.ky = r.ky;
  est.eSup = r.eSup;
  if (r.beta !== null) est.beta = r.beta / RAD;
  est.x = Number.isFinite(r.x) ? r.x : (r.x > 0 ? Infinity : -Infinity);
  est.ultimo = r;
}

/** Estado inicial coherente cuando cambia la sección: un esfuerzo de servicio razonable para ella. */
function inicia(c) {
  est.N = Math.round((0.1 * c.fck * c.mod.Ac * 1000) / 10) * 10;
  est.Mx = Math.round((0.12 * c.rg.Mx) / 5) * 5;
  est.My = Math.round((0.04 * c.rg.My) / 5) * 5;
  const modo = est.modo;
  est.modo = 'NM';
  const r = estadoTensional(c.mod, dato());
  if (r.ok) guarda(r);
  est.modo = modo;
}

function resuelve(c, s) {
  const clave = JSON.stringify([s.nombre, s.geo, s.armado, s.hormigon, s.acero]);
  if (est.para !== clave) { est.para = clave; inicia(c); }
  return estadoTensional(c.mod, dato());
}

// ---------------------------------------------------------------- datos

export function datos(ctx, form) {
  const p = ctx.p;
  const s = activa(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.estadoTensional')), h('p', {}, t('est.subtitulo'))));
  if (!s) return poner(form, aviso(t('fcr.sinSec'), 'info'));
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; est.para = null; ctx.pintar(); }
  } }));
  let c = null;
  try { c = calculo(p, s); } catch { /* el error se muestra en resultados */ }
  if (c) resuelve(c, s); // fija el estado inicial antes de escribir los campos
  const cambio = () => ctx.cambio();
  const vis = (k) => (k === 'x' && !Number.isFinite(est.x) ? Math.sign(est.x) * X_INF : est[k]);
  // En los campos, cada magnitud con sus decimales de la guía (§ 1): ε 2, β 1, x 0, κ 2, N y M 0
  const redondeo = (x, mag) => { const m = MAG[mag]; const k = 10 ** (m.d ?? 0); return Math.round(x * m.f * k) / k / m.f; };
  const num = (id, etq, k, mag, o = {}) => campoNum({ id: `et-${id}`, etq, valor: redondeo(vis(k), mag), mag, paso: o.paso, min: o.min ?? -1e9, max: o.max ?? 1e9, nombre: o.nombre, ref: o.ref, info: o.info, onCambio: (v) => { est[k] = k === 'x' && Math.abs(v) >= X_INF ? Math.sign(v) * Infinity : v; cambio(); } });
  const campos = {
    NM: [
      num('N', sub('N', ''), 'N', 'N', { paso: 10, nombre: t('est.nombreN'), ref: t('fcr.compPos') }),
      num('Mx', sub('M', 'x'), 'Mx', 'M', { paso: 5, nombre: t('est.nombreMx'), ref: t('est.refMx') }),
      num('My', sub('M', 'y'), 'My', 'M', { paso: 5, nombre: t('est.nombreMy'), ref: t('est.refMy') }),
    ],
    eK: [
      num('e0', sub('ε', 'cdg'), 'e0', 'def', { paso: 0.05e-3, nombre: t('est.nombreE0') }),
      num('kx', sub('κ', 'x'), 'kx', 'curv', { paso: 0.1e-3, nombre: t('est.nombreKx') }),
      num('ky', sub('κ', 'y'), 'ky', 'curv', { paso: 0.1e-3, nombre: t('est.nombreKy') }),
    ],
    sup: [
      num('es', sub('ε', 'sup'), 'eSup', 'def', { paso: 0.05e-3, nombre: t('est.nombreESup'), info: t('est.infoSup') }),
      num('b', 'β', 'beta', 'ang1', { paso: 1, min: 0, max: 360, nombre: t('est.nombreBeta') }),
      num('x', 'x', 'x', 'long', { paso: 10e-3, nombre: t('est.nombreX'), ref: t('est.refX') }),
    ],
  };
  const gamma = (id, etq, k, defecto) => campoNum({ id: `et-${id}`, etq, valor: fmt(est[k] ?? defecto, 2), mag: null, paso: 0.05, min: 0.01, max: 10, sinUd: true, nombre: etq.replace(/<[^>]+>/g, ''), info: id === 'gc' ? t('est.infoGamma') : undefined, onCambio: (v) => { est[k] = v; ctx.pintar(); } });
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('est.modo'), opciones: [['NM', t('est.m.NM')], ['eK', t('est.m.eK')], ['sup', t('est.m.sup')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(est.modo === 'NM' ? t('est.gEsfuerzos') : t('est.gPlano'), ...campos[est.modo]),
    grupo(t('est.gHormigon'),
      c ? gamma('gc', t('est.gammaC'), 'gammaC', c.gammaC) : null,
      c ? gamma('ac', t('est.alfaCC'), 'alfaCC', c.alfaCC) : null,
      campoNum({ id: 'et-phi', etq: t('est.phi'), valor: fmt(est.phi, 2), mag: null, paso: 0.1, min: 0, max: 10, sinUd: true, info: t('est.infoPhi'), onCambio: (v) => { est.phi = v; ctx.pintar(); } }),
      h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'et-lineal', checked: est.lineal, onchange: (e) => { est.lineal = e.target.checked; ctx.pintar(); } }), h('span', { html: t('est.lineal') })),
      c ? h('div', { class: 'et-der' },
        h('span', {}, 'E', h('sub', {}, 'c,eff'), ` ${fmt(c.mod.ley.pendiente / 1000, 0)} MPa`),
        h('span', {}, `n = ${fmt(c.mod.acero.E / c.mod.ley.pendiente, 1)}`)) : null));
}

// ---------------------------------------------------------------- dibujo

/** Recorta un polígono por el semiplano {p : f(p) ≥ 0} (Sutherland–Hodgman). */
function recorta(pts, f) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])]); }
  }
  return out;
}

const W = 800;
const H = 500;
const pts2 = (a) => a.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
const svgSub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;

/** Sección girada con la fibra neutra horizontal y, a su derecha, el plano de deformaciones perpendicular a ella. */
function dibujo(c, r) {
  const { geo, mod } = c;
  const bet = r.beta ?? Math.PI / 2;
  const u = [Math.cos(bet), -Math.sin(bet)];
  const v = [Math.sin(bet), Math.cos(bet)];
  const xc = mod.xc;
  const yc = mod.yc;
  const diag = Math.hypot(c.bx, c.hy);
  const S = (H - 130) / diag; // px por m; no cambia al girar
  const cx = W * 0.36;
  const cy = H / 2 + 14;
  const T = (p) => { const dx = p[0] - xc; const dy = p[1] - yc; return [cx + S * (dx * v[0] + dy * v[1]), cy - S * (dx * u[0] + dy * u[1])]; };
  const prof = (p) => (p[0] - xc) * u[0] + (p[1] - yc) * u[1]; // u·(p − c): crece hacia la fibra más comprimida
  const lat = (p) => (p[0] - xc) * v[0] + (p[1] - yc) * v[1];
  const vs = mod.vertices;
  const smax = Math.max(...vs.map(prof));
  const smin = Math.min(...vs.map(prof));
  const lmax = Math.max(...vs.map(lat));
  const eps = (p) => r.e0 + r.ky * (p[0] - xc) - r.kx * (p[1] - yc);
  const out = ['<defs><pattern id="rayado" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" class="rayas"><line x1="0" y1="0" x2="0" y2="6"/></pattern><pattern id="rayado-t" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)" class="rayas-t"><line x1="0" y1="0" x2="0" y2="5"/></pattern><marker id="tic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" class="tic"/></marker></defs>'];
  // Hormigón, zona comprimida rayada y huecos
  for (const k of geo.contornos.filter((q) => q.signo > 0)) {
    out.push(`<polygon class="hor" points="${pts2(k.pts.map(T))}"/>`);
    const zc = r.beta === null ? (r.eSup > 0 ? k.pts : []) : recorta(k.pts, eps);
    if (zc.length > 2) out.push(`<polygon class="zc" points="${pts2(zc.map(T))}"/>`);
  }
  for (const k of geo.contornos.filter((q) => q.signo < 0)) out.push(`<polygon class="tapa" points="${pts2(k.pts.map(T))}"/><polygon class="corte" points="${pts2(k.pts.map(T))}"/>`);
  // Plano de deformaciones: línea base a la derecha de la sección, profundidad en vertical
  const yTop = cy - S * smax;
  const yBot = cy - S * smin;
  const tr = Math.max(0, -r.eInf);
  const escE = (W * 0.27) / Math.max(Math.abs(r.eSup), Math.abs(r.eInf), 5e-4);
  const x0 = cx + S * lmax + 50 + tr * escE;
  const aT = [x0 + r.eSup * escE, yTop];
  const aB = [x0 + r.eInf * escE, yBot];
  out.push(`<text class="tit" x="${x0}" y="${yTop - 22}" text-anchor="middle">${t('est.planoDef')}</text>`);
  out.push(`<line class="eje" x1="${x0}" y1="${yTop}" x2="${x0}" y2="${yBot}"/>`);
  // Parte comprimida (ε > 0) y parte traccionada (ε < 0) del plano, con su estilo
  const yCero = r.eSup === r.eInf ? yTop : yTop + ((yBot - yTop) * r.eSup) / (r.eSup - r.eInf);
  if (r.eSup > 0 && r.eInf < 0) {
    out.push(`<polygon class="eps-c" points="${pts2([[x0, yTop], aT, [x0, yCero]])}"/><polygon class="eps-t" points="${pts2([[x0, yCero], [x0, yBot], aB])}"/>`);
  } else out.push(`<polygon class="${r.eSup >= 0 && r.eInf >= 0 ? 'eps-c' : 'eps-t'}" points="${pts2([[x0, yTop], aT, aB, [x0, yBot]])}"/>`);
  const etq = (q, nombre, e, arriba) => `<text x="${q[0] + (e >= 0 ? 6 : -6)}" y="${q[1] + (arriba ? 4 : 4)}" text-anchor="${e >= 0 ? 'start' : 'end'}">${svgSub('ε', nombre)} ${fmt(e * 1000, 2)} ‰</text>`;
  out.push(etq(aT, 'sup', r.eSup, true), etq(aB, 'inf', r.eInf, false));
  // Fibra neutra y x
  if (r.beta !== null && Number.isFinite(r.x) && r.x !== 0) {
    const yN = yTop + S * r.x;
    if (yN > yTop - 30 && yN < yBot + 30) {
      out.push(`<line class="en" x1="${cx - S * diag / 2 - 10}" y1="${yN}" x2="${x0 + 108}" y2="${yN}"/>`);
      out.push(`<text x="${x0 + 112}" y="${yN + 4}">${t('est.fibraNeutra')}</text>`);
      out.push(`<line class="cota" x1="${x0 + 40}" y1="${yTop}" x2="${x0 + 40}" y2="${yN}" marker-start="url(#tic)" marker-end="url(#tic)"/><text class="fuerte" x="${x0 + 46}" y="${(yTop + yN) / 2}">x = ${fmt(r.x * 1000, 0)} mm</text>`);
    }
  } else if (r.beta === null || !Number.isFinite(r.x)) {
    out.push(`<text class="fuerte" x="${x0 + 40}" y="${(yTop + yBot) / 2}">x = ∞</text>`);
  }
  // Armadura con su tensión
    for (const b of r.barras) {
    const q = T([b.x, b.y]);
    const rr = Math.max(3.5, S * Math.sqrt(b.A / Math.PI));
    out.push(`<circle class="et-ba ${b.sigma >= 0 ? 'c' : 't'}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${rr.toFixed(1)}"/>`);
    if (r.barras.length <= 16) out.push(`<text x="${q[0].toFixed(1)}" y="${(q[1] + rr + 12).toFixed(1)}" text-anchor="middle">${fmt(b.sigma, 0)}</text>`);
  }
  // Franjas (armadura por área): rectángulo con su espesor equivalente y la tensión en sus dos extremos
  for (const f of r.franjas) {
    const th = Math.max(5, (S * f.A) / (f.x2 - f.x1) / 2) / S; // espesor equivalente [m], con un mínimo visible
    const quad = [[f.x1, f.y - th / 2], [f.x2, f.y - th / 2], [f.x2, f.y + th / 2], [f.x1, f.y + th / 2]].map(T);
    out.push(`<polygon class="et-fr ${(f.s1 + f.s2) / 2 >= 0 ? 'c' : 't'}" points="${pts2(quad)}"/>`);
    for (const [xe, se, lado] of [[f.x1, f.s1, -1], [f.x2, f.s2, 1]]) {
      const q = T([xe, f.y]);
      out.push(`<circle class="et-pt" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3"/><text x="${(q[0] + lado * 8).toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="${lado > 0 ? 'start' : 'end'}">${fmt(se, 0)}</text>`);
    }
  }
  // c.d.g.
  const c0 = T([xc, yc]);
  out.push(`<path class="cota" d="M${c0[0] - 6} ${c0[1]}H${c0[0] + 6}M${c0[0]} ${c0[1] - 6}V${c0[1] + 6}"/>`);
  // Orientación real de la sección y de u (arriba a la izquierda)
  const ix = 62;
  const iy = 70;
  const sc = 80 / diag;
  const Ti = (p) => [ix + sc * (p[0] - xc), iy + sc * (p[1] - yc)];
  out.push(`<text class="tit" x="${ix - 55}" y="${iy - 52}">${t('est.orient')}</text>`);
  for (const k of geo.contornos.filter((q) => q.signo > 0)) out.push(`<polygon class="hor" points="${pts2(k.pts.map(Ti))}"/>`);
  out.push(`<path class="ref" d="M${ix - 52} ${iy}H${ix + 56}M${ix} ${iy - 52}V${iy + 56}"/><text x="${ix + 58}" y="${iy + 4}">x</text><text x="${ix + 5}" y="${iy + 68}">y</text>`);
  if (r.beta !== null) {
    out.push(`<line class="en" x1="${ix}" y1="${iy}" x2="${ix + u[0] * 50}" y2="${iy + u[1] * 50}"/>`);
    out.push(`<path class="cota" d="M${ix + 26} ${iy}A26 26 0 ${r.beta > Math.PI ? 1 : 0} 0 ${ix + 26 * u[0]} ${iy + 26 * u[1]}"/><text x="${ix + 30}" y="${iy - 6}">β</text>`);
  }
  return `<svg class="dib et-svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('est.dibujoAria')}">${out.join('')}</svg>`;
}

// ---------------------------------------------------------------- resultados

const mm = (x) => fmt(x * 1000, 0);
const grados = (b) => (b === null ? '—' : fmt(b / RAD, 1));
const xTxt = (x) => (Number.isFinite(x) ? mm(x) : '∞');

function tablaEstado(r) {
  const fila = (k, etq, a, b, c) => Object.assign([etq, a, b, c], { clase: est.modo === k ? 'et-act' : '' });
  return tabla([
    fila('NM', t('est.r.NM'), fmt(r.N, MAG.N.d), fmt(r.Mx, MAG.M.d), fmt(r.My, MAG.M.d)),
    fila('eK', t('est.r.eK'), fmt(r.e0 * 1000, 2), fmt(r.kx * 1000, 2), fmt(r.ky * 1000, 2)),
    fila('sup', t('est.r.sup'), fmt(r.eSup * 1000, 2), grados(r.beta), xTxt(r.x)),
  ], { clase: 'et-estado' });
}

function tablaFibras(r) {
  const trac = r.sigmaMin >= -1e-9 && r.eInf < 0 ? ` <span class="u">(${t('est.sinTraccion')})</span>` : '';
  return tabla([
    [`${t('est.fComp')} (ε<sub>sup</sub>)`, fmt(r.eSup * 1000, 2), fmt(r.sigmaMax, 1)],
    [`${t('est.fOpuesta')} (ε<sub>inf</sub>)`, fmt(r.eInf * 1000, 2), fmt(r.sigmaMin, 1) + trac],
  ], { cabecera: ['', 'ε [‰]', 'σ [MPa]'] });
}

/** Filas de la armadura: cada barra y, de cada franja (armadura por área), sus dos extremos. */
function filasArmadura(r) {
  const b = r.barras.map((q, i) => ({ id: String(i + 1), x: q.x, y: q.y, e: q.eps, s: q.sigma }));
  const f = r.franjas.flatMap((q, i) => [
    { id: `F${i + 1}·${t('est.izq')}`, x: q.x1, y: q.y, e: q.e1, s: q.s1 },
    { id: `F${i + 1}·${t('est.der')}`, x: q.x2, y: q.y, e: q.e2, s: q.s2 },
  ]);
  return [...b, ...f];
}

function tablaBarras(ctx, r) {
  const cab = ['#', 'x [mm]', 'y [mm]', 'ε [‰]', sub('σ', 's') + ' [MPa]'];
  const todas = filasArmadura(r);
  const filas = todas.map((q) => [q.id, mm(q.x), mm(q.y), fmt(q.e * 1000, 2), fmt(q.s, 1)]);
  const smax = Math.max(...todas.map((q) => q.s));
  const smin = Math.min(...todas.map((q) => q.s));
  const copiar = async () => {
    const dec = decimalAlCopiar();
    try {
      const txt = [['#', 'x [mm]', 'y [mm]', 'eps [‰]', 'sigma_s [MPa]'].join('\t'), ...filas.map((f) => f.map((v) => v.replace('−', '-').replace('.', dec)).join('\t'))].join('\r\n');
      await navigator.clipboard.writeText(txt);
      ctx.avisar(t('graf.tablaCopiada'));
    } catch { ctx.avisar(t('graf.error')); }
  };
  // Las tensiones extremas (mayor compresión y mayor tracción de la armadura) van en negrita, sin color
  const marcadas = filas.map((f, i) => { if (todas[i].s === smax || todas[i].s === smin) f[4] = `<b>${f[4]}</b>`; return f; });
  return h('div', { class: 'et-barras' },
    h('div', { class: 'et-cab-barras' }, h('h3', {}, t('est.tBarras')), filas.length > 4 ? h('button', { type: 'button', class: 'tecla', title: t('graf.copiarTablaTit'), onclick: copiar }, t('est.copiarTabla')) : null),
    tabla(marcadas, { cabecera: cab, clase: 'rejilla' }));
}

function pastilla(c, r) {
  const sello = r.fisurada ? t('est.fisurada') : t('est.sinFisurar');
  const ley = t(`est.ley.${c.lector}`);
  return veredicto(r.fisurada ? 'atencion' : 'neutro', sello, t('est.sigmaC'), qh(r.sigmaMax, 'tension'), `${ley} · n = ${fmt(r.n, 1)}`);
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const c = calculo(p, s);
  let r = resuelve(c, s);
  if (!r.ok) throw new Error(r.motivo === 'incompatible' ? t('est.incompatible') : t('est.sinEquilibrio'));
  guarda(r);
  const nombre = s.nombre;
  const ver = pastilla(c, r);
  res.append(ver);
  if (c.mod.ley.avisos.includes('PR')) res.append(aviso(t('est.avPR')));
  if (c.mod.ley.avisos.includes('lineal')) res.append(aviso(t('est.avLineal')));
  if (r.avisos.includes('eps-cu')) res.append(aviso(t('est.avEpsCu')));

  const lienzo = h('div', { class: 'lienzo et-lienzo', html: dibujo(c, r) });
  const derecha = h('article', { class: 'panel tarjeta et-der-card' });
  const llena = (rr) => derecha.replaceChildren(tablaEstado(rr), h('h3', {}, t('est.tFibras')), tablaFibras(rr), tablaBarras(ctx, rr));
  llena(r);

  // Regletas: arrastrar recalcula dibujo y tablas sin repintar la pantalla; al soltar se repinta todo
  const refresca = () => {
    const rr = estadoTensional(c.mod, dato());
    lienzo.style.opacity = rr.ok ? '' : '.45';
    if (!rr.ok) return;
    r = rr;
    lienzo.innerHTML = dibujo(c, rr);
    llena(rr);
    const nuevo = pastilla(c, rr);
    res.querySelector(':scope > .veredicto').replaceWith(nuevo);
    rotulaSeccion(res, nombre);
  };
  const sincro = (id, mag, v) => { const el = document.getElementById(`et-${id}`); if (el) el.value = mag === 'ang1' ? String(+v.toFixed(1)) : String(+(v * MAG[mag].f).toFixed(MAG[mag].d ?? 0)); };
  const reg = (id, etq, k, mag, min, max, step, texto, aVar = (v) => v, deVar = (v) => v) => regleta({
    etq, min, max, step, valor: deVar(est[k]), etiqueta: etq.replace(/<[^>]+>/g, ''), texto,
    onInput: (v) => { est[k] = aVar(v); sincro(id, mag, est[k]); refresca(); },
    onChange: (v) => { est[k] = aVar(v); ctx.cambio(); },
  });
  const unidad = (mag, d = MAG[mag].d) => (v) => `${fmt(v, d)} ${MAG[mag].ud}`;
  const regs = [];
  if (est.modo === 'NM') {
    regs.push(reg('N', sub('N', ''), 'N', 'N', c.rg.N[0], c.rg.N[1], 1, unidad('N')));
    regs.push(reg('Mx', sub('M', 'x'), 'Mx', 'M', -c.rg.Mx, c.rg.Mx, 1, unidad('M')));
    regs.push(reg('My', sub('M', 'y'), 'My', 'M', -c.rg.My, c.rg.My, 1, unidad('M')));
  } else if (est.modo === 'eK') {
    regs.push(reg('e0', sub('ε', 'cdg'), 'e0', 'def', -1.5, 2, 0.01, (v) => `${fmt(v, 2)} ‰`, (v) => v / 1000, (v) => v * 1000));
    regs.push(reg('kx', sub('κ', 'x'), 'kx', 'curv', -c.rg.kx * 1000, c.rg.kx * 1000, 0.01, (v) => `${fmt(v, 2)} ‰/m`, (v) => v / 1000, (v) => v * 1000));
    regs.push(reg('ky', sub('κ', 'y'), 'ky', 'curv', -c.rg.ky * 1000, c.rg.ky * 1000, 0.01, (v) => `${fmt(v, 2)} ‰/m`, (v) => v / 1000, (v) => v * 1000));
  } else {
    regs.push(reg('es', sub('ε', 'sup'), 'eSup', 'def', -1.5, 3.5, 0.01, (v) => `${fmt(v, 2)} ‰`, (v) => v / 1000, (v) => v * 1000));
    regs.push(reg('b', 'β', 'beta', 'ang1', 0, 360, 0.5, (v) => `${fmt(v, 1)} °`));
    // x en escala no lineal: la última posición es ∞ (compresión uniforme); el signo sigue al de ε_sup
    const X0 = 30;
    const XM = 600;
    const aX = (q) => { const m = q >= 0.999 ? Infinity : (X0 + (XM * q) / (1 - q)) / 1000; return est.eSup < 0 ? -m : m; };
    const deX = (x) => (Number.isFinite(x) && Math.abs(x) < X_INF ? (() => { const m = Math.abs(x) * 1000 - X0; return Math.max(0, m / (m + XM)); })() : 1);
    regs.push(regleta({ etq: 'x', min: 0, max: 1, step: 0.001, valor: deX(est.x), etiqueta: t('est.nombreX'), texto: (q) => (q >= 0.999 ? '∞' : `${fmt((X0 + (XM * q) / (1 - q)), 0)} mm`),
      onInput: (q) => { est.x = aX(q); sincro('x', 'long', Number.isFinite(est.x) ? est.x : X_INF); refresca(); },
      onChange: (q) => { est.x = aX(q); ctx.cambio(); } }));
  }
  const reglas = h('div', { class: 'et-reglas' }, ...regs);
  res.append(h('div', { class: 'cuerpo dib-ancho' }, h('article', { class: 'panel tarjeta et-izq' }, lienzo, reglas), derecha));
  rotulaSeccion(res, nombre);
}

export function comandos(ctx) {
  return [{ k: 'p.estadoTensional', b: 'estado tensional tensiones servicio els deformaciones plano stress', f: () => ctx.ir('estadoTensional') }];
}
