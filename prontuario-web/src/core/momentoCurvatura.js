// Diagrama momento-curvatura de una sección con axil constante (el diagrama M-κ de Unit4.pas).
// Usa el motor seccional (src/core/seccion.js) con los mismos diagramas σ-ε que el ELU:
// para cada curvatura busca el plano que equilibra el axil y toma el momento, hasta la
// curvatura última. Unidades: kN, m, 1/m. Tracción positiva; κ > 0 comprime la cara superior.

import { esfuerzos, intervaloEpsSup, estadoUltimo, centroHomogeneizado } from './seccion.js';
import { epsPlastificacion } from './materiales.js';

/** εsup que equilibra Nd para la curvatura κ, o null si no hay plano admisible. */
function planoCon(sec, kappa, Nd, yref) {
  let [lo, hi] = intervaloEpsSup(sec, kappa);
  if (!(lo <= hi)) return null;
  if (!Number.isFinite(lo)) lo = hi - 1;
  if (!Number.isFinite(hi)) hi = lo + 1;
  // N crece con εsup: regula falsi (variante de Illinois), que converge en pocas iteraciones
  let fa = esfuerzos(sec, lo, kappa, yref).N - Nd;
  let fb = esfuerzos(sec, hi, kappa, yref).N - Nd;
  if (fa > 1e-9 || fb < -1e-9) return null;
  if (fa >= 0) return lo;
  if (fb <= 0) return hi;
  let lado = 0;
  for (let i = 0; i < 80; i++) {
    const m = (lo * fb - hi * fa) / (fb - fa);
    const fm = esfuerzos(sec, m, kappa, yref).N - Nd;
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-14) return m;
    if (fm < 0) { lo = m; fa = fm; if (lado === -1) fb /= 2; lado = -1; } else { hi = m; fb = fm; if (lado === 1) fa /= 2; lado = 1; }
  }
  return (lo + hi) / 2;
}

/** Profundidad de la fibra neutra desde la fibra más comprimida. */
function profundidad(sec, epsSup, kappa, signo) {
  if (kappa === 0) return Infinity;
  const y = -epsSup / kappa;
  return signo > 0 ? y : sec.h - y;
}

/**
 * Curva M-κ para un signo del momento.
 * @param {import('./seccion.js').Seccion} sec  sección del motor, con las barras de acero marcadas con mat.tipo = 'acero'
 * @param {number} Nd  axil, tracción positiva [kN]
 * @param {{signo?: 1|-1, n?: number}} [opc]  n = número de tramos de la curva
 * @returns {{converge:boolean, motivo?:string, puntos:{kappa:number,M:number,x:number,epsSup:number}[],
 *   plastifica:{kappa:number,M:number}|null, ultimo:{kappa:number,M:number,x:number}}}
 *   κ en valor absoluto y M con el signo pedido (positivo salvo al principio, si el axil da momento)
 */
export function curvaMomentoCurvatura(sec, Nd, { signo = 1, n = 60 } = {}) {
  const yref = centroHomogeneizado(sec).yg;
  const u = estadoUltimo(sec, Nd, { signo, yref });
  if (!u.converge) return { converge: false, motivo: u.motivo, puntos: [] };
  const ku = Math.abs(u.kappa);
  const punto = (k) => {
    const kap = signo * k;
    const e = planoCon(sec, kap, Nd, yref);
    if (e === null) return null;
    const { M } = esfuerzos(sec, e, kap, yref);
    return { kappa: k, M: signo * M, epsSup: e, x: profundidad(sec, e, kap, signo) };
  };
  // Más densidad al principio, donde la curva cambia de pendiente
  const ks = Array.from({ length: n + 1 }, (_, i) => ku * (i / n) ** 1.5);
  const puntos = ks.map(punto).filter(Boolean);
  const xu = profundidad(sec, u.epsSup, u.kappa, signo);
  if (puntos.at(-1)?.kappa < ku * (1 - 1e-9)) puntos.push({ kappa: ku, M: signo * u.M, epsSup: u.epsSup, x: xu });

  // Plastificación: la primera barra de acero que llega a εyd en tracción
  const aceros = sec.barras.filter((b) => b.mat.tipo === 'acero');
  const exceso = (k) => {
    const e = planoCon(sec, signo * k, Nd, yref);
    if (e === null) return NaN;
    return Math.max(...aceros.map((b) => e + signo * k * b.y - epsPlastificacion(b.mat)));
  };
  let plastifica = null;
  if (aceros.length) {
    let a = 0;
    let z = null;
    for (const p of puntos) { if (exceso(p.kappa) >= 0) { z = p.kappa; break; } a = p.kappa; }
    if (z !== null && exceso(a) < 0) {
      for (let i = 0; i < 40 && z - a > z * 1e-7; i++) { const m = (a + z) / 2; if (exceso(m) < 0) a = m; else z = m; }
      const p = punto(z);
      if (p) {
        plastifica = { kappa: z, M: p.M };
        // El codo de la curva queda en su sitio aunque caiga entre dos puntos
        puntos.splice(puntos.findIndex((q) => q.kappa > z), 0, p);
      }
    }
  }
  return { converge: true, puntos, plastifica, ultimo: { kappa: ku, M: signo * u.M, x: xu } };
}
