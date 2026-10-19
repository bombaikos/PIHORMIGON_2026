// Pantalla de Secciones: equivale a ModuloSecciones (Unit4.pas) del Prontuario 3.1.
// Pestañas: Sección (materiales, geometría y armadura, con sus propiedades) y Diagramas M-κ.
// La durabilidad es un módulo aparte (vistas/durabilidad.js). En medio,
// el dibujo a escala; a la derecha, los resultados de la pestaña activa, recalculados con cada cambio.

import { NORMAS } from '../../norma/normas.js';
import { FORMAS, geometria, areaGrupo, recubrimientoMinimo, seccionMotor } from '../../core/geometria.js';
import { curvaMomentoCurvatura } from '../../core/momentoCurvatura.js';
import { esfuerzos, intervaloEpsSup, centroHomogeneizado } from '../../core/seccion.js';
import { leerSeccionDXF, dxfAGeometria } from '../../io/importDXF.js';
import { leerArmado, leerNumero, leerCapas, leerCara } from '../../core/armado.js';
import { cuantiaMinima } from '../../core/cuantiaMinima.js';
import { propiedades, fctmFlexotraccion } from '../../core/propiedades.js';
import { propiedadesHormigon, opcionesHormigon, caracteristico } from '../../core/materiales.js';
import { modulo } from '../../norma/index.js';
import { seccionNueva, materialesSeccion, normalizarCaras, sepCapas, geometriaDe } from '../../io/proyecto.js';
import { t, tx } from '../i18n.js';
import { eje, fmt, q, qh, ESP, MAG, armadoBonito, serieDiametros } from '../formato.js';
import { h, html, poner, campoNum, campoTexto, campoArmado, selector, grupo, par, boton, aviso, tabla, cifras, segmentado, filaCampos } from '../campos.js';
import { dibujoSeccion } from '../dibujoSeccion.js';
import { rejilla, celdaMm } from '../rejilla.js';
import { grafica } from '../grafica.js';

// Como en el Prontuario 3.1: se elige el tipo, luego la sección; los datos se editan en un
// borrador y solo pasan al proyecto con «Guardar cambios». Si se cambia el nombre, se crea
// una sección nueva. Hay un borrador por tipo, así que cambiar de tipo no pierde lo escrito.
const est = { forma: 'rectangular', pestana: 'seccion', b: {}, pendiente: null };

export function reiniciar(ctx) {
  est.forma = ctx?.p.secciones[0]?.forma ?? 'rectangular';
  est.b = {};
  est.pendiente = null;
}

/** Tras deshacer: los borradores sin cambios se recargan del proyecto. */
export function sincronizar() {
  for (const [f, b] of Object.entries(est.b)) if (!sucio(b)) delete est.b[f];
  est.pendiente = null;
}

const copia = (x) => JSON.parse(JSON.stringify(x));
const sucio = (b) => JSON.stringify(b.s) !== b.base;
const cargar = (s) => (est.b[s.forma] = { nombre: s.nombre, s: copia(s), base: JSON.stringify(s) });
function nueva(ctx, forma) {
  const p = ctx.p;
  const s = seccionNueva(nombreLibre(p.secciones, forma), forma, p.hormigones[0]?.nombre, p.aceros[0]?.nombre);
  return (est.b[forma] = { nombre: null, s, base: JSON.stringify(s) });
}
function borrador(ctx) {
  const b = est.b[est.forma];
  if (b && b.nombre !== null && !sucio(b)) {
    // Sin cambios propios: se sigue a la sección guardada (puede haberla tocado Flexión, deshacer…)
    const g = ctx.p.secciones.find((x) => x.nombre === b.nombre);
    if (g && JSON.stringify(g) !== b.base) return cargar(g);
  }
  if (b) return b;
  const s0 = ctx.p.secciones.find((x) => x.forma === est.forma);
  return s0 ? cargar(s0) : nueva(ctx, est.forma);
}
/** Ejecuta la acción, o la deja pendiente de confirmar si se perdería algo. */
function pedir(ctx, hayRiesgo, texto, accion) {
  if (!hayRiesgo) { est.pendiente = null; accion(); return; }
  est.pendiente = { texto, accion };
  ctx.pintar();
}

/** Qué pasará al guardar, para la nota bajo el nombre. */
function estadoBorrador(ctx, b) {
  const nombre = b.s.nombre.trim();
  const otra = ctx.p.secciones.find((x) => x.nombre === nombre);
  if (nombre !== b.nombre && otra) return { texto: t('sec.existe', nombre, t(`forma.${otra.forma}`)), clase: 'aviso', guardar: true };
  if (b.nombre === null) return { texto: t('sec.sinGuardar'), clase: 'pista', guardar: true };
  if (nombre !== b.nombre) return { texto: t('sec.seCrea', nombre, b.nombre), clase: 'pista', guardar: true };
  if (sucio(b)) return { texto: t('sec.cambios'), clase: 'pista', guardar: true };
  return { texto: t('sec.guardada'), clase: 'pista', guardar: false };
}

function guardar(ctx, b) {
  const S = ctx.p.secciones;
  const nombre = b.s.nombre.trim();
  if (!nombre) return ctx.avisar(t('sec.sinNombre'));
  b.s.nombre = nombre;
  const iDest = S.findIndex((x) => x.nombre === nombre);
  const hacer = () => {
    const c = copia(b.s);
    if (iDest >= 0) S[iDest] = c; else S.push(c);
    cargar(c);
    ctx.cambio({ estructura: true });
    ctx.avisar(t('sec.guardadaAviso', nombre));
  };
  pedir(ctx, iDest >= 0 && nombre !== b.nombre, t('sec.confirmaSustituir', nombre, t(`forma.${S[iDest]?.forma ?? b.s.forma}`)), hacer);
}

function borrar(ctx, b) {
  const S = ctx.p.secciones;
  const i = S.findIndex((x) => x.nombre === b.nombre);
  if (i < 0) return;
  S.splice(i, 1);
  const sig = S.find((x) => x.forma === est.forma);
  if (sig) cargar(sig); else nueva(ctx, est.forma);
  ctx.cambio({ estructura: true });
  ctx.avisar(t('sec.borradaAviso', b.nombre));
}

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const sup = (a) => `<sup>${a}</sup>`;
// Guía § 13: la unidad va en la cabecera (de la columna, o de la fila en las tablas de etiqueta y valor)
const U = (mag) => `\u00a0<span class="u u-cab">(${MAG[mag]?.ud ?? mag})</span>`;
const v = (x, mag) => q(x, mag, { ud: false });

/* ---------- utilidades ---------- */

const resumenForma = (s) => {
  const g = s.geo;
  const m = (x) => fmt(x * 1000, 0);
  switch (s.forma) {
    case 'rectangular':
    case 'pilar': return `${m(g.b)} × ${m(g.h)}`;
    case 'T': return `T ${m(g.b)} × ${m(g.h)}`;
    case 'circular': return `ø${m(g.D)}`;
    default: return t('forma.generica');
  }
};

/** Armado en una línea: «4D20 / 2D12» (inferior / superior) en vigas, «8ø16» en pilares. */
function resumenArmado(s) {
  const arm = s.armado ?? [];
  const cara = (c) => arm.find((g) => g.tipo === 'capa' && g.cara === c)?.texto?.trim() || '—';
  switch (s.forma) {
    case 'rectangular':
    case 'T': return `${cara('inf')} / ${cara('sup')}`;
    case 'pilar': {
      const g = arm.find((x) => x.tipo === 'perimetral');
      return g ? `${2 * g.nx + 2 * Math.max(g.ny - 2, 0)}ø${g.fi}` : '';
    }
    case 'circular': return arm.find((g) => g.tipo === 'anillo')?.texto ?? '';
    default: return arm.flatMap((g) => (g.textos ?? []).filter((x) => x?.trim())).join(' + ');
  }
}

