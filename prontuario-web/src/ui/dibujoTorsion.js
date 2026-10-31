// Dibujo del módulo Torsión: la sección rectangular a escala con la pared eficaz (sombreada), su línea media (que
// encierra Ae), el cerco y las cuatro barras de esquina, con b, h, hₑ y c acotados.

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS, topeEscala } from './dibujoSeccion.js';

/** @param {{b:number,h:number,he:number,c:number,fi?:number}} g  longitudes en mm */
export function dibujoTorsion(g) {
  const sc = Math.min(210 / Math.max(g.b, g.h), 1);
  const bp = g.b * sc;
  const hp = g.h * sc;
  const he = g.he * sc;
  const x0 = 54;
  const y0 = 22;
  const out = [DEFS];
  out.push(`<rect class="hor" x="${x0}" y="${y0}" width="${bp}" height="${hp}"/>`);
  // Pared eficaz: contorno exterior menos el interior a he, en dos grises (sin la trama de la zona comprimida)
  out.push(`<path class="pared-tor" fill-rule="evenodd" d="M${x0},${y0}h${bp}v${hp}h${-bp}z M${x0 + he},${y0 + he}v${hp - 2 * he}h${bp - 2 * he}v${-(hp - 2 * he)}z"/>`);
  out.push(`<rect class="en" fill="none" x="${x0 + he / 2}" y="${y0 + he / 2}" width="${bp - he}" height="${hp - he}"/>`);
  // Cerco sobre la línea media y barras de esquina en el eje de la armadura (a c de las caras)
  const r = Math.max(2.2, Math.min(5, (g.fi ?? 14) * sc / 2));
  const cp = Math.min(g.c * sc, Math.min(bp, hp) / 2 - r);
  out.push(`<rect class="cerco" x="${x0 + cp - r}" y="${y0 + cp - r}" width="${bp - 2 * cp + 2 * r}" height="${hp - 2 * cp + 2 * r}" rx="${r + 1}"/>`);
  for (const [cx, cy] of [[x0 + cp, y0 + cp], [x0 + bp - cp, y0 + cp], [x0 + cp, y0 + hp - cp], [x0 + bp - cp, y0 + hp - cp]]) out.push(`<circle class="barra-ac" cx="${cx}" cy="${cy}" r="${r}"/>`);
  // Cotas: b debajo, h a la izquierda, hₑ y c arriba a la derecha
  const yb = y0 + hp + 18;
  out.push(`<line class="cota" x1="${x0}" y1="${yb}" x2="${x0 + bp}" y2="${yb}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
    + `<line class="ref" x1="${x0}" y1="${y0 + hp}" x2="${x0}" y2="${yb + 4}"/><line class="ref" x1="${x0 + bp}" y1="${y0 + hp}" x2="${x0 + bp}" y2="${yb + 4}"/>`
    + `<text x="${x0 + bp / 2}" y="${yb + 16}" text-anchor="middle">b = ${fmt(g.b, 0)}</text>`);
  const xh = x0 - 14;
  out.push(`<line class="cota" x1="${xh}" y1="${y0}" x2="${xh}" y2="${y0 + hp}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
    + `<line class="ref" x1="${x0}" y1="${y0}" x2="${xh - 4}" y2="${y0}"/><line class="ref" x1="${x0}" y1="${y0 + hp}" x2="${xh - 4}" y2="${y0 + hp}"/>`
    + `<text x="${xh - 6}" y="${y0 + hp / 2}" text-anchor="middle" transform="rotate(-90 ${xh - 6} ${y0 + hp / 2})">h = ${fmt(g.h, 0)}</text>`);
  const xr = x0 + bp + 22;
  out.push(`<line class="cota" x1="${x0 + bp - he}" y1="${y0 - 8}" x2="${x0 + bp}" y2="${y0 - 8}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
    + `<text class="fuerte" x="${xr}" y="${y0 + 4}">h<tspan baseline-shift="sub" font-size="75%">e</tspan> = ${fmt(g.he, 0)}</text>`
    + `<text x="${xr}" y="${y0 + 22}">c = ${fmt(g.c, 0)}</text>`);
  // Leyenda
  const yl = yb + 34;
  out.push(`<g class="alz-leyenda"><rect class="pared-tor" x="${x0}" y="${yl - 9}" width="18" height="10"/><text x="${x0 + 24}" y="${yl}">${t('tor.dib.pared')}</text>`
    + `<line class="en" x1="${x0 + 150}" y1="${yl - 4}" x2="${x0 + 168}" y2="${yl - 4}"/><text x="${x0 + 174}" y="${yl}">${t('tor.dib.lm')}</text></g>`);
  const W = Math.max(xr + 70, x0 + 290);
  const H = yl + 14;
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}"${topeEscala(W, H)} role="img" aria-label="${t('tor.dib.aria', fmt(g.b, 0), fmt(g.h, 0))}">${out.join('')}</svg>`;
}
