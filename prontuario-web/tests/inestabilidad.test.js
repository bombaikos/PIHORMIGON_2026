import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularInestabilidad, alfaEHE, longitudEficaz, excentricidadMinima, coeficienteC } from '../src/norma/inestabilidad.js';
import { psiExtremo, flexibilidad, armaduraEnPlano } from '../src/core/pandeo.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);

test('α de EHE-08 43.1.1: casos clásicos y valores de los nomogramas', () => {
  cerca(alfaEHE(0, 0, false), 0.5, 1e-9, 'biempotrado');
  cerca(alfaEHE(Infinity, Infinity, false), 1, 1e-6, 'biarticulado');
  cerca(alfaEHE(0, Infinity, false), 0.7, 0.01, 'empotrado-articulado');
  cerca(alfaEHE(0, 0, true), 1, 1e-9, 'traslacional empotrado');
  cerca(alfaEHE(0, Infinity, true), 2, 0.01, 'ménsula');
  cerca(alfaEHE(1, 1, false), 0.778, 0.005, 'Ψ = 1 intraslacional');
  cerca(alfaEHE(1, 1, true), 1.34, 0.01, 'Ψ = 1 traslacional');
});

test('Longitud eficaz de EC-2 5.8.3.2: coincide con α de EHE-08 con k = Ψ/2 (arriostrado) y Ψ/6 (traslacional)', () => {
  const L = 3;
  for (const psi of [0.3, 1, 3]) {
    const kb = flexibilidad(psi, false);
    cerca(longitudEficaz(L, kb, kb, false) / L, alfaEHE(psi, psi, false), 0.06, `arriostrado Ψ=${psi}`);
    const kt = flexibilidad(psi, true);
    cerca(longitudEficaz(L, kt, kt, true) / L, alfaEHE(psi, psi, true), 0.12, `traslacional Ψ=${psi}`);
  }
  cerca(longitudEficaz(L, Infinity, Infinity, false), L, 1e-9, 'biarticulado');
  cerca(longitudEficaz(L, 0.1, 0.1, false), 0.5 * L * (1 + 0.1 / 0.55), 1e-9, 'k mínimo 0,1');
  cerca(longitudEficaz(L, 0.1, Infinity, true) / L, 2.18, 0.01, 'ménsula');
});

test('Ψ: 0,70 de la rigidez bruta de los soportes y 0,30 de las vigas; voladizos y vigas sin luz no aportan', () => {
  const Ic = (0.3 * 0.3 ** 3) / 12;
  const L = 3;
  const viga = { b: 0.3, h: 0.5, L: 6 };
  const sin = psiExtremo({ tipo: 'nudo', vigas: [viga] }, { Ic, L, fp: 0.7, fv: 0.3 });
  const kc = (0.7 * Ic) / L;
  const kv = (0.3 * (0.3 * 0.5 ** 3) / 12) / 6;
  cerca(sin, kc / kv, 1e-9);
  const dos = psiExtremo({ tipo: 'nudo', vigas: [viga, viga] }, { Ic, L, fp: 0.7, fv: 0.3 });
  cerca(dos, kc / (2 * kv), 1e-9);
  assert.equal(psiExtremo({ tipo: 'nudo', vigas: [{ ...viga, L: 0 }] }, { Ic, L, fp: 0.7, fv: 0.3 }), Infinity);
  assert.equal(psiExtremo({ tipo: 'empotrado' }, { Ic, L, fp: 0.7, fv: 0.3 }), 0);
  assert.equal(psiExtremo({ tipo: 'articulado' }, { Ic, L, fp: 0.7, fv: 0.3 }), Infinity);
  const conPilar = psiExtremo({ tipo: 'nudo', vigas: [viga], pilar: { b: 0.3, h: 0.3, L: 3 } }, { Ic, L, fp: 0.7, fv: 0.3 });
  cerca(conPilar, (2 * kc) / kv, 1e-9, 'suma el soporte contiguo');
});