/** Línea de resumen del tarjetón: «300 × 500 mm · HA-25 · 4D20 / 2D12». */
function resumenSeccion(s) {
  let dim = resumenForma(s);
  if (s.forma === 'generica') {
    const c = s.geo.contorno ?? [];
    const ext = (k) => (c.length ? Math.max(...c.map((q) => q[k])) - Math.min(...c.map((q) => q[k])) : 0);
    dim = `${fmt(ext(0) * 1000, 0)} × ${fmt(ext(1) * 1000, 0)}`;
  }
  // En la genérica la armadura (por caras) es larga: solo dimensiones generales y hormigón
  return [`${dim} mm`, s.hormigon, s.forma === 'generica' ? '' : resumenArmado(s)].filter(Boolean).join(' · ');
}

/** Tarjetón de la sección activa (guía § 14.8): tipo, nombre en grande y resumen. */
function tarjeton(s) {
  return h('div', { class: 'tarjeton', 'aria-live': 'polite' },
    h('div', { class: 't-tipo', html: `${icono(s.forma)}${t('forma.' + s.forma)}` }),
    h('div', { class: 't-nom' }, s.nombre),
    h('div', { class: 't-res', id: 's-resumen' }, resumenSeccion(s)));
}

function nombreGrupo(s, i) {
  const g = s.armado[i];
  if (g.tipo === 'capa') return i < 2 ? (g.cara === 'inf' ? t('arm.inf') : t('arm.sup')) : `${t('arm.importado')} ${i - 1}`;
  return g.tipo === 'anillo' ? t('arm.anillo') : g.tipo === 'perimetral' ? t('arm.perimetral') : t('arm.puntual');
}

/* ---------- panel de datos ---------- */

export function datos(ctx, form) {
  const p = ctx.p;
  const S = p.secciones;
  const b = borrador(ctx);
  const s = b.s;
  const e = estadoBorrador(ctx, b);
  const bGuardar = boton(t('sec.guardar'), () => guardar(ctx, b), e.guardar ? '' : 'secundario');
  bGuardar.id = 's-guardar';
  const bBorrar = boton(t('sec.borrar'), () => borrar(ctx, b), 'peligro');
  bBorrar.disabled = b.nombre === null;

  // La sección se elige arriba (cabeza); aquí solo el nombre, que al cambiarlo crea otra
  // Bajo el tarjetón, sin título propio: nombre y materiales
  const identidad = grupo(null,
    campoTexto({ id: 's-nombre', etq: t('nombre'), valor: s.nombre, onCambio: (v) => { s.nombre = v.trim() || s.nombre; ctx.pintar(); } }),
    ...materiales(ctx, s));
  // En Diagramas no se edita nada de la sección: nombre y materiales son de solo lectura y no hay botones
  const soloVer = est.pestana === 'mk';
  if (soloVer) {
    identidad.classList.add('fijo');
    identidad.querySelectorAll('input, select').forEach((c) => { c.disabled = true; c.tabIndex = -1; });
  }
  poner(form, tarjeton(s), identidad);
  // Al final, tras los datos de la pestaña: estado del borrador, confirmación y botones
  const pie = h('div', { class: 'pie-sec' },
    soloVer ? null : h('p', { id: 's-estado', class: e.clase, html: e.texto, hidden: !!est.pendiente }),
    !soloVer && est.pendiente ? h('div', { class: 'aviso confirma' }, h('span', { html: est.pendiente.texto }),
      h('div', { class: 'fila-botones' },
        boton(t('continuar'), () => { const a = est.pendiente.accion; est.pendiente = null; a(); }, 'peligro'),
        boton(t('cancelar'), () => { est.pendiente = null; ctx.pintar(); }, 'discreto'))) : null,
    soloVer ? null : h('div', { class: 'fila-botones' }, bGuardar, bBorrar));

  const cambio = () => ctx.cambio();
  // Pestañas antiguas: Propiedades se unió a Sección y Durabilidad es ahora un módulo propio
  if (est.pestana === 'propiedades' || est.pestana === 'durabilidad') est.pestana = 'seccion';
  switch (est.pestana) {
    case 'mk': datosMk(ctx, form, s, cambio); break;
    default: datosSeccion(ctx, form, s, cambio);
  }
  poner(form, pie);
  // La confirmación queda abajo: se trae a la vista aunque se pidiera desde el selector de arriba
  if (est.pendiente) queueMicrotask(() => pie.querySelector('.confirma')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

/* ---------- cabeza: qué sección y qué vista (guía § 14) ---------- */

const ICONOS = {
  rectangular: '<rect x="4" y="2" width="8" height="12"/><circle cx="6" cy="12" r=".8"/><circle cx="10" cy="12" r=".8"/>',
  pilar: '<rect x="3" y="3" width="10" height="10"/><circle cx="5" cy="5" r=".8"/><circle cx="11" cy="5" r=".8"/><circle cx="5" cy="11" r=".8"/><circle cx="11" cy="11" r=".8"/>',
  T: '<path d="M2 3h12v3H10v8H6V6H2z"/>',
  circular: '<circle cx="8" cy="8" r="6"/>',
  generica: '<path d="M2 13 4 3h8l2 10z"/>',
};
const icono = (f) => `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">${ICONOS[f]}</svg>`;
let abierto = null; // tipo cuyo desplegable está abierto

/** Elige una sección guardada (o una nueva) de un tipo, avisando si se pierde un borrador. */
function elegir(ctx, forma, nombre) {
  const b = est.b[forma];
  abierto = null;
  pedir(ctx, b && sucio(b) && b.nombre !== nombre, t('sec.confirmaDescartar', b?.nombre ?? b?.s.nombre), () => {
    est.forma = forma;
    if (nombre === null) nueva(ctx, forma);
    else if (!b || b.nombre !== nombre) cargar(ctx.p.secciones.find((x) => x.nombre === nombre));
    ctx.pintar();
  });
  if (est.pendiente) { est.forma = forma; ctx.pintar(); }
}

/**
 * Fila fija de cinco desplegables, uno por tipo, con el nombre del tipo siempre escrito, el
 * número de secciones y un icono de apoyo; el activo, en azul y con la sección («Rec viga · V-1»).
 * Debajo, las pestañas de vista. Al final de la fila, «+ Nueva» crea una del tipo activo.
 */
export function cabeza(ctx, el) {
  ctxCab = ctx;
  const S = ctx.p.secciones;
  const actual = borrador(ctx);
  const fila = h('div', { class: 'selsec', role: 'group', 'aria-label': t('seccion') });
  for (const f of FORMAS) {
    const delTipo = S.filter((x) => x.forma === f);
    const act = f === est.forma;
    const caja = h('div', { class: `desp${act ? ' activo' : ''}` });
    const titulo = act ? `${t(`forma.${f}`)}<span class="sep">·</span><b>${actual.s.nombre}</b>` : t(`forma.${f}`);
    const bt = h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': String(abierto === f), title: t(`forma.${f}`),
      html: `${icono(f)}<span class="nom">${titulo}</span><span class="cnt">${delTipo.length}</span><span class="car">▾</span>`,
      onclick: (e) => { e.stopPropagation(); abierto = abierto === f ? null : f; ctx.pintar(); } });
    caja.append(bt);
    if (abierto === f) caja.append(listaSecciones(ctx, f, delTipo, act ? actual.nombre : undefined));
    fila.append(caja);
  }
  fila.append(h('button', { type: 'button', class: 'mas', title: t('sec.nuevaDe', t(`forma.${est.forma}`)), onclick: () => elegir(ctx, est.forma, null) }, `+ ${t('sec.nueva')}`));
  el.append(fila);
}

