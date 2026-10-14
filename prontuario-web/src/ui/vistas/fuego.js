// Resistencia al fuego por tablas: pantalla informativa e independiente de las secciones. A la izquierda,
// tipo de elemento y tiempo; en medio, la tabla de la norma con la fila que manda marcada; a la derecha,
// los mínimos (dimensión y distancia al eje de las armaduras) y las condiciones que acompañan a la tabla.

import { fuego, textoCelda, TIEMPOS, ELEMENTOS, ETA_PILAR, ETA_MURO, N_PILAR, OMEGA_PILAR } from '../../norma/fuego.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, segmentado, grupo, tabla } from '../campos.js';
import { filasPlegables } from '../filasPlegables.js';
import { dibujoFuego } from '../dibujoFuego.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => ` <span class="u u-cab">(${ud})</span>`;

const INICIAL = () => ({ elemento: 'viga', R: 90, arido: 'siliceo', carasPilar: 4, carasMuro: 1, carasViga: 3, eta: 0.7, portante: true, continua: false, dir: 'uni', metodo: 'A', n: 0.5, omega: 0.5 });

/** Estado de la pantalla, dentro del proyecto para que se guarde con él. */
function estado(p) {
  p.calculos.fuego ??= INICIAL();
  const D = p.calculos.fuego;
  if ('caras' in D) { // primera versión: «varias/una» y «una/dos»
    D.carasPilar = D.caras === 'una' ? 1 : 4;
    D.carasMuro = D.caras === 'dos' ? 2 : 1;
    delete D.caras;
  }
  D.carasPilar ??= 4; D.carasMuro ??= 1; D.carasViga ??= 3;
  return D;
}

function entrada(p, D) {
  const ehe = p.norma === 'EHE-08' || p.norma === 'EHE-98';
  return {
    norma: p.norma, elemento: D.elemento, R: D.R, arido: D.arido,
    caras: D.elemento === 'muro' ? (D.carasMuro === 2 ? 'dos' : 'una') : (D.carasPilar === 1 && !ehe && D.metodo !== 'B' ? 'una' : 'varias'),
    nCaras: D.elemento === 'viga' ? D.carasViga : D.elemento === 'pilar' ? (D.metodo === 'B' || ehe ? 4 : D.carasPilar) : undefined,
    eta: D.elemento === 'muro' ? (D.eta <= 0.35 ? 0.35 : 0.7) : D.eta, portante: D.portante, continua: D.continua && !ehe, dir: D.dir,
    metodo: D.metodo, n: D.n, omega: D.omega,
  };
}

export function datos(ctx, form) {
  const p = ctx.p;
  const D = estado(p);
  const ehe = p.norma === 'EHE-08' || p.norma === 'EHE-98';
  const cambio = (estructura) => ctx.cambio(estructura ? { estructura: true } : undefined);
  const seg = (k, opciones, etq, est = true) => h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo' }, etq),
    segmentado({ opciones, valor: D[k], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(est); } }));
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.fuego')), h('p', {}, t('fu.subtitulo'))));
  poner(form, grupo(t('fu.elemento'),
    h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo' }, t('fu.tipo')),
      segmentado({ opciones: ELEMENTOS.map((k) => [k, t(`fu.elc.${k}`), { title: t(`fu.el.${k}`) }]), valor: D.elemento, ancho: true, etiqueta: t('fu.tipo'), onCambio: (v) => { D.elemento = v; cambio(true); } })),
    ...opcionesElemento(D, ehe, seg, cambio),
  ), grupo(t('fu.exposicion'),
    h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo' }, t('fu.tiempo')),
      segmentado({ opciones: TIEMPOS.map((r) => [r, `R ${r}`]), valor: D.R, ancho: true, etiqueta: t('fu.tiempo'), onCambio: (v) => { D.R = v; cambio(); } })),
    seg('arido', [['siliceo', t('fu.siliceo')], ['calizo', t('fu.calizo')]], t('fu.arido'), false),
  ));
}

function opcionesElemento(D, ehe, seg, cambio) {
  const metodo = () => seg('metodo', [['A', t('fu.metodoA')], ['B', t('fu.metodoB')]], t('fu.metodo'));
  const etaSel = (lista) => h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo', html: t('fu.nivel') }),
    segmentado({ opciones: lista.map((v) => [v, String(v).replace('.', ',')]), valor: lista.includes(D.eta) ? D.eta : lista[lista.length - 1], ancho: true, etiqueta: t('fu.nivel'), onCambio: (v) => { D.eta = v; cambio(true); } }));
  const valores = (k, lista, etq) => h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo', html: etq }),
    segmentado({ opciones: lista.map((v) => [v, String(v).replace('.', ',')]), valor: lista.includes(D[k]) ? D[k] : lista[Math.min(2, lista.length - 1)], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(true); } }));
  const carasPilar = seg('carasPilar', [[4, t('fu.masUna')], [1, t('fu.una')]], t('fu.carasExp'));
  switch (D.elemento) {
    case 'pilar':
      if (!ehe && D.metodo === 'B') return [metodo(), h('div', { class: 'fu-par' }, valores('n', N_PILAR, t('fu.nCarga')), valores('omega', OMEGA_PILAR, t('fu.omega'))), explicaciones(true)];
      return [...(ehe ? [] : [metodo(), carasPilar]), ...(!ehe && D.carasPilar !== 1 ? [etaSel(ETA_PILAR)] : []), ...(ehe ? [] : [explicaciones(false)])];
    case 'muro':
      return [seg('portante', [[true, t('fu.portante')], [false, t('fu.noPortante')]], t('fu.funcion')),
        ...(D.portante ? [seg('carasMuro', [[1, '1'], [2, '2']], t('fu.carasExp')), ...(!ehe ? [etaSel(ETA_MURO), explicaciones(false)] : [])] : [])];
    case 'viga':
      return [seg('carasViga', [[3, t('fu.tres')], [4, t('fu.cuatro')]], t('fu.carasExp')), ...(ehe ? [] : [seg('continua', [[false, t('fu.simple')], [true, t('fu.continua')]], t('fu.apoyos'))])];
    default:
      return [seg('dir', [['uni', t('fu.uni')], ['bi15', t('fu.bi15')], ['bi2', t('fu.bi2')]], t('fu.flexion'))];
  }
}

