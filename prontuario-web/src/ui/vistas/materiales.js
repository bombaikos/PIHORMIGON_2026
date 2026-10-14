// Pantalla de Materiales · Crear y editar: hormigones y aceros del proyecto (Materiales.pas del Prontuario 3.1).
// Mismo esquema que Secciones (guía § 14): arriba un desplegable por tipo (Hormigón, Acero), el tarjetón del
// material activo encabezando los datos, y Guardar cambios / Borrar abajo. Los datos se editan en un borrador
// que solo pasa al proyecto con «Guardar cambios». En medio, el diagrama σ-ε; a la derecha, las propiedades
// con su cuenta desplegable y, en el hormigón, la evolución con la edad.
// Las propiedades reológicas son otra entrada del menú (vistas/reologicas.js).

import { propiedadesHormigon, propiedadesAcero, materialDeFicha, caracteristico, opcionesHormigon, opcionesAcero, fckTipificado, aceroTipificado, parametrosSargin } from '../../core/materiales.js';
import { DUCTILIDAD } from '../../norma/normas.js';
import { leerNumero } from '../../core/armado.js';
import { rejilla } from '../rejilla.js';
import { evolucionEdad, fckEdad } from '../../core/reologia.js';
import { normaMat } from '../../norma/materiales/index.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, campoTexto, selector, grupo, par, boton, aviso, pestanas, tabla, filaCampos } from '../campos.js';
import { filasPlegables } from '../filasPlegables.js';
import { grafica } from '../grafica.js';

const TIPOS = ['hormigones', 'aceros'];
const est = { tipo: 'hormigones', b: {}, abierto: null, pendiente: null, pestana: 'prop' };

export function reiniciar() { est.tipo = 'hormigones'; est.b = {}; est.abierto = null; est.pendiente = null; }
/** Tras deshacer: los borradores sin cambios se recargan del proyecto. */
export function sincronizar() {
  for (const [k, b] of Object.entries(est.b)) if (!sucio(b)) delete est.b[k];
  est.pendiente = null;
}

const copia = (x) => JSON.parse(JSON.stringify(x));
const sucio = (b) => JSON.stringify(b.m) !== b.base;
const cargar = (tipo, m) => {
  const c = copia(m);
  const f = tipo === 'hormigones' ? fckTipificado(c.nombre) : null;
  if (f) c.fck = f;
  const a = tipo === 'aceros' ? aceroTipificado(c.nombre) : null;
  if (a) Object.assign(c, a);
  return (est.b[tipo] = { nombre: m.nombre, m: c, base: JSON.stringify(c) });
};
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const sup = (a, b) => `${a}<sup>${b}</sup>`;
// Guía § 13: la unidad va en la cabecera (de la columna o de la fila en las tablas de etiqueta y valor)
const U = (ud) => `${ESP}<span class="u u-cab">(${ud})</span>`;

/* ---------- borrador ---------- */

function nombreLibre(lista, base) {
  if (!lista.some((m) => m.nombre === base)) return base;
  let k = 2;
  while (lista.some((m) => m.nombre === `${base}-${k}`)) k++;
  return `${base}-${k}`;
}

function nuevo(ctx, tipo) {
  const p = ctx.p;
  const N = normaMat(p.norma);
  let m;
  if (tipo === 'hormigones') {
    m = { nombre: nombreLibre(p.hormigones, 'Hormigón'), tipo: 'hormigon', fck: 30 };
  } else {
    m = { nombre: nombreLibre(p.aceros, 'Acero'), tipo: 'acero', fyk: 500 };
  }
  return (est.b[tipo] = { nombre: null, m, base: JSON.stringify(m) });
}

function borrador(ctx, tipo = est.tipo) {
  const b = est.b[tipo];
  if (b && b.nombre !== null && !sucio(b)) {
    // Sin cambios propios: se sigue al material guardado (puede haberlo tocado otra pantalla, deshacer…)
    const g = ctx.p[tipo].find((x) => x.nombre === b.nombre);
    if (g && JSON.stringify(g) !== b.base) return cargar(tipo, g);
  }
  if (b) return b;
  const m0 = ctx.p[tipo][0];
  return m0 ? cargar(tipo, m0) : nuevo(ctx, tipo);
}

function pedir(ctx, hayRiesgo, texto, accion) {
  if (!hayRiesgo) { est.pendiente = null; accion(); return; }
  est.pendiente = { texto, accion };
  ctx.pintar();
}

function estadoBorrador(ctx, b) {
  const nombre = b.m.nombre.trim();
  const otro = ctx.p[est.tipo].find((x) => x.nombre === nombre);
  if (nombre !== b.nombre && otro) return { texto: t('mat.existe', nombre), clase: 'aviso', guardar: true };
  if (b.nombre === null) return { texto: t('mat.sinGuardar'), clase: 'pista', guardar: true };
  if (nombre !== b.nombre) return { texto: t('mat.seCrea', nombre, b.nombre), clase: 'pista', guardar: true };
  if (sucio(b)) return { texto: t('mat.cambios'), clase: 'pista', guardar: true };
  return { texto: t('mat.guardado'), clase: 'pista', guardar: false };
}

function guardar(ctx, b) {
  const L = ctx.p[est.tipo];
  const nombre = b.m.nombre.trim();
  if (!nombre) return ctx.avisar(t('mat.sinNombre'));
  b.m.nombre = nombre;
  const iDest = L.findIndex((x) => x.nombre === nombre);
  const hacer = () => {
    const c = copia(b.m);
    if (iDest >= 0) L[iDest] = c; else L.push(c);
    cargar(est.tipo, c);
    ctx.cambio({ estructura: true });
    ctx.avisar(t('mat.guardadoAviso', nombre));
  };
  pedir(ctx, iDest >= 0 && nombre !== b.nombre, t('mat.confirmaSustituir', nombre), hacer);
}

/** Secciones que usan el material (por nombre). */
function usadoPor(ctx, tipo, nombre) {
  const campo = tipo === 'hormigones' ? 'hormigon' : 'acero';
  return ctx.p.secciones.filter((s) => s[campo] === nombre).map((s) => s.nombre);
}

