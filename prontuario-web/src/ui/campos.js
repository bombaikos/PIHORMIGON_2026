// Piezas comunes de la interfaz (guía de estilo §6 y §11): campo numérico, campo de armadura,
// selector, segmentado y grupos. Cada módulo las usa en lugar de crear sus propios controles.

import { leerNumero, leerArmado, leerCapas } from '../core/armado.js';
import { MAG, fmt, paraCampo, armadoBonito, ESP } from './formato.js';
import { t } from './i18n.js';

/* ---------- DOM ---------- */

export function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

/** Fragmento HTML de confianza (textos de los diccionarios con <sub>). */
export const html = (s, tag = 'span', attrs = {}) => h(tag, { ...attrs, html: s });

export function poner(padre, ...hijos) {
  padre.append(...hijos.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return padre;
}

const esperas = new WeakMap();
/** Espera de ~150 ms tras la última tecla antes de recalcular (guía §6). */
function diferir(el, f, ms = 150) {
  clearTimeout(esperas.get(el));
  esperas.set(el, setTimeout(f, ms));
}

function marco(id, etq, ref, caja, nota = '') {
  const eco = h('div', { class: 'eco', id: `${id}-eco`, 'aria-live': 'polite' });
  // Nota breve en gris dentro de la caja, a la derecha, como las unidades (226 mm²)
  const corta = h('span', { class: 'ud nota', id: `${id}-nota`, html: nota });
  caja.append(corta);
  const c = h('div', { class: 'campo', 'data-c': id },
    h('label', { for: id, html: etq + (ref ? ` <span class="ref">${ref}</span>` : '') }), caja, eco);
  const marcar = (error, texto, breve = '') => {
    c.classList.toggle('mal', !!error);
    eco.textContent = error || texto || '';
    corta.innerHTML = error ? '' : breve;
    caja.querySelector('input,select')?.setAttribute('aria-invalid', error ? 'true' : 'false');
  };
  return { c, marcar };
}

/**
 * Campo numérico. valor, min y max en unidades internas; se muestra en las de la magnitud.
 * Admite cuentas (2*150); ↑ ↓ varían según paso (en unidades de pantalla), Mayús ×10.
 */
export function campoNum({ id, etq, ref, valor, mag, paso, min = -Infinity, max = Infinity, nombre, onCambio, ayuda, info, sinUd = false }) {
  const m = MAG[mag] ?? { ud: '', f: 1, d: 3 };
  const input = h('input', { id, inputmode: 'decimal', value: mag ? paraCampo(valor, mag) : String(valor ?? ''), 'data-paso': paso, autocomplete: 'off', title: ayuda, 'aria-describedby': `${id}-eco` });
  const caja = h('div', { class: 'caja' }, input, m.ud && !sinUd ? h('span', { class: 'ud' }, m.ud) : null); // sinUd: la unidad va en la etiqueta, entre corchetes
  const { c, marcar } = marco(id, etq, ref, caja);
  // info: una (i) junto a la etiqueta con una aclaración al pasar el ratón o enfocar (criterios propios, avisos)
  if (info) c.insertBefore(h('span', { class: 'info-i izq', tabindex: 0, role: 'img', 'aria-label': info, 'data-tip': info }, 'i'), caja);
  const leer = () => {
    const raw = input.value;
    const v = leerNumero(raw);
    if (!Number.isFinite(v)) return marcar(t('err.numero'));
    const x = v / m.f;
    if (x < min || x > max) {
      const ud = m.ud ? ESP + m.ud : '';
      return marcar(t('err.rango', nombre ?? etq.replace(/<[^>]+>/g, ''), fmt(min * m.f, m.d ?? 0) + ud, fmt(max * m.f, m.d ?? 0) + ud));
    }
    marcar('', /[*/+()]|\d-/.test(raw) ? `= ${fmt(v, Math.max(m.d ?? 0, 1))}` : '');
    onCambio(x);
  };
  input.addEventListener('input', () => diferir(input, leer));
  input.addEventListener('change', () => { clearTimeout(esperas.get(input)); leer(); });
  input._leer = leer;
  return c;
}

/** Campo de texto libre. */
export function campoTexto({ id, etq, valor, onCambio }) {
  const input = h('input', { id, class: 'texto', value: valor ?? '', autocomplete: 'off', spellcheck: 'false' });
  input.addEventListener('change', () => onCambio(input.value));
  return marco(id, etq, null, h('div', { class: 'caja' }, input)).c;
}

// Dentro de la caja: el área total solo si hay redondos (2D16 → 402 mm²); dada en área, solo la unidad
const breveArea = (A, conBarras) => (conBarras && A > 0 ? `${fmt(A, 0)}${ESP}mm²` : 'mm²');

/** Campo de armadura: 2D25+8D12, 4ø16, 4fi16, 4x16, área en mm² o mezclas. */
export function campoArmado({ id, etq, ref, texto, onCambio, soloBarras, capas }) {
  const input = h('input', { id, class: 'texto armado', value: texto ?? '', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': `${id}-eco` });
  const { c, marcar } = marco(id, etq, ref, h('div', { class: 'caja' }, input));
  const leer = (avisar = true) => {
    if (capas) {
      // Por capas: cada sumando es una capa (5D20+2D16)
      const r = leerCapas(input.value, { ...capas, soloBarras });
      if (!r) return marcar(t('err.armado'));
      if (r.error) return marcar(t(r.error));
      const desc = r.capas.map((k) => (k.n ? `${k.n}ø${k.fi}` : `${fmt(k.A, 0)}${ESP}mm²`));
      marcar('', r.A > 0 ? `${desc.join(' + ')}${r.capas.length > 1 ? ` (${t('arm.nCapas', r.capas.length)})` : ''} = ${fmt(r.A, 0)}${ESP}mm²` : t('sinArmadura'),
        breveArea(r.A, r.capas.some((k) => k.n)));
      if (avisar) onCambio(input.value.trim(), r);
      return;
    }
    const a = leerArmado(input.value);
    if (!a) return marcar(t('err.armado'));
    if (soloBarras && a.Aarea > 0) return marcar(t('err.soloBarras'));
    marcar('', a.A > 0 ? (a.barras.length ? `${armadoBonito(a)} = ${fmt(a.A, 0)}${ESP}mm²` : `A = ${fmt(a.A, 0)}${ESP}mm²`) : t('sinArmadura'),
      breveArea(a.A, a.barras.length > 0));
    if (avisar) onCambio(input.value.trim(), a);
  };
  input.addEventListener('input', () => diferir(input, leer));
  input.addEventListener('change', () => { clearTimeout(esperas.get(input)); leer(); });
  queueMicrotask(() => leer(false));
  return c;
}

/** Desplegable. opciones: [[valor, etiqueta(html)]] */
export function selector({ id, etq, opciones, valor, onCambio, nota, linea = false }) {
  // Una opción puede llevar un tercer elemento: el grupo (optgroup) en el que se muestra
  const opt = ([v, e]) => h('option', { value: v, selected: String(v) === String(valor), html: e });
  const grupos = new Map();
  for (const o of opciones) { const g = o[2] ?? ''; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(o); }
  const s = h('select', { id }, ...[...grupos].flatMap(([g, l]) => (g ? [h('optgroup', { label: g }, ...l.map(opt))] : l.map(opt))));
  s.addEventListener('change', () => onCambio(s.value));
  const c = marco(id, etq, null, h('div', { class: 'caja' }, s), nota).c;
  if (!linea) c.classList.add('apilado'); // norma § 16: etiqueta arriba, desplegable a todo el ancho; en línea, como un campo numérico
  return c;
}

/** Botones segmentados (radio). */
export function segmentado({ opciones, valor, onCambio, ancho = false, capsula = false, etiqueta }) {
  return h('div', { class: `seg${ancho ? ' ancho' : ''}${capsula ? ' capsula' : ''}`, role: 'radiogroup', 'aria-label': etiqueta },
    ...opciones.map(([v, e, extra = {}]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === valor), html: e, ...extra, onclick: () => onCambio(v) })));
}

/** Casillas múltiples (por ejemplo, clases de exposición). */
export function casillas({ id, etq, opciones, marcadas, onCambio }) {
  const sel = new Set(marcadas);
  return h('div', { class: 'campo', 'data-c': id },
    h('span', { class: 'etq-grupo', html: etq }),
    h('div', { class: 'chips', role: 'group', 'aria-label': etq.replace(/<[^>]+>/g, '') },
      ...opciones.map(([v, e]) => h('button', {
        type: 'button', class: 'chip-sel', 'aria-pressed': String(sel.has(v)), html: e,
        onclick: (ev) => { sel.has(v) ? sel.delete(v) : sel.add(v); ev.currentTarget.setAttribute('aria-pressed', String(sel.has(v))); onCambio(opciones.map((o) => o[0]).filter((x) => sel.has(x))); },
      }))));
}

/** Título en una línea y el selector en otra (norma de diseño): para desplegables y botones segmentados. */
/** Regleta (guía §9.4): deslizador común. Etiqueta | pista | valor; mide el 80 % del gráfico al que acompaña.
 *  Devuelve { el, input, valor(html) }. La pista se rellena con --p (se actualiza sola). */
export function regleta({ etq, min, max, step = 1, valor, texto, etiqueta, onInput, onChange, clase = '' }) {
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(valor), 'aria-label': etiqueta ?? etq ?? '' });
  const out = h('output', { class: 'rg-v' });
  const pinta = () => {
    const v = Number(input.value);
    input.style.setProperty('--p', `${((v - Number(input.min)) / (Number(input.max) - Number(input.min) || 1)) * 100}%`);
    out.innerHTML = texto ? texto(v) : String(v);
  };
  input.addEventListener('input', () => { pinta(); onInput?.(Number(input.value)); });
  if (onChange) input.addEventListener('change', () => onChange(Number(input.value)));
  pinta();
  const el = h('div', { class: `regleta ${clase}`.trim() }, etq ? h('span', { class: 'rg-et', html: etq }) : null, input, out);
  if (!etq) el.classList.add('sin-etq');
  el.refrescar = () => pinta();
  return el;
}

