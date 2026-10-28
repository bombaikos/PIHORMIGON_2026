// Anclaje y solapo de barras corrugadas: pantalla informativa e independiente de las secciones. A la izquierda,
// hormigón, acero y las condiciones fijas (esfuerzo, armadura necesaria, recubrimiento, % solapado); en medio, la
// tabla por diámetro en posición favorable (I) y desfavorable (II); a la derecha, el esquema acotado y las notas.

import { anclaje, solape } from '../../norma/anclaje.js';
import { t } from '../i18n.js';
import { fmt, ESP, serieDiametros } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, par, tabla } from '../campos.js';
import { filasPlegables } from '../filasPlegables.js';
import { dibujoAnclaje } from '../dibujoAnclaje.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;

const INICIAL = () => ({ hormigon: null, acero: null, esfuerzo: 'traccion', r: 100, cd: 25, pct: 100, lejos: false, via: 'viga' });

function estado(p) {
  p.calculos.anclaje ??= INICIAL();
  const D = p.calculos.anclaje;
  if (!p.hormigones.some((m) => m.nombre === D.hormigon)) D.hormigon = (p.hormigones.find((m) => m.nombre === 'HA-40') ?? p.hormigones[0])?.nombre ?? null;
  if (!p.aceros.some((m) => m.nombre === D.acero)) D.acero = (p.aceros.find((m) => m.nombre === 'B 500 SD') ?? p.aceros[0])?.nombre ?? null;
  return D;
}

const normaEHE = (p) => p.norma === 'EHE-08' || p.norma === 'EHE-98';
/** Id de norma del núcleo: la EHE-98 se trata como EHE-08 (migrada al abrir). */
const idNorma = (p) => (normaEHE(p) ? 'EHE-08' : p.norma);

export function datos(ctx, form) {
  const p = ctx.p;
  const D = estado(p);
  const ehe = normaEHE(p);
  const cambio = (estructura) => ctx.cambio(estructura ? { estructura: true } : undefined);
  const set = (k) => (v) => { D[k] = v; cambio(); };
  const seg = (k, opciones, etq, est = true) => h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo' }, etq),
    segmentado({ opciones, valor: D[k], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(est); } }));
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.anclaje')), h('p', {}, t('an.subtitulo'))));
  poner(form,
    grupo(t('an.materiales'), par(
      selector({ id: 'an-hor', etq: t('an.hormigon'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: D.hormigon, onCambio: (v) => { D.hormigon = v; cambio(true); } }),
      selector({ id: 'an-ace', etq: t('an.acero'), opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: D.acero, onCambio: (v) => { D.acero = v; cambio(true); } }))),
    grupo(t('an.armado'),
      seg('esfuerzo', [['traccion', t('an.traccion')], ['compresion', t('an.compresion')]], t('an.esfuerzo'), true),
      par(
        campoNum({ id: 'an-r', etq: t('an.r'), valor: D.r, mag: 'pct', paso: 5, min: 1, max: 100, ayuda: t('an.rAyuda'), onCambio: set('r') }),
        campoNum({ id: 'an-cd', etq: t('an.cd'), valor: D.cd, mag: 'diam', paso: 5, min: 0, max: 200, ayuda: t('an.cdAyuda'), onCambio: set('cd') })),
      ehe ? seg('via', [['viga', t('an.viaViga')], ['corrugas', t('an.viaCorr')]], t('an.via')) : null),
    grupo(t('an.solapo'),
      campoNum({ id: 'an-pct', etq: t('an.pct'), valor: D.pct, mag: 'pct', paso: 5, min: 1, max: 100, ayuda: t('an.pctAyuda'), onCambio: set('pct') }),
      ehe ? seg('lejos', [[false, t('an.cerca')], [true, t('an.lejos')]], t('an.dist')) : null));
}

/** Entrada común del núcleo para un diámetro y una posición. */
function base(p, D, fck, fyk) {
  return {
    norma: idNorma(p), via: D.via, fck, fyk, esfuerzo: D.esfuerzo, r: D.r / 100, cd: D.cd > 0 ? D.cd : null,
    pct: D.pct, lejos: !!D.lejos,
  };
}

const sobre5 = (x) => Math.ceil(x / 5 - 1e-9) * 5;

