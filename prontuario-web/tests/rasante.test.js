// Pruebas del módulo Rasante en juntas: ejemplo de analisis/rasante-plan.md §3 (HA-25, ρ = 0,5 %, cosido vertical)
// con las tres normas, estados de la EHE-08, límites superiores, dimensionado y casos de tracción normal.

import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from '../src/norma/rasante/index.js';
import * as ehe from '../src/norma/rasante/ehe08.js';
import * as ec2 from '../src/norma/rasante/ec2-2004.js';
import * as ec23 from '../src/norma/rasante/ec2-2023.js';
import { rhoDe, tauDe, tablaCosido } from '../src/norma/rasante/comun.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
// b = 200 mm, L = 1000 mm; 2 ramas ø8 cada 100 mm: ρ = 2·50,27/(100·200) = 0,50 %
const base = { fck: 25, fykCosido: 500, b: 200, L: 1000, alfa: 90, sigN: 0, arm: { fi: 8, ramas: 2, s: 100 } };
const rho = rhoDe(base.arm, base.b);

test('cuantía y tensión de cálculo', () => {
  cerca(rho, 2 * Math.PI * 16 / (100 * 200), 1e-9);
  cerca(tauDe(200, 200, 1000), 1, 1e-12);
});

test('el despachador devuelve el núcleo de cada norma', () => {
  assert.equal(nucleo('EHE-08').id, 'EHE-08');
  assert.equal(nucleo('EHE-98').id, 'EHE-08');
  assert.equal(nucleo('EC2-2004').id, 'EC2-2004');
  assert.equal(nucleo('EC2-2023').id, 'EC2-2023');
  assert.equal(nucleo('X'), null);
});

test('EHE-08: primer estado (cohesión + cosido con μ bajo) y segundo estado (solo cosido)', () => {
  const P = ehe.parametros({ ...base, rug: 'baja', REd: 100 });
  cerca(P.coh, 0.2 * 1.0 * 1.1966, 1e-3, 'cohesión');
  // τEd = 0,5 ≤ 2,5·coh = 0,598: 1.er estado: 0,239 + 0,00503·400·0,3 = 0,843
  const r1 = ehe.comprobar({ ...base, rug: 'baja', REd: 100 });
  assert.equal(r1.res.estado, 1);
  cerca(r1.tauRd, 0.843, 5e-3);
  // τEd = 1,0 > 0,598: 2.º estado: 0,00503·400·0,6 = 1,206
  const r2 = ehe.comprobar({ ...base, rug: 'baja', REd: 200 });
  assert.equal(r2.res.estado, 2);
  cerca(r2.tauRd, 1.206, 5e-3);
  const r3 = ehe.comprobar({ ...base, rug: 'alta', REd: 300 });
  assert.equal(r3.res.estado, 2);
  cerca(r3.tauRd, 1.81, 1e-2);
});

test('EHE-08: tope f_yα,d de 400 MPa y cuantía mínima 0,001', () => {
  assert.equal(ehe.parametros({ ...base, rug: 'alta' }).fyd, 400);
  const r = ehe.comprobar({ ...base, rug: 'alta', REd: 50, arm: { fi: 6, ramas: 2, s: 300 } });
  assert.equal(r.res.contabiliza, false);
  cerca(r.tauRd, r.P.coh, 1e-12);
  assert.ok(r.avisos.some((a) => a.clave === 'ras.av.rhoMin'));
});

test('EHE-08: factor de cohesión, fatiga y tracción normal', () => {
  cerca(ehe.parametros({ ...base, rug: 'alta' }).factor, 1.0, 1e-12);
  cerca(ehe.parametros({ ...base, rug: 'alta', fck: 40 }).factor, 0.82, 1e-12);
  const p0 = ehe.parametros({ ...base, rug: 'alta' });
  cerca(ehe.parametros({ ...base, rug: 'alta', fatiga: true }).coh, p0.coh / 2, 1e-12);
  assert.equal(ehe.parametros({ ...base, rug: 'alta', sigN: -1 }).coh, 0);
});

