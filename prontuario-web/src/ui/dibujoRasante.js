// Dibujo del módulo Rasante en juntas: alzado de la junta entre el hormigón 1 (primera fase) y el hormigón 2
// (segunda fase) con las barras de cosido a su ángulo α y separación s (a escala horizontal), el esfuerzo rasante R_Ed y
// la longitud de comprobación L. Los textos van en la leyenda de debajo y en rótulos de 10 px (guía § 8).

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS } from './dibujoSeccion.js';

const ANCHO = 420;
const MAX_BARRAS = 14;

/**
 * @param {{alfa:number, sinAlfa?:boolean, L:number, s:number, sinArmadura:boolean, rugosa:boolean, REd:number, b:number, leyenda:[string,string][]}} o
 *   L, s y b en mm; leyenda: pares [clave de muestra, texto]
 */
export function dibujoRasante(o) {
  const x0 = 24;
  const x1 = ANCHO - 24;
  const yJ = 118; // la junta
  const ancho = x1 - x0;
  const out = [DEFS];
  out.push(`<defs><clipPath id="ras-clip"><rect x="${x0}" y="40" width="${ancho}" height="156"/></clipPath></defs>`);
  // Hormigón 2 (arriba, segunda fase) y hormigón 1 (abajo)
  out.push(`<rect class="hor hor-2" x="${x0}" y="52" width="${ancho}" height="${yJ - 52}"/>`);
  out.push(`<rect class="hor" x="${x0}" y="${yJ}" width="${ancho}" height="${186 - yJ}"/>`);
  out.push(`<text class="tit" x="${x0 + 6}" y="68">${t('ras.dib.h2')}</text>`);
  out.push(`<text class="tit" x="${x1 - 6}" y="178" text-anchor="end">${t('ras.dib.h1')}</text>`);
  // Junta, con rugosidad (diente de sierra) si la superficie es rugosa
  if (o.rugosa) {
    let d = `M${x0} ${yJ}`;
    for (let x = x0 + 5; x <= x1 + 0.1; x += 10) d += `L${x} ${yJ - 3}L${Math.min(x + 5, x1)} ${yJ + 2}`;
    out.push(`<path class="junta" d="${d}"/>`);
  } else out.push(`<line class="junta" x1="${x0}" y1="${yJ}" x2="${x1}" y2="${yJ}"/>`);
  // Cosido: barras que cruzan la junta, a escala de s (con un máximo de barras dibujadas)
  const n = o.sinArmadura ? 0 : Math.max(1, Math.floor(o.L / o.s + 1e-9));
  const dibujar = Math.min(n, MAX_BARRAS);
  const paso = o.s > 0 ? Math.max(ancho / Math.max(o.L / o.s, 1), 10) : 20;
  const k = Math.min(1, ancho / (Math.max(dibujar - 1, 1) * paso + paso));
  const sPx = o.sinArmadura ? 0 : paso * k;
  if (!o.sinArmadura) {
    const a = (o.alfa * Math.PI) / 180;
    const lv = 34; // semilongitud de cada barra, en píxeles
    const dx = Math.cos(a) * lv;
    const dy = Math.sin(a) * lv;
    const xIni = x0 + (ancho - (dibujar - 1) * sPx) / 2;
    out.push('<g clip-path="url(#ras-clip)">');
    for (let i = 0; i < dibujar; i++) {
      const xc = xIni + i * sPx;
      out.push(`<line class="barra-cos" x1="${(xc - dx).toFixed(1)}" y1="${(yJ + dy).toFixed(1)}" x2="${(xc + dx).toFixed(1)}" y2="${(yJ - dy).toFixed(1)}"/>`);
    }
    out.push('</g>');
    // Cota de la separación entre las dos primeras barras
    if (dibujar >= 2) {
      const xa = xIni;
      const xb = xIni + sPx;
      out.push(`<line class="ref" x1="${xa}" y1="${yJ + 36}" x2="${xa}" y2="${yJ + 58}"/><line class="ref" x1="${xb}" y1="${yJ + 36}" x2="${xb}" y2="${yJ + 58}"/>`);
      out.push(`<line class="cota" x1="${xa}" y1="${yJ + 52}" x2="${xb}" y2="${yJ + 52}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
      out.push(`<text class="fuerte" x="${(xa + xb) / 2}" y="${yJ + 66}" text-anchor="middle">s = ${fmt(o.s, 0)}</text>`);
    }
    // Ángulo α en la primera barra (sobre el plano de la junta)
    const xa0 = xIni;
    if (!o.sinAlfa) out.push(`<text x="${(xa0 + 8).toFixed(1)}" y="${yJ - 6}">α = ${fmt(o.alfa, 0)}°</text>`);
  }
  // Longitud de comprobación L, por debajo
  const yL = 206;
  out.push(`<line class="ref" x1="${x0}" y1="${186}" x2="${x0}" y2="${yL + 6}"/><line class="ref" x1="${x1}" y1="${186}" x2="${x1}" y2="${yL + 6}"/>`);
  out.push(`<line class="cota" x1="${x0}" y1="${yL}" x2="${x1}" y2="${yL}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
  out.push(`<text class="fuerte" x="${(x0 + x1) / 2}" y="${yL + 14}" text-anchor="middle">L = ${fmt(o.L, 0)} mm · b = ${fmt(o.b, 0)} mm</text>`);
  // Esfuerzo rasante: flechas opuestas en cada hormigón
  const fl = (x, y, dir) => `<line class="fuerza" x1="${x}" y1="${y}" x2="${x + dir * 52}" y2="${y}" marker-end="url(#pta)"/>`;
  out.push(fl(x0 + 70, 42, 1), `<text class="fuerte" x="${x0 + 128}" y="46">R<tspan baseline-shift="sub" font-size="75%">Ed</tspan> = ${fmt(o.REd, 0)} kN</text>`);
  out.push(fl(x1 - 70, 196, -1));
  // Leyenda dentro del SVG
  let yLey = yL + 34;
  const muestras = {
    junta: '<line class="junta" x1="0" y1="0" x2="22" y2="0"/>',
    cosido: '<line class="barra-cos" x1="3" y1="6" x2="19" y2="-6"/>',
    h2: '<rect class="hor hor-2" x="4" y="-5" width="14" height="10"/>',
    h1: '<rect class="hor" x="4" y="-5" width="14" height="10"/>',
  };
  for (const [kk, texto] of o.leyenda) {
    out.push(`<g transform="translate(14 ${yLey})">${muestras[kk] ?? ''}<text x="30" y="4">${texto}</text></g>`);
    yLey += 20;
  }
  return `<svg class="dib dib-ras" preserveAspectRatio="xMinYMin meet" viewBox="0 36 ${ANCHO} ${Math.ceil(yLey) - 36}" role="img" aria-label="${t('ras.dib.aria')}">${out.join('')}</svg>`;
}
