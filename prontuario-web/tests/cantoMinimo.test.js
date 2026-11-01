import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarSistema, relacionLuzCantoEC2, relacionLuzCanto2023, sigmaSEstimada, factorTabiques } from '../src/core/cantoMinimo.js';

const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

test('EHE-08/EC-2 2004: las ecuaciones reproducen la tabla para C30 (±1: la tabla redondea K·l/d de la biapoyada)', () => {
  const t = { biapoyada: [14, 20], continuaUno: [18, 26], continuaAmbos: [20, 30], voladizo: [6, 8] };
  for (const [sistema, [fuerte, debil]] of Object.entries(t)) {
    cerca(relacionLuzCantoEC2({ fck: 30, rho: 0.015, sistema }), fuerte, 1);
    cerca(relacionLuzCantoEC2({ fck: 30, rho: 0.005, sistema }), debil, 1);
  }
});

test('correcciones: alas ×0,8, σs, tabiques', () => {
  const base = relacionLuzCantoEC2({ fck: 30, rho: 0.01, sistema: 'biapoyada' });
  cerca(relacionLuzCantoEC2({ fck: 30, rho: 0.01, sistema: 'biapoyada', alas: true }), 0.8 * base, 1e-9);
  cerca(relacionLuzCantoEC2({ fck: 30, rho: 0.01, sistema: 'biapoyada', sigmaS: 248 }), base * 310 / 248, 1e-9);
  cerca(sigmaSEstimada(500, 800, 1000), 310 / 0.8, 1e-9);
  cerca(factorTabiques(10), 0.7, 1e-12);
  cerca(factorTabiques(6), 1, 0);
  cerca(factorTabiques(10, true), 0.85, 1e-12);
});

test('menor cuantía permite mayor l/d y la compresión ρ\' lo aumenta', () => {
  const a = relacionLuzCantoEC2({ fck: 30, rho: 0.02, sistema: 'biapoyada' });
  const b = relacionLuzCantoEC2({ fck: 30, rho: 0.01, sistema: 'biapoyada' });
  const c = relacionLuzCantoEC2({ fck: 30, rho: 0.02, rhoP: 0.01, sistema: 'biapoyada' });
  assert.ok(b > a && c > a);
});

test('clasificación del sistema con el 85 %', () => {
  assert.equal(clasificarSistema('apoyo', 'apoyo'), 'biapoyada');
  assert.equal(clasificarSistema('empotramiento', 'apoyo', 0.9, 1), 'continuaUno');
  assert.equal(clasificarSistema('empotramiento', 'empotramiento', 0.8, 0.9), 'continuaUno');
  assert.equal(clasificarSistema('empotramiento', 'empotramiento', 0.9, 0.9), 'continuaAmbos');
  assert.equal(clasificarSistema('libre', 'empotramiento'), 'voladizo');
});

test('EC-2 2023: valores de la tabla 9.3 e interpolación', () => {
  assert.equal(relacionLuzCanto2023({ omega: 0.3, sobrecarga: 0.6, sistema: 'biapoyada' }), 15);
  assert.equal(relacionLuzCanto2023({ omega: 0.1, sobrecarga: 0.3, sistema: 'continuaAmbos' }), 26);
  assert.equal(relacionLuzCanto2023({ omega: 0.2, sobrecarga: 0.45, sistema: 'voladizo' }), 7);
  cerca(relacionLuzCanto2023({ omega: 0.25, sobrecarga: 0.6, sistema: 'biapoyada' }), 16, 1e-9);
  cerca(relacionLuzCanto2023({ omega: 0.3, sobrecarga: 0.525, sistema: 'biapoyada' }), 14.5, 1e-9);
  // fuera de rango: acotado
  assert.equal(relacionLuzCanto2023({ omega: 0.5, sobrecarga: 0.9, sistema: 'biapoyada' }), 15);
  cerca(relacionLuzCanto2023({ omega: 0.3, sobrecarga: 0.6, sistema: 'biapoyada', limite: 500 }), 7.5, 1e-9);
});
