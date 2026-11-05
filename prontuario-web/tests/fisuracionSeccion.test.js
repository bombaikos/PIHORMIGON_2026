// Fisuración de una sección real: el estado fisurado sale del motor de Estado tensional y reproduce el caso de referencia V-1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proyectoNuevo, datosViga, geometriaDe, materialesSeccion, seccionNueva } from '../src/io/proyecto.js';
import { fisuraSeccion, curvaWk, dimensionaSeccion, NORMAS_FIS } from '../src/core/fisuracionSeccion.js';

const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} no está a ${tol} de ${b}`);

function caso(forma, armado, signo = 1, ajusta = () => {}) {
  const p = proyectoNuevo();
  const s = seccionNueva('s', forma, 'HA-30', p.aceros[1].nombre);
  s.armado = armado;
  ajusta(s);
  const mats = materialesSeccion(p, s);
  return { p, s, c: { geo: geometriaDe(p, s), mats, v: datosViga(p, s, signo), fck: mats.hormigon.fk / 1000 } };
}
const V1 = [{ tipo: 'capa', cara: 'sup', texto: '', d: 0.04 }, { tipo: 'capa', cara: 'inf', texto: '3D20', d: 0.04 }];

test('V-1 (300×500, 3Ø20, c = 30, HA-30, M = 80 kN·m) con el motor tensional: x, σs, σsr y wk de las tres normas', () => {
  const { c } = caso('rectangular', V1, 1, (s) => { s.geo = { b: 0.3, h: 0.5 }; });
  const r = fisuraSeccion(c, { M: 80 });
  cerca(r.e.x, 114.9178, 1e-5);
  cerca(r.e.ss, 201.2896, 1e-5);
  cerca(r.e.ssr, 100.2081, 1e-5);
  cerca(r.Mfis, 39.82644, 1e-5);
  cerca(r.wk.EHE08, 0.213568, 1e-5);
  cerca(r.wk['EC2-2004'], 0.165399, 1e-5);
  cerca(r.wk['EC2-2023'], 0.169367, 1e-5);
});

test('Por debajo de Mfis no hay fisura', () => {
  const { c } = caso('rectangular', V1, 1, (s) => { s.geo = { b: 0.3, h: 0.5 }; });
  const r = fisuraSeccion(c, { M: 30 });
  assert.equal(r.sinFisurar, true);
});

test('M negativo = M positivo de la misma viga con las caras intercambiadas', () => {
  const geo = (s) => { s.geo = { b: 0.3, h: 0.5 }; };
  const a = caso('rectangular', V1, 1, geo);
  const inv = V1.map((g) => ({ ...g, cara: g.cara === 'inf' ? 'sup' : 'inf' }));
  const b = caso('rectangular', inv, -1, geo);
  const ra = fisuraSeccion(a.c, { M: 80 });
  const rb = fisuraSeccion(b.c, { M: -80 });
  for (const n of NORMAS_FIS) cerca(rb.wk[n], ra.wk[n], 1e-6);
});

test('Un axil de compresión reduce wk y uno de tracción lo aumenta', () => {
  const { c } = caso('rectangular', V1, 1, (s) => { s.geo = { b: 0.3, h: 0.5 }; });
  const w = (N) => fisuraSeccion(c, { M: 80, N }).wk.EHE08;
  assert.ok(w(100) < w(0) && w(0) < w(-30));
});

test('Viga en T con M+: wk finito y creciente con M; con M− la cabeza traccionada usa su ancho', () => {
  const { c } = caso('T', [{ tipo: 'capa', cara: 'sup', texto: '', d: 0.04 }, { tipo: 'capa', cara: 'inf', texto: '4D20', d: 0.05 }]);
  const a = fisuraSeccion(c, { M: 120 }).wk['EC2-2004'];
  const b = fisuraSeccion(c, { M: 160 }).wk['EC2-2004'];
  assert.ok(a > 0 && b > a);
  const n = caso('T', [{ tipo: 'capa', cara: 'sup', texto: '4D20', d: 0.05 }, { tipo: 'capa', cara: 'inf', texto: '', d: 0.04 }], -1);
  const r = fisuraSeccion(n.c, { M: -120 });
  assert.ok(r.wk.EHE08 > 0);
  cerca(r.g.b, 1000, 1e-9);
});

test('La curva wk(M) es monótona y vale 0 antes de Mfis', () => {
  const { c } = caso('rectangular', V1, 1, (s) => { s.geo = { b: 0.3, h: 0.5 }; });
  const pts = curvaWk(c, { M: 1 }, 120, 24);
  assert.equal(pts[0].wk.EHE08, 0);
  const w = pts.map((q) => q.wk.EHE08);
  for (let i = 1; i < w.length; i++) assert.ok(w[i] >= w[i - 1] - 1e-9);
});

test('Dimensionar: con más barras o más ø baja wk, y la solución cumple wmáx', () => {
  const { c } = caso('rectangular', V1, 1, (s) => { s.geo = { b: 0.3, h: 0.5 }; });
  const r = dimensionaSeccion(c, { M: 80 }, 'EC2-2004', 0.3, [12, 16, 20, 25]);
  const ok = r.filter((x) => x.n);
  assert.ok(ok.length > 0);
  for (const x of ok) assert.ok(x.wk <= 0.3 + 1e-9);
  assert.ok(ok[0].n >= ok.at(-1).n);
});
