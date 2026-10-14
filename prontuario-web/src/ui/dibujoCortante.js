// Dibujo del módulo Cortante: la sección con el cerco, b0, d y z (a escala) y, a su derecha, el esquema de la
// celosía de Mörsch (cordones, bielas a θ y cercos a α) con el brazo z a la misma escala vertical.

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS, encuadre, capasSeccion } from './dibujoSeccion.js';

const mm = (x) => fmt(x * 1000, 0);
const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;

/**
 * @param {Object} geo  geometria() de la sección
 * @param {Object} sec  sección del proyecto
 * @param {{b0:number, d:number, z:number, cotTheta:number, alfa:number, neg?:boolean, sinArmadura?:boolean}} c  longitudes en m
 */
export function dibujoCortante(geo, sec, c) {
  const e = encuadre(geo, 200, 240, { completa: false });
  const x0 = 46;
  const y0 = 34;
  const { svg, hp, bp } = capasSeccion(geo, sec, { e, x0, y0, id: 'cor', cotasCapas: false, abajo: !!c.neg });
  const sc = e.s;
  const out = [DEFS, svg, `<text class="tit" x="${x0}" y="20">${t('cor.dib.sec')}</text>`];
  // Cerco, a título indicativo (recubrimiento ~ 3,5 cm), solo si hay armadura transversal
  if (!c.sinArmadura) {
    const r = 0.035 * sc;
    const forma = sec.forma;
    if (forma === 'circular') out.push(`<circle class="cerco" cx="${x0 + bp / 2}" cy="${y0 + hp / 2}" r="${Math.max(2, bp / 2 - r)}"/>`);
    else if (forma === 'T') {
      const g = sec.geo;
      const xa = x0 + ((g.b - g.bw) / 2) * sc + r;
      out.push(`<rect class="cerco" x="${xa}" y="${y0 + r}" width="${Math.max(2, g.bw * sc - 2 * r)}" height="${Math.max(2, hp - 2 * r)}" rx="3"/>`);
    } else out.push(`<rect class="cerco" x="${x0 + r}" y="${y0 + r}" width="${Math.max(2, bp - 2 * r)}" height="${Math.max(2, hp - 2 * r)}" rx="3"/>`);
  }
  // d desde la fibra más comprimida y z = 0,9 d (aquí el z del cálculo)
  const arriba = !c.neg;
  const Yc = (m) => (arriba ? y0 + m * sc : y0 + hp - m * sc);
  const xd = x0 + bp + (sec.forma === 'T' ? 44 : 14);
  out.push(`<line class="cota" x1="${xd}" y1="${Yc(0)}" x2="${xd}" y2="${Yc(c.d)}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
  out.push(`<line class="ref" x1="${x0 + bp}" y1="${Yc(c.d)}" x2="${xd + 4}" y2="${Yc(c.d)}"/>`);
  out.push(`<text class="fuerte" x="${xd + 6}" y="${(Yc(0) + Yc(c.d)) / 2 + 4}">d = ${mm(c.d)}</text>`);
  // Celosía de Mörsch a la derecha
  const xe = xd + 66;
  const cot = c.cotTheta;
  const cotA = c.alfa >= 90 ? 0 : 1 / Math.tan((c.alfa * Math.PI) / 180);
  const zp = Math.min(Math.max(c.z * sc, 70), 120);
  const p = zp * (cot + cotA);
  const ancho = 3 * p + zp * cotA + 10;
  const k = Math.min(1, 300 / ancho);
  const zk = zp * k;
  const pk = p * k;
  const yT = y0 + 18;
  const yB = yT + zk;
  out.push(`<text class="tit" x="${xe}" y="20">${t('cor.dib.celosia')}</text>`);
  out.push(`<line class="cordon" x1="${xe}" y1="${yT}" x2="${xe + 3 * pk + zk * cotA}" y2="${yT}"/>`);
  out.push(`<line class="cordon" x1="${xe}" y1="${yB}" x2="${xe + 3 * pk + zk * cotA}" y2="${yB}"/>`);
  for (let i = 0; i < 3; i++) {
    const xb = xe + i * pk;
    if (!c.sinArmadura) out.push(`<line class="tirante" x1="${xb}" y1="${yB}" x2="${xb + zk * cotA}" y2="${yT}"/>`);
    out.push(`<line class="biela" x1="${xb + zk * cotA}" y1="${yT}" x2="${xb + pk}" y2="${yB}"/>`);
  }
  if (!c.sinArmadura) out.push(`<line class="tirante" x1="${xe + 3 * pk}" y1="${yB}" x2="${xe + 3 * pk + zk * cotA}" y2="${yT}"/>`);
  // Cotas: z a la derecha del esquema, ángulo θ en el primer nudo inferior de la biela
  const xz = xe + 3 * pk + zk * cotA + 12;
  out.push(`<line class="cota" x1="${xz}" y1="${yT}" x2="${xz}" y2="${yB}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
  out.push(`<text class="fuerte" x="${xz + 6}" y="${(yT + yB) / 2 + 4}">z = ${mm(c.z)}</text>`);
  const th = (Math.atan(1 / cot) * 180) / Math.PI;
  out.push(`<text x="${xe + pk - 22}" y="${yB - 6}" text-anchor="end">θ = ${fmt(th, 1)}°</text>`);
  if (!c.sinArmadura) out.push(`<text x="${xe + 4}" y="${yB + 16}">α = ${fmt(c.alfa, 0)}°</text>`);
  const y2 = yB + 36;
  out.push(`<g><line class="biela" x1="${xe}" y1="${y2}" x2="${xe + 22}" y2="${y2}"/><text x="${xe + 28}" y="${y2 + 4}">${t('cor.dib.biela')}</text></g>`);
  if (!c.sinArmadura) out.push(`<g><line class="tirante" x1="${xe}" y1="${y2 + 18}" x2="${xe + 22}" y2="${y2 + 18}"/><text x="${xe + 28}" y="${y2 + 22}">${t('cor.dib.cercos')}</text></g>`);
  const W = Math.max(xe + 3 * pk + zk * cotA + 90, xe + 150);
  const H = Math.max(y0 + hp + (sec.forma === 'T' ? 92 : 64), y2 + 36);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${t('cor.dib.aria', mm(c.b0), mm(c.d))}">${out.join('')}</svg>`;
}
