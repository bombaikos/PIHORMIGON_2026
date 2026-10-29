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

// ---------- EC-2 2004 + AN ----------
import * as ec2 from '../src/norma/cortante/ec2-2004.js';
import { nucleo } from '../src/norma/cortante/index.js';

test('EC-2: el despachador da EHE-08 (también para EHE-98), EC-2 2004 y EC-2 2023', () => {
  assert.equal(nucleo('EHE-98').id, 'EHE-08');
  assert.equal(nucleo('EC2-2004').id, 'EC2-2004');
  assert.equal(nucleo('EC2-2023').id, 'EC2-2023');
  assert.equal(nucleo('otra'), null);
});

test('EC-2: viga del plan §3 sin armadura: V_Rd,c = 91,3 kN (igual que la EHE-08)', () => {
  const r = ec2.comprobar({ ...base, sinArmadura: true });
  cerca(r.Vu, 91.3, 0.1);
  assert.equal(r.minManda, false);
  const bajo = ec2.comprobar({ ...base, Asl: 0.005 * 300 * 500, sinArmadura: true });
  assert.equal(bajo.minManda, true);
  cerca(bajo.Vu, 85.7, 0.1);
});

test('EC-2: con cercos solo suma la celosía (plan §3): cotθ 1 → 98, 1,5 → 148, 2 → 197 kN; biela 713 kN con ν1 = 0,528', () => {
  const v = (c) => ec2.comprobar({ ...base, cotTheta: c });
  cerca(v(1).VRds, 98.4, 0.1);
  cerca(v(1.5).VRds, 147.5, 0.1);
  cerca(v(2).VRds, 196.7, 0.1);
  cerca(v(1).VRdMax, 712.8, 0.1);
  assert.equal(v(1).Vcu, 0);
  cerca(v(1).Vu, 98.4, 0.1);
});

test('EC-2: ν1 baja a 0,6 solo si la tensión de los cercos es menor que 0,8 fyk', () => {
  assert.equal(ec2.nu1De(30, 434.8, 500).toFixed(3), '0.528');
  assert.equal(ec2.nu1De(30, 300, 500), 0.6);
  assert.equal(ec2.nu1De(70, 300, 500), 0.55);
  // Con VEd pequeño la tensión pedida a los cercos baja de 400 MPa
  const r = ec2.comprobar({ ...base, cotTheta: 2, VEd: 150 });
  assert.equal(r.nu1, 0.6);
});

test('EC-2: armadura mínima ρw,mín = fctm/(7,5 fyk) del AN y separaciones como 9.2.2', () => {
  const r = ec2.comprobar({ ...base, VEd: 100 });
  cerca(r.minima.rhoWMin, (0.3 * Math.pow(30, 2 / 3)) / (7.5 * 500), 1e-6);
  cerca(r.minima.AswSMin, r.minima.rhoWMin * 300, 1e-9);
  assert.equal(r.sepTrans, 500);
  assert.equal(r.sep, sepMaxima(100, r.VRdMax, 500, 90));
});

test('EC-2: ΔFtd = 0,5·VEd·(cotθ − cotα) y decalaje al = z(cotθ − cotα)/2; sin cercos al = d', () => {
  const r = ec2.comprobar({ ...base, cotTheta: 2, VEd: 100 });
  cerca(r.long.dT, 100, 1e-9);
  cerca(r.long.sd, 450, 1e-9);
  const s = ec2.comprobar({ ...base, sinArmadura: true, VEd: 50 });
  assert.equal(s.long.sd, 500);
});

test('EC-2: dimensionar da la armadura de la celosía sin hormigón y una tabla Ø × s que cumple', () => {
  const { AswS, ...sin } = base;
  const r = ec2.dimensionar(sin, 250);
  assert.equal(r.caso, 'calculo');
  cerca(r.AswSNec, 250 / ((0.9 * 500 * (500 / 1.15)) / 1000), 1e-9);
  for (const f of r.tabla.filter((t) => t.s)) assert.ok(f.Vu >= 250 - 1e-6 || f.Vu >= 249, `ø${f.fi} s=${f.s}`);
  assert.equal(ec2.dimensionar(sin, 2000).caso, 'biela');
});

