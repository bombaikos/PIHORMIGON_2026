// Torsión pura de vigas y pilares rectangulares (módulo TT2 del Prontuario 3.1, rehecho por norma).
// Una pantalla que cambia con la norma del proyecto: EHE-08, EC-2 2004 + AN y EC-2 2023 (norma/torsion/).
// La sección (b, h y recubrimiento) viene de Secciones; aquí se puede cambiar sin modificarla. El programa NO hace la
// interacción con cortante, flexión ni axil: lo recuerda en un desplegable (decisión de Pepiño, 31/10/2026).

import { nucleo, areaRama } from '../../norma/torsion/index.js';
import { aceroTipificado } from '../../core/materiales.js';
import { datosCortante } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, serieDiametros } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, cifras, tabla, regleta } from '../campos.js';
import { veredicto } from './flexion.js';
import { dibujoTorsion } from '../dibujoTorsion.js';

const FORMAS = ['rectangular', 'pilar'];
const est = {
  i: null, modo: 'comprobar', he: null, TEd: 30, cot: 1, fi: 10, s: 150, Al: 800, alfa: 0.6, aceroCercos: null,
  ov: { b: null, h: null, c: null }, abiertos: new Set(),
};
export function reiniciar() { est.i = null; est.he = null; est.ov = { b: null, h: null, c: null }; est.aceroCercos = null; }

const RAD = Math.PI / 180;
const thetaDe = (cot) => Math.atan(1 / cot) / RAD;
const limitesTheta = (rg) => ({
  min: Math.ceil(+(Math.atan(1 / rg.max) / RAD).toFixed(6) * 10) / 10,
  max: Math.floor(+(Math.atan(1 / rg.min) / RAD).toFixed(6) * 10) / 10,
});
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const secciones = (p) => p.secciones.filter((s) => FORMAS.includes(s.forma));
const nuc = (p) => nucleo(p.norma);
const diametros = () => serieDiametros().filter((x) => x >= 6 && x <= 20);
const tablaDiam = () => serieDiametros().filter((x) => x >= 8 && x <= 16);
const mmEnt = (x) => Math.round(x * 1000) / 1000;
const tipoNorma = (p) => ({ 'EHE-08': 'ehe', 'EC2-2004': 'ec', 'EC2-2023': '23' }[nuc(p)?.id]);
const parejas = (campos) => {
  const c = campos.filter(Boolean);
  const filas = [];
  for (let i = 0; i < c.length; i += 2) filas.push(h('div', { class: 'par2' }, ...c.slice(i, i + 2)));
  return filas;
};
/** Control que no procede: se queda en su sitio, apagado, con una (i) que dice por qué. */
const apaga = (c, motivo) => {
  for (const el of c.querySelectorAll('input, select')) el.disabled = true;
  c.classList.add('no-aplica');
  return conInfo(c, motivo);
};
/** Añade la (i) junto a la etiqueta con una aclaración corta. */
const conInfo = (c, texto) => {
  c.title = texto;
  c.insertBefore(h('span', { class: 'info-i izq', tabindex: 0, role: 'img', 'aria-label': texto, 'data-tip': texto }, 'i'), c.querySelector('.caja'));
  return c;
};
const calculado = (c, v) => { const i = c.querySelector('input'); i.disabled = true; i.tabIndex = -1; i.value = v; c.classList.add('calculado'); return c; };

function activa(p) {
  const L = secciones(p);
  if (!L.length) return null;
  if (!L.some((s) => p.secciones.indexOf(s) === est.i)) { est.i = p.secciones.indexOf(L[0]); est.ov = { b: null, h: null, c: null }; }
  return p.secciones[est.i];
}

/** Datos de la sección en mm, con los cambios hechos en este módulo. */
function efectivos(p, s) {
  const sec = datosCortante(p, s, { signo: 1, dir: 'h' });
  return { sec, b: est.ov.b ?? sec.b0 * 1000, h: est.ov.h ?? sec.h * 1000, c: est.ov.c ?? (sec.h - sec.d) * 1000 };
}
function entrada(p, s, sec, g) {
  const acero = p.aceros.find((m) => m.nombre === (est.aceroCercos ?? s.acero)) ?? p.aceros[0];
  return {
    fck: sec.fck, ktc: sec.ktc, fykCercos: acero.fyk, fykLong: sec.fyk, b: g.b, h: g.h, c: g.c, he: est.he ?? undefined,
    cotTheta: est.cot, AtS: areaRama(est.fi) / est.s, s: est.s, Al: est.Al, TEd: est.TEd, alfaCercos: est.alfa,
    ductilidad: acero.ductilidad ?? aceroTipificado(acero.nombre)?.ductilidad ?? 'B',
  };
}
function ajustaCot(p) {
  const rg = nuc(p).rangoCot();
  est.cot = Math.min(Math.max(est.cot, rg.min), rg.max);
  return rg;
}

