import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero, epsPlastificacion } from '../src/core/materiales.js';
import { seccionRectangular } from '../src/core/flexion.js';
import { estadoUltimo, esfuerzos, centroHomogeneizado } from '../src/core/seccion.js';
import { curvaMomentoCurvatura } from '../src/core/momentoCurvatura.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const H = hormigon({ fck: 25 });
const A = acero({ fyk: 500 });
const rect = (Ainf, Asup) => seccionRectangular({ b: 0.3, h: 0.5, rinf: 0.05, rsup: 0.05, Ainf, Asup, hormigon: H, acero: A });

test('M-κ: termina en el estado último y crece sin saltos con axil nulo', () => {
  const sec = rect(942e-6, 226e-6);
  const r = curvaMomentoCurvatura(sec, 0, { signo: 1 });
  assert.ok(r.converge);
  const u = estadoUltimo(sec, 0, { signo: 1 });
  cerca(r.ultimo.M, u.M, 1e-6, 'Mu');
  cerca(r.ultimo.kappa, u.kappa, 1e-12, 'κu');
  cerca(r.puntos[0].M, 0, 1e-6, 'M(0)');
  for (let i = 1; i < r.puntos.length; i++) assert.ok(r.puntos[i].M >= r.puntos[i - 1].M - 1e-6, `M decrece en el punto ${i}`);
  // Todos los puntos equilibran el axil
  const yref = centroHomogeneizado(sec).yg;
  for (const p of r.puntos) cerca(esfuerzos(sec, p.epsSup, p.kappa, yref).N, 0, 1e-4, 'N');
});

test('M-κ: la plastificación es cuando la barra inferior llega a εyd', () => {
  const sec = rect(942e-6, 226e-6);
  const r = curvaMomentoCurvatura(sec, 0, { signo: 1 });
  const { plastifica: y } = r;
  assert.ok(y && y.kappa > 0 && y.kappa < r.ultimo.kappa);
  assert.ok(y.M < r.ultimo.M && y.M > 0.9 * r.ultimo.M, 'My algo menor que Mu en una viga normalmente armada');
  // Comprobación a mano: con εs = εyd, el plano que equilibra N = 0 da esa curvatura
  const p = r.puntos.find((q) => q.kappa >= y.kappa);
  assert.ok(p.epsSup + p.kappa * 0.45 >= epsPlastificacion(A) - 1e-9);
});

test('M-κ: con armado simétrico M+ y M− coinciden', () => {
  const sec = rect(603e-6, 603e-6);
  const pos = curvaMomentoCurvatura(sec, -300, { signo: 1 });
  const neg = curvaMomentoCurvatura(sec, -300, { signo: -1 });
  cerca(pos.ultimo.M, neg.ultimo.M, 1e-3, 'Mu');
  cerca(pos.plastifica.kappa, neg.plastifica.kappa, 1e-8, 'κy');
  cerca(pos.ultimo.x, neg.ultimo.x, 1e-6, 'xu');
});

test('M-κ: un axil mayor que la capacidad no da diagrama', () => {
  const r = curvaMomentoCurvatura(rect(603e-6, 603e-6), -1e5);
  assert.equal(r.converge, false);
});

test('M-κ: diagramas característicos (sin γ ni α), como el Prontuario 3.1', async () => {
  const { caracteristico } = await import('../src/core/materiales.js');
  const Hk = caracteristico(H);
  const Ak = caracteristico(A);
  // Meseta del hormigón en fck y del acero en fyk; la plastificación en fyk/Es
  cerca(Math.max(...Hk.comp.map((p) => -p[1])), 25000, 1e-6, 'fck');
  cerca(Ak.tracc[1][1], 500000, 1e-6, 'fyk');
  cerca(epsPlastificacion(Ak), 500 / 200000, 1e-12, 'εyk');
  cerca(Ak.tracc.at(-1)[0], A.tracc.at(-1)[0], 1e-12, 'εu sin cambio');
  // Más resistencia: el momento último característico supera al de cálculo
  const sd = rect(942e-6, 226e-6);
  const sk = seccionRectangular({ b: 0.3, h: 0.5, rinf: 0.05, rsup: 0.05, Ainf: 942e-6, Asup: 226e-6, hormigon: Hk, acero: Ak });
  const rd = curvaMomentoCurvatura(sd, 0);
  const rk = curvaMomentoCurvatura(sk, 0);
  assert.ok(rk.ultimo.M > rd.ultimo.M * 1.1, `${rk.ultimo.M} vs ${rd.ultimo.M}`);
  assert.ok(rk.plastifica.M > rd.plastifica.M);
});