test('EC-2: el axil de compresión sube V_Rd,c y la tracción lo baja; σcp se limita a 0,2 fcd', () => {
  const v = (N) => ec2.comprobar({ ...base, NEd: N, sinArmadura: true }).Vu;
  assert.ok(v(300) > v(0) && v(-300) < v(0));
  const big = ec2.comprobar({ ...base, NEd: 5000, sinArmadura: true });
  assert.ok(big.avisos.some((a) => a.clave === 'cor.av.sigCp'));
  cerca(big.P.sigCpLim, 0.2 * 20, 1e-9);
});

test('EC-2: cotθ óptimo es el que maximiza min(VRd,s; VRd,máx)', () => {
  const c = ec2.cotOptimo({ ...base }, { VEd: 200 });
  const v = (k) => ec2.comprobar({ ...base, cotTheta: k, VEd: 200 }).Vu;
  for (const k of [0.5, 0.8, 1, 1.5, 2]) assert.ok(v(c) >= v(k) - 1e-6);
});

test('EC-2 y EHE-08 coinciden con cotθ = 2 y fyd igual (plan §3, lectura d)', () => {
  const e = comprobar({ ...base, fykCercos: 400 * 1.15, cotTheta: 2 });
  const c = ec2.comprobar({ ...base, fykCercos: 400 * 1.15, cotTheta: 2 });
  cerca(c.VRds, e.Vsu, 1e-6);
});

// ---------- EC-2 2023 (esfuerzos, z = 0,9 d, ν = 0,5) ----------
import * as e23 from '../src/norma/cortante/ec2-2023.js';

const b23 = { ...base, ductilidad: 'B', Dlower: 20 };

test('EC-2 2023: ddg = 16 + Dlower ≤ 40 mm; con fck > 60 se reduce por (60/fck)²', () => {
  assert.equal(e23.ddgDe(30, 20), 36);
  assert.equal(e23.ddgDe(30, 32), 40);
  cerca(e23.ddgDe(80, 20), 16 + 20 * (60 / 80) ** 2, 1e-9);
});

test('EC-2 2023: viga del plan §3 sin armadura: V_Rd,c = 82,3 kN (manda τRd,c, no τRdc,min = 74,8)', () => {
  const r = e23.comprobar({ ...b23, sinArmadura: true });
  cerca(r.Vu, 82.3, 0.1);
  assert.equal(r.minManda, false);
  cerca(r.VRdcMin, 74.8, 0.1);
  cerca(r.dEf, 500, 1e-9);
});

test('EC-2 2023: con ρl = 2 ‰ manda el mínimo τRdc,min', () => {
  const r = e23.comprobar({ ...b23, Asl: 0.002 * 300 * 500, sinArmadura: true });
  assert.equal(r.minManda, true);
  cerca(r.Vu, 74.8, 0.1);
});

test('EC-2 2023: con armadura (fywd = 434,8, sin tope): V_Rd,s = 98 / 148 / 197 kN con cotθ 1 / 1,5 / 2', () => {
  const v = (c) => e23.comprobar({ ...b23, cotTheta: c });
  cerca(v(1).VRds, 98.3, 0.1);
  cerca(v(1.5).VRds, 147.5, 0.1);
  cerca(v(2).VRds, 196.7, 0.1);
  assert.equal(v(1).Vcu, 0);
});

test('EC-2 2023: biela V_Rd,máx = 0,5 f_cd b_w z (cotθ + cotα)/(1 + cotθ²): 574 kN con cotθ = 1; manda si hay mucha armadura', () => {
  const r = e23.comprobar({ ...b23, AswS: 3 });
  cerca(r.VRdMax, 573.75, 0.01);
  assert.equal(r.mandaBiela, true);
  cerca(r.Vu, 573.75, 0.01);
  cerca(e23.comprobar({ ...b23, cotTheta: 2.5 }).VRdMax, (0.5 * 17 * 300 * 450 * 2.5) / 7.25 / 1000, 0.01);
});

