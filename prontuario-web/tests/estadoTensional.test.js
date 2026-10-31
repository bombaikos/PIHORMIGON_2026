import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero } from '../src/core/materiales.js';
import { modeloTensional, estadoTensional, esfuerzosDe, planoDeSup, leyServicio } from '../src/core/estadoTensional.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const rel = (a, b, tol, msg) => cerca(a, b, tol * Math.abs(b) + 1e-9, msg);
const H = hormigon({ fck: 25, norma: 'EC2-2004', diag: 'EC2' });
const A = acero({ fyk: 500, norma: 'EC2-2004' });
const FCTM = 2.56;
const As20 = (Math.PI * 0.02 ** 2) / 4;
const rect = (barras, b = 0.4, h = 0.6) => ({
  contornos: [{ pts: [[0, 0], [b, 0], [b, h], [0, h]], signo: 1 }],
  caja: { xmin: 0, xmax: b, ymin: 0, ymax: h }, h,
  barras: barras.map(([x, y, a = As20]) => ({ x, y, A: a })), franjas: [],
});
const o1 = { gammaC: 1, alfaCC: 1, fctm: FCTM };
const lin = { ...o1, lineal: true };
// Pilar con 8 barras
const pilar = rect([[0.05, 0.05], [0.2, 0.05], [0.35, 0.05], [0.05, 0.3], [0.35, 0.3], [0.05, 0.55], [0.2, 0.55], [0.35, 0.55]]);
// Viga con armadura solo abajo (y hacia abajo: cara inferior y = h)
const AS = 4 * As20;
const viga = rect([[0.08, 0.55], [0.16, 0.55], [0.24, 0.55], [0.32, 0.55]]);

test('ley lineal, sin armadura: σ = N/A ± M/W (sección íntegra)', () => {
  const sec = rect([]);
  const mod = modeloTensional(sec, H, A, lin);
  const N = 600;
  const Mx = 90; // comprime la cara superior
  const r = estadoTensional(mod, { tipo: 'NM', N, Mx, My: 0 });
  assert.ok(r.ok);
  assert.equal(r.fisurada, false);
  const Ac = 0.24;
  const W = (0.4 * 0.6 ** 2) / 6;
  rel(r.sigmaMax, (N / Ac + Mx / W) / 1000, 1e-6, 'σ máx');
  rel(r.sigmaMin, (N / Ac - Mx / W) / 1000, 1e-6, 'σ mín');
  cerca(r.Mx, Mx, 1e-5);
  cerca(r.My, 0, 1e-5);
});

test('ley lineal, viga fisurada con As inferior: x, σc y σs de la sección clásica', () => {
  const mod = modeloTensional(viga, H, A, lin);
  const M = 120;
  const r = estadoTensional(mod, { tipo: 'NM', N: 0, Mx: M, My: 0 });
  assert.ok(r.ok);
  assert.equal(r.fisurada, true);
  const n = 200000 / (H.E / 1000);
  const b = 0.4;
  const d = 0.55;
  const x = ((n * AS) / b) * (-1 + Math.sqrt(1 + (2 * b * d) / (n * AS)));
  const z = d - x / 3;
  rel(r.x, x, 1e-3, 'x');
  rel(r.sigmaMax, (2 * M) / (b * x * z) / 1000, 1e-3, 'σc');
  rel(-r.barras[0].sigma, M / (AS * z) / 1000, 1e-3, 'σs (tracción: negativa con compresión positiva)');
  // Mx > 0 comprime la cara superior: la fibra más comprimida está en y = 0, β = 90°
  rel(r.beta, Math.PI / 2, 1e-6, 'β');
});

test('los tres modos describen el mismo estado y se pasan de uno a otro', () => {
  const mod = modeloTensional(pilar, H, A, { gammaC: 1.5, alfaCC: 1, fctm: FCTM });
  const a = estadoTensional(mod, { tipo: 'NM', N: 1200, Mx: 180, My: 60 });
  assert.ok(a.ok);
  cerca(a.N, 1200, 1e-4); cerca(a.Mx, 180, 1e-4); cerca(a.My, 60, 1e-4);
  const b = estadoTensional(mod, { tipo: 'eK', e0: a.e0, kx: a.kx, ky: a.ky });
  rel(b.N, a.N, 1e-9); rel(b.Mx, a.Mx, 1e-9); rel(b.My, a.My, 1e-9);
  const c = estadoTensional(mod, { tipo: 'sup', eSup: a.eSup, beta: a.beta, x: a.x });
  assert.ok(c.ok);
  rel(c.N, a.N, 1e-6); rel(c.Mx, a.Mx, 1e-6); rel(c.My, a.My, 1e-6);
  rel(c.e0, a.e0, 1e-9);
});

