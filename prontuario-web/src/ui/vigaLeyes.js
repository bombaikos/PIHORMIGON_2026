// Dibujo de la viga de un vano: esquema de cargas y reacciones, y debajo las leyes de momentos, cortantes,
// giros y flechas a todo el ancho y con la misma escala horizontal. A tamaño real en píxeles (textos de 12 px).
// Los diagramas de esfuerzos (M, V) llevan área rayada; giros y flechas, solo la línea. M, θ y δ se dibujan
// positivos hacia abajo (M sobre la parte traccionada, flecha en el sentido físico) y V positivo hacia arriba.
// Sin eje de ordenadas: los valores notables van escritos en el gráfico. Al pasar el cursor se leen los cuatro.

import { fmt, MAG } from './formato.js';
import { t } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const PAD = 44; // margen horizontal: caben los apoyos y los rótulos de los extremos

const BANDAS = [
  { k: 'M', f: 1, d: MAG.M.d, ud: 'kN·m', abajo: true, rayado: true, fuente: 'diagrama', peso: 1.35 },
  { k: 'V', f: 1, d: MAG.N.d, ud: 'kN', abajo: false, rayado: true, fuente: 'diagrama', peso: 1.1 },
  { k: 'giro', f: 1000, d: 1, ud: 'mrad', abajo: true, rayado: false, fuente: 'puntos', peso: 1 },
  { k: 'flecha', f: 1000, d: 1, ud: 'mm', abajo: true, rayado: false, fuente: 'puntos', peso: 1.1 },
];
const TIT = { M: 'M', V: 'V', giro: 'θ', flecha: 'δ' };

const e = (tag, attrs = {}, txt) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (txt !== undefined) el.textContent = txt;
  return el;
};

/** Apoyo bajo la línea de la viga en x: triángulo, empotramiento con rayas o nada. */
function apoyo(g, x, y, tp, pequeno) {
  const s = pequeno ? 0.55 : 1;
  if (tp === 'apoyo') g.append(e('path', { d: `M${x} ${y + 1} l${-9 * s} ${15 * s} h${18 * s} z`, class: 'vl-apoyo' }));
  else if (tp === 'empotramiento') {
    const lado = x < 200 ? -1 : 1;
    const a = 20 * s;
    g.append(e('path', { d: `M${x} ${y - a} v${2 * a}`, class: 'vl-empot' }));
    for (let i = 0; i < 5; i++) g.append(e('path', { d: `M${x} ${y - a + i * ((2 * a) / 4)} l${lado * 8 * s} ${8 * s}`, class: 'vl-empot fino' }));
  }
}

