import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hormigon, acero, sigma } from '../src/core/materiales.js';
import { estadoUltimo } from '../src/core/seccion.js';
import { axilesLimite } from '../src/core/interaccion.js';
import { dentro } from '../src/core/geometria.js';
import { modeloEsviada, estadoUltimoEsviada, esfuerzosPlano, contornoMxMy, razonMxMy, coeficienteMxMy, dimensionarEsviada, axilesEsviada, superficieEsviada, corteNM, coeficienteNM, razonNM, estadoEnPlano, dentroCurva, maximosSuperficie } from '../src/core/esviada.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);
const H = hormigon({ fck: 25 });
const A = acero({ fyk: 500 });
const As = (Math.PI * 0.02 ** 2) / 4;
const cuadrada = (barras, b = 0.4, h = 0.4) => ({
  contornos: [{ pts: [[0, 0], [b, 0], [b, h], [0, h]], signo: 1 }],
  caja: { xmin: 0, xmax: b, ymin: 0, ymax: h }, h,
  barras: barras.map(([x, y]) => ({ x, y, A: As })), franjas: [],
});
const simetrica = cuadrada([[0.05, 0.05], [0.35, 0.05], [0.05, 0.35], [0.35, 0.35]]);
const inferior = cuadrada([[0.05, 0.35], [0.2, 0.35], [0.35, 0.35]]);

test('esviada: compresión centrada y tracción pura coinciden con el motor recto', () => {
  const m = modeloEsviada(simetrica, H, A);
  const { Ncomp, Ntrac } = axilesEsviada(m);
  const sec = { trapecios: [{ y1: 0, y2: 0.4, b1: 0.4, b2: 0.4, mat: H }], barras: simetrica.barras.map((b) => ({ y: b.y, A: b.A, mat: A })), h: 0.4, epsC2: 0.002 };
  const r = axilesLimite(sec);
  cerca(Ncomp, r.Ncomp, 1e-6, 'Ncomp');
  cerca(Ntrac, -4 * As * (500000 / 1.15), 1e-6, 'Ntrac');
});

test('esviada: con la fibra comprimida arriba (θ = 270°) coincide con la flexión compuesta recta', () => {
  const m = modeloEsviada(inferior, H, A);
  for (const N of [0, 500, 1500]) {
    const e = estadoUltimoEsviada(m, N, (3 * Math.PI) / 2);
    assert.ok(e.converge);
    // Motor recto sobre la misma sección con y hacia abajo y momentos respecto al c.d.g. del hormigón (y = h/2)
    const sec = { trapecios: [{ y1: 0, y2: 0.4, b1: 0.4, b2: 0.4, mat: H }], barras: inferior.barras.map((b) => ({ y: b.y, A: b.A, mat: A })), h: 0.4, epsC2: 0.002 };
    const r = estadoUltimo(sec, -N, { signo: 1, yref: 0.2 });
    cerca(e.Mx, r.M, 1e-3 * Math.abs(r.M) + 1e-6, `Mx N=${N}`);
    cerca(e.My, 0, 1e-6, `My N=${N}`);
    cerca(e.x, r.x, 1e-9, 'x');
    cerca(e.N, N, 1e-4, 'equilibrio de N');
  }
});

test('esviada: la fibra comprimida abajo (θ = 90°) da el momento negativo de la rama M−', () => {
  const m = modeloEsviada(inferior, H, A);
  const e = estadoUltimoEsviada(m, 300, Math.PI / 2);
  const sec = { trapecios: [{ y1: 0, y2: 0.4, b1: 0.4, b2: 0.4, mat: H }], barras: inferior.barras.map((b) => ({ y: b.y, A: b.A, mat: A })), h: 0.4, epsC2: 0.002 };
  const r = estadoUltimo(sec, -300, { signo: -1, yref: 0.2 });
  cerca(e.Mx, r.M, 1e-3 * Math.abs(r.M), 'Mx M−');
  assert.ok(e.Mx < 0);
});

test('esviada: sección doble simétrica → contorno simétrico respecto a ambos ejes y a la diagonal', () => {
  const m = modeloEsviada(simetrica, H, A);
  const c = contornoMxMy(m, 1000, { n: 72 });
  assert.equal(c.length, 72);
  for (let i = 0; i < 72; i++) {
    const a = c[i];
    const esp = c[(72 - i) % 72]; // θ → −θ: espejo respecto al eje x
    cerca(a.Mx, -esp.Mx, 1e-3, `espejo Mx ${i}`);
    cerca(a.My, esp.My, 1e-3, `espejo My ${i}`);
  }
  // diagonal: |Mx| = |My| a 45°
  cerca(Math.abs(c[9].Mx), Math.abs(c[9].My), 1e-3, 'diagonal');
  // cara derecha comprimida: My > 0 (θ = 0), cara superior: Mx > 0 (θ = 270°)
  assert.ok(c[0].My > 0 && c[54].Mx > 0);
});