test('EHE-08: límite superior 0,25·f_cd y dimensionado', () => {
  const P = ehe.parametros({ ...base, rug: 'alta' });
  const lim = ehe.comprobar({ ...base, rug: 'alta', REd: 500, arm: { fi: 20, ramas: 4, s: 100 } });
  assert.equal(lim.manda, 'limite');
  cerca(lim.tauRd, P.lim, 1e-9);
  assert.equal(ehe.dimensionar({ ...base, rug: 'alta' }, 900).caso, 'limite');
  assert.equal(ehe.dimensionar({ ...base, rug: 'alta' }, 20).caso, 'sin');
  // lo dimensionado resiste lo pedido
  for (const REd of [150, 300, 600]) {
    const d = ehe.dimensionar({ ...base, rug: 'alta', ramas: 2 }, REd);
    assert.equal(d.caso, 'calculo');
    const c = ehe.comprobar({ ...base, rug: 'alta', REd, arm: { fi: 8, ramas: 2, s: 100 } });
    // cuantía exacta: se comprueba con el ρ necesario
    const rhoOk = d.rhoNec;
    const res = ehe.resistencia(d.P, rhoOk, d.tauEd);
    assert.ok(res.tauRd >= d.tauEd - 1e-6, `REd=${REd}`);
    void c;
  }
  assert.ok(ehe.dimensionar({ ...base, rug: 'baja', ramas: 2 }, 60).minimaManda);
});

test('EC-2 2004: ejemplo del plan (rugosa y lisa), límite y ν', () => {
  const r = ec2.comprobar({ ...base, rug: 'rugosa', REd: 400 });
  cerca(r.res.coh, 0.4 * 1.197, 2e-3);
  cerca(r.tauRd, 2.0, 2e-2);
  cerca(r.P.lim, 0.5 * 0.54 * 25 / 1.5, 1e-9);
  cerca(ec2.comprobar({ ...base, rug: 'lisa', REd: 100 }).tauRd, 1.54, 2e-2);
});

test('EC-2 2004: tracción normal anula c·f_ctd, compresión limitada a 0,6·f_cd, fatiga', () => {
  const t = ec2.parametros({ ...base, rug: 'rugosa', sigN: -1 });
  assert.equal(t.coh, 0);
  const c = ec2.parametros({ ...base, rug: 'rugosa', sigN: 20 });
  assert.equal(c.sigTopada, true);
  cerca(c.sigN, 0.6 * 25 / 1.5, 1e-9);
  cerca(ec2.parametros({ ...base, rug: 'rugosa', fatiga: true }).coh, ec2.parametros({ ...base, rug: 'rugosa' }).coh / 2, 1e-12);
  assert.throws(() => ec2.parametros({ ...base, rug: 'rugosa', alfa: 100 }));
});

test('EC-2 2004: dimensionado coherente', () => {
  for (const REd of [150, 300, 500, 700]) {
    const d = ec2.dimensionar({ ...base, rug: 'rugosa', ramas: 2 }, REd);
    assert.equal(d.caso, 'calculo');
    assert.ok(ec2.resistencia(d.P, d.rhoNec).tauRd >= d.tauEd - 1e-6);
  }
  assert.equal(ec2.dimensionar({ ...base, rug: 'rugosa' }, 80).caso, 'sin');
  assert.equal(ec2.dimensionar({ ...base, rug: 'rugosa' }, 1000).caso, 'limite');
});

test('EC-2 2023: (8.76) con cosido anclado, ejemplo del plan', () => {
  const r = ec23.comprobar({ ...base, rug: 'rugosa', REd: 400 });
  cerca(r.res.coh, 0.15 * 5 / 1.5, 1e-9);
  cerca(r.tauRd, 2.02, 2e-2);
  const mr = ec23.comprobar({ ...base, rug: 'muyRugosa', REd: 400 });
  cerca(mr.tauRd, 0.19 * 5 / 1.5 + rho * (500 / 1.15) * 0.9, 1e-9);
});

