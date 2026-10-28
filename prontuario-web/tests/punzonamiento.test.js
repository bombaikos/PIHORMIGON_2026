// Pruebas del módulo Punzonamiento: geometría de los seis tipos de pilar y las tres normas (EHE-08, EC-2 2004 + AN,
// EC-2 2023). Referencias: ejemplo de analisis/punzonamiento-plan.md §3 y puerto de TT3 (tests/ref31/tt3.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import { perimetro, perimetroCara, deltaDePerimetro, contorno, longitud, repartir, betaDe } from '../src/norma/punzonamiento/comun.js';
import { nucleo } from '../src/norma/punzonamiento/index.js';
import * as ehe from '../src/norma/punzonamiento/ehe08.js';
import * as ec2 from '../src/norma/punzonamiento/ec2-2004.js';
import * as ec23 from '../src/norma/punzonamiento/ec2-2023.js';
import { tt3, perimetros31 } from './ref31/tt3.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const PI = Math.PI;
const base = { tipo: 'rect', pos: 'interior', c1: 300, c2: 300, d: 210, fck: 30, fykCercos: 500, rhoX: 0.008, rhoY: 0.008, sigCd: 0, beta: 1.15, VEd: 400 };
const TIPOS = ['rect', 'circ'].flatMap((tipo) => ['interior', 'borde', 'esquina'].map((pos) => ({ ...base, tipo, pos, c1: 400, c2: 300, D: 350 })));

test('perímetros rectangulares a 2d (EHE-08 46.2, EC-2 6.4.2)', () => {
  const d = 210;
  cerca(perimetro({ ...base }, 2 * d), 2 * 600 + 4 * PI * d, 1e-6);
  cerca(perimetro({ ...base, pos: 'borde' }, 2 * d), 300 + 600 + 2 * PI * d, 1e-6);
  cerca(perimetro({ ...base, pos: 'esquina' }, 2 * d), 600 + PI * d, 1e-6);
});

test('perímetros a 0,5·dv del EC-2 2023 con tramos rectos limitados a 3·dv', () => {
  const u = ec23.perimetros({ ...base });
  cerca(u.b05, 1200 + PI * 210, 1e-6);
  cerca(u.b0, 1200, 1e-9);
  // Pilar grande: cada tramo recto no pasa de 3·dv = 630 mm
  const g = ec23.perimetros({ ...base, c1: 1200, c2: 800 });
  cerca(g.b0, 2 * (630 + 630), 1e-9);
  cerca(g.b05, 2 * (630 + 630) + PI * 210, 1e-6);
});

test('la fórmula del perímetro coincide con la longitud del contorno dibujado (los seis tipos)', () => {
  for (const x of TIPOS) {
    for (const delta of [105, 420, 840]) {
      const L = longitud(contorno(x, delta, 2));
      cerca(L, perimetro(x, delta), perimetro(x, delta) * 0.004, `${x.tipo} ${x.pos} δ=${delta}`);
    }
  }
});

test('circular de borde y esquina: sin el sumando D del 3.1, arco de la envolvente cortada por el borde', () => {
  const x = { ...base, tipo: 'circ', D: 400 };
  const R = 200 + 420;
  const b = Math.asin(200 / R);
  cerca(perimetro({ ...x, pos: 'borde' }, 420), R * (PI + 2 * b), 1e-6);
  cerca(perimetro({ ...x, pos: 'esquina' }, 420), R * (PI / 2 + 2 * b), 1e-6);
  cerca(perimetro({ ...x, pos: 'interior' }, 420), 2 * PI * R, 1e-6);
  // El D del 3.1 (D + π(D/2 + 2d)) aproxima ese arco: R·asin(a/R) ≈ a. La diferencia es menor del 1 %
  for (const pos of ['borde', 'esquina']) {
    const u31 = perimetros31({ ...x, pos, d: 210 }).u1;
    const exacto = perimetro({ ...x, pos }, 420);
    assert.ok(Math.abs(u31 - exacto) / exacto < 0.01, `${pos}: 3.1 ${u31} frente a ${exacto}`);
  }
});

test('deltaDePerimetro es la inversa de perimetro', () => {
  for (const x of TIPOS) {
    const u = perimetro(x, 500);
    cerca(deltaDePerimetro(x, u), 500, 1e-6);
  }
});

test('repartir pone n ramas equiespaciadas sobre el contorno', () => {
  const pts = contorno({ ...base }, 105, 2);
  const r = repartir(pts, 12, true);
  assert.equal(r.length, 12);
  const pe = contorno({ ...base, pos: 'borde' }, 105, 2);
  const re = repartir(pe, 5, false);
  assert.equal(re.length, 5);
  assert.ok(re.every(([, y]) => y >= 0));
});

test('β: sin momento 1,00 (2023: 1,05 interior), simplificado 1,15/1,40/1,50, otro', () => {
  assert.equal(betaDe('EHE-08', 'sin', 'interior'), 1);
  assert.equal(betaDe('EC2-2023', 'sin', 'interior'), 1.05);
  assert.equal(betaDe('EC2-2023', 'sin', 'borde'), 1);
  assert.deepEqual(['interior', 'borde', 'esquina'].map((p) => betaDe('EHE-08', 'aprox', p)), [1.15, 1.4, 1.5]);
  assert.equal(betaDe('EC2-2004', 'otro', 'borde', 1.22), 1.22);
});

