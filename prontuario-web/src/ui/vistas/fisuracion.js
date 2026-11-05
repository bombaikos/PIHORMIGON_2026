// ELS · Fisuración: abertura característica de fisura wk de vigas rectangulares y en T y de pilares rectangulares, con las tres
// normas a la vez (EHE-08 art. 49.2.4, EC-2 2004 + AN 7.3.4 y EC-2 2023 9.2.3). El estado fisurado (x, σs, ε1) sale del motor de
// Estado tensional con ley lineal (src/core/fisuracionSeccion.js). Sin pretensado, sin rigidización a tracción ni armadura mínima.
// Comprobación, Dimensionamiento (una capa de barras iguales) y Diagrama wk–M. Decisiones: analisis/fisuracion-decisiones.md.

import { fisuraSeccion, curvaWk, dimensionaSeccion, modeloServicio, NORMAS_FIS } from '../../core/fisuracionSeccion.js';
import { wmaxDe, CLASES } from '../../norma/fisuracion/limites.js';
import { datosViga, geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, MAG, serieDiametros, decimalAlCopiar } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { h, poner, campoNum, campoArmado, selector, segmentado, grupo, aviso, cifras, tabla } from '../campos.js';
import { grafica } from '../grafica.js';
import { veredicto } from './flexion.js';
import { dibujoFisuracion } from '../dibujoFisuracion.js';
import { dibujoSeccionPeq } from './flexRecta.js';

const FORMAS = ['rectangular', 'T', 'pilar'];
const est = {
  i: null, modo: 'comprobar', M: 80, N: 0, larga: true, directa: true, buenaAdh: true,
  clase: {}, wmax: null, arm: {}, abiertos: new Set(),
};
export function reiniciar() { est.i = null; est.wmax = null; est.arm = {}; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;
const normaId = (p) => (p.norma === 'EHE-08' ? 'EHE08' : p.norma);
const NOMBRE = (n) => t(`fis.n.${n}`);
const CLASE_POR_DEFECTO = { EHE08: 'IIa', 'EC2-2004': 'XC3', 'EC2-2023': 'XC3' };
const claseDe = (id) => est.clase[id] ?? CLASE_POR_DEFECTO[id];
const wmaxDeNorma = (id) => est.wmax ?? wmaxDe(id, claseDe(id)) ?? 0.3;
const diametros = () => serieDiametros().filter((x) => x >= 12 && x <= 32);

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  return est.i >= 0 ? p.secciones[est.i] : null;
}

/** Datos de la zona traccionada (rectangular, T o pilar), en m, con la cara traccionada abajo. */
function datosFis(p, s, signo) {
  if (s.forma !== 'pilar') return datosViga(p, s, signo);
  const { b, h: alto } = s.geo;
  return { b, h: alto, trapecios: [{ y1: 0, y2: alto, b1: b, b2: b }], Ac: b * alto, Ib: (b * alto ** 3) / 12, W: (b * alto * alto) / 6, signo, forma: 'pilar' };
}

const caraTrac = (signo) => (signo > 0 ? 'inf' : 'sup');
const grupoTrac = (s, signo) => s.armado.find((a) => a.tipo === 'capa' && a.cara === caraTrac(signo));
/** Sección con la armadura de cálculo de la cara traccionada (dato propio de este módulo; la de Secciones solo es el valor inicial). */
function seccionCalculo(s, signo) {
  const g = grupoTrac(s, signo);
  const ov = est.arm[`${s.nombre}|${caraTrac(signo)}`];
  if (!g || ov === undefined || ov === g.texto) return s;
  const c = structuredClone(s);
  grupoTrac(c, signo).texto = ov;
  return c;
}

let memo = { clave: '', c: null };
let memoCurva = { clave: '', pts: null };
function calculo(p, s, signo) {
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p), signo]);
  if (memo.clave === clave) return memo.c;
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  if (geo.franjas.length) throw new Error(t('fis.err.franjas'));
  const mats = materialesSeccion(p, s);
  const fck = mats.hormigon.fk / 1000;
  const c = { geo, mats, fck, v: datosFis(p, s, signo), mod: modeloServicio(geo, mats, fck) };
  memo = { clave, c };
  return c;
}