export const apilado = (c) => { c.classList.add('apilado'); return c; };

/** Varios campos apilados en una fila (por ejemplo, tres diámetros). */
export const filaCampos = (...hijos) => h('div', { class: 'fila-campos', style: `--n:${hijos.length}` }, ...hijos);

export const grupo = (leyenda, ...hijos) => h('fieldset', { class: 'grupo' }, leyenda ? h('legend', { html: leyenda }) : null, ...hijos);
export const par = (...hijos) => h('div', { class: 'par' }, ...hijos);
export const boton = (texto, onclick, clase = 'secundario') => h('button', { type: 'button', class: `boton ${clase}`, onclick, html: texto });
export const aviso = (texto, tipo = '') => h('p', { class: `aviso ${tipo}`, html: texto });

/** Pestañas internas de una pantalla. pestañas: [[clave, etiqueta, {deshabilitada}]] */
export function pestanas({ lista, activa, onCambio }) {
  return h('div', { class: 'pestanas', role: 'tablist' },
    ...lista.map(([k, e, o = {}]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(k === activa), 'aria-disabled': o.deshabilitada ? 'true' : undefined,
      title: o.deshabilitada ? t('pendiente') : undefined, html: e,
      onclick: () => { if (!o.deshabilitada) onCambio(k); },
    })));
}

