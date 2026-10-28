// Pantalla de Materiales · Propiedades reológicas: fluencia y retracción de un hormigón del proyecto
// (EHE-08 39.7 y 39.8, EC-2 2004 3.1.4 y anexo B, EC-2 2023 anexo B). Solo calcula: no cambia el proyecto.
// Datos a la izquierda, curvas en el centro (tiempo en escala logarítmica) y valores con su cuenta a la derecha.

import { propiedadesHormigon, opcionesHormigon } from '../../core/materiales.js';
import { fluencia, retraccion, evolucionEdad, limiteTension, fluenciaNoLineal, edadFinal } from '../../core/reologia.js';
import { normaMat } from '../../norma/materiales/index.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, selector, grupo, aviso, pestanas, tabla } from '../campos.js';
import { filasPlegables } from '../filasPlegables.js';
import { grafica } from '../grafica.js';

const est = { hormigon: null, cemento: null, HR: 70, h0: 200, t0: 28, ts: null, modo: 'final', t: 365, sigma: 0, pestana: 'fluencia' };
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => `${ESP}<span class="u u-cab">[${ud}]</span>`;

export function reiniciar() { Object.assign(est, { hormigon: null, cemento: null, HR: 70, h0: 200, t0: 28, ts: null, modo: 'final', t: 365, sigma: 0, pestana: 'fluencia' }); }

function hormigonActivo(ctx) {
  const L = ctx.p.hormigones;
  return L.find((x) => x.nombre === est.hormigon) ?? L[0] ?? null;
}

export function datos(ctx, form) {
  const L = ctx.p.hormigones;
  const m = hormigonActivo(ctx);
  const norma = ctx.p.norma;
  const N = normaMat(norma);
  if (!m) return poner(form, aviso(t('rg.sinHormigon'), ''));
  const cem = est.cemento ?? m.cemento ?? 'N';
  const cambio = () => ctx.pintar();
  poner(form,
    grupo(null,
      selector({ id: 'rg-hor', etq: t('hormigon'), opciones: L.map((x) => [x.nombre, `${x.nombre} · f<sub>ck</sub> ${x.fck}`]), valor: m.nombre, onCambio: (v) => { est.hormigon = v; est.cemento = null; cambio(); } }),
      selector({ id: 'rg-cem', etq: t('mat.cemento'), opciones: ['S', 'N', 'R'].map((c) => [c, t(`mat.cem.${c}`)]), valor: cem, onCambio: (v) => { est.cemento = v; cambio(); } })),
    grupo(t('rg.ambiente'),
      campoNum({ id: 'rg-hr', etq: t('rg.HR') + U('%'), valor: est.HR, paso: 5, min: 20, max: 100, onCambio: (v) => { est.HR = v; cambio(); } }),
      campoNum({ id: 'rg-h0', etq: sub('h', '0') + U('mm'), ayuda: t('rg.h0Ayuda'), valor: est.h0, paso: 50, min: 20, max: 5000, onCambio: (v) => { est.h0 = v; cambio(); } })),
    grupo(t('rg.edades'),
      campoNum({ id: 'rg-t0', etq: sub('t', '0') + U(t('dias')), ayuda: t('rg.t0Ayuda'), valor: est.t0, paso: 1, min: 1, max: 36500, onCambio: (v) => { est.t0 = v; cambio(); } }),
      campoNum({ id: 'rg-ts', etq: sub('t', 's') + U(t('dias')), ayuda: t('rg.tsAyuda'), valor: est.ts ?? (norma === 'EC2-2023' ? 1 : 7), paso: 1, min: 0, max: 365, onCambio: (v) => { est.ts = v; cambio(); } }),
      selector({ id: 'rg-modo', etq: t('rg.edadCalculo'), opciones: [['final', norma === 'EC2-2023' ? t('rg.cincuenta') : t('rg.infinito')], ['otra', t('rg.otra')]], valor: est.modo, onCambio: (v) => { est.modo = v; cambio(); } }),
      est.modo === 'otra' ? campoNum({ id: 'rg-t', etq: 't' + U(t('dias')), valor: est.t, paso: 30, min: est.t0 + 1, max: 100000, onCambio: (v) => { est.t = v; cambio(); } }) : null),
    grupo(t('rg.carga'),
      campoNum({ id: 'rg-sig', etq: sub('σ', 'c') + U('MPa'), ayuda: t('rg.sigAyuda', N.art.fluencia), valor: est.sigma, paso: 1, min: 0, max: 100, onCambio: (v) => { est.sigma = v; cambio(); } })));
}