test('EC-2 2023: cotθ fuera de 1 a 2,5 da error; el rango baja con la tracción y con la clase A', () => {
  assert.throws(() => e23.comprobar({ ...b23, cotTheta: 2.6 }));
  assert.throws(() => e23.comprobar({ ...b23, cotTheta: 0.9 }));
  assert.deepEqual(e23.rangoCot(b23, 100), { min: 1, max: 2.5 });
  cerca(e23.rangoCot({ ...b23, NEd: -100 }, 100).max, 2.4, 1e-9);
  cerca(e23.rangoCot({ ...b23, ductilidad: 'A' }, 100).max, 2.0, 1e-9);
  cerca(e23.rangoCot({ ...b23, NEd: -1000 }, 100).max, 1.5, 1e-9);
  cerca(e23.rangoCot({ ...b23, NEd: -3000 }, 100).max, 1, 1e-9);
  cerca(e23.rangoCot({ ...b23, alfa: 60 }, 100).min, Math.tan(Math.PI / 6), 1e-9);
});

test('EC-2 2023: armadura mínima ρw,mín = 0,08 √fck/fyk con −10 % (B) y −20 % (C)', () => {
  const m = (d) => e23.comprobar({ ...b23, ductilidad: d, AswS: 0.2 }).minima.AswSMin;
  cerca(m('A'), (0.08 * Math.sqrt(30) / 500) * 300, 1e-9);
  cerca(m('B'), 0.9 * (0.08 * Math.sqrt(30) / 500) * 300, 1e-9);
  cerca(m('C'), 0.8 * (0.08 * Math.sqrt(30) / 500) * 300, 1e-9);
  assert.equal(e23.comprobar({ ...b23, AswS: 0.2 }).minima.ok, false);
});

test('EC-2 2023: con MEd la esbeltez (av) y el axil (kvp) cambian V_Rd,c; sin MEd no se tienen en cuenta y se avisa', () => {
  const sin = e23.comprobar({ ...b23, NEd: 300, VEd: 100, sinArmadura: true });
  cerca(sin.Vu, 82.3, 0.1);
  assert.ok(sin.avisos.some((a) => a.clave === 'cor.av.sinMEd'));
  const av = Math.sqrt((1000 * 500) / 4);
  const tau = (dEf) => (0.66 / 1.4) * Math.cbrt(30 * 36 / dEf);
  const a = e23.comprobar({ ...b23, MEd: 100, VEd: 100, sinArmadura: true });
  cerca(a.acs, 1000, 1e-9);
  cerca(a.Vu, (tau(av) * 300 * 450) / 1000, 0.01);
  const c = e23.comprobar({ ...b23, MEd: 100, NEd: 300, VEd: 100, sinArmadura: true });
  cerca(c.kvp, 0.5, 1e-9);
  cerca(c.Vu, (tau(av * 0.5) * 300 * 450) / 1000, 0.01);
  assert.ok(c.Vu > a.Vu);
  const t = e23.comprobar({ ...b23, MEd: 100, NEd: -300, VEd: 100, sinArmadura: true });
  assert.ok(t.Vu < a.Vu);
});

test('EC-2 2023: acs ≥ 4d no reduce d (av = d); acs ≥ d aunque MEd/VEd sea menor', () => {
  cerca(e23.comprobar({ ...b23, MEd: 1000, VEd: 100, sinArmadura: true }).Vu, 82.3, 0.1);
  cerca(e23.comprobar({ ...b23, MEd: 10, VEd: 100, sinArmadura: true }).acs, 500, 1e-9);
});

test('EC-2 2023: armadura longitudinal N_Vd = V_Ed (cotθ − cotα), F_td con MEd y decalaje al = z (cotθ − cotα)/2', () => {
  const r = e23.comprobar({ ...b23, cotTheta: 2, VEd: 100, MEd: 90, NEd: 0 });
  cerca(r.long.NVd, 200, 1e-9);
  cerca(r.long.dT, 100, 1e-9); // ΔFtd = NVd/2
  cerca(r.long.Ftd, (90 * 1000) / 450 + 100, 1e-9);
  cerca(r.long.sd, 450, 1e-9);
  const i = e23.comprobar({ ...b23, cotTheta: 2, alfa: 45, VEd: 100 });
  cerca(i.long.NVd, 100, 1e-9);
  cerca(i.long.dT, 50, 1e-9);
  const sin = e23.comprobar({ ...b23, sinArmadura: true, VEd: 50 });
  assert.equal(sin.long.sd, 500);
});

