// Pantalla de Durabilidad: las condiciones de durabilidad del proyecto, independientes de las
// secciones (equivale a la parte de durabilidad de Unit4.pas del Prontuario 3.1). A la izquierda,
// exposición y ejecución; en medio, las tablas de la norma con la fila que manda marcada; a la
// derecha, el recubrimiento nominal, las condiciones del hormigón y la comprobación de las secciones.

import { recubrimientoMinimo } from '../../core/geometria.js';
import { modulo } from '../../norma/index.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, selector, casillas, grupo, par, aviso, tabla } from '../campos.js';
import * as EHE08 from './durabilidadEHE08.js';
import * as EC2 from './durabilidadEC2.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => ` <span class="u u-cab">[${ud}]</span>`;

/** Condiciones del proyecto; las primeras veces se toman de la primera sección que las tenía. */
function condiciones(p) {
  if (!p.durabilidad) {
    const s = p.secciones.find((x) => x.durabilidad);
    p.durabilidad = { ambiente: 'I', exposiciones: [], ...(s?.durabilidad ?? {}), hormigon: s?.hormigon ?? p.hormigones[0]?.nombre };
  }
  return p.durabilidad;
}

function fckDe(p, D) {
  return (p.hormigones.find((m) => m.nombre === D.hormigon) ?? p.hormigones[0])?.fck ?? 25;
}

export function datos(ctx, form) {
  if (ctx.p.norma === 'EHE-08') return EHE08.datos(ctx, form);
  if (ctx.p.norma === 'EC2-2004') return EC2.datos(ctx, form);
  const p = ctx.p;
  const D = condiciones(p);
  const cambio = () => ctx.cambio();
  const set = (k) => (v) => { D[k] = v; cambio(); };
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.durabilidad')), h('p', {}, t('dur.subtitulo'))));
  poner(form, grupo(t('dur.hormigonPrevisto'),
    selector({ id: 'd-hor', etq: t('hormigon'), opciones: p.hormigones.map((m) => [m.nombre, `${m.nombre} · ${sub('f', 'ck')} ${fmt(m.fck, 0)} MPa`]), valor: D.hormigon ?? p.hormigones[0]?.nombre, onCambio: set('hormigon') })));
  const comunes = [
    campoNum({ id: 'd-cerco', etq: `ø ${t('dur.cerco')}`, valor: D.fiCerco ?? 8, mag: 'diam', paso: 2, min: 0, max: 20, onCambio: set('fiCerco') }),
  ];
  if (p.norma === 'EHE-98') {
    const { AMBIENTES, EXPOSICIONES, CONSISTENCIAS } = modulo('EHE-98').durabilidad;
    poner(form, grupo(t('dur.exposicion'),
      selector({ id: 'd-amb', etq: t('dur.ambiente'), opciones: AMBIENTES.map((a) => [a, `${a} · ${t(`amb.${a}`)}`]), valor: D.ambiente ?? 'I', onCambio: set('ambiente') }),
      casillas({ id: 'd-exp', etq: t('dur.especificas'), opciones: EXPOSICIONES.map((e) => [e, `${e} · ${t(`exp.${e}`)}`]), marcadas: D.exposiciones ?? [], onCambio: set('exposiciones') }),
    ), grupo(t('dur.ejecucion'),
      selector({ id: 'd-tipo', etq: t('dur.elemento'), opciones: [['general', t('dur.general')], ['prefabricado', t('dur.prefabricado')]], valor: D.tipo ?? 'general', onCambio: set('tipo') }),
      selector({ id: 'd-ctrl', etq: t('dur.control'), opciones: [['normal', t('dur.ctrlNormal')], ['intenso', t('dur.ctrlIntenso')], ['prefabricadoIntenso', t('dur.ctrlPref')]], valor: D.control ?? 'normal', onCambio: set('control') }),
      selector({ id: 'd-cons', etq: t('dur.consistencia'), opciones: CONSISTENCIAS.map((c) => [c, `${c} · ${t(`cons.${c}`)}`]), valor: D.consistencia ?? 'B', onCambio: set('consistencia') }),
      par(campoNum({ id: 'd-arido', etq: t('dur.aridoCorto'), valor: D.arido ?? 20, mag: 'diam', paso: 2, min: 4, max: 80, onCambio: set('arido') }), ...comunes)));
  } else {
    const { CLASES } = modulo(p.norma).durabilidad;
    poner(form, grupo(t('dur.exposicion'),
      casillas({ id: 'd-cls', etq: t('dur.clases'), opciones: CLASES.map((c) => [c, c]), marcadas: D.clases ?? [], onCambio: set('clases') }),
    ), grupo(t('dur.recubrimiento'),
      campoNum({ id: 'd-cdur', etq: sub('c', 'min,dur'), ref: t('dur.tablas63'), valor: D.cminDur ?? 0.02, mag: 'long', paso: 5, min: 0, max: 0.1, onCambio: set('cminDur') }),
      campoNum({ id: 'd-dev', etq: 'Δ' + sub('c', 'dev'), valor: D.dcdev ?? 0.01, mag: 'long', paso: 5, min: 0, max: 0.05, onCambio: set('dcdev') }),
      campoNum({ id: 'd-fimax', etq: `ø ${t('dur.barraMax')}`, ref: sub('c', 'min,b'), valor: D.fiMax ?? 20, mag: 'diam', paso: 2, min: 0, max: 40, onCambio: set('fiMax') }),
      ...comunes,
      h('p', { class: 'pista', html: t('dur.pistaEC2') })));
  }
}