const art = (N, k) => `<span class="art">${N.corto} · ${N.art[k]}</span>`;
const F = (s) => `<span class="f">${s}</span>`;
const Nn = (s) => `<span class="n">${s}</span>`;
const e6 = (x) => fmt(x * 1e6, 0);

/** Valores del hormigón y de las edades, listos para las funciones del núcleo. */
function entradas(ctx, m) {
  const norma = ctx.p.norma;
  const q = propiedadesHormigon(m.fck, norma, opcionesHormigon(m, norma));
  const cemento = est.cemento ?? m.cemento ?? 'N';
  const ts = est.ts ?? (norma === 'EC2-2023' ? 1 : 7);
  const tFin = est.modo === 'otra' ? Math.max(est.t, est.t0 + 1) : edadFinal(norma);
  const base = { fck: m.fck, HR: est.HR, h0: est.h0, t0: est.t0, cemento };
  return { norma, q, cemento, ts, tFin, base };
}

const logx = (a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => a * Math.pow(b / a, i / n));

function curvas(ctx, E, N) {
  const tMax = Math.max(Number.isFinite(E.tFin) ? E.tFin : 36500, est.t0 * 2);
  const ver = est.pestana === 'retraccion' ? 'retraccion' : 'fluencia';
  const desde = ver === 'fluencia' ? est.t0 * 1.02 : Math.max(E.ts + 0.5, 1);
  const ts = logx(desde, tMax);
  const lg = (x) => Math.log10(x);
  if (ver === 'fluencia') {
    const xy = ts.map((tt) => [lg(tt), fluencia(E.norma, { ...E.base, t: tt }).phi]);
    return grafica({ series: [{ nombre: 'φ(t, t₀)', xy, clase: 's1' }], puntos: [{ x: lg(tMax), y: xy.at(-1)[1], etq: '' }],
      ejeX: { titulo: 'log₁₀ t [días]', d: 2 }, ejeY: { titulo: 'φ(t, t₀)', d: 2 }, archivo: 'fluencia', avisar: ctx.avisar });
  }
  const r = (tt) => retraccion(E.norma, { ...E.base, t: tt, ts: E.ts });
  const total = ts.map((tt) => [lg(tt), r(tt).total * 1000]);
  const sec = ts.map((tt) => [lg(tt), r(tt).secado * 1000]);
  const aut = ts.map((tt) => [lg(tt), r(tt).autogena * 1000]);
  return grafica({ series: [{ nombre: t('rg.total'), xy: total, clase: 's1' }, { nombre: t('rg.secado'), xy: sec, clase: 's2' }, { nombre: t('rg.autogena'), xy: aut, clase: 'ref' }],
    puntos: [{ x: lg(tMax), y: total.at(-1)[1], etq: '' }],
    ejeX: { titulo: 'log₁₀ t [días]', d: 2 }, ejeY: { titulo: 'ε [‰]', d: 3 }, archivo: 'retraccion', avisar: ctx.avisar });
}

