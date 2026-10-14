// Lector de secciones en DXF ASCII, sin dependencias. Basado en parser_secciones_dxf.js
// de José Luis; aquí se leen los códigos de grupo directamente para poder rechazar todo
// lo que no se admite y comprobar la normal de cada entidad.
//
// Devuelve { exterior: [{x,y}, ...], huecos: [[{x,y}, ...], ...] } en m, con los ejes del
// dibujo (y hacia arriba). Escala 1:1: el DXF viene en metros.
//
// Capa 0: exactamente un contorno cerrado (exterior). Otras capas: huecos.
// Solo se admiten LINE, LWPOLYLINE, POLYLINE (2D), CIRCLE y ARC en el espacio modelo;
// cualquier otra entidad, y cualquier normal distinta de +Z, se rechaza.
// Los contornos se cierran implícitamente (sin repetir el primer punto); exterior
// antihorario y huecos horarios. No se comprueban autointersecciones ni inclusión de huecos.

import { ErrorClave } from '../core/errores.js';

const ADMITIDAS = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC']);
const DOS_PI = 2 * Math.PI;

/** Pares [código, valor] del texto DXF. */
function grupos(texto) {
  if (/^AutoCAD Binary DXF/.test(texto)) throw new ErrorClave('dxf.binario');
  const lineas = texto.split(/\r\n|\r|\n/);
  const g = [];
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    const c = Number(lineas[i].trim());
    if (!Number.isInteger(c)) throw new ErrorClave('dxf.codigo', i + 1);
    g.push([c, lineas[i + 1].trim()]);
  }
  return g;
}

/** Entidades de la sección ENTITIES: {tipo, g: [[código, valor], ...]}. VERTEX y SEQEND quedan como entidades sueltas. */
function entidades(g) {
  let i = g.findIndex(([c, v], k) => c === 2 && v === 'ENTITIES' && g[k - 1]?.[0] === 0 && g[k - 1][1] === 'SECTION');
  if (i < 0) throw new ErrorClave('dxf.sinEntidades');
  const lista = [];
  for (i++; i < g.length; i++) {
    const [c, v] = g[i];
    if (c !== 0) continue;
    if (v === 'ENDSEC' || v === 'EOF') break;
    const e = { tipo: v, g: [] };
    while (i + 1 < g.length && g[i + 1][0] !== 0) e.g.push(g[++i]);
    lista.push(e);
  }
  return lista;
}

const num = (e, c, def) => {
  const p = e.g.find((x) => x[0] === c);
  if (!p) {
    if (def === undefined) throw new ErrorClave('dxf.falta', e.tipo, c);
    return def;
  }
  const n = Number(p[1]);
  if (!Number.isFinite(n)) throw new ErrorClave('dxf.numero', e.tipo, c);
  return n;
};
const capaDe = (e) => (e.g.find((x) => x[0] === 8)?.[1] ?? '0').trim();

/**
 * @param {string} textoDXF
 * @param {{cuerdaMaxima?: number, puntosMinimosArco?: number, tolerancia?: number}} [opciones]
 */