// Integral de fibras de referencia: malla fina sobre la caja, sin usar el motor seccional
function fibras(geo, h, a, theta, eps0, kappa, n = 400) {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const smax = Math.max(...geo.contornos[0].pts.map((p) => ux * p[0] + uy * p[1]));
  const { xmin, xmax, ymin, ymax } = geo.caja;
  const dx = (xmax - xmin) / n;
  const dy = (ymax - ymin) / n;
  let F = 0, Sx = 0, Sy = 0, A0 = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = xmin + (i + 0.5) * dx;
    const y = ymin + (j + 0.5) * dy;
    if (!dentro(geo.contornos, x, y)) continue;
    A0 += dx * dy; cx += x * dx * dy; cy += y * dx * dy;
    const f = -sigma(h, eps0 + kappa * (smax - (ux * x + uy * y))) * dx * dy;
    F += f; Sx += f * x; Sy += f * y;
  }
  for (const b of geo.barras) {
    const f = -sigma(a, eps0 + kappa * (smax - (ux * b.x + uy * b.y))) * b.A;
    F += f; Sx += f * b.x; Sy += f * b.y;
  }
  cx /= A0; cy /= A0;
  return { N: F, Mx: cy * F - Sy, My: Sx - cx * F };
}

test('esviada: la integración coincide con una integral de fibras en una sección en L con armadura asimétrica', () => {
  const L = {
    contornos: [{ pts: [[0, 0], [0.5, 0], [0.5, 0.2], [0.2, 0.2], [0.2, 0.6], [0, 0.6]], signo: 1 }],
    caja: { xmin: 0, xmax: 0.5, ymin: 0, ymax: 0.6 }, h: 0.6,
    barras: [[0.05, 0.05], [0.45, 0.05], [0.05, 0.55], [0.15, 0.55], [0.05, 0.3]].map(([x, y]) => ({ x, y, A: As })), franjas: [],
  };
  const m = modeloEsviada(L, H, A);
  for (const grados of [20, 135, 250, 330]) {
    const theta = (grados * Math.PI) / 180;
    const e = estadoUltimoEsviada(m, 400, theta);
    assert.ok(e.converge, `θ = ${grados}`);
    const r = fibras(L, H, A, theta, e.epsSup, e.kappa);
    cerca(e.N, 400, 1e-3, 'N');
    cerca(r.N, 400, 3, `N fibras θ=${grados}`);
    cerca(e.Mx, r.Mx, 1.5, `Mx θ=${grados}`);
    cerca(e.My, r.My, 1.5, `My θ=${grados}`);
  }
});

test('esviada: el rayo al contorno devuelve la razón buscada y el punto Q equilibra N', () => {
  const m = modeloEsviada(inferior, H, A);
  const q0 = razonMxMy(m, 600, 60, 40);
  assert.ok(q0.ratio > 0 && Number.isFinite(q0.ratio));
  cerca(q0.e.N, 600, 1e-3, 'N en Q');
  // Q está sobre el rayo de P
  cerca(q0.Q[0] / q0.Q[1], 60 / 40, 1e-3, 'dirección');
  // un punto escalado hasta Q tiene razón 1; el doble, razón 2
  const r1 = razonMxMy(m, 600, q0.Q[0], q0.Q[1]);
  cerca(r1.ratio, 1, 2e-3, 'razón en el contorno');
  const r2 = razonMxMy(m, 600, 2 * q0.Q[0], 2 * q0.Q[1]);
  cerca(r2.ratio, 2, 4e-3, 'razón doble');
  // coincide con el contorno por polígono (cuerda inscrita: nunca por fuera)
  const c = contornoMxMy(m, 600, { n: 72 });
  assert.ok(c.every((p) => razonMxMy(m, 600, p.Mx, p.My).ratio >= 1 - 1e-3));
});