/**
 * El mismo selector de secciones para otros módulos (Cortante): un desplegable por tipo de la lista `formas`,
 * con la sección activa `activa` (objeto de la sección) en el tipo que le corresponde; sin «+ Nueva».
 */
export function selectorSecciones(ctx, el, { formas, activa, alElegir }) {
  ctxCab = ctx;
  const fila = h('div', { class: 'selsec', role: 'group', 'aria-label': t('seccion') });
  for (const f of formas) {
    const delTipo = ctx.p.secciones.filter((x) => x.forma === f);
    const act = activa?.forma === f;
    const titulo = act ? `${t(`forma.${f}`)}<span class="sep">·</span><b>${activa.nombre}</b>` : t(`forma.${f}`);
    const caja = h('div', { class: `desp${act ? ' activo' : ''}` },
      h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': String(abierto === f), title: t(`forma.${f}`),
        html: `${icono(f)}<span class="nom">${titulo}</span><span class="cnt">${delTipo.length}</span><span class="car">▾</span>`,
        onclick: (e) => { e.stopPropagation(); abierto = abierto === f ? null : f; ctx.pintar(); } }));
    if (abierto === f) caja.append(listaSecciones(ctx, f, delTipo, act ? activa.nombre : undefined, (n) => { abierto = null; alElegir(n); }, false));
    fila.append(caja);
  }
  el.append(fila);
}

/**
 * Qué muestra el módulo: 'seccion' (Crear y editar) o 'mk' (Diagramas). Son dos entradas del
 * menú Secciones que comparten la sección activa; app.js lo fija antes de pintar cada una.
 */
export function modo(k) { est.pestana = k; }

/** Lista del desplegable: 10 a la vista con scroll, buscador a partir de 9 y «+ Nueva …» fija al pie. */
function listaSecciones(ctx, f, delTipo, activa, alElegir = (nombre) => elegir(ctx, f, nombre), conAlta = true) {
  const m = h('div', { class: 'menu-sec', role: 'listbox', onclick: (e) => e.stopPropagation() });
  const filas = h('div', { class: 'filas' });
  const q = delTipo.length > 8 ? h('input', { class: 'buscar', placeholder: t('sec.buscarEntre', delTipo.length), autocomplete: 'off' }) : null;
  const llenar = () => {
    const x = (q?.value ?? '').trim().toLowerCase();
    filas.replaceChildren(...delTipo.filter((s) => !x || s.nombre.toLowerCase().includes(x)).map((s) => h('button', {
      type: 'button', role: 'option', 'aria-current': s.nombre === activa ? 'true' : undefined,
      html: `${icono(f)}${s.nombre}<span class="nombre-sec">${resumenForma(s)}</span>`,
      onclick: () => alElegir(s.nombre) })));
    if (!filas.children.length) filas.append(h('span', { class: 'vacio' }, delTipo.length ? t('sec.ningunaCoincide') : t('sec.ningunaTipo')));
  };
  llenar();
  if (q) {
    q.addEventListener('input', llenar);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); filas.querySelector('button')?.click(); } });
    m.append(q);
    queueMicrotask(() => q.focus());
  }
  m.append(filas);
  if (conAlta) m.append(h('button', { type: 'button', class: 'alta', onclick: () => alElegir(null) }, `+ ${t('sec.nuevaDe', t(`forma.${f}`))}`));
  queueMicrotask(() => filas.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }));
  return m;
}

// Un clic fuera o Escape cierran el desplegable
let ctxCab = null;
const cerrar = () => { if (abierto) { abierto = null; ctxCab?.pintar(); } };
if (typeof document !== 'undefined') {
  document.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

function nombreLibre(S, forma) {
  const base = { rectangular: 'V', pilar: 'P', T: 'T', circular: 'C', generica: 'G' }[forma];
  let k = S.length + 1;
  while (S.some((x) => x.nombre === `${base}${k}`)) k++;
  return `${base}${k}`;
}

/** Pestaña Sección: materiales, geometría y armadura, en ese orden. */
/** Hormigón y acero de la sección, en el grupo del nombre. */
function materiales(ctx, s) {
  const p = ctx.p;
  return [filaCampos(
    selector({ id: 's-hor', etq: t('hormigon'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: s.hormigon, onCambio: (v) => { s.hormigon = v; ctx.cambio(); } }),
    selector({ id: 's-ace', etq: t('acero'), opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: s.acero, onCambio: (v) => { s.acero = v; ctx.cambio(); } }))];
}

function datosSeccion(ctx, form, s, cambio) {
  const p = ctx.p;
  const g = s.geo;
  const nk = campoNum({ id: 'p-n', etq: sub('N', 'k'), ref: t('prop.compPositiva'), valor: s.Nfis ?? 0, mag: 'N', paso: 10, min: -1e5, max: 1e5, onCambio: (v) => { s.Nfis = v; cambio(); } });
  const L = (id, etq, k, { min = 0.02, max = 10, paso = 10 } = {}) => campoNum({ id, etq, valor: g[k], mag: 'long', paso, min, max, onCambio: (v) => { g[k] = v; cambio(); } });
  const campos = {
    rectangular: () => [par(L('g-b', 'b', 'b'), L('g-h', 'h', 'h'))],
    pilar: () => [par(L('g-b', 'b', 'b'), L('g-h', 'h', 'h'))],
    T: () => [par(L('g-b', `b ${t('geo.ala')}`, 'b'), L('g-h', 'h', 'h')), par(L('g-bw', sub('b', 'w'), 'bw'), L('g-hf', sub('h', 'f'), 'hf'))],
    circular: () => [par(L('g-D', 'D', 'D'))],
    generica: () => {
      // Una rejilla con los vértices y la armadura de la cara que sale de cada uno
      const caras = carasDe(s);
      const validarCara = (v) => {
        const r = leerCara(v);
        return !r ? t('err.armado') : r.error ? t(r.error) : null;
      };
      return [
        zonaDXF(ctx, s),
        h('p', { class: 'etq-rejilla', html: t('geo.contornoCaras') }),
        rejilla({
          id: 'g-cont', altoMax: 210,
          columnas: [{ titulo: 'x (mm)', num: true }, { titulo: 'y (mm)', num: true }, { titulo: t('geo.colArmado'), validar: validarCara }],
          filas: g.contorno.map(([x, y], i) => [celdaMm(x), celdaMm(y), caras.textos[i] ?? '']),
          refFila: (i) => `c${i}`,
          numerar: true,
          // Longitud de la cara que sale de cada vértice (hasta el siguiente, y el último cierra con el primero)
          calculada: { titulo: 'L (mm)', f: (d, i) => {
            const a = d[i];
            const z = d[(i + 1) % d.length];
            const L = Math.hypot(leerNumero(z[0]) - leerNumero(a[0]), leerNumero(z[1]) - leerNumero(a[1]));
            return Number.isFinite(L) ? fmt(L, 0) : '';
          } },
          onCambio: (f) => {
            g.contorno = f.map((r) => [leerNumero(r[0]) / 1000, leerNumero(r[1]) / 1000]);
            caras.textos = f.map((r) => r[2]);
            cambio();
          },
        }),
        // El hueco es raro: va plegado (el resumen dice si ya hay) para dejar alto al contorno
        h('details', { class: 'nota-plegada' }, h('summary', {}, g.huecos?.length ? t('geo.huecoN', g.huecos.length, g.huecos.reduce((n, q) => n + q.length, 0)) : t('geo.huecoOpc')),
        rejilla({
          id: 'g-hueco', altoMax: 80,
          columnas: [{ titulo: 'x (mm)', num: true }, { titulo: 'y (mm)', num: true }],
          filas: (g.huecos?.[0] ?? []).map(([x, y]) => [celdaMm(x), celdaMm(y)]),
          onCambio: (f) => { g.huecos = f.length ? [f.map((r) => [leerNumero(r[0]) / 1000, leerNumero(r[1]) / 1000])] : []; cambio(); },
        })),
        h('p', { class: 'pista', html: t('geo.pistaRejilla') }),
      ];
    },
  };
  poner(form,
    grupo(t('sec.geometria'), ...campos[s.forma]()),
    // En la genérica la rejilla necesita el alto: el axil de fisuración va en la fila de d
    s.forma === 'generica'
      ? grupo(t('sec.armaduraFis'), ...armadura(ctx, s, cambio, nk))
      : grupo(t('sec.armaduraFis'), ...armadura(ctx, s, cambio), nk),
  );
}

/**
 * Zona para cargar un .dxf: se arrastra encima o se pulsa. El contorno (capa 0) y los huecos
 * sustituyen a los de la sección; las armaduras por caras se borran porque ya no casan con los vértices.
 */
function zonaDXF(ctx, s) {
  // El resultado va dentro de la zona, en lugar de su texto: el panel va justo de alto
  const msg = h('span', { class: 'zona-txt', id: 'g-dxf-msg', role: 'status', html: t('dxf.zona') });
  const decir = (texto, error) => { msg.textContent = texto; msg.className = `zona-txt${error ? ' mal' : ' ok'}`; };
  // El resultado se dice una vez: al repintar vuelve el texto de la zona
  const dicho = est.dxfMsg; est.dxfMsg = null;
  if (dicho) decir(dicho.texto, dicho.error);
  const cargarArchivo = async (f) => {
    if (!f) return;
    if (!/\.dxf$/i.test(f.name)) return decir(t('dxf.noEsDxf', f.name), true);
    try {
      const geo = dxfAGeometria(leerSeccionDXF(await f.text()));
      s.geo.contorno = geo.contorno;
      s.geo.huecos = geo.huecos;
      const caras = carasDe(s);
      caras.textos = [];
      est.dxfMsg = { texto: t('dxf.cargado', f.name, geo.contorno.length, geo.huecos.length) };
      ctx.cambio({ estructura: true });
    } catch (e) { decir(tx(e), true); }
  };
  const entrada = h('input', { type: 'file', accept: '.dxf', hidden: true, onchange: (e) => { cargarArchivo(e.target.files[0]); e.target.value = ''; } });
  const zona = h('div', { class: 'zona-dxf', tabindex: 0, role: 'button', 'aria-label': t('dxf.cargar'),
    onclick: () => entrada.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } },
    ondragover: (e) => { e.preventDefault(); zona.classList.add('encima'); },
    ondragleave: () => zona.classList.remove('encima'),
    ondrop: (e) => { e.preventDefault(); zona.classList.remove('encima'); cargarArchivo(e.dataTransfer.files[0]); } },
    msg,
    h('span', { class: 'info-i', tabindex: 0, role: 'img', 'aria-label': t('dxf.ayuda'), 'data-tip': t('dxf.ayuda'), onclick: (e) => e.stopPropagation() }, 'i'),
    entrada);
  return zona;
}

