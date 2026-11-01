import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flechasBranson, inerciaBranson, xi, lambda, sistema } from '../src/core/flechas.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const L = 6, E = 3e7, Ib = 4e-3;
const udl = (q) => [{ tipo: 'distribuida', a: 0, b: L, q1: q, q2: q }];
// Sección sin fisurar en la práctica (Mf enorme) y otra fisurada
const entera = { Ib, Ifis: { pos: 1e-3, neg: 1e-3 }, Mfis: { pos: 1e9, neg: 1e9 } };
const fisura = { Ib, Ifis: { pos: 1e-3, neg: 1e-3 }, Mfis: { pos: 1, neg: 1 } };

test('ξ y λ siguen la tabla de EHE-08 50.2.2.3', () => {
  cerca(xi(14), 0.5); cerca(xi(30), 0.7); cerca(xi(90), 1); cerca(xi(180), 1.2); cerca(xi(365), 1.4); cerca(xi(1825), 2); cerca(xi(1e5), 2);
  cerca(xi(60), 0.85);
  cerca(lambda(30, 1825, 0.01), (2 - 0.7) / 1.5);
});

test('inercia de Branson: sin fisurar Ib, muy fisurada tiende a If, intermedia entre ambas', () => {
  cerca(inerciaBranson(entera, 100), Ib);
  cerca(inerciaBranson(fisura, 1e6), 1e-3, 1e-6);
  const s = { Ib, Ifis: { pos: 1e-3, neg: 2e-3 }, Mfis: { pos: 50, neg: 30 } };
  const k = (50 / 100) ** 3;
  cerca(inerciaBranson(s, 100), k * Ib + (1 - k) * 1e-3);
  const kn = (30 / 60) ** 3;
  cerca(inerciaBranson(s, -60), kn * Ib + (1 - kn) * 2e-3);
});

test('sistemas según los extremos', () => {
  assert.equal(sistema('apoyo', 'apoyo'), 'biapoyada');
  assert.equal(sistema('empotramiento', 'apoyo'), 'continuaUno');
  assert.equal(sistema('apoyo', 'empotramiento'), 'continuaUno');
  assert.equal(sistema('empotramiento', 'empotramiento'), 'continuaAmbos');
  assert.equal(sistema('empotramiento', 'libre'), 'voladizo');
});

test('biapoyada sin fisurar: flecha instantánea con Ib y diferida con λ', () => {
  const q1 = 10, q2 = 5, q3 = 8;
  const r = flechasBranson({
    L, izq: 'apoyo', der: 'apoyo', E, seccion: entera, rhoP: 0.004,
    hitos: [{ t: 30, cargas: udl(q1) }, { t: 90, cargas: udl(q2) }, { t: 365, cargas: udl(q3) }],
  });
  const f = (q) => (5 * q * L ** 4) / (384 * E * Ib) * 1000;
  const m = r.maximos.total;
  const lam13 = lambda(30, 365, 0.004), lam23 = lambda(90, 365, 0.004), lam12 = lambda(30, 90, 0.004);
  const di1 = f(q1), di2 = f(q2), di3 = f(q3);
  const total = di1 + di2 + di3 + di1 * lam13 + di2 * lam23;
  cerca(m.valor, total, 1e-5);
  cerca(m.x, L / 2);
  cerca(r.maximos.activa.valor, total - di1 * (1 + lam12), 1e-5);
  assert.equal(r.puntos.length, 51);
  cerca(m.relacion, (L * 1000) / total, 1e-5);
});

test('fisurar aumenta la flecha: con Ie < Ib la flecha instantánea crece como Ib/Ie', () => {
  const hitos = [{ t: 30, cargas: udl(10) }, { t: 90, cargas: [] }, { t: 365, cargas: [] }];
  const a = flechasBranson({ L, izq: 'apoyo', der: 'apoyo', E, seccion: entera, hitos });
  const b = flechasBranson({ L, izq: 'apoyo', der: 'apoyo', E, seccion: { ...entera, Mfis: { pos: 20, neg: 20 } }, hitos });
  // M = 10·36/8 = 45 kN·m; k = (20/45)³
  const k = (20 / 45) ** 3;
  const Ie = k * Ib + (1 - k) * 1e-3;
  cerca(b.Ie[0], Ie);
  cerca(b.puntos[25].di1 / a.puntos[25].di1, Ib / Ie, 1e-6);
});

test('ponderación 25-50-25 en vano interior y 75-25 en vano extremo', () => {
  const hitos = [{ t: 30, cargas: udl(30) }, { t: 90, cargas: [] }, { t: 365, cargas: [] }];
  const s = { Ib, Ifis: { pos: 1e-3, neg: 1.5e-3 }, Mfis: { pos: 40, neg: 30 } };
  const ambos = flechasBranson({ L, izq: 'empotramiento', der: 'empotramiento', E, seccion: s, hitos });
  // Empotrada-empotrada: M centro = qL²/24 = 45, M apoyos = −qL²/12 = −90
  const Iec = inerciaBranson(s, 45), Iee = inerciaBranson(s, -90);
  cerca(ambos.Ie[0], 0.5 * Iec + 0.5 * Iee, 1e-6);
  const uno = flechasBranson({ L, izq: 'empotramiento', der: 'apoyo', E, seccion: s, hitos });
  // Empotrada-apoyada: M apoyo = −qL²/8 = −135, M en L/2 = R·x − qL²/8 − q x²/2 con R = 5qL/8
  const Mx = (5 * 30 * L / 8) * (L / 2) - (30 * L * L) / 8 - (30 * (L / 2) ** 2) / 2;
  const Iec1 = inerciaBranson(s, Mx), Iee1 = inerciaBranson(s, -(30 * L * L) / 8);
  cerca(uno.Ie[0], 0.75 * Iec1 + 0.25 * Iee1, 1e-6);
});

test('voladizo: referencia en el arranque; flecha PL³/3EI con Ib', () => {
  const P = 20;
  const r = flechasBranson({
    L: 3, izq: 'empotramiento', der: 'libre', E, seccion: entera,
    hitos: [{ t: 30, cargas: [{ tipo: 'puntual', a: 3, P }] }, { t: 90, cargas: [] }, { t: 365, cargas: [] }],
  });
  cerca(r.puntos[50].di1, (P * 27) / (3 * E * Ib) * 1000, 1e-6);
});

test('errores de datos', () => {
  const h = (t) => ({ t, cargas: [] });
  assert.throws(() => flechasBranson({ L, izq: 'apoyo', der: 'apoyo', E, seccion: entera, hitos: [h(90), h(30), h(365)] }));
  assert.throws(() => flechasBranson({ L, izq: 'apoyo', der: 'apoyo', E, seccion: entera, hitos: [h(30), h(90)] }));
});