export function resultados(ctx, res) {
  const m = hormigonActivo(ctx);
  if (!m) return;
  const N = normaMat(ctx.p.norma);
  const E = entradas(ctx, m);
  const tF = Number.isFinite(E.tFin) ? E.tFin : undefined;
  const flu = fluencia(E.norma, { ...E.base, t: tF });
  const ret = retraccion(E.norma, { ...E.base, t: tF, ts: E.ts });
  const edad = evolucionEdad(E.norma, { fck: m.fck, fcm: E.q.fcm, fctm: E.q.fctm, Ecm: E.q.Ec, cemento: E.cemento, t: est.t0 });
  const lim = limiteTension(E.norma, { fck: m.fck, fcmT0: edad.fcm });

  const avisos = [];
  if (est.t0 < 1) avisos.push(['error', t('rg.avT0')]);
  if (est.sigma > lim) avisos.push(['', t(E.norma === 'EHE-08' ? 'rg.avNoLinealEHE' : 'rg.avNoLineal', fmt(lim, 1), fmt(est.sigma, 1))]);
  poner(res, ...avisos.map(([k, x]) => aviso(x, k)));

  const dib = h('article', { class: 'panel tarjeta' },
    pestanas({ lista: [['fluencia', t('rg.fluencia')], ['retraccion', t('rg.retraccion')]], activa: est.pestana === 'retraccion' ? 'retraccion' : 'fluencia', onCambio: (k) => { est.pestana = k; ctx.pintar(); } }),
    h('p', { class: 'sub' }, `${m.nombre} · ${N.corto}`),
    h('div', { class: 'lienzo' }, curvas(ctx, E, N)));

  const filas = [];
  const cuentas = [];
  const fila = (etq, val, cuenta) => { filas.push([etq, val]); cuentas.push(cuenta ?? null); };
  const ec = E.q.Ec;
  fila(`${sub('f', 'cm')}(${sub('t', '0')})${U('MPa')}`, fmt(edad.fcm, 1), F(`${sub('f', 'cm')}(t) = ${sub('β', 'cc')}(t)·${sub('f', 'cm')}`) + Nn(`${sub('β', 'cc')}(${est.t0}) = ${fmt(edad.beta, 3)}`) + art(N, 'edad'));
  fila(`φ(${tF ? 't' : '∞'}, ${sub('t', '0')})`, fmt(flu.phi, 2), F(`φ(t, ${sub('t', '0')}) = ${sub('φ', '0')}·${sub('β', 'c')}(t, ${sub('t', '0')})`)
    + Nn(E.norma === 'EC2-2023' ? `${sub('φ', 'b')} = ${fmt(flu.phiBasica, 2)}; ${sub('φ', 'd')} = ${fmt(flu.phiSecado, 2)}` : `${sub('φ', '0')} = ${fmt(flu.phi0, 2)}; ${sub('β', 'c')} = ${fmt(flu.bc, 3)}`) + art(N, 'fluencia'));
  if (est.sigma > 0) {
    const nl = fluenciaNoLineal(E.norma, flu.phi, est.sigma, { fck: m.fck, fcmT0: edad.fcm, t0: est.t0 });
    fila(`${sub('φ', 'nl')}`, fmt(nl, 2), F(`φ<sub>nl</sub> = φ·exp(1.5·(k<sub>σ</sub> − ${E.norma === 'EC2-2023' ? '0.40' : '0.45'}))`) + Nn(`= ${fmt(nl, 2)}`) + art(N, 'fluencia'));
  }
  fila(`${sub('E', 'c,ef')}${U('MPa')}`, fmt(ec / (1 + flu.phi), 0), F(`${sub('E', 'c,ef')} = ${sub('E', 'cm')}/(1 + φ)`) + Nn(`= ${fmt(ec, 0)}/(1 + ${fmt(flu.phi, 2)}) = ${fmt(ec / (1 + flu.phi), 0)}`) + art(N, 'fluencia'));
  fila(`${sub('ε', 'cs')}${U('·10⁻⁶')}`, e6(ret.total), F(`${sub('ε', 'cs')} = ${sub('ε', 'cd')} + ${sub('ε', 'ca')}`) + Nn(`${e6(ret.secado)} + ${e6(ret.autogena)} = ${e6(ret.total)}`) + art(N, 'retraccion'));
  fila(`${sub('ε', 'cd')}${U('·10⁻⁶')}`, e6(ret.secado), Nn(t('rg.cuentaSecado')) + art(N, 'retraccion'));
  fila(`${sub('ε', 'ca')}${U('·10⁻⁶')}`, e6(ret.autogena), Nn(t('rg.cuentaAutogena')) + art(N, 'retraccion'));
  const tarjeta = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('rg.valores')), h('p', { class: 'sub' }, tF ? `t = ${fmt(tF, 0)} ${t('dias')}` : t('rg.valorFinal')));
  poner(tarjeta, filasPlegables(tabla(filas), cuentas));
  poner(res, h('div', { class: 'cuerpo' }, dib, tarjeta));
}
