import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { comprobar, dimensionar, cotOptimo, coefK, coefBeta, cotThetaE, sepMaxima, AswSDe, FYD_TOPE } from '../src/norma/cortante/ehe08.js';
import { tt1 } from './ref31/tt1.js';

const cerca = (a, b, tol = 0.06) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

// Viga del ejemplo del plan (§3): 300 × 550, d = 500, HA-30, B 500 S, ρl = 1 %, cercos Ø8 de 2 ramas a 200 mm
const base = {
  fck: 30, fykCercos: 500, fykLong: 500, b0: 300, d: 500, Ac: 300 * 550, Asl: 0.01 * 300 * 500, NEd: 0,
  cotTheta: 1, alfa: 90, AswS: AswSDe(8, 2, 200),
};

test('Sin armadura: ejemplo de la viga 30 × 50, ρ = 1 %: 91,3 kN (el mínimo, 85,7, no manda)', () => {
  const r = comprobar({ ...base, sinArmadura: true });
  cerca(r.Vu2, 91.3, 0.1);
  assert.equal(r.minManda, false);
  cerca(r.VcuMin, 85.7, 0.1);
});

test('Sin armadura con ρl = 5 ‰ manda el mínimo de Vu2: 85,7 kN', () => {
  const r = comprobar({ ...base, Asl: 0.005 * 300 * 500, sinArmadura: true });
  assert.equal(r.minManda, true);
  cerca(r.Vu2, 85.7, 0.1);
});

test('Con armadura (fyd topado a 400): cotθ 1 → 90 + 85,7; cotθ 1,5 → 136 + 85,7 (el mínimo no lleva β); cotθ 2 → 181 + 85,7', () => {
  const v = (c) => comprobar({ ...base, cotTheta: c });
  const a = v(1);
  cerca(a.Vsu, 90.5, 0.1); cerca(a.Vcu, 85.7, 0.1); cerca(a.Vu2, 176.2, 0.2);
  const b = v(1.5);
  cerca(b.Vsu, 135.7, 0.1); cerca(b.Vcu, 85.7, 0.1); cerca(b.beta, 0.5, 1e-9);
  const c = v(2);
  cerca(c.Vsu, 181, 0.1); cerca(c.Vcu, 85.7, 0.1);
  assert.equal(c.P.topada, true);
});

test('Vu1 con θ = 45°, α = 90° y sin axil: 0,30·fcd·b0·d', () => {
  const r = comprobar(base);
  cerca(r.Vu1, 0.3 * 20 * 300 * 500 / 1000, 1e-6); // 900 kN
});

test('Contraste con el puerto de TT1 del 3.1 (N = 0, fck ≤ 50): Vu1, Vsu y β idénticos; Vcu solo difiere por el mínimo', () => {
  for (const cotTheta of [0.5, 0.75, 1, 1.5, 2]) {
    const theta = (Math.atan(1 / cotTheta) * 180) / Math.PI;
    const n = comprobar({ ...base, cotTheta });
    // El 3.1 limitaba ρ a 0,02 y fyd a 400 MPa (igual que aquí); ξ del 3.1 es 1 + √(0,2/d) con d en m (lo mismo que 200/d en mm)
    const r = tt1({ fck: 30, b0: 0.3, d: 0.5, rho: 0.01, Nd: 0, Ac: 0.3 * 0.55, sy: 0, tetaDeg: theta, alfaDeg: 90, A: base.AswS * 1e-3, fyd: 400 });
    cerca(n.Vu1, r.Vu1, 0.01);
    cerca(n.Vsu, r.Vsu, 0.01);
    cerca(n.beta, r.beta, 1e-9);
    // El 3.1 no tiene mínimo: con armadura, Vcu(EHE-08) = máx(Vcu(3.1), mínimo·β)
    assert.ok(n.Vcu >= r.Vcu - 1e-9);
    cerca(n.VcuConc, r.Vcu, 0.01);
  }
});

test('K por tramos (44.2.3.1) con la compresión positiva', () => {
  const f = 20;
  assert.equal(coefK(0, f), 1);
  assert.equal(coefK(-3, f), 1); // tracción: sin axil de compresión
  cerca(coefK(2, f), 1.1, 1e-12);
  cerca(coefK(5, f), 1.25, 1e-12);
  cerca(coefK(8, f), 1.25, 1e-12);
  cerca(coefK(15, f), 2.5 * (1 - 0.75), 1e-12);
  assert.equal(coefK(25, f), 0);
});

