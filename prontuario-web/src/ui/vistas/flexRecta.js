// ELU · Flexión compuesta recta: comprobación, dimensionamiento y diagrama de interacción N-M en rotura.
// La sección (geometría, disposición de la armadura y materiales) viene de Secciones y aquí no se toca.
// Solo M ≥ 0 (armadura simétrica: el negativo es el espejo; un M escrito con signo menos se toma en valor absoluto).
// Los esfuerzos solicitantes (N, M) entran en una tabla y se colocan en el diagrama: verdes dentro, rojos fuera.
// Coeficiente de seguridad a excentricidad constante: γ = |OQ| / |OP| (Q = corte de la recta O–P con el contorno).
// Dimensionar mantiene la disposición de la armadura de Secciones y busca el factor que da γ ≥ γ requerido.
// Compresión positiva; M > 0 comprime la cara superior. Motor: src/core/interaccion.js.

import { diagramaNM, coeficienteNM, dimensionarNM, escalarArmadura, soloHormigon } from '../../core/interaccion.js';
import { leerNumero } from '../../core/armado.js';
import { seccionMotor } from '../../core/geometria.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh } from '../formato.js';
import { selectorSecciones } from './secciones.js';
import { h, poner, campoNum, segmentado, grupo, aviso, cifras, pestanas } from '../campos.js';
import { rejilla } from '../rejilla.js';
import { grafica } from '../grafica.js';
import { dibujoSeccion } from '../dibujoSeccion.js';
import { veredicto } from './flexion.js';

// Solo secciones con armadura simétrica respecto al eje de flexión (pilar rectangular y circular): basta el diagrama con M ≥ 0
const FORMAS = ['pilar', 'circular'];
const est = {
  i: null, modo: 'comprobar', gamma: 1,
  filas: [['500', '150'], ['1500', '100'], ['-150', '60'], ['2500', '200']],
  abiertos: new Set(['coef']), pestana: 'resultados',
};
export function reiniciar() { est.i = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;
const nv = (txt) => leerNumero(txt);

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  return est.i >= 0 ? p.secciones[est.i] : null;
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

/** Pares (N, M) válidos de la tabla, con su fila. */
const pares = () => est.filas.map((f, i) => ({ i, N: nv(f[0]), M: Math.abs(nv(f[1])) })).filter((x) => Number.isFinite(x.N) && Number.isFinite(x.M));

// Los diagramas de una sección circular o genérica tardan: se guarda el último cálculo mientras no cambien los datos
let memo = { clave: '', c: null };
/** Contornos (armado y solo hormigón) para la sección activa; en Dimensionar, con la armadura escalada. */
function calculo(p, s) {
  const ps = pares();
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p), est.modo, est.modo === 'dimensionar' ? [est.gamma, ps.map((x) => [x.N, x.M])] : 0]);
  if (memo.clave === clave) return memo.c;
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  const mats = materialesSeccion(p, s);
  const sec = seccionMotor(geo, mats.hormigon, mats.acero);
  const As0 = sec.barras.reduce((a, b) => a + b.A, 0);
  let k = 1;
  if (est.modo === 'dimensionar') {
    if (!(As0 > 0)) throw new Error(t('fcr.sinArmadura'));
    k = dimensionarNM(sec, ps.map((x) => [x.N, x.M]), { gamma: est.gamma, simetrica: true });
  }
  const dibujada = Number.isFinite(k) ? escalarArmadura(sec, k) : escalarArmadura(sec, 1);
  const c = { geo, sec, As0, k, d: diagramaNM(dibujada, { n: 60, simetrica: true }), dH: diagramaNM(soloHormigon(sec), { n: 60, simetrica: true }) };
  memo = { clave, c };
  return c;
}

const sigla = (g) => (g === Infinity ? '∞' : fmt(g, 2));