const parejas = (campos) => {
  const filas = [];
  for (let i = 0; i < campos.length; i += 2) filas.push(h('div', { class: 'par2' }, ...campos.slice(i, i + 2)));
  return filas;
};
const conInfo = (c, texto) => {
  c.title = texto;
  const i = h('span', { class: 'info-i izq', tabindex: 0, role: 'img', 'aria-label': texto, 'data-tip': texto }, 'i');
  if (c.classList.contains('apilado')) c.querySelector('label').append(i);
  else c.insertBefore(i, c.querySelector('.caja'));
  return c;
};
const apaga = (c, motivo) => {
  for (const el of c.querySelectorAll('input, select')) el.disabled = true;
  c.classList.add('no-aplica');
  return conInfo(c, motivo);
};

export function datos(ctx, form) {
  const p = ctx.p;
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.fisuracion'))));
  const s = activa(p);
  if (!s) return poner(form, aviso(t('fis.sinSec'), 'info'));
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; ctx.pintar(); }
  } }));
  const id = normaId(p);
  const cambio = () => ctx.cambio();
  const clases = (CLASES[id] ?? []).flatMap((g) => g.clases);
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('fis.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')], ['diagrama', t('fis.modoDiagrama')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('fis.gEsfuerzo'),
      campoNum({ id: 'fi-m', etq: t('fis.M'), ref: t('fis.refM'), valor: est.M, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('fis.nombreM'), onCambio: (v) => { est.M = v; cambio(); } }),
      campoNum({ id: 'fi-n', etq: t('fis.N'), ref: t('fis.refN'), valor: est.N, mag: 'N', paso: 10, min: -1e6, max: 1e6, nombre: t('fis.nombreN'), onCambio: (v) => { est.N = v; cambio(); } })),
    grupo(t('fis.gArmadura'), campoArmadura(ctx, s)),
    grupo(t('fis.gAccion'),
      selector({ id: 'fi-clase', linea: true, etq: t('fis.clase'), opciones: clases.map((c) => [c, c]), valor: claseDe(id), onCambio: (v) => { est.clase[id] = v; est.wmax = null; ctx.pintar(); } }),
      conInfo(campoNum({ id: 'fi-wmax', etq: t('fis.wmax'), valor: wmaxDeNorma(id), mag: 'wk', paso: 0.05, min: 0.01, max: 5, onCambio: (v) => { est.wmax = v; cambio(); } }), t('fis.infoWmax')),
      selector({ id: 'fi-dur', linea: true, etq: t('fis.duracion'), opciones: [['larga', t('fis.larga')], ['corta', t('fis.corta')]], valor: est.larga ? 'larga' : 'corta', onCambio: (v) => { est.larga = v === 'larga'; cambio(); } }),
      id === 'EHE08'
        ? selector({ id: 'fi-acc', linea: true, etq: t('fis.accion'), opciones: [['directa', t('fis.directa')], ['indirecta', t('fis.indirecta')]], valor: est.directa ? 'directa' : 'indirecta', onCambio: (v) => { est.directa = v === 'directa'; cambio(); } })
        : apaga(selector({ id: 'fi-acc', linea: true, etq: t('fis.accion'), opciones: [['directa', t('fis.directa')]], valor: 'directa', onCambio: () => {} }), t('fis.accionSoloEHE')),
      id === 'EC2-2023'
        ? selector({ id: 'fi-adh', linea: true, etq: t('fis.adherencia'), opciones: [['buena', t('fis.buena')], ['mala', t('fis.mala')]], valor: est.buenaAdh ? 'buena' : 'mala', onCambio: (v) => { est.buenaAdh = v === 'buena'; cambio(); } })
        : apaga(selector({ id: 'fi-adh', linea: true, etq: t('fis.adherencia'), opciones: [['buena', t('fis.buena')]], valor: 'buena', onCambio: () => {} }), t('fis.adhSolo23'))));
}

function campoArmadura(ctx, s) {
  const signo = est.M >= 0 ? 1 : -1;
  const g = grupoTrac(s, signo);
  const key = `${s.nombre}|${caraTrac(signo)}`;
  const c = campoArmado({ id: 'fi-arm', etq: `${sub('A', 's')}`, texto: est.arm[key] ?? g?.texto ?? '', capas: {}, onCambio: (v) => { est.arm[key] = v; ctx.cambio(); } });
  if (!g) return apaga(c, t('fis.armPilar'));
  if (est.modo === 'dimensionar') return apaga(c, t('fis.armDim'));
  return conInfo(c, t('fis.armInfo'));
}

