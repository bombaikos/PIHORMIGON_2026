// Dibujo de cualquier sección del modelo único (guía de estilo §8): escala igual en x e y,
// barras a su diámetro y posición reales, armadura dada como área en franja equivalente,
// cotas en mm y, si la sección es apaisada (b > 2h), un tramo de ancho 2h con líneas de rotura.

import { fmt, ESP } from './formato.js';
import { t } from './i18n.js';

export const DEFS = `<defs>
  <pattern id="rayado" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" class="rayas"><line x1="0" y1="0" x2="0" y2="6"/></pattern>
  <pattern id="rayado-t" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)" class="rayas-t"><line x1="0" y1="0" x2="0" y2="5"/></pattern>
  <marker id="pta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" class="punta"/></marker>
  <marker id="tic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" class="tic"/></marker>
</defs>`;

const mm = (x) => fmt(x * 1000, 0);
const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;

function cotaH(x1, x2, y, texto, yRef) {
  return `<line class="cota" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
    + (yRef !== undefined ? `<line class="ref" x1="${x1}" y1="${yRef}" x2="${x1}" y2="${y + 4}"/><line class="ref" x1="${x2}" y1="${yRef}" x2="${x2}" y2="${y + 4}"/>` : '')
    + `<text x="${(x1 + x2) / 2}" y="${y + 15}" text-anchor="middle">${texto}</text>`;
}
function cotaV(x, y1, y2, texto, xRef, lado = 'izq') {
  const tx = lado === 'izq' ? x - 6 : x + 12;
  return `<line class="cota" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
    + (xRef !== undefined ? `<line class="ref" x1="${x - 4}" y1="${y1}" x2="${xRef}" y2="${y1}"/><line class="ref" x1="${x - 4}" y1="${y2}" x2="${xRef}" y2="${y2}"/>` : '')
    + `<text x="${tx}" y="${(y1 + y2) / 2}" text-anchor="middle" transform="rotate(-90 ${tx} ${(y1 + y2) / 2})">${texto}</text>`;
}

/**
 * Escala y encuadre para una caja de dibujo.
 * @param {{completa?: boolean, desp?: number}} [o]  completa: dibuja toda la anchura; desp: posición del tramo (0 izquierda, 1 derecha)
 * @returns {{s:number, tramo:boolean, bDib:number, x0m:number}}  s en px/m; x0m = x (m) del borde izquierdo dibujado
 */
export function encuadre(geo, anchoMax, altoMax, { completa = false, desp = 0.5 } = {}) {
  const { xmin, xmax } = geo.caja;
  const b = xmax - xmin;
  // Las secciones muy anchas se dibujan por un tramo salvo que se pida completa
  const tramo = !completa && b > 2 * geo.h;
  const bDib = tramo ? 2 * geo.h : b;
  const s = Math.min(altoMax / geo.h, anchoMax / bDib);
  // desp (0 a 1) desliza el tramo dibujado a lo ancho de la sección
  return { s, tramo, bDib, x0m: tramo ? xmin + desp * (b - bDib) : xmin };
}

/**
 * Capas SVG de la sección colocadas en (x0, y0) px con escala e.
 * @param {Object} geo  geometria(s)
 * @param {Object} s    sección del proyecto (para las cotas propias de cada forma)
 * @param {Object} o    {e: encuadre, x0, y0, x: profundidad de la fibra neutra (m) o null, id: prefijo único, abajo: la zona comprimida está en la cara inferior}
 */
