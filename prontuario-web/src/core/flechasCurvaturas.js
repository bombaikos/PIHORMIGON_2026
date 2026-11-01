// Flechas de vigas de hormigón armado por integración de curvaturas: EC-2 2004 + AN (7.4.3) y EC-2 2023 (9.3.4),
// que usan el mismo método. En cada una de las 51 secciones de la viga:
//   · curvaturas sin fisurar (I) y totalmente fisurada (II) con el módulo eficaz Ec,eff = Ecm/(1 + φ) de cada carga (7.20),
//   · curvatura por retracción 1/rcs = εcs·αe·S/I (7.21), calculada en I y en II,
//   · interpolación 1/r = ζ·(1/r)II + (1 − ζ)·(1/r)I (7.18), con ζ = 1 − β·(Mcr/M)² (7.19), ζ = 0 si M ≤ Mcr, β = 0,5 (cargas mantenidas),
//   · flecha por trabajos virtuales: δ(x*) = ∫ M̄(x; x*)·(1/r)(x) dx, con M̄ el momento de una carga unidad en x* sobre la misma viga
//     (vale para cualquier vinculación, también hiperestática, con los momentos de la viga elástica de EI constante).
// Historia de tres hitos como en el 3.1: q1 en t1, q2 en t2, q3 en t3; se evalúa en t3. q1 y q2 son cargas mantenidas
// (φ(t3,t1), φ(t3,t2)); q3 es instantánea. Componentes: instantánea (Ecm, β = 1, sin retracción), fluencia y retracción.
// Flecha activa = total(t3) − flecha en t2 antes de aplicar q2 (q1 con φ(t2,t1) y εcs(t2)).
// Unidades: m, kN, kN/m², días; flechas en mm, positivas hacia abajo; M positivo si tracciona la cara inferior.
// Criterio de fisuración: Mcr con fct,m,fl (7.4.3(4) / 9.3.4(4)); la propiedades() de la sección la da por signo.

import { analizarViga } from './vigas.js';
import { propiedades } from './propiedades.js';
import { girar } from './geometria.js';
import { ErrorClave } from './errores.js';

export const N_INTERVALOS = 50; // 51 puntos de cálculo
const BETA_SOSTENIDA = 0.5;

/** Momento estático de la armadura respecto a la profundidad yref (desde la fibra superior); positivo si queda por debajo. */
function momentoEstatico(geo, yref) {
  const y0 = geo.caja.ymin;
  let S = 0;
  for (const b of geo.barras) S += b.A * (b.y - y0 - yref);
  for (const f of geo.franjas) S += f.A * (f.y - y0 - yref);
  return S;
}

/** Propiedades por signo (pos/neg) con un módulo de deformación dado. */
function propsSigno(geo, geoG, Ec, Es, fctm) {
  const p = propiedades(geo, { Ec, Es, fctm });
  const Ix = p.homogeneizada.Ix;
  const n = Es / Ec;
  const lado = (fis, g) => ({
    Mfis: fis.Mfis,
    I1: Ix, S1: momentoEstatico(geo, p.homogeneizada.yg),
    I2: fis.Ifis, S2: momentoEstatico(g, fis.x),
    n,
  });
  return {
    pos: lado(p.fisurada.positivo, geo),
    neg: lado(p.fisurada.negativo, geoG),
  };
}

/**
 * @param {Object} d
 * @param {number} d.L
 * @param {'apoyo'|'empotramiento'|'libre'} d.izq
 * @param {'apoyo'|'empotramiento'|'libre'} d.der
 * @param {Object} d.geo  geometría de la sección (core/geometria.js) con su armado
 * @param {number} d.Ecm  módulo de deformación longitudinal (kN/m²)
 * @param {number} d.Es   módulo del acero (kN/m²)
 * @param {number} d.fctm  fct,m,fl de la sección (kN/m²), p. ej. fctmFlexotraccion(fctm, h)·1000
 * @param {(t:number, t0:number)=>number} d.phi  coeficiente de fluencia φ(t, t0)
 * @param {(t:number)=>number} d.epsCs  deformación de retracción libre εcs(t) (negativa = acortamiento)
 * @param {Array<{t:number, cargas:Array}>} d.hitos  tres hitos (edad del hormigón en días al aplicarse), t1 ≤ t2 ≤ t3
 */
