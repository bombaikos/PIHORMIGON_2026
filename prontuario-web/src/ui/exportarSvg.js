// Exportar un SVG dibujado en pantalla: SVG autónomo con los estilos del tema claro en línea y fondo
// blanco, PNG al doble de resolución, descarga y copia al portapapeles. Común a todas las gráficas.

import { t } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor'];

/** SVG autónomo: los estilos calculados (con el tema claro) pasan a cada nodo y se añade fondo blanco. */
export function svgAutonomo(svg) {
  const raiz = document.documentElement;
  const antes = raiz.getAttribute('data-theme');
  raiz.setAttribute('data-theme', 'light');
  const copia = svg.cloneNode(true);
  copia.querySelector('.vivo')?.remove();
  const orig = [...svg.querySelectorAll('*')].filter((n) => !n.closest('.vivo'));
  const dest = [...copia.querySelectorAll('*')];
  orig.forEach((n, i) => {
    const cs = getComputedStyle(n);
    dest[i].setAttribute('style', PROPS.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';'));
  });
  if (antes === null) raiz.removeAttribute('data-theme'); else raiz.setAttribute('data-theme', antes);
  copia.setAttribute('xmlns', NS);
  copia.removeAttribute('class');
  const fondo = document.createElementNS(NS, 'rect');
  fondo.setAttribute('width', '100%');
  fondo.setAttribute('height', '100%');
  fondo.setAttribute('fill', '#fff');
  copia.prepend(fondo);
  return new XMLSerializer().serializeToString(copia);
}

export function png(svg, W, H) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgAutonomo(svg)], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2;
      c.height = H * 2;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : mal(new Error('png'))), 'image/png');
    };
    img.onerror = mal;
    img.src = url;
  });
}

export function bajar(blob, nombre, ext) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Copia el PNG; si el navegador no deja, lo descarga. */
export async function copiarPNG(svg, W, H, nombre, avisar) {
  try {
    if (typeof ClipboardItem !== 'function' || !navigator.clipboard?.write) throw new Error('sin portapapeles');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png(svg, W, H) })]);
    avisar(t('graf.copiada'));
  } catch {
    try { bajar(await png(svg, W, H), nombre, 'png'); avisar(t('graf.sinPortapapeles')); } catch { avisar(t('graf.error')); }
  }
}

export async function guardar(svg, W, H, nombre, ext, avisar) {
  try { bajar(ext === 'svg' ? new Blob([svgAutonomo(svg)], { type: 'image/svg+xml' }) : await png(svg, W, H), nombre, ext); } catch { avisar(t('graf.error')); }
}
