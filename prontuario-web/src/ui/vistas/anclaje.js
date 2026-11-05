// Anclaje y solapo de barras corrugadas: pantalla informativa e independiente de las secciones. A la izquierda,
// hormigón, acero y las condiciones fijas (esfuerzo, armadura necesaria, recubrimiento, % solapado); en medio, la
// tabla por diámetro en posición favorable (I) y desfavorable (II); a la derecha, el esquema acotado y las notas.

import { anclaje, solape } from '../../norma/anclaje.js';
import { t } from '../i18n.js';
import { fmt, ESP, serieDiametros } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, par, tabla } from '../campos.js';
import { filasPlegables } from '../filasPlegables.js';
import { dibujoAnclaje, dibujoRecubrimiento } from '../dibujoAnclaje.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;

const INICIAL = () => ({ hormigon: null, acero: null, esfuerzo: 'traccion', r: 100, pct: 100, lejos: false, via: 'viga' });

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
  const comp = D.esfuerzo === 'compresion';
  const n = idNorma(p);
  // Los mismos campos con cualquier norma: los que no se aplican se desactivan y dicen por qué (hint al pasar el ratón)
  const inactivo = (c, motivo) => {
    if (!motivo) return c;
    c.classList.add('inactivo');
    c.title = motivo;
    c.querySelectorAll('input,button').forEach((e) => { e.disabled = true; e.title = motivo; });
    return c;
  };
  const seg = (k, opciones, etq, est = true, motivo = null) => inactivo(h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo', html: etq }),
    segmentado({ opciones, valor: motivo ? null : D[k], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(est); } })), motivo);
  const noEHE = ehe ? null : t('an.no.ehe');
  const noDist = ehe ? (comp ? t('an.no.comp') : null) : t('an.no.dist');
  const noPct = n === 'EC2-2023' ? t('an.no.pct23') : ehe && comp ? t('an.no.comp') : null;
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.anclaje'))));
  poner(form,
    grupo(t('an.materiales'), par(
      selector({ id: 'an-hor', etq: t('an.hormigon'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: D.hormigon, onCambio: (v) => { D.hormigon = v; cambio(true); } }),
      selector({ id: 'an-ace', etq: t('an.acero'), opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: D.acero, onCambio: (v) => { D.acero = v; cambio(true); } }))),
    grupo(t('an.armado'),
      seg('esfuerzo', [['traccion', t('an.traccion')], ['compresion', t('an.compresion')]], t('an.esfuerzo'), true),
      campoNum({ id: 'an-r', etq: t('an.r'), valor: D.r, mag: 'pct', paso: 5, min: 1, max: 100, ayuda: t('an.rAyuda'), onCambio: set('r') }),
      seg('via', [['viga', t('an.viaViga')], ['corrugas', t('an.viaCorr')]], t('an.via'), true, noEHE)),
    grupo(t('an.solapo'),
      inactivo(campoNum({ id: 'an-pct', etq: t('an.pct'), valor: D.pct, mag: 'pct', paso: 5, min: 1, max: 100, ayuda: t('an.pctAyuda'), onCambio: set('pct') }), noPct),
      seg('lejos', [[false, t('an.cerca')], [true, t('an.lejos')]], t('an.dist'), true, noDist)),)
}

/** Entrada común del núcleo para un diámetro y una posición. */
function base(p, D, fck, fyk) {
  return {
    norma: idNorma(p), via: D.via, fck, fyk, esfuerzo: D.esfuerzo, r: D.r / 100,
    pct: D.pct, lejos: !!D.lejos,
  };
}

