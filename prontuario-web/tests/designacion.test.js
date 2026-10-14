import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designacionCE, designacionEN } from '../src/norma/designacion.js';

test('designación CE y EN', () => {
  const d = { tipo: 'armado', fck: 25, consistencia: 'B', arido: 20, clases: ['XC4', 'XD3'] };
  assert.equal(designacionCE(d), 'HA-25/B/20/XC4+XD3');
  assert.equal(designacionEN(d), 'C25/30 XC4, XD3 D20 S2 Cl 0,40');
  assert.equal(designacionEN({ ...d, tipo: 'masa', clases: [] }), 'C25/30 … D20 S2');
});
