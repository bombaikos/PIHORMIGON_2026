import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangos, reajusta, bandaEje } from '../src/core/dominioGauges.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
// Poliedro conocido: u0 + u1 ≤ 1, u0 − u1 ≤ 1, u1 ≤ 0.5, u1 ≥ −0.5, −1 ≤ u2 ≤ 0.8 + 0.2·u0, u0 ≥ −0.4
const poli = (u) => u[0] + u[1] <= 1 + 1e-12 && u[0] - u[1] <= 1 + 1e-12 && Math.abs(u[1]) <= 0.5 + 1e-12 && u[2] >= -1 && u[2] <= 0.8 + 0.2 * u[0] + 1e-12 && u[0] >= -0.4;

test('rangos totales sin candados: coinciden con los del poliedro', () => {
  const r = rangos(poli, [0.1, 0.1, 0], [false, false, false]);
  cerca(r.total[0][0], -0.4, 1e-3, 'u0 mín');
  cerca(r.total[0][1], 1, 1e-3, 'u0 máx');
  cerca(r.total[1][0], -0.5, 1e-3);
  cerca(r.total[1][1], 0.5, 1e-3);
  cerca(r.total[2][0], -1, 1e-3);
  cerca(r.total[2][1], 1, 1e-3, 'u2 máx = 0,8 + 0,2·1');
});

test('banda: valores con las otras dos fijas; siempre dentro del total', () => {
  const p = [0.2, 0.1, 0];
  const r = rangos(poli, p, [false, false, false]);
  cerca(r.banda[0][1], 0.9, 1e-6, 'u0 máx con u1 = 0,1');
  cerca(r.banda[0][0], -0.4, 1e-6);
  cerca(r.banda[2][1], 0.84, 1e-6);
  for (let j = 0; j < 3; j++) assert.ok(r.banda[j][0] >= r.total[j][0] - 1e-9 && r.banda[j][1] <= r.total[j][1] + 1e-9);
});

test('candados: con dos bloqueadas el total de la tercera es su banda; con tres no se mueve nada', () => {
  const p = [0.2, 0.1, 0];
  const r = rangos(poli, p, [true, true, false]);
  cerca(r.total[2][0], -1, 1e-9);
  cerca(r.total[2][1], 0.84, 1e-9);
  assert.deepEqual(r.total[0], [0.2, 0.2]);
  const t = rangos(poli, p, [true, true, true]);
  assert.deepEqual(t.total, [[0.2, 0.2], [0.1, 0.1], [0, 0]]);
  // una bloqueada: el total de u0 con u1 = 0,1 fijo y u2 libre
  const u = rangos(poli, p, [false, true, false]);
  cerca(u.total[0][1], 0.9, 1e-3);
});

test('estado fuera del dominio: sin banda, con total desde el origen', () => {
  const r = rangos(poli, [3, 0, 0], [false, false, false]);
  assert.equal(r.dentro, false);
  assert.equal(r.banda, null);
  cerca(r.total[0][1], 1, 1e-3);
});

test('reajuste: dentro de la banda solo cambia esa variable; fuera, las otras se mueven lo mínimo y siguen admisibles', () => {
  const p = [0.2, 0.4, 0];
  const r = rangos(poli, p, [false, false, false]);
  const a = reajusta(poli, p, 0, 0.5, [false, false, false], r);
  assert.deepEqual([a[1], a[2]], [0.4, 0]);
  const b = reajusta(poli, p, 0, 0.9, [false, false, false], r);
  assert.ok(poli(b));
  cerca(b[0], 0.9, 1e-9);
  assert.ok(b[1] < 0.4, 'u1 baja para que u0 = 0,9 quepa (u0 + u1 ≤ 1 → u1 ≤ 0,1)');
  cerca(b[1], 0.1, 5e-3, 'el punto admisible más cercano en u1');
  cerca(b[2], 0, 1e-4, 'u2 no hace falta moverla');
});

test('reajuste con un candado: la bloqueada no se mueve', () => {
  const p = [0.2, 0.4, 0];
  const bl = [false, false, true];
  const r = rangos(poli, p, bl);
  const b = reajusta(poli, p, 0, 0.9, bl, r);
  assert.equal(b[2], 0);
  assert.ok(poli(b));
  assert.equal(reajusta(poli, p, 2, 0.5, bl, r), null);
});

test('reajuste en métrica de rangos totales: sobre un disco, el punto del borde más cercano', () => {
  // Disco u0² + u1² ≤ 1 en el plano (u0, u1), u2 libre en [−1, 1]
  const disco = (u) => u[0] ** 2 + u[1] ** 2 <= 1 + 1e-12 && Math.abs(u[2]) <= 1;
  const p = [0.5, 0.5, 0];
  const bl = [false, false, true];
  const r = rangos(disco, p, bl);
  const b = reajusta(disco, p, 0, 0.9, bl, r);
  cerca(b[0], 0.9, 1e-9);
  cerca(b[1], Math.sqrt(1 - 0.81), 5e-3);
});

test('bandaEje respeta el tope en dominios sin límite', () => {
  const [a, b] = bandaEje(() => true, [0, 0, 0], 0);
  cerca(a, -2, 1e-9);
  cerca(b, 2, 1e-9);
});
