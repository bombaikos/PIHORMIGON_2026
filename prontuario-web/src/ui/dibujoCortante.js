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
  // Alzado de la viga a la derecha: hormigón en gris, cordones, bielas como bandas paralelas a θ y cercos como bandas
  // paralelas a α, todo a la misma escala vertical que la sección (cordones centrados en d − z y d)
  const xe = xd + 78;
  const ANCHO = 300;
  const cot = c.cotTheta;
  const cotA = c.alfa >= 90 ? 0 : 1 / Math.tan((c.alfa * Math.PI) / 180);
  const dz = Math.max(0, c.d - c.z); // profundidad del centro del cordón comprimido
  const yC = Yc(dz); // eje del cordón comprimido
  const yA = Yc(c.d); // eje del cordón traccionado (la armadura)
  const sg = arriba ? 1 : -1;
  const zp = Math.abs(yA - yC);
  const hc = Math.max(4, 2 * dz * sc); // canto del cordón comprimido
  const yLo = Math.min(yC, yA);
  const yHi = Math.max(yC, yA);
  const X = (x) => xe + ANCHO - x; // bielas «/»: suben hacia la derecha (se dibuja el espejo)
  const poli = (...pts) => pts.map(([x, y]) => `${X(x).toFixed(1)},${y.toFixed(1)}`).join(' ');
  const clip = `cl-cor`;
  out.push(`<text class="tit" x="${xe}" y="20">${t('cor.dib.celosia')}</text>`);
  out.push(`<defs><clipPath id="${clip}"><rect x="${xe}" y="${y0}" width="${ANCHO}" height="${hp}"/></clipPath>` +
    `<pattern id="rayado-biela" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${(90 + (Math.atan(1 / cot) * 180) / Math.PI).toFixed(1)})"><line x1="0" y1="0" x2="0" y2="5" class="rayo-biela"/></pattern></defs>`);
  out.push(`<rect class="alz-horm" x="${xe}" y="${y0}" width="${ANCHO}" height="${hp}"/><g clip-path="url(#${clip})">`);
  const pxS = Math.max(5, (c.s ?? 0.2) * sc); // paso horizontal de los cercos (mínimo legible)
  const pb = c.sinArmadura ? Math.max(pxS, zp * cot * 0.9) : pxS; // sin cercos, bielas separadas por un paso razonable
  const wb = pb * 0.45;
  const y1 = yLo;
  const y2 = yHi;
  const proy = zp * cot;
  for (let x = -proy - pb; x < ANCHO + pb + proy; x += pb) {
    // biela: parte de arriba (cordón comprimido) hacia abajo; con M negativo el cordón comprimido está abajo y la banda se invierte
    const pts = poli([x, y1], [x + wb, y1], [x + proy + wb, y2], [x + proy, y2]);
    out.push(`<polygon class="alz-biela" points="${pts}"/><polygon points="${pts}" fill="url(#rayado-biela)"/>`);
  }
  out.push(`<rect class="alz-cordon" x="${xe}" y="${arriba ? Yc(0) : Yc(0) - hc}" width="${ANCHO}" height="${hc}"/>`);
  out.push(`<line class="alz-arm" x1="${xe}" y1="${yA}" x2="${xe + ANCHO}" y2="${yA}"/>`);
  const pa = zp * cotA;
  if (!c.sinArmadura) for (let x = -pa + pxS / 2; x < ANCHO + pxS; x += pxS) {
    out.push(`<polygon class="alz-cerco" points="${poli([x, y2], [x + 3.5, y2], [x + 3.5 + pa, y1], [x + pa, y1])}"/>`);
  }
  out.push('</g>');
  // z a la derecha
  const xz = xe + ANCHO + 12;
  out.push(`<line class="cota" x1="${xz}" y1="${yC}" x2="${xz}" y2="${yA}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
  out.push(`<text class="fuerte" x="${xz + 6}" y="${(yC + yA) / 2 + 4}">z = ${mm(c.z)}</text>`);
  // Ángulos sobre el eje de la armadura: θ lo cierra una línea fina con la inclinación de la biela; α lo cierra el propio cerco
  const th = (Math.atan(1 / cot) * 180) / Math.PI;
  const RAD = Math.PI / 180;
  const arco = (cx, cy, r, a0, a1) => {
    const f = (a) => [cx + r * Math.cos(a * RAD), cy - sg * r * Math.sin(a * RAD)];
    const [ax, ay] = f(a0);
    const [bx, by] = f(a1);
    return `<path class="alz-ang" d="M${ax.toFixed(1)},${ay.toFixed(1)} A${r},${r} 0 0 ${arriba ? 0 : 1} ${bx.toFixed(1)},${by.toFixed(1)}"/>`;
  };
  const pieB = [];
  for (let x = -proy - pb; x < ANCHO + pb + proy; x += pb) pieB.push(x + proy + wb / 2); // pie de cada biela sobre la armadura
  const cerca = (arr, xx) => arr.reduce((m, v) => (Math.abs(X(v) - xx) < Math.abs(X(m) - xx) ? v : m));
  const ct = X(cerca(pieB, xe + ANCHO * 0.62));
  const r0 = 30;
  out.push(`<line class="alz-ref" x1="${ct - 8}" y1="${yA}" x2="${ct + r0 + 16}" y2="${yA}"/>` +
    `<line class="alz-ref" x1="${ct}" y1="${yA}" x2="${ct + (r0 + 12) * Math.cos(th * RAD)}" y2="${yA - sg * (r0 + 12) * Math.sin(th * RAD)}"/>` + arco(ct, yA, r0, 0, th) +
    `<text class="alz-txt" x="${ct + r0 + 8}" y="${yA - sg * 6}">θ = ${fmt(th, 1)}°</text>`);
  if (!c.sinArmadura) {
    const pies = [];
    for (let x = -pa + pxS / 2; x < ANCHO + pxS; x += pxS) pies.push(x + 1.75);
    const ca = X(cerca(pies, xe + ANCHO * 0.28));
    // α se mide entre el eje de la viga y el cerco, hacia el lado de la compresión
    out.push(`<line class="alz-ref" x1="${ca - r0 - 16}" y1="${yA}" x2="${ca + 8}" y2="${yA}"/>` + arco(ca, yA, r0, 180 - c.alfa, 180) +
      `<text class="alz-txt" x="${ca - r0 - 8}" y="${yA - sg * 6}" text-anchor="end">α = ${fmt(c.alfa, 0)}°</text>`);
  }
  const y3 = y0 + hp + 24;
  out.push(`<g class="alz-leyenda"><rect class="alz-biela" x="${xe}" y="${y3 - 9}" width="18" height="10"/><text x="${xe + 24}" y="${y3}">${t('cor.dib.biela')}</text>` +
    (c.sinArmadura ? '' : `<rect class="alz-cerco" x="${xe + 176}" y="${y3 - 6}" width="18" height="4"/><text x="${xe + 200}" y="${y3}">${t('cor.dib.cercos')}</text>`) + '</g>');
  const W = xe + ANCHO + 90;
  const H = Math.max(y0 + hp + (sec.forma === 'T' ? 92 : 64), y3 + 14);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${t('cor.dib.aria', mm(c.b0), mm(c.d))}">${out.join('')}</svg>`;
}
