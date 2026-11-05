// Esquemas (sin escala) del módulo Anclaje y solapo: formas de anclaje (prolongación recta, patilla, gancho, U) y solapo,
// con las cotas que da la norma, y la esquina de una viga con la definición del recubrimiento cd.

import { t } from './i18n.js';

const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;
const tic = '<defs><marker id="tic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" class="tic"/></marker></defs>';
const cotaH = (x1, x2, y, texto, dy = 13) => `<line class="cota" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
  + (texto ? `<text x="${(x1 + x2) / 2}" y="${y + dy}" text-anchor="middle" class="fuerte">${texto}</text>` : '');
const cotaV = (x, y1, y2) => `<line class="cota" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#tic)" marker-end="url(#tic)"/>`;
const ref = (x1, y1, x2, y2) => `<line class="ref" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const tit = (x, y, s) => `<text class="tit" x="${x}" y="${y}">${s}</text>`;
const barra = (d) => `<path class="barra-lin" d="${d}"/>`;
const g = (x, y, s) => `<g transform="translate(${x} ${y})">${s}</g>`;
const hor = (x, y, w, h) => `<rect class="hor" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
/** Radio interior de la curva: de su centro a un punto de la curva a 45°. */
const radio = (cx, cy, r, tx, ty) => `<line class="cota" x1="${cx}" y1="${cy}" x2="${(cx + r * 0.7).toFixed(1)}" y2="${(cy - r * 0.7).toFixed(1)}"/><text x="${tx}" y="${ty}">r</text>`;

const recta = () => tit(0, 10, t('an.dib.t.recta')) + hor(10, 16, 180, 40) + barra('M0 36 H170')
  + ref(10, 56, 10, 72) + ref(170, 56, 170, 72) + cotaH(10, 170, 68, sub('l', 'bd'));

const patilla = () => tit(0, 10, t('an.dib.t.patilla')) + hor(10, 16, 170, 64) + barra('M0 30 H120 A14 14 0 0 1 134 44 V68')
  + radio(120, 44, 14, 109, 54) + cotaV(148, 44, 68) + `<text x="153" y="60">≥ 5 ø</text>`
  + `<text x="140" y="34">90°</text>`
  + ref(10, 80, 10, 96) + ref(134, 68, 134, 96) + cotaH(10, 134, 92, sub('l', 'bd'));

const gancho = () => tit(0, 10, t('an.dib.t.gancho')) + hor(10, 16, 180, 64) + barra('M0 30 H132 A14 14 0 0 1 132 58 H106')
  + radio(132, 44, 14, 121, 52) + cotaH(106, 132, 70, null) + `<text x="138" y="73">≥ 5 ø</text>`
  + `<text x="152" y="48">α ≥ 150°</text>`
  + ref(10, 80, 10, 96) + ref(132, 60, 132, 96) + cotaH(10, 132, 92, sub('l', 'bd'));

const u = () => tit(0, 10, t('an.dib.t.u')) + hor(10, 16, 180, 46) + barra('M0 26 H128 A12 12 0 0 1 128 50 H0')
  + radio(128, 38, 12, 116, 44) + ref(10, 62, 10, 78) + ref(128, 50, 128, 78) + cotaH(10, 128, 74, sub('l', 'bd'));

const solapo = (w) => tit(0, 10, t('an.dib.t.solapo')) + hor(10, 16, w - 10, 46) + barra(`M0 31 H${w * 0.62}`) + barra(`M${w * 0.32} 47 H${w}`)
  + cotaV(24, 31, 47) + `<text x="30" y="45">${t('an.dib.sep')}</text>`
  + ref(w * 0.32, 62, w * 0.32, 78) + ref(w * 0.62, 62, w * 0.62, 78) + cotaH(w * 0.32, w * 0.62, 74, sub('l', 's'));

export function dibujoAnclaje({ esfuerzo }) {
  const comp = esfuerzo === 'compresion';
  let s;
  let alto;
  if (comp) {
    // En compresión las patillas, ganchos y U no contribuyen (EC-2 8.4.1(3))
    s = g(0, 0, recta()) + g(0, 100, solapo(400));
    alto = 200;
  } else {
    s = g(0, 0, recta()) + g(210, 0, patilla()) + g(0, 112, gancho()) + g(210, 112, u()) + g(0, 224, solapo(400));
    alto = 322;
  }
  return `<svg class="dib dib-anclaje" viewBox="0 0 400 ${alto}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${t('an.dib.aria')}">${tic}${s}</svg>`;
}

/**
 * Esquina inferior de una viga en sección: cerco, la armadura longitudinal que se ancla y la contigua, con el recubrimiento lateral,
 * el inferior y la separación libre entre barras, de los que sale cd = mín(a/2; cx; cy).
 */
export function dibujoRecubrimiento() {
  const bar = (cx, cy, extra = '') => `<circle class="barra-ac${extra}" cx="${cx}" cy="${cy}" r="10"/>`;
  let s = '';
  s += `<rect class="hor" x="50" y="18" width="240" height="152"/>`;
  s += `<path class="cerco" d="M280 40 H76.5 Q64.5 40 64.5 52 V143.5 Q64.5 155.5 76.5 155.5 H280"/>`;
  s += bar(77.5, 142.5) + bar(127.5, 142.5);
  // recubrimiento lateral cx e inferior cy (a la superficie de la barra) y separación libre a
  s += ref(50, 170, 50, 188) + ref(67.5, 152.5, 67.5, 188) + cotaH(50, 67.5, 184, null)
    + `<text x="46" y="188" text-anchor="end" class="fuerte">${sub('c', 'x')}</text>`;
  s += ref(22, 170, 50, 170) + ref(22, 152.5, 77.5, 152.5) + cotaV(28, 152.5, 170)
    + `<text x="22" y="164" text-anchor="end" class="fuerte">${sub('c', 'y')}</text>`;
  s += ref(87.5, 142.5, 87.5, 126) + ref(117.5, 142.5, 117.5, 126) + cotaH(87.5, 117.5, 130, null)
    + `<text x="102.5" y="123" text-anchor="middle" class="fuerte">a</text>`;
  // etiquetas con guía
  s += `<line class="cota" x1="112" y1="106" x2="84" y2="133"/><text x="116" y="84">${t('an.dib.long1')}</text><text x="116" y="100">${t('an.dib.long2')}</text>`;
  s += `<text x="180" y="33">${t('an.dib.cerco')}</text>`;
  return `<svg class="dib dib-cd" viewBox="0 12 296 190" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${t('an.dib.ariaCd')}">${tic}${s}</svg>`;
}
