import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fluencia, retraccion, evolucionEdad, kh, T_FINAL_2023, edadFinal } from '../src/core/reologia.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≉ ${b} (±${tol})`);
const T = [14, 30, 90, 365, 1825, 10000];

test('EHE-08 · retracción: tablas 39.7.c y 39.7.d (origen del secado a los 7 días)', () => {
  const caso = (fck, HR, h0, esperado) => T.forEach((t, i) => cerca(retraccion('EHE-08', { fck, HR, h0, t, ts: 7 }).total * 1e6, esperado[i], 1, `fck ${fck} HR ${HR} e ${h0} t ${t}`));
  caso(30, 50, 50, [-186, -332, -455, -513, -529, -532]);
  caso(30, 50, 600, [-30, -46, -84, -177, -305, -369]);
  caso(30, 70, 600, [-29, -43, -74, -145, -242, -289]);
  caso(30, 90, 50, [-76, -126, -170, -193, -198, -199]);
  caso(70, 50, 50, [-178, -285, -382, -434, -446, -448]);
  caso(70, 90, 50, [-110, -157, -206, -236, -242, -242]);
  caso(70, 90, 600, [-80, -102, -136, -171, -199, -211]);
});

test('EHE-08 · fluencia: tablas 39.8.a y 39.8.b (φ a tiempo infinito)', () => {
  const t0s = [1, 7, 14, 28, 60, 90, 365, 1800];
  const cols = [[50, 50], [50, 600], [70, 50], [70, 600], [90, 50], [90, 600]];
  const a = [[5.6, 3.8, 4.3, 3.3, 3.1, 2.7], [3.9, 2.7, 3.0, 2.3, 2.1, 1.9], [3.4, 2.3, 2.6, 2.0, 1.9, 1.7], [3.0, 2.0, 2.3, 1.7, 1.6, 1.5],
    [2.6, 1.8, 2.0, 1.5, 1.4, 1.3], [2.4, 1.6, 1.9, 1.4, 1.3, 1.2], [1.8, 1.2, 1.4, 1.1, 1.0, 0.9], [1.3, 0.9, 1.0, 0.8, 0.7, 0.7]];
  const b = [[2.6, 2.0, 2.2, 1.8, 1.7, 1.6], [1.8, 1.4, 1.5, 1.2, 1.2, 1.1], [1.6, 1.2, 1.3, 1.1, 1.0, 1.0], [1.4, 1.1, 1.2, 1.0, 0.9, 0.8],
    [1.2, 0.9, 1.0, 0.8, 0.8, 0.7], [1.1, 0.8, 0.9, 0.8, 0.7, 0.7], [0.9, 0.6, 0.7, 0.6, 0.6, 0.5], [0.6, 0.5, 0.5, 0.4, 0.4, 0.4]];
  for (const [fck, tabla] of [[30, a], [70, b]]) {
    t0s.forEach((t0, i) => cols.forEach(([HR, h0], j) => cerca(fluencia('EHE-08', { fck, HR, h0, t0 }).phi, tabla[i][j], 0.11, `fck ${fck} t0 ${t0} HR ${HR} e ${h0}`)));
  }
});

test('EC-2 2004 · retracción por secado: tabla 3.2 (εcd,0, cemento N) y kh de la tabla 3.3', () => {
  // 20/25 con HR 40, 60, 80, 90 y 40/50, 60/75, 80/95, 90/105 con HR 60 y 80 (en ‰)
  const casos = [[20, 40, 0.58], [20, 60, 0.49], [20, 80, 0.30], [20, 90, 0.17], [40, 60, 0.38], [40, 80, 0.24], [60, 60, 0.30], [80, 60, 0.24], [90, 80, 0.13]];
  for (const [fck, HR, e] of casos) cerca(-retraccion('EC2-2004', { fck, HR, h0: 100 }).secado * 1000, e, 0.015, `fck ${fck} HR ${HR}`);
  assert.deepEqual([100, 200, 300, 500, 800].map(kh), [1, 0.85, 0.75, 0.7, 0.7]);
  cerca(kh(250), 0.8, 1e-9);
});

test('EC-2 2004 y EHE-08 comparten modelo: misma fluencia y retracción con cemento normal', () => {
  const o = { fck: 25, HR: 70, h0: 200, t0: 28 };
  cerca(fluencia('EC2-2004', o).phi, fluencia('EHE-08', o).phi, 1e-12);
  cerca(retraccion('EC2-2004', { fck: 25, HR: 70, h0: 200, t: 365, ts: 7 }).total, retraccion('EHE-08', { fck: 25, HR: 70, h0: 200, t: 365, ts: 7 }).total, 1e-12);
  // cemento de endurecimiento rápido: el EC-2 retrasa la edad de carga equivalente (B.9); la EHE-08 no
  assert.ok(fluencia('EC2-2004', { ...o, cemento: 'R' }).phi < fluencia('EC2-2004', o).phi);
  cerca(fluencia('EHE-08', { ...o, cemento: 'R' }).phi, fluencia('EHE-08', o).phi, 1e-12);
});

