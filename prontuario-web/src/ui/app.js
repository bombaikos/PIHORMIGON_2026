// Interfaz de la SPA. No contiene cálculo: llama a src/core, src/norma y src/io.
// Cada pantalla vive en src/ui/vistas/ y pinta dos zonas: datos (izquierda) y resultados (derecha).
// Los datos se pintan al entrar o al cambiar algo estructural; los resultados se recalculan
// con cada cambio (sin botón Calcular), conservando el foco y lo escrito en los campos.

import { NORMAS } from '../norma/normas.js';
import { proyectoNuevo, guardarLocal, cargarLocal } from '../io/proyecto.js';
import { t, tx, ponerLengua, lenguaActual } from './i18n.js';
import { h, aviso, comportamientoFormulario } from './campos.js';
import { instalarPaleta } from './paleta.js';
import { ponerDecimalAlCopiar, ponerSerieDiametros } from './formato.js';
import * as proyecto from './vistas/proyecto.js';
import * as materiales from './vistas/materiales.js';
import * as reologicas from './vistas/reologicas.js';
import * as secciones from './vistas/secciones.js';
import * as durabilidad from './vistas/durabilidad.js';
import * as flexion from './vistas/flexion.js';
import * as flexRecta from './vistas/flexRecta.js';
import * as fuego from './vistas/fuego.js';
import * as anclaje from './vistas/anclaje.js';
import * as cortante from './vistas/cortante.js';
import * as punzonamiento from './vistas/punzonamiento.js';
import * as vigas1vano from './vistas/vigas.js';

// Crear y editar y Diagramas son el mismo módulo de secciones con la misma sección activa;
// cada entrada fija lo que muestra antes de pintar
function vistaSecciones(m, propia) {
  const fijar = (f) => (...a) => { secciones.modo(m); return f(...a); };
  const v = { cabeza: fijar(secciones.cabeza), datos: fijar(secciones.datos), resultados: fijar(secciones.resultados) };
  return propia ? { ...secciones, ...v } : v;
}
const VISTAS = { proyecto, materiales, reologicas, secciones: vistaSecciones('seccion', true), durabilidad, diagramas: vistaSecciones('mk', false), vigas1vano, flexion, flexRecta, fuego, anclaje, cortante, punzonamiento };
// Menú principal. Una entrada es un módulo suelto o un grupo con submenú; '|' separa familias dentro del
// submenú. Lo que aún no está en VISTAS sale atenuado y sin acción, y se activa solo al migrarlo.
const MENU = [
  'proyecto',
  { grupo: 'materiales', vistas: ['materiales', 'reologicas'] },
  { grupo: 'secciones', vistas: ['secciones', 'durabilidad', 'diagramas'] },
  { grupo: 'analisis', vistas: ['vigas1vano'] },
  { grupo: 'elu', siempre: true, vistas: ['flexion', 'flexRecta', 'flexEsviada', '|', 'cortante', 'torsion', 'punzonamiento', 'anclaje', 'rasante', '|', 'inestabilidad'] },
  { grupo: 'els', vistas: ['flechas'] },
  'fuego', 'bielas', 'ejecucion', 'ayuda',
];
const ORDEN = MENU.flatMap((m) => (typeof m === 'string' ? [m] : m.vistas)).filter((v) => v in VISTAS);

const estado = {
  proyecto: null,
  vista: 'secciones',
  ejemplo: false,
  hist: [],
  avisosImport: [],
};

const $ = (id) => document.getElementById(id);

/* ---------- avisos flotantes ---------- */
let tAviso;
function avisar(x) {
  let el = document.querySelector('.aviso-flot');
  if (!el) { el = h('div', { class: 'aviso-flot', role: 'status' }); document.body.append(el); }
  el.innerHTML = x;
  el.hidden = false;
  clearTimeout(tAviso);
  tAviso = setTimeout(() => (el.hidden = true), 2400);
}

/* ---------- contexto que reciben las pantallas ---------- */

let ultimo = null;
const ctx = {
  get p() { return estado.proyecto; },
  estado,
  avisar,
  /** Un dato cambió. estructura = true repinta también el panel de datos. */
  cambio({ estructura = false } = {}) {
    estado.ejemplo = false;
    const j = JSON.stringify(estado.proyecto);
    if (ultimo !== null && j !== ultimo) { estado.hist.push(ultimo); if (estado.hist.length > 100) estado.hist.shift(); }
    ultimo = j;
    guardarLocal(estado.proyecto);
    if (estructura) pintar(); else { pintarCabecera(); pintarResultados(); }
  },
  /** Cambia el proyecto entero (importar, abrir, nuevo). */
  ponerProyecto(p, avisos = []) {
    estado.proyecto = p;
    estado.avisosImport = avisos;
    for (const v of Object.values(VISTAS)) v.reiniciar?.(ctx);
    ctx.cambio({ estructura: true });
  },
  ir(vista) { estado.vista = vista; guardarPref('vista', vista); pintar(); },
  pintar: () => pintar(),
};

