import test from 'node:test';
import assert from 'node:assert/strict';
import { fuego, TIEMPOS } from '../src/norma/fuego.js';

const base = { norma: 'EHE-08', R: 120, arido: 'siliceo' };

test('EHE-08: pilar R 120 → 250/40 (A.6.5.2)', () => {
  const r = fuego({ ...base, elemento: 'pilar' });
  assert.deepEqual(r.opciones.map((o) => [o.d, o.a]), [[250, 40]]);
  assert.equal(r.tabla, 'A.6.5.2');
});

test('EHE-08: viga R 90 → cuatro combinaciones y alma 100 (A.6.5.5.2)', () => {
  const r = fuego({ ...base, R: 90, elemento: 'viga' });
  assert.deepEqual(r.opciones.map((o) => [o.d, o.a]), [[150, 40], [200, 35], [250, 30], [400, 25]]);
  assert.equal(r.extra[0][1], '100');
  assert.equal(fuego({ ...base, R: 30, elemento: 'viga' }).opciones.length, 3);
});

test('árido calizo: −10 % en vigas y losas, no en pilares', () => {
  const v = fuego({ ...base, R: 90, elemento: 'viga', arido: 'calizo' });
  assert.deepEqual(v.opciones[0], { d: 135, a: 36, geom: false, barras8: false });
  const c = fuego({ norma: 'EC2-2004', R: 90, elemento: 'viga', arido: 'calizo' });
  assert.deepEqual(c.opciones[0], { d: 135, a: 55, geom: false, barras8: false }); // CE: solo la dimensión
  const p = fuego({ ...base, elemento: 'pilar', arido: 'calizo' });
  assert.equal(p.opciones[0].d, 250);
  assert.ok(p.notas.includes('f.caliza.noAdmite'));
});

test('EHE-08: muros no portantes y portantes', () => {
  assert.equal(fuego({ ...base, elemento: 'muro', portante: false }).opciones[0].d, 120);
  const una = fuego({ ...base, elemento: 'muro', portante: true, caras: 'una' }).opciones[0];
  const dos = fuego({ ...base, elemento: 'muro', portante: true, caras: 'dos' }).opciones[0];
  assert.deepEqual([una.d, una.a, dos.d, dos.a], [160, 25, 180, 35]);
});

test('EHE-08: losa R 120, tres casos de flexión', () => {
  const a = (dir) => fuego({ ...base, elemento: 'losa', dir }).opciones[0];
  assert.deepEqual([a('uni').d, a('uni').a, a('bi15').a, a('bi2').a], [120, 35, 20, 30]);
});

test('CE: pilar R 120 según ηfi y una cara (A20.5.2a)', () => {
  const o = (e) => fuego({ norma: 'EC2-2004', R: 120, elemento: 'pilar', ...e }).opciones.map((x) => [x.d, x.a, x.barras8]);
  assert.deepEqual(o({ eta: 0.2 }), [[250, 40, false], [350, 35, false]]);
  assert.deepEqual(o({ eta: 0.7 }), [[350, 57, true], [450, 51, true]]);
  assert.deepEqual(o({ caras: 'una' }), [[175, 35, false]]);
  assert.equal(fuego({ norma: 'EC2-2004', R: 240, elemento: 'pilar', eta: 0.7 }).opciones.length, 0);
});

test('CE: vigas simplemente apoyadas y continuas', () => {
  const s = fuego({ norma: 'EC2-2004', R: 60, elemento: 'viga', continua: false });
  assert.deepEqual(s.opciones.map((o) => [o.d, o.a]), [[120, 40], [160, 35], [200, 30], [300, 25]]);
  const c = fuego({ norma: 'EC2-2004', R: 60, elemento: 'viga', continua: true });
  assert.deepEqual(c.opciones.map((o) => [o.d, o.a, o.geom]), [[120, 25, false], [200, 12, true]]);
  assert.equal(c.extra[0][1], '100 · 80 · 100');
});

