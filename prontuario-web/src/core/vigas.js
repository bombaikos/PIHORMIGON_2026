// Viga elástica de un vano, EI constante: reacciones, esfuerzos, giros y flechas (equivale al
// módulo `analisis` del Prontuario 3.1, sin la inercia variable). Teoría de Euler-Bernoulli.
// Unidades: m, kN, kN/m, kN·m, EI en kN·m². Convenios: cargas hacia abajo positivas, momento aplicado
// positivo en sentido horario, M positivo si tracciona la fibra inferior, V positivo si la parte
// izquierda empuja hacia arriba, flecha positiva hacia abajo y giro positivo si la viga baja hacia la derecha.
//
// Se integra desde el extremo izquierdo con cuatro incógnitas (R0, M0, EIθ0, EIy0) que se fijan
// con las condiciones de los dos extremos: apoyo (y = 0, M = 0), empotramiento (y = 0, θ = 0) y libre (V = 0, M = 0).

import { ErrorClave } from './errores.js';

export const APOYOS = ['apoyo', 'empotramiento', 'libre'];

// Gauss-Legendre de 3 puntos: exacto hasta grado 5, que cubre q lineal por (x−s)³
const GP = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)];
const GW = [5 / 9, 8 / 9, 5 / 9];

/** Aportación de una carga a [V, M, EIθ, EIy] en x (suma de signos ya incluida). */
function aporte(c, x) {
  if (c.tipo === 'puntual') {
    if (x < c.a) return [0, 0, 0, 0];
    const u = x - c.a;
    return [-c.P, -c.P * u, (-c.P * u * u) / 2, (-c.P * u ** 3) / 6];
  }
  if (c.tipo === 'momento') {
    if (x < c.a) return [0, 0, 0, 0];
    const u = x - c.a;
    return [0, c.C, c.C * u, (c.C * u * u) / 2];
  }
  // distribuida lineal entre a y b, de q1 a q2
  if (x <= c.a) return [0, 0, 0, 0];
  const e = Math.min(x, c.b);
  const k = (c.q2 - c.q1) / (c.b - c.a);
  const r = [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const s = c.a + ((e - c.a) * (GP[i] + 1)) / 2;
    const w = (GW[i] * (e - c.a)) / 2;
    const q = c.q1 + k * (s - c.a);
    const u = x - s;
    r[0] -= w * q;
    r[1] -= w * q * u;
    r[2] -= (w * q * u * u) / 2;
    r[3] -= (w * q * u ** 3) / 6;
  }
  return r;
}

