// Flexión simple en vigas rectangulares y en T, con momento positivo y negativo,
// clase de rotura según x/d y curva MRd–As1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proyectoNuevo, datosViga } from '../src/io/proyecto.js';
import { comprobar, dimensionar, clasificarRotura, curvaDiseno } from '../src/core/flexion.js';

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

test('Diagrama de dimensionamiento: M crece con A_s1, A_s2 nula hasta A_lim y la curva reproduce dimensionar', () => {
  const p = proyectoNuevo();
  const d = datosViga(p, viga(p, 'ejemplo_1'), 1);
  const c = curvaDiseno(d);
  assert.ok(c.as1.length > 40);
  cerca(c.as1[0][0], c.Amin, 1e-12);
  c.as1.forEach(([A, M], i) => {
    if (i) assert.ok(M >= c.as1[i - 1][1] - 1e-6, 'creciente');
    if (A <= c.Alim) assert.equal(c.as2[i][0], 0);
    else cerca(c.as2[i][0], A - c.Alim, 1e-12);
  });
  // A mitad de camino, dimensionar con ese M da la armadura de la curva
  const [A, M] = c.as1[Math.floor(c.as1.length / 2)];
  const r = dimensionar(d, M);
  cerca(r.Ainf, A, 2e-3);
  cerca(r.Asup, c.as2[Math.floor(c.as2.length / 2)][0], 2e-3);
});

test('Dimensionar con xdMax: con compresión la fibra neutra queda en el límite de rotura media', () => {
  for (const nombre of ['ejemplo_1', 'ejemplo_3']) for (const signo of [1, -1]) {
    const p = proyectoNuevo();
    const d = datosViga(p, viga(p, nombre), signo);
    const xdMax = clasificarRotura(d, 0).umbralMedia;
    const r = dimensionar(d, 600, { xdMax });
    if (r.caso !== 'doble') continue;
    const rot = clasificarRotura(d, r.x);
    assert.ok(rot.xd <= xdMax + 1e-3, `x/d = ${rot.xd}`);
    assert.notEqual(rot.clase, 'fragil');
    cerca(r.Mu, 600, 1e-3);
  }
});

test('Coherencia de cuantías: dimensionar y diagrama respetan A_s,min de tracción y los máximos de cada cara en las tres normas', () => {
  for (const norma of ['EHE-08', 'EC2-2004', 'EC2-2023']) for (const nombre of ['ejemplo_1', 'ejemplo_3']) for (const signo of [1, -1]) {
    const p = proyectoNuevo();
    p.norma = norma;
    const d = datosViga(p, viga(p, nombre), signo);
    const U = clasificarRotura(d, 0);
    for (const xdMax of [U.umbralDuctil, U.umbralMedia, U.xdLim]) {
      const c = curvaDiseno(d, { xdMax });
      const k = c.Amin;
      const eps = 1e-9;
      assert.ok(c.as1[0][0] >= k - eps, 'el diagrama parte de A_s,min');
      for (const [A] of c.as1) assert.ok(A <= c.Amax + eps, `${norma} A_s1 ≤ Amax`);
      for (const [A] of c.as2) assert.ok(A <= c.Amax2 + eps, `${norma} A_s2 ≤ Amax2`);
      for (const Md of [30, 150, 400, 900]) {
        const r = dimensionar(d, Md, { xdMax });
        if (r.caso === 'escuadria') continue;
        assert.ok(r.Ainf >= k - 1e-7, `${norma} ${nombre} ${Md}: A_s1 ≥ A_s,min`);
        assert.ok(r.Ainf <= r.cuantias.Amax + 1e-7, `${norma} A_s1 ≤ Amax`);
        assert.ok(r.Asup <= r.cuantias.Amax2 + 1e-7, `${norma} A_s2 ≤ Amax2`);
      }
    }
  }
  // EC-2 2023 adopta el máximo 0,04·Ac del EC-2 2004 + AN
  const p = proyectoNuevo();
  p.norma = 'EC2-2023';
  const d = datosViga(p, viga(p, 'ejemplo_1'), 1);
  cerca(curvaDiseno(d).Amax, 0.04 * d.Ac, 1e-12);
});
