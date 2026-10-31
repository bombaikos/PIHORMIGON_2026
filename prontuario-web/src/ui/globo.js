// Globos de ayuda (i): un solo globo flotante fuera de los paneles, para que ningún panel con scroll
// (datos, tarjetas) ni el borde de la pantalla lo corte. Va arriba del icono; si no cabe, debajo.
const MARGEN = 8;
let globo = null;
let actual = null;

function asegurar() {
  if (globo) return globo;
  globo = document.createElement('div');
  globo.className = 'globo-i';
  globo.id = 'globo-i';
  globo.setAttribute('role', 'tooltip');
  globo.hidden = true;
  document.body.append(globo);
  return globo;
}

function poner(icono) {
  const g = asegurar();
  g.textContent = icono.dataset.tip ?? '';
  g.hidden = false;
  actual = icono;
  const r = icono.getBoundingClientRect();
  const w = g.offsetWidth;
  const alto = g.offsetHeight;
  const arriba = r.top - alto - MARGEN >= MARGEN;
  const y = arriba ? r.top - alto - MARGEN : Math.min(r.bottom + MARGEN, window.innerHeight - alto - MARGEN);
  const x = Math.min(Math.max(r.left + r.width / 2 - w / 2, MARGEN), window.innerWidth - w - MARGEN);
  g.style.left = `${Math.round(x)}px`;
  g.style.top = `${Math.round(Math.max(y, MARGEN))}px`;
  icono.setAttribute('aria-describedby', 'globo-i');
}

function quitar() {
  if (!globo || !actual) return;
  globo.hidden = true;
  actual.removeAttribute('aria-describedby');
  actual = null;
}

/** Engancha el globo a todos los `.info-i` (presentes y futuros) con el ratón y con el teclado. */
export function iniciarGlobos() {
  const de = (e) => (e.target instanceof Element ? e.target.closest('.info-i') : null);
  document.addEventListener('mouseover', (e) => { const i = de(e); if (i) poner(i); });
  document.addEventListener('mouseout', (e) => { if (de(e)) quitar(); });
  document.addEventListener('focusin', (e) => { const i = de(e); if (i) poner(i); });
  document.addEventListener('focusout', (e) => { if (de(e)) quitar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') quitar(); });
  window.addEventListener('scroll', quitar, true);
  window.addEventListener('resize', quitar);
}
