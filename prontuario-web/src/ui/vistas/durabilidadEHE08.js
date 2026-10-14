// Durabilidad con EHE-08: pantalla informativa. A la izquierda, las variables del hormigón y de la obra;
// en medio, las clases de exposición (solo se dejan marcar las que pueden darse a la vez); a la derecha,
// el recubrimiento y las condiciones del hormigón con una línea de por qué, y las indicaciones del CE donde difieran.

import { recubrimientoMinimo } from '../../core/geometria.js';
import { geometriaDe } from '../../io/proyecto.js';
import * as D8 from '../../norma/ehe08/durabilidad.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, par, aviso, tabla, boton, apilado, filaCampos } from '../campos.js';
import { designacionCE, CONSISTENCIAS, ASIENTO } from '../../norma/designacion.js';
import { tarjetonDesignacion, actualizarDesignacion, botonCopiar } from '../designacion.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => ` <span class="u u-cab">(${ud})</span>`;

/** Condiciones del proyecto para la EHE-08; se parte de las clases de un proyecto antiguo si las había. */
export function condiciones(p) {
  const D = p.durabilidad ?? (p.durabilidad = {});
  D.tipoHor ??= 'armado';
  D.vida ??= 50;
  D.cemento ??= 'cem1';
  D.control ??= 'normal';
  D.consistencia ??= 'B';
  D.hormigon ??= p.hormigones[0]?.nombre;
  if (!D.clasesEHE) D.clasesEHE = D.ambiente && D.ambiente !== 'I' ? [D.ambiente, ...(D.exposiciones ?? [])] : [...(D.exposiciones ?? [])];
  D.clasesEHE = D8.normalizar(D.clasesEHE, D.tipoHor);
  return D;
}

const fckDe = (p, D) => (p.hormigones.find((m) => m.nombre === D.hormigon) ?? p.hormigones[0])?.fck ?? 25;

function calcular(p, D) {
  return D8.durabilidad({
    tipo: D.tipoHor, clases: D.clasesEHE, cemento: D.cemento, vida: D.vida, fck: fckDe(p, D),
    control: D.control, arido: D.arido ?? 20, fiMax: D.fiMax ?? 20, muyJuntas: !!D.muyJuntas, contraTerreno: !!D.contraTerreno,
  });
}

export function datos(ctx, form) {
  const p = ctx.p;
  const D = condiciones(p);
  const cambio = (estructura) => ctx.cambio(estructura ? { estructura: true } : undefined);
  const set = (k, est) => (v) => { D[k] = v; cambio(est); };
  const seg = (k, lista, etq) => h('div', { class: 'campo-apilado' }, h('span', { class: 'etq-grupo' }, etq),
    segmentado({ opciones: lista, valor: D[k], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(true); } }));
  const si = (k) => (v) => { D[k] = v === 'si'; cambio(); };
  poner(form, tarjetonDesignacion());
  poner(form, grupo(t('eh.hormigon'),
    apilado(selector({ id: 'd-hor', etq: t('hormigon'), opciones: p.hormigones.map((m) => [m.nombre, `${m.nombre} · ${sub('f', 'ck')} ${fmt(m.fck, 0)} MPa`]), valor: D.hormigon, onCambio: set('hormigon') })),
    seg('tipoHor', D8.TIPOS_HORMIGON.map((k) => [k, t(`eh.tipo.${k}`)]), t('eh.tipo')),
    seg('vida', D8.VIDAS.map((v) => [v, `${v} ${t('eh.anios')}`]), t('eh.vida')),
    apilado(selector({ id: 'd-cem', etq: t('eh.cemento'), opciones: D8.CEMENTOS.map((k) => [k, t(`eh.cem.${k}`)]), valor: D.cemento, onCambio: set('cemento') })),
    apilado(selector({ id: 'd-cons', etq: t('dur.consistencia'), opciones: CONSISTENCIAS.map((k) => [k, `${k} · ${t(`cons.${k}`)} (${ASIENTO[k]} mm)`]), valor: D.consistencia, onCambio: set('consistencia') })),
  ), grupo(t('eh.obra'),
    apilado(selector({ id: 'd-ctrl', etq: t('dur.control'), opciones: [['normal', t('dur.ctrlNormal')], ['intenso', t('dur.ctrlIntenso')], ['prefabricadoIntenso', t('dur.ctrlPref')]], valor: D.control, onCambio: set('control') })),
    filaCampos(
      apilado(campoNum({ id: 'd-arido', etq: t('dur.aridoCorto'), valor: D.arido ?? 20, mag: 'diam', paso: 2, min: 4, max: 80, onCambio: set('arido') })),
      apilado(campoNum({ id: 'd-fimax', etq: `ø ${t('dur.barraCorta')}`, valor: D.fiMax ?? 20, mag: 'diam', paso: 2, min: 0, max: 50, onCambio: set('fiMax') })),
      apilado(campoNum({ id: 'd-cerco', etq: `ø ${t('dur.cerco')}`, valor: D.fiCerco ?? 8, mag: 'diam', paso: 2, min: 0, max: 20, onCambio: set('fiCerco') }))),
    filaCampos(
      apilado(selector({ id: 'd-paso', etq: t('eh.paso'), opciones: [['no', t('eh.paso.normal')], ['si', t('eh.paso.juntas')]], valor: D.muyJuntas ? 'si' : 'no', onCambio: si('muyJuntas') })),
      apilado(selector({ id: 'd-terr', etq: t('eh.terreno'), opciones: [['no', t('eh.terreno.no')], ['si', t('eh.terreno.si')]], valor: D.contraTerreno ? 'si' : 'no', onCambio: si('contraTerreno') }))),
  ));
}

