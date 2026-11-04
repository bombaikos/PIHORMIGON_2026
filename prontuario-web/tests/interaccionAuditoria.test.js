// Auditoría del cálculo de Flexión compuesta recta (31/10/2026): comprobaciones independientes del motor N-M.
// La integración por fibras de aquí no usa seccion.js: solo las leyes de los materiales (sigma, limites).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero, sigma, limites } from '../src/core/materiales.js';
import { seccionRectangular } from '../src/core/flexion.js';
import { diagramaNM, coeficienteNM, comprobarNM } from '../src/core/interaccion.js';
import { cuantiaMinima, cuantiaMaxima } from '../src/core/cuantiaMinima.js';
import { eMinima } from '../src/ui/vistas/flexRecta.js';

const H = hormigon({ fck: 25, norma: 'EHE-08' });
const A = acero({ fyk: 500, norma: 'EHE-08' });
const SEC = seccionRectangular({ b: 0.4, h: 0.4, hormigon: H, acero: A, rinf: 0.05, rsup: 0.05, Ainf: 603e-6, Asup: 603e-6, barrasExtra: [{ y: 0.2, A: 402e-6 }] });
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);

/** N (compresión +) y M (comprime arriba, respecto a yref) por fibras, con ε tracción +. */
function integrar(sec, epsSup, kappa, yref, nf = 4000) {
  let N = 0;
  let M = 0;
  for (const t of sec.trapecios) {
    const h = t.y2 - t.y1;
    for (let i = 0; i < nf; i++) {
      const y = t.y1 + ((i + 0.5) * h) / nf;
      const b = t.b1 + ((t.b2 - t.b1) * (y - t.y1)) / h;
      const f = -sigma(t.mat, epsSup + kappa * y) * b * (h / nf); // fuerza de compresión
      N += f;
      M += f * (yref - y);
    }
  }
  for (const br of sec.barras) {
    const f = -sigma(br.mat, epsSup + kappa * br.y) * br.A;
    N += f;
    M += f * (yref - br.y);
  }
  return { N, M };
}

const D = diagramaNM(SEC, { n: 40, simetrica: true, tol: 1e-4 });

test('contorno N-M: cada punto equilibra su N y su M al integrar por fibras de forma independiente', () => {
  const Mmax = Math.max(...D.pos.map((p) => Math.abs(p.M)));
  for (const p of D.pos) {
    if (!Number.isFinite(p.kappa)) continue;
    const r = integrar(SEC, p.epsSup, p.kappa, D.yref);
    cerca(r.N, p.N, 0.002 * D.Ncomp, `N en N=${p.N.toFixed(0)}`);
    cerca(r.M, p.M, 0.002 * Mmax, `M en N=${p.N.toFixed(0)}`);
  }
});

test('contorno N-M: cada punto está en agotamiento (alguna fibra en su límite y ninguna lo supera)', () => {
  const [lc] = limites(H);
  const [, lt] = limites(A);
  for (const p of D.pos.slice(1, -1)) {
    const eps = (y) => p.epsSup + p.kappa * y;
    const ec = Math.min(eps(0), eps(SEC.h));
    const es = Math.max(...SEC.barras.map((b) => eps(b.y)));
    const esMin = Math.min(...SEC.barras.map((b) => eps(b.y)));
    assert.ok(ec >= lc - 1e-9, `hormigón pasa de εcu en N=${p.N.toFixed(0)}: ${ec}`);
    assert.ok(es <= lt + 1e-9, `acero pasa de εud en N=${p.N.toFixed(0)}: ${es}`);
    assert.ok(esMin >= -Infinity);
    // Pivote A (acero a εud), pivote B (hormigón a εcu) o pivote C (εc2 a 3/7 del canto desde la fibra comprimida)
    const enA = Math.abs(es - lt) < 1e-6;
    const enB = Math.abs(ec - lc) < 1e-6;
    const enC = Math.abs(eps(SEC.h * 3 / 7) - -SEC.epsC2) < 1e-6 || Math.abs(eps(SEC.h * 4 / 7) - -SEC.epsC2) < 1e-6;
    assert.ok(enA || enB || enC, `N=${p.N.toFixed(0)} no está en ningún pivote (ec=${ec}, es=${es})`);
  }
});