export function datos(ctx, form) {
  const p = ctx.p;
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.torsion'))));
  if (!nuc(p)) return poner(form, aviso(t('tor.pendiente', p.norma), 'info'));
  if (!secciones(p).length) return poner(form, aviso(t('tor.sinSec'), 'info'));
  const s = activa(p);
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; est.ov = { b: null, h: null, c: null }; est.he = null; est.aceroCercos = null; ctx.pintar(); }
  } }));
  let g;
  try { g = efectivos(p, s); } catch (e) { return poner(form, aviso(String(e.message ?? e), 'error')); }
  const comp = est.modo === 'comprobar';
  const cambio = () => ctx.cambio();
  const tn = tipoNorma(p);
  const rg = ajustaCot(p);
  const LT = limitesTheta(rg);
  const ayudaCot = t(tn === '23' ? 'tor.cotAyuda23' : tn === 'ec' ? 'tor.cotAyudaEC' : 'tor.cotAyuda');
  const nuevo = (k) => (v) => { est.ov[k] = v * 1000; cambio(); };
  const gauge = regleta({ etq: t('tor.theta'), min: LT.min, max: LT.max, step: 0.1, valor: thetaDe(est.cot), texto: (v) => `${fmt(v, 1)}°`,
    onInput: (v) => {
      est.cot = 1 / Math.tan(v * RAD);
      const c = document.getElementById('t-theta');
      if (c) c.value = String(+v.toFixed(1));
      cambio();
    } });
  const refrescarGauge = () => { gauge.querySelector('input').value = thetaDe(est.cot); gauge.refrescar(); };
  const Gx = nuc(p).geometria(entrada(p, s, g.sec, g));
  const heFijo = Gx.heMax - Gx.heMin < 0.5;
  const heGauge = regleta({ etq: t('tor.he'), min: Gx.heMin, max: Math.max(Gx.heMax, Gx.heMin + 0.1), step: 0.01, valor: Gx.he, texto: (v) => `${fmt(v, 0)} mm`, onInput: (v) => { est.he = v; cambio(); } });
  if (heFijo) { heGauge.querySelector('input').disabled = true; heGauge.title = t('tor.heFijo'); }
  heGauge.title ||= t('tor.heAyuda');
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('g.esfuerzo'),
      ...parejas([campoNum({ id: 't-ted', etq: t('tor.TEd'), valor: est.TEd, mag: 'M', paso: 5, min: 0.01, max: 1e7, nombre: t('tor.TEdNombre'), onCambio: (v) => { est.TEd = v; cambio(); } })])),
    grupo(t('tor.datosCalc'),
      ...parejas([
        campoNum({ id: 't-b', etq: t('tor.b'), valor: mmEnt(g.b / 1000), mag: 'long', paso: 5, min: 0.01, max: 20, onCambio: nuevo('b') }),
        campoNum({ id: 't-h', etq: t('tor.h'), valor: mmEnt(g.h / 1000), mag: 'long', paso: 5, min: 0.01, max: 20, onCambio: nuevo('h') }),
        campoNum({ id: 't-c', etq: t('tor.c'), valor: mmEnt(g.c / 1000), mag: 'long', paso: 5, min: 0, max: 20, info: t('tor.cAyuda'), onCambio: nuevo('c') }),
      ]),
      heGauge),
    grupo(t('tor.armadura'),
      ...parejas([
        selector({ id: 't-acero', etq: t('tor.acero'), linea: true, opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: est.aceroCercos ?? s.acero, onCambio: (v) => { est.aceroCercos = v; cambio(); } }),
        selector({ id: 't-fi', etq: t('tor.fi'), linea: true, opciones: diametros().map((x) => [String(x), `ø${x}`]), valor: String(est.fi), onCambio: (v) => { est.fi = Number(v); cambio(); } }),
        campoNum({ id: 't-s', etq: t('tor.s'), valor: est.s, mag: 'diam', paso: 25, min: 25, max: 1000, onCambio: (v) => { est.s = v; cambio(); } }),
        campoNum({ id: 't-al', etq: t('tor.Al'), valor: est.Al / 1e6, mag: 'As', paso: 50, min: 0, max: 1, onCambio: (v) => { est.Al = v * 1e6; cambio(); } }),
        selector({ id: 't-alfa', etq: t('tor.alfa'), linea: true, opciones: [['0.6', '0,60'], ['0.75', '0,75']], valor: String(est.alfa), onCambio: (v) => { est.alfa = Number(v); cambio(); } }),
        campoNum({ id: 't-theta', etq: t('tor.theta'), valor: thetaDe(est.cot), mag: 'ang1', paso: 1, min: LT.min, max: LT.max, info: ayudaCot, onCambio: (v) => { est.cot = 1 / Math.tan(v * RAD); cambio(); refrescarGauge(); } }),
      ].map((c) => {
        const id = c.dataset.c;
        if (!comp && ['t-fi', 't-s', 't-al'].includes(id)) return apaga(c, t('tor.soloComp'));
        if (id === 't-alfa' && tn !== 'ehe') return apaga(c, t('tor.soloEHE'));
        return id === 't-alfa' ? conInfo(c, t('tor.alfaAyuda')) : c;
      })),
      gauge));
}