test('Armadura en el plano: i_s y β para armadura en dos caras', () => {
  const r = armaduraEnPlano([{ y: 0.04, A: 1e-3 }, { y: 0.36, A: 1e-3 }], 0.4);
  cerca(r.is, 0.16, 1e-9);
  cerca(r.dd, 0.32, 1e-9);
  cerca(r.dd ** 2 / (4 * r.is ** 2), 1, 1e-9, 'β = 1');
  assert.equal(coeficienteC(1), 0.24);
  assert.equal(coeficienteC(1.5), 0.2);
  assert.equal(coeficienteC(3), 0.16);
});

// Pilar 300 × 400 (h = 0,40 en el plano), 4 ø20 en dos caras (As = 1257 mm²), HA-30/B500S
const base = (o = {}) => ({
  norma: 'EC2-2004', L: 8, traslacional: false, psiA: Infinity, psiB: Infinity,
  h: 0.4, A: 0.12, I: (0.3 * 0.4 ** 3) / 12, As: 1.257e-3, is: 0.16, dd: 0.32, forma: 'pilar',
  fck: 30, fcd: 20000, fyd: 434780, Es: 2e8, N: 800, M1: 0, M2: 40, phiInf: 2, pPerm: 0.6, ...o,
});

test('Momentos extremos: se ordenan y suben a N·e_mín', () => {
  const r = calcularInestabilidad(base({ N: 800, M1: 5, M2: -60 }));
  assert.equal(r.M02, -60);
  cerca(r.M01, 800 * 0.02 * 1, 1e-9, 'M1 sube a N·20 mm (h/30 = 13 mm < 20 mm)');
  assert.equal(r.subeMin, true);
  cerca(excentricidadMinima('EHE-08', 0.6), 0.03, 1e-12);
  cerca(excentricidadMinima('EC2-2004', 0.6), 0.02, 1e-12);
  cerca(excentricidadMinima('EC2-2004', 0.9), 0.03, 1e-12);
});

test('EC-2 2004: curvatura nominal con los valores de la norma', () => {
  const r = calcularInestabilidad(base());
  // M1 sube a N·0,02 = 16; M02 = 40; biarticulado: l0 = L
  const l0 = 8;
  cerca(r.l0, l0, 1e-9);
  const i = Math.sqrt(r.l0 ? ((0.3 * 0.4 ** 3) / 12) / 0.12 : 1);
  cerca(r.lambda, l0 / i, 1e-9);
  const n = 800 / (0.12 * 20000);
  const omega = (1.257e-3 * 434780) / (0.12 * 20000);
  cerca(r.n, n, 1e-12);
  cerca(r.omega, omega, 1e-12);
  assert.equal(r.lambda > r.lamLim, true, 'esbelto');
  const d = 0.2 + 0.16;
  const r0 = (434780 / 2e8) / (0.45 * d);
  const Kr = Math.min((1 + omega - n) / (1 + omega - 0.4), 1);
  cerca(r.r0, r0, 1e-12);
  cerca(r.Kr, Kr, 1e-12);
  const phiEf = r.fluenciaIgnorable ? 0 : 2 * 0.6;
  cerca(r.phiEf, phiEf, 1e-12);
  const Kphi = Math.max(1 + (0.35 + 30 / 200 - r.lambda / 150) * phiEf, 1);
  cerca(r.Kphi, Kphi, 1e-12);
  const e2 = (Kr * Kphi * r0 * l0 ** 2) / 10;
  cerca(r.e2, e2, 1e-12);
  const M0e = Math.max(0.6 * 40 + 0.4 * 16, 0.4 * 40);
  cerca(r.MEd, Math.max(M0e + 800 * e2, 40), 1e-9);
});

test('Soporte corto: sin segundo orden, MEd = máx(M02, N·e_mín)', () => {
  const r = calcularInestabilidad(base({ L: 2, M2: 10 }));
  assert.equal(r.segundoOrden, false);
  cerca(r.MEd, Math.max(10, 800 * 0.02), 1e-9);
});