function resolver(A, b) {
  const n = b.length;
  const M = A.map((f, i) => [...f, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    if (Math.abs(M[p][i]) < 1e-9) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let j = i + 1; j < n; j++) {
      const f = M[j][i] / M[i][i];
      for (let k = i; k <= n; k++) M[j][k] -= f * M[i][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * @param {Object} d
 * @param {number} d.L  luz (m)
 * @param {number} d.EI  rigidez a flexión (kN·m²)
 * @param {'apoyo'|'empotramiento'|'libre'} d.izq
 * @param {'apoyo'|'empotramiento'|'libre'} d.der
 * @param {Array} d.cargas  {tipo:'puntual', a, P} | {tipo:'distribuida', a, b, q1, q2} | {tipo:'momento', a, C}
 * @param {number} [d.n]  número de puntos del muestreo
 */
export function analizarViga({ L, EI, izq, der, cargas, n = 400 }) {
  if (!(L > 0)) throw new ErrorClave('vig.err.luz');
  if (!(EI > 0)) throw new ErrorClave('vig.err.ei');
  if (izq === 'libre' && der === 'libre') throw new ErrorClave('vig.err.inestable');
  if ((izq === 'libre' && der === 'apoyo') || (izq === 'apoyo' && der === 'libre')) throw new ErrorClave('vig.err.inestable');
  const cs = cargas.filter((c) => (c.tipo === 'distribuida' ? c.b > c.a && (c.q1 || c.q2) : c.tipo === 'puntual' ? c.P : c.C));
  for (const c of cs) {
    const a = c.a, b = c.tipo === 'distribuida' ? c.b : c.a;
    if (!(a >= 0 && b <= L)) throw new ErrorClave('vig.err.fuera');
  }
  // Una carga puntual o un momento justo en un extremo con apoyo o empotramiento no entra en la viga
  const dentro = (c) => (c.tipo === 'distribuida' ? c : (izq === 'libre' || c.a > 0) && ((der === 'libre' && c.a <= L) || c.a < L) ? c : null);
  const en = cs.filter(dentro);
  const sumar = (x, tomarExtremo = false) => {
    const r = [0, 0, 0, 0];
    for (const c of en) { const v = aporte(c, tomarExtremo && x >= L ? L + 1e-12 : x); for (let i = 0; i < 4; i++) r[i] += v[i]; }
    return r;
  };
  // F(x) = parte lineal en las incógnitas + parte de las cargas
  const lineal = (x) => [
    [1, 0, 0, 0], // V = R0
    [x, 1, 0, 0], // M = R0 x + M0
    [(x * x) / 2, x, 1, 0], // EIθ
    [(x ** 3) / 6, (x * x) / 2, x, 1], // EIy
  ];
  const fila = (cual, x, ext) => ({ f: lineal(x)[cual], c: sumar(x, ext)[cual] });
  const cond = [];
  const imponer = (extremo, tipo) => {
    const x = extremo === 'izq' ? 0 : L;
    const ext = extremo === 'der';
    // En x = 0 las cargas con a = 0 se aplican aunque sea al borde (libre) y en x = L las de a = L, si es libre
    const xe = ext && tipo === 'libre' ? L : ext ? L : 0;
    if (tipo === 'apoyo') { cond.push(fila(3, xe, ext && false)); cond.push(fila(1, xe, false)); }
    else if (tipo === 'empotramiento') { cond.push(fila(3, xe, false)); cond.push(fila(2, xe, false)); }
    else { cond.push(fila(0, xe, ext)); cond.push(fila(1, xe, ext)); }
  };
  imponer('izq', izq);
  imponer('der', der);
  // Para un extremo derecho con apoyo o empotramiento se excluyen las cargas en x = L exacto (van al apoyo)
  const sol = resolver(cond.map((c) => c.f), cond.map((c) => -c.c));
  if (!sol) throw new ErrorClave('vig.err.inestable');
  const [R0, M0, T0, Y0] = sol;
  const en_x = (x) => {
    const a = sumar(x);
    const F = lineal(x);
    const u = [R0, M0, T0, Y0];
    return F.map((f, i) => f.reduce((s, v, j) => s + v * u[j], 0) + a[i]);
  };

  // Muestreo: malla regular más los puntos singulares (a ambos lados)
  const xs = new Set();
  for (let i = 0; i <= n; i++) xs.add((L * i) / n);
  for (const c of en) for (const p of c.tipo === 'distribuida' ? [c.a, c.b] : [c.a]) xs.add(p);
  const orden = [...xs].sort((p, q) => p - q);
  const pts = orden.map((x) => {
    const [V, M, T, Y] = en_x(x);
    return { x, V, M, giro: -T / EI, flecha: -Y / EI };
  });
  // Saltos de cortante y momento en los puntos singulares (valor justo antes y justo después)
  const eps = 1e-9 * L;
  const diag = [];
  for (const p of pts) {
    const a = en_x(Math.max(0, p.x - eps));
    const b = en_x(Math.min(L, p.x + eps));
    if (p.x > 0) diag.push({ x: p.x, V: a[0], M: a[1] });
    diag.push({ x: p.x, V: b[0], M: b[1] });
  }
  // Tabla de valores: un renglón por punto del muestreo y dos donde hay un salto (antes y después)
  const renglon = (x, v) => ({ x, V: v[0], M: v[1], giro: -v[2] / EI, flecha: -v[3] / EI });
  const tabla = [];
  for (const p of pts) {
    const a = en_x(Math.max(0, p.x - eps));
    const b = en_x(Math.min(L, p.x + eps));
    const salta = Math.abs(a[0] - b[0]) > 1e-6 * (1 + Math.abs(a[0])) || Math.abs(a[1] - b[1]) > 1e-6 * (1 + Math.abs(a[1]));
    if (salta && p.x > 0) tabla.push(renglon(p.x, a));
    tabla.push(renglon(p.x, salta || p.x === 0 ? b : en_x(p.x)));
  }
  // Extremos: reacciones. Se evalúan con las cargas de x = L incluidas
  const fin = en_x(L - eps);
  const RL = -fin[0];
  const reacciones = {
    izq: { R: izq === 'libre' ? 0 : R0 + cs.filter((c) => c.tipo === 'puntual' && c.a === 0 && izq !== 'libre').reduce((s, c) => s + c.P, 0), M: izq === 'empotramiento' ? M0 : 0 },
    der: { R: der === 'libre' ? 0 : RL + cs.filter((c) => c.tipo === 'puntual' && c.a === L && der !== 'libre').reduce((s, c) => s + c.P, 0), M: der === 'empotramiento' ? fin[1] : 0 },
  };
  const extremo = (clave, signo = 1) => {
    let m = pts[0];
    for (const p of pts) if (signo * p[clave] > signo * m[clave]) m = p;
    return { x: m.x, valor: m[clave] };
  };
  const absmax = (clave) => {
    const a = extremo(clave, 1);
    const b = extremo(clave, -1);
    return Math.abs(a.valor) >= Math.abs(b.valor) ? a : b;
  };
  const Vs = diag.reduce((m, p) => (Math.abs(p.V) > Math.abs(m.V) ? p : m), diag[0]);
  return {
    L, EI, R0, M0, reacciones, puntos: pts, diagrama: diag, tabla,
    maximos: {
      Mpos: extremo('M', 1), Mneg: extremo('M', -1),
      V: { x: Vs.x, valor: Vs.V },
      flecha: absmax('flecha'), giro: absmax('giro'),
    },
  };
}
