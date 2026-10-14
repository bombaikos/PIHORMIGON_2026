import test from 'node:test';
import assert from 'node:assert/strict';
import { durabilidad, deshabilitadas, normalizar } from '../src/norma/ec2-2004/durabilidad.js';

const base = { tipo: 'armado', cemento: 'cem1', vida: 50, fck: 30, arido: 20, fiMax: 16 };

test('clases incompatibles en gris', () => {
  const no = deshabilitadas(['XC4']);
  for (const c of ['X0', 'XC1', 'XC2', 'XC3']) assert.ok(no.has(c), c);
  assert.ok(!no.has('XD3') && !no.has('XS1') && !no.has('XF1'));
  assert.ok(deshabilitadas(['XD3']).has('XS2'));
  assert.ok(deshabilitadas(['XS1']).has('XD1'));
  assert.ok(deshabilitadas(['X0']).has('XC4') && !deshabilitadas(['X0']).has('XF1'));
  assert.ok(deshabilitadas([], 'masa').has('XC1'));
  assert.deepEqual(normalizar(['XC3', 'XC4', 'XD1', 'XS2'], 'armado'), ['XC3', 'XD1']);
});

test('XC4, CEM I (adecuado en XC), 50 años: S4 baja 2 → S2 → 20 mm; el CE coincide', () => {
  const r = durabilidad({ ...base, clases: ['XC4'] });
  assert.equal(r.cminDur, 20);
  assert.equal(r.cnom, 30);
  assert.equal(r.ce.length, 0);
});

test('XC4 a 100 años con fck 30: S6 baja 1 → S5 → 30 mm', () => {
  assert.equal(durabilidad({ ...base, clases: ['XC4'], vida: 100 }).cminDur, 30);
});

test('XS1 con cemento adecuado a 50 años: S1 30 − 5 = 25 mm, igual que el CE', () => {
  const r = durabilidad({ ...base, clases: ['XS1'], cemento: 'cem3' });
  assert.equal(r.cminDur, 25);
  assert.equal(r.ce.length, 0);
});

test('XD1 con CEM I: S4 40 + 5 = 45 mm; el CE lo declara excesivo', () => {
  const r = durabilidad({ ...base, clases: ['XD1'], fiMax: 20 });
  assert.equal(r.cminDur, 45);
  assert.equal(r.ce[0].clave, 'ec.ceExcesivo');
});

test('XD3: el AN pide estudio y el CE da 35 mm', () => {
  const r = durabilidad({ ...base, clases: ['XC4', 'XD3'], cemento: 'cem3' });
  assert.equal(r.cnom, null);
  assert.deepEqual(r.estudio, ['XD3']);
  assert.deepEqual(r.ce.find((n) => n.clave === 'ec.ceSinAN').v, ['XD3', 35]);
});

test('XS2 pretensado con CEM II/A-D: S1 30 + 5 = 35 mm, igual que el CE', () => {
  const r = durabilidad({ ...base, tipo: 'pretensado', clases: ['XS2'], cemento: 'cemAD' });
  assert.equal(r.cminDur, 35);
  assert.equal(r.ce.length, 0);
});

test('XF2 y XC2: el recubrimiento de XF viene del CE; dosificación del CE', () => {
  const r = durabilidad({ ...base, clases: ['XC2', 'XF2'] });
  assert.equal(r.detalle.find((x) => x.clase === 'XF2').fuente, 'CE');
  assert.equal(r.ac, 0.50);
  assert.equal(r.cemento, 325);
  assert.equal(r.fckMin, 30);
  assert.ok(r.notas.some((n) => n.clave === 'ec.aire'));
});

test('abrasión suma sobreespesor; terreno fija mínimo', () => {
  const r = durabilidad({ ...base, clases: ['XC4', 'XM2'], terreno: 'directo' });
  assert.equal(r.abrasion, 10);
  assert.equal(r.cmin, 30);
  assert.equal(r.cnom, 75);
});

test('hormigón en masa: sin recubrimiento', () => {
  const r = durabilidad({ ...base, tipo: 'masa', clases: ['X0'] });
  assert.equal(r.cnom, null);
  assert.equal(r.ac, 0.60);
});
