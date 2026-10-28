// Durabilidad con EC-2 2004 + Anejo Nacional: mismo patrón informativo que la de EHE-08.
// Clases de exposición X…: solo se dejan marcar las que pueden darse a la vez. El recubrimiento sale de la
// clase estructural del AN; a/c, cemento y fck mínimos y los recubrimientos de XF y XA, del CE.

import { recubrimientoMinimo } from '../../core/geometria.js';
import { geometriaDe } from '../../io/proyecto.js';
import * as DE from '../../norma/ec2-2004/durabilidad.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, tabla, boton, apilado, filaCampos } from '../campos.js';
import { designacionCE, designacionEN, CONSISTENCIAS, ASIENTO } from '../../norma/designacion.js';
import { tarjetonDesignacion, actualizarDesignacion, botonCopiar } from '../designacion.js';
import { filasPlegables } from '../filasPlegables.js';
import { plegable } from './durabilidadEHE08.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => ` <span class="u u-cab">[${ud}]</span>`;

export function condiciones(p) {
  const D = p.durabilidad ?? (p.durabilidad = {});
  D.tipoHor ??= 'armado';
  D.vida ??= 50;
  D.cemento ??= 'cem1';
  D.control ??= 'normal';
  D.terrenoEC ??= 'no';
  D.consistencia ??= 'B';
  D.hormigon ??= p.hormigones[0]?.nombre;
  D.clasesEC ??= (D.clases ?? []).filter((c) => DE.CLASES.includes(c));
  D.clasesEC = DE.normalizar(D.clasesEC, D.tipoHor);
  return D;
}

const fckDe = (p, D) => (p.hormigones.find((m) => m.nombre === D.hormigon) ?? p.hormigones[0])?.fck ?? 25;

function calcular(p, D) {
  return DE.durabilidad({ tipo: D.tipoHor, clases: D.clasesEC, cemento: D.cemento, vida: D.vida, fck: fckDe(p, D), control: D.control, arido: D.arido ?? 20, fiMax: D.fiMax ?? 20, terreno: D.terrenoEC });
}

export function datos(ctx, form) {
  const p = ctx.p;
  const D = condiciones(p);
  const cambio = (estructura) => ctx.cambio(estructura ? { estructura: true } : undefined);
  const set = (k) => (v) => { D[k] = v; cambio(); };
  const seg = (k, lista, etq) => h('div', { class: 'campo-apilado' }, h('span', { class: 'etq-grupo' }, etq),
    segmentado({ opciones: lista, valor: D[k], ancho: true, etiqueta: etq, onCambio: (v) => { D[k] = v; cambio(true); } }));
  poner(form, tarjetonDesignacion());
  poner(form, grupo(t('eh.hormigon'),
    apilado(selector({ id: 'd-hor', etq: t('hormigon'), opciones: p.hormigones.map((m) => [m.nombre, `${m.nombre} · ${sub('f', 'ck')} ${fmt(m.fck, 0)} MPa`]), valor: D.hormigon, onCambio: set('hormigon') })),
    seg('tipoHor', DE.TIPOS_HORMIGON.map((k) => [k, t(`eh.tipo.${k}`)]), t('eh.tipo')),
    seg('vida', DE.VIDAS.map((v) => [v, `${v} ${t('eh.anios')}`]), t('eh.vida')),
    apilado(selector({ id: 'd-cem', etq: t('eh.cemento'), opciones: DE.CEMENTOS.map((k) => [k, t(`eh.cem.${k}`)]), valor: D.cemento, onCambio: set('cemento') })),
    apilado(selector({ id: 'd-cons', etq: t('dur.consistencia'), opciones: CONSISTENCIAS.map((k) => [k, `${k} · ${t(`cons.${k}`)} (${ASIENTO[k]} mm)`]), valor: D.consistencia, onCambio: set('consistencia') })),
  ), grupo(t('eh.obra'),
    apilado(selector({ id: 'd-ctrl', etq: t('dur.control'), opciones: [['normal', t('dur.ctrlNormal')], ['intenso', t('dur.ctrlIntenso')], ['prefabricadoIntenso', t('dur.ctrlPref')]], valor: D.control, onCambio: set('control') })),
    filaCampos(
      apilado(campoNum({ id: 'd-arido', etq: t('dur.aridoCorto'), valor: D.arido ?? 20, mag: 'diam', paso: 2, min: 4, max: 80, onCambio: set('arido') })),
      apilado(campoNum({ id: 'd-fimax', etq: `ø ${t('dur.barraCorta')}`, valor: D.fiMax ?? 20, mag: 'diam', paso: 2, min: 0, max: 50, onCambio: set('fiMax') })),
      apilado(campoNum({ id: 'd-cerco', etq: `ø ${t('dur.cerco')}`, valor: D.fiCerco ?? 8, mag: 'diam', paso: 2, min: 0, max: 20, onCambio: set('fiCerco') }))),
    apilado(selector({ id: 'd-terr', etq: t('eh.terreno'), opciones: [['no', t('ec.terreno.no')], ['limpieza', t('ec.terreno.limpieza')], ['directo', t('ec.terreno.directo')]], valor: D.terrenoEC, onCambio: set('terrenoEC') })),
  ));
}