export function datos(ctx, form) {
  const p = ctx.p;
  const s = activa(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.flexRecta')), h('p', {}, t('fcr.subtitulo'))));
  if (!s) return poner(form, aviso(t('fcr.sinSec'), 'info'));
  const cambio = () => ctx.cambio();
  let c = null;
  try { c = calculo(p, s); } catch { /* el error se muestra en resultados */ }
  const coefFila = (datosTabla, r) => {
    if (!c) return '';
    const N = nv(datosTabla[r][0]);
    const M = nv(datosTabla[r][1]);
    return Number.isFinite(N) && Number.isFinite(M) ? sigla(coeficienteNM(c.d, N, Math.abs(M))) : '';
  };
  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('fcr.esfuerzos'),
      rejilla({ id: 'fr-esf', altoMax: 190,
        columnas: [{ titulo: `${sub('N', 'Ed')} (kN)`, num: true }, { titulo: `${sub('M', 'Ed')} (kN·m)`, num: true }],
        filas: est.filas, calculada: { titulo: 'γ', f: coefFila },
        onCambio: (f) => { est.filas = f.map((r) => [r[0], r[1]]); cambio(); } }),
      h('p', { style: 'margin:4px 0 0;font-size:var(--t-s);color:var(--tinta-3)', html: t('fcr.pista') }),
      est.modo === 'dimensionar' ? campoNum({ id: 'fr-gamma', etq: t('fcr.gammaReq'), valor: est.gamma, mag: 'ratio', paso: 0.05, min: 0.5, max: 5, onCambio: (v) => { est.gamma = v; cambio(); } }) : null),
    grupo(t('g.seccion'), h('p', { style: 'margin:0;font-size:var(--t-s);color:var(--tinta-2);line-height:1.5', html: `${resumenSeccion(p, s)}<br>${t('fcr.deSecciones')}` })));
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const c = calculo(p, s);
  const { d, dH, geo } = c;
  const ps = pares();
  if (!ps.length) throw new Error(t('fcr.sinEsfuerzos'));
  const gam = ps.map((x) => ({ ...x, g: coeficienteNM(d, x.N, x.M) }));
  const gmin = Math.min(...gam.map((x) => x.g));
  const dim = est.modo === 'dimensionar';
  p.calculos.flexionCompuesta ??= {};
  p.calculos.flexionCompuesta[s.nombre] = { modo: est.modo, esfuerzos: ps.map((x) => [x.N, x.M]), norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { gammaMin: gmin, k: c.k } };

  if (dim && !Number.isFinite(c.k)) {
    res.append(veredicto('nocumple', t('aumentar'), t('armaduraNec'), '—', t('fcr.noBasta')));
  } else if (dim) {
    const As = c.As0 * c.k;
    res.append(veredicto(c.k === 0 ? 'atencion' : 'cumple', c.k === 0 ? t('fcr.sinArm') : t('valida'), t('armaduraNec'), qh(As, 'As'),
      t('fcr.kArm', fmt(c.k, 2), q(c.As0, 'As'), fmt(est.gamma, 2))));
  } else {
    const ok = gmin >= 1 - 1e-6;
    res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('cumple') : t('noCumple'), 'γ = |OQ|/|OP|', sigla(gmin),
      `${t('fcr.puntos')} <b>${gam.filter((x) => x.g >= 1 - 1e-6).length}</b> / ${gam.length} ${t('fcr.dentro')}`, Math.min(1 / Math.max(gmin, 1e-9) / 1.25, 1)));
  }

  const Mmax = (rama) => rama.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a));
  const mp = Mmax(d.pos);
  const cif = [
    ...(dim && Number.isFinite(c.k) ? [[sub('A', 's,req'), qh(c.As0 * c.k, 'As')], ['k', fmt(c.k, 2)]] : []),
    [sub('N', 'Rd'), qh(d.Ncomp, 'N')],
    [sub('N', 'Rd,t'), qh(d.Ntrac, 'N')],
    [`${sub('M', 'Rd,máx')} (N = ${fmt(mp.N, 0)})`, qh(mp.M, 'M')],
    [`${sub('N', 'Rd,hormigón')}`, qh(dH.Ncomp, 'N')],
  ];
  const tarjetaGraf = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('fcr.diagrama')), h('p', { class: 'sub' }, t('fcr.diagramaSub')), graficoNM(ctx, d, dH, gam, s));
  const tarjetaRes = h('article', { class: 'panel tarjeta' });
  tarjetaRes.append(pestanas({ lista: [['resultados', t('t.resultados')], ['esfuerzos', t('fcr.esfuerzos')], ['seccion', t('g.seccion')]], activa: est.pestana, onCambio: (k) => { est.pestana = k; ctx.pintar(); } }));
  if (est.pestana === 'seccion') tarjetaRes.append(h('div', { class: 'lienzo', html: dibujoSeccion(geo, s, { ancho: 360, alto: 300 }) }));
  else if (est.pestana === 'esfuerzos') tarjetaRes.append(tablaEsfuerzos(gam));
  else tarjetaRes.append(cifras(cif), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(p, d, dH, gmin));
  res.append(h('div', { class: 'cuerpo dib-ancho' }, tarjetaGraf, tarjetaRes));
}

