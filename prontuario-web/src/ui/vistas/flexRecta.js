// ELU · Flexión compuesta recta: diagrama de interacción N-M de una sección en rotura (primera entrega).
// La sección (geometría, armadura y materiales) viene de Secciones y aquí no se toca. Se da el par
// (N_Ed, M_Ed) y se comprueba contra el contorno N-M. Compresión positiva; M > 0 comprime la cara superior.
// Motor: src/core/interaccion.js (estado último para cada axil, con los diagramas de cálculo).

import { diagramaNM, comprobarNM } from '../../core/interaccion.js';
import { estadoUltimo } from '../../core/seccion.js';
import { seccionMotor } from '../../core/geometria.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh } from '../formato.js';
import { selectorSecciones } from './secciones.js';
import { h, poner, campoNum, grupo, aviso, cifras, pestanas } from '../campos.js';
import { grafica } from '../grafica.js';
import { dibujoSeccion } from '../dibujoSeccion.js';
import { veredicto } from './flexion.js';

const FORMAS = ['rectangular', 'pilar', 'T', 'circular', 'generica'];
const est = { i: null, NEd: 500, MEd: 150, abiertos: new Set(['mrd']), pestana: 'resultados' };
export function reiniciar() { est.i = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;

function activa(p) {
  if (!p.secciones.length) return null;
  if (!p.secciones[est.i]) est.i = 0;
  return p.secciones[est.i];
}

export function cabeza(ctx, el) {
  const s = activa(ctx.p);
  if (!s) return;
  selectorSecciones(ctx, el, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = ctx.p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; ctx.pintar(); }
  } });
}

const mmS = (x) => fmt(x * 1000, 0);
function resumenSeccion(p, s) {
  const g = s.geo;
  let dim;
  if (s.forma === 'circular') dim = `Ø ${mmS(g.D)} mm`;
  else if (s.forma === 'generica') { const c = geometriaDe(p, s).caja; dim = `${mmS(c.xmax - c.xmin)} × ${mmS(c.ymax - c.ymin)} mm`; }
  else dim = `${s.forma === 'T' ? 'T ' : ''}${mmS(g.b)} × ${mmS(g.h)} mm`;
  return `${dim} · ${s.hormigon} · ${s.acero}`;
}

export function datos(ctx, form) {
  const s = activa(ctx.p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.flexRecta')), h('p', {}, t('fcr.subtitulo'))));
  if (!s) return poner(form, aviso(t('fcr.sinSec'), 'info'));
  const cambio = () => ctx.cambio();
  poner(form,
    grupo(t('g.esfuerzo'),
      campoNum({ id: 'fr-n', etq: sub('N', 'Ed'), ref: t('fcr.compPos'), valor: est.NEd, mag: 'N', paso: 10, min: -1e6, max: 1e6, nombre: t('fcr.axil'), onCambio: (v) => { est.NEd = v; cambio(); } }),
      campoNum({ id: 'fr-m', etq: sub('M', 'Ed'), ref: t('fcr.mSigno'), valor: est.MEd, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('flex.momento'), onCambio: (v) => { est.MEd = v; cambio(); } })),
    h('p', { style: 'margin:0;font-size:var(--t-s);color:var(--tinta-3)', html: t('fcr.pista') }),
    grupo(t('g.seccion'), h('p', { style: 'margin:0;font-size:var(--t-s);color:var(--tinta-2);line-height:1.5', html: `${resumenSeccion(ctx.p, s)}<br>${t('fcr.deSecciones')}` })));
}

// El diagrama de una sección circular o genérica tarda: se guarda el último y solo se repite si cambian los datos
let memo = { clave: '', d: null, sec: null };
function contorno(p, s) {
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p)]);
  if (memo.clave !== clave) {
    const geo = geometriaDe(p, s);
    if (geo.errores?.length) throw new Error(geo.errores.join(' '));
    const mats = materialesSeccion(p, s);
    const sec = seccionMotor(geo, mats.hormigon, mats.acero);
    memo = { clave, d: diagramaNM(sec, { n: 60 }), sec, geo };
  }
  return memo;
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const { d, sec, geo } = contorno(p, s);
  const NEd = est.NEd;
  const MEd = est.MEd;
  const r = comprobarNM(d, NEd, MEd);
  const ok = r.ratio <= 1;
  const Mmax = (rama) => rama.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a));
  const mp = Mmax(d.pos);
  const mn = Mmax(d.neg);
  p.calculos.flexionCompuesta ??= {};
  p.calculos.flexionCompuesta[s.nombre] = { NEd, MEd, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { MRd: r.MRd, aprovechamiento: r.ratio } };

  const dentroRango = NEd <= d.Ncomp && NEd >= d.Ntrac;
  res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('cumple') : t('noCumple'), t('aprovechamiento'), dentroRango ? fmt(r.ratio, 2) : '—',
    dentroRango ? `${sub('M', 'Rd')}(${sub('N', 'Ed')}) <b>${q(Math.abs(r.MRd), 'M')}</b> · ${sub('M', 'Ed')} <b>${q(Math.abs(MEd), 'M')}</b>` : t('fcr.fueraAxil', q(NEd > 0 ? d.Ncomp : d.Ntrac, 'N')),
    dentroRango ? Math.min(r.ratio / 1.25, 1) : 1));

  // Estado último con el axil dado (para x y las deformaciones)
  const e = dentroRango ? estadoUltimo(sec, -NEd, { signo: MEd >= 0 ? 1 : -1, yref: d.yref }) : null;
  const cif = [
    [`${sub('M', 'Rd')}(${sub('N', 'Ed')})`, dentroRango ? qh(Math.abs(r.MRd), 'M') : '—'],
    [sub('N', 'Rd'), qh(d.Ncomp, 'N')],
    [sub('N', 'Rd,t'), qh(d.Ntrac, 'N')],
    [`${sub('M', 'Rd,máx')}⁺ (${sub('N', '')} = ${fmt(mp.N, 0)})`, qh(mp.M, 'M')],
    [`${sub('M', 'Rd,máx')}⁻ (${sub('N', '')} = ${fmt(mn.N, 0)})`, qh(Math.abs(mn.M), 'M')],
    ...(e?.converge ? [[t('c.x'), qh(e.x, 'long')]] : []),
  ];
  const tarjetaGraf = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('fcr.diagrama')), h('p', { class: 'sub' }, t('fcr.diagramaSub')), graficoNM(ctx, d, s, r));
  const tarjetaRes = h('article', { class: 'panel tarjeta' });
  const lista = [['resultados', t('t.resultados')], ['seccion', t('g.seccion')]];
  tarjetaRes.append(pestanas({ lista, activa: est.pestana, onCambio: (k) => { est.pestana = k; ctx.pintar(); } }));
  if (est.pestana === 'seccion') {
    tarjetaRes.append(h('div', { class: 'lienzo', html: dibujoSeccion(geo, s, { ancho: 360, alto: 300, x: e?.converge && Number.isFinite(e.x) ? e.x : null }) }));
  } else {
    tarjetaRes.append(cifras(cif), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(p, d, r, e));
  }
  res.append(h('div', { class: 'cuerpo dib-ancho' }, tarjetaGraf, tarjetaRes));
}