test('ejemplo del plan §3: carga sin armadura 533 / 533 / 298 kN', () => {
  cerca(ehe.comprobar({ ...base, sinArmadura: true }).Vu, 533.2, 0.3);
  cerca(ec2.comprobar({ ...base, sinArmadura: true }).Vu, 533.2, 0.3);
  cerca(ec23.comprobar({ ...base, sinArmadura: true }).Vu, 297.8, 0.3);
  const e = ehe.comprobar({ ...base, sinArmadura: true });
  assert.ok(e.tau.minManda, 'manda el mínimo de τrd');
  cerca(e.tau.tau, 0.761, 0.001);
  const t = ec23.comprobar({ ...base, sinArmadura: true });
  cerca(t.s.kpb, 1.28, 0.01);
  cerca(t.s.tau, 0.877, 0.002);
});

test('EHE-08 y EC-2 2004 coinciden sin armadura en los seis tipos (mismos coeficientes del AN)', () => {
  for (const x of TIPOS) {
    const a = ehe.comprobar({ ...x, sinArmadura: true });
    const b = ec2.comprobar({ ...x, sinArmadura: true });
    cerca(a.Vc, b.Vc, 1e-6, `${x.tipo} ${x.pos}`);
  }
});

test('contraste con TT3 del 3.1: u1, u0 y Fu1 (rectangulares) y τrd cuando no manda el mínimo', () => {
  for (const pos of ['interior', 'borde', 'esquina']) {
    const x = { ...base, pos, c1: 400, c2: 300, d: 260, rhoX: 0.015, rhoY: 0.015, fck: 25 };
    const r = ehe.comprobar({ ...x, sinArmadura: true });
    const v = tt3({ tipo: 'rect', pos, c1: 0.4, c2: 0.3, d: 0.26, rho: 0.015, fck: 25, beta: 1.15, Asw: 0, fyd: 0 });
    cerca(r.u.u1, v.u1 * 1000, 1e-6, `u1 ${pos}`);
    cerca(r.u.u0, v.u0 * 1000, 1e-6, `u0 ${pos}`);
    // EHE-08: 0,5·f1cd = 0,30·fcd con fck ≤ 60; el 3.1 divide además por β
    cerca(r.Vmax, v.Fu1, 1e-6, `Fu1 ${pos}`);
    // τrd: el 3.1 usa 0,12·ξ·… (= 0,18/1,5) sin mínimo ni tope de ξ
    assert.equal(r.tau.minManda, false);
    cerca(r.tau.tau, v.tauMPa, 1e-6, `τrd ${pos}`);
    cerca(r.Vc, v.FuSin, 1e-6, `sin armadura ${pos}`);
  }
});

test('EHE-08 con armadura: 0,75·τrd + 1,5·(d/s)·Asw·fyd (46.4.1), fyd ≤ 400', () => {
  const arm = { fi: 10, ramas: 12, sr: 150, a1: 100, nPer: 3 };
  const r = ehe.comprobar({ ...base, arm });
  const fyd = 400; // 500/1,15 = 434,8 → tope 400
  const Asw = 12 * PI * 25;
  const Fs = (1.5 * (210 / 150) * Asw * fyd) / 1000;
  cerca(r.Fs, Fs, 1e-6);
  cerca(r.Fcs, 0.75 * r.F0 + Fs, 1e-6);
  assert.equal(r.P.topada, true);
  // Zona exterior: un,ef a 2d del último perímetro (δ = 100 + 2·150)
  cerca(r.unEf, 2 * 600 + 2 * PI * (400 + 420), 1e-6);
  assert.ok(r.Vu <= r.Vcs + 1e-9 && r.Vu <= r.Vmax + 1e-9);
});

test('EHE-08 dimensionar: bielas rotas, sin armadura y con armadura (y la tabla cumple al comprobar)', () => {
  assert.equal(ehe.dimensionar(base, 5000).caso, 'biela');
  assert.equal(ehe.dimensionar(base, 100).caso, 'sin');
  const d = ehe.dimensionar(base, 560);
  assert.equal(d.caso, 'calculo');
  assert.ok(d.AswNec > 0 && d.nPer >= 1);
  for (const f of d.tabla) {
    const c = ehe.comprobar({ ...base, VEd: 560, arm: { fi: f.fi, ramas: f.ramas, sr: d.sr, a1: d.a1, nPer: d.nPer } });
    assert.ok(c.Vcs >= 560 - 1e-6, `ø${f.fi} cercos`);
    assert.ok(c.Vext >= 560 - 1e-6, `ø${f.fi} zona exterior`);
    assert.ok(f.ramas >= 4 && f.ramas >= d.nMinSt);
  }
});

