import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero } from '../src/core/materiales.js';
import { seccionRectangular } from '../src/core/flexion.js';
import { estadoUltimo } from '../src/core/seccion.js';
import { diagramaNM, comprobarNM, axilesLimite } from '../src/core/interaccion.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const H = hormigon({ fck: 25 });
const A = acero({ fyk: 500 });
const rect = (Ainf, Asup) => seccionRectangular({ b: 0.3, h: 0.5, rinf: 0.05, rsup: 0.05, Ainf, Asup, hormigon: H, acero: A });

test('N-M: compresión centrada = fcd·Ac + As·σs y tracción pura = −As·fyd', () => {
  const sec = rect(942e-6, 942e-6);
  const { Ncomp, Ntrac } = axilesLimite(sec);
  const fcd = 25000 / 1.5;
  cerca(Ncomp, 0.85 * fcd * 0.15 + 2 * 942e-6 * 400000, 1, "Ncomp"); // α = 0,85; σs = 400 MPa con εc2 = 2 ‰
  cerca(Ntrac, -2 * 942e-6 * (500000 / 1.15), 1e-6, 'Ntrac');
});

test('N-M: con armado simétrico el contorno es simétrico en M y pasa por el momento de flexión simple con N = 0', () => {
  const sec = rect(603e-6, 603e-6);
  const d = diagramaNM(sec, { n: 40 });
  assert.equal(d.pos.length, d.neg.length);
  d.pos.forEach((p, i) => cerca(p.M, -d.neg[i].M, 0.05, `simetría ${i}`));
  const M0 = comprobarNM(d, 0, 1).MRd;
  cerca(M0, estadoUltimo(sec, 0).M, 0.5, 'M(N=0)');
});

test('N-M: la rama M+ es continua y cada punto equilibra su axil', () => {
  const d = diagramaNM(rect(942e-6, 226e-6), { n: 40 });
  for (let i = 1; i < d.pos.length; i++) {
    assert.ok(d.pos[i].N < d.pos[i - 1].N, 'N decrece');
    assert.ok(Math.abs(d.pos[i].M - d.pos[i - 1].M) < 0.25 * Math.max(...d.pos.map((p) => Math.abs(p.M))), `salto en ${i}`);
  }
});

test('N-M: aprovechamiento = 1 sobre el contorno, < 1 dentro y > 1 fuera', () => {
  const d = diagramaNM(rect(942e-6, 942e-6), { n: 60 });
  const MR = comprobarNM(d, 1000, 1).MRd;
  cerca(comprobarNM(d, 1000, MR).ratio, 1, 1e-3, 'sobre el contorno');
  assert.ok(comprobarNM(d, 1000, 0.5 * MR).ratio < 0.7);
  assert.ok(comprobarNM(d, 1000, 1.2 * MR).ratio > 1);
  assert.equal(comprobarNM(d, 1e5, 1).dentro, false);
});

test('N-M: coeficiente de seguridad = 1/aprovechamiento y la armadura dimensionada lo deja en 1', async () => {
  const { coeficienteNM, dimensionarNM, escalarArmadura } = await import('../src/core/interaccion.js');
  const sec = rect(603e-6, 603e-6);
  const d = diagramaNM(sec, { n: 60 });
  const r = comprobarNM(d, 800, 120);
  cerca(coeficienteNM(d, 800, 120), 1 / r.ratio, 1e-9);
  assert.equal(coeficienteNM(d, 1e5, 10), 0);
  const pares = [[800, 200], [-100, 150]];
  const k = dimensionarNM(sec, pares, { gamma: 1 });
  assert.ok(k > 0 && Number.isFinite(k));
  const dk = diagramaNM(escalarArmadura(sec, k), { n: 60 });
  const g = Math.min(...pares.map(([N, M]) => coeficienteNM(dk, N, M)));
  cerca(g, 1, 0.01, 'γ mínimo con k');
  assert.equal(dimensionarNM(sec, [[0, 1e5]]), Infinity);
  assert.equal(dimensionarNM(sec, [[1000, 5]]), 0);
});