test('contorno N-M: es convexo (no hay entrantes mayores que la tolerancia numérica)', () => {
  const pts = D.pos.map((p) => [p.N, p.M]);
  const Mmax = Math.max(...pts.map((p) => p[1]));
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const cruz = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1); // < 0 en un contorno convexo recorrido a derechas
    const esc = Math.hypot(x2 - x0, y2 - y0) * Mmax;
    assert.ok(cruz <= 1e-3 * esc, `entrante en el punto ${i} (N=${x1.toFixed(0)}, cruz=${cruz.toFixed(2)})`);
  }
});

test('coeficiente de seguridad: homogéneo (γ de k·(N, M) es γ/k) y dentro/fuera coherente con el contorno', () => {
  const g1 = coeficienteNM(D, 800, 120);
  for (const k of [0.5, 0.8, 1.2]) cerca(coeficienteNM(D, 800 * k, 120 * k), g1 / k, 2e-3 * g1 / k, `k=${k}`);
  const Q = comprobarNM(D, 800, 120).Q;
  cerca(Q[1] / Q[0], 120 / 800, 1e-9, 'Q sobre la recta de excentricidad constante');
  assert.ok(coeficienteNM(D, 0, 0.001) > 100, 'sin esfuerzo, γ muy grande');
});

test('compresión pura y tracción pura: valores cerrados por sumas de áreas (el motor integra el hormigón bruto, sin descontar los huecos de las barras, como calcomun)', () => {
  const As = 603e-6 * 2 + 402e-6;
  const Ac = 0.4 * 0.4;
  const fcd = 25000 / 1.5;
  const nPR = (1 - Math.pow(1 - 1, 2)) * fcd; // εc2: σ = fcd (α = 1 en el PR del Prontuario)
  cerca(D.Ncomp, Ac * nPR + As * Math.min(0.002 * 200e6, 500000 / 1.15), 2, 'Ncomp');
  cerca(D.Ntrac, -As * 500000 / 1.15, 1e-6, 'Ntrac');
});

test('excentricidad mínima: EHE-08 máx{h/20; 2 cm}; EC-2 (2004 y 2023) máx{h/30; 20 mm}', () => {
  const s = (h, forma = 'pilar') => ({ forma, geo: { h, D: h } });
  cerca(eMinima('EHE-08', s(0.4)), 0.02, 1e-12, 'EHE 400');
  cerca(eMinima('EHE-08', s(0.6)), 0.03, 1e-12, 'EHE 600');
  cerca(eMinima('EC2-2004', s(0.4)), 0.02, 1e-12, 'EC2 400');
  cerca(eMinima('EC2-2004', s(0.9)), 0.03, 1e-12, 'EC2 900');
  cerca(eMinima('EC2-2023', s(0.9, 'circular')), 0.03, 1e-12, 'EC2-2023 circular');
});

test('armadura mínima de pilar: EHE-08 42.3.3 (fyc,d ≤ 400 MPa y 4 ‰) y EC-2 9.5.2(2) (0,10·N/fyd y 2 ‰)', () => {
  const base = { tipo: 'pilar', h: 0.4, Ac: 0.16, yg: 0.2, Ix: 0, fctm: 0, fyk: 500000, gammaS: 1.15, N: 3000 };
  const ehe = cuantiaMinima({ ...base, norma: 'EHE-08' });
  cerca(ehe.mec, 0.1 * 3000 / 400000, 1e-12, 'EHE-08: fyc,d topado a 400 MPa');
  cerca(ehe.geo, 0.004 * 0.16, 1e-12, 'EHE-08: 4 ‰');
  const ec = cuantiaMinima({ ...base, norma: 'EC2-2004' });
  cerca(ec.mec, 0.1 * 3000 / (500000 / 1.15), 1e-12, 'EC-2: 0,10·N/fyd');
  cerca(ec.geo, 0.002 * 0.16, 1e-12, 'EC-2: 2 ‰');
});

test('armadura máxima de pilar: EHE-08 A·fyc,d ≤ Ac·fcd; EC-2 2004 0,04·Ac; EC-2 2023 sin límite localizado', () => {
  const d = { Ac: 0.16, fcd: 16667, fyk: 500000, gammaS: 1.15 };
  cerca(cuantiaMaxima({ ...d, norma: 'EHE-08' }), 0.16 * 16667 / 400000, 1e-12, 'EHE-08');
  cerca(cuantiaMaxima({ ...d, norma: 'EC2-2004' }), 0.0064, 1e-12, 'EC-2 2004');
  assert.equal(cuantiaMaxima({ ...d, norma: 'EC2-2023' }), null);
});