function borrar(ctx, b) {
  const L = ctx.p[est.tipo];
  const i = L.findIndex((x) => x.nombre === b.nombre);
  if (i < 0) return;
  L.splice(i, 1);
  if (L[0]) cargar(est.tipo, L[0]); else nuevo(ctx, est.tipo);
  ctx.cambio({ estructura: true });
  ctx.avisar(t('mat.borradoAviso', b.nombre));
}

/* ---------- lo que se muestra del material ---------- */

function resumen(ctx, m) {
  const norma = ctx.p.norma;
  try {
    if (m.tipo === 'hormigon') {
      const q = propiedadesHormigon(m.fck, norma, opcionesHormigon(m, norma));
      return `${sub('f', 'ck')} ${fmt(m.fck, 0)}${ESP}MPa · ${sub('f', 'cd')} ${fmt(q.fcd, 1)}${ESP}MPa · ${sub('E', 'cm')} ${fmt(q.Ec, 0)}${ESP}MPa`;
    }
    const q = propiedadesAcero(m.fyk, norma, opcionesAcero(m));
    return `${sub('f', 'yk')} ${fmt(m.fyk, 0)}${ESP}MPa · ${sub('f', 'yd')} ${fmt(q.fyd, 1)}${ESP}MPa · ${sub('ε', 'ud')} ${fmt(q.epsUd * 1000, 2)}${ESP}‰`;
  } catch { return ''; }
}

const ICONOS = {
  hormigones: '<rect x="2" y="2.5" width="12" height="11"/><path d="M4.2 5.4 6.4 4.4 7.6 6.2 6.2 7.8 4.3 7.2z"/><path d="M9 9.6 11.4 8.8 12.2 10.8 10.6 12 8.8 11.4z"/><circle cx="10.4" cy="5.2" r=".55"/><circle cx="4.8" cy="10.8" r=".55"/><circle cx="7.8" cy="9.6" r=".45"/>',
  aceros: '<rect x="1.5" y="5.5" width="13" height="5" rx="1.4"/><path d="M6.4 5.5 5.4 10.5M10.6 5.5 9.6 10.5"/>',
};
const icono = (k) => `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">${ICONOS[k]}</svg>`;
const etiquetaTipo = (k) => t(k === 'hormigones' ? 'mat.tipoH' : 'mat.tipoA');

/** Tarjetón del material activo (guía § 14.8): tipo, nombre en grande y resumen. */
function tarjeton(ctx, m) {
  return h('div', { class: 'tarjeton', 'aria-live': 'polite' },
    h('div', { class: 't-tipo', html: `${icono(est.tipo)}${etiquetaTipo(est.tipo)}` }),
    h('div', { class: 't-nom' }, m.nombre),
    h('div', { class: 't-res', id: 'm-resumen', html: resumen(ctx, m) }));
}

/* ---------- cabeza: qué material (guía § 14, nivel 2) ---------- */

let ctxCab = null;
const cerrar = () => { if (est.abierto) { est.abierto = null; ctxCab?.pintar(); } };
if (typeof document !== 'undefined') {
  document.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

function elegir(ctx, tipo, nombre) {
  const b = est.b[tipo];
  est.abierto = null;
  pedir(ctx, b && sucio(b) && b.nombre !== nombre, t('mat.confirmaDescartar', b?.nombre ?? b?.m.nombre), () => {
    est.tipo = tipo;
    if (nombre === null) nuevo(ctx, tipo);
    else if (!b || b.nombre !== nombre) cargar(tipo, ctx.p[tipo].find((x) => x.nombre === nombre));
    ctx.pintar();
  });
  if (est.pendiente) { est.tipo = tipo; ctx.pintar(); }
}

const breve = (k, m) => (k === 'hormigones' ? `${sub('f', 'ck')} ${fmt(m.fck, 0)}${ESP}MPa` : `${sub('f', 'yk')} ${fmt(m.fyk, 0)}${ESP}MPa`);

function listaMateriales(ctx, tipo, lista, activo) {
  const m = h('div', { class: 'menu-sec', role: 'listbox', onclick: (e) => e.stopPropagation() });
  const filas = h('div', { class: 'filas' });
  const q = lista.length > 8 ? h('input', { class: 'buscar', placeholder: t('sec.buscarEntre', lista.length), autocomplete: 'off' }) : null;
  const llenar = () => {
    const x = (q?.value ?? '').trim().toLowerCase();
    filas.replaceChildren(...lista.filter((s) => !x || s.nombre.toLowerCase().includes(x)).map((s) => h('button', {
      type: 'button', role: 'option', 'aria-current': s.nombre === activo ? 'true' : undefined,
      html: `${icono(tipo)}${s.nombre}<span class="nombre-sec">${breve(tipo, s)}</span>`,
      onclick: () => elegir(ctx, tipo, s.nombre) })));
    if (!filas.children.length) filas.append(h('span', { class: 'vacio' }, lista.length ? t('sec.ningunaCoincide') : t('sec.ningunaTipo')));
  };
  llenar();
  if (q) {
    q.addEventListener('input', llenar);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); filas.querySelector('button')?.click(); } });
    m.append(q);
    queueMicrotask(() => q.focus());
  }
  m.append(filas, h('button', { type: 'button', class: 'alta', onclick: () => elegir(ctx, tipo, null) }, `+ ${t(tipo === 'hormigones' ? 'mat.altaH' : 'mat.altaA')}`));
  queueMicrotask(() => filas.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }));
  return m;
}

/** Fila fija de dos desplegables (Hormigón, Acero); el activo en azul con el material («Hormigón · HA-25»). */
export function cabeza(ctx, el) {
  ctxCab = ctx;
  const actual = borrador(ctx);
  const fila = h('div', { class: 'selsec', role: 'group', 'aria-label': t('m.materiales') });
  for (const k of TIPOS) {
    const lista = ctx.p[k];
    const act = k === est.tipo;
    const caja = h('div', { class: `desp${act ? ' activo' : ''}` });
    const titulo = act ? `${etiquetaTipo(k)}<span class="sep">·</span><b>${actual.m.nombre}</b>` : etiquetaTipo(k);
    caja.append(h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': String(est.abierto === k), title: etiquetaTipo(k),
      html: `${icono(k)}<span class="nom">${titulo}</span><span class="cnt">${lista.length}</span><span class="car">▾</span>`,
      onclick: (e) => { e.stopPropagation(); est.abierto = est.abierto === k ? null : k; ctx.pintar(); } }));
    if (est.abierto === k) caja.append(listaMateriales(ctx, k, lista, act ? actual.nombre : undefined));
    fila.append(caja);
  }
  fila.append(h('button', { type: 'button', class: 'mas', title: t('mat.nuevoDe', etiquetaTipo(est.tipo)), onclick: () => elegir(ctx, est.tipo, null) }, `+ ${t('mat.nuevo')}`));
  el.append(fila);
}