test('esviada: simetría de la sección cuadrada (Mx ↔ My) y signos de β', () => {
  const sq = rect([[0.05, 0.05], [0.35, 0.05], [0.05, 0.35], [0.35, 0.35]], 0.4, 0.4);
  const mod = modeloTensional(sq, H, A, lin);
  const a = estadoTensional(mod, { tipo: 'NM', N: 500, Mx: 80, My: 0 });
  const b = estadoTensional(mod, { tipo: 'NM', N: 500, Mx: 0, My: 80 });
  rel(a.sigmaMax, b.sigmaMax, 1e-6);
  rel(a.barras.map((x) => x.sigma).sort()[0], b.barras.map((x) => x.sigma).sort()[0], 1e-6);
  rel(a.beta, Math.PI / 2, 1e-6); // Mx > 0 → cara superior
  cerca(b.beta, 0, 1e-6); // My > 0 → cara derecha
  const c = estadoTensional(mod, { tipo: 'NM', N: 500, Mx: -80, My: 0 });
  rel(c.beta, (3 * Math.PI) / 2, 1e-6); // Mx < 0 → cara inferior
});

test('regla de estado: sin fisurar con momento pequeño, fisurada con momento grande', () => {
  const mod = modeloTensional(pilar, H, A, lin);
  assert.equal(estadoTensional(mod, { tipo: 'NM', N: 800, Mx: 20, My: 0 }).fisurada, false);
  const g = estadoTensional(mod, { tipo: 'NM', N: 100, Mx: 300, My: 0 });
  assert.equal(g.fisurada, true);
  // el límite es el momento de fisuración: la fibra traccionada alcanza fctm
  const Ac = 0.24, W = (0.4 * 0.6 ** 2) / 6;
  const sinArm = modeloTensional(rect([]), H, A, lin);
  const Mcr = (FCTM * 1000 + 600 / Ac) * W; // con N = 600: σ_inf = N/A − M/W = −fctm
  assert.equal(estadoTensional(sinArm, { tipo: 'NM', N: 600, Mx: Mcr * 0.99, My: 0 }).fisurada, false);
  const f = estadoTensional(sinArm, { tipo: 'NM', N: 600, Mx: Mcr * 1.02, My: 0 });
  assert.ok(f.ok && f.fisurada);
  // Sin armadura y con la resultante fuera de la sección (e = M/N > h/2) no hay equilibrio sin tracción
  assert.equal(estadoTensional(sinArm, { tipo: 'NM', N: 600, Mx: 200, My: 0 }).ok, false);
});

test('γC, αcc y φ: escalan tensiones y estiran el eje de deformaciones', () => {
  const mu = { gammaC: 1, alfaCC: 1, fctm: FCTM };
  const mf = { gammaC: 1.5, alfaCC: 1, phi: 2, fctm: FCTM };
  const A0 = modeloTensional(pilar, H, A, mu);
  const B0 = modeloTensional(pilar, H, A, mf);
  const pl = { e0: 0.0004, kx: 0.002, ky: 0.0008 };
  const a = esfuerzosDe(A0.mF, A0, { e0: pl.e0 / 3, kx: pl.kx / 3, ky: pl.ky / 3 });
  // Con el hormigón solo: la ley estirada por (1+φ) y escalada por f; la armadura no cambia, así que se compara sin armadura
  const sinA = rect([]);
  const A1 = modeloTensional(sinA, H, A, mu);
  const B1 = modeloTensional(sinA, H, A, mf);
  const x0 = esfuerzosDe(A1.mF, A1, { e0: pl.e0 / 3, kx: pl.kx / 3, ky: pl.ky / 3 });
  const x1 = esfuerzosDe(B1.mF, B1, pl);
  rel(x1.N, x0.N / 1.5, 1e-9, 'N');
  rel(x1.Mx, x0.Mx / 1.5, 1e-9, 'Mx');
  assert.ok(a.N !== undefined && B0.ley.factor === 1 / 1.5);
});

