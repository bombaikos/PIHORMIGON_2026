import test from 'node:test';
import assert from 'node:assert/strict';
import { rangosGeneral, reajustaGeneral, tramosEje } from '../src/core/dominioGauges.js';

// Dominio de prueba: disco de radio 1 en (a, b) más una variable cíclica angular t en [0, 360) con a² + b² ≤ 1 + 0.5 cos(t)
const dom = [{ lo: -2, hi: 2 }, { lo: -2, hi: 2 }, { lo: 0, hi: 360, cic: true }];
const en = (p) => p[0] ** 2 + p[1] ** 2 <= 1 + 0.5 * Math.cos((p[2] * Math.PI) / 180) + 1e-12;

test('tramosEje: extremos afinados del disco', () => {
  const [t] = tramosEje(en, dom, [0, 0, 0], 0);
  assert.ok(Math.abs(t.a + Math.sqrt(1.5)) < 1e-6 && Math.abs(t.b - Math.sqrt(1.5)) < 1e-6);
});

test('rango total de una variable no cíclica con las otras libres', () => {
  const r = rangosGeneral(en, dom, [0, 0, 0], [false, false, false]);
  assert.ok(Math.abs(r.total[0][1] - Math.sqrt(1.5)) < 2e-2, String(r.total[0]));
  assert.deepEqual(r.total[2], [0, 360]);
});

test('con la variable cíclica bloqueada el rango es el de esa sección', () => {
  const r = rangosGeneral(en, dom, [0, 0, 180], [false, false, true]);
  assert.ok(Math.abs(r.total[0][1] - Math.sqrt(0.5)) < 1e-6);
});

test('reajusta lleva el estado al dominio con el mínimo movimiento', () => {
  const r = rangosGeneral(en, dom, [0.5, 0, 180], [false, false, true]);
  const q = reajustaGeneral(en, dom, [0.5, 0, 180], 0, 0.6, [false, false, true], r);
  assert.ok(q && en(q) && Math.abs(q[0] - 0.6) < 1e-9);
});