/** Recubrimiento de cálculo cd de todas las filas: máx(25 mm; 1,5 ø), el límite de la Tabla 11.1 del EC-2 2023 (cd ≥ 1,5 ø). El proyecto debe garantizarlo. */
const cdDe = (phi) => Math.round(Math.max(25, 1.5 * phi));
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
      const a = anclaje({ ...b, phi, cd: cdDe(phi), adherencia: adh, forma, recPerp: cdDe(phi) });
      return { v: sobre5(a.lbd), min: a.lbd <= a.lbMin + 1e-6 };
    };
    const sol = (adh) => {
      if (ehe && phi > 32) return { v: null, est: true };
      const s = solape({ ...b, phi, cd: cdDe(phi), adherencia: adh });
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
      const l = (adh) => sobre5(anclaje({ ...bc, phi, cd: cdDe(phi), adherencia: adh, forma: 'recta' }).lbd);
      const s = (adh) => (phi > 32 ? null : sobre5(solape({ ...bc, phi, cd: cdDe(phi), adherencia: adh }).ls));
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

const num = (c) => {
  if (!c) return '—';
  if (c.est) return 'est.';
  return `${fmt(c.v, 0)}${c.min ? '*' : ''}${c.g ? '†' : ''}`;
};
/** Celda de la tabla; los asteriscos y las notas se explican en el hint. */
const celdaTd = (c) => {
  const hint = !c ? null : c.est ? t('an.hint.est') : c.g ? t('an.hint.g') : c.min ? t('an.hint.min') : null;
  return h('td', hint ? { title: hint.replace(/&gt;/g, '>') } : {}, num(c));
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
  // Cabecera en tres niveles: 1) Anclaje | Solapo, 2) Posición I y II, 3) prolongación recta y patilla (solo el anclaje)
  const esf = comp ? t('an.compresion') : t('an.traccion');
  const posC = (c) => `<b>${t('an.col.' + c)}</b><br><span class="u u-cab">${t(c === 'I' ? 'an.favorable' : 'an.desfavorable')}</span>`;
  const g2 = (cel) => { cel.classList.add('g2'); return cel; };
  const nA = comp ? 1 : 2; // columnas de anclaje por posición
  const th = (html, o = {}) => h('th', { ...o, html });
  const fila1 = h('tr', {}, th(`${t('an.col.d')}${ESP}<span class="u u-cab">[mm]</span>`, { rowspan: comp ? '2' : '3' }),
    th(`c<sub>d</sub>${ESP}<span class="u u-cab">[mm]</span>`, { rowspan: comp ? '2' : '3' }),
    th(t('an.col.anclaje', esf.toLowerCase()), { colspan: String(2 * nA), class: 'niv' }), g2(th(t('an.col.solapo', esf.toLowerCase()), { colspan: '2', class: 'niv' })));
  const fila2 = h('tr', {},
    th(posC('I'), comp ? { rowspan: '2' } : { colspan: '2' }), g2(th(posC('II'), comp ? { rowspan: '2' } : { colspan: '2' })),
    g2(th(posC('I'), { rowspan: comp ? '2' : '2' })), th(posC('II'), { rowspan: '2' }));
  const n3 = { class: 'n3' };
  const fila3 = comp ? null : h('tr', {}, th(t('an.col.l3r'), n3), th(t('an.col.l3p'), n3), g2(th(t('an.col.l3r'), n3)), th(t('an.col.l3p'), n3));
  const cab = h('thead', {}, fila1, fila2, fila3);
  const cuerpo = h('tbody', {}, ...r.filas.map((f) => {
    const cel = comp ? [f.I[0], f.II[0], f.sI, f.sII] : [f.I[0], f.I[1], f.II[0], f.II[1], f.sI, f.sII];
    const tr = h('tr', {}, h('th', { scope: 'row' }, String(f.phi)), h('td', { class: 'an-cd' }, fmt(cdDe(f.phi), 0)), ...cel.map(celdaTd));
    (comp ? [3, 4] : [4, 6]).forEach((i) => tr.cells[i].classList.add('g2'));
    return tr;
  }));
  const txt = (x) => x.replace(/<[^>]+>/g, '');
  const extraA = ehe ? (D.lejos ? t('an.aLejos') : t('an.aCerca')) : '';
  const ficha = t('an.ficha', r.hor.nombre, r.ace.nombre, esf.toLowerCase(), fmt(D.r, 0), t('an.cdFicha'), fmt(D.pct, 0), extraA);
  const hdr = [`${t('an.col.d')} [mm]`, 'c_d [mm]', ...(() => {
    const an = txt(t('an.col.anclaje', esf.toLowerCase())), so = txt(t('an.col.solapo', esf.toLowerCase()));
    const pI = t('an.col.I'), pII = t('an.col.II');
    return comp ? [`${an} · ${pI}`, `${an} · ${pII}`, `${so} · ${pI}`, `${so} · ${pII}`]
      : [`${an} · ${pI} · ${t('an.col.l3r')}`, `${an} · ${pI} · ${t('an.col.l3p')}`, `${an} · ${pII} · ${t('an.col.l3r')}`, `${an} · ${pII} · ${t('an.col.l3p')}`, `${so} · ${pI}`, `${so} · ${pII}`];
  })()];
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
  const cols = h('colgroup', {}, h('col', { class: 'c-phi' }), h('col', { class: 'c-cd' }), ...Array.from({ length: comp ? 4 : 6 }, () => h('col')));
  const tablaEl = h('table', { class: 'tabla-dur tabla-an', id: 'an-tabla' }, cols, cab, cuerpo);
  tablaEl.addEventListener('copy', (e) => { e.preventDefault(); e.clipboardData.setData('text/plain', texto()); e.clipboardData.setData('text/html', html()); });
  poner(centro,
    h('div', { class: 'an-tit' }, h('h2', { class: 'an-h', html: `${t('m.anclaje')} <span class="an-mat">${r.hor.nombre} ${r.ace.nombre}</span>` }),
      h('button', { type: 'button', class: 'tecla', id: 'an-copiar', title: t('graf.copiarTablaTit'), onclick: copiar }, t('graf.copiar'))), h('p', { class: 'nota', html: `${t('an.titulo')}. ${t('an.sub', art)}` }),
    h('div', { class: 'tabla-scroll' }, tablaEl),
    h('p', { class: 'nota an-ficha', id: 'an-ficha', html: ficha }),
    h('div', { class: 'an-cd-dib' }, h('div', { class: 'an-cd-fig', html: dibujoRecubrimiento() }),
      h('p', { class: 'nota' }, h('b', { html: t('an.cdDef') }), h('br'), h('span', { html: t('an.cdLey') }))));

  // Derecha: esquema y notas plegadas
  const n = idNorma(p);
  const pos = n === 'EHE-08' ? 'an.pos.ehe' : n === 'EC2-2004' ? 'an.pos.ec2' : 'an.pos.ec23';
  const mn = n === 'EHE-08' ? 'an.min.ehe' : n === 'EC2-2004' ? 'an.min.ec2' : 'an.min.ec23';
  const tv = n === 'EHE-08' ? 'an.transv.ehe' : n === 'EC2-2004' ? 'an.transv.ec2' : 'an.transv.ec23';
  const claves = [['an.n.pos', pos], ['an.n.min', mn], ['an.n.transv', tv], ['an.n.cd', 'an.cdTxt'], ['an.n.patilla', n === 'EHE-08' ? 'an.patilla.ehe' : n === 'EC2-2004' ? 'an.patilla.ec2' : 'an.patilla.ec23'], ['an.n.falta', 'an.falta']];
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