export function capasSeccion(geo, sec, { e, x0, y0, x = null, id = 'd', cotasCapas = true, abajo = false }) {
  const { s, tramo, bDib, x0m } = e;
  const X = (xm) => x0 + (xm - x0m) * s;
  const Y = (ym) => y0 + (ym - geo.caja.ymin) * s;
  const hp = geo.h * s;
  const bp = bDib * s;
  const out = [];
  out.push(`<clipPath id="${id}-rec"><rect x="${x0 - 0.5}" y="${y0 - 0.5}" width="${bp + 1}" height="${hp + 1}"/></clipPath>`);
  const camino = geo.contornos.map((c) => 'M' + c.pts.map(([px, py]) => `${X(px).toFixed(2)} ${Y(py).toFixed(2)}`).join('L') + 'Z').join('');
  out.push(`<g clip-path="url(#${id}-rec)"><path class="hor" fill-rule="evenodd" d="${camino}"/>`);
  if (x !== null && Number.isFinite(x) && x > 0) {
    out.push(`<clipPath id="${id}-hor"><path fill-rule="evenodd" d="${camino}"/></clipPath>`);
    out.push(`<rect class="zc" clip-path="url(#${id}-hor)" x="${x0}" y="${abajo ? y0 + hp - Math.min(x, geo.h) * s : y0}" width="${bp}" height="${Math.min(x, geo.h) * s}"/>`);
  }
  out.push('</g>');
  if (tramo) {
    const zig = (px) => { const a = hp / 2, k = 5; return `M${px} ${y0 - 4} L${px} ${y0 + a - 8} L${px - k} ${y0 + a - 3} L${px + k} ${y0 + a + 3} L${px} ${y0 + a + 8} L${px} ${y0 + hp + 4}`; };
    out.push(`<path class="tapa" d="M${x0 - 1} ${y0} h2 v${hp} h-2z"/><path class="tapa" d="M${x0 + bp - 1} ${y0} h2 v${hp} h-2z"/>`);
    out.push(`<path class="corte" d="${zig(x0)}"/><path class="corte" d="${zig(x0 + bp)}"/>`);
  }
  // Armadura por grupos (data-ref para resaltar a la vez en dibujo y tabla)
  const grupos = new Set([...geo.barras.map((b) => b.grupo), ...geo.franjas.map((f) => f.grupo)]);
  for (const g of grupos) {
    let txt = `<g class="grp-ac" data-ref="g${g}" clip-path="url(#${id}-rec)">`;
    for (const b of geo.barras.filter((q) => q.grupo === g)) {
      const c = `<circle class="barra-ac" cx="${X(b.x).toFixed(2)}" cy="${Y(b.y).toFixed(2)}" r="${Math.max(1.8, (b.fi / 2000) * s).toFixed(2)}"><title>ø${b.fi}</title></circle>`;
      txt += b.cara === undefined ? c : `<g class="grp-ac" data-ref="c${b.cara}">${c}</g>`;
    }
    for (const f of geo.franjas.filter((q) => q.grupo === g)) {
      const esp = Math.max(1.5, (f.A / Math.max(f.x2 - f.x1, 0.01)) * s);
      const hayBarras = geo.barras.some((q) => q.grupo === g);
      txt += `<rect class="franja-ac" x="${X(f.x1)}" y="${Y(f.y) + (hayBarras ? 5 : 0) - esp / 2}" width="${Math.max(2, (f.x2 - f.x1) * s)}" height="${esp}"><title>${fmt(f.A * 1e6, 0)}${ESP}mm²</title></rect>`;
    }
    out.push(txt + '</g>');
  }
  // Secciones genéricas: cada cara del contorno exterior se resalta con su fila de la rejilla
  if (sec.forma === 'generica') {
    const P = geo.contornos[0].pts;
    P.forEach(([xa, ya], i) => {
      const [xb, yb] = P[(i + 1) % P.length];
      out.push(`<g class="cara-ref" data-ref="c${i}"><line x1="${X(xa).toFixed(2)}" y1="${Y(ya).toFixed(2)}" x2="${X(xb).toFixed(2)}" y2="${Y(yb).toFixed(2)}"/>`
        + `<circle cx="${X(xa).toFixed(2)}" cy="${Y(ya).toFixed(2)}" r="3"/><title>${t('geo.caraN', i + 1)} · ${fmt(Math.hypot(xb - xa, yb - ya) * 1000, 0)} mm</title></g>`);
    });
    // Número de cada lado, por fuera del contorno. Con muchos lados (arcos) solo los largos
    const lados = P.map(([xa, ya], i) => { const [xb, yb] = P[(i + 1) % P.length]; return { i, xa, ya, xb, yb, L: Math.hypot(xb - xa, yb - ya) }; });
    const per = lados.reduce((a, l) => a + l.L, 0);
    const area2 = lados.reduce((a, l) => a + (l.xa * l.yb - l.xb * l.ya), 0);
    const sg = area2 > 0 ? 1 : -1; // en ejes y hacia abajo el sentido se invierte: la normal exterior sale de aquí
    for (const l of lados) {
      if (P.length > 40 && l.L < 0.03 * per) continue;
      const mx = X((l.xa + l.xb) / 2);
      const my = Y((l.ya + l.yb) / 2);
      const dx = X(l.xb) - X(l.xa);
      const dy = Y(l.yb) - Y(l.ya);
      const n = Math.hypot(dx, dy) || 1;
      out.push(`<text class="num-cara" x="${(mx + (sg * dy) / n * 9).toFixed(1)}" y="${(my - (sg * dx) / n * 9 + 3).toFixed(1)}" text-anchor="middle">${l.i + 1}</text>`);
    }
  }
  // Cotas
  const b = geo.caja.xmax - geo.caja.xmin;
  const yC = y0 + hp + 22;
  if (sec.forma === 'circular') {
    out.push(cotaH(x0, x0 + bp, yC, `D = ${mm(sec.geo.D)}`, y0 + hp / 2));
  } else {
    out.push(cotaH(x0, x0 + bp, yC, tramo ? `b = ${mm(b)} (${t('dib.tramo')} ${mm(bDib)})` : `b = ${mm(b)}`, y0 + hp + 6));
  }
  if (sec.forma !== 'circular') out.push(cotaV(x0 - 24, y0, y0 + hp, `h = ${mm(geo.h)}`, x0 - 6));
  if (sec.forma === 'T' && !tramo) {
    const a = X((b - sec.geo.bw) / 2);
    out.push(cotaH(a, a + sec.geo.bw * s, yC + 26, `${sub('b', 'w')} = ${mm(sec.geo.bw)}`, y0 + hp + 6));
  }
  if (sec.forma === 'T') out.push(cotaV(x0 + bp + 14, y0, y0 + sec.geo.hf * s, `${sub('h', 'f')} = ${mm(sec.geo.hf)}`, x0 + bp + 4, 'der'));
  // Distancias de las capas a su cara (d₁, d₂…)
  let k = { inf: 0, sup: 0 };
  for (const [i, g] of (cotasCapas ? sec.armado ?? [] : []).entries()) {
    if (g.tipo !== 'capa' || !g.texto) continue;
    const n = g.cara === 'inf' ? ++k.inf : ++k.sup;
    const nombre = g.cara === 'inf' ? (n === 1 ? sub('d', '1') : sub('d', `1,${n}`)) : (n === 1 ? sub('d', '2') : sub('d', `2,${n}`));
    const yCara = g.cara === 'inf' ? y0 + hp : y0;
    const yCapa = g.cara === 'inf' ? yCara - g.d * s : yCara + g.d * s;
    const xc = x0 + bp + (sec.forma === 'T' ? 104 : 14) + 22 * (n - 1);
    out.push(`<g class="cota-capa" data-ref="g${i}"><line class="cota" x1="${xc}" y1="${Math.min(yCara, yCapa)}" x2="${xc}" y2="${Math.max(yCara, yCapa)}"/>`
      + `<line class="ref" x1="${x0 + bp + 2}" y1="${yCapa}" x2="${xc + 4}" y2="${yCapa}" stroke-dasharray="2 3"/>`
      + `<text x="${xc + 6}" y="${(yCara + yCapa) / 2 + 4}">${nombre} = ${mm(g.d)}</text></g>`);
  }
  if (sec.forma === 'circular' || sec.forma === 'pilar') {
    for (const [i, g] of (sec.armado ?? []).entries()) {
      if (g.tipo !== 'anillo' && g.tipo !== 'perimetral') continue;
      // d del borde al eje de las barras superiores, con el mismo dibujo que las capas
      const dd = g.tipo === 'anillo' ? g.r : g.d;
      const cx = x0 + bp / 2;
      const xc = x0 + bp + 14;
      const yB = y0 + dd * s;
      out.push(`<g class="cota-capa" data-ref="g${i}"><line class="cota" x1="${xc}" y1="${y0}" x2="${xc}" y2="${yB}"/>`
        + `<line class="ref" x1="${cx}" y1="${y0}" x2="${xc + 4}" y2="${y0}" stroke-dasharray="2 3"/>`
        + `<line class="ref" x1="${cx}" y1="${yB}" x2="${xc + 4}" y2="${yB}" stroke-dasharray="2 3"/>`
        + `<text x="${xc + 6}" y="${(y0 + yB) / 2 + 4}">d = ${mm(dd)}</text></g>`);
    }
  }
  return { svg: out.join(''), hp, bp };
}

/** SVG de la sección sola, para la pantalla de Secciones. */
export function dibujoSeccion(geo, sec, { ancho = 560, alto = 320, x = null } = {}) {
  const margenIzq = 64;
  // En Secciones se ve siempre la sección entera, por ancha que sea; la genérica no lleva cotas a la derecha
  const margenDer = sec.forma === 'generica' ? 40 : 150;
  const e = encuadre(geo, ancho - margenIzq - margenDer, alto, { completa: true });
  const x0 = margenIzq;
  const y0 = 24;
  const { svg, hp, bp } = capasSeccion(geo, sec, { e, x0, y0, x, id: 'sec' });
  const W = Math.max(ancho, x0 + bp + margenDer);
  const H = y0 + hp + (sec.forma === 'T' ? 76 : 50);
  const aria = t('dib.aria', mm(geo.caja.xmax - geo.caja.xmin), mm(geo.h), geo.barras.length);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">${DEFS}${svg}</svg>`;
}