function tablaEsfuerzos(gam) {
  const filas = gam.map((x) => [String(x.i + 1), fmt(x.N, 0), fmt(x.M, 0), x.N !== 0 ? fmt((x.M / x.N) * 1000, 0) : '∞', sigla(x.g),
    `<span class="${x.g >= 1 - 1e-6 ? 'ok' : 'no'}">${x.g >= 1 - 1e-6 ? t('fcr.dentroSello') : t('fcr.fueraSello')}</span>`]);
  const cont = h('div', {}, h('table', { class: 'tabla', html: `<thead><tr>${['#', 'N<sub>Ed</sub> (kN)', 'M<sub>Ed</sub> (kN·m)', 'e (mm)', 'γ', ''].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>` }));
  return cont;
}

/** Contorno N-M (x = N, y = M) con la envolvente del hormigón solo y los esfuerzos: verde dentro, rojo fuera. */
function graficoNM(ctx, d, dH, gam, s) {
  const xy = (rama) => [...rama].reverse().map((v) => [v.N, v.M]);
  const series = [
    { nombre: ind('M', 'Rd'), clase: 's1', xy: xy(d.pos) },
    { nombre: t('fcr.hormigon'), clase: 'ref', cruz: false, xy: xy(dH.pos) },
  ];
  const puntos = gam.map((x) => ({ x: x.N, y: x.M, etq: String(x.i + 1), marca: x.g >= 1 - 1e-6 ? 'ok' : 'no' }));
  return h('div', { class: 'lienzo' }, grafica({
    series, puntos,
    ejeX: { titulo: `N (kN), ${t('fcr.compPos')}`, d: 0 },
    ejeY: { titulo: 'M (kN·m)', d: 0 },
    archivo: `N-M ${s.nombre}`,
    avisar: ctx.avisar,
  }));
}

function traza(p, d, dH, gmin) {
  const fam = NORMAS[p.norma];
  const art = (a, b, c) => `<span class="art">${fam.ref} · ${p.norma === 'EC2-2004' ? c ?? b : fam.familia === 'EHE' ? a : b}</span>`;
  const filas = [
    { id: 'coef', nom: t('fcr.coefSeg'), val: sigla(gmin), cuenta: `<span class="f">${t('fcr.f.rayo')}</span>` },
    { id: 'mrd', nom: t('fcr.contorno'), val: `${fmt(d.pos.length + d.neg.length, 0)} ${t('fcr.puntosCont')}`, cuenta: `<span class="f">${t('fcr.f.contorno')}</span>
      <span class="n">${t('fcr.f.ref', q(d.yref, 'long'))}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'nrd', nom: sub('N', 'Rd'), val: q(d.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.nrd')}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'env', nom: t('fcr.hormigon'), val: q(dH.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.env')}</span>` },
  ];
  return h('div', { class: 'traza' }, ...filas.map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  }));
}

export function comandos(ctx) {
  return [
    { k: 'p.fcrComprobar', b: 'flexion compuesta recta comprobar interaccion', f: () => { est.modo = 'comprobar'; ctx.ir('flexRecta'); } },
    { k: 'p.fcrDimensionar', b: 'flexion compuesta recta dimensionar interaccion', f: () => { est.modo = 'dimensionar'; ctx.ir('flexRecta'); } },
  ];
}
