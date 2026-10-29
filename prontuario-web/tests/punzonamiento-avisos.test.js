// Revisión de la formulación (29/10/2026): separación tangencial en perímetros exteriores (EC-2 2004, 9.4.3(1)) y tipo de
// armadura del EC-2 2023 (ø máximo, 12.7 a 12.9; ηsys, 8.110 y 8.111).

import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from '../src/norma/punzonamiento/index.js';

const base = { fck: 30, fykCercos: 500, rhoX: 0.008, rhoY: 0.008, sigCd: 0, d: 210, c1: 300, c2: 300, Dlower: 20, VEd: 400, tipo: 'rect', pos: 'interior', beta: 1.15 };
const arm = (extra = {}) => ({ fi: 10, ramas: 16, sr: 150, a1: 100, nPer: 3, esq: 'cruz', ...extra });
const claves = (r) => r.disp.map((d) => d.clave);

test('EC-2 2004: pocas ramas en el último perímetro superan st ≤ 2d', () => {
  const N = nucleo('EC2-2004');
  const bien = N.comprobar({ ...base, arm: arm() });
  assert.ok(!claves(bien).includes('pun.disp.stExt'));
  assert.ok(bien.stExt < 2 * 210);
  const mal = N.comprobar({ ...base, arm: arm({ ramas: 8, nPer: 6 }) });
  assert.ok(mal.stExt > 2 * 210);
  assert.ok(claves(mal).includes('pun.disp.stExt'));
});

test('EC-2 2004: con un solo perímetro no se comprueba st exterior', () => {
  const r = nucleo('EC2-2004').comprobar({ ...base, arm: arm({ nPer: 1 }) });
  assert.equal(r.stExt, undefined);
});

test('EC-2 2023: ηsys con conectores es 0.70 + ..., 0.20 más que con cercos hasta el tope', () => {
  const N = nucleo('EC2-2023');
  const cercos = N.comprobar({ ...base, arm: arm({ tipo: 'cerrado' }) });
  const studs = N.comprobar({ ...base, arm: arm({ tipo: 'studs' }) });
  const w = 0.63 * Math.pow(cercos.u.b0 / 210, 0.25);
  assert.ok(Math.abs(cercos.s.etaSys - Math.max(1, 0.5 + w)) < 1e-9);
  assert.ok(Math.abs(studs.s.etaSys - Math.max(1, 0.7 + w)) < 1e-9);
  assert.ok(studs.Vmax >= cercos.Vmax);
});

test('EC-2 2023: ø máximo del cerco según el anclaje', () => {
  const N = nucleo('EC2-2023');
  const f = (tipo, fi) => N.comprobar({ ...base, arm: arm({ tipo, fi }) });
  const k = Math.sqrt(210 / 200);
  assert.ok(Math.abs(f('abierto', 10).fiMax - 10 * k) < 1e-9);
  assert.ok(Math.abs(f('cerrado', 10).fiMax - 11 * k) < 1e-9);
  assert.ok(Math.abs(f('studs', 10).fiMax - 16 * k) < 1e-9);
  assert.ok(claves(f('cerrado', 16)).includes('pun.disp.fiMax'));
  assert.ok(!claves(f('studs', 16)).includes('pun.disp.fiMax'));
});

test('EC-2 2023: la tabla de dimensionar marca los ø que pasan del máximo', () => {
  const r = nucleo('EC2-2023').dimensionar({ ...base, arm: arm({ tipo: 'cerrado' }) }, 400, { diametros: [8, 12, 16] });
  assert.equal(r.tabla.find((f) => f.fi === 8).fiOk, true);
  assert.equal(r.tabla.find((f) => f.fi === 16).fiOk, false);
});