/** Armadura: dos filas (cara superior e inferior) en rectangulares y T; una sola capa en las demás. */
function armadura(ctx, s, cambio, extra = null) {
  const fila = (arm, d) => h('div', { class: 'fila-arm' }, arm, d);
  const dist = (id, etq, g, k) => campoNum({ id, etq, valor: g[k], mag: 'long', paso: 5, min: 0.005, max: 1, onCambio: (v) => { g[k] = v; cambio(); } });
  if (s.forma === 'rectangular' || s.forma === 'T') {
    normalizarCaras(s, sepCapas(ctx.p));
    const [sup, inf, ...resto] = s.armado;
    const cara = (g, i, As, d, nombre) => fila(
      campoArmado({ id: `a-${i}`, etq: `${nombre} · ${sub('A', As)}`, texto: g.texto, capas: {}, onCambio: (v) => { g.texto = v; cambio(); } }),
      dist(`a-${i}-d`, sub('d', d), g, 'd'));
    return [
      h('div', { 'data-ref': 'g0' }, cara(sup, 0, 's2', '2', t('arm.sup'))),
      h('div', { 'data-ref': 'g1' }, cara(inf, 1, 's1', '1', t('arm.inf'))),
      resto.length ? h('div', { class: 'aviso info' }, h('span', { html: t('arm.extra', resto.length) }), ' ',
        boton(t('arm.quitarExtra'), () => { s.armado.splice(2); ctx.cambio({ estructura: true }); }, 'discreto')) : null,
    ];
  }
  if (s.forma === 'pilar') {
    // Como el 3.1: barras por cara horizontal y vertical (las esquinas cuentan en las dos) y un solo diámetro
    const g = s.armado.find((x) => x.tipo === 'perimetral') ?? { tipo: 'perimetral', nx: 3, ny: 3, fi: 16, d: 0.05 };
    s.armado = [g];
    const N = (id, etq, k) => campoNum({ id, etq, ref: t('arm.conEsquinas'), valor: g[k], mag: 'n', paso: 1, min: 2, max: 40, onCambio: (v) => { g[k] = Math.round(v); cambio(); } });
    return [
      N('a-nx', t('arm.nHoriz'), 'nx'),
      N('a-ny', t('arm.nVert'), 'ny'),
      // El área total de las barras va en gris dentro de la caja del diámetro
      par(selector({ id: 'a-fi', etq: 'ø', nota: ecoPilar(g), opciones: [...new Set([...serieDiametros(), g.fi])].sort((a, b) => a - b).map((d) => [String(d), `ø${d}`]), valor: String(g.fi), onCambio: (v) => { g.fi = Number(v); cambio(); } }),
        dist('a-0-d', 'd', g, 'd')),
    ];
  }
  if (s.forma === 'circular') {
    const g = (s.armado[0] ??= { tipo: 'anillo', texto: '', r: 0.05 });
    s.armado.splice(1);
    return [
      fila(campoArmado({ id: 'a-0', etq: sub('A', 's'), texto: g.texto, capas: { maxCapas: 1 }, soloBarras: true, onCambio: (v) => { g.texto = v; cambio(); } }),
        dist('a-0-d', 'd', g, 'r')),
    ];
  }
  // Genérica: la armadura de cada cara va en la rejilla del contorno; aquí solo la distancia d
  const caras = carasDe(s);
  const resto = s.armado.filter((g) => g !== caras);
  return [
    par(dist('a-0-d', 'd', caras, 'd'), extra),
    resto.length ? h('div', { class: 'aviso info' }, h('span', { html: t('arm.extraGen', resto.reduce((n, g) => n + (g.barras?.length ?? 0), 0)) }), ' ',
      boton(t('arm.quitarExtra'), () => { s.armado = [caras]; ctx.cambio({ estructura: true }); }, 'discreto')) : null,
  ];
}

/** Área total de las barras del pilar, «2413 mm²» (las esquinas una sola vez). */
function ecoPilar(g) {
  const n = 2 * g.nx + 2 * Math.max(0, g.ny - 2);
  return `${fmt((n * Math.PI * g.fi ** 2) / 4, 0)}\u00a0mm²`;
}

/** Grupo de armadura por caras de una sección genérica (se crea vacío si no hay). */
function carasDe(s) {
  let g = s.armado.find((x) => x.tipo === 'caras');
  if (!g) { g = { tipo: 'caras', d: 0.04, textos: [] }; s.armado.unshift(g); }
  return g;
}

