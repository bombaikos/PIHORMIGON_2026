// Esquemas de armado de punzonamiento: en cruz (nº de perímetros y ramas por perímetro) y en retícula (ramas en x y en y).
// Los valores de «comprobar» son los del motor anterior al cambio de esquemas (20/10 y 28/10), que no deben moverse.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ramasReticula, rejillaPara, ramasDe, cercosCruz, cercosReticula, nBrazos, envolventeCruz, uExterior, perimetro } from '../src/norma/punzonamiento/comun.js';
import { nucleo } from '../src/norma/punzonamiento/index.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const base = { fck: 30, fykCercos: 500, rhoX: 0.008, rhoY: 0.008, sigCd: 0, d: 210, c1: 300, c2: 300, D: 350, Dlower: 20, VEd: 400 };
const POS = ['interior', 'borde', 'esquina'];
const BETA = { interior: 1.15, borde: 1.4, esquina: 1.5 };
const arm = (esq, ramas, extra = {}) => ({ fi: 10, ramas, sr: 150, a1: 100, nPer: 3, esq, ...extra });

test('comprobar no cambia con el esquema nuevo (valores de antes del cambio)', () => {
  const oro = [
    ['EHE-08', 'interior', { Vu: 1014.664, Vcs: 1088.337 }, { Vu: 1014.664, Vcs: 1317.81 }],
    ['EC2-2004', 'interior', { Vu: 882.317, Vcs: 920.535 }, { Vu: 882.317, Vcs: 1094.074 }],
    ['EC2-2004', 'borde', { Vu: 396.609, Vcs: 617.573 }, { Vu: 396.609, Vcs: 760.123 }],
    ['EC2-2023', 'interior', { Vu: 433.402 }, { Vu: 433.402 }],
  ];
  for (const [norma, pos, r12, r16] of oro) {
    const N = nucleo(norma);
    for (const [ramas, esperado] of [[12, r12], [16, r16]]) {
      const r = N.comprobar({ ...base, tipo: 'rect', pos, beta: BETA[pos], arm: arm('ret', ramas) });
      cerca(r.Vu, esperado.Vu, 0.01, `${norma} ${pos} ${ramas} Vu`);
      if (esperado.Vcs) cerca(r.Vcs, esperado.Vcs, 0.01, `${norma} ${pos} ${ramas} Vcs`);
    }
  }
});

test('ramas de la retícula: 2nx+2ny−4 (interior), nx+2ny−2 (borde), nx+ny−1 (esquina)', () => {
  assert.equal(ramasReticula('interior', 4, 5), 14);
  assert.equal(ramasReticula('borde', 4, 5), 12);
  assert.equal(ramasReticula('esquina', 4, 5), 8);
  for (const pos of POS) for (const tipo of ['rect', 'circ']) {
    for (const [nx, ny] of [[2, 2], [3, 5], [6, 4]]) {
      const pts = cercosReticula({ ...base, tipo, pos }, 250, nx, ny);
      assert.equal(pts.length, ramasReticula(pos, nx, ny), `${tipo} ${pos} ${nx}×${ny}`);
    }
  }
});

test('retícula: las ramas quedan en el contorno rectangular y dentro de la losa', () => {
  for (const pos of POS) {
    const x = { ...base, tipo: 'rect', pos };
    for (const [px, py] of cercosReticula(x, 200, 5, 4)) {
      if (pos !== 'interior') assert.ok(py > 0, `${pos} y=${py}`);
      if (pos === 'esquina') assert.ok(px > 0, `${pos} x=${px}`);
    }
  }
});

test('cruz: n ramas por perímetro repartidas entre los brazos (4, 3 y 2)', () => {
  assert.deepEqual(POS.map(nBrazos), [4, 3, 2]);
  for (const pos of POS) for (const n of [nBrazos(pos), 7, 12]) {
    const pts = cercosCruz({ ...base, tipo: 'rect', pos }, [100, 250], n, 150);
    assert.equal(pts.length, 2 * n, `${pos} n=${n}`);
  }
});