test('x infinita (deformación uniforme), x incompatible y x negativa con tracción total', () => {
  const mod = modeloTensional(pilar, H, A, lin);
  const u = estadoTensional(mod, { tipo: 'sup', eSup: 0.0005, beta: 1, x: Infinity });
  assert.ok(u.ok);
  rel(u.eSup, 0.0005, 1e-9); rel(u.eInf, 0.0005, 1e-9);
  assert.equal(u.x, Infinity);
  assert.equal(estadoTensional(mod, { tipo: 'sup', eSup: 0.001, beta: 1, x: -0.3 }).ok, false);
  const t = estadoTensional(mod, { tipo: 'eK', e0: -0.0003, kx: 0.0004, ky: 0 });
  assert.ok(t.ok);
  assert.ok(t.eSup < 0 && t.x < 0);
});

test('Sargin: a tensión baja coincide con la lineal (pendiente 1,05 Ecm → ~5 %) y diverge a tensión alta', () => {
  const s = modeloTensional(rect([]), H, A, o1);
  const l = modeloTensional(rect([]), H, A, lin);
  const d = { tipo: 'eK', e0: 0.0002, kx: 0, ky: 0 };
  const a = estadoTensional(s, d);
  const b = estadoTensional(l, d);
  assert.ok(Math.abs(a.sigmaMax / b.sigmaMax - 1) < 0.06, 'baja: ' + a.sigmaMax / b.sigmaMax);
  const d2 = { tipo: 'eK', e0: 0.0015, kx: 0, ky: 0 };
  const c = estadoTensional(s, d2).sigmaMax;
  const e = estadoTensional(l, d2).sigmaMax;
  assert.ok(c < 0.8 * e, 'alta: ' + c / e);
});

test('avisos: parábola-rectángulo y ley lineal', () => {
  const pr = hormigon({ fck: 25, norma: 'EC2-2004' });
  const l = leyServicio(pr, { gammaC: 1.5, alfaCC: 1, fctm: FCTM });
  assert.deepEqual(l.avisos, ['PR']);
  assert.equal(l.factor, 1);
  const l2 = leyServicio(H, { ...lin, gammaC: 1.5 });
  assert.deepEqual(l2.avisos, ['lineal']);
  assert.throws(() => leyServicio(H, { gammaC: 1.5, alfaCC: 1 }), /fctm/);
});

test('geometría genérica: sección en L, equilibrio con N, Mx y My', () => {
  const L = {
    contornos: [{ pts: [[0, 0], [0.5, 0], [0.5, 0.2], [0.2, 0.2], [0.2, 0.6], [0, 0.6]], signo: 1 }],
    caja: { xmin: 0, xmax: 0.5, ymin: 0, ymax: 0.6 }, h: 0.6,
    barras: [[0.05, 0.55], [0.15, 0.55], [0.05, 0.05], [0.45, 0.05], [0.45, 0.15]].map(([x, y]) => ({ x, y, A: As20 })), franjas: [],
  };
  const mod = modeloTensional(L, H, A, o1);
  const r = estadoTensional(mod, { tipo: 'NM', N: 300, Mx: 50, My: -30 });
  assert.ok(r.ok);
  cerca(r.N, 300, 1e-4); cerca(r.Mx, 50, 1e-4); cerca(r.My, -30, 1e-4);
});

test('franjas (armadura por área): se dan σ y ε en sus dos extremos y el equilibrio las incluye', () => {
  const G = {
    contornos: [{ pts: [[0, 0], [0.4, 0], [0.4, 0.6], [0, 0.6]], signo: 1 }],
    caja: { xmin: 0, xmax: 0.4, ymin: 0, ymax: 0.6 }, h: 0.6, barras: [],
    franjas: [{ y: 0.55, A: 8e-4, x1: 0.05, x2: 0.35 }, { y: 0.05, A: 4e-4, x1: 0.05, x2: 0.35 }],
  };
  const mod = modeloTensional(G, H, A, lin);
  const r = estadoTensional(mod, { tipo: 'NM', N: 0, Mx: 100, My: 30 });
  assert.ok(r.ok);
  cerca(r.N, 0, 1e-4); cerca(r.Mx, 100, 1e-4); cerca(r.My, 30, 1e-4);
  assert.equal(r.franjas.length, 2);
  assert.equal(r.barras.length, 0);
  const f = r.franjas[0];
  // My > 0 comprime la cara derecha: la tensión crece con x en una franja horizontal
  assert.ok(f.s2 > f.s1);
  // tensión del extremo = Es · ε del plano en ese punto
  rel(f.s1, (200000 * (r.e0 + r.ky * (0.05 - 0.2) - r.kx * (0.55 - 0.3))), 1e-9);
});