/* ---------- panel de datos ---------- */

/** Guarda el valor en la ficha, o lo quita si es el de por defecto (la ficha solo lleva lo que se ha cambiado). */
const poneOBorra = (m, clave, v, def) => { if (v === def || v === undefined) delete m[clave]; else m[clave] = v; };

export function datos(ctx, form) {
  const b = borrador(ctx);
  const m = b.m;
  const N = normaMat(ctx.p.norma);
  const e = estadoBorrador(ctx, b);
  const bGuardar = boton(t('mat.guardar'), () => guardar(ctx, b), e.guardar ? '' : 'secundario');
  bGuardar.id = 'm-guardar';
  bGuardar.disabled = avisosMaterial(m, N).some(([tipo]) => tipo === 'error');
  const bBorrar = boton(t('mat.borrar'), () => borrar(ctx, b), 'peligro');
  const usan = b.nombre === null ? [] : usadoPor(ctx, est.tipo, b.nombre);
  bBorrar.disabled = b.nombre === null || usan.length > 0;
  if (usan.length) bBorrar.title = t('mat.lousan', usan.join(', '));

  const cambio = () => ctx.cambio();
  const identidad = grupo(null,
    campoTexto({ id: 'm-nombre', etq: t('nombre'), valor: m.nombre, onCambio: (v) => { m.nombre = v.trim() || m.nombre; const f = m.tipo === 'hormigon' ? fckTipificado(m.nombre) : null; if (f) { m.fck = f; delete m.diagrama; } const a = m.tipo === 'acero' ? aceroTipificado(m.nombre) : null; if (a) Object.assign(m, a); ctx.pintar(); } }));
  const gruposM = m.tipo === 'hormigon' ? gruposHormigon(m, N, cambio, () => ctx.cambio({ estructura: true })) : gruposAcero(m, N, cambio, () => ctx.cambio({ estructura: true }));
  // Un acero tipificado no admite cambios: solo se puede cambiar el nombre
  if (m.tipo === 'acero' && aceroTipificado(m.nombre)) for (const g of gruposM) g?.querySelectorAll?.('input, select').forEach((c) => { c.disabled = true; c.tabIndex = -1; });
  poner(form, tarjeton(ctx, m), identidad, ...gruposM);

  const pie = h('div', { class: 'pie-sec' },
    h('p', { id: 'm-estado', class: e.clase, html: e.texto, hidden: !!est.pendiente }),
    est.pendiente ? h('div', { class: 'aviso confirma' }, h('span', { html: est.pendiente.texto }),
      h('div', { class: 'fila-botones' },
        boton(t('continuar'), () => { const a = est.pendiente.accion; est.pendiente = null; a(); }, 'peligro'),
        boton(t('cancelar'), () => { est.pendiente = null; ctx.pintar(); }, 'discreto'))) : null,
    h('div', { class: 'fila-botones' }, bGuardar, bBorrar));
  poner(form, pie);
  // La confirmación queda abajo: se trae a la vista aunque se pidiera desde el selector de arriba
  if (est.pendiente) queueMicrotask(() => pie.querySelector('.confirma')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

const CEMENTOS = () => ['S', 'N', 'R'].map((c) => [c, t(`mat.cem.${c}`)]);

function gruposHormigon(m, N, cambio, repintar) {
  const ec2023 = N.id === 'EC2-2023';
  const tip = fckTipificado(m.nombre);
  const diag = m.diag ?? 'PR';
  const fck = campoNum({ id: 'm-fck', etq: sub('f', 'ck'), ayuda: tip ? t('mat.tipificado', m.nombre, tip) : undefined, valor: m.fck, mag: 'tension', paso: 5, min: N.fckMin ?? 12, max: N.fckMax, onCambio: (v) => { m.fck = v; delete m.diagrama; cambio(); } });
  if (tip) fck.querySelectorAll('input').forEach((i) => { i.disabled = true; i.tabIndex = -1; });
  const resistencia = grupo(t('mat.gResistencia'),
    fck,
    ec2023
      ? selector({ id: 'm-ktc', etq: sub('k', 'tc'), opciones: [['0.85', `0.85 · ${t('mat.ktcGeneral')}`], ['1', `1.00 · ${t('mat.ktc1')}`]], valor: String(m.ktc ?? 1), onCambio: (v) => { m.ktc = Number(v); cambio(); } })
      : campoNum({ id: 'm-acc', etq: sub('α', 'cc'), ayuda: t('mat.alfaAyuda', N.art.fcd), valor: m.alfaCC ?? 1, paso: 0.05, min: N.alfaRango[0], max: N.alfaRango[1], onCambio: (v) => { poneOBorra(m, 'alfaCC', v, 1); cambio(); } }),
    campoNum({ id: 'm-gc', etq: sub('γ', 'C'), ayuda: t('mat.gammaAyuda', N.gammaC, N.gammaAcc.c, N.art.gamma), valor: m.gammaC ?? N.gammaC, paso: 0.05, min: 1, max: 2, onCambio: (v) => { poneOBorra(m, 'gammaC', v, N.gammaC); cambio(); } }));
  const cemSel = selector({ id: 'm-cem', etq: t('mat.cemento'), opciones: CEMENTOS(), valor: m.cemento ?? 'N', onCambio: (v) => { poneOBorra(m, 'cemento', v, 'N'); cambio(); } });
  const deformacion = grupo(t('mat.gDeformacion'),
    ...(ec2023
      ? [campoNum({ id: 'm-ke', etq: sub('k', 'E'), ayuda: t('mat.kE'), valor: m.kE ?? 9500, paso: 500, min: 5000, max: 13000, onCambio: (v) => { m.kE = v; cambio(); } }), cemSel]
      : [filaCampos(selector({ id: 'm-arido', etq: t('mat.arido'), opciones: N.aridos.map(([k, c]) => [k, `${t(`mat.ar.${k}`)} · ${fmt(c, 1)}`]), valor: m.arido ?? 'cuarcita', onCambio: (v) => { poneOBorra(m, 'arido', v, 'cuarcita'); cambio(); } }), cemSel)]));
  const tipo = grupo(t('mat.gDiagrama'),
    selector({ id: 'm-diag', etq: t('mat.diag'), opciones: [['PR', t('mat.diag.PR')], ['EC2', t('mat.diag.EC2')], ['puntos', t('mat.diag.puntos')]], valor: diag, onCambio: (v) => {
      poneOBorra(m, 'diag', v, 'PR');
      delete m.diagrama;
      if (v === 'puntos' && !m.puntos?.length) m.puntos = puntosDesdePR(m, N.id);
      repintar();
    } }),
    ...(diag === 'EC2' ? [
      selector({ id: 'm-ref', etq: t('mat.refDiag'), opciones: [['fcm', `${sub('f', 'cm')} · ${t('mat.refPorDefecto')}`], ['fck', sub('f', 'ck')], ['fcd', sub('f', 'cd')]], valor: m.refDiag ?? 'fcm', onCambio: (v) => { poneOBorra(m, 'refDiag', v, 'fcm'); cambio(); } }),
      h('p', { class: 'pista', html: t('mat.notaEC2', N.corto) }),
    ] : diag === 'puntos' ? [
      rejilla({ id: 'm-puntos', altoMax: 80, columnas: [{ titulo: 'ε (‰)', num: true }, { titulo: 'σ (MPa)', num: true }],
        filas: (m.puntos ?? []).map(([e, sg]) => [String(e), String(sg)]),
        onCambio: (f) => { m.puntos = f.map((r) => [leerNumero(r[0]), leerNumero(r[1])]); cambio(); } }),
      h('p', { class: 'pista', html: t('mat.notaPuntos') }),
    ] : [h('p', { class: 'pista', html: t('mat.notaPR') })]));
  return [resistencia, deformacion, tipo, m.diagrama ? h('p', { class: 'pista' }, t('mat.diagramaImportado')) : null];
}

/** Primera versión del diagrama por puntos: el de parábola-rectángulo de la ficha (ε en ‰, σ en MPa, compresión positiva). */
function puntosDesdePR(m, normaId) {
  const mat = materialDeFicha({ ...m, diag: 'PR', puntos: undefined, diagrama: undefined }, normaId);
  const r = (x) => +x.toPrecision(4);
  return mat.comp.slice(1).map(([e, sg]) => [r(-e * 1000), r(-sg / 1000)]);
}

function gruposAcero(m, N, cambio, repintar) {
  const conClase = !!(N.DUCTILIDAD || N.id === 'EC2-2023');
  const kClase = (N.DUCTILIDAD ?? DUCTILIDAD)[m.ductilidad ?? N.ductilidad ?? 'B']?.k ?? 1.08;
  const resistencia = grupo(t('mat.gResistencia'),
    campoNum({ id: 'm-fyk', etq: sub('f', 'yk'), valor: m.fyk, mag: 'tension', paso: 50, min: 200, max: 700, onCambio: (v) => { m.fyk = v; delete m.diagrama; cambio(); } }),
    campoNum({ id: 'm-gs', etq: sub('γ', 'S'), ayuda: t('mat.gammaAyuda', N.gammaS, N.gammaAcc.s, N.art.gamma), valor: m.gammaS ?? N.gammaS, paso: 0.05, min: 1, max: 1.5, onCambio: (v) => { poneOBorra(m, 'gammaS', v, N.gammaS); cambio(); } }));
  const duct = grupo(t('mat.gDuctilidad'),
    ...(conClase ? [
      selector({ id: 'm-duct', etq: t('mat.ductilidad'), opciones: [['A', `A · ${sub('ε', 'uk')} 2.5 %`], ['B', `B · ${sub('ε', 'uk')} 5.0 %`], ['C', `C · ${sub('ε', 'uk')} 7.5 %`]], valor: m.ductilidad ?? N.ductilidad ?? 'B', onCambio: (v) => { m.ductilidad = v; cambio(); } }),
      selector({ id: 'm-rama', etq: t('mat.rama'), opciones: [['horizontal', t('mat.horizontal')], ['inclinada', t('mat.inclinada')]], valor: m.rama ?? 'horizontal', onCambio: (v) => { poneOBorra(m, 'rama', v, 'horizontal'); if (v === 'horizontal') delete m.k; repintar(); } }),
      ...(m.rama === 'inclinada' ? [campoNum({ id: 'm-k', etq: 'k = (f<sub>t</sub>/f<sub>y</sub>)<sub>k</sub>', ayuda: t('mat.kAyuda'), valor: m.k ?? kClase, paso: 0.01, min: kClase, max: 1.35, onCambio: (v) => { poneOBorra(m, 'k', v, kClase); cambio(); } })] : []),
      N.id === 'EC2-2004'
        ? selector({ id: 'm-eud', etq: t('mat.epsUdModo'), opciones: [['09', `0.9·${sub('ε', 'uk')} ≤ 10 ‰`], ['euk', `${sub('ε', 'uk')} ≤ 10 ‰ · ${t('mat.garantia')}`]], valor: m.epsUdModo ?? '09', onCambio: (v) => { poneOBorra(m, 'epsUdModo', v, '09'); cambio(); } })
        : null,
    ] : [h('p', { class: 'pista', html: t('mat.notaAceroEHE', N.art.acero) })]));
  return [resistencia, duct, m.diagrama ? h('p', { class: 'pista' }, t('mat.diagramaImportado')) : null];
}

/* ---------- resultados ---------- */

export function resultados(ctx, res) {
  const p = ctx.p;
  const b = borrador(ctx);
  const m = b.m;
  const N = normaMat(p.norma);
  // El panel de datos no se repinta al escribir: se actualizan aquí el estado y el resumen
  const e = estadoBorrador(ctx, b);
  const nota = document.getElementById('m-estado');
  if (nota) { nota.className = e.clase; nota.innerHTML = e.texto; }
  const rs = document.getElementById('m-resumen');
  if (rs) rs.innerHTML = resumen(ctx, m);
  const bg = document.getElementById('m-guardar');
  if (bg) bg.className = `boton ${e.guardar ? '' : 'secundario'}`;

  const avisos = avisosMaterial(m, N);
  if (bg) bg.disabled = avisos.some(([tipo]) => tipo === 'error');
  let mat = null;
  try { mat = materialDeFicha(m.diagrama ? m : { ...m, diagrama: undefined }, p.norma, { tracc: true }); } catch (err) { avisos.push(['error', String(err.message ?? err)]); }
  poner(res, ...avisos.map(([tipo, txt]) => aviso(txt, tipo)));

  const dib = h('article', { class: 'panel tarjeta' },
    h('h2', {}, m.nombre),
    h('p', { class: 'sub' }, `${etiquetaTipo(est.tipo)} · ${N.corto}`),
    h('div', { class: 'lienzo' }, mat ? graficaSigmaEps({ ...ctx, ficha: m }, mat) : null));
  const cuerpo = h('div', { class: 'cuerpo' }, dib);
  const tarjeta = h('article', { class: 'panel tarjeta' });
  cuerpo.append(tarjeta);
  if (mat) {
    if (m.tipo === 'hormigon') resultadosHormigon(ctx, m, N, tarjeta);
    else resultadosAcero(ctx, m, N, tarjeta);
  }
  res.append(cuerpo);
}

/** Campos de un tipificado que no se pueden cambiar con su nombre (αcc y ktc sí). */
const CAMBIOS_TIPIFICADO = (m) => ['gammaC', 'kE', 'arido', 'cemento', 'refDiag', 'puntos', 'diagrama'].filter((k) => m[k] !== undefined)
  .concat((m.diag ?? 'PR') !== (/_EC2$/i.test(m.nombre) ? 'EC2' : 'PR') ? ['diag'] : []);

function avisosMaterial(m, N) {
  const out = [];
  if (m.tipo === 'hormigon') {
    if (fckTipificado(m.nombre) && CAMBIOS_TIPIFICADO(m).length) out.push(['error', t('mat.avTipificado', m.nombre)]);
    const esEC2 = (m.diag ?? 'PR') === 'EC2';
    if (esEC2 && !/_EC2$/i.test(m.nombre)) out.push(['error', t('mat.avNombreEC2')]);
    else if (!esEC2 && /_EC2$/i.test(m.nombre)) out.push(['error', t('mat.avNombreNoEC2')]);
    if (m.fck < (N.fckMin ?? 12) || m.fck > N.fckMax) out.push(['error', t('mat.avFckRango', N.fckMin ?? 12, N.fckMax)]);
    else if (N.id === 'EHE-08' && m.fck < N.fckMinArmado) out.push(['', t('mat.avFckArmado')]);
    if (N.alfaRango && (m.alfaCC ?? 1) < N.alfaRango[0] - 1e-9) out.push(['error', t('mat.avAlfa', N.alfaRango[0], N.alfaRango[1])]);
  } else if (aceroTipificado(m.nombre) && ['gammaS', 'rama', 'epsUd', 'epsUdModo', 'k'].some((c) => m[c] !== undefined) || (m.ductilidad !== undefined && m.ductilidad !== aceroTipificado(m.nombre).ductilidad)) {
    out.push(['error', t('mat.avTipificadoA', m.nombre)]);
  } else if (m.fyk > N.fykMax) {
    out.push(['', t('mat.avFykMax', N.fykMax, N.corto)]);
  }
  return out;
}

/** Diagrama σ-ε de cálculo y característico, con la gráfica común (zoom, cruz, copiar y Gráfico/Tabla). */
function graficaSigmaEps(ctx, mat) {
  const xy = (mt) => [...mt.comp.slice().reverse(), ...mt.tracc.slice(1)].map(([e, s]) => [-e * 1000, -s / 1000]);
  const sargin = mat.tipo === 'hormigon' && mat.diag === 'EC2';
  const car = caracteristico(mat);
  const series = [{ nombre: t(sargin ? 'mat.sCaract' : 'mat.sCalculo'), xy: xy(mat), clase: 's1' }];
  if (sargin) {
    // El de cálculo es el mismo diagrama con fcd como referencia y sin tracción (en ELU siempre fct = 0)
    try { series.push({ nombre: t('mat.sCalculo'), xy: xy(materialDeFicha({ ...ctx.ficha, refDiag: 'fcd', diagrama: undefined }, ctx.p.norma)), clase: 'ref' }); } catch { /* sin curva de cálculo */ }
  } else if (car !== mat) series.push({ nombre: t('mat.sCaract'), xy: xy(car), clase: 'ref' });
  const tag = (a, b) => `${a}<tspan class="ind">${b}</tspan>`;
  const puntos = [];
  if (mat.tipo === 'hormigon') {
    const d = mat.diag ?? 'PR';
    const ult = mat.comp.at(-1);
    if (d === 'EC2') {
      const pico = mat.comp.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a));
      puntos.push({ x: -pico[0] * 1000, y: -pico[1] / 1000, etq: `${tag('f', 'cm')} = ${fmt(-pico[1] / 1000, 1)}` },
        { x: -pico[0] * 1000, y: 0, etq: tag('ε', 'c1'), abajo: true },
        { x: -ult[0] * 1000, y: -ult[1] / 1000, etq: tag('ε', 'cu1'), abajo: true });
    } else if (d === 'PR') {
      const fcd = -ult[1] / 1000;
      puntos.push({ x: -ult[0] * 1000, y: fcd, etq: tag('ε', 'cu'), abajo: true },
        { x: -mat.comp.at(-2)[0] * 1000, y: fcd, etq: `${tag('f', 'cd')} = ${fmt(fcd, 1)}`, abajo: true });
    } else {
      puntos.push({ x: -ult[0] * 1000, y: -ult[1] / 1000, etq: tag('ε', 'cu'), abajo: true });
    }
  } else {
    const [ey, fy] = mat.tracc[1];
    const [eu, su] = mat.tracc[2];
    puntos.push({ x: -ey * 1000, y: -fy / 1000, etq: `${tag('f', 'yd')} = ${fmt(fy / 1000, 1)}` },
      { x: -eu * 1000, y: -su / 1000, etq: tag('ε', 'ud') });
  }
  return grafica({ series, puntos, ejeX: { titulo: 'ε (‰)', d: 2 }, ejeY: { titulo: 'σ (MPa)', d: 1 }, archivo: `sigma-epsilon-${mat.nombre}`, rejillaSec: { x: 0.5, y: mat.tipo === 'acero' ? 25 : 2.5 }, avisar: ctx.avisar });
}