/** Esquema: viga, cargas, apoyos y reacciones escritas. */
function esquema(g, D, r, W, top, h, X) {
  const nMomR = D.der === 'empotramiento' || D.izq === 'empotramiento';
  const yv = top + h - (nMomR ? 52 : 40);
  const alto = Math.max(20, Math.min(46, yv - top - 20));
  g.append(e('text', { x: PAD - 30, y: top + 12, class: 'vl-tit' }, `${t('vig.esquema')} · L = ${fmt(D.L, 2)} m`));
  const dist = D.cargas.filter((c) => c.tipo === 'distribuida');
  const qmax = Math.max(1e-9, ...dist.map((c) => Math.max(Math.abs(c.q1), Math.abs(c.q2))));
  // Alturas con signo: positivo (hacia abajo) por encima de la viga y negativo por debajo; si cambia de signo se corta en el cero
  const yb = yv - 3;
  const hs = (v) => (v / qmax) * alto;
  for (const c of dist) {
    const a = X(c.a), b = X(c.b);
    const ha = hs(c.q1), hb = hs(c.q2);
    if (c.q1 * c.q2 < 0) {
      const xc = a + ((b - a) * Math.abs(c.q1)) / (Math.abs(c.q1) + Math.abs(c.q2));
      g.append(e('path', { d: `M${a} ${yb} V${yb - ha} L${xc} ${yb} z`, class: 'vl-distr' }));
      g.append(e('path', { d: `M${xc} ${yb} L${b} ${yb - hb} V${yb} z`, class: 'vl-distr' }));
    } else g.append(e('path', { d: `M${a} ${yb} V${yb - ha} L${b} ${yb - hb} V${yb} z`, class: 'vl-distr' }));
    // Valores en los extremos, fuera de la figura
    const fuera = (hh) => (hh >= 0 ? yb - hh - 4 : yb - hh + 13);
    if (c.q1 === c.q2) g.append(e('text', { x: (a + b) / 2, y: fuera(ha), 'text-anchor': 'middle', class: 'vl-num carga' }, `${fmt(c.q1, 1)} kN/m`));
    else {
      g.append(e('text', { x: a, y: fuera(ha), 'text-anchor': 'start', class: 'vl-num carga' }, `${fmt(c.q1, 1)} kN/m`));
      g.append(e('text', { x: b, y: fuera(hb), 'text-anchor': 'end', class: 'vl-num carga' }, `${fmt(c.q2, 1)} kN/m`));
    }
  }
  // Las flechas de P son más altas que las distribuidas para que sus rótulos no coincidan en altura
  const palto = Math.max(alto + 6, Math.min(yv - top - 22, alto + 24));
  for (const c of D.cargas.filter((z) => z.tipo === 'puntual')) {
    const x = X(c.a), s = c.P >= 0 ? 1 : -1;
    g.append(e('path', { d: `M${x} ${yv - 3 - s * palto} V${yv - 3} m-4.5 ${-8 * s} l4.5 ${8 * s} l4.5 ${-8 * s}`, class: 'vl-carga puntual' }));
    g.append(e('text', { x, y: s > 0 ? yv - palto - 8 : yv + palto + 12, 'text-anchor': 'middle', class: 'vl-num carga' }, `${fmt(c.P, MAG.F.d)} kN`));
  }
  // El rótulo del momento va por encima del de las distribuidas (alto + 18) para que no coincidan
  for (const c of D.cargas.filter((z) => z.tipo === 'momento')) {
    const x = X(c.a), s = c.C >= 0 ? 1 : -1;
    const r = 17, cy = yv - 8;
    g.append(e('path', { d: `M${x - r * s} ${cy} a${r} ${r} 0 1 1 ${2 * r * s} 0 m${-4 * s} ${-5} l${4 * s} 5 l${-5 * s} 2`, class: 'vl-carga', fill: 'none' }));
    g.append(e('text', { x, y: yv - 3 - alto - 18, 'text-anchor': 'middle', class: 'vl-num carga' }, `${fmt(c.C, MAG.M.d)} kN·m`));
  }
  g.append(e('path', { d: `M${X(0)} ${yv} H${X(D.L)}`, class: 'vl-viga' }));
  apoyo(g, X(0), yv, D.izq);
  apoyo(g, X(D.L), yv, D.der);
  // Reacciones escritas bajo cada apoyo
  for (const [lado, x, tp] of [['izq', X(0), D.izq], ['der', X(D.L), D.der]]) {
    if (tp === 'libre') continue;
    const R = r.reacciones[lado];
    const anc = x < W / 2 ? 'start' : 'end';
    const xt = anc === 'start' ? x - 8 : x + 8;
    g.append(e('text', { x: xt, y: yv + 30, 'text-anchor': anc, class: 'vl-num rea' }, `R = ${fmt(R.R, MAG.F.d)} kN`));
    if (tp === 'empotramiento') g.append(e('text', { x: xt, y: yv + 44, 'text-anchor': anc, class: 'vl-num rea' }, `M = ${fmt(R.M, MAG.M.d)} kN·m`));
  }
}