export function resultados(ctx, res) {
  resultadosFis(ctx, res);
  rotulaSeccion(res, activa(ctx.p)?.nombre);
}

const pie = () => h('p', { class: 'pista fis-pie', html: t('fis.hipotesis') });
const fallo = (res, msg) => res.append(h('div', { class: 'avisos' }, aviso(msg, 'error')));
const textoError = (e) => (e === 'sin-equilibrio' ? t('fis.err.equilibrio') : t('fis.err.traccion'));

function resultadosFis(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const id = normaId(p);
  const signo = est.M >= 0 ? 1 : -1;
  const sc = seccionCalculo(s, signo);
  let c;
  try { c = calculo(p, sc, signo); } catch (e) { return fallo(res, String(e.message ?? e)); }
  const o = { M: est.M, N: est.N, norma: id, larga: est.larga, directa: est.directa, buenaAdh: est.buenaAdh };
  const r = fisuraSeccion(c, o);
  const wmax = wmaxDeNorma(id);
  if (r.error) return fallo(res, textoError(r.error));
  p.calculos.fisuracion ??= {};
  p.calculos.fisuracion[s.nombre] = { modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), M: est.M, N: est.N, wmax, resultado: { wk: r.wk, Mfis: r.Mfis } };
  if (est.modo === 'diagrama') return diagrama(ctx, res, { s, c, r, o, id, wmax });
  const dim = est.modo === 'dimensionar';
  let filasDim = null;
  if (dim) {
    filasDim = dimensionaSeccion(c, o, id, wmax, diametros());
    const ok = filasDim.filter((f) => f.n);
    const mejor = ok.length ? ok.reduce((a, b) => (b.As < a.As ? b : a)) : null;
    if (r.sinFisurar) res.append(veredicto('cumple', t('fis.ver.sinFisurar'), t('fis.armNec'), '—', t('fis.ver.ecuSin', q(r.M, 'M'), q(r.Mfis, 'M'))));
    else if (mejor) res.append(veredicto('cumple', t('fis.ver.valida'), t('fis.armNec'), `ø${mejor.fi} × ${mejor.n}`, t('fis.ver.dim', mejor.fi, mejor.n, q(mejor.As / 1e6, 'As'))));
    else res.append(veredicto('nocumple', t('fis.ver.aum'), t('fis.armNec'), '—', t('fis.ver.noDim')));
    if (mejor) mejor.mejor = true;
  } else if (r.sinFisurar) {
    res.append(veredicto('cumple', t('fis.ver.sinFisurar'), 'w<sub>k</sub>', q(0, 'wk'), t('fis.ver.ecuSin', q(r.M, 'M'), q(r.Mfis, 'M'))));
  } else {
    const wk = r.wk[id];
    const ok = wk <= wmax + 1e-9;
    res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('fis.ver.cumple') : t('fis.ver.no'), t('fis.aprov'), fmt(wk / wmax, 2), t('fis.ver.ecu', q(wk, 'wk'), q(wmax, 'wk'), ok, NOMBRE(id)), Math.min(wk / wmax / 1.25, 1)));
  }
  const mn = r.minima;
  if (mn && mn.motivo === 'ala') res.append(aviso(t('fis.min.ala'), 'info'));
  else if (mn && mn.req !== null && !mn.ok) res.append(aviso(t('fis.min.no', fmt(mn.dis, 0), fmt(mn.req, 0), NOMBRE(id), mn.ref)));
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  poner(centro, h('h2', {}, t('fis.t.dibujo')), h('div', { class: 'lienzo fis-lienzo', html: dibujoFisuracion(c.geo, sc, r, r.det?.[id]?.hef ?? null) }), cifrasArmadura(r), pie());
  poner(dcha, h('h2', {}, t('fis.t.res')));
  if (!r.sinFisurar) poner(dcha, cifras([[t('fis.c.Mfis'), qh(r.Mfis, 'M')], [t('fis.c.x'), qh(r.e.x / 1000, 'long')], [t('fis.c.ss'), `${fmt(r.e.ss, 0)}<span class="u"> MPa</span>`], [t('fis.c.ssr'), `${fmt(r.e.ssr, 0)}<span class="u"> MPa</span>`]]));
  else poner(dcha, cifras([[t('fis.c.Mfis'), qh(r.Mfis, 'M')]]));
  if (dim) poner(dcha, tablaDim(ctx, filasDim), h('p', { class: 'pista', html: t('fis.dim.una') }));
  else poner(dcha, tablaNormas(ctx, r, id, wmax));
  if (dim && r.sinFisurar) poner(dcha, aviso(t('fis.dim.sinFisurar'), 'info'));
  if (!dim && !r.sinFisurar) poner(dcha, h('div', { class: 'traza' }, ...trazas(r, id).map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  })));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Armadura traccionada que usa el cálculo: primera capa junto a la cara traccionada. */
