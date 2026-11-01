// Flechas de vigas de hormigón armado por el método simplificado de la EHE-08 (art. 50.2.2): inercia equivalente
// de Branson, rigidez constante por hito y flecha diferida con λ = ξ/(1 + 50ρ'). Es la misma cadena de cálculo del
// módulo `flechas` del Prontuario 3.1 (EHE-98, art. 50), con dos diferencias: la inercia de referencia se pondera
// 25-50-25 con las secciones de apoyo (EHE-08 50.2.2.2) y ξ sigue la tabla de 50.2.2.3.
// Unidades: m, kN, kN·m², días. Las flechas salen en mm, positivas hacia abajo.
//
// Historia de tres hitos: q1 actúa en t1 (al descimbrar), q2 en t2 (resto de permanentes) y q3 en t3 (sobrecarga).
// Superposición lineal (como el 3.1): con Fj la flecha unitaria (EI = 1) del conjunto de cargas qj,
//   δi(q1) = F1/EI1 ; δi(q2) = (F1+F2)/EI2 − F1/EI1 ; δi(q3) = (F1+F2+F3)/EI3 − (F1+F2)/EI2
//   δi(*) = (F1+F2)/EI3 − (F1+F2)/EI2           (degradación de la rigidez entre t2 y t3)
//   δd(q1) = δi(q1)·λ(t1→t3) ; δd(q2+*) = (δi(q2) + δi(*))·λ(t2→t3)
//   total = δi(q1)+δi(q2)+δi(q3)+δd(q1)+δd(q2+*) ; activa = total − δi(q1)·(1 + λ(t1→t2))

import { analizarViga } from './vigas.js';
import { ErrorClave } from './errores.js';

export const N_PUNTOS = 50; // intervalos de cálculo: 51 puntos, como el 3.1

/** ξ de EHE-08 50.2.2.3: 2 semanas 0,5; 1 mes 0,7; 3 meses 1,0; 6 meses 1,2; 1 año 1,4; 5 años o más 2,0. */
const XI = [[0, 0], [14, 0.5], [30, 0.7], [90, 1.0], [180, 1.2], [365, 1.4], [1825, 2.0]];

/** ξ(t) interpolado linealmente entre los valores de la tabla (t en días; 2,0 a partir de 5 años). */
export function xi(t) {
  if (t >= XI[XI.length - 1][0]) return XI[XI.length - 1][1];
  for (let i = 1; i < XI.length; i++) {
    if (t <= XI[i][0]) {
      const [t0, x0] = XI[i - 1], [t1, x1] = XI[i];
      return x0 + ((x1 - x0) * (t - t0)) / (t1 - t0);
    }
  }
  return 0;
}

/** λ = (ξ(tf) − ξ(t0)) / (1 + 50ρ') con ρ' en tanto por uno (EHE-08 50.2.2.3). */
export const lambda = (t0, tf, rhoP) => (xi(tf) - xi(t0)) / (1 + 50 * rhoP);

/**
 * Inercia equivalente de Branson para un momento Ma (kN·m; positivo si tracciona la cara inferior).
 * Ie = k·Ib + (1−k)·If, con k = (Mf/Ma)³ y tope Ib (EHE-08 50.2.2.2).
 * @param {{Ib:number, Ifis:{pos:number, neg:number}, Mfis:{pos:number, neg:number}}} s
 */
export function inerciaBranson(s, Ma) {
  if (!Ma) return s.Ib;
  const lado = Ma > 0 ? 'pos' : 'neg';
  const k = Math.abs(s.Mfis[lado] / Ma) ** 3;
  return Math.min(s.Ib, k * s.Ib + (1 - k) * s.Ifis[lado]);
}

/** Tipo de elemento según los extremos: biapoyada, voladizo o continua en uno o en ambos extremos. */
export function sistema(izq, der) {
  if (izq === 'libre' || der === 'libre') return 'voladizo';
  const c = (izq === 'empotramiento') + (der === 'empotramiento');
  return ['biapoyada', 'continuaUno', 'continuaAmbos'][c];
}

const sumaCargas = (...gs) => gs.flat();

/**
 * @param {Object} d
 * @param {number} d.L  luz (m)
 * @param {'apoyo'|'empotramiento'|'libre'} d.izq
 * @param {'apoyo'|'empotramiento'|'libre'} d.der  empotramiento = extremo continuo
 * @param {number} d.E  módulo de deformación longitudinal del hormigón (kN/m²)
 * @param {{Ib:number, Ifis:{pos:number, neg:number}, Mfis:{pos:number, neg:number}}} d.seccion
 * @param {number} d.rhoP  ρ' (cuantía de compresión, tanto por uno) en la sección de referencia
 * @param {Array<{t:number, cargas:Array}>} d.hitos  tres hitos de carga, t1 ≤ t2 ≤ t3 (días)
 */
