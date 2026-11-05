import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcula, fisurada, Mfis, propsHormigon, areaBarra, dimensiona, ES } from '../src/core/fisuracion.js';
import { wmaxDe } from '../src/norma/fisuracion/limites.js';

const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b) + 1e-12, `${msg ?? ''} ${a} ≠ ${b} (±${tol} rel)`);

// Caso de referencia: V-1 300×500, c = 30, 3Ø20 (una capa), sin armadura de compresión, HA-30, M = 80 kN·m, N = 0, larga duración.
// Los valores de referencia salen de un cálculo independiente en forma cerrada (x/d = −αρ + √((αρ)² + 2αρ); σs = M/(As·z), z = d − x/3),
// sin el resolvedor numérico del módulo, y de las fórmulas de los textos (EHE-08 49.2.4; EC-2 2004 7.3.4 y AN; EC-2 2023 9.2.3).
const SEC = { b: 300, h: 500, c: 30, fi: 20, n: 3 };
const O = { M: 80, N: 0, larga: true, fck: 30 };
const REF = {
  fctm: 2.896468, Ecm: 32836.568, fctfl: 3.186115, As: 942.4778, d: 460, x: 114.9178, Mfis: 39.82644, ss: 201.2896, ssr: 100.2081,
  EHE08: { hef: 190, sm: 142.4789, esm: 8.817315e-4, wk: 0.213568 },
  'EC2-2004': { hef: 100, rho: 0.0314159, sr: 210.2254, esm: 7.867698e-4, wk: 0.165399 },
  'EC2-2023': { hef: 140, rho: 0.0224399, sr: 125.2141, esm: 7.130118e-4, k1r: 1.115914, wk: 0.169367 },
};

test('propiedades del hormigón: fctm, Ecm, fctm,fl', () => {
  const p = propsHormigon(30, 500);
  rel(p.fctm, REF.fctm, 1e-6); rel(p.Ecm, REF.Ecm, 1e-6); rel(p.fctfl, REF.fctfl, 1e-6);
  // fctm,fl = máx{(1,6 − h/1000)·fctm; fctm}: con h ≥ 600 mm vale fctm
  rel(propsHormigon(30, 800).fctfl, p.fctm, 1e-12);
});

test('Mfis = W·fctm,fl y sube con la compresión (N > 0) y baja con la tracción', () => {
  rel(Mfis(SEC, 0, 30), REF.Mfis, 1e-6);
  const A = 300 * 500;
  rel(Mfis(SEC, 300, 30), Mfis(SEC, 0, 30) + (300 * 1e3 / A) * (300 * 500 ** 2 / 6) / 1e6, 1e-9);
  assert.ok(Mfis(SEC, -100, 30) < Mfis(SEC, 0, 30));
});

test('sección fisurada: coincide con la forma cerrada (flexión simple, sin A\'s)', () => {
  const As1 = 3 * areaBarra(20);
  rel(As1, REF.As, 1e-6);
  const F = fisurada({ b: 300, h: 500, As1, d: 460 }, 80, 0, 30);
  rel(F.x, REF.x, 1e-6, 'x'); rel(F.ss, REF.ss, 1e-6, 'σs');
  // equilibrio: F_c = F_s y M = F_s·(d − x/3)
  const Fc = (F.sc * 300 * F.x) / 2, Fs = F.ss * As1;
  rel(Fc, Fs, 1e-6, 'Fc = Fs'); rel(Fs * (460 - F.x / 3) / 1e6, 80, 1e-6, 'M');
  // ley de Navier: ε1/εc = (h − x)/x
  rel(F.e1 / F.ec, (500 - F.x) / F.x, 1e-9);
});

test('sección fisurada con axil: equilibrio de N y de M respecto al c.d.g. (con armadura superior)', () => {
  const sec = { b: 300, h: 500, As1: 3 * areaBarra(20), d: 460, As2: 2 * areaBarra(12), d2: 36 };
  for (const N of [200, -150]) {
    const F = fisurada(sec, 100, N, 30);
    assert.ok(F, `N = ${N}`);
    const Ec = propsHormigon(30, 500).Ecm, k = F.k, x = F.x;
    const Fc = Ec * 300 * x * x / 2 * k, F1 = -ES * sec.As1 * (460 - x) * k, F2 = ES * sec.As2 * (x - 36) * k;
    rel((Fc + F1 + F2) / 1e3, N, 1e-6, `N = ${N}`);
    const M = (Fc * (250 - x / 3) + F1 * (250 - 460) + F2 * (250 - 36)) / 1e6;
    rel(M, 100, 1e-6, `M con N = ${N}`);
  }
});