function datosMk(ctx, form, s, cambio) {
  const Nu = axilUltimo(ctx, s);
  const cfg = configMk(s, Nu);
  const filas = cfg.axiles.map((a, i) => {
    const c = campoNum({ id: `mk-n${i}`, etq: sub('N', String(i + 1)), valor: a.N, mag: 'N', paso: 10, min: -1e6, max: 1e6,
      onCambio: (v) => { fijarAxiles(s, cfg); s.mk.axiles[i].N = v; cambio(); } });
    // Casilla de representar o no, delante de la etiqueta (como en el 3.1)
    const casilla = h('input', { type: 'checkbox', class: 'ver-axil', checked: a.ver, 'aria-label': t('mk.representar'),
      onchange: (e) => { fijarAxiles(s, cfg); s.mk.axiles[i].ver = e.target.checked; cambio(); } });
    c.prepend(casilla);
    c.classList.add(`axil-${i + 1}`);
    return c;
  });
  poner(form,
    grupo(t('mk.diagrama'), segmentado({
      etiqueta: t('mk.diagrama'), ancho: true,
      opciones: [['mk', 'M–κ'], ['ei', `EI/EI<sub>b</sub>–M`]],
      valor: cfg.vista,
      onCambio: (v) => { s.mk = { ...(s.mk ?? {}), vista: v }; ctx.pintar(); },
    })),
    grupo(`${t('mk.axiles')} <span class="leyenda-nota">${t('prop.compPositiva')}</span>`, ...filas,
      h('p', { class: 'pista', html: Number.isFinite(Nu) ? t('mk.pistaNu', fmt(Nu, 0)) : t('mk.pistaSinNu') }),
      s.mk?.axiles ? boton(t('mk.porDefecto'), () => { s.mk = { ...s.mk, axiles: null }; ctx.pintar(); }, 'discreto') : null));
}


/* ---------- resultados ---------- */

export function resultados(ctx, res) {
  const p = ctx.p;
  const b = borrador(ctx);
  const s = b.s;
  const geo = geometriaDe(p, s);
  // El panel de datos no se repinta al escribir: se actualiza aquí el estado del borrador
  const e = estadoBorrador(ctx, b);
  const nota = document.getElementById('s-estado');
  if (nota) { nota.className = e.clase; nota.innerHTML = e.texto; }
  const eco = document.getElementById('a-fi-nota');
  if (eco && s.forma === 'pilar' && s.armado[0]) eco.innerHTML = ecoPilar(s.armado[0]);
  const resumen = document.getElementById('s-resumen');
  if (resumen) resumen.textContent = resumenSeccion(s);
  const bg = document.getElementById('s-guardar');
  if (bg) bg.className = `boton ${e.guardar ? '' : 'secundario'}`;
  const errores = geo.errores.map(tx);
  if (geo.barras.some((b) => b.y < geo.caja.ymin || b.y > geo.caja.ymax)) errores.push(t('err.barraFuera'));

  // Tarjeta del dibujo, común a todas las pestañas
  const AsTot = [...geo.barras, ...geo.franjas].reduce((a, b) => a + b.A, 0);
  let mats = null;
  try { mats = materialesSeccion(p, s); } catch (e) { errores.push(tx(e)); }
  let props = null;
  let excedeAxil = false;
  if (mats) {
    const fck = mats.fichaH.fck;
    const qh0 = propiedadesHormigon(fck, p.norma, opcionesHormigon(mats.fichaH, p.norma));
    // Lo primero, que el axil sea admisible: |N_k| < 0,95·N_Rd (compresión) o 0,95·A_s·f_yd (tracción)
    const Nk = s.Nfis ?? 0;
    if (est.pestana === 'seccion' && Nk !== 0 && !errores.length && geo.barras.length + geo.franjas.length) {
      const R = axilResistente(geo, mats);
      const lim = Nk > 0 ? R.comp : R.tracc;
      if (Number.isFinite(lim) && Math.abs(Nk) > 0.95 * lim) {
        excedeAxil = true;
        errores.push(t(Nk > 0 ? 'prop.axilExcedeC' : 'prop.axilExcedeT', fmt(Math.abs(Nk), 0), fmt(0.95 * lim, 0)));
      }
    }
    props = propiedades(geo, { Ec: mats.hormigon.E, Es: mats.acero.E, fctm: fctmFlexotraccion(qh0.fctm, geo.h) * 1000 }, excedeAxil ? 0 : -(s.Nfis ?? 0));
  }
  const ac = props?.bruta.A;
  const cfgMk = est.pestana === 'mk' ? configMk(s, axilUltimo(ctx, s)) : null;
  const mk = cfgMk && mats && !errores.length && geo.barras.length + geo.franjas.length
    ? curvasMk(p, s, geo, mats, cfgMk.axiles.map((a) => a.N)).map((c, i) => ({ ...c, ver: cfgMk.axiles[i].ver })) : null;

  poner(res, ...errores.map((e) => aviso(e, 'error')), ...(geo.avisos ?? []).map((a) => aviso(tx(a))));
  const dib = h('article', { class: 'panel tarjeta' },
    h('h2', {}, s.nombre),
    h('p', { class: 'sub' }, `${t(`forma.${s.forma}`)} · ${s.hormigon ?? '—'} · ${s.acero ?? '—'}`),
    ...(est.pestana === 'mk'
      ? [h('div', { class: 'lienzo' }, mk && props ? graficaMk(ctx, s, mk, cfgMk.vista, props, mats) : null)]
      : [h('div', { class: 'lienzo', html: dibujoSeccion(geo, s, { x: est.pestana === 'seccion' && !excedeAxil ? props?.fisurada.positivo.x : null }) }),
        leyenda(est.pestana === 'seccion')]),
    cifras([
      [sub('A', 'c'), qh(ac, 'Ac')],
      [sub('A', 's'), qh(AsTot, 'As')],
      ...cuantias(s, geo, ac).map(([e, r]) => [e, Number.isFinite(r) ? `${fmt(r * 1000, 2)}<span class="u">${ESP}‰</span>` : '—']),
      ...(esViga(s) ? [] : [[t('prop.barras'), String(geo.barras.length)]]),
    ]));
  const cuerpo = h('div', { class: 'cuerpo' }, dib);
  const tarjeta = h('article', { class: 'panel tarjeta' });
  cuerpo.append(tarjeta);

  switch (est.pestana) {
    case 'mk': resultadosMk(ctx, s, geo, mk, tarjeta); break;
    default: resultadosPropiedades(ctx, s, excedeAxil ? null : props, mats, tarjeta); resultadosArmado(ctx, s, geo, ac, tarjeta, excedeAxil ? null : props, mats);
  }
  res.append(cuerpo);
}

function leyenda(conCompresion) {
  const it = (estilo, k) => h('span', {}, h('i', { style: estilo }), h('span', {}, t(k)));
  return h('div', { class: 'leyenda' },
    it('background:var(--hormigon);border:1px solid var(--hormigon-borde)', 'l.hormigon'),
    conCompresion ? it('background:repeating-linear-gradient(45deg, var(--compr) 0 1px, transparent 1px 4px);border:1px solid var(--compr)', 'l.comprimida') : null,
    it('background:var(--acero);border-radius:50%', 'l.acero'));
}