/** Contorno N-M: x = N (compresión positiva), y = M. Rama M⁺ continua y rama M⁻ discontinua; el punto de cálculo marcado. */
function graficoNM(ctx, d, s, r) {
  const xy = (rama) => [...rama].reverse().map((v) => [v.N, v.M]);
  const series = [
    { nombre: `${ind('M', 'Rd')}⁺`, clase: 's1', xy: xy(d.pos) },
    { nombre: `${ind('M', 'Rd')}⁻`, clase: 's2', xy: xy(d.neg) },
  ];
  // La recta del origen al contorno pasa por el punto de cálculo: su cociente es el aprovechamiento
  if (r.Q) series.push({ nombre: t('fcr.rayo'), clase: 'ref', cruz: false, xy: [[0, 0], r.Q].sort((a, b) => a[0] - b[0]) });
  const puntos = [{ x: est.NEd, y: est.MEd, etq: `${ind('N', 'Ed')}, ${ind('M', 'Ed')}`, clase: 'ref', marca: true }];
  return h('div', { class: 'lienzo' }, grafica({
    series, puntos,
    ejeX: { titulo: `N (${'kN'}), ${t('fcr.compPos')}`, d: 0 },
    ejeY: { titulo: `M (${'kN·m'})`, d: 0 },
    archivo: `N-M ${s.nombre}`,
    avisar: ctx.avisar,
  }));
}

function traza(p, d, r, e) {
  const fam = NORMAS[p.norma];
  const art = (a, b, c) => `<span class="art">${fam.ref} · ${p.norma === 'EC2-2004' ? c ?? b : fam.familia === 'EHE' ? a : b}</span>`;
  const filas = [
    { id: 'mrd', nom: `${sub('M', 'Rd')}(${sub('N', 'Ed')})`, val: Number.isFinite(r.MRd) ? q(Math.abs(r.MRd), 'M') : '—', cuenta: `<span class="f">${t('fcr.f.contorno')}</span>
      <span class="n">${t('fcr.f.ref', q(d.yref, 'long'))}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'nrd', nom: sub('N', 'Rd'), val: q(d.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.nrd')}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'rat', nom: t('aprovechamiento'), val: Number.isFinite(r.ratio) ? fmt(r.ratio, 2) : '—', cuenta: `<span class="f">${t('fcr.f.rayo')}</span>` },
  ];
  return h('div', { class: 'traza' }, ...filas.map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  }));
}