for (const norma of ['EHE08', 'EC2-2004', 'EC2-2023']) {
  test(`${norma}: caso de referencia (V-1, M = 80 kN·m)`, () => {
    const r = calcula(norma, SEC, O), q = REF[norma];
    rel(r.x, REF.x, 1e-6); rel(r.ss, REF.ss, 1e-6); rel(r.ssr, REF.ssr, 1e-5);
    rel(r.hef, q.hef, 1e-9); rel(r.esm, q.esm, 1e-5, 'εsm'); rel(r.sr, q.sr ?? q.sm, 1e-5, 'sr'); rel(r.wk, q.wk, 1e-5, 'wk');
    if (q.rho) rel(r.rho, q.rho, 1e-5);
    if (q.k1r) rel(r.k1r, q.k1r, 1e-5);
  });
}

test('M ≤ Mfis: sección sin fisurar, wk = 0, en las tres normas', () => {
  for (const n of ['EHE08', 'EC2-2004', 'EC2-2023']) {
    const r = calcula(n, SEC, { ...O, M: 30 });
    assert.equal(r.sinFisurar, true); assert.equal(r.wk, 0);
  }
});

test('wk crece con M (a partir de Mfis) en las tres normas', () => {
  for (const n of ['EHE08', 'EC2-2004', 'EC2-2023']) {
    let prev = 0;
    for (const M of [45, 60, 80, 100, 120, 140]) {
      const r = calcula(n, SEC, { ...O, M });
      assert.ok(r.wk > prev, `${n} M = ${M}: ${r.wk} ≤ ${prev}`);
      prev = r.wk;
    }
  }
});

test('carga de corta duración da wk ≤ wk de larga duración (k2, kt)', () => {
  for (const n of ['EHE08', 'EC2-2004', 'EC2-2023'])
    assert.ok(calcula(n, SEC, { ...O, larga: false }).wk <= calcula(n, SEC, O).wk + 1e-12, n);
});

test('EHE-08: β = 1,3 (acciones indirectas) frente a 1,7 (directas)', () => {
  rel(calcula('EHE08', SEC, { ...O, directa: false }).wk / calcula('EHE08', SEC, O).wk, 1.3 / 1.7, 1e-12);
});

test('EC-2 2023: mala adherencia (kb = 1,2) aumenta wk; k1/r > 1', () => {
  const buena = calcula('EC2-2023', SEC, O), mala = calcula('EC2-2023', SEC, { ...O, buenaAdh: false });
  assert.ok(mala.wk > buena.wk);
  assert.ok(buena.k1r > 1);
});

test('EC-2 2004: si la separación supera 5(c + φ/2) se usa sr,máx = 1,3(h − x) (7.14)', () => {
  const r = calcula('EC2-2004', { ...SEC, n: 2, fi: 12, b: 600 }, O);
  assert.ok(r.s > 5 * (30 + 6));
  rel(r.sr, 1.3 * (500 - r.x), 1e-12);
});

test('límites wmáx por clase de exposición', () => {
  assert.equal(wmaxDe('EHE08', 'I'), 0.4); assert.equal(wmaxDe('EHE08', 'IIa'), 0.3);
  assert.equal(wmaxDe('EHE08', 'IIIa'), 0.2); assert.equal(wmaxDe('EHE08', 'Qc'), 0.1);
  assert.equal(wmaxDe('EC2-2004', 'XC1'), 0.4); assert.equal(wmaxDe('EC2-2004', 'XC3'), 0.3);
  assert.equal(wmaxDe('EC2-2004', 'XD2'), 0.2); assert.equal(wmaxDe('EC2-2004', 'XA3'), 0.1);
  assert.equal(wmaxDe('EC2-2023', 'XC2'), 0.3);
  assert.equal(wmaxDe('EHE08', 'XC3'), null);
});

test('dimensionamiento: el n devuelto cumple y n − 1 no cumple (cuando n > 2)', () => {
  for (const norma of ['EHE08', 'EC2-2004', 'EC2-2023']) {
    for (const sol of dimensiona(norma, SEC, O, 0.3)) {
      if (sol.n === null) continue;
      assert.ok(sol.r.sinFisurar || sol.r.wk <= 0.3, `${norma} ø${sol.fi}`);
      if (sol.n > 2) {
        const r = calcula(norma, { ...SEC, fi: sol.fi, n: sol.n - 1 }, O);
        assert.ok(!r.sinFisurar && !(r.wk <= 0.3), `${norma} ø${sol.fi}: con ${sol.n - 1} también cumple`);
      }
    }
  }
});