test('Fluencia: se ignora cuando φ∞ ≤ 2, λ ≤ 75 y M0/N ≤ h; si no, φef = φ∞·proporción permanente', () => {
  const a = calcularInestabilidad(base());
  assert.equal(a.fluenciaIgnorable, true);
  const b = calcularInestabilidad(base({ phiInf: 3 }));
  assert.equal(b.fluenciaIgnorable, false);
  cerca(b.phiEf, 3 * 0.6, 1e-12);
  const c = calcularInestabilidad(base({ phiInf: 3, pPerm: 0 }));
  assert.equal(c.phiEf, 0);
  assert.ok(b.MEd >= c.MEd, 'más fluencia, más momento');
});

test('EHE-08: excentricidad ficticia de 43.5.1', () => {
  const r = calcularInestabilidad(base({ norma: 'EHE-08', L: 8, M1: 20, M2: 40, N: 600 }));
  assert.equal(r.metodo, 'aproximado');
  cerca(r.alfa, 1, 1e-6);
  const i = Math.sqrt(((0.3 * 0.4 ** 3) / 12) / 0.12);
  cerca(r.lambda, 8 / i, 1e-6);
  const ee = Math.max(0.6 * (40 / 600) + 0.4 * (20 / 600), 0.4 * (40 / 600));
  cerca(r.ee, ee, 1e-12);
  const epsY = 434780 / 2e8;
  const ea = (1 + 0.12 * 1) * (epsY + 0.0035) * ((0.4 + 20 * ee) / (0.4 + 10 * ee)) * (8 ** 2 / (50 * i));
  cerca(r.ea, ea, 1e-7);
  cerca(r.MEd, 600 * (ee + ea), 1e-4);
});

test('EHE-08: más de 100 pide el método general y más de 200 queda fuera', () => {
  const g = calcularInestabilidad(base({ norma: 'EHE-08', L: 12 }));
  assert.equal(g.metodo, 'general');
  assert.ok(g.avisos.some((a) => a.clave === 'ine.av.general'));
  const f = calcularInestabilidad(base({ norma: 'EHE-08', L: 25 }));
  assert.equal(f.metodo, 'fuera');
});

test('EC-2 2023: λlim de O.12 y curvatura nominal de O.19', () => {
  const r = calcularInestabilidad(base({ norma: 'EC2-2023', L: 8, phiInf: 3 }));
  const n = 800 / (0.12 * 20000);
  const omega = (1.257e-3 * 434780) / (0.12 * 20000);
  const lim = (20 * (1 / (1 + 0.2 * r.phiEf)) * Math.sqrt(1 + 2 * omega) * (1.7 - r.M01 / r.M02)) / Math.sqrt(n);
  cerca(r.lamLim, lim, 1e-9);
  assert.equal(r.metodo, 'curvatura');
  cerca(r.c, 8, 0, 'arriostrado: c = 8');
  cerca(r.r0, (2 * (434780 / 2e8)) / (0.2 + 0.16), 1e-12, 'O.19-O.20 rectangular');
  assert.ok(r.MEd >= Math.abs(r.M02));
});

test('Axil de tracción: no se aplica', () => {
  assert.equal(calcularInestabilidad(base({ N: -10 })).valido, false);
});

test('Más esbeltez, más momento de cálculo', () => {
  const a = calcularInestabilidad(base({ L: 8 })).MEd;
  const b = calcularInestabilidad(base({ L: 11 })).MEd;
  assert.ok(b > a);
});

test('Contorno reducido: M0eq + ΔM = M_Ed y sin segundo orden no hay reducción', async () => {
  const { contornoReducido } = await import('../src/norma/inestabilidad.js');
  const e = base();
  const r = calcularInestabilidad(e);
  assert.ok(r.M0eq > 0 && r.M0eq <= r.MEd);
  const [p] = contornoReducido(e, [{ N: 800, M: 200 }]);
  cerca(p.M, 200 - (r.MEd - r.M0eq), 1e-9);
  const [q] = contornoReducido({ ...e, L: 2 }, [{ N: 800, M: 200 }]);
  assert.equal(q.dM, 0);
  const [t] = contornoReducido(e, [{ N: -50, M: 100 }]);
  assert.equal(t.M, 100);
  assert.equal(t.ok, false);
});
