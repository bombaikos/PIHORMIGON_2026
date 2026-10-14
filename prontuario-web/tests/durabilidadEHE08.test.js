import test from 'node:test';
import assert from 'node:assert/strict';
import { durabilidad, deshabilitadas, normalizar } from '../src/norma/ehe08/durabilidad.js';

const base = { tipo: 'armado', cemento: 'cem1', vida: 50, fck: 30, arido: 20, fiMax: 20 };

test('las clases incompatibles se ponen en gris', () => {
  const no = deshabilitadas(['IIa', 'Qb']);
  for (const c of ['I', 'IIb', 'IIIa', 'IIIb', 'IIIc', 'IV', 'Qa', 'Qc']) assert.ok(no.has(c), c);
  for (const c of ['IIa', 'Qb', 'H', 'F', 'E']) assert.ok(!no.has(c), c);
  assert.ok(deshabilitadas(['H']).has('F'));
  assert.ok(!deshabilitadas(['E']).has('H'));
});

test('hormigón en masa: solo clase I', () => {
  const no = deshabilitadas([], 'masa');
  assert.ok(no.has('IIa') && !no.has('I') && !no.has('Qa'));
  assert.deepEqual(normalizar(['IIIa', 'F'], 'masa'), ['I', 'F']);
});

test('IIa, CEM I, fck 30, 50 años: rmin 15 y rnom 25', () => {
  const r = durabilidad({ ...base, clases: ['IIa'] });
  assert.equal(r.rmin, 20); // manda ø20 de la barra
  const r2 = durabilidad({ ...base, clases: ['IIa'], fiMax: 12 });
  assert.equal(r2.rmin, 16); // 0,8·20 del árido
  const r3 = durabilidad({ ...base, clases: ['IIa'], fiMax: 12, arido: 10 });
  assert.equal(r3.rmin, 15); // tabla 37.2.4.1.a
  assert.equal(r3.rnom, 25);
  assert.equal(r3.ac, 0.60);
  assert.equal(r3.cemento, 275);
  assert.equal(r3.fckMin, 25);
});

test('IIIa con CEM I (resto de cementos): 45 mm; con CEM III: 25 mm; el CE da 40 con CEM I', () => {
  const a = durabilidad({ ...base, clases: ['IIIa'], fiMax: 16 });
  assert.equal(a.rmin, 45);
  assert.equal(a.ce[0].v[2], 40);
  const b = durabilidad({ ...base, clases: ['IIIa'], cemento: 'cem3', fiMax: 16 });
  assert.equal(b.rmin, 25);
  assert.equal(b.ce.length, 0);
});

test('IIIc: el CE pide 45 mm donde la EHE-08 pide 35', () => {
  const r = durabilidad({ ...base, clases: ['IIIc'], cemento: 'cem3', fiMax: 16 });
  assert.equal(r.rmin, 35);
  assert.deepEqual(r.ce[0].v.slice(2, 4), [45, 35]);
});

test('combinación IIIa + F: manda el más exigente en dosificación', () => {
  const r = durabilidad({ ...base, clases: ['IIIa', 'F'], cemento: 'cemAD', fiMax: 16 });
  assert.equal(r.ac, 0.50);
  assert.equal(r.cemento, 325);
  assert.deepEqual(r.mandaCemento, ['F']);
  assert.ok(r.notas.some((n) => n.clave === 'eh.aire'));
});

test('recubrimiento excesivo: sin rnom y con aviso de estudio', () => {
  const r = durabilidad({ ...base, clases: ['IV'], cemento: 'cem1' });
  assert.equal(r.rnom, null);
  assert.deepEqual(r.estudio, ['IV']);
});

test('Qb y Qc: lo fija el proyecto', () => {
  const r = durabilidad({ ...base, clases: ['IIa', 'Qb'], fiMax: 12, arido: 10 });
  assert.deepEqual(r.fijaProyecto, ['Qb']);
  assert.equal(r.rmin, 15);
  assert.ok(r.ce.some((n) => n.clave === 'eh.ceQ'));
});

test('control de ejecución y contacto con el terreno', () => {
  const r = durabilidad({ ...base, clases: ['I'], control: 'intenso', contraTerreno: true });
  assert.equal(r.rmin, 70);
  assert.equal(r.rnom, 75);
});

test('fck de 40 o más baja el recubrimiento en IIa con CEM I', () => {
  assert.equal(durabilidad({ ...base, clases: ['IIa'], fck: 40, fiMax: 8, arido: 10 }).rmin, 10);
});
