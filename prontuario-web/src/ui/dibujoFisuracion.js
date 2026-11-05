// Dibujo del módulo Fisuración: la sección a escala con la zona comprimida rayada, la fibra neutra, el área eficaz
// A_c,ef junto a la cara traccionada (con h_ef acotada) y las barras. Compresión arriba si M > 0, abajo si M < 0.

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS, SECCION_MAX, topeEscala, encuadre, capasSeccion } from './dibujoSeccion.js';

const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;

/**
 * @param {Object} geo  geometría de la sección (m)
 * @param {Object} s    sección del proyecto
 * @param {{signo:number, e?:{x:number}, sinFisurar?:boolean}} r  resultado de fisuraSeccion
 * @param {number|null} hef  profundidad del área eficaz [mm] de la norma del proyecto
 */
export function dibujoFisuracion(geo, s, r, hef) {
  const e = encuadre(geo, SECCION_MAX, SECCION_MAX, { completa: true });
  const x0 = 46;
  const y0 = 16;
  const signo = r.signo;
  const xm = !r.sinFisurar && r.e && r.e.x > 0 ? r.e.x / 1000 : null;
  const { svg, hp, bp } = capasSeccion(geo, s, { e, x0, y0, x: xm, id: 'fis', cotasCapas: false, abajo: signo < 0 });
  const out = [DEFS, svg];
  const sc = e.s;
  const yTrac = signo > 0 ? y0 + hp : y0;
  const dir = signo > 0 ? -1 : 1;
  if (hef) {
    const X = (xm_) => x0 + (xm_ - e.x0m) * sc;
    const Y = (ym) => y0 + (ym - geo.caja.ymin) * sc;
    const camino = geo.contornos.map((c) => 'M' + c.pts.map(([px, py]) => `${X(px).toFixed(2)} ${Y(py).toFixed(2)}`).join('L') + 'Z').join('');
    const alto = Math.min(hef / 1000 * sc, hp);
    const yIni = signo > 0 ? y0 + hp - alto : y0;
    out.push(`<clipPath id="fis-ef"><path fill-rule="evenodd" d="${camino}"/></clipPath>`);
    out.push(`<rect class="acef" clip-path="url(#fis-ef)" x="${x0}" y="${yIni}" width="${bp}" height="${alto}"/>`);
    const xc = x0 + bp + 16;
    const y2 = yTrac + dir * alto;
    out.push(`<line class="cota" x1="${xc}" y1="${yTrac}" x2="${xc}" y2="${y2}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
      + `<line class="ref" x1="${x0 + bp + 2}" y1="${y2}" x2="${xc + 4}" y2="${y2}"/>`
      + `<text x="${xc + 7}" y="${(yTrac + y2) / 2 + 4}">${sub('h', 'ef')} = ${fmt(hef, 0)}</text>`);
  }
  if (xm !== null && r.e.x < geo.h * 1000) {
    const yn = signo > 0 ? y0 + xm * sc : y0 + hp - xm * sc;
    out.push(`<line class="en" x1="${x0 - 8}" y1="${yn}" x2="${x0 + bp + 8}" y2="${yn}"/>`);
    out.push(`<text class="fuerte" x="${x0 + bp / 2}" y="${yn + (signo > 0 ? -5 : 15)}" text-anchor="middle">x = ${fmt(r.e.x, 0)}</text>`);
  }
  const W = x0 + bp + 112;
  const H = y0 + hp + 52;
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W} ${H}"${topeEscala(W, H)} role="img" aria-label="${t('fis.dib.aria')}">${out.join('')}</svg>`;
}