export function flechasBranson({ L, izq, der, E, seccion, rhoP = 0, hitos }) {
  if (!(E > 0) || !(seccion?.Ib > 0)) throw new ErrorClave('fle.err.rigidez');
  if (!Array.isArray(hitos) || hitos.length !== 3) throw new ErrorClave('fle.err.hitos');
  const [h1, h2, h3] = hitos;
  if (!(h1.t > 0 && h1.t <= h2.t && h2.t <= h3.t)) throw new ErrorClave('fle.err.tiempos');
  // Con EI = 1 la flecha es la unitaria F; los momentos no dependen de EI (EI constante)
  const calc = (cargas) => analizarViga({ L, EI: 1, izq, der, cargas, n: N_PUNTOS });
  const r1 = calc(h1.cargas);
  const r12 = calc(sumaCargas(h1.cargas, h2.cargas));
  const r123 = calc(sumaCargas(h1.cargas, h2.cargas, h3.cargas));

  // Momentos acumulados en las secciones de referencia (centro de vano, arranque o apoyos)
  const sis = sistema(izq, der);
  const enX = (r, x) => r.puntos.reduce((m, p) => (Math.abs(p.x - x) < Math.abs(m.x - x) ? p : m)).M;
  const apoyo = (r, lado) => (lado === 'izq' ? r.reacciones.izq.M : r.reacciones.der.M); // < 0 si tracciona la cara superior
  const Mcentro = (r) => enX(r, L / 2);
  const Marranque = (r) => (izq === 'empotramiento' ? apoyo(r, 'izq') : apoyo(r, 'der'));
  const ie = (r) => {
    if (sis === 'voladizo') return inerciaBranson(seccion, Marranque(r));
    const Iec = inerciaBranson(seccion, Mcentro(r));
    if (sis === 'biapoyada') return Iec;
    const Ii = inerciaBranson(seccion, apoyo(r, 'izq'));
    const Id = inerciaBranson(seccion, apoyo(r, 'der'));
    return sis === 'continuaAmbos' ? 0.5 * Iec + 0.25 * Ii + 0.25 * Id : 0.75 * Iec + 0.25 * (izq === 'empotramiento' ? Ii : Id);
  };
  const Ie1 = ie(r1), Ie2 = ie(r12), Ie3 = ie(r123);
  const EI1 = E * Ie1, EI2 = E * Ie2, EI3 = E * Ie3;

  const lam13 = lambda(h1.t, h3.t, rhoP);
  const lam23 = lambda(h2.t, h3.t, rhoP);
  const lam12 = lambda(h1.t, h2.t, rhoP);

  // Muestreo uniforme de 51 puntos (los puntos singulares extra de analizarViga se descartan)
  const idx = [];
  for (let i = 0; i <= N_PUNTOS; i++) {
    const x = (L * i) / N_PUNTOS;
    idx.push(r1.puntos.findIndex((p) => Math.abs(p.x - x) < 1e-9 * L));
  }
  const puntos = idx.map((j, i) => {
    const F1 = r1.puntos[j].flecha, F12 = r12.puntos[j].flecha, F123 = r123.puntos[j].flecha;
    const di1 = F1 / EI1;
    const di2 = F12 / EI2 - di1;
    const di3 = F123 / EI3 - F12 / EI2;
    const diA = F12 / EI3 - F12 / EI2;
    const dd1 = di1 * lam13;
    const dd2 = (di2 + diA) * lam23;
    const total = di1 + di2 + di3 + dd1 + dd2;
    const activa = total - di1 * (1 + lam12);
    const mm = (v) => v * 1000;
    return { x: (L * i) / N_PUNTOS, di1: mm(di1), di2: mm(di2), di3: mm(di3), diA: mm(diA), dd1: mm(dd1), dd2: mm(dd2), total: mm(total), activa: mm(activa) };
  });
  const maxAbs = (clave) => {
    const p = puntos.reduce((m, q) => (Math.abs(q[clave]) > Math.abs(m[clave]) ? q : m));
    return { x: p.x, valor: p[clave], relacion: p[clave] ? (L * 1000) / Math.abs(p[clave]) : Infinity };
  };
  return { sistema: sis, Ie: [Ie1, Ie2, Ie3], lambda: { l13: lam13, l23: lam23, l12: lam12 }, puntos, maximos: { total: maxAbs('total'), activa: maxAbs('activa') } };
}
