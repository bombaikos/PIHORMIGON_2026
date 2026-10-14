import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerSeccionDXF, dxfAGeometria } from '../src/io/importDXF.js';
import { geometria } from '../src/core/geometria.js';
import { bruta } from '../src/core/propiedades.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);

// Construye un DXF mínimo: cada entidad es [tipo, [[código, valor], ...]].
const dxf = (...ents) =>
  ['0', 'SECTION', '2', 'ENTITIES', ...ents.flatMap(([t, g]) => ['0', t, ...g.flatMap(([c, v]) => [String(c), String(v)])]), '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
const lw = (capa, pts, cerrada = true, extra = []) => ['LWPOLYLINE', [[8, capa], [90, pts.length], [70, cerrada ? 1 : 0], ...pts.flatMap(([x, y, b]) => [[10, x], [20, y], ...(b ? [[42, b]] : [])]), ...extra]];
const linea = (capa, [x1, y1], [x2, y2]) => ['LINE', [[8, capa], [10, x1], [20, y1], [11, x2], [21, y2]]];
const arco = (capa, [x, y], r, a0, a1, extra = []) => ['ARC', [[8, capa], [10, x], [20, y], [40, r], [50, a0], [51, a1], ...extra]];
const circulo = (capa, [x, y], r) => ['CIRCLE', [[8, capa], [10, x], [20, y], [40, r]]];
const area = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + (a.x * b.y - b.x * a.y) / 2; }, 0);
const rect = [[0, 0], [0.3, 0], [0.3, 0.5], [0, 0.5]];

test('DXF: rectángulo en LWPOLYLINE con hueco circular', () => {
  const r = leerSeccionDXF(dxf(lw('0', rect), circulo('HUECO', [0.15, 0.25], 0.05)));
  assert.equal(r.exterior.length, 4);
  cerca(area(r.exterior), 0.15, 1e-12, 'exterior antihorario');
  assert.equal(r.huecos.length, 1);
  assert.ok(area(r.huecos[0]) < 0, 'hueco horario');
  cerca(-area(r.huecos[0]), Math.PI * 0.05 ** 2, 2e-4);
});

test('DXF: líneas sueltas en cualquier sentido y POLYLINE con VERTEX', () => {
  const r = leerSeccionDXF(dxf(
    linea('0', [0, 0], [0.3, 0]), linea('0', [0.3, 0.5], [0.3, 0]), linea('0', [0.3, 0.5], [0, 0.5]), linea('0', [0, 0], [0, 0.5]),
    ['POLYLINE', [[8, 'H'], [66, 1], [70, 1]]],
    ...[[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]].map(([x, y]) => ['VERTEX', [[8, 'H'], [10, x], [20, y]]]),
    ['SEQEND', [[8, 'H']]],
  ));
  cerca(area(r.exterior), 0.15, 1e-12);
  cerca(area(r.huecos[0]), -0.01, 1e-12);
});

test('DXF: arcos con bulge y con ARC', () => {
  // Rectángulo con semicírculo encima (bulge 1 en el tramo superior, de derecha a izquierda).
  const r = leerSeccionDXF(dxf(lw('0', [[0, 0], [0.3, 0], [0.3, 0.5, 1], [0, 0.5]])));
  cerca(area(r.exterior), 0.15 + (Math.PI * 0.15 ** 2) / 2, 5e-4);
  assert.ok(Math.max(...r.exterior.map((p) => p.y)) > 0.64, 'el semicírculo va hacia arriba');
  // Círculo exterior hecho con dos ARC.
  const c = leerSeccionDXF(dxf(arco('0', [0, 0], 0.2, 0, 180), arco('0', [0, 0], 0.2, 180, 360)));
  cerca(area(c.exterior), Math.PI * 0.04, 1e-3);
});

test('DXF: se rechaza la normal distinta de +Z, también en ARC, LWPOLYLINE y CIRCLE', () => {
  const menosZ = [[210, 0], [220, 0], [230, -1]];
  assert.throws(() => leerSeccionDXF(dxf(arco('0', [0, 0], 0.2, 0, 180, menosZ), arco('0', [0, 0], 0.2, 180, 360))), { message: 'dxf.normal' });
  assert.throws(() => leerSeccionDXF(dxf(lw('0', rect, true, menosZ))), { message: 'dxf.normal' });
  const c = circulo('0', [0, 0], 0.2);
  c[1].push(...menosZ);
  assert.throws(() => leerSeccionDXF(dxf(c)), { message: 'dxf.normal' });
});

test('DXF: se rechaza cualquier otra entidad; el espacio papel se ignora', () => {
  assert.throws(() => leerSeccionDXF(dxf(lw('0', rect), ['HATCH', [[8, 'RAYADO']]])), { message: 'dxf.entidad' });
  assert.throws(() => leerSeccionDXF(dxf(lw('0', rect), ['INSERT', [[8, '0'], [2, 'B']]])), { message: 'dxf.entidad' });
  const r = leerSeccionDXF(dxf(lw('0', rect), ['TEXT', [[8, '0'], [67, 1], [1, 'cajetín']]]));
  assert.equal(r.huecos.length, 0);
});

test('DXF: errores de contorno', () => {
  assert.throws(() => leerSeccionDXF(dxf(lw('0', rect, false))), { message: 'dxf.abierto' });
  assert.throws(() => leerSeccionDXF(dxf(lw('0', rect), circulo('0', [0.15, 0.25], 0.05))), { message: 'dxf.exterior' });
  assert.throws(() => leerSeccionDXF(dxf(lw('H', rect))), { message: 'dxf.exterior' });
  assert.throws(() => leerSeccionDXF('AutoCAD Binary DXF\r\n\x1a\x00'), { message: 'dxf.binario' });
});

test('DXF a geometría: se invierte la y y el motor da el centro de gravedad correcto', () => {
  // T invertida dibujada en el DXF (y hacia arriba) lejos del origen: ala abajo de 1,0 × 0,2 y alma de 0,3 × 0,4.
  const [x0, y0] = [10, 20];
  const T = [[0, 0], [1, 0], [1, 0.2], [0.65, 0.2], [0.65, 0.6], [0.35, 0.6], [0.35, 0.2], [0, 0.2]].map(([x, y]) => [x0 + x, y0 + y]);
  const g = dxfAGeometria(leerSeccionDXF(dxf(lw('0', T))));
  const xs = g.contorno.map((p) => p[0]), ys = g.contorno.map((p) => p[1]);
  cerca(Math.min(...xs), 0, 1e-12);
  cerca(Math.min(...ys), 0, 1e-12);
  cerca(Math.max(...ys), 0.6, 1e-12);
  const geo = geometria({ forma: 'generica', geo: g, armado: [] });
  const b = bruta(geo);
  cerca(b.A, 0.32, 1e-12);
  // Desde la fibra superior: el ala queda abajo, así que yg = 0,6 − 0,2125.
  cerca(b.yg, 0.6 - 0.068 / 0.32, 1e-9);
});