test('EC-2 2023: (8.77) sin anclaje total, kdowel y recrecido', () => {
  const P = ec23.parametros({ ...base, rug: 'rugosa', anclado: false });
  cerca(P.coh, 0.08 * 5 / 1.5, 1e-9);
  const r = ec23.comprobar({ ...base, rug: 'rugosa', anclado: false, REd: 100 });
  const fyd = 500 / 1.15;
  cerca(r.res.cosido, rho * (0.5 * fyd * 0.7 + 0.9 * Math.sqrt(fyd * P.fcd)), 1e-9);
  cerca(ec23.parametros({ ...base, rug: 'rugosa', anclado: false, topping: true }).coh, 1.2 * P.coh, 1e-9);
  const b = ec23.comprobar({ ...base, rug: 'rugosa', anclado: false, bordeCerca: true, REd: 100 });
  cerca(b.res.cosido, rho * 0.5 * fyd * 0.7, 1e-9);
  assert.throws(() => ec23.parametros({ ...base, rug: 'dentada', anclado: false }));
});

test('EC-2 2023: tracción, límite con cosido y rangos de α', () => {
  const t = ec23.parametros({ ...base, rug: 'rugosa', sigN: -1 });
  assert.equal(t.coh, 0);
  assert.equal(ec23.resistencia(t, 0).fric, 0);
  assert.throws(() => ec23.parametros({ ...base, rug: 'muyLisa', alfa: 100 }));
  assert.doesNotThrow(() => ec23.parametros({ ...base, rug: 'lisa', alfa: 135 }));
  const r = ec23.comprobar({ ...base, rug: 'muyRugosa', REd: 900, arm: { fi: 20, ramas: 4, s: 100 } });
  assert.equal(r.manda, 'limite');
});

test('EC-2 2023: dimensionado coherente en ambas fórmulas', () => {
  for (const anclado of [true, false]) {
    for (const REd of [100, 250, 400]) {
      const d = ec23.dimensionar({ ...base, rug: 'rugosa', ramas: 2, anclado }, REd);
      if (d.caso !== 'calculo') continue;
      assert.ok(ec23.resistencia(d.P, d.rhoNec).tauRd >= d.tauEd - 1e-6, `${anclado} ${REd}`);
    }
  }
});

test('tabla de cosido: separación en múltiplos de 25 que cumple la cuantía', () => {
  const tb = tablaCosido(0.004, { b: 200, ramas: 2 }, [8, 10, 12, 16], 600);
  for (const f of tb.filter((k) => k.s)) {
    assert.equal(f.s % 25, 0);
    assert.ok(f.rho >= 0.004 - 1e-12);
    assert.ok(f.s <= 300);
  }
  assert.equal(tablaCosido(0.1, { b: 200, ramas: 2 }, [8], 600)[0].s, null);
});

test('EC-2 2023: sin armadura rige (8.76) aunque se marque cosido no anclado', () => {
  const b = { ...base, rug: 'lisa', REd: 30, sinArmadura: true };
  const a = ec23.comprobar({ ...b, anclado: true });
  const n = ec23.comprobar({ ...b, anclado: false });
  cerca(n.tauRd, a.tauRd, 1e-12);
  cerca(n.tauRd, 0.08 * 5 / 1.5, 1e-9);
  assert.equal(n.formula, '8.76');
  assert.equal(ec23.dimensionar({ ...base, rug: 'lisa', ramas: 2, anclado: false }, 30).caso, 'sin');
  assert.equal(ec23.comprobar({ ...base, rug: 'lisa', anclado: false, REd: 100 }).formula, '8.77');
});

test('la fórmula aplicada se informa en las tres normas', () => {
  assert.equal(ec2.comprobar({ ...base, rug: 'rugosa', REd: 100 }).formula, '6.25');
  assert.equal(ehe.comprobar({ ...base, rug: 'baja', REd: 100 }).formula, '47.2.2.1');
  assert.equal(ehe.comprobar({ ...base, rug: 'baja', REd: 200 }).formula, '47.2.2.2');
  assert.equal(ehe.comprobar({ ...base, rug: 'baja', REd: 100, sinArmadura: true }).formula, '47.2.1');
});