function resultadosArmado(ctx, s, geo, ac, tarjeta, props, mats) {
  const sep = sepCapas(ctx.p);
  const filas = [];
  s.armado.forEach((g, i) => {
    if (g.tipo === 'capa') {
      const r = leerCapas(g.texto);
      (r?.capas ?? []).forEach((c, k) => {
        const f = [`${nombreGrupo(s, i)}${r.capas.length > 1 ? ` · ${t('arm.capaN', k + 1)}` : ''}`,
          c.n ? `${c.n}ø${c.fi}` : t('arm.soloArea'),
          `${g.cara === 'inf' ? sub('d', '1') : sub('d', '2')}${k ? ` + ${k > 1 ? `${k}·` : ''}${fmt(sep * 1000, 0)}` : ''} = ${v(g.d + k * sep, 'long')}`,
          v(c.A * 1e-6, 'As')];
        f.ref = `g${i}`;
        filas.push(f);
      });
      return;
    }
    if (g.tipo === 'caras') {
      (g.textos ?? []).forEach((txt, k) => {
        const bs = geo.barras.filter((b) => b.grupo === i && b.cara === k);
        if (!String(txt ?? '').trim()) return;
        const c = leerCara(txt);
        const f = [t('geo.caraN', k + 1), c?.sep ? `${bs.length}ø${c.fi}` : armadoBonito(leerArmado(txt)) || '—', `d = ${v(g.d, 'long')}`, v(bs.reduce((a, b) => a + b.A, 0), 'As')];
        f.ref = `c${k}`;
        filas.push(f);
      });
      return;
    }
    if (g.tipo === 'perimetral') {
      const bs = geo.barras.filter((b) => b.grupo === i);
      const fila = (etq, cara) => {
        const n = bs.filter((b) => cara.includes(b.cara)).length;
        if (!n) return;
        const f = [etq, `${n}ø${g.fi}`, `d = ${v(g.d, 'long')}`, v(n * Math.PI * (g.fi / 1000) ** 2 / 4, 'As')];
        f.ref = `g${i}`;
        filas.push(f);
      };
      fila(t('arm.carasHoriz'), ['sup', 'inf']);
      fila(t('arm.carasLat'), ['lat']);
      return;
    }
    const f = [nombreGrupo(s, i), g.tipo === 'puntual' ? `${g.barras.length} ${t('arm.barras')}` : armadoBonito(leerArmado(g.texto)) || '—',
      g.tipo === 'anillo' ? `d = ${v(g.r, 'long')}` : '—', v(areaGrupo(geo, i), 'As')];
    f.ref = `g${i}`;
    filas.push(f);
  });
  const tot = [...geo.barras, ...geo.franjas].reduce((a, b) => a + b.A, 0);
  tarjeta.append(h('h2', { style: 'margin-top:14px' }, t('sec.armadura')),
    ...(s.forma === 'generica' ? [aviso(t('cmin.generica'), 'info')] : []),
    filas.length ? tabla([...filas, [`<b>${t('total')}</b>`, '', '', `<b>${v(tot, 'As')}</b>`]], { cabecera: [t('arm.grupo'), t('arm.armadura'), t('arm.posicion') + U('long'), t('area') + U('As')] }) : aviso(t('arm.ninguna'), 'info'),
    ...cuantiaMinimaUI(ctx, s, geo, props, mats, tot));
}

/**
 * Cuantía mínima mecánica frente a la armadura dispuesta. Vigas (rectangular y T): flexión simple, con la
 * cara inferior para M+ y la superior para M−; pilares y circulares: pilar; genérica: solo se avisa.
 */
function cuantiaMinimaUI(ctx, s, geo, props, mats, tot) {
  if (s.forma === 'generica') return [];
  if (!props || !mats) return [];
  const p = ctx.p;
  const q = propiedadesHormigon(mats.fichaH.fck, p.norma, opcionesHormigon(mats.fichaH, p.norma));
  const viga = esViga(s);
  const r = cuantiaMinima({ norma: p.norma, tipo: viga ? 'viga' : 'pilar', h: props.h, Ac: props.bruta.A, yg: props.bruta.yg, Ix: props.bruta.Ix,
    fctm: q.fctm * 1000, fyk: mats.acero.fk, gammaS: mats.acero.gamma, N: s.Nfis ?? 0 });
  const ref = NORMAS[p.norma].ref;
  const area = (pred) => [...geo.barras, ...geo.franjas].filter(pred).reduce((a, b) => a + b.A, 0);
  const cara = (c) => (b) => s.armado[b.grupo]?.tipo === 'capa' && s.armado[b.grupo].cara === c;
  const fila = (etq, As, Amin) => [etq, v(As, 'As'), As + 1e-12 >= Amin ? v(Amin, 'As') : `<span class="mal">${v(Amin, 'As')}</span>`];
  const art = p.norma === 'EHE-08' ? '42.3.2' : p.norma === 'EC2-2004' ? 'AN 9.2.1.1(1)' : '12.2(2)';
  const fct = sub('f', 'ct,m,fl');
  let filas;
  let cuentas;
  if (viga) {
    const dd = p.norma === 'EC2-2023';
    const expr = dd ? `${sub('A', 's,min')} = ${sub('f', 'ct,m')}·W / (z·${sub('f', 'yk')})` : `${sub('A', 's,min')} = ${fct}·W / (z·${sub('f', 'yd')})`;
    const cuenta = (etq, W, Amin) => `<span class="f">${expr}</span><span class="n">${etq}: W = ${q4(W)} m³ · z ≈ 0,8h = ${v(r.z, 'long')} · ${dd ? sub('f', 'ct,m') : fct} = ${fmt(r.fct / 1000, 2)} MPa · ${dd ? sub('f', 'yk') : sub('f', 'yd')} = ${fmt(r.f / 1000, 0)} MPa → ${v(Amin, 'As')}</span><span class="art">${ref} · ${art}</span>`;
    filas = [fila(`${t('cmin.inf')} <span class="nota">M+</span>`, area(cara('inf')), r.inf.A), fila(`${t('cmin.sup')} <span class="nota">M−</span>`, area(cara('sup')), r.sup.A)];
    cuentas = [cuenta(t('cmin.inf'), r.inf.W, r.inf.A), cuenta(t('cmin.sup'), r.sup.W, r.sup.A)];
  } else {
    filas = [fila(t('cmin.total'), tot, r.A)];
    const art2 = p.norma === 'EHE-08' ? '42.3.3 y tabla 42.3.5' : p.norma === 'EC2-2004' ? '9.5.2(2)' : 'tabla 12.3';
    cuentas = [`<span class="f">${sub('A', 's,min')} = máx{0,10·N/${sub('f', 'yd')}; ${p.norma === 'EHE-08' ? '4‰' : '2‰'}·${sub('A', 'c')}}</span><span class="n">N = ${fmt(r.Nd, 0)} kN (${t('cmin.nPilar')}) → 0,10·N/${sub('f', 'yd')} = ${v(r.mec, 'As')} · ${v(r.geo, 'As')} → ${v(r.A, 'As')}</span><span class="art">${ref} · ${art2}</span>`];
  }
  return [h('h3', {}, t('cmin.titulo')),
    plegables(tabla(filas, { cabecera: ['', t('cmin.dispuesta') + U('As'), `${sub('A', 's,min')}` + U('As')] }), cuentas)];
}
const q4 = (x) => fmt(x, 5);

/** Vigas (rectangular y T): armadura inferior para M+ y superior para M−. */
const esViga = (s) => s.forma === 'rectangular' || s.forma === 'T';

/**
 * Cuantías geométricas referidas a la sección total de hormigón: en vigas, ρ inferior (M+) y
 * ρ superior (M−) por separado; en pilares, circulares y genéricas, una sola ρ total.
 * @returns {[string, number][]}  [etiqueta, ρ]
 */