const art = (N, k) => `<span class="art">${N.corto} · ${N.art[k]}</span>`;
const F = (s) => `<span class="f">${s}</span>`;
const Nn = (s) => `<span class="n">${s}</span>`;

/** Fórmula de f_ct,m de cada norma (hasta 50 MPa y por encima), con los valores sustituidos. */
function fctmCuenta(N, fck, fcm, valor) {
  const alta = fck > 50;
  const v = fmt(valor, 2);
  const ft = sub('f', 'ct,m');
  if (N.id === 'EHE-08') return alta ? [`${ft} = 0.58·√${sub('f', 'ck')}`, `= 0.58·√${fck} = ${v}`] : [`${ft} = 0.30·${sup(sub('f', 'ck'), '2/3')}`, `= 0.30·${fck}<sup>2/3</sup> = ${v}`];
  if (N.id === 'EC2-2004') return alta ? [`${ft} = 2.12·ln(1 + ${sub('f', 'cm')}/10)`, `= 2.12·ln(1 + ${fcm}/10) = ${v}`] : [`${ft} = 0.30·${sup(sub('f', 'ck'), '2/3')}`, `= 0.30·${fck}<sup>2/3</sup> = ${v}`];
  return alta ? [`${ft} = 1.1·${sup(sub('f', 'ck'), '1/3')}`, `= 1.1·${fck}<sup>1/3</sup> = ${v}`] : [`${ft} = 0.3·${sup(sub('f', 'ck'), '2/3')}`, `= 0.3·${fck}<sup>2/3</sup> = ${v}`];
}