test('CE: muro portante según ηfi y caras; losa', () => {
  const m = (eta, caras) => fuego({ norma: 'EC2-2023', R: 90, elemento: 'muro', portante: true, eta, caras }).opciones[0];
  assert.deepEqual([m(0.35, 'una'), m(0.35, 'dos'), m(0.7, 'una'), m(0.7, 'dos')].map((o) => [o.d, o.a]), [[120, 20], [140, 10], [140, 25], [170, 25]]);
  const l = fuego({ norma: 'EC2-2004', R: 90, elemento: 'losa', dir: 'bi15' }).opciones[0];
  assert.deepEqual([l.d, l.a, l.geom], [100, 15, true]);
});

test('tiempo no tabulado y avisos de fuente', () => {
  assert.throws(() => fuego({ ...base, R: 45, elemento: 'viga' }));
  assert.ok(fuego({ norma: 'EC2-2023', R: 60, elemento: 'losa', dir: 'uni' }).notas.includes('f.ec2023'));
  assert.ok(fuego({ norma: 'EHE-98', R: 60, elemento: 'losa', dir: 'uni' }).notas.includes('f.ehe98'));
  assert.equal(TIEMPOS.length, 6);
});

test('EC-2 cita UNE-EN 1992-1-2 con las tablas 5.x', () => {
  const r = fuego({ norma: 'EC2-2004', R: 90, elemento: 'viga', continua: false });
  assert.deepEqual([r.fuente, r.articulo, r.tabla, r.ceTabla], ['EN', '5.6.2', '5.5', 'A20.5.5']);
  assert.equal(fuego({ norma: 'EHE-08', R: 90, elemento: 'viga' }).fuente, 'EHE-08');
});

test('EC-2: pilar Método B (tabla 5.2b)', () => {
  const o = (e) => fuego({ norma: 'EC2-2004', elemento: 'pilar', metodo: 'B', ...e }).opciones.map((x) => [x.d, x.a, x.geom]);
  assert.deepEqual(o({ R: 120, n: 0.5, omega: 0.5 }), [[450, 50, false], [600, 25, true]]);
  assert.deepEqual(o({ R: 60, n: 0.15, omega: 0.1 }), [[150, 30, false], [200, 25, true]]);
  assert.deepEqual(o({ R: 30, n: 0.7, omega: 1 }), [[200, 30, false], [300, 25, true]]);
  assert.deepEqual(o({ R: 240, n: 0.7, omega: 0.5 }), []); // (1): ancho > 600 mm
  const r = fuego({ norma: 'EC2-2004', elemento: 'pilar', metodo: 'B', R: 90, n: 0.3, omega: 1 });
  assert.equal(r.tabla, '5.2b');
  assert.equal(r.colActiva, 1);
  assert.equal(r.filas.length, 6);
});

test('viga con cuatro caras: canto y área mínimos de la primera combinación', () => {
  const r = fuego({ norma: 'EHE-08', R: 90, elemento: 'viga', nCaras: 4 });
  assert.deepEqual(r.extra.slice(-2), [['f.viga4.canto', '≥ 150', 'mm'], ['f.viga4.area', '≥ 45000', 'mm²']]);
  assert.ok(r.notas.includes('f.viga.cuatro') && !r.notas.includes('f.viga.tres'));
  const t3 = fuego({ norma: 'EHE-08', R: 90, elemento: 'viga', nCaras: 3 });
  assert.equal(t3.extra.length, 1);
  assert.ok(t3.notas.includes('f.viga.tres'));
});

test('EHE-08: pilar con menos de tres caras no tiene tabla', () => {
  const r = fuego({ norma: 'EHE-08', R: 90, elemento: 'pilar', nCaras: 2 });
  assert.equal(r.opciones.length, 0);
  assert.ok(r.notas.includes('f.pilar.eheCaras'));
});