/** ¿Qué son η_fi, n y ω? Filas que se despliegan (§ 14.9); solo se enseñan las que pide el método elegido. */
function explicaciones(metodoB) {
  const filas = metodoB ? ['n', 'omega'] : ['eta'];
  const tb = tabla(filas.map((k) => [t(`fu.i.${k}`)]));
  tb.classList.add('fu-info');
  return h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo' }, t('fu.queSon')), filasPlegables(tb, filas.map((k) => `<span>${t(`fu.i.${k}.txt`)}</span>`)));
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const D = estado(p);
  const r = fuego(entrada(p, D));
  const ref = r.fuente === 'EHE-08' ? 'EHE-08' : 'UNE-EN 1992-1-2';
  const art = `${ref} · ${r.articulo} · ${t('fu.tabla')} ${r.tabla}`;
  const sinValor = r.opciones.length === 0;
  const o = r.opciones[0];
  const etqD = sub(r.dimEtq, 'min');
  const valor = sinValor ? '—' : o.a == null ? `${fmt(o.d, 0)}<span class="u">${ESP}mm</span>` : `${fmt(o.d, 0)} / ${fmt(o.a, 0)}<span class="u">${ESP}mm</span>`;
  res.append(h('div', { class: `veredicto sin-barra${sinValor ? ' atencion' : ''}` },
    h('div', { class: 'ratio' }, h('span', { class: 'etq', html: o?.a == null ? `${t('fu.minimo')} ${etqD}` : `${etqD} / ${sub('a', 'min')}` }), h('span', { class: 'v', html: valor })),
    h('div', { class: 'medidor' }, h('div', { class: 'ecu', html: sinValor ? t('fu.sinValor') : `${r.crit} ${D.R} · ${r.opciones.length > 1 ? t('fu.opciones', r.opciones.length) : ''}<span class="art">${art}</span>` })),
    h('span', {}, '')));

  const centro = h('article', { class: 'panel tarjeta' });
  const filas = r.filas.map((f) => {
    const x = [`${r.crit} ${f.R}`, ...f.cel.map((c, j) => (f.activa && j === r.colActiva ? `<b class="manda">${textoCelda(c)}</b>` : textoCelda(c)))];
    if (f.activa) x.ref = 'activa';
    return x;
  });
  const tb = tabla(filas, { cabecera: ['', ...r.cab.map((c) => c)], clase: 'tabla-dur' });
  tb.querySelectorAll('tbody tr').forEach((tr, i) => { if (r.filas[i].activa) tr.classList.add('activa'); });
  poner(centro, h('div', { class: 'fu-dib', html: dibujoFuego({ elemento: D.elemento, caras: entrada(p, D).caras, nCaras: entrada(p, D).nCaras, portante: D.portante, dimEtq: r.dimEtq }, r.opciones[0]) }),
    h('p', { class: 'fu-leyenda' }, t('fu.leyenda')),
    h('h2', { html: t('fu.tablaTitulo') }), h('p', { class: 'nota', html: t('fu.tablaSub', art) }), tb,
    h('p', { class: 'nota', html: t('fu.unidades') }));

  const dcha = h('article', { class: 'panel tarjeta' });
  const lista = r.opciones.map((x, i) => [r.opciones.length > 1 ? `${t('fu.combinacion')} ${i + 1}` : t('fu.minimos'),
    `${sub(r.dimEtq, 'min')} = <b>${fmt(x.d, 0)}</b>${x.a == null ? '' : `, ${sub('a', 'min')} = <b>${fmt(x.a, 0)}</b>`}${ESP}mm${x.geom ? ` <span class="nota">(${t('fu.geom')})</span>` : ''}${x.barras8 ? ` <span class="nota">(${t('fu.barras8')})</span>` : ''}`]);
  const ex = r.extra.map(([k, v, u = 'mm']) => [t(k), `${v}${ESP}${u}`]);
  poner(dcha, h('h2', {}, t('fu.requisitos', `${r.crit} ${D.R}`)), sinValor ? h('p', { class: 'nota' }, t('fu.sinValor')) : tabla([...lista, ...ex]),
    h('h3', {}, t('fu.condiciones')),
    filasPlegables(tabla([...r.notas.map((n) => [t(`${n}.t`)]), [t('fu.amT')]]), [...r.notas.map((n) => t(n)), t('fu.am')].map((x) => `<span>${x}</span>`)));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

export function comandos() {
  return [];
}