function cifrasArmadura(r) {
  if (r.sinFisurar || !r.g) return null;
  const g = r.g;
  return h('div', { class: 'fis-arm' }, h('h3', {}, t('fis.arm')), cifras([
    ['ø', `${fmt(g.fi, 0)}<span class="u"> mm</span>`], ['n', String(g.n)], [sub('A', 's'), qh(g.As1 / 1e6, 'As')],
    ['c', `${fmt(g.c, 0)}<span class="u"> mm</span>`], [sub('a', 'y'), `${fmt(g.ay, 0)}<span class="u"> mm</span>`], ['s', `${fmt(g.s, 0)}<span class="u"> mm</span>`]]));
}

const plano = (x) => String(x).replace(/<[^>]+>/g, '');
/** Tabla con el botón «Copiar tabla» (guía: tablas de resultados copiables, texto con tabuladores). */
function copiable(ctx, filas, cab, el) {
  const dec = decimalAlCopiar();
  const copiar = async () => {
    try {
      const txt = [cab.map(plano), ...filas.map((f) => [...f].map(plano))].map((f) => f.map((v) => v.replace('−', '-').replace('.', dec)).join('\t')).join('\r\n');
      await navigator.clipboard.writeText(txt);
      ctx.avisar(t('graf.tablaCopiada'));
    } catch { ctx.avisar(t('graf.error')); }
  };
  return h('div', { class: 'fis-tabla' }, h('button', { type: 'button', class: 'tecla', title: t('graf.copiarTablaTit'), onclick: copiar }, t('fis.copiarTabla')), el);
}

/** wk de las tres normas, con la del proyecto marcada. */
function tablaNormas(ctx, r, id, wmax) {
  const fila = (etq, f) => [etq, ...NORMAS_FIS.map((n) => f(n))];
  const cab = ['', ...NORMAS_FIS.map((n) => (n === id ? `<b>${t(`fis.n.c.${n}`)}</b>` : t(`fis.n.c.${n}`)))];
  const wk = (n) => fmt(r.wk[n], MAG.wk.d);
  const ap = (n) => fmt(r.wk[n] / wmax, 2);
  const f1 = fila(t('fis.tabla.wk'), wk);
  const f2 = fila(t('fis.tabla.ap'), ap);
  NORMAS_FIS.forEach((n, i) => { if (r.wk[n] > wmax + 1e-9) { f1[i + 1] = `<span class="no-cumple">${f1[i + 1]}</span>`; f2[i + 1] = `<span class="no-cumple">${f2[i + 1]}</span>`; } });
  return copiable(ctx, [f1, f2], cab, tabla([f1, f2], { cabecera: cab, clase: 'normas-fis' }));
}

function tablaDim(ctx, filas) {
  const rows = filas.map((f) => {
    const fila = f.n ? [`ø${f.fi}`, String(f.n), fmt(f.As, 0), fmt(f.wk, MAG.wk.d), fmt(f.libre, 0)] : [`ø${f.fi}`, '—', '—', '—', '—'];
    if (f.mejor) fila.clase = 'sugerida';
    return fila;
  });
  const cab = [t('fis.dim.fi'), t('fis.dim.n'), t('fis.dim.As'), t('fis.dim.wk'), t('fis.dim.libre')];
  return copiable(ctx, rows, cab, tabla(rows, { cabecera: cab }));
}

const art = (id, a) => `<span class="art">${NOMBRE(id)} · ${a}</span>`;
const REF = { EHE08: { ac: '49.2.4', sep: '49.2.4', esm: '49.2.4', wk: '49.2.4' }, 'EC2-2004': { ac: '7.3.4(3)', sep: '7.3.4(3), (7.11), (7.14)', esm: '7.3.4(2), (7.9)', wk: '7.3.4(1), (7.8)' }, 'EC2-2023': { ac: '9.2.3', sep: '9.2.3', esm: '9.2.3', wk: '9.2.3' } };