/** Ctrl+B: oculta o muestra el panel de datos para ver los resultados con más sitio (guía § 13). */
function plegarDatos() {
  const r = document.documentElement;
  if (r.dataset.datos === 'plegado') delete r.dataset.datos; else r.dataset.datos = 'plegado';
  guardarPref('datos', r.dataset.datos ?? '');
  ajustarTextos();
}

function deshacer() {
  const j = estado.hist.pop();
  if (!j) return avisar(t('nadaDeshacer'));
  estado.proyecto = JSON.parse(j);
  ultimo = j;
  guardarLocal(estado.proyecto);
  for (const v of Object.values(VISTAS)) v.sincronizar?.(ctx);
  pintar();
  avisar(t('deshecho'));
}

/* ---------- pintar ---------- */

function pintarCabecera() {
  const p = estado.proyecto;
  $('marca-app').innerHTML = t('app');
  $('nombre-proyecto').textContent = p.nombre || t('sinNombre');
  $('marca-ejemplo').hidden = !estado.ejemplo;
  $('marca-ejemplo').textContent = t('ejemplo');
  $('txt-comandos').textContent = t('comandos');
  $('pie').textContent = t('pie');
  $('menu').setAttribute('aria-label', t('modulos'));
  $('menu').replaceChildren(...MENU.map((m) => (typeof m === 'string'
    ? h('button', { type: 'button', 'aria-current': m === estado.vista ? 'page' : undefined, disabled: m in VISTAS ? undefined : '', title: m in VISTAS ? undefined : t('menu.pronto'), onclick: () => ctx.ir(m) }, t(`m.${m}`))
    : desplegable(m))));
  // Guía § 14: la norma es un ajuste de todo el proyecto, en un chip con su nombre delante
  // La norma vigente va en tinta normal; cualquier otra, con el nombre en rojo (José Luis, 11/10)
  const nombreNorma = (n) => h('span', { class: n.vigente ? '' : 'no-vigente' }, n.corto);
  const lista = h('div', { class: 'menu-desp', id: 'menu-norma', popover: 'auto', role: 'menu' },
    ...Object.values(NORMAS).map((n) => h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(n.id === p.norma), title: n.nombre,
      onclick: () => { lista.hidePopover?.(); ponerNorma(n.id); } }, nombreNorma(n), n.vigente ? null : h('small', {}, t('norma.noVigente')))));
  const chip = h('button', { type: 'button', class: 'chip-ajuste', 'aria-haspopup': 'menu', title: NORMAS[p.norma]?.nombre,
    onclick: () => {
      if (!lista.showPopover) { const ids = Object.keys(NORMAS); return ponerNorma(ids[(ids.indexOf(p.norma) + 1) % ids.length]); }
      const r = chip.getBoundingClientRect();
      lista.style.left = `${Math.max(8, r.right - 200)}px`;
      lista.style.top = `${r.bottom + 4}px`;
      lista.togglePopover();
    } }, h('span', {}, t('norma')), h('b', {}, nombreNorma(NORMAS[p.norma])), h('span', { class: 'flecha', 'aria-hidden': 'true' }, '▾'));
  document.getElementById('menu-norma')?.remove();
  document.body.append(lista);
  $('seg-norma').replaceChildren(chip);
}

/** Entrada del menú con submenú: el botón abre una lista (popover, para que el menú no la recorte). */
function desplegable(m) {
  const id = `menu-${m.grupo}`;
  const lista = h('div', { class: 'menu-desp', id, popover: 'auto', role: 'menu' },
    ...m.vistas.map((v) => (v === '|' ? h('hr', { role: 'separator' })
      : h('button', { type: 'button', role: 'menuitem', 'aria-current': v === estado.vista ? 'page' : undefined,
        disabled: v in VISTAS ? undefined : '', title: v in VISTAS ? undefined : t('menu.pronto'),
        onclick: () => { lista.hidePopover?.(); ctx.ir(v); } }, t(`menu.${v}`)))));
  const b = h('button', { type: 'button', class: 'con-desp', 'aria-haspopup': 'menu', 'aria-current': m.vistas.includes(estado.vista) ? 'page' : undefined,
    onclick: () => {
      if (!lista.showPopover) return ctx.ir(m.vistas[0]);
      const r = b.getBoundingClientRect();
      lista.style.left = `${r.left}px`;
      lista.style.top = `${r.bottom + 4}px`;
      lista.togglePopover();
    } }, `${t(`m.${m.grupo}`)}${m.vistas.includes(estado.vista) && (m.siempre || estado.vista !== m.vistas[0]) ? ` · ${t(`menu.${estado.vista}`)}` : ''}`, h('span', { class: 'flecha', 'aria-hidden': 'true' }, '▾'));
  document.getElementById(id)?.remove();
  document.body.append(lista);
  return b;
}

