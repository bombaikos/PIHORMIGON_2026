// Filas de tabla que se despliegan para mostrar el cálculo (guía § 7): la expresión, los valores
// sustituidos y el artículo de la norma. Se usa en Materiales y en Propiedades reológicas.

import { h } from './campos.js';

/**
 * @param {HTMLElement} envoltorio  contenedor de una tabla de etiqueta y valor (tabla() de campos.js)
 * @param {(string|null)[]} cuentas  HTML de la explicación de cada fila, en orden; null deja la fila sin desplegar
 */
export function filasPlegables(envoltorio, cuentas) {
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