export function leerSeccionDXF(textoDXF, opciones = {}) {
  const {
    cuerdaMaxima = 1, // m (tope para arcos enormes; lo normal lo fija el paso angular)
    puntosMinimosArco = 4, // puntos por arco, incluidos extremos
    tolerancia = 1e-6, // m
  } = opciones;

  if (typeof textoDXF !== 'string' || !textoDXF.trim()) throw new ErrorClave('dxf.vacio');
  if (![cuerdaMaxima, tolerancia].every((v) => Number.isFinite(v) && v > 0)) throw new Error('cuerdaMaxima y tolerancia deben ser positivas.');
  if (!Number.isInteger(puntosMinimosArco) || puntosMinimosArco < 4) throw new Error('puntosMinimosArco debe ser un entero >= 4.');

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cerca = (a, b) => dist(a, b) <= tolerancia;
  const porCapa = new Map(); // capa -> tramos abiertos que hay que unir
  const circulos = new Map(); // capa -> ciclos ya cerrados (CIRCLE)
  const anadir = (m, capa, x) => (m.has(capa) ? m.get(capa).push(x) : m.set(capa, [x]));

  function agregar(capa, puntos) {
    if (dist(puntos[0], puntos.at(-1)) <= tolerancia) throw new ErrorClave('dxf.tramoCerrado', capa);
    anadir(porCapa, capa, puntos);
  }

  function discretizarArco(centro, radio, inicio, barrido) {
    if (!(radio > 0) || !Number.isFinite(inicio) || !(Math.abs(barrido) >= 1e-12) || Math.abs(barrido) > DOS_PI + 1e-9) {
      throw new ErrorClave('dxf.arco');
    }
    // Paso angular del círculo de 96 lados (como poligonoCircular), y cuerda no mayor que cuerdaMaxima.
    const maxPaso = Math.min(cuerdaMaxima >= 2 * radio ? Math.PI : 2 * Math.asin(cuerdaMaxima / (2 * radio)), DOS_PI / 96);
    const n = Math.max(puntosMinimosArco - 1, Math.ceil(Math.abs(barrido) / maxPaso));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = inicio + (barrido * i) / n;
      pts.push({ x: centro.x + radio * Math.cos(a), y: centro.y + radio * Math.sin(a) });
    }
    return pts;
  }

  function tramoBulge(a, b, bulge, capa) {
    const L = dist(a, b);
    if (L <= tolerancia) throw new ErrorClave('dxf.tramoNulo', capa);
    if (Math.abs(bulge) < 1e-12) return [a, b];
    const barrido = 4 * Math.atan(bulge);
    const radio = (L * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
    const offset = (L * (1 - bulge * bulge)) / (4 * bulge);
    const centro = {
      x: (a.x + b.x) / 2 - (offset * (b.y - a.y)) / L,
      y: (a.y + b.y) / 2 + (offset * (b.x - a.x)) / L,
    };
    const pts = discretizarArco(centro, radio, Math.atan2(a.y - centro.y, a.x - centro.x), barrido);
    pts[0] = a;
    pts[pts.length - 1] = b;
    return pts;
  }

  function polilinea(vs, cerrada, capa) {
    if (vs.length < 2) throw new ErrorClave('dxf.polilineaVacia', capa);
    // Algunos CAD repiten el primer vértice como último.
    if (vs.length >= 3 && cerca(vs[0], vs.at(-1))) {
      if (Math.abs(vs.at(-1).bulge) > 1e-12) throw new ErrorClave('dxf.bulgeFinal', capa);
      vs = vs.slice(0, -1);
      cerrada = true;
    }
    if (cerrada && vs.length < 3) throw new ErrorClave('dxf.polilineaVacia', capa);
    for (let i = 0; i < vs.length - 1; i++) agregar(capa, tramoBulge(vs[i], vs[i + 1], vs[i].bulge, capa));
    if (cerrada) agregar(capa, tramoBulge(vs.at(-1), vs[0], vs.at(-1).bulge, capa));
  }

  /** Vértices de una LWPOLYLINE: cada código 10 abre uno nuevo. */
  function verticesLW(e) {
    const vs = [];
    for (const [c, v] of e.g) {
      if (c === 10) vs.push({ x: Number(v), y: NaN, bulge: 0 });
      else if (vs.length && c === 20) vs.at(-1).y = Number(v);
      else if (vs.length && c === 42) vs.at(-1).bulge = Number(v);
    }
    if (!vs.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.bulge))) throw new ErrorClave('dxf.numero', e.tipo, 10);
    return vs;
  }

  const lista = entidades(grupos(textoDXF));
  for (let k = 0; k < lista.length; k++) {
    const e = lista[k];
    if (num(e, 67, 0) !== 0) {
      // Espacio papel: se salta la entidad (y los vértices de una POLYLINE).
      if (e.tipo === 'POLYLINE') while (k + 1 < lista.length && lista[k + 1].tipo !== 'SEQEND') k++;
      continue;
    }
    const capa = capaDe(e);
    if (!ADMITIDAS.has(e.tipo)) throw new ErrorClave('dxf.entidad', e.tipo, capa);
    // Normal (extrusión): solo +Z, para que las coordenadas propias de la entidad sean las del dibujo.
    if (Math.abs(num(e, 210, 0)) > 1e-10 || Math.abs(num(e, 220, 0)) > 1e-10 || Math.abs(num(e, 230, 1) - 1) > 1e-10) {
      throw new ErrorClave('dxf.normal', e.tipo, capa);
    }
    switch (e.tipo) {
      case 'LINE':
        agregar(capa, [{ x: num(e, 10), y: num(e, 20) }, { x: num(e, 11), y: num(e, 21) }]);
        break;
      case 'LWPOLYLINE':
        polilinea(verticesLW(e), (num(e, 70, 0) & 1) === 1, capa);
        break;
      case 'POLYLINE': {
        // 2 y 4: curvas ajustadas; 8: 3D; 16: malla; 64: polyface.
        const f = num(e, 70, 0);
        if (f & (2 | 4 | 8 | 16 | 64)) throw new ErrorClave('dxf.polilinea3D', capa);
        const vs = [];
        while (k + 1 < lista.length && lista[k + 1].tipo === 'VERTEX') {
          const v = lista[++k];
          vs.push({ x: num(v, 10), y: num(v, 20), bulge: num(v, 42, 0) });
        }
        if (lista[k + 1]?.tipo !== 'SEQEND') throw new ErrorClave('dxf.sinSeqend', capa);
        k++;
        polilinea(vs, (f & 1) === 1, capa);
        break;
      }
      case 'ARC': {
        const a0 = (num(e, 50) * Math.PI) / 180;
        const a1 = (num(e, 51) * Math.PI) / 180;
        let barrido = (a1 - a0) % DOS_PI;
        if (barrido <= 0) barrido += DOS_PI;
        agregar(capa, discretizarArco({ x: num(e, 10), y: num(e, 20) }, num(e, 40), a0, barrido));
        break;
      }
      case 'CIRCLE': {
        const pts = discretizarArco({ x: num(e, 10), y: num(e, 20) }, num(e, 40), 0, DOS_PI);
        pts.pop(); // el último repite el primero
        anadir(circulos, capa, pts);
        break;
      }
    }
  }

  // Une los tramos por sus extremos coincidentes y reconstruye los ciclos cerrados.
  // Cada nudo debe tener grado 2. Puede haber varios ciclos por capa.
  function reconstruir(segmentos, capa) {
    const nodos = [];
    const aristas = [];
    function idNodo(p) {
      const ids = [];
      for (let j = 0; j < nodos.length; j++) if (cerca(nodos[j].p, p)) ids.push(j);
      if (ids.length > 1) throw new ErrorClave('dxf.unionAmbigua', capa);
      if (ids.length) return ids[0];
      nodos.push({ p, aristas: [] });
      return nodos.length - 1;
    }
    for (const puntos of segmentos) {
      const a = idNodo(puntos[0]);
      const b = idNodo(puntos.at(-1));
      if (a === b) throw new ErrorClave('dxf.tramoCerrado', capa);
      aristas.push({ a, b, puntos });
      nodos[a].aristas.push(aristas.length - 1);
      nodos[b].aristas.push(aristas.length - 1);
    }
    if (nodos.some((n) => n.aristas.length !== 2)) throw new ErrorClave('dxf.abierto', capa);
    const visitadas = new Set();
    const ciclos = [];
    for (let semilla = 0; semilla < aristas.length; semilla++) {
      if (visitadas.has(semilla)) continue;
      let actual = aristas[semilla].a;
      const origen = actual;
      let id = semilla;
      const poligono = [];
      for (;;) {
        const arista = aristas[id];
        const directo = arista.a === actual;
        const pts = directo ? arista.puntos : [...arista.puntos].reverse();
        poligono.push(...pts.slice(0, -1));
        visitadas.add(id);
        actual = directo ? arista.b : arista.a;
        if (actual === origen) break;
        const restantes = nodos[actual].aristas.filter((j) => !visitadas.has(j));
        if (restantes.length !== 1) throw new ErrorClave('dxf.abierto', capa);
        id = restantes[0];
      }
      const limpio = [];
      for (const p of poligono) if (!limpio.length || !cerca(limpio.at(-1), p)) limpio.push(p);
      if (limpio.length > 1 && cerca(limpio[0], limpio.at(-1))) limpio.pop();
      if (limpio.length < 3) throw new ErrorClave('dxf.degenerado', capa);
      ciclos.push(limpio);
    }
    return ciclos;
  }

  function areaFirmada(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      s += a.x * b.y - b.x * a.y;
    }
    return 0.5 * s;
  }
  function orientar(puntos, antihorario) {
    const a = areaFirmada(puntos);
    if (Math.abs(a) <= tolerancia * tolerancia) throw new ErrorClave('dxf.degenerado', '');
    return a > 0 === antihorario ? puntos : [...puntos].reverse();
  }

  const exterior = [];
  const huecos = [];
  for (const capa of new Set([...porCapa.keys(), ...circulos.keys()])) {
    const ciclos = [...reconstruir(porCapa.get(capa) ?? [], capa), ...(circulos.get(capa) ?? [])];
    (capa === '0' ? exterior : huecos).push(...ciclos);
  }
  if (exterior.length !== 1) throw new ErrorClave('dxf.exterior', exterior.length);
  return {
    exterior: orientar(exterior[0], true),
    huecos: huecos.map((p) => orientar(p, false)),
  };
}

/**
 * Pasa lo leído del DXF a la geometría de una sección genérica (src/core/geometria.js):
 * puntos [x, y] en m con x desde el borde izquierdo e y hacia abajo desde la fibra superior.
 * El motor no cambia: aquí solo se invierte la y del dibujo.
 * @param {{exterior: {x:number,y:number}[], huecos: {x:number,y:number}[][]}} dxf
 */
export function dxfAGeometria({ exterior, huecos }) {
  const xmin = Math.min(...exterior.map((p) => p.x));
  const ymax = Math.max(...exterior.map((p) => p.y));
  const conv = (pts) => pts.map((p) => [p.x - xmin, ymax - p.y]);
  return { contorno: conv(exterior), huecos: huecos.map(conv) };
}
