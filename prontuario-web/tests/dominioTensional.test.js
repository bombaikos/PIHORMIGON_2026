import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero, sigma } from '../src/core/materiales.js';
import { modeloTensional } from '../src/core/estadoTensional.js';
import { limitesDe, admisible, intervaloEnRecta, leyesNoAdmitidas } from '../src/core/dominioTensional.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const HS = hormigon({ fck: 25, norma: 'EC2-2004', diag: 'EC2' });
const HP = hormigon({ fck: 25, norma: 'EC2-2004', diag: 'PR' });
const A = acero({ fyk: 500, norma: 'EC2-2004' });
const As = (Math.PI * 0.02 ** 2) / 4;
const sec = {
  contornos: [{ pts: [[0, 0], [0.4, 0], [0.4, 0.6], [0, 0.6]], signo: 1 }],
  caja: { xmin: 0, xmax: 0.4, ymin: 0, ymax: 0.6 }, h: 0.6,
  barras: [[0.05, 0.05], [0.35, 0.05], [0.05, 0.55], [0.35, 0.55]].map(([x, y]) => ({ x, y, A: As })), franjas: [],
};
const o1 = { gammaC: 1, alfaCC: 1, fctm: 2.56 };

test('ELS: el límite del hormigón es donde la ley llega a kc·fck, en la rama ascendente', () => {
  const mod = modeloTensional(sec, HS, A, o1);
  const lim = limitesDe(mod, 'ELS');
  cerca(-sigma(mod.ley.integra, -lim.ec) / 1000, 0.6 * 25, 1e-6, 'σ en el límite');
  const e1 = mod.ley.integra.comp.map((p) => Math.abs(p[0])).find((e, i, a) => i > 0 && Math.abs(mod.ley.integra.comp[i][1]) > Math.abs(mod.ley.integra.comp[i + 1]?.[1] ?? 0));
  assert.ok(lim.ec < e1, 'antes del pico');
  const l2 = limitesDe(mod, 'ELS', { kc: 0.45 });
  assert.ok(l2.ec < lim.ec);
});

test('ELS: si la ley no llega a kc·fck, el límite es la deformación última de la ley', () => {
  const mod = modeloTensional(sec, HS, A, { ...o1, gammaC: 1.5 });
  const lim = limitesDe(mod, 'ELS', { kc: 0.9 }); // 0,9·fck > fcm/1,5
  assert.equal(lim.alcanzaC, false);
  cerca(lim.ec, 0.0035, 1e-9);
});

test('ELS: el límite del acero es ks·fyk/Es en la rama elástica, con γS = 1 o de cálculo', () => {
  const mod = modeloTensional(sec, HS, A, { ...o1, gammaS: 1 });
  cerca(limitesDe(mod, 'ELS').esT, 0.8 * 500 / 200000, 1e-9);
  const mod2 = modeloTensional(sec, HS, A, { ...o1, gammaS: 1.15 });
  cerca(limitesDe(mod2, 'ELS').esT, 0.8 * 500 / 200000, 1e-9);
  const mod3 = modeloTensional(sec, HS, A, { ...o1, gammaS: 1.15 });
  cerca(limitesDe(mod3, 'ELS', { ks: 1 }).esT, A.tracc[A.tracc.length - 1][0], 1e-12, 'ks·fyk > fyd: εud');
});

test('ELU: εud de la ley del acero, εcu del hormigón y pivote C a ε_c2', () => {
  const mod = modeloTensional(sec, HP, A, o1);
  const lim = limitesDe(mod, 'ELU');
  cerca(lim.esT, A.tracc[2][0], 1e-12);
  cerca(lim.ec, 0.0035, 1e-9);
  cerca(lim.pivote.ec2, 0.002, 1e-9);
  cerca(lim.pivote.a, 4 / 7, 1e-9);
  const ms = modeloTensional(sec, HS, A, o1);
  const ls = limitesDe(ms, 'ELU');
  assert.ok(ls.pivote.ec2 < ls.ec, 'Sargin: el pico hace de ε_c2');
});

test('admisible: pivote C y límites de acero y de hormigón', () => {
  const mod = modeloTensional(sec, HP, A, o1);
  const lim = limitesDe(mod, 'ELU');
  const plano = (eSup, eInf) => { const k = (eSup - eInf) / 0.6; return { e0: (eSup + eInf) / 2, kx: k, ky: 0 }; }; // y hacia abajo: kx > 0 comprime arriba
  assert.ok(admisible(mod, lim, plano(0.002, 0.002)).ok, 'compresión pura a ε_c2');
  assert.equal(admisible(mod, lim, plano(0.0021, 0.0021)).ok, false);
  assert.equal(admisible(mod, lim, plano(0.0021, 0.0021)).limita, 'pivote');
  assert.equal(admisible(mod, lim, plano(0.0035, 0.002)).ok, false, 'por encima del pivote C');
  assert.ok(admisible(mod, lim, plano(0.0035, 0)).ok, 'dominio 3-4');
  assert.equal(admisible(mod, lim, plano(0.0036, -0.005)).limita, 'hormigon');
  assert.equal(admisible(mod, lim, plano(0.001, -0.02)).limita, 'acero');
  // frontera del pivote: ε_sup = ε_cu con ε_inf = (ε_c2 − a·ε_cu)/(1 − a)
  const a = lim.pivote.a;
  const eInf = (0.002 - a * 0.0035) / (1 - a);
  cerca(admisible(mod, lim, plano(0.0035, eInf)).holgura, 0, 1e-9);
});

test('intervaloEnRecta: deformación uniforme en ELU y ELS', () => {
  const mod = modeloTensional(sec, HP, A, o1);
  const elu = limitesDe(mod, 'ELU');
  const [a, b] = intervaloEnRecta((p) => admisible(mod, elu, p).ok, { e0: 0, kx: 0, ky: 0 }, { e0: 1, kx: 0, ky: 0 }, 0.05);
  cerca(a, -A.tracc[2][0], 1e-9);
  cerca(b, 0.002, 1e-9);
  const ms = modeloTensional(sec, HS, A, { ...o1, gammaS: 1 });
  const els = limitesDe(ms, 'ELS');
  const [c, d] = intervaloEnRecta((p) => admisible(ms, els, p).ok, { e0: 0, kx: 0, ky: 0 }, { e0: 1, kx: 0, ky: 0 }, 0.05);
  cerca(c, -0.002, 1e-9);
  cerca(d, Math.min(els.ec, 0.002), 1e-9);
});

test('leyes admitidas: PR, Sargin y acero bilineal; el diagrama por puntos se rechaza', () => {
  assert.equal(leyesNoAdmitidas(HS, A), null);
  assert.equal(leyesNoAdmitidas(HP, A), null);
  const HX = hormigon({ fck: 25, norma: 'EC2-2004', diag: 'puntos', puntos: [[0, 0], [2, 20], [3.5, 20]] });
  assert.equal(leyesNoAdmitidas(HX, A), 'hormigon');
  assert.equal(leyesNoAdmitidas(HS, { ...A, tracc: [...A.tracc, [0.02, 400000]] }), 'acero');
});