function trazas(r, id) {
  const n = (v, d = 2) => fmt(v, d);
  const D = r.det;
  const f = [];
  f.push({ id: 'mfis', nom: t('fis.r.Mfis'), val: q(r.Mfis, 'M'),
    cuenta: `<span class="f">${t(id === 'EHE08' ? 'fis.f.Mfis.EHE08' : 'fis.f.Mfis.EC2')}</span><span class="n">${id === 'EHE08' ? `f<sub>ct,m,fl</sub> = ${n(r.m.fctfl)}` : `f<sub>ctm</sub> = ${n(r.m.fctm)}`} MPa · b·h = ${n(r.b, 0)}×${n(r.h, 0)} mm</span>${art(id, id === 'EHE08' ? '49.2.3, 39.1' : id === 'EC2-2004' ? '7.1(2)' : '9.1(2)-(3)')}` });
  f.push({ id: 'estado', nom: t('fis.r.estado'), val: `x ${n(r.e.x, 0)} mm`,
    cuenta: `<span class="f">${t('fis.f.estado')}</span><span class="n">σ<sub>s</sub> = ${n(r.e.ss, 1)} MPa · σ<sub>sr</sub> = ${n(r.e.ssr, 1)} MPa · ε<sub>1</sub> = ${n(r.e.e1 * 1000, 2)} ‰</span><span class="n">ø = ${n(r.g.fi, 1)} mm · n = ${r.g.n} · A<sub>s</sub> = ${n(r.g.As1, 0)} mm² · c = ${n(r.g.c, 0)} mm · s = ${n(r.g.s, 0)} mm</span>` });
  f.push({ id: 'ac', nom: t('fis.r.ac'), val: `${n(D[id].Acef, 0)} mm²`,
    cuenta: [id].map((nn) => `<span class="f">${t(`fis.f.ac.${nn}`)}</span><span class="n">h<sub>ef</sub> = ${n(D[nn].hef, 0)} mm · A<sub>c,ef</sub> = ${n(D[nn].Acef, 0)} mm² · ρ = ${n(D[nn].rho * 100, 2)} %</span>${art(nn, REF[nn].ac)}`).join('') });
  f.push({ id: 'sep', nom: t('fis.r.sep'), val: `${n(D[id].sr, 0)} mm`,
    cuenta: [id].map((nn) => `<span class="f">${t(`fis.f.sep.${nn}`)}</span><span class="n">${nn === 'EHE08' ? `s<sub>m</sub>` : `s<sub>r</sub>`} = ${n(D[nn].sr, 0)} mm${nn === 'EHE08' ? ` · k<sub>1</sub> = ${n(D[nn].k1, 3)}` : ''}${nn === 'EC2-2023' ? ` · k<sub>b</sub> = ${n(D[nn].kb, 1)}` : ''}</span>${art(nn, REF[nn].sep)}`).join('') });
  f.push({ id: 'esm', nom: t('fis.r.esm'), val: `${n(D[id].esm * 1000, 2)} ‰`,
    cuenta: [id].map((nn) => `<span class="f">${t(nn === 'EHE08' ? 'fis.f.esm.EHE08' : nn === 'EC2-2023' ? 'fis.f.esm.EC2-2023' : 'fis.f.esm.EC2')}</span><span class="n">ε<sub>sm</sub>${nn === 'EHE08' ? '' : ' − ε<sub>cm</sub>'} = ${n(D[nn].esm * 1000, 2)} ‰</span>${art(nn, REF[nn].esm)}`).join('') });
  f.push({ id: 'wk', nom: t('fis.r.wk'), val: q(r.wk[id], 'wk'),
    cuenta: [id].map((nn) => `<span class="f">${t(`fis.f.wk.${nn}`)}</span><span class="n">w<sub>k</sub> = ${n(r.wk[nn], 2)} mm${nn === 'EHE08' ? ` · β = ${n(D[nn].beta, 1)}` : ''}${nn === 'EC2-2023' ? ` · k<sub>1/r</sub> = ${n(D[nn].k1r, 3)}` : ''}</span>${art(nn, REF[nn].wk)}`).join('') });
  const mn = r.minima;
  if (mn && mn.req !== null) {
    f.push({ id: 'min', nom: t('fis.r.min'), val: `${n(mn.dis, 0)} ${mn.ok ? '≥' : '<'} ${n(mn.req, 0)} mm²`,
      cuenta: `<span class="f">${t(`fis.f.min.${id}`)}</span><span class="n">A<sub>s</sub> ${t('fis.min.dispuesta')} = ${n(mn.dis, 0)} mm² · A<sub>s,mín</sub> = ${n(mn.req, 0)} mm²</span>${art(id, mn.ref)}` });
  }
  return f;
}

