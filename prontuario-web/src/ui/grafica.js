// Gráfica x-y común a todos los módulos (guía de estilo § 9): ejes con divisiones redondas,
// zoom con la rueda, con un rectángulo arrastrado y con dos dedos; doble clic para la vista
// completa; cruz con los valores de cada serie; copiar como PNG (botón o Ctrl+C) y guardar PNG o SVG.
// Debajo, el selector Gráfico/Tabla (como en el Prontuario 3.1): la tabla lleva los puntos de cada serie
// y «Copiar» la pasa al portapapeles como texto con tabuladores y el separador decimal del sistema.
// Se dibuja al tamaño real en píxeles, así que los textos miden siempre 12 px.

import { t } from './i18n.js';
import { fmt, decimalAlCopiar } from './formato.js';
import { copiarPNG, guardar as guardarArchivo } from './exportarSvg.js';

const NS = 'http://www.w3.org/2000/svg';
const M = { izq: 58, der: 14, arr: 12, aba: 40 };

/** Paso «redondo» (1, 2 o 5 × 10ⁿ) para unas n divisiones. */
function paso(rango, n) {
  const bruto = rango / Math.max(n, 1);
  const p = 10 ** Math.floor(Math.log10(bruto));
  const r = bruto / p;
  return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * p;
}
const divisiones = (a, b, n) => {
  const s = paso(b - a, n);
  const out = [];
  for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + s * 1e-9; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : v);
  return { s, out };
};
const decimales = (s) => Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
let nGraf = 0;

// En la tabla, títulos sin el marcado de subíndices del SVG
const plano = (x) => String(x ?? '').replace(/<[^>]+>/g, '');