const fila = (id, nom, val, cuenta) => ({ id, nom, val, cuenta });
let refNorma = 'EHE-08';
const art = (a) => `<span class="art">${refNorma} · ${a}</span>`;

export function resultados(ctx, res) {
  resultadosTorsion(ctx, res);
  rotulaSeccion(res, nuc(ctx.p) && secciones(ctx.p).length ? ctx.p.secciones[est.i]?.nombre : null);
}

function resultadosTorsion(ctx, res) {
  const p = ctx.p;
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  if (!nuc(p) || !secciones(p).length) { res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  const s = p.secciones[est.i];
  if (!s || !FORMAS.includes(s.forma)) return;
  const N = nuc(p);
  const tn = tipoNorma(p);
  refNorma = tn === '23' ? 'EC-2 2023' : tn === 'ec' ? 'EC-2 + AN' : 'EHE-08';
  ajustaCot(p);
  const gg = efectivos(p, s);
  const x = entrada(p, s, gg.sec, gg);
  const comp = est.modo === 'comprobar';
  let r;
  try { r = comp ? N.comprobar(x) : N.dimensionar(x, est.TEd, { diametros: tablaDiam() }); } catch (e) {
    res.append(h('div', { class: 'avisos' }, aviso(String(e.message ? (e.clave ? t(e.clave, ...(e.args ?? [])) : e.message) : e), 'error')));
    res.append(h('div', { class: 'cuerpo' }, centro, dcha));
    return;
  }
  const G = r.G;
  const avisos = r.avisos.map((a) => aviso(t(a.clave, ...(a.args ?? []))));

  p.calculos.torsion ??= {};
  p.calculos.torsion[s.nombre] = {
    modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), TEd: est.TEd, cotTheta: est.cot,
    resultado: comp ? { Tu1: r.Tu1, Tu2: r.Tu2, Tu3: r.Tu3, Tu: r.Tu } : { caso: r.caso, AtS: r.AtS, Al: r.Al, Tu1: r.Tu1 },
  };

  if (comp) {
    const ok = est.TEd <= r.Tu + 1e-9;
    const detalle = ok && !r.sepOk;
    res.append(veredicto(!ok ? 'nocumple' : detalle ? 'atencion' : 'cumple', !ok ? t('tor.ver.no') : detalle ? t('tor.ver.revisar') : t('tor.ver.cumple'),
      t('aprovechamiento'), fmt(r.aprov, 2), t('tor.ver.ecu', q(est.TEd, 'M'), q(r.Tu, 'M'), ok, t(`tor.cond.${r.manda}`)), Math.min(r.aprov / 1.25, 1)));
  } else if (r.caso === 'biela') {
    res.append(veredicto('nocumple', t('tor.ver.aum'), t('tor.armNec'), '—', t('tor.ver.necAum', q(est.TEd, 'M'), q(r.Tu1, 'M'))));
  } else {
    res.append(veredicto('cumple', t('tor.ver.valida'), t('tor.armNec'), qh(r.AtS, 'AswS'), t('tor.ver.nec', q(est.TEd, 'M'), q(r.Tu1, 'M'))));
  }
  if (r.sepOk === false || avisos.length) res.append(h('div', { class: 'avisos' }, ...avisos));

  // Centro: sección con la pared eficaz
  poner(centro, h('h2', {}, t('tor.t.dibujo')), h('div', { class: 'lienzo', html: dibujoTorsion({ b: G.b, h: G.h, he: G.he, c: G.c, fi: comp ? est.fi : 10 }) }), notas(tn));

  // Derecha: cifras, aprovechamientos o tabla, filas desplegables
  const cif = comp
    ? [[t('tor.c.Tu1'), qh(r.Tu1, 'M')], [t('tor.c.Tu2'), qh(r.Tu2, 'M')], [t('tor.c.Tu3'), qh(r.Tu3, 'M')], ['θ', `${fmt(r.theta, 1)}°`]]
    : r.caso === 'biela' ? [[t('tor.c.Tu1'), qh(r.Tu1, 'M')]]
      : [[t('tor.c.Tu1'), qh(r.Tu1, 'M')], [t('tor.armNec'), qh(r.AtS, 'AswS')], [t('tor.AlNec'), qh(r.Al / 1e6, 'As')]];
  poner(dcha, h('h2', {}, t('tor.t.res')), cifras(cif));
  if (comp) poner(dcha, aprovechamientos(r));
  if (!comp && r.caso === 'ok') {
    const filas = r.tabla.map((f) => (f.s ? [`ø${f.fi}`, fmt(f.s, 0), fmt(f.AtS * 10, 2), fmt(f.Tu2, 0)] : [`ø${f.fi}`, '—', '—', '—']));
    const sug = r.tabla.findIndex((f) => f.s && f.s >= 100);
    if (sug >= 0) filas[sug].clase = 'sugerida';
    poner(dcha, tabla(filas, { cabecera: [t('tor.tabla.fi'), t('tor.tabla.s'), t('tor.tabla.ats'), t('tor.tabla.tu2')] }), h('p', { class: 'pista', html: t('tor.tabla.una') }));
  }
  poner(dcha, h('div', { class: 'traza' }, ...trazas(r, comp, tn).map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  })));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Aprovechamiento de biela, cercos y longitudinal por separado (el cartel da el mayor). */
