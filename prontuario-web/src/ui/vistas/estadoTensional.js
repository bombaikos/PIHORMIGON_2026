// Análisis tensional (Secciones): deformaciones y tensiones de una sección cualquiera, en ELS o en ELU.
// La sección (geometría, armadura y materiales) viene de Secciones. El estado se da de tres maneras, siempre con regletas:
// (N, Mx, My), (ε_cdg, κx, κy) o (ε_sup, β, x). Motor: src/core/estadoTensional.js (kN, m; ε absolutas; κ en 1/m; β en rad).
// Dibujo: la sección se gira para que la fibra más comprimida quede arriba y la fibra neutra horizontal; el plano de
// deformaciones va a su derecha, perpendicular a la neutra. Compresión positiva; Mx > 0 comprime la cara superior;
// My > 0 comprime la cara derecha. Decisiones: analisis/estado-tensional-decisiones.md.

import { modeloTensional, estadoTensional, planoDeSup } from '../../core/estadoTensional.js';
import { limitesDe, admisible, leyesNoAdmitidas } from '../../core/dominioTensional.js';
import { rangos, reajusta, rangosGeneral, reajustaGeneral, TOPE } from '../../core/dominioGauges.js';
import { normaMat } from '../../norma/materiales/index.js';
import { propiedadesHormigon, opcionesHormigon, sigma } from '../../core/materiales.js';
import { geometriaDe, materialesSeccion } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, qh, MAG, decimalAlCopiar } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { veredicto } from './flexion.js';
import { SECCION_MAX, topeEscala } from '../dibujoSeccion.js';
import { leerNumero } from '../../core/armado.js';
import { h, poner, campoNum, segmentado, grupo, aviso, regleta, tabla } from '../campos.js';

const FORMAS = ['rectangular', 'pilar', 'T', 'circular', 'generica'];
const X_INF = 100; // m (100 000 mm): a partir de aquí se toma deformación uniforme (x = ∞)
const RAD = Math.PI / 180;
// β de pantalla: ángulo (antihorario desde +x) de la fibra neutra, de modo que β = 0 es la sección en su posición normal
// (Mx > 0 comprime la cara superior, neutra horizontal). El motor usa el ángulo de la dirección hacia la fibra más comprimida: 90° más.
const aMotor = (b) => (b + 90) * RAD;
const deMotor = (rad) => (((rad / RAD - 90) % 360) + 360) % 360;
const est = {
  i: null, para: null, modo: 'eK',
  N: 0, Mx: 0, My: 0, // kN, kN·m
  e0: 0, kx: 0, ky: 0, // absoluta, 1/m
  eSup: 0, beta: 0, x: Infinity, // absoluta, grados (de la fibra neutra), m
  estado: 'ELS',
  lock: { e0: false, kx: false, ky: false, eSup: false, beta: false, x: false }, // candados de los modos ε, κ y ε_sup, β, x
  // Cada estado límite guarda sus propios datos; ninguno se traduce al otro (null = el valor de la ley del material).
  // ELS: γ = 1 y αcc = 1 (sin cansancio con σc ≤ 0,6·fck); ELU: los de la ley.
  v: {
    ELS: { gammaC: 1, alfaCC: 1, gammaS: 1, phi: 0, lineal: false, kc: 0.6, ks: 0.8 },
    ELU: { gammaC: null, alfaCC: null, gammaS: null, phi: 0, lineal: false, kc: 0.6, ks: 0.8 },
  },
  ultimo: null,
};
const V = () => est.v[est.estado];
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
  const no = leyesNoAdmitidas(mats.hormigon, mats.acero);
  if (no) throw new Error(t(`est.leyNo.${no}`));
  const u = V();
  const gammaC = u.gammaC ?? prop.gammaC;
  const alfaCC = u.alfaCC ?? prop.alfa;
  const gammaS = u.gammaS ?? mats.acero.gamma; // el del material de la sección, salvo que se cambie aquí
  const els = est.estado === 'ELS';
  const phi = els ? u.phi : 0;
  const lineal = els && u.lineal;
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, est.estado, gammaC, alfaCC, gammaS, phi, lineal, u.kc, u.ks]);
  if (memo.clave === clave) return memo.c;
  const mod = modeloTensional(geo, mats.hormigon, mats.acero, { gammaC, alfaCC, gammaS, phi, lineal, fctm: prop.fctm });
  const lim = limitesDe(mod, est.estado, { kc: u.kc, ks: u.ks });
  const norm = propiedadesHormigon(fck, p.norma, {});
  const normaGammaS = normaMat(p.norma).gammaS;
  const mc = els ? 0.6 : 1;
  const ms = els ? 0.8 : 1;
  const caja = geo.caja;
  const bx = caja.xmax - caja.xmin;
  const hy = caja.ymax - caja.ymin;
  const Ac = mod.Ac;
  const As = mod.puntos.reduce((a, b) => a + b.A, 0);
  const fyk = mats.acero.fk / 1000;
  const c = {
    geo, mats, mod, prop, gammaC, alfaCC, gammaS, fck, bx, hy, lim, els,
    esperado: els ? { gammaC: 1, alfaCC: 1, gammaS: 1 } : { gammaC: norm.gammaC, alfaCC: norm.alfa, gammaS: normaGammaS },
    // Recorrido de las regletas: del orden de lo que resiste la sección (ELS: 0,6·fck y 0,8·fyk; ELU: fck y fyk)
    rg: {
      N: [Math.round(-ms * fyk * As * 1000 / 10) * 10 || -100, Math.round((mc * fck * Ac * 1000) / 10) * 10],
      Mx: Math.ceil((mc * fck * 1000 * (Ac * hy) / 6) / 10) * 10 || 100,
      My: Math.ceil((mc * fck * 1000 * (Ac * bx) / 6) / 10) * 10 || 100,
      kx: 0.008 / hy, ky: 0.008 / bx, // 8 ‰ de deformación a lo largo del canto, no más
    },
    lector: leyDe(mats.hormigon, lineal),
  };
  memo = { clave, c };
  return c;
}