function cuantias(s, geo, ac) {
  const area = (pred) => [...geo.barras, ...geo.franjas].filter(pred).reduce((a, b) => a + b.A, 0) / ac;
  if (!esViga(s)) return [['ρ = ' + sub('A', 's') + '/' + sub('A', 'c'), area(() => true)]];
  const cara = (c) => (b) => s.armado[b.grupo]?.tipo === 'capa' && s.armado[b.grupo].cara === c;
  return [
    [sub('ρ', 'inf') + ` <span class="nota">M+</span>`, area(cara('inf'))],
    [sub('ρ', 'sup') + ` <span class="nota">M−</span>`, area(cara('sup'))],
  ];
}

function resultadosPropiedades(ctx, s, props, mats, tarjeta) {
  poner(tarjeta, h('h2', {}, t('sec.propiedades')));
  if (!props) return;
  const { bruta: b, homogeneizada: hh, fisurada: f } = props;
  poner(tarjeta,
    tabla([
      ['A' + U('Ac'), v(b.A, 'Ac'), v(hh.A, 'Ac')],
      [sub('y', 'g') + ` <span class="nota">${t('geo.desdeArriba')}</span>` + U('long'), v(b.yg, 'long'), v(hh.yg, 'long')],
      // x_g solo dice algo en las genéricas: las demás son simétricas
      ...(s.forma === 'generica' ? [[sub('x', 'g') + ` <span class="nota">${t('geo.desdeIzq')}</span>` + U('long'), v(b.xg, 'long'), v(hh.xg, 'long')]] : []),
      [sub('I', 'x') + U('I'), v(b.Ix, 'I'), v(hh.Ix, 'I')],
      [sub('I', 'y') + U('I'), v(b.Iy, 'I'), v(hh.Iy, 'I')],
      // Radios de giro: para pandeo, en pilares y circulares
      ...(s.forma === 'pilar' || s.forma === 'circular' ? [
        [sub('r', 'x') + U('long'), v(b.rx, 'long'), v(hh.rx, 'long')],
        [sub('r', 'y') + U('long'), v(b.ry, 'long'), v(hh.ry, 'long')]] : []),
    ], { cabecera: ['', t('prop.bruta'), t('prop.homog', fmt(hh.n, 2))] }),
    h('h3', {}, t('prop.fisurada')),
    plegables(tabla([
      [sub('M', 'fis') + U('M'), v(f.positivo.Mfis, 'M'), v(f.negativo.Mfis, 'M')],
      [sub('I', 'fis') + U('I'), v(f.positivo.Ifis, 'I'), v(f.negativo.Ifis, 'I')],
      [`x ${t('prop.fibraNeutra')}` + U('long'), v(f.positivo.x, 'long'), v(f.negativo.x, 'long')],
      [sub('I', 'fis') + '/' + sub('I', 'h'), fmt(f.positivo.Ifis / hh.Ix, 3), fmt(f.negativo.Ifis / hh.Ix, 3)],
    ], { cabecera: ['', t('prop.positivo'), t('prop.negativo')] }), trazaFisurada(ctx, s, props, mats)),
  );
}

/* ---------- diagramas momento-curvatura ---------- */

// El cálculo tarda algo en secciones circulares: se guarda el último y solo se repite si cambian los datos
let memoMk = { clave: '', r: null };
function curvasMk(p, s, geo, mats, axiles) {
  const clave = JSON.stringify([p.norma, s.geo, s.armado, axiles, mats.fichaH, mats.fichaA, sepCapas(p)]);
  if (memoMk.clave !== clave) {
    // Como el Prontuario 3.1: con los diagramas característicos (sin γ ni α)
    const sec = seccionMotor(geo, caracteristico(mats.hormigon), caracteristico(mats.acero));
    memoMk = { clave, r: axiles.map((N) => {
      const Nd = -N; // el motor usa tracción positiva
      return { N, pos: curvaMomentoCurvatura(sec, Nd, { signo: 1, n: 40 }), neg: curvaMomentoCurvatura(sec, Nd, { signo: -1, n: 40 }) };
    }) };
  }
  return memoMk.r;
}

/** Axil último de compresión de la sección (positivo), con los diagramas característicos. */
let memoNu = { clave: '', Nu: NaN };
function axilUltimo(ctx, s) {
  try {
    const p = ctx.p;
    const geo = geometriaDe(p, s);
    const mats = materialesSeccion(p, s);
    const clave = JSON.stringify([p.norma, s.geo, s.armado, mats.fichaH, mats.fichaA, sepCapas(p)]);
    if (memoNu.clave !== clave) {
      const sec = seccionMotor(geo, caracteristico(mats.hormigon), caracteristico(mats.acero));
      const yref = centroHomogeneizado(sec).yg;
      const [lo] = intervaloEpsSup(sec, 0);
      memoNu = { clave, Nu: -esfuerzos(sec, lo, 0, yref).N };
    }
    return memoNu.Nu;
  } catch { return NaN; }
}

/** Axiles resistentes de cálculo de la sección: compresión (N_Rd, positivo) y tracción (positivo en valor absoluto). */
function axilResistente(geo, mats) {
  try {
    const sec = seccionMotor(geo, mats.hormigon, mats.acero);
    const yref = centroHomogeneizado(sec).yg;
    const [lo, hi] = intervaloEpsSup(sec, 0);
    return { comp: -esfuerzos(sec, lo, 0, yref).N, tracc: Number.isFinite(hi) ? esfuerzos(sec, hi, 0, yref).N : NaN };
  } catch { return { comp: NaN, tracc: NaN }; }
}

const PCT_AXIL = [0, 0.2, 0.4, 0.6, 0.8];
/**
 * Diagrama elegido y los cinco axiles (compresión positiva). Mientras no se toquen, son el
 * 0, 20, 40, 60 y 80 % del axil último, como en el Prontuario 3.1, y siguen a la sección.
 */
function configMk(s, Nu) {
  const vista = s.mk?.vista === 'ei' ? 'ei' : 'mk';
  if (s.mk?.axiles?.length === 5) return { vista, axiles: s.mk.axiles };
  const base = Number.isFinite(Nu) ? Nu : NaN;
  return { vista, axiles: PCT_AXIL.map((f) => ({ N: Number.isFinite(base) ? Math.round(f * base) : 0, ver: true })), auto: true };
}
/** Al tocar un axil o su casilla, los cinco quedan fijados en la sección. */
function fijarAxiles(s, cfg) {
  if (!s.mk?.axiles) s.mk = { ...(s.mk ?? {}), axiles: cfg.axiles.map((a) => ({ ...a })) };
}

const KC = MAG.curv.f; // κ en pantalla: ‰/m

