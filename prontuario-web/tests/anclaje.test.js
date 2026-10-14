import test from 'node:test';
import assert from 'node:assert/strict';
import { anclaje, solape, coefM, alfaSolapoEHE } from '../src/norma/anclaje.js';

// Valores de la «Guía para la determinación de longitudes de anclaje y solape de armaduras pasivas» (DGC, abril 2022):
// fyk = 500 MPa, σsd = fyd (r = 1), γc = 1,5, γs = 1,15, sin confinamiento (α3 = α4 = α5 = 1).
const cerca = (a, b, tol = 1.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const base = { fyk: 500, esfuerzo: 'traccion' };

test('EC-2 2004: lb,rqd de la Tabla 1 de la guía (condiciones buenas)', () => {
  const t = { 20: [807, 715, 645, 590, 545, 508], 12: [484, 429, 387, 354, 327, 305], 32: [1291, 1144, 1032, 944, 873, 814] };
  for (const [phi, fila] of Object.entries(t)) {
    [25, 30, 35, 40, 45, 50].forEach((fck, i) => cerca(anclaje({ ...base, norma: 'EC2-2004', fck, phi: +phi, adherencia: 'buena', forma: 'recta', cd: 70 + 0 * i }).lb, fila[i]));
  }
  // C60 y superiores: fctk,0,05 limitado al de C60/75
  cerca(anclaje({ ...base, norma: 'EC2-2004', fck: 80, phi: 20, adherencia: 'buena' }).lb, 475);
});

test('EC-2 2004: lbd de barra recta con cd (Tablas 8 y 9 de la guía, C30/37)', () => {
  const c = (phi, cd, adh) => anclaje({ ...base, norma: 'EC2-2004', fck: 30, phi, adherencia: adh, forma: 'recta', cd }).lbd;
  cerca(c(12, 25, 'buena'), 359);
  cerca(c(12, 40, 'buena'), 300);
  cerca(c(20, 25, 'buena'), 688);
  cerca(c(25, 70, 'buena'), 652);
  cerca(c(32, 25, 'buena'), 1144);
  cerca(c(12, 25, 'deficiente'), 513);
  cerca(c(8, 25, 'buena'), 200);
});

test('EC-2 2004: patilla, gancho o U con lb,eq = α1·lb,rqd (Tablas 10 y 14)', () => {
  const c = (fck, phi, cd, adh) => anclaje({ ...base, norma: 'EC2-2004', fck, phi, adherencia: adh, forma: 'patilla', cd }).lbd;
  cerca(c(30, 10, 25, 'buena'), 357);
  cerca(c(30, 10, 35, 'buena'), 250);
  cerca(c(50, 16, 50, 'buena'), 285);
  cerca(c(50, 12, 40, 'deficiente'), 305);
});

test('EC-2 2004: solape 100 % (Tablas 17 y 18 de la guía, C30/37)', () => {
  const s = (phi, cd, adh) => solape({ ...base, norma: 'EC2-2004', fck: 30, phi, adherencia: adh, cd, pct: 100 }).ls;
  cerca(s(12, 25, 'buena'), 539);
  cerca(s(12, 40, 'buena'), 450); // manda l0,min = 0,3·α6·lb,rqd… o 15φ…: aquí 1,5·300 = 450
  cerca(s(8, 25, 'buena'), 300);
  cerca(s(20, 25, 'buena'), 1032);
  cerca(s(8, 25, 'deficiente'), 429);
  cerca(s(32, 25, 'deficiente'), 2451);
});

test('EC-2 2004: α6 con interpolación (Tabla 8.3)', () => {
  const a = (pct) => solape({ ...base, norma: 'EC2-2004', fck: 30, phi: 20, adherencia: 'buena', cd: 20, pct }).alfa;
  cerca(a(20), 1, 0.001);
  cerca(a(33), 1.15, 0.01);
  cerca(a(50), 1.41, 0.01);
  cerca(a(100), 1.5, 0.001);
});

test('CE 49.5 / EHE-08 (viga): m (Tabla 49.5.1.2.a)', () => {
  assert.equal(coefM(25, 500), 1.5);
  assert.equal(coefM(40, 500), 1.1);
  assert.equal(coefM(40, 400), 0.8);
  assert.equal(coefM(60, 500), 1.0);
});

test('CE 49.5 / EHE-08 (viga): lb en posición I y II (Tablas 23 y 24 de la guía)', () => {
  const l = (fck, phi, adh) => anclaje({ ...base, norma: 'EHE-08', via: 'viga', fck, phi, adherencia: adh }).lb;
  cerca(l(25, 20, 'buena'), 600);
  cerca(l(30, 20, 'buena'), 520);
  cerca(l(40, 20, 'buena'), 500);
  cerca(l(25, 25, 'buena'), 938);
  cerca(l(25, 32, 'buena'), 1536);
  cerca(l(25, 20, 'deficiente'), 840);
  cerca(l(30, 8, 'deficiente'), 286);
});

test('CE 49.5 / EHE-08 (viga): lb,neta y solape (Tablas 30, 31, 32, 49 y 51 de la guía)', () => {
  const a = (fck, phi, adh, forma = 'recta', recPerp) => anclaje({ ...base, norma: 'EHE-08', via: 'viga', fck, phi, adherencia: adh, forma, recPerp }).lbd;
  cerca(a(30, 20, 'buena'), 520);
  cerca(a(30, 32, 'buena'), 1331);
  cerca(a(30, 25, 'deficiente'), 1138);
  cerca(a(30, 8, 'buena', 'patilla', 40), 150); // 0,7·200 = 140 < 150 mm
  cerca(a(30, 10, 'buena', 'patilla', 35), 175);
  cerca(a(30, 10, 'buena', 'patilla', 30), 250);
  const s = (fck, phi, adh, lejos) => solape({ ...base, norma: 'EHE-08', via: 'viga', fck, phi, adherencia: adh, pct: 100, lejos }).ls;
  cerca(s(30, 20, 'buena', true), 728);
  cerca(s(50, 20, 'buena', false), 1000);
  assert.equal(alfaSolapoEHE(33, false), 1.6);
  assert.equal(alfaSolapoEHE(40, true), 1.3);
  assert.equal(alfaSolapoEHE(75, false), 2.0);
});

test('EC-2 2023: Tabla 11.1 (buena, cd ≥ 1,5φ, σsd = 435) reproducida con (11.3)', () => {
  const l = (fck, phi, adh = 'buena') => anclaje({ ...base, norma: 'EC2-2023', fck, phi, adherencia: adh, forma: 'recta', cd: 1.5 * phi }).lbd / phi;
  cerca(l(25, 12), 42, 0.5);
  cerca(l(30, 12), 38, 0.5);
  cerca(l(20, 12), 47, 0.5);
  cerca(l(40, 16), 37, 0.5);
  cerca(l(30, 20), 46, 0.5);
  cerca(l(60, 32), 38, 0.5);
  cerca(l(30, 20, 'deficiente'), 46 * 1.2, 0.6);
});

test('EC-2 2023: solape = 1,2·lbd y no depende del % solapado', () => {
  const s = (pct) => solape({ ...base, norma: 'EC2-2023', fck: 40, phi: 20, adherencia: 'buena', cd: 30, pct }).ls;
  assert.equal(s(25), s(100));
  const a = anclaje({ ...base, norma: 'EC2-2023', fck: 40, phi: 20, adherencia: 'buena', cd: 30 }).lbd;
  cerca(s(100), 1.2 * a, 0.01);
});