/** Todas las casillas de la tabla (y del contraste con el CE). */
function calcular(p, D) {
  const hor = p.hormigones.find((m) => m.nombre === D.hormigon);
  const ace = p.aceros.find((m) => m.nombre === D.acero);
  if (!hor || !ace) return null;
  const b = base(p, D, hor.fck, ace.fyk);
  const comp = D.esfuerzo === 'compresion';
  const ehe = b.norma === 'EHE-08';
  const filas = serieDiametros().map((phi) => {
    const celda = (adh, forma) => {
      const a = anclaje({ ...b, phi, adherencia: adh, forma, recPerp: b.cd });
      return { v: sobre5(a.lbd), min: a.lbd <= a.lbMin + 1e-6 };
    };
    const sol = (adh) => {
      if (ehe && phi > 32) return { v: null, est: true };
      const s = solape({ ...b, phi, adherencia: adh });
      return { v: sobre5(s.ls), min: s.lsMin != null ? s.ls <= s.lsMin + 1e-6 : false, g: !ehe && phi > 32 };
    };
    return {
      phi,
      I: [celda('buena', 'recta'), comp ? null : celda('buena', 'patilla')],
      II: [celda('deficiente', 'recta'), comp ? null : celda('deficiente', 'patilla')],
      sI: sol('buena'), sII: sol('deficiente'),
    };
  });
  // Contraste con el CE 49.5 (vía del ensayo de la viga): solo cuando se proyecta con EC-2 2004
  let ce = null;
  if (b.norma === 'EC2-2004') {
    const bc = { ...b, norma: 'EHE-08', via: 'viga', lejos: false };
    ce = serieDiametros().map((phi, i) => {
      const f = filas[i];
      const l = (adh) => sobre5(anclaje({ ...bc, phi, adherencia: adh, forma: 'recta' }).lbd);
      const s = (adh) => (phi > 32 ? null : sobre5(solape({ ...bc, phi, adherencia: adh }).ls));
      const x = { phi, lI: l('buena'), lII: l('deficiente'), sI: s('buena'), sII: s('deficiente') };
      x.maI = x.lI > f.I[0].v; x.maII = x.lII > f.II[0].v;
      x.msI = x.sI != null && f.sI.v != null && x.sI > f.sI.v; x.msII = x.sII != null && f.sII.v != null && x.sII > f.sII.v;
      return x;
    });
  }
  return { hor, ace, filas, ce, b };
}

function articulo(p, D) {
  const n = idNorma(p);
  if (n === 'EHE-08') return D.via === 'corrugas' ? 'EHE-08 · 69.5.1.2 (geometría de corrugas) y 69.5.2.2' : 'EHE-08 · 69.5.1.2 (ensayo de la viga) y 69.5.2.2 (= CE 49.5)';
  if (n === 'EC2-2004') return 'UNE-EN 1992-1-1 · 8.4 y 8.7';
  return 'EN 1992-1-1:2023 · 11.4 y 11.5';
}

const num = (c, tipo) => {
  if (!c) return '—';
  if (c.est) return 'est.';
  return `${fmt(c.v, 0)}${c.min ? '*' : ''}${c.g ? '†' : ''}`;
};

