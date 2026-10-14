// Rejilla de datos: tabla editable como una hoja de cálculo (guía de estilo, § 12).
// Hecha a mano sobre <table>. La primera fila lleva los títulos con su unidad y no hay
// columna de numeración. En pantalla siempre se ve el punto decimal; al copiar se usa el
// separador del sistema para que Excel reciba números, y al pegar se aceptan punto y coma.
//
// Teclado: flechas, Tab, Intro, F2 (editar), Esc (cancelar), Supr (vaciar celdas),
// Insert (fila encima), Ctrl+Supr (borrar filas), Mayús+flechas (rango), Ctrl+C / Ctrl+V.

import { leerNumero } from '../core/armado.js';
import { h } from './campos.js';
import { t } from './i18n.js';
import { decimalAlCopiar } from './formato.js';


/**
 * @param {Object} o
 * @param {string} o.id
 * @param {{titulo:string, num?:boolean, validar?:(txt:string)=>string|null}[]} o.columnas
 *   titulo admite HTML; num: columna numérica (se guarda con punto); validar devuelve un mensaje si no vale
 * @param {string[][]} o.filas      textos de las celdas, con punto decimal
 * @param {(filas:string[][]) => void} o.onCambio  se llama con todas las filas cuando todas son válidas
 * @param {(i:number) => string} [o.refFila]       data-ref de cada fila, para resaltar el dibujo
 * @param {number} [o.altoMax]  alto máximo en px antes de hacer scroll
 * @param {{titulo:string, f:(datos:string[][], r:number)=>string}} [o.calculada]  columna extra de solo lectura (no se edita ni se copia)
 * @param {boolean} [o.numerar]  numera las filas (1, 2, 3…) en el borde de la primera celda
 */