function resultadosHormigon(ctx, m, N, tarjeta) {
  const norma = ctx.p.norma;
  const q = propiedadesHormigon(m.fck, norma, opcionesHormigon(m, norma));
  const ec2023 = N.id === 'EC2-2023';
  const R = {};
  const fila = (id, etq, val, cuenta) => { R[id] = { etq, val, cuenta: cuenta ?? null }; };
  const v1 = (x) => fmt(x, 1);
  const gC = fmt(q.gammaC, 2);

  fila('fck', `${sub('f', 'ck')}${U('MPa')}`, v1(q.fck));
  fila('fcm', `${sub('f', 'cm')}${U('MPa')}`, v1(q.fcm), F(`${sub('f', 'cm')} = ${sub('f', 'ck')} + 8`) + Nn(`= ${q.fck} + 8 = ${q.fcm}`) + art(N, 'fcm'));
  fila('fcd', `${sub('f', 'cd')}${U('MPa')}`, v1(q.fcd), ec2023
    ? F(`${sub('f', 'cd')} = ${sub('η', 'cc')}·${sub('k', 'tc')}·${sub('f', 'ck')}/${sub('γ', 'C')}`) + Nn(`${sub('η', 'cc')} = (40/${sub('f', 'ck')})<sup>1/3</sup> = ${fmt(q.etacc, 3)} (≤ 1); ${sub('k', 'tc')} = ${fmt(q.ktc, 2)}`) + Nn(`= ${fmt(q.etacc, 3)}·${fmt(q.ktc, 2)}·${q.fck}/${gC} = ${v1(q.fcd)}`) + art(N, 'fcd')
    : F(`${sub('f', 'cd')} = ${sub('α', 'cc')}·${sub('f', 'ck')}/${sub('γ', 'C')}`) + Nn(`= ${fmt(q.alfa, 2)}·${q.fck}/${gC} = ${v1(q.fcd)}`) + art(N, 'fcd'));
  const [fCt, nCt] = fctmCuenta(N, m.fck, q.fcm, q.fctm);
  fila('fctm', `${sub('f', 'ct,m')}${U('MPa')}`, fmt(q.fctm, 2), F(fCt) + Nn(nCt) + art(N, 'fctm'));
  fila('fctk05', `${sub('f', 'ct,k,0.05')}${U('MPa')}`, fmt(q.fctk05, 2), F(`${sub('f', 'ctk,0.05')} = 0.7·${sub('f', 'ct,m')}`) + Nn(`= 0.7·${fmt(q.fctm, 2)} = ${fmt(q.fctk05, 2)}`) + art(N, 'fctk'));
  if (q.fctk95) fila('fctk95', `${sub('f', 'ct,k,0.95')}${U('MPa')}`, fmt(q.fctk95, 2), F(`${sub('f', 'ctk,0.95')} = 1.3·${sub('f', 'ct,m')}`) + Nn(`= 1.3·${fmt(q.fctm, 2)} = ${fmt(q.fctk95, 2)}`) + art(N, 'fctk'));
  fila('fctd', `${sub('f', 'ct,d')}${U('MPa')}`, fmt(q.fctd, 2), ec2023
    ? F(`${sub('f', 'ctd')} = ${sub('k', 'tt')}·${sub('f', 'ctk,0.05')}/${sub('γ', 'C')}`) + Nn(`${sub('k', 'tt')} = ${fmt(q.ktt, 2)}; = ${fmt(q.ktt, 2)}·${fmt(q.fctk05, 2)}/${gC} = ${fmt(q.fctd, 2)}`) + `<span class="art">${N.corto} · 5.1.6(2), (5.5)</span>`
    : F(`${sub('f', 'ctd')} = ${sub('α', 'ct')}·${sub('f', 'ctk,0.05')}/${sub('γ', 'C')}`) + Nn(`${sub('α', 'ct')} = 1; = ${fmt(q.fctk05, 2)}/${gC} = ${fmt(q.fctd, 2)}`) + `<span class="art">${N.corto} · ${N.id === 'EHE-08' ? '39.4' : '3.1.6(2)P'}</span>`);
  const k = q.coefArido ?? 1;
  const ka = k !== 1 ? `·${fmt(k, 1)}` : '';
  const cEc = N.id === 'EHE-08' ? [`${sub('E', 'cm')} = 8500·${sup(sub('f', 'cm'), '1/3')}${ka}`, `= 8500·${q.fcm}<sup>1/3</sup>${ka} = ${fmt(q.Ec, 0)}`]
    : N.id === 'EC2-2004' ? [`${sub('E', 'cm')} = 22·(${sub('f', 'cm')}/10)<sup>0.3</sup>${ka} GPa`, `= 22·(${q.fcm}/10)<sup>0.3</sup>${ka} = ${fmt(q.Ec / 1000, 1)} GPa`]
      : [`${sub('E', 'cm')} = ${sub('k', 'E')}·${sup(sub('f', 'cm'), '1/3')}`, `= ${q.kE}·${q.fcm}<sup>1/3</sup> = ${fmt(q.Ec, 0)}`];
  fila('Ec', `${sub('E', 'cm')}${U('MPa')}`, fmt(q.Ec, 0), F(cEc[0]) + Nn(cEc[1]) + art(N, 'Ec'));
  const bE = fmt(q.Ec28 / q.Ec, 3);
  const cE28 = N.id === 'EHE-08' ? [`${sub('E', 'c,tg')} = ${sub('β', 'E')}·${sub('E', 'cm')}, ${sub('β', 'E')} = 1.30 − ${sub('f', 'ck')}/400 ≥ 1.175`, `= ${bE}·${fmt(q.Ec, 0)} = ${fmt(q.Ec28, 0)}`]
    : N.id === 'EC2-2004' ? [`${sub('E', 'c,tg')} = 1.05·${sub('E', 'cm')}`, `= 1.05·${fmt(q.Ec, 0)} = ${fmt(q.Ec28, 0)}`]
      : [`${sub('E', 'c,tg')} = ${sub('α', 'c')}·${sub('E', 'cm')}, ${sub('α', 'c')} = 1/(0.8 + 0.2·${sub('f', 'cm')}/88) ≥ 1`, `= ${bE}·${fmt(q.Ec, 0)} = ${fmt(q.Ec28, 0)}`];
  fila('Ec28', `${sub('E', 'c,tg')}${U('MPa')}`, fmt(q.Ec28, 0), F(cE28[0]) + Nn(cE28[1]) + `<span class="art">${N.corto} · ${N.art.fluencia}</span>`);
  const alta = m.fck > 50;
  const fk = sub('f', 'ck');
  const cDiag = N.id === 'EHE-08' ? (alta ? `${sub('ε', 'c2')} = 0.002 + 0.000085·(${fk} − 50)<sup>0.53</sup>; ${sub('ε', 'cu')} = 0.0026 + 0.0144·((100 − ${fk})/100)<sup>4</sup>; n = 1.4 + 9.6·((100 − ${fk})/100)<sup>4</sup>` : `${sub('ε', 'c2')} = 0.002; ${sub('ε', 'cu')} = 0.0035; n = 2 (${fk} ≤ 50)`)
    : N.id === 'EC2-2004' ? (alta ? `${sub('ε', 'c2')} = 2.0 + 0.085·(${fk} − 50)<sup>0.53</sup> ‰; ${sub('ε', 'cu2')} = 2.6 + 35·((90 − ${fk})/100)<sup>4</sup> ‰; n = 1.4 + 23.4·((90 − ${fk})/100)<sup>4</sup>` : `${sub('ε', 'c2')} = 2.0 ‰; ${sub('ε', 'cu2')} = 3.5 ‰; n = 2 (${fk} ≤ 50)`)
      : `${sub('ε', 'c2')} = 2.0 ‰; ${sub('ε', 'cu')} = 3.5 ‰; n = 2 (${t('mat.todasClases')})`;
  const diag = m.diag ?? 'PR';
  if (diag === 'EC2') {
    const sg = parametrosSargin(m.fck, N.id, { kE: m.kE, coefArido: q.coefArido, refDiag: m.refDiag, fcd: q.fcd });
    const ref = sub('f', m.refDiag === 'fck' ? 'ck' : m.refDiag === 'fcd' ? 'cd' : 'cm');
    fila('eps', `${sub('ε', 'c1')} / ${sub('ε', 'cu1')}${U('‰')}`, `${fmt(sg.e1 * 1000, 2)} / ${fmt(sg.eu1 * 1000, 2)}`, F(`σ<sub>c</sub>/${ref} = (k·η − η²)/(1 + (k − 2)·η), k = 1.05·${sub('E', 'cm')}·${sub('ε', 'c1')}/${ref}, η = ε/${sub('ε', 'c1')}`) + Nn(`k = ${fmt(sg.k, 3)}; ${ref} = ${fmt(sg.ref, 1)} MPa`) + `<span class="art">${N.corto} · ${N.id === 'EC2-2023' ? '5.1.6(3), (5.6)-(5.10)' : '3.1.5(1), (3.14), tabla 3.1'}${N.id === 'EHE-08' ? ' (criterio UNE-EN 1992-1-1)' : ''}</span>`);
  } else if (diag === 'PR') {
    fila('eps', `${sub('ε', 'c2')} / ${sub('ε', 'cu')}${U('‰')}`, `${fmt(q.epsC2 * 1000, 2)} / ${fmt(q.epsCu * 1000, 2)}`, F(cDiag) + Nn(`n = ${fmt(q.nExp, 2)}`) + art(N, 'diagrama'));
  }

  const todos = ['fck', 'fcm', 'fcd', 'fctm', 'fctk05', 'fctk95', 'fctd', 'Ec', 'Ec28', 'eps'].filter((k) => R[k]);
  poner(tarjeta, tablaEdad(m, N, q),
    h('h3', { class: 'sub-edad' }, t('mat.a28')),
    filasPlegables(tabla(todos.map((k) => [R[k].etq, R[k].val]), { clase: 'prop' }), todos.map((k) => R[k].cuenta)));
}