/** Valores a rotular de una ley: extremos, singulares y máximos, sin que se pisen. */
function etiquetas(dat, claves, ymap, W, f, d) {
  const maxabs = Math.max(1e-12, ...dat.map((p) => Math.abs(p.v)));
  const cand = [];
  const arg = (cmp) => dat.reduce((m, p) => (cmp(p.v, m.v) ? p : m), dat[0]);
  cand.push(arg((a, b) => a > b), arg((a, b) => a < b));
  for (const c of claves) for (const p of dat) if (Math.abs(p.x - c) < 1e-9) cand.push(p);
  const puestas = [];
  const sal = [];
  for (const p of cand) {
    if (Math.abs(p.v) < 0.015 * maxabs) continue;
    const px = p.px, py = ymap(p.v);
    if (puestas.some((q) => Math.abs(q.x - px) < 38 && Math.abs(q.y - py) < 14)) continue;
    puestas.push({ x: px, y: py });
    sal.push({ px, py, v: p.v });
  }
  return sal.map((s) => ({ ...s, txt: fmt(s.v * f, d) }));
}

/** Dibuja todo en el svg al tamaño W × H. Devuelve la función que mueve el cursor. */
export function dibujarLeyes(svg, W, H, D, r) {
  svg.replaceChildren();
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const X = (x) => PAD + (x / D.L) * (W - 2 * PAD);
  const gap = 6;
  const hEsq = Math.max(120, H * 0.27);
  const hEje = 26; // eje x común, abajo
  const resto = H - hEsq - gap * 4 - hEje;
  const pesoTot = BANDAS.reduce((s, b) => s + b.peso, 0);
  const g = e('g');
  svg.append(g);
  esquema(g, D, r, W, 0, hEsq, X);
  const claves = [0, D.L, ...D.cargas.flatMap((c) => (c.tipo === 'distribuida' ? [c.a, c.b] : [c.a]))];
  const lecturas = {};
  let y0 = hEsq + gap;
  // Guías en los apoyos, a todo lo alto de las leyes
  const yEje = H - hEje + 4;
  for (const x of [X(0), X(D.L)]) g.append(e('path', { d: `M${x} ${y0} V${yEje}`, class: 'vl-guia' }));
  // Marcas: cada metro (o el paso redondo que deje 24 px como mínimo); numeradas en el eje y sin rejilla en las leyes
  const pxM = (W - 2 * PAD) / D.L;
  const paso = (D.L >= 3 ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] : [0.1, 0.2, 0.5, 1, 2, 5]).find((p) => p * pxM >= 24) ?? 1000;
  const marcas = [];
  for (let v = 0; v <= D.L + 1e-9; v += paso) marcas.push(+v.toFixed(6));
  if (D.L - marcas.at(-1) > 0.3 * paso) marcas.push(D.L);
  g.append(e('path', { d: `M${X(0)} ${yEje} H${X(D.L)}`, class: 'vl-eje' }));
  for (const v of marcas) {
    g.append(e('path', { d: `M${X(v)} ${yEje} v5`, class: 'vl-eje' }));
    g.append(e('text', { x: X(v), y: yEje + 17, 'text-anchor': 'middle', class: 'vl-eje-n' }, fmt(v, paso < 1 ? 1 : (Number.isInteger(v) ? 0 : 2))));
  }
  g.append(e('text', { x: W - 2, y: yEje + 17, 'text-anchor': 'end', class: 'vl-eje-n' }, 'x (m)'));
  BANDAS.forEach((B) => {
    const h = (resto * B.peso) / pesoTot;
    const top = y0, bot = y0 + h;
    y0 = bot + gap;
    const dat = (B.fuente === 'diagrama' ? r.diagrama : r.puntos).map((p) => ({ x: p.x, px: X(p.x), v: p[B.k === 'M' ? 'M' : B.k === 'V' ? 'V' : B.k] }));
    const sg = B.abajo ? 1 : -1; // M, θ, δ positivos hacia abajo; V positivo hacia arriba
    const lo = Math.min(0, ...dat.map((p) => sg * p.v)), hi = Math.max(0, ...dat.map((p) => sg * p.v));
    const tope = top + 30, fondo = bot - 16; // sitio para el título arriba y los números fuera de los extremos
    const ymap = (v) => (hi === lo ? (tope + fondo) / 2 : tope + ((sg * v - lo) / (hi - lo)) * (fondo - tope));
    const y00 = ymap(0);
    g.append(e('path', { d: `M${PAD - 30} ${bot + gap / 2 - 0.5} H${W - PAD + 30}`, class: 'vl-sep' }));
    const tit = e('text', { x: PAD - 30, y: top + 13, class: `vl-tit vl-${B.k}` });
    tit.textContent = `${TIT[B.k]} (${B.ud})`;
    g.append(tit);
    const lee = e('text', { x: PAD + 100, y: top + 13, 'text-anchor': 'start', class: `vl-tit vl-${B.k} lectura` });
    g.append(lee);
    lecturas[B.k] = { el: lee, f: B.f, d: B.d, k: B.k };
    const linea = dat.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)} ${ymap(p.v).toFixed(1)}`).join(' ');
    if (B.rayado) g.append(e('path', { d: `${linea} L${dat.at(-1).px.toFixed(1)} ${y00} L${dat[0].px.toFixed(1)} ${y00} Z`, class: `vl-area vl-${B.k}`, fill: `url(#vl-h-${B.k})` }));
    g.append(e('path', { d: linea, class: `vl-curva vl-${B.k}` }));
    // La viga: la línea de referencia de la ley
    g.append(e('path', { d: `M${X(0)} ${y00} H${X(D.L)}`, class: 'vl-viga fina' }));
    g.append(e('path', { d: marcas.map((v) => `M${X(v)} ${y00 - 4} v8`).join(' '), class: 'vl-marcas' }));
    apoyo(g, X(0), y00, D.izq, true);
    apoyo(g, X(D.L), y00, D.der, true);
    for (const l of etiquetas(dat, claves, ymap, W, B.f, B.d)) {
      const sobre = l.py <= y00; // el número va hacia fuera de la curva
      g.append(e('text', { x: Math.min(W - 4, Math.max(4, l.px)), y: sobre ? l.py - 5 : l.py + 14, 'text-anchor': 'middle', class: `vl-num vl-${B.k}` }, l.txt));
    }
  });
  const defs = e('defs');
  const pq = e('pattern', { id: 'vl-h-q', width: 5, height: 5, patternUnits: 'userSpaceOnUse' });
  pq.append(e('path', { d: 'M2.5 0 V5', class: 'vl-hatch-q' }));
  defs.append(pq);
  for (const k of ['M', 'V']) {
    const p = e('pattern', { id: `vl-h-${k}`, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    p.append(e('path', { d: 'M0 0 V6', class: `vl-hatch vl-${k}` }));
    defs.append(p);
  }
  svg.prepend(defs);

  // Cursor: línea vertical y valores de las cuatro leyes en esa abscisa
  const cruz = e('path', { d: '', class: 'vl-cruz' });
  cruz.style.display = 'none';
  svg.append(cruz);
  const capa = e('rect', { x: PAD - 30, y: hEsq, width: W - 2 * PAD + 60, height: H - hEsq, fill: 'transparent' });
  svg.append(capa);
  const pts = r.puntos;
  const valor = (k, x) => {
    let i = 1;
    while (i < pts.length - 1 && pts[i].x < x) i++;
    const a = pts[i - 1], b = pts[i];
    return b.x === a.x ? b[k] : a[k] + ((b[k] - a[k]) * (x - a.x)) / (b.x - a.x);
  };
  const mover = (ev) => {
    const rc = svg.getBoundingClientRect();
    const px = ev.clientX - rc.left;
    const x = ((px - PAD) / (W - 2 * PAD)) * D.L;
    if (x < 0 || x > D.L) return salir();
    cruz.setAttribute('d', `M${px} ${hEsq} V${H}`);
    cruz.style.display = '';
    for (const L of Object.values(lecturas)) L.el.textContent = `x = ${fmt(x, 2)} m · ${fmt(valor(L.k, x) * L.f, L.d)}`;
  };
  const salir = () => { cruz.style.display = 'none'; for (const L of Object.values(lecturas)) L.el.textContent = ''; };
  capa.addEventListener('pointermove', mover);
  capa.addEventListener('pointerleave', salir);
}
