// Dibujo del módulo Punzonamiento: planta del pilar sobre la losa (borde libre en los pilares de borde y esquina) con el
// perímetro de control, el perímetro exterior donde ya no hace falta armadura y los perímetros de cercos con sus ramas,
// todo a escala. Las cotas y los datos van en la leyenda de debajo (textos de 12 px reales, guía § 8).

import { fmt } from './formato.js';
import { t } from './i18n.js';
import { DEFS } from './dibujoSeccion.js';
import { contorno, contornoRect, cercosCruz, cercosReticula, envolventeCruz, anchoBanda } from '../norma/punzonamiento/comun.js';

const ANCHO = 290; // ancho de la planta
const ALTO = 290;
const VW = 650; // ancho total: planta a la izquierda y dos alzados a la derecha
const mm = (v) => fmt(v, 0);

/**
 * @param {Object} x  pilar: tipo, pos, c1, c2, D [mm]
 * @param {{perimetros: {delta:number, clase:string, texto:string}[], anillos:number[], ramas:number, sinArmadura?:boolean, leyenda:string[]}} o
 *   perimetros: contornos a dibujar (clase 'ctrl' perímetro de control, 'ext' perímetro exterior); anillos: δ de cada perímetro de cercos
 */
export function dibujoPunzonamiento(x, o) {
  const aGrande = Math.max(...o.perimetros.map((p) => p.delta), ...(o.anillos ?? [0]), o.ext ? o.ext.dl + o.ext.kd : 0, 1);
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
  // Aunque u1 y la última barra casi coincidan, el dibujo los separa unos píxeles (Pepiño, 29/10/2026)
  const ctrlReal = (o.perimetros.find((p) => p.clase === 'ctrl') ?? {}).delta;
  let ctrlDib = ctrlReal;
  if (ctrlReal && o.anillos?.length && !o.sinArmadura) {
    const sep = 7 / sc;
    for (const a of [...o.anillos].sort((p, q) => p - q)) if (Math.abs(a - ctrlDib) < sep) ctrlDib = a + sep;
  }
  o = { ...o, perimetros: o.perimetros.map((p) => (p.clase === 'ctrl' && ctrlDib ? { ...p, delta: ctrlDib } : p)) };
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
  const studs = [];
  let formaExt = null;
  // Perímetro exterior (el que dan los cercos puestos): a kd del último; en cruz, envolvente de círculos (EC-2, fig. 6.22)
  if (o.ext && !o.sinArmadura) {
    if (o.esq === 'cruz') {
      const env = envolventeCruz(x, o.ext.dl, o.ext.kd, o.ramas, o.sl);
      const P = env.pts;
      // Se arranca en un vértice del borde libre para no partir el trazo (en el interior, en cualquiera)
      let ini = 0;
      if (!interior) ini = Math.max(0, P.findIndex((q, i) => env.enBorde(q) && env.enBorde(P[(i + 1) % P.length])));
      let dd = '';
      let abierto = false;
      for (let m = 0; m < P.length; m++) {
        const a = P[(ini + m) % P.length];
        const b = P[(ini + m + 1) % P.length];
        if (env.enBorde(a) && env.enBorde(b)) { abierto = false; continue; }
        if (!abierto) dd += `M${X(a[0]).toFixed(1)} ${Y(a[1]).toFixed(1)}`;
        dd += `L${X(b[0]).toFixed(1)} ${Y(b[1]).toFixed(1)}`;
        abierto = true;
      }
      out.push(`<path class="perim perim-ext" d="${dd}"/>`);
      formaExt = P.filter((q) => !env.enBorde(q));
    } else {
      const cp = contorno(x, o.ext.dl + o.ext.kd, paso);
      out.push(`<path class="perim perim-ext" d="${camino(cp, interior)}"/>`);
      formaExt = cp;
    }
  }
  // Cercos: en cruz, carriles por los ejes del pilar; en retícula, filas rectangulares paralelas a las caras
  if (!o.sinArmadura && o.anillos?.length) {
    const barra = ([a, b]) => `<circle class="barra-ac" cx="${X(a).toFixed(1)}" cy="${Y(b).toFixed(1)}" r="2.6"/>`;
    if (o.esq === 'cruz') {
      const ult = o.anillos[o.anillos.length - 1];
      const cc = x.tipo === 'rect' ? { cx: x.c1 / 2, cy: x.c2 / 2, hx: x.c1 / 2, hy: x.c2 / 2 } : { cx: x.D / 2, cy: x.D / 2, hx: x.D / 2, hy: x.D / 2 };
      const ejes = [[1, 0], [0, 1]];
      if (x.pos !== 'esquina') ejes.push([-1, 0]);
      if (x.pos === 'interior') ejes.push([0, -1]);
      // Cada banda mide el ancho del pilar menos 25 mm por lado
      for (const [ux, uy] of ejes) {
        const cara = Math.abs(ux) * cc.hx + Math.abs(uy) * cc.hy;
        const ancho = anchoBanda(x, ux);
        const xa = cc.cx + ux * cara - uy * ancho / 2;
        const ya = cc.cy + uy * cara + ux * ancho / 2;
        const xb = cc.cx + ux * (cara + ult) + uy * ancho / 2;
        const yb = cc.cy + uy * (cara + ult) - ux * ancho / 2;
        const px = Math.min(X(xa), X(xb));
        const py = Math.min(Y(ya), Y(yb));
        out.push(`<rect class="banda" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${Math.abs(X(xb) - X(xa)).toFixed(1)}" height="${Math.abs(Y(yb) - Y(ya)).toFixed(1)}"/>`);
      }
      for (const q of cercosCruz(x, o.anillos, o.ramas, o.sl)) { out.push(barra(q)); studs.push(q); }
    } else {
      for (const dl of o.anillos) {
        out.push(`<path class="cerco" d="${camino(contornoRect(x, dl), interior)}"/>`);
        for (const q of cercosReticula(x, dl, o.nx, o.ny)) { out.push(barra(q)); studs.push(q); }
      }
    }
  }
  // Pilar
  if (x.tipo === 'rect') out.push(`<rect class="pilar" x="${X(0).toFixed(1)}" y="${Y(x.c2).toFixed(1)}" width="${(x.c1 * sc).toFixed(1)}" height="${(x.c2 * sc).toFixed(1)}"/>`);
  else out.push(`<circle class="pilar" cx="${X(x.D / 2).toFixed(1)}" cy="${Y(x.D / 2).toFixed(1)}" r="${(x.D / 2 * sc).toFixed(1)}"/>`);
  // Nombres de los perímetros sobre la planta, en la diagonal superior derecha para no tapar cercos ni ramas
  const cc = x.tipo === 'rect' ? [x.c1 / 2, x.c2 / 2] : [x.D / 2, x.D / 2];
  const diag = (pts) => pts.reduce((m, q) => (q[0] - cc[0] + (q[1] - cc[1]) > m[0] ? [q[0] - cc[0] + (q[1] - cc[1]), q] : m), [-Infinity, null])[1];
  const nom = o.nombres ?? {};
  const etiqueta = (q, txt, dx = 4, dy = -4, fin = false) => (q && txt ? out.push(`<text class="halo" x="${(X(q[0]) + dx).toFixed(1)}" y="${(Y(q[1]) + dy).toFixed(1)}"${fin ? ' text-anchor="end"' : ''}>${txt}</text>`) : 0);
  // u0 dentro del pilar, para no chocar con las barras junto a su cara
  if (nom.u0) out.push(`<text class="halo" x="${X(cc[0]).toFixed(1)}" y="${(Y(cc[1]) + 4).toFixed(1)}" text-anchor="middle">${nom.u0}</text>`);
  const ctrlD = (o.perimetros.find((p) => p.clase === 'ctrl') ?? {}).delta;
  if (ctrlD) etiqueta(diag(contorno(x, ctrlD, paso * 2)), nom.ctrl, -3, -3, true);
  if (formaExt) etiqueta(diag(formaExt), nom.ext, -3, -3, true);
  if (o.h) out.push(alzados(x, o, studs, ctrlD));
  // Leyenda dentro del SVG: muestra de trazo y texto
  let yL = ALTO + 6;
  const muestras = { ctrl: '<line class="perim perim-ctrl" x1="0" y1="0" x2="22" y2="0"/>', ext: '<line class="perim perim-ext" x1="0" y1="0" x2="22" y2="0"/>',
    cercos: '<line class="cerco" x1="0" y1="0" x2="22" y2="0"/><circle class="barra-ac" cx="11" cy="0" r="2.6"/>', pilar: '<rect class="pilar" x="6" y="-5" width="10" height="10"/>' };
  // Leyenda en dos columnas para ocupar poco alto
  const mitad = VW / 2;
  o.leyenda.forEach(([k, texto], i) => {
    const xx = margen + (i % 2) * (mitad - margen / 2);
    const yy = yL + 8 + Math.floor(i / 2) * 20;
    out.push(`<g transform="translate(${xx.toFixed(1)} ${yy})">${muestras[k] ?? ''}<text x="30" y="4">${texto}</text></g>`);
  });
  yL += Math.ceil(o.leyenda.length / 2) * 20;
  if (!interior) out.push(`<text x="${(Lx1 - 4).toFixed(1)}" y="${(Ly1 + 14).toFixed(1)}" text-anchor="end" class="rot">${t('pun.dib.borde')}</text>`);
  return `<svg class="dib dib-pun" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${VW} ${Math.ceil(yL + 4)}" role="img" aria-label="${t('pun.dib.aria', mm(w0), mm(h0))}">${out.join('')}</svg>`;
}