const leyDe = (mat, lineal) => (lineal ? 'lineal' : mat.diag === 'EC2' ? 'sargin' : mat.diag === 'puntos' ? 'puntos' : 'PR');

/** El dato que entiende el motor, desde lo que hay en pantalla. */
function dato() {
  if (est.modo === 'NM') return { tipo: 'NM', N: est.N, Mx: est.Mx, My: est.My };
  if (est.modo === 'eK') return { tipo: 'eK', e0: est.e0, kx: est.kx, ky: est.ky };
  return { tipo: 'sup', eSup: est.eSup, beta: aMotor(est.beta), x: est.x };
}

/** Pasa el estado calculado a las variables de los tres modos, para que al cambiar de modo no se pierda. */
function guarda(r) {
  est.N = r.N; est.Mx = r.Mx; est.My = r.My;
  est.e0 = r.e0; est.kx = r.kx; est.ky = r.ky;
  est.eSup = r.eSup;
  if (r.beta !== null) est.beta = deMotor(r.beta);
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

/** Un dato que no procede en este estado se queda en su sitio, desactivado, y su (i) o su rótulo dicen por qué (guía: nada aparece y desaparece). */
function apaga(el, motivo) {
  for (const i of el.querySelectorAll('input, select')) i.disabled = true;
  el.title = motivo;
  el.classList.add('no-aplica');
  return el;
}

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
  // γ y αcc: con el valor esperado del estado límite (ELS: 1,00; ELU: el de la norma) van normales; con otro, en rojo y con su (i)
  const gamma = (id, etq, k, defecto) => {
    const valor = V()[k] ?? defecto;
    const dist = c && Math.abs(valor - c.esperado[k]) > 1e-9;
    const info = dist ? t('est.infoDist', fmt(c.esperado[k], 2), est.estado) : id === 'gc' ? t('est.infoGamma') : id === 'gs' ? t('est.infoGammaS') : undefined;
    const e = campoNum({ id: `et-${id}`, etq, valor: fmt(valor, 2), mag: null, paso: 0.05, min: 0.01, max: 10, sinUd: true, nombre: etq.replace(/<[^>]+>/g, ''), info, onCambio: (v) => { V()[k] = v; ctx.pintar(); } });
    e.classList.toggle('disc', !!dist);
    return e;
  };
  const els = est.estado === 'ELS';
  const lim = c?.lim;
  const limTxt = lim ? (els
    ? `${sub('ε', 'c,lím')} ${fmt(lim.ec * 1000, 2)} ‰ · ${sub('ε', 's,lím')} ${fmt(lim.esT * 1000, 2)} ‰`
    : `${sub('ε', 'cu')} ${fmt(lim.ecu * 1000, 2)} ‰ · ${sub('ε', 'c2')} ${fmt((lim.pivote?.ec2 ?? lim.ecu) * 1000, 2)} ‰ · ${sub('ε', 'ud')} ${fmt(lim.esT * 1000, 2)} ‰`) : '';
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('est.estadoLimite'), opciones: [['ELS', 'ELS'], ['ELU', 'ELU']], valor: est.estado, onCambio: (m) => { est.estado = m; ctx.pintar(); } }),
    segmentado({ ancho: true, capsula: true, etiqueta: t('est.modo'), opciones: [['NM', t('est.m.NM')], ['eK', t('est.m.eK')], ['sup', t('est.m.sup')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('est.gHormigon'),
      h('div', { class: 'fila-campos et-fc' }, c ? gamma('gc', t('est.gammaC'), 'gammaC', c.gammaC) : null, c ? gamma('ac', t('est.alfaCC'), 'alfaCC', c.alfaCC) : null),
      h('div', { class: 'fila-campos et-fc' },
        els ? campoNum({ id: 'et-phi', etq: t('est.phi'), valor: fmt(V().phi, 2), mag: null, paso: 0.1, min: 0, max: 10, sinUd: true, info: t('est.infoPhi'), onCambio: (v) => { V().phi = v; ctx.pintar(); } })
          : apaga(campoNum({ id: 'et-phi', etq: t('est.phi'), valor: '—', mag: null, sinUd: true, info: t('est.noELU.phi'), onCambio: () => {} }), t('est.noELU.phi')),
        els ? campoNum({ id: 'et-kc', etq: t('est.kc'), valor: fmt(V().kc, 2), mag: null, paso: 0.05, min: 0.05, max: 1, sinUd: true, info: t('est.infoKc'), onCambio: (v) => { V().kc = v; ctx.pintar(); } })
          : apaga(campoNum({ id: 'et-kc', etq: t('est.kc'), valor: '—', mag: null, sinUd: true, info: t('est.noELU.k'), onCambio: () => {} }), t('est.noELU.k'))),
      els ? h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'et-lineal', checked: V().lineal, onchange: (e) => { V().lineal = e.target.checked; ctx.pintar(); } }), h('span', { html: t('est.lineal') }))
        : apaga(h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'et-lineal', checked: false }), h('span', { html: t('est.lineal') })), t('est.noELU.lineal')),
      c ? h('div', { class: `et-der${els ? '' : ' no-aplica'}` },
        h('span', {}, 'E', h('sub', {}, 'c,eff'), els ? ` ${fmt(c.mod.ley.pendiente / 1000, 0)} MPa` : ' —'),
        h('span', {}, els ? `n = ${fmt(c.mod.acero.E / c.mod.ley.pendiente, 1)}` : 'n = —')) : null),
    grupo(t('est.gAcero'),
      h('div', { class: 'fila-campos et-fc' }, c ? gamma('gs', t('est.gammaS'), 'gammaS', c.gammaS) : null,
        els ? campoNum({ id: 'et-ks', etq: t('est.ks'), valor: fmt(V().ks, 2), mag: null, paso: 0.05, min: 0.05, max: 1.5, sinUd: true, info: t('est.infoKs'), onCambio: (v) => { V().ks = v; ctx.pintar(); } })
          : apaga(campoNum({ id: 'et-ks', etq: t('est.ks'), valor: '—', mag: null, sinUd: true, info: t('est.noELU.k'), onCambio: () => {} }), t('est.noELU.k'))),
      c ? h('div', { class: 'et-der', html: limTxt }) : null));
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