/** Valores a distintas edades, en una tabla tipo hoja de cálculo: cada fila una edad, cada columna un parámetro. */
function tablaEdad(m, N, q) {
  const cem = m.cemento ?? 'N';
  const edades = [3, 7, 14, 28, 90, 180, 365, 10000];
  const ev = (tt) => evolucionEdad(N.id, { fck: m.fck, fcm: q.fcm, fctm: q.fctm, Ecm: q.Ec, cemento: cem, t: tt });
  const ec2023 = N.id === 'EC2-2023';
  const fil = edades.map((tt) => {
    const e = ev(tt);
    const fckT = fckEdad(m.fck, e.fcm, tt);
    return [fmt(tt, 0), fmt(e.beta, 3), fmt(fckT, 1), fmt(e.fcm, 1), fmt((q.fcd * fckT) / m.fck, 1), fmt(e.fctm, 2), fmt((q.fctk05 / q.fctm) * e.fctm, 2), fmt(e.Ecm, 0)];
  });
  const H = (x, ud) => `${x}<br><span class="u u-cab">(${ud})</span>`;
  const tb = tabla(fil, { cabecera: [H('t', 'días'), sub('β', 'cc'), H(sub('f', 'ck'), 'MPa'), H(sub('f', 'cm'), 'MPa'), H(sub('f', 'cd'), 'MPa'), H(sub('f', 'ct,m'), 'MPa'), H(sub('f', 'ctk,0.05'), 'MPa'), H(sub('E', 'cm'), 'MPa')], clase: 'num excel' });
  // Los 28 días son la edad de referencia: su fila va en gris
  tb.querySelectorAll('tbody tr')[edades.indexOf(28)]?.classList.add('dia28');
  const bt = sub('β', 'cc');
  const nota = `${bt}(t) = exp{s·[1 − √(28/t)]}, ${sub('f', 'cm')}(t) = ${bt}·${sub('f', 'cm')}, ${sub('f', 'ct,m')}(t) = ${bt}<sup>${ec2023 ? '0.6' : 'α'}</sup>·${sub('f', 'ct,m')}, ${sub('E', 'cm')}(t) = ${ec2023 ? `${bt}<sup>1/3</sup>` : `(${sub('f', 'cm')}(t)/${sub('f', 'cm')})<sup>0.3</sup>`}·${sub('E', 'cm')} · ${N.corto} · ${N.art.edad}<br>Para t ≠ 28 d, ${sub('f', 'cd')}(t) y ${sub('f', 'ct,k,0.05')}(t) se obtienen escalando los valores de 28 d con ${sub('f', 'ck')}(t)/${sub('f', 'ck')} y ${sub('f', 'ct,m')}(t)/${sub('f', 'ct,m')} (criterio propio, no es literal de la norma).`;
  return h('div', { class: 'edad' }, tb, h('details', { class: 'nota-plegada' }, h('summary', {}, t('mat.aEdades')), h('p', { class: 'formula', html: nota })));
}

