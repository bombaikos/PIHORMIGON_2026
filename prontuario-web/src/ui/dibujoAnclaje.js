// Esquema (sin escala) del módulo Anclaje y solapo: barra recta anclada, barra con patilla y solapo de dos barras,
// con las cotas l_bd y l_s y la separación máxima entre barras solapadas.

import { t } from './i18n.js';

const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;
const cotaH = (x1, x2, y, texto) => `<line class="cota" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
  + `<text x="${(x1 + x2) / 2}" y="${y + 13}" text-anchor="middle" class="fuerte">${texto}</text>`;
const ref = (x, y1, y2) => `<line class="ref" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`;
const tit = (x, y, s) => `<text class="tit" x="${x}" y="${y}">${s}</text>`;
const barra = (d) => `<path class="barra-lin" d="${d}"/>`;

export function dibujoAnclaje({ esfuerzo }) {
  const comp = esfuerzo === 'compresion';
  let s = '';
  // 1. Anclaje en prolongación recta
  s += tit(12, 14, t('an.dib.anclaje'));
  s += `<rect class="hor" x="12" y="20" width="236" height="34"/>`;
  s += barra('M12 37 H236') + `<circle class="barra-ac" cx="236" cy="37" r="0"/>`;
  s += ref(24, 54, 70) + ref(236, 54, 70) + cotaH(24, 236, 66, sub('l', 'bd'));
  // 2. Patilla (solo en tracción)
  if (!comp) {
    s += tit(12, 106, t('an.dib.gancho'));
    s += `<rect class="hor" x="12" y="112" width="236" height="52"/>`;
    s += barra('M12 128 H200 Q216 128 216 144 V156');
    s += ref(24, 164, 178) + ref(216, 164, 178) + cotaH(24, 216, 174, sub('l', 'bd'));
  }
  // 3. Solapo
  const y0 = comp ? 112 : 208;
  s += tit(12, y0 - 6, t('an.dib.solapo'));
  s += `<rect class="hor" x="12" y="${y0}" width="236" height="46"/>`;
  s += barra(`M12 ${y0 + 15} H176`) + barra(`M84 ${y0 + 29} H248`);
  s += `<line class="cota" x1="28" y1="${y0 + 15}" x2="28" y2="${y0 + 29}" marker-start="url(#tic)" marker-end="url(#tic)"/><text x="34" y="${y0 + 26}" class="nota-d">${t('an.dib.sep')}</text>`;
  s += ref(84, y0 + 46, y0 + 60) + ref(176, y0 + 46, y0 + 60) + cotaH(84, 176, y0 + 56, sub('l', 's'));
  const alto = comp ? 190 : 288;
  return `<svg class="dib dib-anclaje" viewBox="0 0 260 ${alto}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('an.dib.aria')}">`
    + `<defs><marker id="tic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" class="tic"/></marker></defs>${s}</svg>`;
}