test('β y θe simplificado (44.2.3.2.2)', () => {
  cerca(cotThetaE(2.9, 0, 0), 1, 1e-12);
  // Compresión de 4 MPa: cotθe = √(1 + 4/fctm)… acotado a 2
  assert.ok(cotThetaE(2.9, 4, 0) <= 2 + 1e-12);
  cerca(coefBeta(0.5, 1), 0, 1e-12);
  cerca(coefBeta(1, 1), 1, 1e-12);
  cerca(coefBeta(1.5, 1), 0.5, 1e-12);
  cerca(coefBeta(2, 1), 0, 1e-12);
  assert.equal(coefBeta(2, 2), 1); // 0/0 en el extremo: vale 1 en el propio cotθe
});

test('Axil de compresión: sube K, Vcu y θe; σ\'cd se topa a 0,30 fcd', () => {
  const sin = comprobar(base);
  const con = comprobar({ ...base, NEd: 300 });
  cerca(con.P.sigCd, 300000 / (300 * 550), 1e-9);
  assert.ok(con.Vu1 > sin.Vu1 && con.VcuConc / con.beta > sin.VcuConc / sin.beta && con.cotE > sin.cotE);
  const mucho = comprobar({ ...base, NEd: 3000 });
  cerca(mucho.P.sigCdLim, 0.3 * 20, 1e-9);
  assert.ok(mucho.avisos.some((a) => a.clave === 'cor.av.sigCd'));
});

test('Armadura comprimida A\'s resta en σ\'cd (pilares)', () => {
  const a = comprobar({ ...base, NEd: 1000 });
  const b = comprobar({ ...base, NEd: 1000, Asc: 1200 });
  cerca(a.P.sigCd - b.P.sigCd, 1200 * Math.min(500 / 1.15, FYD_TOPE) / (300 * 550), 1e-9);
});

test('A\'s no da σ\'cd negativo con axil pequeño ni descuenta con tracción', () => {
  assert.equal(comprobar({ ...base, NEd: 100, Asc: 1200 }).P.sigCd, 0);
  assert.equal(comprobar({ ...base, NEd: 0, Asc: 1200 }).P.sigCd, 0);
  cerca(comprobar({ ...base, NEd: -100, Asc: 1200 }).P.sigCd, -100000 / (300 * 550), 1e-9);
});

test('ρl se topa a 0,02 y ξ a 2', () => {
  const r = comprobar({ ...base, Asl: 0.05 * 300 * 500 });
  assert.equal(r.P.rho, 0.02);
  assert.equal(r.P.rhoTopado, true);
  assert.ok(r.avisos.some((a) => a.clave === 'cor.av.rho'));
  assert.equal(comprobar({ ...base, d: 100 }).P.xi, 2);
});

test('Cercos circulares: Vsu × 0,85', () => {
  const a = comprobar(base);
  const b = comprobar({ ...base, circular: true });
  cerca(b.Vsu, a.Vsu * 0.85, 1e-9);
});

test('ΔT y decalaje (44.2.3.4.2): ΔT = Vrd·cotθ − Vsu/2·(cotθ + cotα)', () => {
  const r = comprobar({ ...base, VEd: 150, cotTheta: 1.5 });
  cerca(r.long.dT, 150 * 1.5 - (r.Vsu / 2) * 1.5, 1e-9);
  // Sin cercos y θ = 45°: decalaje clásico sd = z
  const s = comprobar({ ...base, VEd: 80, sinArmadura: true, cotTheta: 1 });
  cerca(s.long.sd, 0.9 * 500, 1e-9);
});

test('Armadura mínima: fct,m/7,5·b0 (44.2.3.4.1)', () => {
  const r = comprobar({ ...base, AswS: AswSDe(6, 2, 300) });
  const fctm = 0.3 * Math.pow(30, 2 / 3);
  cerca(r.minima.AswSMin, (fctm / 7.5 * 300) / 400, 1e-9);
  assert.equal(r.minima.ok, false);
  assert.ok(r.avisos.some((a) => a.clave === 'cor.av.minima'));
});