/** Tabla: filas [[th, td, td…]] o con cabecera. Celdas en HTML de confianza. */
export function tabla(filas, { cabecera, clase = '' } = {}) {
  return h('div', { class: 'tabla-scroll' }, h('table', { class: clase },
    cabecera ? h('thead', {}, h('tr', {}, ...cabecera.map((c) => h('th', { html: c })))) : null,
    h('tbody', {}, ...filas.map((f) => h('tr', { ...(f.ref ? { 'data-ref': f.ref } : {}), ...(f.clase ? { class: f.clase } : {}) }, ...f.map((c, i) => (i === 0 && !cabecera ? h('th', { scope: 'row', html: c }) : h('td', { html: c }))))))));
}

/** Cifras destacadas: [[etiqueta(html), valor(html)]] */
export const cifras = (lista) => h('div', { class: 'cifras' }, ...lista.map(([e, v]) => h('div', { class: 'cifra' }, h('span', { class: 'etq', html: e }), h('span', { class: 'v', html: v }))));

/* ---------- comportamiento común de los formularios ---------- */

/** Selección al entrar, Intro al siguiente campo y ↑ ↓ con paso (Mayús ×10). Se instala una vez. */
export function comportamientoFormulario(form) {
  let porRaton = null;
  form.addEventListener('pointerdown', (e) => { if (e.target.matches('input') && document.activeElement !== e.target) porRaton = e.target; });
  form.addEventListener('focusin', (e) => { if (e.target.matches('input') && porRaton !== e.target) e.target.select(); });
  form.addEventListener('pointerup', (e) => { if (porRaton && e.target === porRaton) { e.preventDefault(); porRaton.select(); } porRaton = null; });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('keydown', (e) => {
    const x0 = e.target;
    if (x0.tagName === 'INPUT' && e.key === 'Enter') {
      e.preventDefault();
      x0.dispatchEvent(new Event('change', { bubbles: true }));
      const todos = [...form.querySelectorAll('input, select')].filter((el) => el.offsetParent);
      todos[(todos.indexOf(x0) + 1) % todos.length]?.focus();
      return;
    }
    if (!x0.dataset?.paso || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const x = leerNumero(x0.value);
    if (!Number.isFinite(x)) return;
    e.preventDefault();
    const paso = +x0.dataset.paso * (e.shiftKey ? 10 : 1);
    x0.value = String(+(Math.round((x + (e.key === 'ArrowUp' ? paso : -paso)) / paso) * paso).toFixed(6));
    x0.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