function aprovechamientos(r) {
  const f = (etq, v) => h('div', { class: `fila-ap${v > 1 + 1e-9 ? ' no' : ''}` }, h('span', { html: etq }),
    h('div', { class: 'pista-barra', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.min(v / 1.25, 1) * 100}%` }), h('span', { class: 'uno' })),
    h('span', { class: 'v' }, fmt(v, 2)));
  return h('div', { class: 'aprov2' }, f(t('tor.ap.biela'), r.ap1), f(t('tor.ap.cercos'), r.ap2), f(t('tor.ap.long'), r.ap3));
}

function trazas(r, comp, tn) {
  const P = r.P;
  const G = r.G;
  const n = (v, d = 2) => fmt(v, d);
  const cot = r.cotTheta;
  const f = [];
  f.push(fila('geo', t('tor.r.geo'), `h<sub>e</sub> ${n(G.he, 0)} mm`,
    `<span class="f">${t('tor.f.geo')}</span><span class="n">A = ${n(G.A, 0)} mm² · u = ${n(G.u, 0)} mm · A/u = ${n(G.heNom, 1)} mm · 2c = ${n(G.heMin, 0)} mm → h<sub>e</sub> = ${n(G.he, 1)} mm</span>`
    + `<span class="n">A<sub>e</sub> = ${n(G.Ae, 0)} mm² · u<sub>e</sub> = ${n(G.ue, 0)} mm</span>${art(tn === 'ehe' ? '45.2.1' : tn === 'ec' ? '6.3.2(1)' : '8.3.2(2), 8.3.4(5)')}`));
  const fc = tn === 'ehe' ? `f<sub>1cd</sub> = ${n(P.f1cd)} MPa · K = 1 · α = ${n(P.alfa)}` : `f<sub>cd</sub> = ${n(P.fcd)} MPa · ν = ${n(r.nu, 3)}`;
  f.push(fila('tu1', t('tor.r.Tu1'), q(r.Tu1, 'M'),
    `<span class="f">${t(tn === 'ehe' ? 'tor.f.Tu1.ehe' : tn === 'ec' ? 'tor.f.Tu1.ec' : 'tor.f.Tu1.23')}</span><span class="n">${tn === 'ehe' ? t('tor.f.f1cd') : t(tn === 'ec' ? 'tor.f.nu04' : 'tor.f.nu23')}</span>`
    + `<span class="n">${fc} · cotg θ = ${n(cot, 3)} (θ = ${n(r.theta, 1)}°)</span>${art(tn === 'ehe' ? '45.2.2.1' : tn === 'ec' ? '6.3.2(4), (6.30)' : '8.3.4(3), (8.84)')}`));
  if (comp) {
    f.push(fila('tu2', t('tor.r.Tu2'), q(r.Tu2, 'M'),
      `<span class="f">${t('tor.f.Tu2')}</span><span class="n">A<sub>t</sub>/s = ${n(est.fi ? areaRama(est.fi) / est.s : 0, 3)} mm²/mm · f<sub>yt,d</sub> = ${n(P.fyt, 0)} MPa</span>${art(tn === 'ehe' ? '45.2.2.2' : tn === 'ec' ? '6.3.2(1), 6.2.3' : '8.3.4(2), (8.82)')}`));
    f.push(fila('tu3', t('tor.r.Tu3'), q(r.Tu3, 'M'),
      `<span class="f">${t('tor.f.Tu3')}</span><span class="n">A<sub>l</sub> = ${n(est.Al, 0)} mm² · f<sub>yl,d</sub> = ${n(P.fyl, 0)} MPa</span>${art(tn === 'ehe' ? '45.2.2.3' : tn === 'ec' ? '6.3.2(3), (6.28)' : '8.3.4(2), (8.83)')}`));
  } else if (r.caso === 'ok') {
    f.push(fila('ats', t('tor.r.AtS'), qh(r.AtS, 'AswS'), `<span class="f">${t('tor.f.AtS')}</span><span class="n">f<sub>yt,d</sub> = ${n(P.fyt, 0)} MPa · cotg θ = ${n(cot, 3)}</span>${art(tn === 'ehe' ? '45.2.2.2' : tn === 'ec' ? '6.3.2, 6.2.3' : '8.3.4(2)')}`));
    f.push(fila('al', t('tor.r.Al'), q(r.Al / 1e6, 'As'), `<span class="f">${t('tor.f.Al')}</span><span class="n">f<sub>yl,d</sub> = ${n(P.fyl, 0)} MPa · ${t('tor.repartoVal', n(r.reparto.sup, 0), n(r.reparto.lat, 0))}</span>${art(tn === 'ehe' ? '45.2.2.3' : tn === 'ec' ? '6.3.2(3), (6.28)' : '8.3.4(2), (8.83)')}`));
  }
  if (comp || r.caso === 'ok') {
    const sm = r.sep;
    f.push(fila('sep', t('tor.r.sep'), comp ? `${n(est.s, 0)} ≤ ${n(sm.sMax, 0)} mm` : `≤ ${n(sm.sMax, 0)} mm`,
      `<span class="f">${t(tn === 'ehe' ? 'tor.f.sep.ehe' : 'tor.f.sep.ec')}</span><span class="n">u<sub>e</sub>/8 = ${n(sm.ue8, 0)} mm${sm.tramo ? ` · a = ${n(sm.a, 0)} mm → s ≤ ${n(sm.sMax, 0)} mm` : ''}</span>${art(tn === 'ehe' ? '45.2.3' : tn === 'ec' ? '9.2.3(3)' : '12.3.3')}`));
  }
  return f;
}

/** Aclaraciones plegadas (guía § 14.9); la interacción va siempre, con el apartado de cada norma. */
function notas(tn) {
  const alc = tn === 'ehe' ? 'tor.alcance.ehe' : tn === 'ec' ? 'tor.alcance.ec' : 'tor.alcance.23';
  const inter = tn === 'ehe' ? 'tor.inter.ehe' : tn === 'ec' ? 'tor.inter.ec' : 'tor.inter.23';
  const pleg = (k, texto) => h('details', { class: 'pleg' }, h('summary', {}, h('span', { html: t(k) })), h('div', { class: 'cuenta' }, h('p', { class: 'nota', html: texto })));
  return h('div', { class: 'cor-notas' }, h('h3', {}, t('tor.notas')),
    pleg('tor.n.inter', `${t('tor.inter.comun')} ${t(inter)}`),
    pleg('tor.n.alcance', t(alc)));
}

export function comandos(ctx) {
  return [
    { k: 'tor.cmdComprobar', b: 'torsion comprobar torsion check', f: () => { est.modo = 'comprobar'; ctx.ir('torsion'); } },
    { k: 'tor.cmdDimensionar', b: 'torsion dimensionar torsion design', f: () => { est.modo = 'dimensionar'; ctx.ir('torsion'); } },
  ];
}