test('EC-2 2004: fywd,ef, vRd,máx con ν del AN, uout,ef y armadura mínima (9.11)', () => {
  const P = ec2.parametros(base);
  cerca(P.fywdEf, 250 + 0.25 * 210, 1e-9);
  cerca(P.nu, 0.6 * (1 - 30 / 250), 1e-12);
  const arm = { fi: 10, ramas: 12, sr: 150, a1: 100, nPer: 3 };
  const r = ec2.comprobar({ ...base, arm });
  cerca(r.Fs, (1.5 * (210 / 150) * 12 * PI * 25 * 302.5) / 1000, 1e-6);
  // uout,ef con k = 2: perímetro a δ_último + 2d
  cerca(r.uOutEf, 2 * 600 + 2 * PI * (400 + 420), 1e-6);
  const poca = ec2.comprobar({ ...base, arm: { ...arm, ramas: 2 } });
  assert.equal(poca.minima.ok, false);
  const d = ec2.dimensionar(base, 560);
  assert.equal(d.caso, 'calculo');
  assert.ok(d.nPer >= 2);
  for (const f of d.tabla) {
    const c = ec2.comprobar({ ...base, VEd: 560, arm: { fi: f.fi, ramas: f.ramas, sr: d.sr, a1: d.a1, nPer: d.nPer } });
    assert.ok(c.Vcs >= 560 - 1e-6 && c.Vext >= 560 - 1e-6 && c.minima.ok, `ø${f.fi}`);
  }
});

test('EC-2 2023: ηc, ηs ≤ 0,8, ηsys, máximo y zona exterior; la tabla de dimensionado cumple', () => {
  const arm = { fi: 10, ramas: 12, sr: 150, a1: 100, nPer: 3 };
  const r = ec23.comprobar({ ...base, arm });
  cerca(r.etaC, r.s.VRdc / (1.15 * 400), 1e-9);
  assert.ok(r.etaS <= 0.8 + 1e-12);
  cerca(r.s.etaSys, Math.max(1, 0.5 + 0.63 * Math.pow(1200 / 210, 0.25)), 1e-9);
  assert.ok(r.Vu <= r.s.VRdMax / 1.15 + 1e-9);
  assert.ok(r.Vu >= r.Vc - 1e-9, 'la armadura nunca baja de la carga sin armadura');
  // Más ramas, más carga última (hasta el máximo)
  const menos = ec23.comprobar({ ...base, arm: { ...arm, ramas: 4 } });
  assert.ok(menos.Vu <= r.Vu + 1e-9);
  assert.equal(ec23.dimensionar(base, 5000).caso, 'biela');
  assert.equal(ec23.dimensionar(base, 100).caso, 'sin');
  const d = ec23.dimensionar(base, 380);
  assert.equal(d.caso, 'calculo');
  for (const f of d.tabla) {
    assert.ok(f.ok, `ø${f.fi}`);
    const c = ec23.comprobar({ ...base, VEd: 380, arm: { fi: f.fi, ramas: f.ramas, sr: d.sr, a1: d.a1, nPer: f.nPer } });
    assert.ok(c.Vu >= 380 - 1e-6, `ø${f.fi}: Vu ${c.Vu} (${c.manda})`);
  }
});

test('el despachador elige el núcleo por la norma del proyecto', () => {
  assert.equal(nucleo('EHE-08').id, 'EHE-08');
  assert.equal(nucleo('EHE-98').id, 'EHE-08');
  assert.equal(nucleo('EC2-2004').id, 'EC2-2004');
  assert.equal(nucleo('EC2-2023').id, 'EC2-2023');
  assert.equal(nucleo('otra'), null);
});

test('los seis tipos de pilar dan resultados finitos y positivos en las tres normas', () => {
  for (const n of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    for (const x of TIPOS) {
      const N = nucleo(n);
      const r = N.comprobar({ ...x, arm: { fi: 10, ramas: 8, sr: 150, a1: 100, nPer: 2 } });
      assert.ok(r.Vu > 0 && Number.isFinite(r.Vu), `${n} ${x.tipo} ${x.pos}`);
      assert.ok(perimetroCara(x, n, 210) > 0);
    }
  }
});

test('σ\'cd limitada a 0,30·fcd ≤ 12 MPa en la EHE-08', () => {
  const P = ehe.parametros({ ...base, sigCd: 20 });
  cerca(P.sigCdLim, 0.3 * 20, 1e-9);
  assert.ok(ehe.comprobar({ ...base, sigCd: 20, sinArmadura: true }).avisos.some((a) => a.clave === 'pun.av.sigCd'));
});

test('datos inválidos lanzan errores con clave', () => {
  assert.throws(() => ehe.comprobar({ ...base, c1: 0 }), (e) => e.clave === 'pun.errPilar');
  assert.throws(() => ehe.comprobar({ ...base, d: 0 }), (e) => e.clave === 'pun.errD');
  assert.throws(() => ehe.comprobar({ ...base, fck: 120 }), (e) => e.clave === 'pun.errFck');
  assert.throws(() => ehe.dimensionar(base, 0), (e) => e.clave === 'pun.errVEd');
});
