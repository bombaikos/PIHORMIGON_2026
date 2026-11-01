import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo, areaRama, Tu1, geometria, parametros } from '../src/norma/torsion/index.js';

const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
// Viga 300 × 500, c = 40 mm, HA-30, B 500 S, cercos ø10 a 150, Al = 1 256 mm² (8ø14), cotθ = 1
const base = { fck: 30, fykCercos: 500, fykLong: 500, b: 300, h: 500, c: 40, cotTheta: 1, AtS: areaRama(10) / 150, s: 150, Al: 8 * areaRama(14), TEd: 40 };

test('Geometría: he = A/u = 93,75 mm; Ae y ue de la línea media', () => {
  const G = geometria('EHE-08', base);
  cerca(G.he, 93.75, 1e-9);
  cerca(G.Ae, (300 - 93.75) * (500 - 93.75), 1e-6);
  cerca(G.ue, 2 * (206.25 + 406.25), 1e-9);
});

test('he nunca baja de 2c', () => {
  const G = geometria('EHE-08', { ...base, c: 60 });
  cerca(G.he, 120, 1e-9);
  assert.equal(G.heTopado, true);
});

test('EHE-08 a mano: Tu1 = 2·0,6·(0,6·20)·Ae·he/2 (cotθ = 1) = 0,6·12·Ae·he/1e6', () => {
  const r = nucleo('EHE-08').comprobar(base);
  const G = r.G;
  cerca(r.Tu1, (0.6 * 12 * G.Ae * G.he) / 1e6, 1e-6);
  // Tu2 = 2·Ae·At/s·fyt,d·cotθ con fyt,d topado a 400 MPa
  cerca(r.Tu2, (2 * G.Ae * (areaRama(10) / 150) * 400) / 1e6, 1e-6);
  // Tu3 = 2·Ae·Al·fyl,d·tanθ/ue con fyl,d = 500/1,15
  cerca(r.Tu3, (2 * G.Ae * base.Al * (500 / 1.15)) / G.ue / 1e6, 1e-6);
  assert.equal(r.P.topada, true);
});

test('EC-2 2004 + AN: Tmáx = 2·ν·fcd·Ak·tef·senθ·cosθ con ν = 0,6(1 − fck/250)', () => {
  const r = nucleo('EC2-2004').comprobar(base);
  const nu = 0.6 * (1 - 30 / 250);
  cerca(r.Tu1, (2 * nu * 20 * r.G.Ae * r.G.he * 0.5) / 1e6, 1e-6);
  // sin tope de 400 MPa
  cerca(r.Tu2, (2 * r.G.Ae * (areaRama(10) / 150) * (500 / 1.15)) / 1e6, 1e-6);
});

test('EC-2 2023: ν = 0,60 con cotθ = 1 y 0,50 con otro ángulo; fcd con ηcc·ktc', () => {
  const n = nucleo('EC2-2023');
  const a = n.comprobar(base);
  assert.equal(a.nu, 0.6);
  assert.equal(n.comprobar({ ...base, cotTheta: 2 }).nu, 0.5);
  const fcd = Math.min(1, Math.cbrt(40 / 30)) * 0.85 * 30 / 1.5;
  cerca(a.P.fcd, fcd, 1e-9);
  assert.equal(n.rangoCot().max, 2.5);
});

test('EC-2 2023: recubrimiento reducido a 0,07·b_mín si b_máx/b_mín < 1,5', () => {
  const G = geometria('EC2-2023', { ...base, b: 300, h: 400, c: 40 });
  assert.equal(G.cRed, true);
  cerca(G.cEf, 21, 1e-9);
  assert.equal(geometria('EHE-08', { ...base, b: 300, h: 400, c: 40 }).cRed, false);
});

test('Dimensionar es la inversa de comprobar: con At/s y Al necesarias, Tu2 = Tu3 = Td', () => {
  for (const id of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const n = nucleo(id);
    const d = n.dimensionar({ ...base, cotTheta: 1.5 }, 40);
    assert.equal(d.caso, 'ok');
    const c = n.comprobar({ ...base, cotTheta: 1.5, AtS: d.AtS, Al: d.Al });
    cerca(c.Tu2, 40, 1e-6);
    cerca(c.Tu3, 40, 1e-6);
    cerca(d.reparto.sup * 2 + d.reparto.lat * 2, d.Al, 1e-6);
  }
});

test('Dimensionar: torsor mayor que Tu1 → aumentar la sección', () => {
  const d = nucleo('EHE-08').dimensionar(base, 1e4);
  assert.equal(d.caso, 'biela');
});

test('Tabla de dimensionado: la separación respeta u_e/8 y la fila cumple Td', () => {
  const d = nucleo('EC2-2004').dimensionar(base, 40, { diametros: [8, 10, 12] });
  for (const f of d.tabla) if (f.s) { assert.ok(f.s <= d.sep.sMax + 1e-9); assert.ok(f.Tu2 >= 40 - 1e-6); }
});

test('Separación EHE-08: tres tramos según Td/Tu1', () => {
  const n = nucleo('EHE-08');
  const r = n.comprobar({ ...base, TEd: 5 });
  assert.equal(r.sep.tramo, 1);
  assert.equal(n.comprobar({ ...base, TEd: r.Tu1 * 0.4 }).sep.tramo, 2);
  assert.equal(n.comprobar({ ...base, TEd: r.Tu1 * 0.9 }).sep.tramo, 3);
});
