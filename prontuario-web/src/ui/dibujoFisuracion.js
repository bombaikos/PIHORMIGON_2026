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
  const y0 = 48;
  const signo = r.signo;
  const xm = !r.sinFisurar && r.e && r.e.x > 0 ? r.e.x / 1000 : null;
  const { svg, hp, bp } = capasSeccion(geo, s, { e, x0, y0, x: xm, id: 'fis', cotasCapas: false, abajo: signo < 0 });
  const out = [DEFS, svg];
  if (xm !== null && r.e.x < geo.h * 1000) {
    const Xs = (xm_) => x0 + (xm_ - e.x0m) * e.s;
    const Ys = (ym) => y0 + (ym - geo.caja.ymin) * e.s;
    const cam = geo.contornos.map((c) => 'M' + c.pts.map(([px, py]) => `${Xs(px).toFixed(2)} ${Ys(py).toFixed(2)}`).join('L') + 'Z').join('');
    const yn0 = signo > 0 ? y0 + xm * e.s : y0;
    out.push(`<clipPath id="fis-tr"><path fill-rule="evenodd" d="${cam}"/></clipPath>`);
    out.push(`<rect clip-path="url(#fis-tr)" fill="url(#rayado-t)" x="${x0}" y="${yn0}" width="${bp}" height="${hp - xm * e.s}"/>`);
  }
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
  let W = x0 + bp + 112;
  if (r.figura) {
    const mx = Math.max(Math.abs(r.figura.Mk.eArriba), Math.abs(r.figura.Mk.eAbajo), Math.abs(r.figura.Mfis.eArriba), Math.abs(r.figura.Mfis.eAbajo), 0.05);
    const ke = 38 / mx;
    const ks = 40 / Math.max(r.figura.Mk.ss, r.figura.Mfis.ss, Math.abs(r.figura.Mk.sp), 1);
    const yBarraT = signo > 0 ? y0 + hp - (r.g.ay / 1000) * sc : y0 + (r.g.ay / 1000) * sc;
    const yBarraC = signo > 0 ? y0 + (r.g.ay / 1000) * sc : y0 + hp - (r.g.ay / 1000) * sc;
    const col = (ex, F, rot) => {
      const X = (v) => ex - v * ke;
      let o = `<text x="${ex}" y="${y0 - 34}" class="fuerte" text-anchor="middle">${rot}</text>`;
      o += `<line class="ref" x1="${ex}" y1="${y0 - 2}" x2="${ex}" y2="${y0 + hp + 2}"/>`;
      const yn = F.x > 0 ? (signo > 0 ? y0 + (F.x / 1000) * sc : y0 + hp - (F.x / 1000) * sc) : (signo > 0 ? y0 : y0 + hp);
      const yc = signo > 0 ? y0 : y0 + hp;
      const yt = signo > 0 ? y0 + hp : y0;
      const eC = signo > 0 ? F.eArriba : F.eAbajo;
      const eT = signo > 0 ? F.eAbajo : F.eArriba;
      if (F.x > 0) o += `<polygon class="eps-c" points="${ex},${yc} ${X(eC)},${yc} ${ex},${yn}"/>`;
      o += `<polygon class="eps-t" points="${ex},${yn} ${X(eT)},${yt} ${ex},${yt}"/>`;
      o += `<text x="${ex}" y="${y0 - 8}" text-anchor="middle">${sub('ε', signo > 0 ? 'sup' : 'inf')} ${fmt(F.eArriba, 2)}</text>`;
      o += `<text x="${ex}" y="${y0 + hp + 16}" text-anchor="middle">${sub('ε', signo > 0 ? 'inf' : 'sup')} ${fmt(F.eAbajo, 2)}</text>`;
      const ax = ex + 6;
      o += `<line class="flecha" x1="${ax}" y1="${yBarraT}" x2="${ax + F.ss * ks}" y2="${yBarraT}" marker-end="url(#pta)"/>`;
      o += `<text class="fuerte" x="${ax + F.ss * ks + 5}" y="${yBarraT + 4}">${sub('σ', 's')} ${fmt(F.ss, 0)}</text>`;
      if (F.sp > 0.5) {
        o += `<line class="flecha" x1="${ax}" y1="${yBarraC}" x2="${ax - F.sp * ks}" y2="${yBarraC}" marker-end="url(#pta)"/>`;
        o += `<text x="${ax + 4}" y="${yBarraC - 5}">${fmt(F.sp, 0)}</text>`;
      }
      return o;
    };
    const e1 = x0 + bp + 112;
    const e2 = e1 + 138;
    out.push(col(e1, r.figura.Mfis, `${sub('M', 'fis')}(${sub('N', 'k')}) + ${sub('N', 'k')}`));
    out.push(col(e2, r.figura.Mk, `${sub('M', 'k')} + ${sub('N', 'k')}`));
    W = e2 + 120;
  }
  const H = y0 + hp + 52;
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W} ${H}"${topeEscala(W, H)} role="img" aria-label="${t('fis.dib.aria')}">${out.join('')}</svg>`;
}