/** Dos alzados (cortes por el eje x y por el eje y del pilar), con espesor, perímetros y cercos. */
function alzados(x, o, studs, ctrlD) {
  const EW = VW - ANCHO - 16;
  const EH = 148;
  const x0 = ANCHO + 16;
  const w = x.tipo === 'rect' ? [x.c1, x.c2] : [x.D, x.D];
  const c = [w[0] / 2, w[1] / 2];
  const E = Math.max(ctrlD ?? 0, o.ext ? o.ext.dl + o.ext.kd : 0, 1);
  const salida = [];
  ['x', 'y'].forEach((eje, i) => {
    const k = eje === 'x' ? 0 : 1;
    const dim = w[k];
    const libre = (eje === 'x' && x.pos === 'esquina') || (eje === 'y' && x.pos !== 'interior');
    const lo = libre ? 0 : -E;
    const hi = dim + E;
    const RES = 80;
    const m = 6;
    const se = (EW - RES - 2 * m) / (hi - lo);
    const U = (v) => x0 + m + (v - lo) * se;
    const sv = Math.min(se, 40 / o.h); // escala vertical: la del dibujo, salvo losas muy gruesas
    const y0 = i * EH + 68;
    const hs = o.h * sv;
    const stub = 16;
    const f = (v) => v.toFixed(1);
    const g = [];
    g.push(`<text class="tit" x="${x0}" y="${i * EH + 10}">${t(eje === 'x' ? 'pun.dib.alzX' : 'pun.dib.alzY')}</text>`);
    g.push(`<rect class="hor" x="${f(U(lo))}" y="${f(y0)}" width="${f(U(hi) - U(lo))}" height="${f(hs)}"/>`);
    if (libre) g.push(`<line class="borde-libre" x1="${f(U(0))}" y1="${f(y0 - 4)}" x2="${f(U(0))}" y2="${f(y0 + hs + 4)}"/>`);
    // Tramo de pilar en alzado: dos aristas verticales y, en cada extremo, la línea de corte fina con su zigzag (delineación)
    const xa = U(0);
    const xb = U(0) + dim * se;
    const xm = (xa + xb) / 2;
    const corte = (yy) => `M${f(xa)} ${f(yy)}H${f(xm - 7)}L${f(xm - 2.5)} ${f(yy - 6)}L${f(xm + 2.5)} ${f(yy + 6)}L${f(xm + 7)} ${f(yy)}H${f(xb)}`;
    g.push(`<rect class="pilar-alz" x="${f(xa)}" y="${f(y0 - stub)}" width="${f(xb - xa)}" height="${f(hs + 2 * stub)}"/>`);
    g.push(`<path class="arista" d="M${f(xa)} ${f(y0 - stub)}V${f(y0 + hs + stub)}M${f(xb)} ${f(y0 - stub)}V${f(y0 + hs + stub)}"/>`);
    g.push(`<path class="corte-fino" d="${corte(y0 - stub)}${corte(y0 + hs + stub)}"/>`);
    // cercos: los de la banda del corte, en trazo fuerte; el resto proyectados, más claros
    const banda = o.esq === 'cruz' ? Math.max(0, w[1 - k] - 2 * 25) / 2 + 1 : 0.75 * o.sl;
    const yz = (z) => y0 + (o.h - z) * sv;
    const dd = Math.min(o.d ?? o.h, o.h);
    const pos = studs.map((q) => [q[k], Math.abs(q[1 - k] - c[1 - k]) <= banda]);
    const vistos = new Set();
    for (const [u, en] of pos.sort((a, b) => a[1] - b[1])) {
      const key = `${u.toFixed(0)}${en}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      g.push(`<line class="${en ? 'cerco-v' : 'cerco-v tenue'}" x1="${f(U(u))}" y1="${f(yz(o.h - (o.h - dd)))}" x2="${f(U(u))}" y2="${f(yz(o.h - dd))}"/>`);
    }
    // perímetros: líneas verticales con su nombre arriba (no tapan los cercos: van a ambos lados de la losa)
    const per = [[ctrlD, 'perim-ctrl', o.nombres?.ctrl], o.ext ? [o.ext.dl + o.ext.kd, 'perim-ext', o.nombres?.ext] : null].filter((p) => p && p[0]);
    for (const [dl, cl, nm] of per) {
      for (const [u, lado] of [[-dl, 'i'], [dim + dl, 'd']]) {
        if (lado === 'i' && libre) continue;
        g.push(`<line class="perim ${cl}" x1="${f(U(u))}" y1="${f(y0 - stub - (cl === 'perim-ext' ? 24 : 8))}" x2="${f(U(u))}" y2="${f(y0 + hs + 8)}"/>`);
        if (nm) g.push(`<text class="halo" x="${f(U(u))}" y="${f(y0 - stub - (cl === 'perim-ext' ? 24 : 8))}" text-anchor="middle">${nm}</text>`);
      }
    }
    // espesor
    const xe = U(hi) + 12;
    g.push(`<line class="cota" x1="${f(xe)}" y1="${f(y0)}" x2="${f(xe)}" y2="${f(y0 + hs)}"/><line class="cota" x1="${f(xe - 4)}" y1="${f(y0)}" x2="${f(xe + 4)}" y2="${f(y0)}"/><line class="cota" x1="${f(xe - 4)}" y1="${f(y0 + hs)}" x2="${f(xe + 4)}" y2="${f(y0 + hs)}"/>`);
    g.push(`<text x="${f(xe + 7)}" y="${f(y0 + hs / 2 + 4)}">h = ${mm(o.h)}</text>`);
    salida.push(...g);
  });
  return salida.join('');
}