test('EC-2 2023: separaciones de la Tabla 12.1: s ≤ 0,75 d (1 + cotα), entre ramas ≤ 0,75 d y ≤ 600 mm', () => {
  const r = e23.comprobar({ ...b23, VEd: 100 });
  cerca(r.sep, 375, 1e-9);
  cerca(r.sepTrans, 375, 1e-9);
  cerca(e23.comprobar({ ...b23, alfa: 45, cotTheta: 1, VEd: 100 }).sep, 750, 1e-9);
  assert.equal(e23.separaciones(1000).sepTrans, 600);
});

test('EC-2 2023: con cercos circulares la armadura cuenta × b_w/D_h', () => {
  const a = e23.comprobar({ ...b23, circular: true, Dh: 400 });
  const b = e23.comprobar({ ...b23 });
  cerca(a.VRds, b.VRds * 0.75, 1e-9);
  cerca(a.factorCirc, 0.75, 1e-12);
});

test('EC-2 2023: dimensionar y comprobar son coherentes; con cotθ = 2 la armadura necesaria es igual que en EC-2 2004', () => {
  const x = { ...b23, cotTheta: 2 };
  const d = e23.dimensionar(x, 150);
  assert.equal(d.caso, 'calculo');
  const c = e23.comprobar({ ...x, VEd: 150, AswS: d.AswSNec });
  cerca(c.VRds, 150, 1e-6);
  cerca(d.AswSNec, ec2.dimensionar(x, 150).AswSNec, 1e-9);
  assert.ok(d.tabla.every((f) => !f.s || f.Vu >= 150 - 1e-6));
  assert.equal(e23.dimensionar(x, 90).caso, 'minima');
  assert.equal(e23.dimensionar(x, 500).caso, 'biela');
});

test('EC-2 2023: θ óptimo — comprobar: iguala cercos y biela; dimensionar: el mayor cotθ posible', () => {
  const x = { ...b23, AswS: 0.5 };
  const c = e23.cotOptimo(x, { VEd: 150 });
  const v = (k) => e23.comprobar({ ...x, cotTheta: k, VEd: 150 }).Vu;
  assert.ok(v(c) >= v(1) - 1e-9 && v(c) >= v(2.5) - 1e-9);
  assert.equal(e23.cotOptimo(b23, { VEd: 150, dim: true }), 2.5);
});

// ---------- Revisión EC-2 (29/10): defectos D1-D3, ΔFtd y Asl de pilares ----------
import { proyectoNuevo, datosCortante } from '../src/io/proyecto.js';

test('D1: dimensionar con VEd ≤ resistencia sin armadura pide solo la mínima (EHE-08, EC-2 2004 y EC-2 2023)', () => {
  for (const [N, x] of [[ec2, { ...b23 }], [e23, { ...b23 }], [{ dimensionar }, { ...base }]]) {
    const d = N.dimensionar(x, 70);
    assert.equal(d.sinArmaduraBasta, true);
    assert.equal(d.caso, 'minima');
    assert.equal(d.AswSNec, 0);
    assert.equal(d.AswS, d.AswSMin);
    assert.ok(d.avisos.some((a) => a.clave === 'cor.av.bastaSinArm'));
    assert.ok(d.tabla.every((f) => !f.s || f.Vu >= 70 - 1e-6));
  }
  // Con más cortante que VRd,c vuelve a mandar el cálculo
  assert.equal(e23.dimensionar(b23, 100).caso, 'calculo');
});