function diagrama(ctx, res, { s, c, r, o, id, wmax }) {
  const Mmax = Math.max(Math.ceil((1.6 * Math.abs(o.M)) / 10) * 10, Math.ceil((2 * r.Mfis) / 10) * 10, 10);
  const clave = JSON.stringify([c.geo.barras, o, Mmax, ctx.p.norma, s.nombre]);
  if (memoCurva.clave !== clave) memoCurva = { clave, pts: curvaWk(c, o, Mmax, 36) };
  const pts = memoCurva.pts;
  const serie = (n, clase) => ({ nombre: NOMBRE(n), clase, xy: pts.map((q_) => [q_.M, q_.wk ? q_.wk[n] : null]).filter((v) => v[1] !== null) });
  const wTope = Math.max(wmax * 1.5, ...pts.map((q_) => (q_.wk ? q_.wk[id] : 0)));
  const series = [
    serie('EHE08', 's1'), serie('EC2-2004', 's2'), serie('EC2-2023', 's3'),
    { nombre: '', clase: 'lim', xy: [[0, wmax], [Mmax, wmax]] },
    { nombre: '', clase: 'ref', cruz: false, xy: [[r.Mfis, 0], [r.Mfis, wTope]] },
  ];
  const wk = r.sinFisurar ? 0 : r.wk[id];
  const puntos = [{ x: r.M, y: wk, etq: ind('M', 'k'), marca: wk <= wmax + 1e-9 ? 'ok' : 'no' }, { x: Mmax * 0.02, y: wmax, etq: `${ind('w', 'máx')} ${fmt(wmax, 2)}` }];
  const nota = h('p', { class: 'nota-diag', html: t('fis.graf.nota', fmt(r.M, 0), fmt(r.Mfis, 0)) + ` · ${t('fis.graf.axil', fmt(o.N, 0))} · ${sub('w', 'máx')} <b>${fmt(wmax, 2)}</b> mm` });
  const graf = h('div', { class: 'lienzo' }, grafica({
    series, puntos,
    ejeX: { titulo: 'M [kN·m]', d: 0, dt: 0 },
    ejeY: { titulo: `${ind('w', 'k')} [mm]`, d: 2, dt: 2 },
    rango: { x0: 0, x1: Mmax * 1.3, y0: 0, y1: wTope * 1.1 },
    archivo: `wk-M ${s.nombre}`,
    avisar: ctx.avisar,
  }));
  const tablaWk = r.sinFisurar ? null : tablaNormas(ctx, r, id, wmax);
  const lado = h('article', { class: 'panel tarjeta fcr-lado' }, h('div', { class: 'fcr-sec', html: dibujoSeccionPeq(c.geo, s) }), tablaWk);
  res.append(h('div', { class: 'cuerpo dib-ancho fcr-diagrama' },
    h('article', { class: 'panel tarjeta' }, h('h2', {}, `${t('fis.graf.tit')} · ${s.nombre}`), h('div', { class: 'fcr-graf' }, graf, nota)),
    lado));
}

export function comandos(ctx) {
  return [
    { k: 'fis.cmdComprobar', b: 'fisuracion fisura abertura wk comprobar cracking', f: () => { est.modo = 'comprobar'; ctx.ir('fisuracion'); } },
    { k: 'fis.cmdDimensionar', b: 'fisuracion fisura abertura wk dimensionar cracking design', f: () => { est.modo = 'dimensionar'; ctx.ir('fisuracion'); } },
    { k: 'fis.cmdDiagrama', b: 'fisuracion fisura abertura wk diagrama cracking diagram', f: () => { est.modo = 'diagrama'; ctx.ir('fisuracion'); } },
  ];
}