/** Valor de la serie en x, interpolando entre los dos puntos que lo rodean (x creciente). */
function interpolar(xy, x) {
  if (!xy.length || x < xy[0][0] || x > xy.at(-1)[0]) return null;
  let i = 1;
  while (i < xy.length - 1 && xy[i][0] < x) i++;
  const [x0, y0] = xy[i - 1];
  const [x1, y1] = xy[i];
  return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * @param {Object} o
 * @param {{nombre:string, xy:number[][], clase?:string, cruz?:boolean}[]} o.series  clase: s1, s2, ref; cruz:false la deja fuera de la cruz
 * @param {{x:number, y:number, etq:string, clase?:string, abajo?:boolean}[]} [o.puntos]  puntos marcados con su rótulo (abajo: bajo el punto) (SVG: subíndices con <tspan class="ind">)
 * @param {{titulo:string, d?:number}} o.ejeX  d: decimales en la cruz
 * @param {{titulo:string, d?:number}} o.ejeY
 * @param {{x?:number, y?:number}} [o.rejillaSec]  rejilla secundaria (sin números) cada x e y; solo si es más fina que la principal
 * @param {boolean} [o.invertirY]  el eje y crece hacia abajo (momentos flectores: positivos debajo)
 * @param {string} [o.archivo]  nombre base al guardar
 * @param {(texto:string)=>void} [o.avisar]
 * @returns {HTMLElement}
 */
export function grafica({ series, puntos = [], ejeX, ejeY, archivo = 'grafica', rejillaSec = null, invertirY = false, avisar = () => {} }) {
  const caja = document.createElement('div');
  caja.className = 'grafica';
  caja.tabIndex = 0;
  caja.setAttribute('role', 'figure');
  caja.setAttribute('aria-label', `${ejeY.titulo} – ${ejeX.titulo}`);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'graf');
  const tip = document.createElement('div');
  tip.className = 'graf-tip';
  tip.hidden = true;
  const barra = document.createElement('div');
  barra.className = 'graf-barra';
  const bot = (txt, titulo, f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tecla';
    b.textContent = txt;
    b.title = titulo;
    b.addEventListener('click', f);
    return b;
  };
  // Ver todo (zoom extensión): lo mismo que el doble clic; apagado mientras no hay zoom
  const bTodo = bot(t('graf.verTodo'), t('graf.verTodoTit'), () => { vista = { ...completa }; dibujar(); });
  const bCopiar = bot(t('graf.copiar'), `${t('graf.copiarTit')} (Ctrl+C)`, () => (enTabla ? copiarTabla() : copiar()));
  const soloGrafico = [bTodo, bot('PNG', t('graf.guardarPNG'), () => guardar('png')), bot('SVG', t('graf.guardarSVG'), () => guardar('svg'))];
  barra.append(soloGrafico[0], bCopiar, ...soloGrafico.slice(1));

  // Tabla con los puntos de cada serie (las de referencia sin cruz quedan fuera)
  const enCuadro = series.filter((s) => s.cruz !== false && s.xy.length);
  const tabla = document.createElement('div');
  tabla.className = 'graf-tabla';
  tabla.hidden = true;
  const filasT = Math.max(0, ...enCuadro.map((s) => s.xy.length));
  const celda = (s, i, j, d) => (s.xy[i] ? fmt(s.xy[i][j], d) : '');
  tabla.innerHTML = `<table><thead>${enCuadro.length > 1 ? `<tr>${enCuadro.map((s) => `<th colspan="2" class="${s.clase ?? 's1'}">${s.nombre}</th>`).join('')}</tr>` : ''}`
    + `<tr>${enCuadro.map(() => `<th>${ejeX.titulo}</th><th>${ejeY.titulo}</th>`).join('')}</tr></thead><tbody>`
    + Array.from({ length: filasT }, (_, i) => `<tr>${enCuadro.map((s) => `<td>${celda(s, i, 0, (ejeX.d ?? 2) + 1)}</td><td>${celda(s, i, 1, (ejeY.d ?? 1) + 1)}</td>`).join('')}</tr>`).join('')
    + '</tbody></table>';

  // Selector Gráfico/Tabla debajo de la gráfica
  let enTabla = false;
  let listo = false; // dibujar() aún no existe en la primera llamada a ponerModo
  // Con el estilo de las opciones excluyentes (guía § 14.5): contorno y la elegida subrayada en azul
  const modo = document.createElement('div');
  modo.className = 'graf-modo';
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'radiogroup');
  modo.append(seg);
  const opcion = (txt, tabular) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.textContent = txt;
    b.addEventListener('click', () => ponerModo(tabular));
    return b;
  };
  const bG = opcion(t('graf.grafico'), false);
  const bT = opcion(t('graf.tabla'), true);
  seg.append(bG, bT);
  function ponerModo(tabular) {
    enTabla = tabular;
    bG.setAttribute('aria-checked', String(!tabular));
    bT.setAttribute('aria-checked', String(tabular));
    svg.style.display = tabular ? 'none' : '';
    tabla.hidden = !tabular;
    tip.hidden = true;
    for (const b of soloGrafico) b.hidden = tabular;
    bCopiar.title = tabular ? t('graf.copiarTablaTit') : `${t('graf.copiarTit')} (Ctrl+C)`;
    if (!tabular && listo) dibujar();
  }
  caja.append(barra, svg, tabla, tip, modo);
  ponerModo(false);

  // Vista completa: todos los datos, con el 0 dentro y un 10 % de margen por todos los bordes
  const todos = [...series.flatMap((s) => s.xy), ...puntos.map((p) => [p.x, p.y])].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const ext = (i) => {
    const a = Math.min(0, ...todos.map((p) => p[i]));
    const b = Math.max(0, ...todos.map((p) => p[i]));
    const r = b > a ? b - a : 1;
    return [a - 0.1 * r, a === b ? a + 1 : b + 0.1 * r];
  };
  const [xa, xb] = ext(0);
  const [ya, yb] = ext(1);
  const completa = { x0: xa, x1: xb, y0: ya, y1: yb };
  let vista = { ...completa };
  let W = 0;
  let H = 0;
  let cruz = null; // posición del cursor en píxeles
  let rect = null; // rectángulo de zoom en píxeles
  const clip = `graf-clip-${++nGraf}`;

  const aX = (x) => M.izq + ((x - vista.x0) / (vista.x1 - vista.x0)) * (W - M.izq - M.der);
  const aY = (y) => (invertirY ? M.arr + ((y - vista.y0) / (vista.y1 - vista.y0)) * (H - M.arr - M.aba) : H - M.aba - ((y - vista.y0) / (vista.y1 - vista.y0)) * (H - M.arr - M.aba));
  const deX = (px) => vista.x0 + ((px - M.izq) / (W - M.izq - M.der)) * (vista.x1 - vista.x0);
  const deY = (py) => vista.y0 + ((invertirY ? py - M.arr : H - M.aba - py) / (H - M.arr - M.aba)) * (vista.y1 - vista.y0);

  function dibujar() {
    bTodo.disabled = ['x0', 'x1', 'y0', 'y1'].every((k) => vista[k] === completa[k]);
    W = caja.clientWidth;
    H = svg.clientHeight || caja.clientHeight;
    if (!(W > 0 && H > 0)) return;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pw = W - M.izq - M.der;
    const ph = H - M.arr - M.aba;
    const dx = divisiones(vista.x0, vista.x1, Math.max(2, Math.round(pw / 90)));
    const dy = divisiones(vista.y0, vista.y1, Math.max(2, Math.round(ph / 50)));
    const o = [];
    o.push(`<defs><clipPath id="${clip}"><rect x="${M.izq}" y="${M.arr}" width="${pw}" height="${ph}"/></clipPath></defs>`);
    const sec = (paso2, lim, prim, tam, vert) => {
      if (!(paso2 > 0) || paso2 >= prim * 0.999) return;
      const [a, b] = lim;
      if ((b - a) / paso2 > 120) return;
      for (let v = Math.ceil(a / paso2 - 1e-9) * paso2; v <= b + paso2 * 1e-9; v += paso2) {
        const px = vert ? aX(v) : aY(v);
        o.push(vert ? `<line class="rej2" x1="${px}" x2="${px}" y1="${M.arr}" y2="${H - M.aba}"/>` : `<line class="rej2" x1="${M.izq}" x2="${W - M.der}" y1="${px}" y2="${px}"/>`);
      }
    };
    if (rejillaSec) { sec(rejillaSec.x, [vista.x0, vista.x1], dx.s, pw, true); sec(rejillaSec.y, [vista.y0, vista.y1], dy.s, ph, false); }
    for (const x of dx.out) o.push(`<line class="rej" x1="${aX(x)}" x2="${aX(x)}" y1="${M.arr}" y2="${H - M.aba}"/><text x="${aX(x)}" y="${H - M.aba + 16}" text-anchor="middle">${fmt(x, decimales(dx.s))}</text>`);
    for (const y of dy.out) o.push(`<line class="rej" x1="${M.izq}" x2="${W - M.der}" y1="${aY(y)}" y2="${aY(y)}"/><text x="${M.izq - 6}" y="${aY(y) + 4}" text-anchor="end">${fmt(y, decimales(dy.s))}</text>`);
    o.push(`<rect class="marco" x="${M.izq}" y="${M.arr}" width="${pw}" height="${ph}"/>`);
    if (vista.y0 < 0 && vista.y1 > 0) o.push(`<line class="eje0" x1="${M.izq}" x2="${W - M.der}" y1="${aY(0)}" y2="${aY(0)}"/>`);
    if (vista.x0 < 0 && vista.x1 > 0) o.push(`<line class="eje0" x1="${aX(0)}" x2="${aX(0)}" y1="${M.arr}" y2="${H - M.aba}"/>`);
    o.push(`<text class="tit-eje" x="${M.izq + pw / 2}" y="${H - 6}" text-anchor="middle">${ejeX.titulo}</text>`);
    o.push(`<text class="tit-eje" transform="translate(14 ${M.arr + ph / 2}) rotate(-90)" text-anchor="middle">${ejeY.titulo}</text>`);
    o.push(`<g clip-path="url(#${clip})">`);
    for (const s of series) {
      if (!s.xy.length) continue;
      o.push(`<polyline class="serie ${s.clase ?? 's1'}" points="${s.xy.map(([x, y]) => `${aX(x).toFixed(1)},${aY(y).toFixed(1)}`).join(' ')}"/>`);
    }
    for (const p of puntos) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const px = aX(p.x);
      const py = aY(p.y);
      // El rótulo va a la izquierda si no cabe a la derecha
      const izq = px > W - M.der - 30;
      // Sin marcadores de serie (guía § 15); el punto de cálculo (marca: 'ok' | 'no' | 'neutro') lleva un círculo indicador
      if (p.marca) o.push(`<circle class="punto-calculo ${p.marca}" cx="${px}" cy="${py}" r="4.5"/>`);
      if (p.etq) o.push(`<text class="etq-punto" x="${izq ? px - 6 : px + 6}" y="${p.abajo ? py + 16 : py - 7}" text-anchor="${izq ? 'end' : 'start'}">${p.etq}</text>`);
    }
    o.push('</g>');
    // Etiqueta directa al final de cada curva (en lugar de leyenda con marcadores); las series sin curva,
    // como las referencias, siguen en una leyenda arriba a la izquierda, dentro del marco
    const dentro = ([x, y]) => aX(x) >= M.izq && aX(x) <= W - M.der && aY(y) >= M.arr && aY(y) <= H - M.aba;
    const directas = [];
    for (const s of series) {
      if (!s.nombre || !s.xy.length || s.clase === 'ref') continue;
      const ult = [...s.xy].reverse().find(dentro);
      if (!ult) continue;
      const largo = plano(s.nombre).length * 6.6;
      const px = aX(ult[0]);
      const cabe = px + 6 + largo <= W - 4;
      directas.push({ s, y: aY(ult[1]) + (cabe ? 4 : -7), x: cabe ? px + 6 : px - 6, anc: cabe ? 'start' : 'end' });
    }
    directas.sort((p, q) => p.y - q.y);
    directas.forEach((d, i) => { if (i && d.y - directas[i - 1].y < 14) d.y = directas[i - 1].y + 14; });
    for (const d of directas) o.push(`<text class="etq-serie ${d.s.clase ?? 's1'}" x="${d.x}" y="${d.y}" text-anchor="${d.anc}">${d.s.nombre}</text>`);
    const conNombre = series.filter((s) => s.nombre && !directas.some((d) => d.s === s));
    conNombre.forEach((s, i) => {
      const y = M.arr + 14 + i * 16;
      o.push(`<line class="serie ${s.clase ?? 's1'}" x1="${M.izq + 8}" x2="${M.izq + 28}" y1="${y - 4}" y2="${y - 4}"/><text x="${M.izq + 34}" y="${y}">${s.nombre}</text>`);
    });
    // Lo interactivo va en su grupo, que no se exporta
    o.push('<g class="vivo">');
    if (cruz && cruz.x >= M.izq && cruz.x <= W - M.der && cruz.y >= M.arr && cruz.y <= H - M.aba) {
      o.push(`<line class="cruz" x1="${cruz.x}" x2="${cruz.x}" y1="${M.arr}" y2="${H - M.aba}"/><line class="cruz" x1="${M.izq}" x2="${W - M.der}" y1="${cruz.y}" y2="${cruz.y}"/>`);
      const x = deX(cruz.x);
      const filas = [];
      for (const s of series) {
        if (s.cruz === false) continue;
        const y = interpolar(s.xy, x);
        if (y === null) continue;
        o.push(`<circle class="punto ${s.clase ?? 's1'}" cx="${cruz.x}" cy="${aY(y)}" r="3"/>`);
        filas.push(`<span><i class="${s.clase ?? 's1'}"></i>${s.nombre ? `${s.nombre}: ` : ''}<b>${fmt(y, ejeY.d ?? 1)}</b></span>`);
      }
      tip.innerHTML = `<span>${ejeX.titulo} = <b>${fmt(x, ejeX.d ?? 2)}</b></span>${filas.join('')}`;
      tip.hidden = false;
      const izq = cruz.x + 14 + tip.offsetWidth > W ? cruz.x - 14 - tip.offsetWidth : cruz.x + 14;
      tip.style.left = `${izq}px`;
      tip.style.top = `${Math.max(M.arr, Math.min(cruz.y + 14, H - M.aba - tip.offsetHeight)) + svg.offsetTop}px`;
    } else tip.hidden = true;
    if (rect) {
      const [x0, x1] = [Math.min(rect.a.x, rect.b.x), Math.max(rect.a.x, rect.b.x)];
      const [y0, y1] = [Math.min(rect.a.y, rect.b.y), Math.max(rect.a.y, rect.b.y)];
      o.push(`<rect class="zoom" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`);
    }
    o.push('</g>');
    svg.innerHTML = o.join('');
  }

  /* ---------- interacción ---------- */
  const pos = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const zoom = (c, f) => {
    const x = deX(c.x);
    const y = deY(c.y);
    vista = { x0: x - (x - vista.x0) * f, x1: x + (vista.x1 - x) * f, y0: y - (y - vista.y0) * f, y1: y + (vista.y1 - y) * f };
    dibujar();
  };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(pos(e), e.deltaY > 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  svg.addEventListener('dblclick', () => { vista = { ...completa }; dibujar(); });
  const dedos = new Map();
  let pellizco = null;
  svg.addEventListener('pointerdown', (e) => {
    caja.focus({ preventScroll: true });
    dedos.set(e.pointerId, pos(e));
    svg.setPointerCapture(e.pointerId);
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      rect = null;
    } else if (e.button === 0) rect = { a: pos(e), b: pos(e) };
  });
  svg.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, p);
    if (pellizco && dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) zoom({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pellizco.d / d);
      pellizco.d = d;
      return;
    }
    if (rect) rect.b = p;
    cruz = p;
    dibujar();
  });
  const soltar = (e) => {
    dedos.delete(e.pointerId);
    if (dedos.size < 2) pellizco = null;
    if (rect) {
      const { a, b } = rect;
      rect = null;
      if (Math.abs(a.x - b.x) > 6 && Math.abs(a.y - b.y) > 6) {
        vista = { x0: deX(Math.min(a.x, b.x)), x1: deX(Math.max(a.x, b.x)), y0: deY((invertirY ? Math.min : Math.max)(a.y, b.y)), y1: deY((invertirY ? Math.max : Math.min)(a.y, b.y)) };
      }
      dibujar();
    }
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !rect) { cruz = null; dibujar(); } });
  caja.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) { e.preventDefault(); if (enTabla) copiarTabla(); else copiar(); }
  });

  /* ---------- exportar ---------- */
  const copiar = () => copiarPNG(svg, W, H, archivo, avisar);
  async function copiarTabla() {
    // Restos numéricos del cálculo (9.5e-9 donde es 0) salen como 0
    const num = (v) => (Number.isFinite(v) ? String(Math.abs(v) < 1e-6 ? 0 : +v.toPrecision(6)).replace('.', decimalAlCopiar()) : '');
    const lineas = [];
    if (enCuadro.length > 1) lineas.push(enCuadro.map((s) => `${plano(s.nombre)}\t`).join('\t'));
    lineas.push(enCuadro.map(() => `${plano(ejeX.titulo)}\t${plano(ejeY.titulo)}`).join('\t'));
    for (let i = 0; i < filasT; i++) lineas.push(enCuadro.map((s) => (s.xy[i] ? `${num(s.xy[i][0])}\t${num(s.xy[i][1])}` : '\t')).join('\t'));
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      avisar(t('graf.tablaCopiada'));
    } catch { avisar(t('graf.error')); }
  }
  const guardar = (ext) => guardarArchivo(svg, W, H, archivo, ext, avisar);

  listo = true;
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => dibujar()).observe(caja);
  else queueMicrotask(dibujar);
  caja.dibujar = dibujar;
  return caja;
}