const W = 900;
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
  const S = Math.min((H - 130) / diag, SECCION_MAX / Math.max(c.bx, c.hy)); // px por m; no cambia al girar; lado mayor ≤ 300 px (guía § 8)
  const cx = W * 0.30;
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
  // Escala del plano: lo traccionado va a la izquierda de la línea base y lo comprimido a la derecha; las etiquetas
  // (ε a la derecha, «fibra neutra» a 200 px de la base) tienen que caber en el dibujo, así que la escala se limita
  const base0 = cx + S * lmax + 50;
  const SIG_W = 80; // anchura máxima del diagrama de tensiones del hormigón [px]
  const comp = Math.max(0, r.eSup, r.eInf);
  // A la derecha del plano va el diagrama de tensiones del hormigón: etiqueta de ε (120), diagrama (80) y su etiqueta (115)
  const escE = Math.min((W * 0.2) / Math.max(Math.abs(r.eSup), Math.abs(r.eInf), 5e-4),
    (W - 8 - SIG_W - 115 - 120 - base0) / Math.max(tr + comp, 1e-9));
  const x0 = base0 + tr * escE;
  const x1 = x0 + comp * escE + 120; // línea base de las tensiones
  const aT = [x0 + r.eSup * escE, yTop];
  const aB = [x0 + r.eInf * escE, yBot];
  out.push(`<line class="eje" x1="${x0}" y1="${yTop}" x2="${x0}" y2="${yBot}"/>`);
  // Parte comprimida (ε > 0) y parte traccionada (ε < 0) del plano, con su estilo
  const yCero = r.eSup === r.eInf ? yTop : yTop + ((yBot - yTop) * r.eSup) / (r.eSup - r.eInf);
  if (r.eSup > 0 && r.eInf < 0) {
    out.push(`<polygon class="eps-c" points="${pts2([[x0, yTop], aT, [x0, yCero]])}"/><polygon class="eps-t" points="${pts2([[x0, yCero], [x0, yBot], aB])}"/>`);
  } else out.push(`<polygon class="${r.eSup >= 0 && r.eInf >= 0 ? 'eps-c' : 'eps-t'}" points="${pts2([[x0, yTop], aT, aB, [x0, yBot]])}"/>`);
  const etq = (q, nombre, e, arriba) => `<text x="${q[0] + (e >= 0 ? 6 : -6)}" y="${q[1] + (arriba ? 4 : 4)}" text-anchor="${e >= 0 ? 'start' : 'end'}">${svgSub('ε', nombre)} ${fmt(e * 1000, 2)} ‰</text>`;
  out.push(etq(aT, 'sup', r.eSup, true), etq(aB, 'inf', r.eInf, false));
  // Diagrama de tensiones del hormigón (con la ley en uso: sin fisurar, con su rama de tracción; fisurada, sin ella)
  const ley = r.fisurada ? mod.ley.fisurada : mod.ley.integra;
  const sH = (e) => -sigma(ley, -e) / 1000; // MPa, compresión +
  const NS = 48;
  const mu = Array.from({ length: NS + 1 }, (_, i) => { const tt = i / NS; const e = r.eSup + (r.eInf - r.eSup) * tt; return { y: yTop + (yBot - yTop) * tt, s: sH(e) }; });
  const sTop = mu[0].s;
  const sBot = mu[NS].s;
  const sEsc = SIG_W / Math.max(Math.abs(sTop), Math.abs(sBot), 1e-6);
  out.push(`<line class="eje" x1="${x1}" y1="${yTop}" x2="${x1}" y2="${yBot}"/>`);
  const cP = mu.filter((q) => q.s > 1e-9);
  const tP = mu.filter((q) => q.s < -1e-9);
  const yCeroS = cP.length && tP.length ? (cP[cP.length - 1].y + tP[0].y) / 2 : null;
  if (cP.length) out.push(`<polygon class="eps-c" points="${pts2([[x1, cP[0].y], ...cP.map((q) => [x1 + q.s * sEsc, q.y]), [x1, yCeroS ?? cP[cP.length - 1].y]])}"/>`);
  if (tP.length) out.push(`<polygon class="eps-t" points="${pts2([[x1, yCeroS ?? tP[0].y], ...tP.map((q) => [x1 + q.s * sEsc, q.y]), [x1, tP[tP.length - 1].y]])}"/>`);
  if (sTop > 1e-9) out.push(`<text x="${(x1 + sTop * sEsc + 6).toFixed(1)}" y="${yTop + 4}">${svgSub('σ', 'c')} ${fmt(sTop, MAG.tension.d)} MPa</text>`);
  if (sBot < -1e-9) out.push(`<text x="${(x1 + 6).toFixed(1)}" y="${yBot + 4}">${svgSub('σ', 'ct')} ${fmt(sBot, MAG.tension.d)} MPa</text>`);
  // Fibra neutra (sin rótulo) y x, acotada a la izquierda del plano
  if (r.beta !== null && Number.isFinite(r.x) && r.x !== 0) {
    const yN = yTop + S * r.x;
    if (yN > yTop - 30 && yN < yBot + 30) {
      out.push(`<line class="en" x1="${cx - S * diag / 2 - 10}" y1="${yN}" x2="${x1 + SIG_W}" y2="${yN}"/>`);
      const xc2 = x0 - 26;
      out.push(`<line class="cota" x1="${xc2}" y1="${yTop}" x2="${xc2}" y2="${yN}" marker-start="url(#tic)" marker-end="url(#tic)"/><text class="fuerte" text-anchor="end" style="paint-order:stroke;stroke:var(--hoja);stroke-width:4px" x="${xc2 - 6}" y="${(yTop + yN) / 2 + 4}">x = ${fmt(r.x * 1000, 0)} mm</text>`);
    }
  } else if (r.beta === null || !Number.isFinite(r.x)) {
    out.push(`<text class="fuerte" x="${x0 - 30}" y="${(yTop + yBot) / 2}" text-anchor="end">x = ∞</text>`);
  }
  // Armadura con su tensión (con más de 10 puntos, solo se escriben los extremos de cada signo)
  const ver = visibles(filasArmadura(r));
  const etiquetas = [];
  for (const [ib, b] of r.barras.entries()) {
    const q = T([b.x, b.y]);
    const rr = Math.max(3.5, S * Math.sqrt(b.A / Math.PI));
    out.push(`<circle class="et-ba ${b.sigma >= 0 ? 'c' : 't'}" data-ref="b${ib}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${rr.toFixed(1)}"/>`);
    if (ver.has(ib)) etiquetas.push({ ib, q, rr, s: b.sigma });
  }
  // Etiquetas de σ de las barras: las de mayor |σ| primero; se omiten las que quedarían pisando a otra ya puesta (guía § 15); la tabla las da todas
  const puestas = [];
  for (const e of etiquetas.sort((p, q) => Math.abs(q.s) - Math.abs(p.s))) {
    const x = e.q[0];
    const y = e.q[1] + e.rr + 12;
    if (puestas.some((o) => Math.abs(o.x - x) < 80 && Math.abs(o.y - y) < 16)) continue;
    puestas.push({ x, y });
    out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${fmt(e.s, 0)}</text>`);
  }
  // Franjas (armadura por área): rectángulo con su espesor equivalente y la tensión en sus dos extremos
  for (const [jf, f] of r.franjas.entries()) {
    const th = Math.max(5, (S * f.A) / (f.x2 - f.x1) / 2) / S; // espesor equivalente [m], con un mínimo visible
    const quad = [[f.x1, f.y - th / 2], [f.x2, f.y - th / 2], [f.x2, f.y + th / 2], [f.x1, f.y + th / 2]].map(T);
    out.push(`<polygon class="et-fr ${(f.s1 + f.s2) / 2 >= 0 ? 'c' : 't'}" points="${pts2(quad)}"/>`);
    for (const [ie, [xe, se, lado]] of [[f.x1, f.s1, -1], [f.x2, f.s2, 1]].entries()) {
      const q = T([xe, f.y]);
      const eti = ver.has(r.barras.length + 2 * jf + ie);
      out.push(`<circle class="et-pt" data-ref="f${jf}-${ie}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3"/>${eti ? `<text x="${(q[0] + lado * 8).toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="${lado > 0 ? 'start' : 'end'}">${fmt(se, 0)}</text>` : ''}`);
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
    // Fibra neutra (β desde +x, antihorario) y arco de β
    const bn = (((r.beta - Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const w = [Math.cos(bn), -Math.sin(bn)];
    out.push(`<line class="en" x1="${ix - w[0] * 50}" y1="${iy - w[1] * 50}" x2="${ix + w[0] * 50}" y2="${iy + w[1] * 50}"/>`);
    out.push(`<path class="cota" d="M${ix + 26} ${iy}A26 26 0 ${bn > Math.PI ? 1 : 0} 0 ${ix + 26 * w[0]} ${iy + 26 * w[1]}"/><text x="${ix + 30}" y="${iy - 6}">β</text>`);
  }
  return `<svg class="dib et-svg" preserveAspectRatio="xMidYMin meet" viewBox="0 0 ${W} ${H}"${topeEscala(W, H)} role="img" aria-label="${t('est.dibujoAria')}">${out.join('')}</svg>`;
}

// ---------------------------------------------------------------- resultados

const mm = (x) => fmt(x * 1000, 0);
const grados = (b) => (b === null ? '—' : fmt(deMotor(b), 1));
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
  const b = r.barras.map((q, i) => ({ ref: `b${i}`, id: String(i + 1), x: q.x, y: q.y, e: q.eps, s: q.sigma }));
  const f = r.franjas.flatMap((q, i) => [
    { ref: `f${i}-0`, id: `F${i + 1}·${t('est.izq')}`, x: q.x1, y: q.y, e: q.e1, s: q.s1 },
    { ref: `f${i}-1`, id: `F${i + 1}·${t('est.der')}`, x: q.x2, y: q.y, e: q.e2, s: q.s2 },
  ]);
  return [...b, ...f];
}

/** Con más de 10 puntos de armadura solo se muestran los extremos de cada signo: mayor y menor σ de compresión y de tracción. */
const MAX_PUNTOS = 10;
function visibles(todas) {
  if (todas.length <= MAX_PUNTOS) return new Set(todas.keys());
  const out = new Set();
  const por = (signo) => {
    const lista = todas.map((q, i) => [q.s, i]).filter(([v]) => (signo > 0 ? v >= 0 : v < 0));
    if (!lista.length) return;
    out.add(lista.reduce((a, b) => (Math.abs(b[0]) > Math.abs(a[0]) ? b : a))[1]);
    out.add(lista.reduce((a, b) => (Math.abs(b[0]) < Math.abs(a[0]) ? b : a))[1]);
  };
  por(1); por(-1);
  return out;
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
  const ver = visibles(todas);
  const marcadas = filas.map((f, i) => { f.ref = todas[i].ref; if (todas[i].s === smax || todas[i].s === smin) f[4] = `<b>${f[4]}</b>`; return f; }).filter((_, i) => ver.has(i));
  return h('div', { class: 'et-barras' },
    h('div', { class: 'et-cab-barras' }, h('h3', {}, t('est.tBarras')), marcadas.length > 4 || filas.length > marcadas.length ? h('button', { type: 'button', class: 'tecla', title: t('graf.copiarTablaTit'), onclick: copiar }, t('est.copiarTabla')) : null),
    tabla(marcadas, { cabecera: cab, clase: 'rejilla' }),
    ver.size < filas.length ? h('p', { class: 'et-nota', html: t('est.soloExtremos', filas.length) }) : null);
}

function pastilla(c, r) {
  const sello = r.fisurada ? t('est.fisurada') : t('est.sinFisurar');
  const ley = t(`est.ley.${c.lector}`);
  return veredicto(r.fisurada ? 'atencion' : 'neutro', sello, t('est.sigmaC'), qh(r.sigmaMax, 'tension'), `${ley} · n = ${fmt(r.n, 1)}`);
}

/** Esfuerzos del estado, siempre sobre la figura: N, Mx y My (N en rosa si es de tracción). */
function cabeceraEsfuerzos(r) {
  const par = (etq, v, ud, clase = '') => h('span', { class: `et-esf-v ${clase}`.trim() }, h('span', { class: 'et-esf-e', html: etq }), ' = ', h('b', {}, v), h('span', { class: 'et-esf-u' }, ` ${ud}`));
  return [par('N', fmt(r.N, MAG.N.d), 'kN', r.N < 0 ? 'trac' : ''), par(sub('M', 'x'), fmt(r.Mx, MAG.M.d), 'kN·m'), par(sub('M', 'y'), fmt(r.My, MAG.M.d), 'kN·m')];
}

/** Desplegable de fondo ámbar con lo que dicen los apartados del EC-2 sobre las limitaciones de tensión en servicio. */
function notaEC2() {
  return h('details', { class: 'pleg pleg-amb' }, h('summary', {}, t('est.ec2.titulo')),
    h('div', { class: 'cuenta' }, ...['est.ec2.c', 'est.ec2.s', 'est.ec2.k'].map((k) => h('p', { class: 'nota', html: t(k) }))));
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
  if (c.els && c.mod.ley.avisos.includes('PR')) res.append(aviso(t('est.avPR')));
  if (c.mod.ley.avisos.includes('lineal')) res.append(aviso(t('est.avLineal')));
  const dom = admisible(c.mod, c.lim, r.plano);
  if (!dom.ok) res.append(aviso(t(`est.fuera.${dom.limita}`, est.estado, fmt(-dom.holgura * 1000, 2)), 'error'));
  if (c.els) res.append(notaEC2());

  const esf = h('div', { class: 'et-esf', role: 'status' }, ...cabeceraEsfuerzos(r));
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
    esf.replaceChildren(...cabeceraEsfuerzos(rr));
    llena(rr);
    const nuevo = pastilla(c, rr);
    res.querySelector(':scope > .veredicto').replaceWith(nuevo);
    rotulaSeccion(res, nombre);
  };
  const ENT = { N: { ud: 'kN', d: 0 }, M: { ud: 'kN·m', d: 0 }, def: { ud: '‰', d: 2 }, ang1: { ud: '°', d: 1 } };
  const reg = (id, etq, k, mag, min, max, step, texto, aVar = (v) => v, deVar = (v) => v) => regleta({
    entrada: ENT[mag],
    clase: k === 'N' && est.N < 0 ? 'trac' : '',
    etq, min, max, step, valor: deVar(est[k]), reinicio: 0, etiqueta: etq.replace(/<[^>]+>/g, ''), texto,
    onInput: (v) => { est[k] = aVar(v); if (k === 'N') document.querySelector('.et-reglas .regleta')?.classList.toggle('trac', est.N < 0); refresca(); },
    onChange: (v) => { est[k] = aVar(v); ctx.cambio(); },
  });
  const unidad = (mag, d = MAG[mag].d) => (v) => `${fmt(v, d)} ${MAG[mag].ud}`;
  const regs = [];
  if (est.modo === 'NM') {
    regs.push(reg('N', sub('N', ''), 'N', 'N', c.rg.N[0], c.rg.N[1], 1, unidad('N')));
    regs.push(reg('Mx', sub('M', 'x'), 'Mx', 'M', -c.rg.Mx, c.rg.Mx, 1, unidad('M')));
    regs.push(reg('My', sub('M', 'y'), 'My', 'M', -c.rg.My, c.rg.My, 1, unidad('M')));
  } else if (est.modo === 'eK') {
    regs.push(...gaugesEK(c, refresca, ctx));
  } else {
    regs.push(...gaugesSup(c, refresca, ctx));
  }
  const reglas = h('div', { class: 'et-reglas' }, ...regs);
  res.append(h('div', { class: 'cuerpo dib-ancho' }, h('article', { class: 'panel tarjeta et-izq' }, esf, lienzo, reglas), derecha));
  rotulaSeccion(res, nombre);
}


// ---------------------------------------------------------------- gauges del modo ε, κ (rango total, banda y candados)

const EK = ['e0', 'kx', 'ky'];
const RETARDO = 90; // ms: los rangos se recalculan al parar de mover, no en cada píxel

/**
 * Tres regletas con rango total (extremos escritos), banda compatible y candado. Mover dentro de la banda cambia solo esa
 * variable; fuera de la banda, las otras libres se reajustan lo mínimo (en proporción a su rango total) para seguir en el dominio.
 */
function gaugesEK(c, refresca, ctx) {
  const esc = [0.005, c.rg.kx, c.rg.ky];
  const en = (u) => admisible(c.mod, c.lim, { e0: u[0] * esc[0], kx: u[1] * esc[1], ky: u[2] * esc[2] }).ok;
  const cand = () => EK.map((k) => est.lock[k]);
  const uDe = () => EK.map((k, j) => est[k] / esc[j]);
  const aEst = (u) => EK.forEach((k, j) => { est[k] = u[j] * esc[j]; });
  const f = [{ k: 'e0', mag: 'def', etq: sub('ε', 'cdg'), ud: '‰' }, { k: 'kx', mag: 'curv', etq: sub('κ', 'x'), ud: '‰/m' }, { k: 'ky', mag: 'curv', etq: sub('κ', 'y'), ud: '‰/m' }];
  let R = rangos(en, uDe(), cand());
  const regs = f.map((q, j) => regleta({
    entrada: { ud: q.ud, d: 2 }, etq: q.etq, min: -1, max: 1, step: 0.01, valor: est[q.k] * 1000, reinicio: 0, etiqueta: q.k, texto: (v) => `${fmt(v, 2)} ${q.ud}`,
    gauge: { bloqueado: est.lock[q.k], onCandado: () => { est.lock[q.k] = !est.lock[q.k]; ctx.cambio(); } },
    onInput: (v) => mueve(j, v / 1000),
    onChange: () => { clearTimeout(timer); ctx.cambio(); },
  }));
  const pinta = () => {
    const u = uDe();
    regs.forEach((rg, j) => {
      const tot = R.total ? R.total[j].map((x) => x * esc[j] * 1000) : [-TOPE * esc[j] * 1000, TOPE * esc[j] * 1000];
      const ban = R.banda ? R.banda[j].map((x) => x * esc[j] * 1000) : null;
      rg.rango({ min: Math.min(tot[0], u[j] * esc[j] * 1000), max: Math.max(tot[1], u[j] * esc[j] * 1000), banda: ban, fuera: !R.dentro, bloqueado: est.lock[f[j].k], fmtExt: (x) => fmt(x, 2) });
      rg.poner(est[f[j].k] * 1000);
    });
  };
  let timer = 0;
  const mueve = (j, v) => {
    const u = uDe();
    const nuevo = v / esc[j];
    const b = R.banda?.[j];
    const dentroBanda = b && nuevo >= b[0] - 1e-9 && nuevo <= b[1] + 1e-9;
    if (dentroBanda || !R.dentro) { est[f[j].k] = v; } else {
      const q = reajusta(en, u, j, nuevo, cand(), R);
      if (q) aEst(q); else est[f[j].k] = Math.min(b[1], Math.max(b[0], nuevo)) * esc[j];
    }
    regs.forEach((rg, m) => rg.poner(est[EK[m]] * 1000));
    refresca();
    clearTimeout(timer);
    timer = setTimeout(() => { R = rangos(en, uDe(), cand()); pinta(); }, RETARDO);
  };
  pinta();
  return regs;
}

// ---------------------------------------------------------------- gauges del modo ε_sup, β, x

const X0 = 30;
const XM = 600;
const xDeQ = (q, eSup) => { const m = q >= 0.999 ? Infinity : (X0 + (XM * q) / (1 - q)) / 1000; return eSup < 0 ? -m : m; };
const qDeX = (x) => (Number.isFinite(x) && Math.abs(x) < X_INF ? (() => { const m = Math.abs(x) * 1000 - X0; return Math.max(0, m / (m + XM)); })() : 1);
const xTexto = (q) => (q >= 0.999 ? '∞' : fmt(X0 + (XM * q) / (1 - q), 0));

/** Como gaugesEK, pero con ε_sup, β (cíclica) y x (escala no lineal, signo del de ε_sup). */
function gaugesSup(c, refresca, ctx) {
  const ESC = 0.005;
  const SUP = ['eSup', 'beta', 'x'];
  const dom = [{ lo: -TOPE, hi: TOPE }, { lo: 0, hi: 360, cic: true }, { lo: 0, hi: 1 }];
  const en = (u) => {
    const pl = planoDeSup(c.mod, u[0] * ESC, aMotor(u[1]), xDeQ(u[2], u[0]));
    return !!pl && admisible(c.mod, c.lim, pl).ok;
  };
  const cand = () => SUP.map((k) => est.lock[k]);
  const pDe = () => [est.eSup / ESC, est.beta, qDeX(est.x)];
  const aEst = (p) => { est.eSup = p[0] * ESC; est.beta = p[1]; est.x = xDeQ(p[2], est.eSup); };
  let R = rangosGeneral(en, dom, pDe(), cand());
  let timer = 0;
  const por = (j) => ({
    0: { ud: '‰', d: 2, fmtExt: (x) => fmt(x * ESC * 1000, 2), a: (p) => p * ESC * 1000 },
    1: { ud: '°', d: 1, fmtExt: (x) => fmt(x, 1), a: (p) => p },
    2: { ud: 'mm', fmtExt: (x) => xTexto(x), a: (p) => p },
  })[j];
  const regs = [
    regleta({ entrada: { ud: '‰', d: 2 }, etq: sub('ε', 'sup'), min: -1.5, max: 3.5, step: 0.01, valor: est.eSup * 1000, reinicio: 0, etiqueta: 'eSup', texto: (v) => `${fmt(v, 2)} ‰`,
      gauge: { bloqueado: est.lock.eSup, onCandado: () => { est.lock.eSup = !est.lock.eSup; ctx.cambio(); } },
      onInput: (v) => mueve(0, v / 1000 / ESC), onChange: () => { clearTimeout(timer); ctx.cambio(); } }),
    regleta({ entrada: { ud: '°', d: 1 }, etq: 'β', min: 0, max: 360, step: 0.5, valor: est.beta, reinicio: 0, etiqueta: 'beta', texto: (v) => `${fmt(v, 1)} °`,
      gauge: { bloqueado: est.lock.beta, onCandado: () => { est.lock.beta = !est.lock.beta; ctx.cambio(); } },
      onInput: (v) => mueve(1, v), onChange: () => { clearTimeout(timer); ctx.cambio(); } }),
    regleta({ entrada: { ud: 'mm', mostrar: (q) => xTexto(q), leer: (txt) => { if (/^\s*(∞|inf)/i.test(txt)) return 1; const m = leerNumero(txt); return m <= X0 ? 0 : (m - X0) / (m - X0 + XM); } },
      etq: 'x', min: 0, max: 1, step: 0.001, valor: qDeX(est.x), etiqueta: t('est.nombreX'), reinicio: 1, texto: (q) => `${xTexto(q)} mm`,
      gauge: { bloqueado: est.lock.x, onCandado: () => { est.lock.x = !est.lock.x; ctx.cambio(); } },
      onInput: (q) => mueve(2, q), onChange: () => { clearTimeout(timer); ctx.cambio(); } }),
  ];
  const poner = () => { regs[0].poner(est.eSup * 1000); regs[1].poner(est.beta); regs[2].poner(qDeX(est.x)); };
  const pinta = () => {
    const p = pDe();
    regs.forEach((rg, j) => {
      const tot = R.total ? R.total[j] : [dom[j].lo, dom[j].hi];
      const cv = (x) => por(j).a(x);
      rg.rango({ min: cv(Math.min(tot[0], p[j])), max: cv(Math.max(tot[1], p[j])), banda: R.banda ? R.banda[j].map((t2) => t2.map(cv)) : null, fuera: !R.dentro, bloqueado: est.lock[SUP[j]], fmtExt: por(j).fmtExt });
    });
    poner();
  };
  const mueve = (j, v) => {
    const p = pDe();
    const tr = R.banda?.[j];
    const dentroBanda = tr && tr.some(([a, b]) => v >= a - 1e-9 && v <= b + 1e-9);
    if (dentroBanda || !R.dentro) { p[j] = v; aEst(p); } else {
      const q = reajustaGeneral(en, dom, p, j, v, cand(), R);
      if (q) aEst(q);
    }
    poner();
    refresca();
    clearTimeout(timer);
    timer = setTimeout(() => { R = rangosGeneral(en, dom, pDe(), cand()); pinta(); }, RETARDO);
  };
  pinta();
  return regs;
}

export function comandos(ctx) {
  return [{ k: 'p.estadoTensional', b: 'estado tensional tensiones servicio els deformaciones plano stress', f: () => ctx.ir('estadoTensional') }];
}