test('D2: sin cercos se avisa si VEd supera el límite de biela (6.2.2(6) en 2004; VRd,máx con cotθ = 1 en 2023)', () => {
  const a = ec2.comprobar({ ...b23, sinArmadura: true, VEd: 900 });
  cerca(a.VmaxRef, 0.5 * 300 * 500 * 0.6 * (1 - 30 / 250) * 20 / 1000, 0.01);
  assert.ok(a.avisos.some((x) => x.clave === 'cor.av.sinBiela'));
  const b = e23.comprobar({ ...b23, sinArmadura: true, VEd: 900 });
  cerca(b.VmaxRef, 573.75, 0.01);
  assert.ok(b.avisos.some((x) => x.clave === 'cor.av.sinBiela'));
  assert.ok(!e23.comprobar({ ...b23, sinArmadura: true, VEd: 50 }).avisos.some((x) => x.clave === 'cor.av.sinBiela'));
});

test('D3: sin cercos y con VEd ≤ VRd,c se avisa de la armadura mínima en vigas (no en pilares); en 2023, también con d > 500', () => {
  const tiene = (r, k) => r.avisos.some((x) => x.clave === k);
  assert.ok(tiene(ec2.comprobar({ ...b23, sinArmadura: true, VEd: 50 }), 'cor.av.minObligatoria'));
  assert.ok(!tiene(ec2.comprobar({ ...b23, sinArmadura: true, VEd: 50, viga: false }), 'cor.av.minObligatoria'));
  assert.ok(!tiene(ec2.comprobar({ ...b23, sinArmadura: true, VEd: 95 }), 'cor.av.minObligatoria'), 'VEd > VRd,c: ya no cumple');
  const r = e23.comprobar({ ...b23, sinArmadura: true, VEd: 50 });
  assert.ok(tiene(r, 'cor.av.minObligatoria'));
  assert.ok(!tiene(r, 'cor.av.d500'));
  assert.ok(tiene(e23.comprobar({ ...b23, d: 600, Ac: 300 * 650, Asl: 0.01 * 300 * 600, sinArmadura: true, VEd: 50 }), 'cor.av.d500'));
  assert.ok(!tiene(e23.comprobar({ ...b23, sinArmadura: false, VEd: 50 }), 'cor.av.minObligatoria'));
});

test('Asl de pilares (criterio propio): una cara en pilar rectangular (según el lado del cortante), la mitad de las barras en circular', () => {
  const p = proyectoNuevo();
  const pil = p.secciones.find((s) => s.forma === 'pilar');
  if (pil) {
    const arm = pil.armado.find((a) => a.tipo === 'perimetral');
    arm.nx = 4; arm.ny = 3; arm.fi = 20;
    const A = Math.PI * 0.02 ** 2 / 4;
    cerca(datosCortante(p, pil, { dir: 'h' }).Asl, 4 * A, 1e-12);
    cerca(datosCortante(p, pil, { dir: 'b' }).Asl, 3 * A, 1e-12);
  }
  const circ = p.secciones.find((s) => s.forma === 'circular');
  if (circ) {
    const d = datosCortante(p, circ);
    cerca(d.Asl, d.Asc / 2, 1e-12);
    assert.ok(d.Asl > 0);
  }
});

test('EC-2 2023: ktc (0,85 o 1,00) solo cambia fcd y V_Rd,máx; el material lo trae con 1,00 por defecto', async () => {
  const x = { fck: 30, fykCercos: 500, b0: 300, d: 455, Ac: 150000, Asl: 1005, VEd: 50, cotTheta: 1, AswS: 2.16 };
  const a = e23.comprobar({ ...x, ktc: 0.85 });
  const b = e23.comprobar({ ...x, ktc: 1 });
  cerca(b.P.fcd / a.P.fcd, 1 / 0.85, 1e-9);
  cerca(b.Vu1 / a.Vu1, 1 / 0.85, 1e-9);
  cerca(b.Vsu, a.Vsu, 1e-9);
  const { proyectoNuevo } = await import('../src/io/proyecto.js');
  const p = proyectoNuevo();
  p.norma = 'EC2-2023';
  const { datosCortante } = await import('../src/io/proyecto.js');
  assert.equal(datosCortante(p, p.secciones[0]).ktc, 1);
});
