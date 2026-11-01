import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometria } from '../src/core/geometria.js';
import { propiedades } from '../src/core/propiedades.js';
import { flechasCurvaturas } from '../src/core/flechasCurvaturas.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const L = 6, Ecm = 3.0e7, Es = 2e8, fctm = 2900;
const udl = (q) => [{ tipo: 'distribuida', a: 0, b: L, q1: q, q2: q }];
const geoRec = (inf, sup) => geometria({ forma: 'rectangular', geo: { b: 0.3, h: 0.5 }, armado: [
  { tipo: 'capa', cara: 'inf', texto: inf, d: 0.045 }, ...(sup ? [{ tipo: 'capa', cara: 'sup', texto: sup, d: 0.045 }] : [])] });
const sinReo = { phi: () => 0, epsCs: () => 0 };
const h = (q1, q2, q3) => [{ t: 28, cargas: udl(q1) }, { t: 90, cargas: udl(q2) }, { t: 365, cargas: udl(q3) }];

test('sin fisurar: la flecha es 5qL⁴/384·E·I con la inercia homogeneizada', () => {
  const g = geoRec('4D16', '2D12');
  const p = propiedades(g, { Ec: Ecm, Es, fctm });
  const q = 8; // M = 36 kN·m < Mcr
  assert.ok(36 < p.fisurada.positivo.Mfis);
  const r = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: g, Ecm, Es, fctm, ...sinReo, hitos: h(q, 0, 0) });
  cerca(r.maximos.total.valor, (5 * q * L ** 4) / (384 * Ecm * p.homogeneizada.Ix) * 1000, 1e-3); // integración por tramos lineales de κ
  cerca(r.maximos.total.x, L / 2);
  cerca(r.puntos[0].total, 0, 1e-9);
  assert.equal(r.puntos.length, 51);
});

test('totalmente fisurada: tiende a la flecha con Ifis cuando M ≫ Mcr (ζ → 1)', () => {
  const g = geoRec('4D16');
  const p = propiedades(g, { Ec: Ecm, Es, fctm });
  const q = 60; // M = 270 kN·m ≫ Mcr
  const r = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: g, Ecm, Es, fctm, ...sinReo, hitos: h(q, 0, 0) });
  const f2 = (5 * q * L ** 4) / (384 * Ecm * p.fisurada.positivo.Ifis) * 1000;
  assert.ok(r.maximos.total.valor < f2 * 1.001 && r.maximos.total.valor > 0.8 * f2, `${r.maximos.total.valor} vs ${f2}`);
});

test('la fluencia con φ constante divide el módulo: flecha sin fisurar × (1+φ) para cargas mantenidas', () => {
  const g = geoRec('4D16', '2D12');
  const phi = 2;
  const r = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: g, Ecm, Es, fctm, phi: () => phi, epsCs: () => 0, hitos: h(8, 0, 0) });
  const m = r.puntos[25];
  // Con Ec,eff = Ecm/(1+φ) la sección homogeneizada cambia (n crece): δ = δinst·(1+φ)·Ix(Ecm)/Ix(Ecm/(1+φ))
  const Ix0 = propiedades(g, { Ec: Ecm, Es, fctm }).homogeneizada.Ix;
  const Ix1 = propiedades(g, { Ec: Ecm / (1 + phi), Es, fctm }).homogeneizada.Ix;
  cerca(m.fluencia, m.inst * ((1 + phi) * Ix0 / Ix1 - 1), 1e-6);
  cerca(m.retraccion, 0, 1e-12);
});

test('retracción: nula con armado simétrico y sin cargas; con armado inferior da curvatura hacia abajo', () => {
  const sim = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: geoRec('4D16', '4D16'), Ecm, Es, fctm, phi: () => 0, epsCs: () => -4e-4, hitos: h(0, 0, 0) });
  cerca(sim.maximos.total.valor, 0, 1e-6);
  const asim = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: geoRec('4D16'), Ecm, Es, fctm, phi: () => 0, epsCs: () => -4e-4, hitos: h(0, 0, 0) });
  assert.ok(asim.maximos.total.valor > 0.1, `δ = ${asim.maximos.total.valor}`);
  cerca(asim.maximos.total.x, L / 2);
  cerca(asim.puntos[25].retraccion, asim.puntos[25].total, 1e-9);
  // Retracción pura y uniforme en viga biapoyada: δ = κ·L²/8
  const g = geoRec('4D16');
  const p = propiedades(g, { Ec: Ecm, Es, fctm });
  const S = 4 * Math.PI * 0.016 ** 2 / 4 * (0.455 - p.homogeneizada.yg);
  const kappa = 4e-4 * (Es / Ecm) * S / p.homogeneizada.Ix;
  cerca(asim.maximos.total.valor, (kappa * L * L) / 8 * 1000, 1e-4);
});

test('voladizo e hiperestática: signos y reparto', () => {
  const g = geoRec('4D16', '4D16');
  const vol = flechasCurvaturas({ L: 3, izq: 'empotramiento', der: 'libre', geo: g, Ecm, Es, fctm, ...sinReo,
    hitos: [{ t: 28, cargas: [{ tipo: 'puntual', a: 3, P: 10 }] }, { t: 90, cargas: [] }, { t: 365, cargas: [] }] });
  const p = propiedades(g, { Ec: Ecm, Es, fctm });
  // M = 30 kN·m en el arranque; con ese momento (negativo) la sección puede fisurar: comparar con la cota sin fisurar
  const sinF = (10 * 27) / (3 * Ecm * p.homogeneizada.Ix) * 1000;
  assert.ok(vol.maximos.total.valor >= sinF * 0.999, 'fisurada ≥ sin fisurar');
  assert.ok(vol.puntos[50].total > 0 && vol.puntos[0].total === 0);
  const bie = flechasCurvaturas({ L, izq: 'empotramiento', der: 'empotramiento', geo: g, Ecm, Es, fctm, ...sinReo, hitos: h(5, 0, 0) });
  const q = 5, I = p.homogeneizada.Ix;
  cerca(bie.maximos.total.valor, (q * L ** 4) / (384 * Ecm * I) * 1000, 2e-3); // sin fisurar (M apoyo 15 < Mcr)
});

test('flecha activa: total menos lo que había antes de q2', () => {
  const g = geoRec('4D16', '2D12');
  const r = flechasCurvaturas({ L, izq: 'apoyo', der: 'apoyo', geo: g, Ecm, Es, fctm, ...sinReo, hitos: h(4, 2, 0) });
  const p = propiedades(g, { Ec: Ecm, Es, fctm });
  const f = (q) => (5 * q * L ** 4) / (384 * Ecm * p.homogeneizada.Ix) * 1000;
  cerca(r.maximos.activa.valor, f(4 + 2) - f(4), 2e-3);
});