function ponerNorma(n) {
  if (estado.proyecto.norma === n) return;
  estado.proyecto.norma = n;
  ctx.cambio({ estructura: true });
}

function pintarResultados() {
  const res = $('resultados');
  const v = VISTAS[estado.vista];
  try {
    const nuevo = h('section', { class: 'resultados', id: 'resultados', 'aria-live': 'polite' });
    v.resultados(ctx, nuevo);
    encajar(nuevo);
    res.replaceWith(nuevo);
    ajustarTextos();
  } catch (e) {
    // Si el cálculo falla queda el último resultado atenuado y el error encima (guía §6)
    console.error(e);
    res.querySelector('.veredicto')?.classList.add('viejo');
    res.querySelectorAll('.aviso.error.motor').forEach((x) => x.remove());
    let av = res.querySelector(':scope > .avisos');
    if (!av) { av = h('div', { class: 'avisos' }); res.prepend(av); }
    av.prepend(aviso(tx(e), 'error motor'));
  }
}

/**
 * Los textos de los dibujos miden siempre 12 px en pantalla (10 px los rótulos) aunque el SVG se
 * escale (guía § 8): se mide la escala real k = lado limitante en pantalla / lado del viewBox (ancho o alto) y se guarda
 * en --k, que divide el tamaño de letra en el CSS.
 */
const vigiaDibujos = typeof ResizeObserver === 'function' ? new ResizeObserver(() => ajustarTextos()) : null;
function ajustarTextos() {
  for (const svg of document.querySelectorAll('svg.dib')) {
    const vb = svg.viewBox?.baseVal;
    const r = svg.getBoundingClientRect();
    // «meet»: el SVG se escala por el lado que antes se agota (ancho o alto)
    const k = vb?.width && vb?.height ? Math.min(r.width / vb.width, r.height / vb.height) : 0;
    if (k > 0) svg.style.setProperty('--k', k.toFixed(3));
    vigiaDibujos?.observe(svg);
  }
}

/**
 * Coloca los resultados en la rejilla de una pantalla (guía § 13): los avisos sueltos van juntos
 * en su franja, debajo del veredicto; una tarjeta sola ocupa el ancho de dibujo y resultados.
 */
function encajar(res) {
  const sueltos = [...res.children].filter((x) => x.classList.contains('aviso'));
  const av = h('div', { class: 'avisos' }, ...sueltos);
  const ver = res.querySelector(':scope > .veredicto');
  if (ver) ver.after(av); else res.prepend(av);
  for (const x of res.children) if (x.classList.contains('tarjeta')) x.classList.add('unica');
}

function pintar() {
  document.documentElement.lang = lenguaActual();
  pintarCabecera();
  const datos = $('datos');
  datos.replaceChildren();
  // Fila común encima de las tres columnas: qué objeto y qué vista (guía § 14, niveles 2 y 3)
  const cab = $('cabeza');
  cab.replaceChildren();
  const vista = VISTAS[estado.vista];
  cab.hidden = !vista.cabeza;
  if (vista.cabeza) {
    try { vista.cabeza(ctx, cab); } catch (e) { console.error(e); cab.append(aviso(tx(e), 'error')); }
  }
  try {
    VISTAS[estado.vista].datos(ctx, datos);
  } catch (e) {
    console.error(e);
    datos.append(aviso(tx(e), 'error'));
  }
  pintarResultados();
}

/** Al pasar el ratón por un elemento con data-ref se resalta a la vez en el dibujo, la tabla y los datos. */
function instalarFoco() {
  const foco = (ref, on) => document.querySelectorAll(`[data-ref="${ref}"]`).forEach((e) => e.classList.toggle('foco', on));
  const main = document.querySelector('main.trabajo');
  main.addEventListener('pointerover', (e) => { const x = e.target.closest('[data-ref]'); if (x) foco(x.dataset.ref, true); });
  main.addEventListener('pointerout', (e) => { const x = e.target.closest('[data-ref]'); if (x) foco(x.dataset.ref, false); });
}