test('EC-2 2023 · fluencia a 50 años: tabla 5.2 (fck = 35, las tres clases de cemento)', () => {
  // Fila de la tabla: edad de carga de CS, CN y CR; φ para hn = 100, 200, 500, 1000 con HR 50 % y con HR 80 %.
  // La tabla es indicativa (cada fila reúne edades «equivalentes» de los tres cementos): tolerancia 0,15
  const filas = [
    [{ S: 3, N: 1, R: 1 }, [4.2, 3.8, 3.4, 3.1], [3.0, 2.8, 2.6, 2.5]],
    [{ S: 10, N: 7, R: 3 }, [3.1, 2.8, 2.5, 2.3], [2.2, 2.1, 2.0, 1.9]],
    [{ S: 32, N: 28, R: 23 }, [2.4, 2.2, 1.9, 1.8], [1.7, 1.6, 1.6, 1.5]],
    [{ S: 91, N: 91, R: 91 }, [1.9, 1.7, 1.5, 1.4], [1.4, 1.3, 1.2, 1.2]],
    [{ S: 365, N: 365, R: 365 }, [1.4, 1.3, 1.1, 1.0], [1.0, 0.9, 0.9, 0.8]],
  ];
  for (const [t0s, seco, humedo] of filas) {
    for (const cemento of ['S', 'N', 'R']) {
      const t0 = t0s[cemento];
      if (cemento === 'R' && t0 === 1) continue; // el equivalente de CN 1 día sería 0,3 días, por debajo del mínimo de 1 día (B.3(3))
      [100, 200, 500, 1000].forEach((h0, i) => {
        cerca(fluencia('EC2-2023', { fck: 35, HR: 50, h0, t0, t: T_FINAL_2023 + t0, cemento }).phi, seco[i], 0.15, `seco ${cemento} t0 ${t0} hn ${h0}`);
        cerca(fluencia('EC2-2023', { fck: 35, HR: 80, h0, t0, t: T_FINAL_2023 + t0, cemento }).phi, humedo[i], 0.15, `húmedo ${cemento} t0 ${t0} hn ${h0}`);
      });
    }
  }
});

test('EC-2 2023 · retracción a 50 años: tabla 5.3', () => {
  const filas = [
    ['N', 35, 50, [0.60, 0.59, 0.51, 0.39]], ['N', 20, 50, [0.67, 0.65, 0.56, 0.41]], ['N', 50, 50, [0.55, 0.54, 0.48, 0.37]],
    ['N', 80, 80, [0.30, 0.30, 0.28, 0.25]], ['S', 35, 80, [0.31, 0.31, 0.27, 0.22]], ['R', 50, 50, [0.67, 0.66, 0.58, 0.44]], ['R', 80, 80, [0.31, 0.30, 0.28, 0.25]],
  ];
  for (const [cemento, fck, HR, esperado] of filas) {
    [100, 200, 500, 1000].forEach((h0, i) => cerca(-retraccion('EC2-2023', { fck, HR, h0, t: T_FINAL_2023, ts: 1, cemento }).total * 1000, esperado[i], 0.011, `${cemento} C${fck} HR ${HR} hn ${h0}`));
  }
});

test('edad: βcc(28) = 1 y crecimiento monótono; el EC-2 2023 usa sus propios sC', () => {
  const base = { fck: 30, fcm: 38, fctm: 2.9, Ecm: 33000, cemento: 'N' };
  for (const n of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    cerca(evolucionEdad(n, { ...base, t: 28 }).beta, 1, 1e-12, n);
    assert.ok(evolucionEdad(n, { ...base, t: 7 }).fcm < evolucionEdad(n, { ...base, t: 28 }).fcm);
    assert.ok(evolucionEdad(n, { ...base, t: 90 }).Ecm > base.Ecm);
  }
  // EC-2 2004, ecuación (3.2): s = 0,25 → βcc(7) = exp(0,25·(1 − √4))
  cerca(evolucionEdad('EC2-2004', { ...base, t: 7 }).beta, Math.exp(0.25 * (1 - 2)), 1e-12);
  // B.2: sC = 0,5 (CN, fck ≤ 35); fctm(t) = βcc^0,6 · fctm
  const e = evolucionEdad('EC2-2023', { ...base, t: 7 });
  cerca(e.beta, Math.exp(0.5 * (1 - 2)), 1e-12);
  cerca(e.fctm, Math.pow(e.beta, 0.6) * base.fctm, 1e-12);
  assert.equal(edadFinal('EC2-2023'), T_FINAL_2023);
  assert.equal(edadFinal('EHE-08'), Infinity);
});