function resultadosAcero(ctx, m, N, tarjeta) {
  const norma = ctx.p.norma;
  const q = propiedadesAcero(m.fyk, norma, opcionesAcero(m));
  const filas = [];
  const cuentas = [];
  const fila = (etq, val, cuenta) => { filas.push([etq, val]); cuentas.push(cuenta ?? null); };
  const conClase = !!q.ductilidad;
  fila(`${sub('f', 'yk')}${U('MPa')}`, fmt(q.fyk, 1));
  fila(sub('γ', 'S'), fmt(q.gammaS, 2), Nn(t('mat.gammaAyuda', fmt(N.gammaS, 2), fmt(N.gammaAcc.s, 2), N.art.gamma)));
  fila(`${sub('f', 'yd')}${U('MPa')}`, fmt(q.fyd, 1), F(`${sub('f', 'yd')} = ${sub('f', 'yk')}/${sub('γ', 'S')}`) + Nn(`= ${q.fyk}/${fmt(q.gammaS, 2)} = ${fmt(q.fyd, 1)}`) + art(N, 'fyd'));
  fila(`${sub('E', 's')}${U('MPa')}`, fmt(q.Es, 0), Nn(`${sub('E', 's')} = 200 000`) + art(N, 'acero'));
  fila(`${sub('ε', 'yd')}${U('‰')}`, fmt(q.epsY * 1000, 2), F(`${sub('ε', 'yd')} = ${sub('f', 'yd')}/${sub('E', 's')}`) + Nn(`= ${fmt(q.fyd, 1)}/${fmt(q.Es, 0)} = ${fmt(q.epsY * 1000, 2)} ‰`));
  if (conClase) fila(t('mat.ductilidad'), `${q.ductilidad} (k = ${fmt(q.k, 2)}, ${sub('ε', 'uk')} = ${fmt(q.euk * 100, 1)} %)`, Nn(t('mat.ductilidadCuenta')) + art(N, 'acero'));
  const cUd = N.id === 'EC2-2023' ? [`${sub('ε', 'ud')} = ${sub('ε', 'uk')}/${sub('γ', 'S')}`, `= ${fmt(q.euk * 100, 1)} %/${fmt(q.gammaS, 2)} = ${fmt(q.epsUd * 1000, 2)} ‰`]
    : N.id === 'EC2-2004' ? [`${sub('ε', 'ud')} = ${m.epsUdModo === 'euk' ? '' : '0.9·'}${sub('ε', 'uk')} ≤ 10 ‰`, `= ${fmt(q.epsUd * 1000, 2)} ‰`, 'La EN 1992-1-1 recomienda 0.9·ε_uk sin tope; el Anejo Nacional español añade ε_ud ≤ 10 ‰ (no 20 ‰).']
      : [`${sub('ε', 'máx')} = 10 ‰`, t('mat.ramaHoriz')];
  fila(`${sub('ε', 'ud')}${U('‰')}`, fmt(q.epsUd * 1000, 2), F(cUd[0]) + Nn(cUd[1]) + (cUd[2] ? Nn(cUd[2]) : '') + art(N, 'acero'));
  if (conClase && q.rama === 'inclinada') {
    fila(`${sub('σ', 's')}(${sub('ε', 'ud')})${U('MPa')}`, fmt(q.sigmaUd, 1),
      F(`${sub('σ', 's')} = ${sub('f', 'yd')} + (k·${sub('f', 'yk')}/${sub('γ', 'S')} − ${sub('f', 'yd')})·(${sub('ε', 'ud')} − ${sub('ε', 'yd')})/(${sub('ε', 'uk')} − ${sub('ε', 'yd')})`) + Nn(`= ${fmt(q.sigmaUd, 1)}`) + art(N, 'acero'));
  }
  poner(tarjeta, filasPlegables(tabla(filas, { clase: 'prop' }), cuentas));
}

/* ---------- Ctrl+K ---------- */

export function comandos(ctx) {
  return TIPOS.map((k) => ({
    texto: t('mat.nuevoDe', etiquetaTipo(k)),
    b: `material nuevo new ${k} hormigón acero concrete steel`,
    f: () => { ctx.ir('materiales'); elegir(ctx, k, null); },
  }));
}
