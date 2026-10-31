// Tarjetón con la designación del hormigón (guía § 14.8) y botón para copiar tablas.

import { h, boton } from './campos.js';
import { t } from './i18n.js';
import { decimalAlCopiar } from './formato.js';

/** Tarjetón de la columna de datos: la designación completa, en grande, y una línea debajo. */
export function tarjetonDesignacion() {
  return h('div', { class: 'tarjeton', 'aria-live': 'polite' },
    h('div', { class: 't-tipo' }, t('dur.designacion')),
    h('div', { class: 't-nom t-desig', id: 'd-desig' }, ''),
    h('div', { class: 't-res', id: 'd-desig2' }, ''));
}

/** Pone los textos del tarjetón si está en pantalla (se llama en cada recálculo). */
export function actualizarDesignacion(principal, secundaria) {
  const a = document.getElementById('d-desig');
  const b = document.getElementById('d-desig2');
  if (a) { a.textContent = principal; a.classList.toggle('t-larga', principal.length > 22); }
  if (b) b.textContent = secundaria ?? '';
}

const plano = (s) => { const d = document.createElement('div'); d.innerHTML = String(s); return d.textContent; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Botón que copia una tabla (texto con tabuladores y HTML) para pegar en Excel o Word.
 * @param {() => (string|number)[][]} filas  la primera fila es la cabecera; los números se copian con el decimal elegido
 */
export function botonCopiar(filas) {
  const b = boton(t('dur.copiar'), async () => {
    const datos = filas().map((f) => f.map((c) => (typeof c === 'number' || /^-?\d+(\.\d+)?$/.test(String(c)) ? String(c).replace('.', decimalAlCopiar()) : plano(c))));
    const txt = datos.map((f) => f.join('\t')).join('\r\n');
    const htm = `<table>${datos.map((f, i) => `<tr>${f.map((c) => `<${i ? 'td' : 'th'}>${esc(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([txt], { type: 'text/plain' }), 'text/html': new Blob([htm], { type: 'text/html' }) })]);
      else await navigator.clipboard.writeText(txt);
      b.textContent = t('dur.copiado');
    } catch { b.textContent = t('dur.noCopiado'); }
    setTimeout(() => { b.textContent = t('dur.copiar'); }, 1600);
  }, 'secundario pequeno');
  b.title = t('dur.copiarAyuda');
  return b;
}