/* ---------- comandos ---------- */

function comandos() {
  const lista = [
    { k: 'p.idioma', b: 'idioma language english español inglés', f: () => { ponerLengua(lenguaActual() === 'es' ? 'en' : 'es'); pintar(); } },
    { k: 'p.ec2004', b: 'norma code eurocódigo eurocode ec2 vigente anejo nacional', f: () => ponerNorma('EC2-2004') },
    { k: 'p.ehe', b: 'norma code ehe 08', f: () => ponerNorma('EHE-08') },
    { k: 'p.ec2', b: 'norma code eurocódigo eurocode ec2 2023', f: () => ponerNorma('EC2-2023') },
    { k: 'p.compacta', b: 'densidad density compacta compact', f: () => { delete document.documentElement.dataset.densidad; guardarPref('densidad', ''); } },
    { k: 'p.comoda', b: 'densidad density cómoda comfortable', f: () => { document.documentElement.dataset.densidad = 'comoda'; guardarPref('densidad', 'comoda'); } },
    { k: 'p.decimalPunto', b: 'decimal punto point excel copiar copy separador separator', f: () => { ponerDecimalAlCopiar('.'); avisar(t('p.decimalPuesto', '.')); } },
    { k: 'p.decimalComa', b: 'decimal coma comma excel copiar copy separador separator', f: () => { ponerDecimalAlCopiar(','); avisar(t('p.decimalPuesto', ',')); } },
    { k: 'p.serieCompleta', b: 'serie diametros diámetros armadura completa full bars 6 14 40', f: () => { ponerSerieDiametros('completa'); avisar(t('p.seriePuesta', 'completa')); pintar(); } },
    { k: 'p.seriePractica', b: 'serie diametros diámetros armadura practica práctica practical bars 8 10 12 16 20 25 32', f: () => { ponerSerieDiametros('practica'); avisar(t('p.seriePuesta', 'practica')); pintar(); } },
    { k: 'p.plegarDatos', b: 'plegar datos panel ocultar hide data ctrl b', f: () => plegarDatos() },
    { k: document.fullscreenElement ? 'p.salirCompleta' : 'p.completa', b: 'pantalla completa full screen fullscreen f11', f: pantallaCompleta },
    { k: 'p.deshacer', b: 'deshacer undo ctrl z', f: deshacer },
    ...ORDEN.map((v) => ({ texto: `${t('p.ir')} ${t(`m.${v}`)}`, b: `ir go ${v}`, f: () => ctx.ir(v) })),
  ];
  for (const v of Object.values(VISTAS)) lista.push(...(v.comandos?.(ctx) ?? []));
  return lista;
}

/** Pantalla completa (o salir). Si el navegador no lo deja, aviso de una línea que sugiere F11. */
function pantallaCompleta() {
  const p = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
  if (!p) { avisar(t('p.completaNo')); return; }
  p.catch(() => avisar(t('p.completaNo')));
}

function guardarPref(k, v) { try { localStorage.setItem(`prontuario-web:${k}`, v); } catch { /* sin almacenamiento */ } }
function leerPref(k) { try { return localStorage.getItem(`prontuario-web:${k}`); } catch { return null; } }

/* ---------- arranque ---------- */

export function iniciar() {
  ponerLengua(lenguaActual());
  const guardado = cargarLocal();
  estado.proyecto = guardado ?? proyectoNuevo(t('ejemploNombre'));
  estado.ejemplo = !guardado;
  ultimo = JSON.stringify(estado.proyecto);
  const v = leerPref('vista');
  if (VISTAS[v]) estado.vista = v;
  // La compacta es la normal (guía § 5); la cómoda es opcional
  if (leerPref('densidad') === 'comoda') document.documentElement.dataset.densidad = 'comoda';
  if (leerPref('datos') === 'plegado') document.documentElement.dataset.datos = 'plegado';
  comportamientoFormulario($('datos'));
  instalarFoco();
  instalarPaleta(comandos, avisar);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea')) { e.preventDefault(); deshacer(); }
    if (e.altKey && /^[1-9]$/.test(e.key) && ORDEN[+e.key - 1]) { e.preventDefault(); ctx.ir(ORDEN[+e.key - 1]); }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); plegarDatos(); }
  });
  pintar();
}

iniciar();