test('esviada: casos límite (momento nulo, axil fuera de capacidad)', () => {
  const m = modeloEsviada(simetrica, H, A);
  const { Ncomp, Ntrac } = axilesEsviada(m);
  assert.equal(razonMxMy(m, 100, 0, 0).ratio, 0);
  assert.equal(coeficienteMxMy(m, 100, 0, 0), Infinity);
  assert.equal(razonMxMy(m, Ncomp + 100, 10, 10).ratio, Infinity);
  assert.equal(coeficienteMxMy(m, Ntrac - 100, 10, 10), 0);
  assert.deepEqual(contornoMxMy(m, Ncomp + 100, { n: 12 }), []);
});

test('esviada: dimensionar da el menor factor k con γ ≥ 1', () => {
  const k = dimensionarEsviada(simetrica, H, A, 1500, 150, 120);
  assert.ok(k > 0 && Number.isFinite(k));
  assert.ok(coeficienteMxMy(modeloEsviada(simetrica, H, A, k * 1.01), 1500, 150, 120) >= 1 - 1e-6);
  assert.ok(coeficienteMxMy(modeloEsviada(simetrica, H, A, k * 0.97), 1500, 150, 120) < 1);
  assert.equal(dimensionarEsviada(simetrica, H, A, 100, 1, 1), 0);
  assert.equal(dimensionarEsviada(simetrica, H, A, 100, 5000, 5000), Infinity);
});

test('N–M: a My = 0 la rama superior coincide con el motor recto (θ = 270°) en cada axil del muestreo', () => {
  const m = modeloEsviada(simetrica, H, A);
  const S = superficieEsviada(m);
  const c = corteNM(S, 'My', 0);
  for (const k of [4, 12, 20, 28]) {
    const e = estadoUltimoEsviada(m, c.N[k], (3 * Math.PI) / 2);
    cerca(c.A[k], Math.max(e.Mx, estadoUltimoEsviada(m, c.N[k], Math.PI / 2).Mx), 0.01 * Math.abs(e.Mx) + 0.5, `Mx N=${c.N[k]}`);
  }
});

test('N–M: sección simétrica, cortes a Mx = M0 y a My = M0 son el mismo diagrama; el polígono sigue al estado exacto (<2 %)', () => {
  const m = modeloEsviada(simetrica, H, A);
  const S = superficieEsviada(m);
  const a = corteNM(S, 'My', 60);
  const b = corteNM(S, 'Mx', 60);
  assert.equal(a.N.length, b.N.length);
  for (let k = 0; k < a.N.length; k++) { cerca(a.A[k], b.A[k], 1e-6, 'A'); cerca(a.B[k], b.B[k], 1e-6, 'B'); }
  // Exactitud respecto al estado último exacto en un axil entre dos niveles
  const N = (S.Ns[10] + S.Ns[11]) / 2;
  const e = estadoEnPlano(m, S, N, 'My', 60, 'A');
  cerca(e.My, 60, 1e-4, 'My fijo');
  const k = a.N.findIndex((n) => n > N);
  const f = (N - a.N[k - 1]) / (a.N[k] - a.N[k - 1]);
  cerca(a.A[k - 1] + f * (a.A[k] - a.A[k - 1]), e.Mx, 0.02 * Math.abs(e.Mx), 'polígono vs exacto');
});

test('N–M: γ a excentricidad constante y My fijo: Q = γ·P sobre el diagrama, dentro/fuera coherentes', () => {
  const m = modeloEsviada(simetrica, H, A);
  const S = superficieEsviada(m);
  const co = corteNM(S, 'My', 60);
  assert.ok(dentroCurva(co.curva, 1000, 100) && !dentroCurva(co.curva, 1000, 300));
  const dentroR = razonNM(m, S, co, 'My', 60, 1000, 100);
  assert.ok(dentroR.g > 1);
  cerca(dentroR.Q[0], dentroR.g * 1000, 1e-6, 'QN');
  cerca(dentroR.Q[1], dentroR.g * 100, 0.01, 'QM');
  cerca(dentroR.e.My, 60, 1e-3, 'My en Q');
  assert.ok(Math.abs(coeficienteNM(co.curva, 1000, 100) - dentroR.g) < 0.01 * dentroR.g);
  const fueraR = razonNM(m, S, co, 'My', 60, 1000, 300);
  assert.ok(fueraR.g > 0 && fueraR.g < 1);
  // Un par escalado por λ sobre el mismo rayo tiene el mismo Q
  const otro = razonNM(m, S, co, 'My', 60, 500, 50);
  cerca(otro.Q[0], dentroR.Q[0], 1, 'mismo Q');
  assert.ok(maximosSuperficie(S).Mx > 150);
});