/** Cálculo con las condiciones del proyecto. */
function calcular(p, D) {
  const mod = modulo(p.norma).durabilidad;
  const fck = fckDe(p, D);
  return p.norma === 'EHE-98'
    ? { fck, r: mod.durabilidad({ ambiente: D.ambiente ?? 'I', exposiciones: D.exposiciones ?? [], fck, tipo: D.tipo, control: D.control, arido: D.arido ?? 20, consistencia: D.consistencia }) }
    : { fck, r: mod.durabilidad({ clases: D.clases ?? [], cminDur: (D.cminDur ?? 0.02) * 1000, fiMax: D.fiMax ?? 20, dcdev: (D.dcdev ?? 0.01) * 1000 }) };
}

export function resultados(ctx, res) {
  if (ctx.p.norma === 'EHE-08') return EHE08.resultados(ctx, res);
  if (ctx.p.norma === 'EC2-2004') return EC2.resultados(ctx, res);
  const p = ctx.p;
  const D = condiciones(p);
  const { fck, r } = calcular(p, D);
  const ehe = p.norma === 'EHE-98';

  // Un solo cartel: el recubrimiento nominal
  res.append(h('div', { class: 'veredicto sin-barra' },
    h('div', { class: 'ratio' }, h('span', { class: 'etq', html: t('dur.rnomLargo') }), h('span', { class: 'v', html: `${fmt(r.rnom, 0)}<span class="u">${ESP}mm</span>` })),
    h('div', { class: 'medidor' }, h('div', { class: 'ecu', html: ehe
      ? `${sub('r', 'nom')} = ${sub('r', 'min')} + Δr = <b>${fmt(r.rmin, 0)}</b> + <b>${fmt(r.dr, 0)}</b> = <b>${fmt(r.rnom, 0)}${ESP}mm</b> · <span class="art">EHE-98 · art. 37.2.4</span>`
      : `${sub('c', 'nom')} = ${sub('c', 'min')} + Δ${sub('c', 'dev')} = <b>${fmt(r.cmin, 0)}</b> + <b>${fmt(r.dr, 0)}</b> = <b>${fmt(r.rnom, 0)}${ESP}mm</b> · <span class="art">${NORMAS[p.norma].ref} · ${r.articulos.rnom}</span>` })),
    h('span', {}, '')));
  if (ehe && !r.cumpleFck) res.append(aviso(t('dur.avisoFckProy', D.hormigon, fmt(fck, 0), fmt(r.fckMin, 0)), 'error'));

  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  if (ehe) tablasEHE(centro, D, r, fck); else tablasEC2(centro, r);
  resumen(ctx, dcha, D, r, fck);
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Tablas 37.2.4 (recubrimiento mínimo) y 37.3.2 (condiciones del hormigón) en una sola, con lo que aplica marcado. */
function tablasEHE(tar, D, r, fck) {
  const { AMBIENTES, EXPOSICIONES, RMIN, AC, CEMENTO, FCK } = modulo('EHE-98').durabilidad;
  const amb = D.ambiente ?? 'I';
  const exps = D.exposiciones ?? [];
  const clases = [amb, ...exps];
  // Para el recubrimiento, la clase Q más agresiva manda sobre la clase general
  const filaR = ['Qc', 'Qb', 'Qa'].find((x) => exps.includes(x)) ?? amb;
  const tab = RMIN[D.tipo ?? 'general'] ?? RMIN.general;
  const alto = fck >= 40;
  const conR = [...AMBIENTES, 'Qa', 'Qb', 'Qc'];
  const peor = (T, f) => clases.map((c) => T[c]).reduce((a, b) => f(a, b));
  const ac = peor(AC, Math.min);
  const cem = peor(CEMENTO, Math.max);
  const fmin = peor(FCK, Math.max);
  const b = (txt, si) => (si ? `<b class="manda">${txt}</b>` : txt);
  const filas = [...AMBIENTES, ...EXPOSICIONES].map((c) => {
    const k = conR.indexOf(c);
    const act = clases.includes(c);
    const f = [`${c} <span class="nota">${t(AMBIENTES.includes(c) ? `amb.${c}` : `exp.${c}`)}</span>`,
      k < 0 ? '—' : b(String(tab.bajo[k]), c === filaR && !alto),
      k < 0 ? '—' : b(String(tab.alto[k]), c === filaR && alto),
      b(fmt(AC[c], 2), act && AC[c] === ac), b(fmt(CEMENTO[c], 0), act && CEMENTO[c] === cem), b(fmt(FCK[c], 0), act && FCK[c] === fmin)];
    if (act) f.clase = 'activa';
    return f;
  });
  poner(tar,
    h('h2', { html: t('dur.tablaEHE') }),
    h('p', { class: 'nota', html: t('dur.tablaEHESub', t(D.tipo === 'prefabricado' ? 'dur.prefabricado' : 'dur.general').toLowerCase()) }),
    tablaMarcada(filas, ['', `${sub('r', 'min')} ${sub('f', 'ck')}&lt;40` + U('mm'), `${sub('r', 'min')} ${sub('f', 'ck')}≥40` + U('mm'), t('dur.acCorto'), t('dur.cementoCorto') + U('kg/m³'), `${sub('f', 'ck')} ${t('dur.minima')}` + U('MPa')]),
    r.mandaRmin === 'arido' ? h('p', { class: 'nota', html: t('dur.mandaArido', fmt(D.arido ?? 20, 0), fmt(r.rmin, 0)) }) : null);
}

function tablasEC2(tar, r) {
  const fila = (etq, v, k) => { const f = [etq, r.mandaCmin === k ? `<b class="manda">${fmt(v, 0)}</b>` : fmt(v, 0)]; if (r.mandaCmin === k) f.clase = 'activa'; return f; };
  poner(tar,
    h('h2', { html: t('dur.cminTitulo') }),
    tablaMarcada([
      fila(`${sub('c', 'min,b')} <span class="nota">${t('dur.adherencia')}</span>`, r.cminB, 'b'),
      fila(`${sub('c', 'min,dur')} <span class="nota">${t('dur.tablas63')}</span>`, r.cminDur, 'dur'),
      fila(t('dur.minAbsoluto'), 10, 'diez'),
    ], ['', t('dur.valor') + U('mm')]),
    h('p', { class: 'nota', html: t('dur.ec2Explica') }),
    h('h2', { style: 'margin-top:10px' }, t('dur.clases')),
    h('p', { class: 'nota', html: r.clases.length ? r.clases.map((c) => `<b>${c}</b>`).join(' · ') : t('dur.sinClases') }),
    h('p', { class: 'pista', html: t('dur.pistaEC2') }));
}

function tablaMarcada(filas, cabecera) {
  const tb = tabla(filas, { cabecera, clase: 'tabla-dur' });
  tb.querySelectorAll('tbody tr').forEach((tr, i) => { if (filas[i].clase) tr.classList.add(filas[i].clase); });
  return tb;
}

/** Condiciones que salen y comprobación de las secciones del proyecto. */
function resumen(ctx, tar, D, r, fck) {
  const p = ctx.p;
  const ehe = p.norma === 'EHE-98';
  const filas = ehe
    ? [
      [t('dur.rmin') + U('mm'), `${r.mandaRmin === 'arido' ? `<span class="nota">${t('dur.porArido')}</span> ` : ''}${fmt(r.rmin, 0)}`],
      ['Δr' + U('mm'), fmt(r.dr, 0)],
      [`<b>${sub('r', 'nom')}</b>` + U('mm'), `<b>${fmt(r.rnom, 0)}</b>`],
      [t('dur.acMax'), fmt(r.ac, 2)],
      [t('dur.cementoMin') + U('kg/m³'), fmt(r.cemento, 0)],
      [`${sub('f', 'ck')} ${t('dur.minima')}` + U('MPa'), `${r.cumpleFck ? '' : `<span class="mal">(${t('dur.materialMenor', fmt(fck, 0))})</span> `}${fmt(r.fckMin, 0)}`],
      [t('dur.tipificacion'), r.tipificacion],
    ]
    : [
      [sub('c', 'min') + U('mm'), fmt(r.cmin, 0)],
      ['Δ' + sub('c', 'dev') + U('mm'), fmt(r.dr, 0)],
      [`<b>${sub('c', 'nom')}</b>` + U('mm'), `<b>${fmt(r.rnom, 0)}</b>`],
      [t('dur.clases'), r.tipificacion || '—'],
    ];
  poner(tar, h('h2', {}, t('dur.condiciones')), tabla(filas),
    ...(r.notas.length ? [h('h3', {}, t('dur.requisitos')), h('ul', { class: 'nota' }, ...r.notas.map((n) => h('li', { html: t(n.clave, n.v) })))] : []));

  // Recubrimiento real de cada sección frente al nominal
  const cerco = D.fiCerco ?? 8;
  const filasS = p.secciones.map((s) => {
    const geo = geometriaDe(p, s);
    const rec = geo.errores.length ? null : recubrimientoMinimo(geo, cerco);
    if (!rec) return [s.nombre, '—', `<span class="nota">${t('dur.sinBarrasCorto')}</span>`];
    const c = rec.c * 1000;
    const ok = c >= r.rnom - 1e-6 && !rec.fuera;
    return [s.nombre, fmt(c, 0), ok ? `<span class="bien">${t('cumple')}</span>` : `<span class="mal">${t('noCumple')}</span>`];
  });
  poner(tar, h('h2', { style: 'margin-top:10px' }, t('dur.secciones')),
    filasS.length ? tabla(filasS, { cabecera: [t('seccion'), t('dur.recRealCorto') + U('mm'), ''] }) : aviso(t('dur.sinSecciones'), 'info'),
    h('p', { class: 'nota', html: t('dur.notaReal', fmt(cerco, 0)) }));
}

export function comandos(ctx) {
  return [];
}