export function flechasCurvaturas({ L, izq, der, geo, Ecm, Es, fctm, phi, epsCs, hitos }) {
  if (!(Ecm > 0) || !(Es > 0)) throw new ErrorClave('fle.err.rigidez');
  if (!Array.isArray(hitos) || hitos.length !== 3) throw new ErrorClave('fle.err.hitos');
  const [h1, h2, h3] = hitos;
  if (!(h1.t > 0 && h1.t <= h2.t && h2.t <= h3.t)) throw new ErrorClave('fle.err.tiempos');
  const geoG = girar(geo);

  // Momentos de cada grupo de cargas en las 51 secciones (EI constante: no dependen de EI)
  const calc = (cargas) => analizarViga({ L, EI: 1, izq, der, cargas, n: N_INTERVALOS });
  const enRejilla = (r) => {
    const out = [];
    for (let i = 0; i <= N_INTERVALOS; i++) {
      const x = (L * i) / N_INTERVALOS;
      const p = r.puntos.find((q) => Math.abs(q.x - x) < 1e-9 * L);
      out.push(p.M);
    }
    return out;
  };
  const M = [h1, h2, h3].map((h) => enRejilla(calc(h.cargas)));

  // Momentos virtuales: carga unidad en cada sección
  const Mv = [];
  for (let k = 0; k <= N_INTERVALOS; k++) {
    const xk = (L * k) / N_INTERVALOS;
    Mv.push(enRejilla(calc([{ tipo: 'puntual', a: xk, P: 1 }])));
  }

  const dx = L / N_INTERVALOS;
  // M̄ es lineal a trozos (carga puntual); κ se toma lineal entre secciones: integral exacta del producto en cada intervalo
  const flechaDeCurvaturas = (kap) => Mv.map((fila) => {
    let s = 0;
    for (let i = 0; i < N_INTERVALOS; i++) {
      const a = fila[i], b = fila[i + 1], ka = kap[i], kb = kap[i + 1];
      s += (2 * a * ka + a * kb + b * ka + 2 * b * kb) / 6;
    }
    return s * dx * 1000; // mm
  });

  // Estado «caso»: módulos eficaces por grupo, β, retracción y qué grupos actúan
  const curvaturas = ({ Eeff, beta, ecs, activos }) => {
    const props = Eeff.map((E) => propsSigno(geo, geoG, E, Es, fctm));
    // Mcr siempre con el módulo de corta duración
    const pCorta = propsSigno(geo, geoG, Ecm, Es, fctm);
    const kap = [];
    for (let i = 0; i <= N_INTERVALOS; i++) {
      const Mj = activos.map((a, j) => (a ? M[j][i] : 0));
      const Mt = Mj.reduce((s, v) => s + v, 0);
      const lado = Mt >= 0 ? 'pos' : 'neg';
      const sg = Mt >= 0 ? 1 : -1;
      const flex = (clave) => Mj.reduce((s, v, j) => (v ? s + v / (Eeff[j] * props[j][lado][clave]) : s), 0);
      const ref = props[0][lado]; // αe de retracción con el módulo eficaz de q1
      const cs = (I, S) => (ecs ? Math.abs(ecs) * ref.n * (S / I) * sg : 0);
      const kI = flex('I1') + cs(ref.I1, ref.S1);
      const kII = flex('I2') + cs(ref.I2, ref.S2);
      const Mcr = pCorta[lado].Mfis;
      const zeta = Math.abs(Mt) <= Mcr ? 0 : 1 - beta * (Mcr / Math.abs(Mt)) ** 2;
      kap.push(zeta * kII + (1 - zeta) * kI);
    }
    return kap;
  };

  const t3 = h3.t;
  const Ec1 = Ecm / (1 + phi(t3, h1.t));
  const Ec2 = Ecm / (1 + phi(t3, h2.t));
  const todos = [true, true, true];
  const dInst = flechaDeCurvaturas(curvaturas({ Eeff: [Ecm, Ecm, Ecm], beta: 1, ecs: 0, activos: todos }));
  const dFlu = flechaDeCurvaturas(curvaturas({ Eeff: [Ec1, Ec2, Ecm], beta: BETA_SOSTENIDA, ecs: 0, activos: todos }));
  const dTot = flechaDeCurvaturas(curvaturas({ Eeff: [Ec1, Ec2, Ecm], beta: BETA_SOSTENIDA, ecs: epsCs(t3), activos: todos }));
  const Ec1b = Ecm / (1 + phi(h2.t, h1.t));
  const dBase = flechaDeCurvaturas(curvaturas({ Eeff: [Ec1b, Ecm, Ecm], beta: BETA_SOSTENIDA, ecs: epsCs(h2.t), activos: [true, false, false] }));

  const puntos = dTot.map((total, i) => ({
    x: (L * i) / N_INTERVALOS,
    inst: dInst[i],
    fluencia: dFlu[i] - dInst[i],
    retraccion: total - dFlu[i],
    total,
    activa: total - dBase[i],
  }));
  const maxAbs = (clave) => {
    const p = puntos.reduce((m, q) => (Math.abs(q[clave]) > Math.abs(m[clave]) ? q : m));
    return { x: p.x, valor: p[clave], relacion: p[clave] ? (L * 1000) / Math.abs(p[clave]) : Infinity };
  };
  return { puntos, maximos: { total: maxAbs('total'), activa: maxAbs('activa') }, Ecef: [Ec1, Ec2] };
}