test('rejillaPara da la retícula más pequeña con al menos n ramas', () => {
  for (const pos of POS) for (const n of [4, 9, 14, 21]) {
    const g = rejillaPara(pos, n);
    assert.ok(g.ramas >= n && g.ramas === ramasReticula(pos, g.nx, g.ny));
    for (let nx = 2; nx <= g.nx; nx++) for (let ny = 2; ny <= g.ny; ny++) {
      const t = ramasReticula(pos, nx, ny);
      assert.ok(t < n || t >= g.ramas, `${pos} n=${n}: ${nx}×${ny} da ${t} < ${g.ramas}`);
    }
  }
  assert.deepEqual(ramasDe({ esq: 'cruz' }, 'interior', 2), { ramas: 4 });
  assert.equal(ramasDe({ esq: 'cruz' }, 'esquina', 7).ramas, 7);
});

test('perímetro exterior: la retícula lo toma a kd del último; la cruz, la envolvente de círculos', () => {
  const x = { ...base, tipo: 'rect', pos: 'interior' };
  const kd = 2 * x.d;
  cerca(uExterior(x, { esq: 'ret', ramas: 12 }, 400, kd), perimetro(x, 400 + kd), 1e-6);
  // Cruz de 4 brazos con una rama por brazo: 4 lóbulos de radio kd unidos por tangentes (2π·kd + 4·√2·L en el interior)
  const L = 400 + 150; // centro de la última rama al eje
  const env = envolventeCruz(x, 400, kd, 4, 150).long;
  cerca(env, 2 * Math.PI * kd + 4 * Math.SQRT2 * (L), env * 0.01);
  // La envolvente de la cruz es menor que el contorno a kd de una retícula con las mismas distancias (no cubre las esquinas)
  assert.ok(env < perimetro(x, 400 + kd) + 1);
});

test('dimensionar con cruz: ramas ≥ brazos y la tabla cumple al comprobar, en las tres normas y los seis tipos', () => {
  for (const norma of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const N = nucleo(norma);
    for (const tipo of ['rect', 'circ']) for (const pos of POS) {
      const x = { ...base, tipo, pos, beta: BETA[pos], VEd: 700, arm: arm('cruz', 12) };
      const r = N.dimensionar(x, 700, { diametros: [8, 10, 12, 16] });
      if (r.caso !== 'calculo') continue;
      for (const f of r.tabla) {
        assert.ok(f.ramas >= nBrazos(pos), `${norma} ${tipo} ${pos} ø${f.fi} ramas ${f.ramas}`);
        const c = N.comprobar({ ...x, arm: arm('cruz', f.ramas, { fi: f.fi, nPer: f.nPer }) });
        assert.ok(c.Vu >= 700 - 1e-6, `${norma} ${tipo} ${pos} ø${f.fi}: Vu ${c.Vu} < 700`);
      }
    }
  }
});

test('dimensionar con retícula: ramas = 2nx+2ny−4…, y la tabla cumple al comprobar', () => {
  for (const norma of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const N = nucleo(norma);
    for (const tipo of ['rect', 'circ']) for (const pos of POS) {
      const x = { ...base, tipo, pos, beta: BETA[pos], VEd: 700, arm: arm('ret', 12) };
      const r = N.dimensionar(x, 700, { diametros: [8, 10, 12, 16] });
      if (r.caso !== 'calculo') continue;
      for (const f of r.tabla) {
        assert.equal(f.ramas, ramasReticula(pos, f.nx, f.ny), `${norma} ${tipo} ${pos} ø${f.fi}`);
        const c = N.comprobar({ ...x, arm: arm('ret', f.ramas, { fi: f.fi, nPer: f.nPer }) });
        assert.ok(c.Vu >= 700 - 1e-6, `${norma} ${tipo} ${pos} ø${f.fi}: Vu ${c.Vu} < 700`);
      }
    }
  }
});