export function rejilla({ id, columnas, filas, onCambio, refFila, altoMax = 260, calculada = null, numerar = false }) {
  const C = columnas.length;
  let datos = filas.map((f) => columnas.map((_, j) => String(f[j] ?? '')));
  let act = { r: 0, c: 0 };
  let ancla = null; // otra esquina del rango seleccionado
  let editor = null;

  const tabla = h('table', { class: `rejilla${numerar ? ' numerada' : ''}`, id, tabindex: '0', role: 'grid' });
  const marco = h('div', { class: 'marco-rejilla', style: `max-height:${altoMax}px` }, tabla);
  const pie = h('div', { class: 'eco' });

  const vacia = (f) => f.every((x) => !x.trim());
  const errorDe = (r, c) => {
    const v = datos[r]?.[c] ?? '';
    if (!v.trim()) return vacia(datos[r]) ? null : (columnas[c].num ? t('rej.falta') : null);
    if (columnas[c].num && !Number.isFinite(leerNumero(v))) return t('rej.noNumero');
    return columnas[c].validar?.(v) ?? null;
  };
  const rango = () => {
    const b = ancla ?? act;
    return { r1: Math.min(act.r, b.r), r2: Math.max(act.r, b.r), c1: Math.min(act.c, b.c), c2: Math.max(act.c, b.c) };
  };

  function pintar() {
    const R = rango();
    const cab = h('thead', {}, h('tr', {}, ...columnas.map((col) => h('th', { scope: 'col', html: col.titulo })), ...(calculada ? [h('th', { scope: 'col', class: 'calc', html: calculada.titulo })] : [])));
    const cuerpo = h('tbody');
    // Una fila vacía al final para añadir
    const todas = [...datos, columnas.map(() => '')];
    let errores = 0;
    todas.forEach((f, r) => {
      const tr = h('tr', refFila && r < datos.length ? { 'data-ref': refFila(r) } : { class: 'nueva' });
      f.forEach((v, c) => {
        const err = r < datos.length ? errorDe(r, c) : null;
        if (err) errores++;
        const sel = r >= R.r1 && r <= R.r2 && c >= R.c1 && c <= R.c2;
        const td = h('td', {
          class: [columnas[c].num ? 'num' : '', sel ? 'sel' : '', r === act.r && c === act.c ? 'activa' : '', err ? 'mal' : ''].filter(Boolean).join(' '),
          title: err ?? undefined, 'data-r': r, 'data-c': c,
        }, v);
        tr.append(td);
      });
      if (calculada) tr.append(h('td', { class: 'num calc' }, r < datos.length && !vacia(f) ? calculada.f(datos, r) : ''));
      cuerpo.append(tr);
    });
    tabla.replaceChildren(cab, cuerpo);
    pie.textContent = errores ? t('rej.errores', errores) : '';
    marco.classList.toggle('mal', errores > 0);
  }

  function celda(r, c) { return tabla.querySelector(`td[data-r="${r}"][data-c="${c}"]`); }
  function verActiva() { celda(act.r, act.c)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }

  /** Normaliza, quita filas vacías y avisa si todo es válido. */
  function confirmar() {
    datos = datos.map((f) => f.map((v, c) => (columnas[c].num ? v.trim().replace(/,/g, '.') : v.trim())));
    const limpias = datos.filter((f) => !vacia(f));
    const hayError = datos.some((f, r) => f.some((_, c) => errorDe(r, c)));
    if (!hayError) {
      datos = limpias;
      act.r = Math.min(act.r, datos.length);
      onCambio(datos.map((f) => [...f]));
    }
    pintar();
  }

  function poner(r, c, v) {
    while (datos.length <= r) datos.push(columnas.map(() => ''));
    datos[r][c] = v;
  }

  function mover(dr, dc, extender = false) {
    if (extender) ancla ??= { ...act }; else ancla = null;
    act = { r: Math.max(0, Math.min(datos.length, act.r + dr)), c: Math.max(0, Math.min(C - 1, act.c + dc)) };
    pintar();
    verActiva();
  }

  function editar(inicial) {
    const td = celda(act.r, act.c);
    if (!td) return;
    const previo = datos[act.r]?.[act.c] ?? '';
    editor = h('input', { class: 'editor-rejilla', value: inicial ?? previo, spellcheck: 'false', autocomplete: 'off' });
    td.replaceChildren(editor);
    td.classList.add('editando');
    editor.focus();
    if (inicial === undefined) editor.select(); else editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const fin = (dr, dc) => { e.preventDefault(); terminar(true); mover(dr, dc); tabla.focus(); };
      if (e.key === 'Enter') return fin(e.shiftKey ? -1 : 1, 0);
      if (e.key === 'Tab') return fin(0, e.shiftKey ? -1 : 1);
      if (e.key === 'Escape') { e.preventDefault(); terminar(false); tabla.focus(); }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && inicial !== undefined) return fin(e.key === 'ArrowUp' ? -1 : 1, 0);
    });
    editor.addEventListener('blur', () => terminar(true));
  }

  function terminar(guardar) {
    if (!editor) return;
    const v = editor.value;
    editor = null;
    if (guardar) { poner(act.r, act.c, v); confirmar(); } else pintar();
  }

  /* ---------- portapapeles ---------- */

  function copiar(e) {
    const R = rango();
    const bloque = [];
    for (let r = R.r1; r <= Math.min(R.r2, datos.length - 1); r++) bloque.push(datos[r].slice(R.c1, R.c2 + 1).map((v, k) => (columnas[R.c1 + k].num ? v.replace('.', decimalAlCopiar()) : v)));
    const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    e.clipboardData.setData('text/plain', bloque.map((f) => f.join('\t')).join('\r\n'));
    e.clipboardData.setData('text/html', `<table>${bloque.map((f) => `<tr>${f.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`);
    e.preventDefault();
  }

  function pegar(e) {
    const txt = e.clipboardData.getData('text/plain');
    if (!txt) return;
    e.preventDefault();
    let lineas = txt.replace(/\r/g, '').split('\n');
    if (lineas.at(-1) === '') lineas.pop();
    let bloque = lineas.map((l) => l.split('\t'));
    // Si la primera fila pegada no es numérica donde debería, son los títulos: se ignora
    const esTitulo = (f) => f.some((v, k) => columnas[act.c + k]?.num && v.trim() && !Number.isFinite(leerNumero(v)));
    if (bloque.length > 1 && esTitulo(bloque[0])) bloque = bloque.slice(1);
    bloque.forEach((f, i) => f.forEach((v, k) => { if (act.c + k < C) poner(act.r + i, act.c + k, v); }));
    ancla = { r: act.r + bloque.length - 1, c: Math.min(C - 1, act.c + (bloque[0]?.length ?? 1) - 1) };
    confirmar();
  }

  /* ---------- teclado y ratón ---------- */

  tabla.addEventListener('keydown', (e) => {
    if (editor) return;
    e.stopPropagation();
    const k = e.key;
    const flechas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (flechas[k]) { e.preventDefault(); return mover(...flechas[k], e.shiftKey); }
    if (k === 'Tab') { e.preventDefault(); return mover(0, e.shiftKey ? -1 : 1); }
    if (k === 'Enter') { e.preventDefault(); return mover(e.shiftKey ? -1 : 1, 0); }
    if (k === 'F2') { e.preventDefault(); return editar(); }
    if (k === 'Insert') {
      e.preventDefault();
      datos.splice(act.r, 0, columnas.map(() => ''));
      return pintar();
    }
    if ((k === 'Delete' || k === 'Backspace') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const R = rango();
      datos.splice(R.r1, R.r2 - R.r1 + 1);
      ancla = null;
      act.r = Math.min(R.r1, datos.length);
      return confirmar();
    }
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      const R = rango();
      for (let r = R.r1; r <= Math.min(R.r2, datos.length - 1); r++) for (let c = R.c1; c <= R.c2; c++) datos[r][c] = '';
      return confirmar();
    }
    // Al escribir se sustituye el contenido de la celda
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); ancla = null; editar(k); }
  });
  tabla.addEventListener('copy', copiar);
  tabla.addEventListener('paste', pegar);
  let arrastre = false;
  tabla.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td');
    if (!td || td.classList.contains('editando') || td.classList.contains('calc')) return;
    e.preventDefault();
    tabla.focus();
    const pos = { r: +td.dataset.r, c: +td.dataset.c };
    if (e.shiftKey) ancla ??= { ...act }; else ancla = null;
    act = pos;
    arrastre = true;
    pintar();
  });
  tabla.addEventListener('pointerover', (e) => {
    if (!arrastre) return;
    const td = e.target.closest('td');
    if (!td || td.classList.contains('calc')) return;
    const r = +td.dataset.r;
    const c = +td.dataset.c;
    // Repintar cambia la celda bajo el puntero y vuelve a disparar el evento: solo si se movió
    if (r === act.r && c === act.c) return;
    ancla ??= { ...act };
    act = { r, c };
    pintar();
  });
  document.addEventListener('pointerup', () => { arrastre = false; });
  tabla.addEventListener('dblclick', (e) => { const td = e.target.closest('td'); if (td && !td.classList.contains('calc')) editar(); });

  pintar();
  return h('div', { class: 'campo columna rejilla-campo', 'data-c': id }, marco, pie);
}

/** Texto de una longitud en m para una celda en mm: punto decimal y sin ceros sobrantes. */
export const celdaMm = (m) => String(+(m * 1000).toFixed(1));