function chips(D, lista, no, onClick) {
  return h('div', { class: 'chips', role: 'group' }, ...lista.map((c) => {
    const activa = D.clasesEC.includes(c);
    return h('button', {
      type: 'button', class: 'chip-sel chip-clase', 'aria-pressed': String(activa), disabled: no.has(c) || undefined,
      title: no.has(c) ? t('eh.noCompatible') : t(`ec.desc.${c}`), html: `${c}<span class="ce">${t(`ec.tag.${c}`)}</span>`, onclick: () => onClick(c),
    });
  }));
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const D = condiciones(p);
  const fck = fckDe(p, D);
  const r = calcular(p, D);
  const no = DE.deshabilitadas(D.clasesEC, D.tipoHor);
  const alternar = (c) => { D.clasesEC = D.clasesEC.includes(c) ? D.clasesEC.filter((x) => x !== c) : [...D.clasesEC, c]; ctx.cambio(); };
  const sinDato = r.clases.length === 0;
  const dsg = { tipo: D.tipoHor, fck, consistencia: D.consistencia, arido: D.arido ?? 20, clases: r.clases };
  actualizarDesignacion(designacionEN(dsg), t('dur.equivCE', designacionCE(dsg)));

  // Cartel: recubrimiento nominal
  const ecu = sinDato ? t('eh.eligeClase') : r.sinArmadura ? t('ec.sinArmadura') : r.estudio.length ? t('ec.estudio', r.estudio.join(', '))
    : `${sub('c', 'nom')} = ${sub('c', 'min')} + Δ${sub('c', 'dev')} = <b>${fmt(r.cmin, 0)}</b> + <b>${fmt(r.dr, 0)}</b> = <b>${fmt(r.cmin + r.dr, 0)}${ESP}mm</b>${r.mandaTerreno ? ` → <b>${fmt(r.cnom, 0)}${ESP}mm</b> (${t('eh.mandaTerreno')})` : ''} · <span class="art">UNE-EN 1992-1-1 + AN · ${r.articulos.cmin}</span>`;
  res.append(h('div', { class: `veredicto sin-barra${r.estudio.length ? ' atencion' : ''}` },
    h('div', { class: 'ratio' }, h('span', { class: 'etq', html: t('ec.cnomLargo') }), h('span', { class: 'v', html: r.cnom === null ? '—' : `${fmt(r.cnom, 0)}<span class="u">${ESP}mm</span>` })),
    h('div', { class: 'medidor' }, h('div', { class: 'ecu', html: ecu })), h('span', {}, '')));
  if (!r.cumpleFck) res.append(aviso(t('dur.avisoFckProy', D.hormigon, fmt(fck, 0), fmt(r.fckMin, 0)), 'error'));
  if (r.fijaProyecto.length) res.append(aviso(t('ec.fijaProyecto', r.fijaProyecto.join(', ')), 'info'));

  // Centro: clases de exposición
  const centro = h('article', { class: 'panel tarjeta' });
  const g = (cl, lista) => h('div', {}, h('h3', { title: t(`ec.g${cl}Nota`) }, t(`ec.g${cl}`)), chips(D, lista, no, alternar));
  poner(centro,
    h('div', { class: 'cab-clases' }, h('h2', {}, t('dur.clases')), boton(t('eh.quitarTodo'), () => { D.clasesEC = []; ctx.cambio(); }, 'secundario pequeno')),
    h('p', { class: 'nota', html: t('ec.explica') }),
    h('div', { class: 'grupos-esp grupos-flex' }, g('X0', DE.X0), g('XC', DE.XC), g('XD', DE.XD), g('XS', DE.XS), g('XF', DE.XF), g('XA', DE.XA), g('XM', DE.XM)),
    h('div', { class: 'desc-clases' }, ...(D.clasesEC.length ? D.clasesEC.map((c) => h('p', { class: 'nota', html: `<b>${c}</b> · ${t(`ec.desc.${c}`)}` })) : [h('p', { class: 'nota' }, t('eh.sinClases'))])),
    plegable(t('eh.tablaQuimica').replace('8.2.3.b', 'CE 27.1.b'), tabla(
      [['pH', '6,5–5,5', '5,5–4,5', '&lt; 4,5'], ['CO<sub>2</sub> agresivo [mg/l]', '15–40', '40–100', '&gt; 100'], ['SO<sub>4</sub><sup>2−</sup> agua [mg/l]', '200–600', '600–3000', '&gt; 3000'],
        ['Mg<sup>2+</sup> [mg/l]', '300–1000', '1000–3000', '&gt; 3000'], ['NH<sub>4</sub><sup>+</sup> [mg/l]', '15–30', '30–60', '&gt; 60'], ['SO<sub>4</sub><sup>2−</sup> suelo (mg/kg)', '2000–3000', '3000–12000', '&gt; 12000']],
      { cabecera: ['', 'XA1', 'XA2', 'XA3'] })));

  const dcha = h('article', { class: 'panel tarjeta' });
  resumen(ctx, dcha, D, r, fck);
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

const cl = (arr) => arr.join(' + ');

/** Explicación de la clase estructural de cada clase (para la fila c_min,dur). */
function cuentaDur(r) {
  const filas = r.detalle.map((x) => {
    if (x.fuente === 'CE') return `<b>${x.clase}</b>: ${typeof x.valor === 'number' ? t('ec.cuentaCE', x.valor, x.art) : x.valor === 'proyecto' ? t('ec.cuentaProyecto') : t('ec.cuentaExcesivo')}`;
    if (x.abrasion !== undefined) return `<b>${x.clase}</b>: ${t('ec.cuentaAbrasion', x.abrasion)}`;
    if (x.estudio) return `<b>${x.clase}</b>: ${t(x.motivo === 'cemento' ? 'ec.cuentaEstudioCem' : 'ec.cuentaEstudio')}`;
    const pasos = ['S4', ...x.pasos.map((q) => t(q.clave, ...(q.v ?? [])))].join(' · ');
    return `<b>${x.clase}</b>: ${pasos} → <b>S${x.s}</b> → ${x.cminDur} mm${x.delta ? ` ${x.delta > 0 ? '+' : '−'} ${Math.abs(x.delta)} (Δc<sub>dur,γ</sub>)` : ''} = <b>${x.valor} mm</b>`;
  });
  return filas.map((f) => `<span class="f">${f}</span>`).join('') + `<span class="n">${t('ec.cuentaAN')}</span>`;
}

function resumen(ctx, tar, D, r, fck) {
  const m = (x) => `<span class="nota">${x}</span>`;
  const sinArm = r.sinArmadura;
  const filas = r.clases.length
    ? [
      [sub('c', 'min,b') + U('mm'), sinArm ? '—' : fmt(r.cminB, 0), m(`ø ${t('dur.barraMax')}`)],
      [sub('c', 'min,dur') + U('mm'), r.estudio.length ? '—' : fmt(r.cminDur + r.abrasion, 0), m(cl(r.mandaDur))],
      [sub('c', 'min') + U('mm'), sinArm || r.estudio.length ? '—' : fmt(r.cmin, 0), m(sinArm || r.estudio.length ? '' : { dur: t('ec.mandaDur'), b: 'ø', diez: '10' }[r.mandaCmin])],
      [`Δ${sub('c', 'dev')}` + U('mm'), sinArm ? '—' : fmt(r.dr, 0), ''],
      [`<b>${sub('c', 'nom')}</b>` + U('mm'), r.cnom === null ? '—' : `<b>${fmt(r.cnom, 0)}</b>`, ''],
      [t('dur.acMax'), fmt(r.ac, 2), m(cl(r.mandaAc))],
      [t('dur.cementoMin') + U('kg/m³'), fmt(r.cemento, 0), m(cl(r.mandaCemento))],
      [`${sub('f', 'ck')} ${t('dur.minima')}` + U('MPa'), r.cumpleFck ? fmt(r.fckMin, 0) : `<span class="mal">${fmt(r.fckMin, 0)}</span>`, m(cl(r.mandaFck))],
    ]
    : [];
  const tb = filas.length ? tabla(filas) : null;
  if (tb && !sinArm) filasPlegables(tb, [null, cuentaDur(r), t('ec.cuentaCmin'), null, null, t('ec.cuentaDosif'), null, null]);
  else if (tb) filasPlegables(tb, [null, null, null, null, null, t('ec.cuentaDosif'), null, null]);
  poner(tar, h('div', { class: 'cab-clases' }, h('h2', {}, t('dur.condiciones')), tb ? botonCopiar(() => filasCopia(D, r, fck)) : null), tb ?? h('p', { class: 'nota' }, t('eh.eligeClase')));
  if (r.impermeabilidad) poner(tar, h('p', { class: 'nota', html: t('eh.imper', r.impermeabilidad.max, r.impermeabilidad.med).replace('art. 37.3.3', 'CE 43.3.2') }));
  if (r.notas.length) poner(tar, plegable(`${t('dur.requisitos')} (${r.notas.length})`, h('ul', { class: 'nota' }, ...r.notas.map((n) => h('li', { html: t(n.clave, n.v) }))), r.notas.length <= 2));
  if (r.ce.length) poner(tar, plegable(`${t('eh.ceTitulo')} (${r.ce.length})`, [h('ul', { class: 'nota' }, ...r.ce.map((n) => h('li', { html: t(n.clave, ...(n.v ?? [])) }))), h('p', { class: 'nota' }, t('eh.ceCita'))], r.ce.length <= 1));
  comprobacion(ctx, tar, D, r);
}

function filasCopia(D, r, fck) {
  const dsg = { tipo: D.tipoHor, fck, consistencia: D.consistencia, arido: D.arido ?? 20, clases: r.clases };
  const sa = r.sinArmadura;
  const v = (x) => (sa ? '—' : x);
  return [
    [t('dur.param'), t('dur.valor2'), t('dur.unidad'), t('dur.manda')],
    [t('dur.designacionEN'), designacionEN(dsg), '', ''],
    [t('dur.designacionCE'), designacionCE(dsg), '', ''],
    [t('dur.tipoHormigon'), t(`eh.tipo.${D.tipoHor}`), '', ''],
    [t('dur.clasesExp'), r.clases.join(' + '), '', ''],
    [t('dur.vidaUtil'), D.vida, t('eh.anios'), ''],
    ['c_min,b', v(r.cminB), 'mm', 'ø'],
    ['c_min,dur', r.estudio.length ? '—' : r.cminDur + r.abrasion, 'mm', cl(r.mandaDur)],
    ['c_min', sa || r.estudio.length ? '—' : r.cmin, 'mm', ''],
    ['Δc_dev', v(r.dr), 'mm', ''],
    ['c_nom', r.cnom === null ? '—' : r.cnom, 'mm', ''],
    [t('dur.acMax'), r.ac, '', cl(r.mandaAc)],
    [t('dur.cementoMin'), r.cemento, 'kg/m³', cl(r.mandaCemento)],
    ['f_ck ' + t('dur.minima'), r.fckMin, 'MPa', cl(r.mandaFck)],
  ];
}

function comprobacion(ctx, tar, D, r) {
  const p = ctx.p;
  if (r.cnom === null || !p.secciones.length) return;
  const cerco = D.fiCerco ?? 8;
  let ok = 0;
  const filas = p.secciones.map((s) => {
    const geo = geometriaDe(p, s);
    const rec = geo.errores.length ? null : recubrimientoMinimo(geo, cerco);
    if (!rec) return [s.nombre, '—', `<span class="nota">${t('dur.sinBarrasCorto')}</span>`];
    const c = rec.c * 1000;
    const bien = c >= r.cnom - 1e-6 && !rec.fuera;
    if (bien) ok++;
    return [s.nombre, fmt(c, 0), bien ? `<span class="bien">${t('cumple')}</span>` : `<span class="mal">${t('noCumple')}</span>`];
  });
  poner(tar, plegable(t('eh.secciones', ok, p.secciones.length),
    [tabla(filas, { cabecera: [t('seccion'), t('dur.recRealCorto') + U('mm'), ''] }), h('p', { class: 'nota', html: t('dur.notaReal', fmt(cerco, 0)) })]));
}

export function comandos() {
  return [];
}
