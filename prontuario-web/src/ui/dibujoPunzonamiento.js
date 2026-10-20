// Dibujo del módulo Punzonamiento: planta del pilar sobre la losa (borde libre en los pilares de borde y esquina) con el
// perímetro de control, el perímetro exterior donde ya no hace falta armadura y los perímetros de cercos con sus ramas,
// todo a escala. Las cotas y los datos van en la leyenda de debajo (textos de 12 px reales, guía § 8).

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS } from './dibujoSeccion.js';
import { contorno, repartir } from '../norma/punzonamiento/comun.js';

const ANCHO = 420;
const ALTO = 300;
const mm = (v) => fmt(v, 0);

/**
 * @param {Object} x  pilar: tipo, pos, c1, c2, D (mm)
 * @param {{perimetros: {delta:number, clase:string, texto:string}[], anillos:number[], ramas:number, sinArmadura?:boolean, leyenda:string[]}} o
 *   perimetros: contornos a dibujar (clase 'ctrl' perímetro de control, 'ext' perímetro exterior); anillos: δ de cada perímetro de cercos
 */
export function dibujoPunzonamiento(x, o) {
  const aGrande = Math.max(...o.perimetros.map((p) => p.delta), ...(o.anillos ?? [0]), 1);
  // Caja del dibujo: del contorno más lejano
  const grande = contorno(x, aGrande, 10);
  const xs = grande.map((p) => p[0]);
  const ys = grande.map((p) => p[1]);
  const w0 = x.tipo === 'rect' ? x.c1 : x.D;
  const h0 = x.tipo === 'rect' ? x.c2 : x.D;
  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, w0);
  const ymin = x.pos === 'interior' ? Math.min(...ys, 0) : 0;
  const ymax = Math.max(...ys, h0);
  const margen = 14;
  const sc = Math.min((ANCHO - 2 * margen) / (xmax - xmin), (ALTO - 2 * margen) / (ymax - ymin));
  const X = (v) => margen + (v - xmin) * sc;
  const Y = (v) => margen + (ymax - v) * sc;
  const paso = Math.max(1, 2.5 / sc);
  const camino = (pts, cerrado) => `M${pts.map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join('L')}${cerrado ? 'Z' : ''}`;
  const out = [DEFS];
  const interior = x.pos === 'interior';
  // Losa: todo el recuadro (interior) o desde el borde libre hacia el interior
  const Lx0 = X(xmin) - margen / 2;
  const Lx1 = X(xmax) + margen / 2;
  const Ly0 = Y(ymax) - margen / 2;
  const Ly1 = interior ? Y(ymin) + margen / 2 : Y(0);
  const lx0 = x.pos === 'esquina' ? X(0) : Lx0;
  out.push(`<rect class="hor" x="${lx0.toFixed(1)}" y="${Ly0.toFixed(1)}" width="${(Lx1 - lx0).toFixed(1)}" height="${(Ly1 - Ly0).toFixed(1)}"/>`);
  if (!interior) {
    out.push(`<line class="borde-libre" x1="${lx0.toFixed(1)}" y1="${Ly1.toFixed(1)}" x2="${Lx1.toFixed(1)}" y2="${Ly1.toFixed(1)}"/>`);
    if (x.pos === 'esquina') out.push(`<line class="borde-libre" x1="${lx0.toFixed(1)}" y1="${Ly0.toFixed(1)}" x2="${lx0.toFixed(1)}" y2="${Ly1.toFixed(1)}"/>`);
  }
  // Perímetros de control y exterior (de fuera hacia dentro)
  for (const p of [...o.perimetros].sort((a, b) => b.delta - a.delta)) {
    out.push(`<path class="perim perim-${p.clase}" d="${camino(contorno(x, p.delta, paso), interior)}"/>`);
  }
  // Perímetros de cercos: línea fina y ramas como puntos
  if (!o.sinArmadura) {
    for (const dl of o.anillos ?? []) {
      const pts = contorno(x, dl, paso);
      out.push(`<path class="cerco" d="${camino(pts, interior)}"/>`);
      for (const [a, b] of repartir(pts, o.ramas, interior)) out.push(`<circle class="barra-ac" cx="${X(a).toFixed(1)}" cy="${Y(b).toFixed(1)}" r="2.6"/>`);
    }
  }
  // Pilar
  if (x.tipo === 'rect') out.push(`<rect class="pilar" x="${X(0).toFixed(1)}" y="${Y(x.c2).toFixed(1)}" width="${(x.c1 * sc).toFixed(1)}" height="${(x.c2 * sc).toFixed(1)}"/>`);
  else out.push(`<circle class="pilar" cx="${X(x.D / 2).toFixed(1)}" cy="${Y(x.D / 2).toFixed(1)}" r="${(x.D / 2 * sc).toFixed(1)}"/>`);
  // Leyenda dentro del SVG: muestra de trazo y texto
  let yL = ALTO + 6;
  const muestras = { ctrl: '<line class="perim perim-ctrl" x1="0" y1="0" x2="22" y2="0"/>', ext: '<line class="perim perim-ext" x1="0" y1="0" x2="22" y2="0"/>',
    cercos: '<line class="cerco" x1="0" y1="0" x2="22" y2="0"/><circle class="barra-ac" cx="11" cy="0" r="2.6"/>', pilar: '<rect class="pilar" x="6" y="-5" width="10" height="10"/>' };
  for (const [k, texto] of o.leyenda) {
    out.push(`<g transform="translate(${margen} ${yL + 8})">${muestras[k] ?? ''}<text x="30" y="4">${texto}</text></g>`);
    yL += 20;
  }
  if (!interior) out.push(`<text x="${(Lx1 - 4).toFixed(1)}" y="${(Ly1 + 14).toFixed(1)}" text-anchor="end" class="rot">${t('pun.dib.borde')}</text>`);
  return `<svg class="dib dib-pun" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${ANCHO} ${Math.ceil(yL + 4)}" role="img" aria-label="${t('pun.dib.aria', mm(w0), mm(h0))}">${out.join('')}</svg>`;
}
