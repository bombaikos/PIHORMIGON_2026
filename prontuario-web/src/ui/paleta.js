// Paleta de comandos Ctrl+K (guía de estilo §10). Los comandos los pone la app.

import { t } from './i18n.js';

/** @param {() => {k:string, b?:string, f:Function, texto?:string}[]} comandos  Lista viva de comandos */
export function instalarPaleta(comandos, avisar) {
  const pal = document.getElementById('paleta');
  const pq = document.getElementById('paleta-q');
  const pl = document.getElementById('paleta-lista');
  let sel = 0;
  let vis = [];
  const plano = (x) => x.replace(/<[^>]+>/g, '');
  const texto = (c) => c.texto ?? t(c.k);
  function listar() {
    const x = pq.value.trim().toLowerCase();
    vis = comandos().filter((c) => !x || (plano(texto(c)) + ' ' + (c.b ?? '')).toLowerCase().includes(x));
    sel = Math.min(sel, Math.max(vis.length - 1, 0));
    pl.innerHTML = vis.map((c, i) => `<li role="option" aria-selected="${i === sel}" data-i="${i}">${texto(c)}</li>`).join('')
      || `<li aria-selected="false"><small>${t('p.nada')}</small></li>`;
    pl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function abrir() {
    pq.value = '';
    pq.placeholder = t('p.buscar');
    pq.setAttribute('aria-label', t('p.buscar'));
    sel = 0;
    listar();
    try { pal.showModal(); } catch { pal.setAttribute('open', ''); }
    pq.focus();
  }
  function ejecutar(i) {
    const c = vis[i];
    if (!c) return;
    pal.close();
    const msg = plano(texto(c));
    c.f();
    avisar(msg);
  }
  pq.addEventListener('input', () => { sel = 0; listar(); });
  pq.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, vis.length - 1); listar(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); listar(); e.preventDefault(); }
    if (e.key === 'Enter') { e.preventDefault(); ejecutar(sel); }
  });
  pl.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) ejecutar(+li.dataset.i); });
  document.getElementById('abrir-paleta').addEventListener('click', abrir);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrir(); }
  });
  return { abrir };
}
