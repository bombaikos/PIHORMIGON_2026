// Flexión simple en vigas rectangulares y en T, con momento positivo y negativo,
// clase de rotura según x/d y curva MRd–As1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proyectoNuevo, datosViga } from '../src/io/proyecto.js';
import { comprobar, dimensionar, clasificarRotura, curvaMRd } from '../src/core/flexion.js';

const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} no está a ${tol} de ${b}`);
const viga = (p, nombre) => p.secciones.find((s) => s.nombre === nombre);

test('T con momento positivo: MRd cercano al bloque rectangular del ala (a < hf)', () => {
  const p = proyectoNuevo();
  const s = structuredClone(viga(p, 'ejemplo_3'));
  s.armado = s.armado.filter((g) => g.cara === 'inf');
  const d = datosViga(p, s, 1);
  const r = comprobar(d);
  const fyd = d.acero.fk / d.acero.gamma;
  const dd = d.h - d.rinf;
  const a = (d.Ainf * fyd) / ((d.hormigon.fk / d.hormigon.gamma) * 1);
  assert.ok(r.x < s.geo.hf, 'la fibra neutra queda en el ala');
  cerca(r.Mu, d.Ainf * fyd * (dd - a / 2), 0.04);
});

test('T con momento negativo: la cabeza traccionada no cuenta, como un rectángulo de ancho bw', () => {
  const p = proyectoNuevo();
  const t = structuredClone(viga(p, 'ejemplo_3'));
  const rec = { ...structuredClone(viga(p, 'ejemplo_1')), geo: { b: t.geo.bw, h: t.geo.h }, armado: structuredClone(t.armado) };
  const dT = datosViga(p, t, -1);
  const dR = datosViga(p, rec, -1);
  cerca(comprobar(dT).Mu, comprobar(dR).Mu, 1e-6);
  cerca(dT.b, t.geo.b, 1e-9); // b = ancho de la zona traccionada (la cabeza)
});

test('Momento negativo de una viga = positivo de la misma con las caras intercambiadas', () => {
  const p = proyectoNuevo();
  const s = viga(p, 'ejemplo_1');
  const g = structuredClone(s);
  g.armado = g.armado.map((a) => ({ ...a, cara: a.cara === 'inf' ? 'sup' : 'inf' }));
  cerca(comprobar(datosViga(p, s, -1)).Mu, comprobar(datosViga(p, g, 1)).Mu, 1e-9);
  // y la armadura traccionada es la de la cara superior
  const d = datosViga(p, s, -1);
  cerca(d.Ainf, datosViga(p, s, 1).Asup, 1e-12);
});

test('Dimensionar a momento negativo en T: devuelve armadura que resiste MEd', () => {
  const p = proyectoNuevo();
  const d = datosViga(p, viga(p, 'ejemplo_3'), -1);
  const r = dimensionar(d, 150);
  assert.ok(['simple', 'minima'].includes(r.caso));
  const c = comprobar({ ...d, Ainf: r.Ainf, Asup: r.Asup });
  cerca(c.Mu, Math.max(150, c.Mu), 1e-3);
  assert.ok(c.Mu >= 150 * 0.999);
});

test('Clase de rotura con el criterio del EC-2 5.5(4) en las tres normas (εcu2 = 3,5 ‰)', () => {
  for (const norma of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const p = proyectoNuevo();
    p.norma = norma;
    const d = datosViga(p, viga(p, 'ejemplo_1'), 1);
    const dd = d.h - d.rinf;
    const c = (xd) => clasificarRotura(d, xd * dd);
    cerca(c(0.1).umbralDuctil, 0.288, 1e-9);
    cerca(c(0.1).umbralMedia, 0.448, 1e-9);
    assert.equal(c(0.28).clase, 'ductil');
    assert.equal(c(0.30).clase, 'media');
    assert.equal(c(0.44).clase, 'media');
    assert.equal(c(0.46).clase, 'fragil');
    cerca(c(0.2).redMax, 1 - (0.44 + 1.25 * 0.2), 1e-9);
  }
});

test('Curva MRd–As1: con compresión nunca queda por debajo y coincide hasta Alim', () => {
  const p = proyectoNuevo();
  const d = datosViga(p, viga(p, 'ejemplo_1'), 1);
  const c = curvaMRd(d);
  assert.equal(c.simple.length, c.doble.length);
  c.simple.forEach(([A, M], i) => {
    assert.ok(c.doble[i][1] >= M - 1e-6);
    if (A <= c.Alim) cerca(c.doble[i][1], M, 1e-9);
    if (i) assert.ok(M >= c.simple[i - 1][1] - 1e-6, 'creciente');
  });
  assert.ok(c.doble.at(-1)[1] > c.simple.at(-1)[1]);
});