export function resultados(ctx, res) {
  const p = ctx.p;
  const D = estado(p);
  const comp = D.esfuerzo === 'compresion';
  const r = calcular(p, D);
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  if (!r) {
    poner(centro, h('p', { class: 'nota' }, t('an.sinAcero')));
    res.append(h('div', { class: 'cuerpo' }, centro, dcha));
    return;
  }
  const art = articulo(p, D);
  const ehe = idNorma(p) === 'EHE-08';
  // Cabecera con dos filas: grupos (anclaje, solapo) y posiciones
  const esf = comp ? t('an.compresion') : t('an.traccion');
  const cab = h('thead', {},
    h('tr', {}, h('th', { rowspan: '2', html: `${t('an.col.d')}${ESP}<span class="u u-cab">[mm]</span>` }),
      h('th', { colspan: comp ? '2' : '4', html: t('an.col.anclaje', esf.toLowerCase()) }),
      h('th', { colspan: '2', html: t('an.col.solapo', esf.toLowerCase()) })),
    h('tr', {}, ...(comp
      ? [h('th', { html: `${t('an.col.I')}<br><span class="u u-cab">${t('an.favorable')}</span>` }), h('th', { html: `${t('an.col.II')}<br><span class="u u-cab">${t('an.desfavorable')}</span>` })]
      : [h('th', { html: `I ${t('an.col.recta')}` }), h('th', { html: `I ${t('an.col.patilla')}` }), h('th', { html: `II ${t('an.col.recta')}` }), h('th', { html: `II ${t('an.col.patilla')}` })]),
    h('th', { html: `${t('an.col.I')}<br><span class="u u-cab">${t('an.favorable')}</span>` }), h('th', { html: `${t('an.col.II')}<br><span class="u u-cab">${t('an.desfavorable')}</span>` })));
  const cuerpo = h('tbody', {}, ...r.filas.map((f) => h('tr', {},
    h('th', { scope: 'row' }, String(f.phi)),
    ...(comp ? [h('td', {}, num(f.I[0])), h('td', {}, num(f.II[0]))]
      : [h('td', {}, num(f.I[0])), h('td', {}, num(f.I[1])), h('td', {}, num(f.II[0])), h('td', {}, num(f.II[1]))]),
    h('td', {}, num(f.sI)), h('td', {}, num(f.sII)))));
  const extraA = ehe ? (D.lejos ? t('an.aLejos') : t('an.aCerca')) : '';
  const ficha = t('an.ficha', r.hor.nombre, r.ace.nombre, esf.toLowerCase(), fmt(D.r, 0), D.cd > 0 ? t('an.cdVal', fmt(D.cd, 0)) : t('an.cdSin'), fmt(D.pct, 0), extraA);
  const hdr = [`${t('an.col.d')} [mm]`, ...(comp ? [`${t('an.col.anclaje', esf.toLowerCase()).replace(/<[^>]+>/g, '')} ${t('an.col.I')}`, `${t('an.col.anclaje', esf.toLowerCase()).replace(/<[^>]+>/g, '')} ${t('an.col.II')}`]
    : ['I recta', 'I patilla', 'II recta', 'II patilla'].map((c) => `${t('an.col.anclaje', esf.toLowerCase()).replace(/<[^>]+>/g, '')} ${c}`)),
    `${t('an.col.solapo', esf.toLowerCase()).replace(/<[^>]+>/g, '')} I`, `${t('an.col.solapo', esf.toLowerCase()).replace(/<[^>]+>/g, '')} II`];
  const texto = () => [ficha.replace(/<[^>]+>/g, '').replace(/ /g, ' '), hdr.join('\t'),
    ...[...cuerpo.rows].map((tr) => [...tr.cells].map((c) => c.textContent).join('\t'))].join('\r\n');
  const html = () => `<table><caption>${ficha}</caption><thead><tr>${hdr.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${cuerpo.innerHTML}</tbody></table>`;
  const copiar = async () => {
    try {
      if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([texto()], { type: 'text/plain' }), 'text/html': new Blob([html()], { type: 'text/html' }) })]);
      else await navigator.clipboard.writeText(texto());
      ctx.avisar(t('graf.tablaCopiada'));
    } catch { ctx.avisar(t('graf.error')); }
  };
  const tablaEl = h('table', { class: 'tabla-dur tabla-an', id: 'an-tabla' }, cab, cuerpo);
  tablaEl.addEventListener('copy', (e) => { e.preventDefault(); e.clipboardData.setData('text/plain', texto()); e.clipboardData.setData('text/html', html()); });
  poner(centro,
    h('div', { class: 'an-tit' }, h('h2', { class: 'an-h', html: `${t('m.anclaje')} <span class="an-mat">${r.hor.nombre} ${r.ace.nombre}</span>` }),
      h('button', { type: 'button', class: 'tecla', id: 'an-copiar', title: t('graf.copiarTablaTit'), onclick: copiar }, t('graf.copiar'))), h('p', { class: 'nota', html: `${t('an.titulo')}. ${t('an.sub', art)}` }),
    h('div', { class: 'tabla-scroll' }, tablaEl),
    h('p', { class: 'fu-leyenda', html: t('an.leyenda') }),
    h('p', { class: 'nota an-ficha', id: 'an-ficha', html: ficha }));

  // Derecha: esquema y notas plegadas
  const n = idNorma(p);
  const pos = n === 'EHE-08' ? 'an.pos.ehe' : n === 'EC2-2004' ? 'an.pos.ec2' : 'an.pos.ec23';
  const mn = n === 'EHE-08' ? 'an.min.ehe' : n === 'EC2-2004' ? 'an.min.ec2' : 'an.min.ec23';
  const tv = n === 'EHE-08' ? 'an.transv.ehe' : n === 'EC2-2004' ? 'an.transv.ec2' : 'an.transv.ec23';
  const claves = [['an.n.pos', pos], ['an.n.min', mn], ['an.n.transv', tv], ['an.n.falta', 'an.falta']];
  const tbNotas = tabla(claves.map(([k]) => [t(k)]));
  filasPlegables(tbNotas, claves.map(([, v]) => `<span>${t(v)}</span>`));
  poner(dcha, h('div', { class: 'an-dib', html: dibujoAnclaje({ esfuerzo: D.esfuerzo }) }), h('h3', {}, t('an.notas')), tbNotas);
  if (r.ce) poner(dcha, contrasteCE(r.ce));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Plegable con el valor del CE 49.5 (EC-2 2004): en rojo donde supera al EC-2. */
function contrasteCE(ce) {
  const mas = ce.reduce((n, x) => n + [x.maI, x.maII, x.msI, x.msII].filter(Boolean).length, 0);
  const c = (v, malo) => h('td', malo ? { class: 'an-mas' } : {}, v == null ? '—' : fmt(v, 0));
  const tb = h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla-dur tabla-an' },
    h('thead', {}, h('tr', {}, h('th', { html: 'ø' }), h('th', { html: `${sub('l', 'bd')} I` }), h('th', { html: `${sub('l', 'bd')} II` }), h('th', { html: `${sub('l', 's')} I` }), h('th', { html: `${sub('l', 's')} II` }))),
    h('tbody', {}, ...ce.map((x) => h('tr', {}, h('th', { scope: 'row' }, String(x.phi)), c(x.lI, x.maI), c(x.lII, x.maII), c(x.sI, x.msI), c(x.sII, x.msII))))));
  return h('details', { class: 'pleg an-ce', },
    h('summary', { html: `${t('an.ce.tit')}${mas > 0 ? ' · ⚠' : ''}` }),
    h('div', { class: 'cuenta' }, h('p', { class: 'nota', html: t('an.ce.txt') }), h('p', { class: `nota${mas ? ' an-mas' : ''}`, html: mas ? t('an.ce.mas', mas) : t('an.ce.igual') }), tb));
}

export function comandos() {
  return [];
}