function graficaMk(ctx, s, mk, vista, props, mats) {
  const series = [];
  const puntos = [];
  const Ec = mats.hormigon.E;
  const EIb = Ec * props.bruta.Ix;
  const fct = props_fctm(mats, ctx.p, props.h) * 1000;
  const hh = props.homogeneizada;
  const refs = [];
  mk.forEach((c, i) => {
    if (!c.ver) return;
    const clase = `s${i + 1}`;
    const nombre = `N${['₁', '₂', '₃', '₄', '₅'][i]} = ${fmt(c.N, 0)} kN`;
    const neg = c.neg.converge ? c.neg.puntos : [];
    const pos = c.pos.converge ? c.pos.puntos : [];
    if (vista === 'ei') {
      // Rigidez secante EI = M/κ referida a la bruta Ec·Ib, frente al momento con su signo
      // Rigidez secante desde el punto de κ = 0 (con axil y armado asimétrico, M no parte de 0);
      // se omite el arranque, donde el cociente no tiene sentido físico
      const r = (l, sg) => {
        if (!l.converge) return [];
        const M0 = l.puntos[0].M, k0 = 0.01 * l.ultimo.kappa;
        return l.puntos.filter((q) => q.kappa > k0).map((q) => [sg * q.M, (q.M - M0) / q.kappa / EIb]);
      };
      const xy = [...r(c.neg, -1).reverse(), ...r(c.pos, 1)];
      series.push({ nombre, clase, xy });
      return;
    }
    // M+ en el primer cuadrante y M− en el tercero, en una sola curva por axil
    const xy = [...neg.map((q) => [-q.kappa * KC, -q.M]).reverse(), ...pos.slice(1).map((q) => [q.kappa * KC, q.M])];
    series.push({ nombre, clase, xy });
    // Rama sin fisurar (Ec·Ih) hasta Mfis con este axil, en los dos sentidos
    const Mfp = (fct + c.N / hh.A) * hh.Ix / (props.h - hh.yg);
    const Mfn = (fct + c.N / hh.A) * hh.Ix / hh.yg;
    if (Mfp > 0 && Mfn > 0) refs.push({ nombre: '', clase: `ref ${clase}`, cruz: false, xy: [[-Mfn / (Ec * hh.Ix) * KC, -Mfn], [0, 0], [Mfp / (Ec * hh.Ix) * KC, Mfp]] });
  });
  if (refs.length) series.push(...refs, { nombre: t('mk.sinFisurar'), clase: 'ref', cruz: false, xy: [] });
  return grafica({
    series, puntos,
    ...(vista === 'ei'
      ? { ejeX: eje('M', 'M'), ejeY: { titulo: 'EI/EIb', d: 3 }, archivo: `EI-M ${s.nombre}` }
      : { ejeX: eje('curv', 'κ'), ejeY: eje('M', 'M'), archivo: `M-k ${s.nombre}` }),
    avisar: ctx.avisar,
  });
}

function resultadosMk(ctx, s, geo, mk, tarjeta) {
  // Arriba, la sección a unos 2/3 del tamaño de Crear y editar, para saber de qué se habla
  poner(tarjeta, h('div', { class: 'lienzo mini', html: dibujoSeccion(geo, s, {}) }));
  if (!geo.barras.length && !geo.franjas.length) return poner(tarjeta, aviso(t('arm.ninguna'), 'info'));
  if (!mk) return;
  const vis = mk.map((c, i) => ({ ...c, i })).filter((c) => c.ver);
  const m = (x, f) => (x.converge ? f(x) : '—');
  const mu = (x) => (x.converge && x.plastifica ? fmt(x.ultimo.kappa / x.plastifica.kappa, 2) : '—');
  poner(tarjeta,
    ...(vis.some((c) => !c.pos.converge || !c.neg.converge) ? [aviso(t('mk.axilExcede'), 'error')] : []),
    tabla(vis.map((c) => [
      `<span class="marca-serie s${c.i + 1}"></span>${sub('N', String(c.i + 1))} = ${fmt(c.N, 0)}`,
      m(c.pos, (x) => (x.plastifica ? v(x.plastifica.M, 'M') : '—')), m(c.pos, (x) => `<b>${v(x.ultimo.M, 'M')}</b>`), mu(c.pos),
      m(c.neg, (x) => (x.plastifica ? v(-x.plastifica.M, 'M') : '—')), m(c.neg, (x) => `<b>${v(-x.ultimo.M, 'M')}</b>`), mu(c.neg),
    ]), { cabecera: [`N${U('N')}`, `${sub('M', 'y')}<sup>+</sup>`, `${sub('M', 'u')}<sup>+</sup>`, 'μ<sup>+</sup>', `${sub('M', 'y')}<sup>−</sup>`, `${sub('M', 'u')}<sup>−</sup>`, 'μ<sup>−</sup>'] }),
    h('p', { class: 'nota', html: t('mk.notaTabla') }),
    h('p', { class: 'nota', html: t('mk.nota', NORMAS[ctx.p.norma].ref) }));
}

/**
 * La propia fila del resultado es el desplegable: al pulsarla se abre debajo su explicación.
 * cuentas[i] es el HTML de la fila i del cuerpo (las filas sin cuenta no cambian).
 */
function plegables(envoltorio, cuentas) {
  const filas = [...envoltorio.querySelectorAll('tbody tr')];
  const cols = filas[0]?.children.length ?? 1;
  cuentas.forEach((html, i) => {
    const tr = filas[i];
    if (!tr || !html) return;
    const det = h('tr', { class: 'cuenta-fila', hidden: '' }, h('td', { colspan: String(cols) }, h('div', { class: 'cuenta', html })));
    tr.classList.add('plegable');
    tr.tabIndex = 0;
    tr.setAttribute('aria-expanded', 'false');
    const alternar = () => { det.hidden = !det.hidden; tr.setAttribute('aria-expanded', String(!det.hidden)); };
    tr.addEventListener('click', alternar);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
    tr.after(det);
  });
  return envoltorio;
}

/**
 * Explicaciones de Mfis e Ifis: la expresión, los valores que entran y la referencia de la
 * norma. Mismo cálculo que src/core/propiedades.js (Nk de compresión positivo).
 */
function trazaFisurada(ctx, s, props, mats) {
  const { homogeneizada: hh } = props;
  const Nk = s.Nfis ?? 0;
  const Mp = `M${sup('+')}${sub('', 'fis')}`;
  const Mn = `M${sup('−')}${sub('', 'fis')}`;
  const fct = sub('f', 'ct,m,fl');
  const yg = sub('y', 'g,h');
  const fctExpr = ` = max{(1.6 − h)·${sub('f', 'ct,m')}; ${sub('f', 'ct,m')}}`;
  const lineas = (...l) => l.filter(Boolean).join('');
  return [
    lineas(
      `<span class="f">${Mp} = (${fct} + ${sub('N', 'k')}/${sub('A', 'h')}) · ${sub('I', 'h')} / (h − ${yg})</span>`,
      `<span class="f">${Mn} = (${fct} + ${sub('N', 'k')}/${sub('A', 'h')}) · ${sub('I', 'h')} / ${yg}</span>`,
      `<span class="n">${fct}${fctExpr} = ${q(props_fctm(mats, ctx.p, props.h), 'tension')} · ${sub('N', 'k')}/${sub('A', 'h')} = ${q(Nk / hh.A / 1000, 'tension')}</span>`,
      `<span class="n">${sub('I', 'h')} = ${q(hh.Ix, 'I')} · h − ${yg} = ${q(props.h - hh.yg, 'long')} · ${yg} = ${q(hh.yg, 'long')}</span>`,
      `<span class="n">${t('prop.notaMfis')}</span>`,
      `<span class="art">${t(`prop.artFct.${ctx.p.norma}`)}</span>`),
    lineas(
      `<span class="f">${t('prop.formulaIfis')}</span>`,
      `<span class="n">n = ${sub('E', 's')}/${sub('E', 'c')} = ${fmt(hh.n, 2)}</span>`),
  ];
}

function props_fctm(mats, p, h) {
  if (!mats) return NaN;
  const q = propiedadesHormigon(mats.fichaH.fck, p.norma, opcionesHormigon(mats.fichaH, p.norma));
  return fctmFlexotraccion(q.fctm, h);
}

export function comandos(ctx) {
  return [
    ...FORMAS.map((f) => ({ texto: `${t('p.nuevaSeccion')}: ${t(`forma.${f}`)}`, b: `sección section nueva new ${f}`, f: () => {
      est.forma = f;
      est.pestana = 'seccion';
      const b = est.b[f];
      ctx.ir('secciones');
      pedir(ctx, b && sucio(b), t('sec.confirmaDescartar', b?.nombre ?? b?.s.nombre), () => { nueva(ctx, f); ctx.pintar(); });
    } })),
  ];
}