/** Una fila de clases; las que no caben con la selección actual salen en gris. */
function chipsClases(D, grupoClases, no, onClick) {
  return h('div', { class: 'chips', role: 'group' }, ...grupoClases.map((c) => {
    const activa = D.clasesEHE.includes(c);
    return h('button', {
      type: 'button', class: 'chip-sel chip-clase', 'aria-pressed': String(activa), disabled: no.has(c) || undefined, title: no.has(c) ? t('eh.noCompatible') : t(`eh.desc.${c}`),
      html: `${c}<span class="ce">${D8.EQUIV_CE[c]}</span>`, onclick: () => onClick(c),
    });
  }));
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const D = condiciones(p);
  const fck = fckDe(p, D);
  const r = calcular(p, D);
  const no = D8.deshabilitadas(D.clasesEHE, D.tipoHor);
  const desig = designacionCE({ tipo: D.tipoHor, fck, consistencia: D.consistencia, arido: D.arido ?? 20, clases: r.clases });
  actualizarDesignacion(desig, t('dur.resumenEHE', t(`eh.tipo.${D.tipoHor}`), t(`cons.${D.consistencia}`), fmt(D.arido ?? 20, 0)));
  const alternar = (c) => {
    D.clasesEHE = D.clasesEHE.includes(c) ? D.clasesEHE.filter((x) => x !== c) : [...D.clasesEHE, c];
    ctx.cambio();
  };

  // Cartel: recubrimiento nominal
  if (r.clases.length === 0) {
    res.append(h('div', { class: 'veredicto sin-barra' }, h('div', { class: 'ratio' }, h('span', { class: 'etq', html: t('dur.rnomLargo') }), h('span', { class: 'v' }, '—')),
      h('div', { class: 'medidor' }, h('div', { class: 'ecu' }, t('eh.eligeClase'))), h('span', {}, '')));
  } else {
    const ecu = r.estudio.length
      ? t('eh.estudio', r.estudio.join(', '))
      : `${sub('r', 'nom')} = ${sub('r', 'min')} + Δr = <b>${fmt(r.rmin, 0)}</b> + <b>${fmt(r.dr, 0)}</b> = <b>${fmt(r.rnom, 0)}${ESP}mm</b> · <span class="art">EHE-08 · art. ${r.articulos.rnom}</span>`;
    res.append(h('div', { class: `veredicto sin-barra${r.estudio.length ? ' atencion' : ''}` },
      h('div', { class: 'ratio' }, h('span', { class: 'etq', html: t('dur.rnomLargo') }), h('span', { class: 'v', html: r.rnom === null ? '—' : `${fmt(r.rnom, 0)}<span class="u">${ESP}mm</span>` })),
      h('div', { class: 'medidor' }, h('div', { class: 'ecu', html: ecu })), h('span', {}, '')));
  }
  if (!r.cumpleFck) res.append(aviso(t('dur.avisoFckProy', D.hormigon, fmt(fck, 0), fmt(r.fckMin, 0)), 'error'));
  if (r.fijaProyecto.length) res.append(aviso(t('eh.fijaProyecto', r.fijaProyecto.join(', ')), 'info'));

  // Centro: las clases de exposición
  const centro = h('article', { class: 'panel tarjeta' });
  poner(centro,
    h('div', { class: 'cab-clases' }, h('h2', {}, t('dur.clases')), boton(t('eh.quitarTodo'), () => { D.clasesEHE = []; ctx.cambio(); }, 'secundario pequeno')),
    h('p', { class: 'nota', html: t('eh.explica') }),
    h('h3', { title: t('eh.gGeneralNota') }, t('eh.gGeneral')), chipsClases(D, D8.GENERALES, no, alternar),
    h('div', { class: 'grupos-esp' },
      h('div', {}, h('h3', { title: t('eh.gQuimicaNota') }, t('eh.gQuimica')), chipsClases(D, D8.QUIMICAS, no, alternar)),
      h('div', {}, h('h3', { title: t('eh.gHieloNota') }, t('eh.gHielo')), chipsClases(D, D8.HIELO, no, alternar)),
      h('div', {}, h('h3', { title: t('eh.gErosionNota') }, t('eh.gErosion')), chipsClases(D, D8.EROSION, no, alternar))),
    h('div', { class: 'desc-clases' }, ...(D.clasesEHE.length ? D.clasesEHE.map((c) => h('p', { class: 'nota', html: `<b>${c}</b> · ${t(`eh.desc.${c}`)}` })) : [h('p', { class: 'nota' }, t('eh.sinClases'))])),
    plegable(t('eh.tablaQuimica'), tabla(
      [['pH', '6,5–5,5', '5,5–4,5', '&lt; 4,5'], ['CO<sub>2</sub> agresivo (mg/l)', '15–40', '40–100', '&gt; 100'], ['SO<sub>4</sub><sup>2−</sup> agua (mg/l)', '200–600', '600–3000', '&gt; 3000'],
        ['Mg<sup>2+</sup> (mg/l)', '300–1000', '1000–3000', '&gt; 3000'], ['NH<sub>4</sub><sup>+</sup> (mg/l)', '15–30', '30–60', '&gt; 60'], ['SO<sub>4</sub><sup>2−</sup> suelo (mg/kg)', '2000–3000', '3000–12000', '&gt; 12000']],
      { cabecera: ['', 'Qa', 'Qb', 'Qc'] })));

  // Derecha: lo que resulta y por qué
  const dcha = h('article', { class: 'panel tarjeta' });
  resumen(ctx, dcha, D, r, fck);
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Fila que se despliega con ▸ delante; abierta, fila y explicación forman una caja chocolate (guía § 14.9). */
export function plegable(titulo, contenido, abierta = false) {
  return h('details', { class: 'pleg', open: abierta || undefined }, h('summary', { html: titulo }), h('div', { class: 'cuenta' }, ...[contenido].flat()));
}

const cl = (arr) => arr.join(' + ');

function resumen(ctx, tar, D, r, fck) {
  const manda = {
    tabla: cl(r.mandaTabla), arido: t('eh.mandaArido', fmt((D.muyJuntas ? 1.25 : 0.8) * (D.arido ?? 20), 0)),
    barra: t('eh.mandaBarra'), terreno: t('eh.mandaTerreno'),
  }[r.mandaRmin];
  const m = (x) => `<span class="nota">${x}</span>`;
  const filas = r.clases.length
    ? [
      [t('dur.rmin') + U('mm'), fmt(r.rmin, 0), m(manda)],
      ['Δr' + U('mm'), fmt(r.dr, 0), ''],
      [`<b>${sub('r', 'nom')}</b>` + U('mm'), r.rnom === null ? '—' : `<b>${fmt(r.rnom, 0)}</b>`, ''],
      [t('dur.acMax'), fmt(r.ac, 2), m(cl(r.mandaAc))],
      [t('dur.cementoMin') + U('kg/m³'), fmt(r.cemento, 0), m(cl(r.mandaCemento))],
      [`${sub('f', 'ck')} ${t('dur.minima')}` + U('MPa'), r.cumpleFck ? fmt(r.fckMin, 0) : `<span class="mal">${fmt(r.fckMin, 0)}</span>`, m(cl(r.mandaFck))],
    ]
    : [];
  poner(tar, h('div', { class: 'cab-clases' }, h('h2', {}, t('dur.condiciones')), filas.length ? botonCopiar(() => filasCopia(D, r, fck)) : null),
    filas.length ? tabla(filas) : h('p', { class: 'nota' }, t('eh.eligeClase')));
  if (r.impermeabilidad) poner(tar, h('p', { class: 'nota', html: t('eh.imper', r.impermeabilidad.max, r.impermeabilidad.med) }));
  if (r.notas.length) poner(tar, plegable(`${t('dur.requisitos')} (${r.notas.length})`,
    h('ul', { class: 'nota' }, ...r.notas.map((n) => h('li', { html: t(n.clave, n.v) }))), r.notas.length <= 2));
  if (r.ce.length) poner(tar, plegable(`${t('eh.ceTitulo')} (${r.ce.length})`,
    [h('ul', { class: 'nota' }, ...r.ce.map((n) => h('li', { html: t(n.clave, ...(n.v ?? [])) }))), h('p', { class: 'nota' }, t('eh.ceCita'))], r.ce.length <= 1));
  comprobacion(ctx, tar, D, r);
}

/** Filas para copiar: cabecera y valores en texto plano, con las clases y la designación por delante. */
function filasCopia(D, r, fck) {
  const desig = designacionCE({ tipo: D.tipoHor, fck, consistencia: D.consistencia, arido: D.arido ?? 20, clases: r.clases });
  const mandaR = { tabla: cl(r.mandaTabla), arido: `0,8·árido`, barra: 'ø barra', terreno: 'terreno' }[r.mandaRmin];
  return [
    [t('dur.param'), t('dur.valor2'), t('dur.unidad'), t('dur.manda')],
    [t('dur.designacion') + ' (EHE-08)', desig, '', ''],
    [t('dur.tipoHormigon'), t(`eh.tipo.${D.tipoHor}`), '', ''],
    [t('dur.clasesExp'), r.clases.join(' + '), '', ''],
    [t('dur.vidaUtil'), D.vida, t('eh.anios'), ''],
    ['r_min', r.rmin, 'mm', mandaR],
    ['Δr', r.dr, 'mm', ''],
    ['r_nom', r.rnom === null ? '—' : r.rnom, 'mm', ''],
    [t('dur.acMax'), r.ac, '', cl(r.mandaAc)],
    [t('dur.cementoMin'), r.cemento, 'kg/m³', cl(r.mandaCemento)],
    ['f_ck ' + t('dur.minima'), r.fckMin, 'MPa', cl(r.mandaFck)],
  ];
}

/** Recubrimiento real de cada sección frente al nominal (como en el resto de normas). */
function comprobacion(ctx, tar, D, r) {
  const p = ctx.p;
  if (r.rnom === null || !p.secciones.length) return;
  const cerco = D.fiCerco ?? 8;
  let ok = 0;
  const filas = p.secciones.map((s) => {
    const geo = geometriaDe(p, s);
    const rec = geo.errores.length ? null : recubrimientoMinimo(geo, cerco);
    if (!rec) return [s.nombre, '—', `<span class="nota">${t('dur.sinBarrasCorto')}</span>`];
    const c = rec.c * 1000;
    const bien = c >= r.rnom - 1e-6 && !rec.fuera;
    if (bien) ok++;
    return [s.nombre, fmt(c, 0), bien ? `<span class="bien">${t('cumple')}</span>` : `<span class="mal">${t('noCumple')}</span>`];
  });
  poner(tar, plegable(t('eh.secciones', ok, p.secciones.length),
    [tabla(filas, { cabecera: [t('seccion'), t('dur.recRealCorto') + U('mm'), ''] }), h('p', { class: 'nota', html: t('dur.notaReal', fmt(cerco, 0)) })]));
}

export function comandos() {
  return [];
}