test('Separación st (44.2.3.4.1)', () => {
  cerca(sepMaxima(100, 900, 500), 375, 1e-9); // 100 ≤ 900/5 → min(0,75·500; 600)
  cerca(sepMaxima(500, 900, 500), 300, 1e-9); // 500 ≤ 600 → min(0,60·500; 450) = 300 (0,60·500 = 300)
  cerca(sepMaxima(700, 900, 500), 150, 1e-9); // > 2/3 Vu1 → min(0,30·500; 300)
  cerca(sepMaxima(100, 900, 500, 45), 750 > 600 ? 600 : 750, 1e-9);
});

test('Dimensionamiento: V = 250 kN, cotθ 1 → Asw/s necesaria y tabla de cercos Ø × s de 50 en 50', () => {
  const { AswS, ...sin } = base;
  const r = dimensionar(sin, 250, { diametros: [8, 10, 12, 16, 20] });
  assert.equal(r.caso, 'calculo');
  // Vcu = 85,7 (mínimo), Vsu = 164,3 → Asw/s = 164,3/(450·400·1·1/1000) = 0,913 mm²/mm
  cerca(r.AswSNec, (250 - 85.7) / (0.9 * 500 * 400 / 1000), 0.002);
  for (const f of r.tabla.filter((x) => x.s)) {
    assert.equal(f.s % 50, 0);
    assert.ok(f.s <= 300);
    assert.ok(f.AswS >= r.AswS - 1e-9);
    assert.ok(f.Vu >= 250 - 0.5);
  }
  // Ø8 de 2 ramas (100,5 mm²) no llega con s = 50 → 2,01 ≥ 0,913 con s ≤ 100,5/0,913 = 110 → 100
  assert.equal(r.tabla[0].s, 100);
});

test('Dimensionamiento: V pequeña → armadura mínima; V > Vu1 → aumentar sección', () => {
  const { AswS, ...sin } = base;
  const m = dimensionar(sin, 80);
  assert.equal(m.caso, 'minima');
  assert.equal(m.sinArmaduraBasta, true);
  cerca(m.AswS, m.AswSMin, 1e-12);
  const g = dimensionar(sin, 1000);
  assert.equal(g.caso, 'biela');
  assert.equal(g.tabla, undefined);
});

test('cotθ óptimo: con armadura dada, el que maximiza min(Vu1, Vu2)', () => {
  const c = cotOptimo({ ...base }, { VEd: 200 });
  const v = (k) => comprobar({ ...base, cotTheta: k, VEd: 200 }).Vu;
  for (const k of [0.5, 0.8, 1, 1.5, 2]) assert.ok(v(c) >= v(k) - 1e-6);
  // Dimensionando: el que pide menos armadura
  const { AswS, ...sin } = base;
  const cd = cotOptimo(sin, { VEd: 250, dim: true });
  const nec = (k) => dimensionar({ ...sin, cotTheta: k }, 250).AswS;
  for (const k of [0.5, 1, 1.5, 2]) assert.ok(nec(cd) <= nec(k) + 1e-9);
});

test('Casos de analisis/cortante/casos-ehe31.csv: entradas leídas y calculadas sin error', () => {
  const txt = readFileSync(new URL('../../analisis/cortante/casos-ehe31.csv', import.meta.url), 'utf8').replace(/^﻿/, '');
  const filas = txt.trim().split(/\r?\n/).slice(1).map((l) => l.split(';'));
  assert.equal(filas.length, 10);
  for (const f of filas) {
    const [caso, modo, , b0, h, d, , fck, , ro, Nd, sy, teta, alfa, fi, s, ramas, Vd] = f;
    const geo = { fck: +fck, fykCercos: 500, fykLong: 500, b0: +b0 * 1000, d: +d * 1000, Ac: +b0 * +h * 1e6, Asl: (+ro / 1000) * +b0 * 1000 * +d * 1000, NEd: +Nd, sigY: -+sy, alfa: +alfa };
    const cotTheta = 1 / Math.tan((+teta * Math.PI) / 180);
    if (modo.startsWith('dimension')) {
      const r = dimensionar({ ...geo, cotTheta }, +Vd);
      assert.ok(['calculo', 'minima', 'biela'].includes(r.caso), `caso ${caso}`);
    } else {
      const r = comprobar({ ...geo, cotTheta, AswS: fi ? AswSDe(+fi, +ramas, +s * 1000) : 0, sinArmadura: modo.includes('sin') });
      assert.ok(r.Vu > 0, `caso ${caso}`);
    }
  }
});
