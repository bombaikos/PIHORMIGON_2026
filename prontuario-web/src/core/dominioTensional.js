// Dominio admisible del Análisis tensional: qué planos de deformación (ε_cdg, κx, κy) son válidos en ELS o en ELU.
// Todos los límites son deformaciones leídas de las leyes de los materiales (nunca se sustituye una ley): la deformación
// en cada punto es lineal en el plano, así que cada límite es un semiespacio; el conjunto se consulta como un oráculo de
// pertenencia (¿este plano es admisible?) y no se asume convexo (el pivote C lo rompe en secciones no simétricas).
// Compresión positiva; ε absolutas; unidades del motor (kN, m).

const TOL = 1e-9;

/** Leyes que admite el módulo: hormigón parábola-rectángulo o Sargin; acero bilineal (tres puntos). null si valen. */
export function leyesNoAdmitidas(hormigonMat, aceroMat) {
  if (hormigonMat.diag === 'puntos') return 'hormigon';
  if (aceroMat.tracc?.length !== 3 || aceroMat.comp?.length !== 3) return 'acero';
  return null;
}

/** Primera deformación (ε ≥ 0) en la que la rama ascendente de pts (ε, σ en valor absoluto) alcanza la tensión T; null si nunca. */
function primeraEn(pts, T) {
  for (let i = 1; i < pts.length; i++) {
    const [e0, s0] = pts[i - 1];
    const [e1, s1] = pts[i];
    if (s0 < T && s1 >= T) return e0 + ((e1 - e0) * (T - s0)) / (s1 - s0);
  }
  return null;
}

const abs = (pts) => pts.map(([e, s]) => [Math.abs(e), Math.abs(s)]);

/** Puntos de la ley de compresión del hormigón sin el tramo de prolongación que añade leyServicio. */
function compPropia(ley) {
  const comp = abs(ley.comp);
  return ley.diag === 'lineal' ? comp : comp.slice(0, -1);
}

/**
 * Límites de deformación del estado límite, leídos de las leyes del modelo.
 * ELS: σc ≤ kc·fck y σs ≤ ks·fyk, pasadas a deformación por la ley (primer punto de la rama ascendente); si la ley
 * no llega a esa tensión, el límite es la deformación última de la ley.
 * ELU: ε_ud del acero, ε_cu del hormigón y pivote C (a·ε_sup + (1 − a)·ε_inf ≤ ε_c2, con a = ε_c2/ε_cu).
 * @param {Object} mod  modeloTensional(...)
 * @param {'ELS'|'ELU'} estado
 * @param {{kc?:number, ks?:number}} [k]
 * @returns {{estado:string, ec:number, ecComp:number, esT:number, esC:number, pivote:null|{a:number, ec2:number}, tcMax?:number, tsMax?:number}}
 */
export function limitesDe(mod, estado, { kc = 0.6, ks = 0.8 } = {}) {
  const comp = compPropia(mod.ley.integra);
  const ecu = comp[comp.length - 1][0];
  const accT = abs(mod.acero.tracc);
  const accC = abs(mod.acero.comp);
  const euT = accT[accT.length - 1][0];
  const euC = accC[accC.length - 1][0];
  if (estado === 'ELS') {
    const fck = mod.mat.hormigon.fk;
    const fyk = mod.mat.acero.fk;
    const ec = primeraEn(comp, kc * fck) ?? ecu;
    return {
      estado, ec, ecu, esT: primeraEn(accT, ks * fyk) ?? euT, esC: primeraEn(accC, ks * fyk) ?? euC, pivote: null,
      alcanzaC: primeraEn(comp, kc * fck) !== null,
    };
  }
  const smax = Math.max(...comp.map((p) => p[1]));
  const ec2 = comp.find((p) => p[1] >= smax * (1 - 1e-12))[0];
  return { estado, ec: ecu, ecu, esT: euT, esC: euC, pivote: ec2 < ecu * (1 - 1e-9) ? { a: ec2 / ecu, ec2 } : null, alcanzaC: true };
}

const eps = (mod, pl, x, y) => pl.e0 + pl.ky * (x - mod.xc) - pl.kx * (y - mod.yc);

/**
 * Oráculo de pertenencia.
 * @returns {{ok:boolean, holgura:number, limita:string|null}}  holgura = menor margen de deformación (≥ 0 si es admisible);
 *   limita: 'hormigon' | 'acero' | 'pivote' (la restricción más ajustada).
 */
export function admisible(mod, lim, pl) {
  let holgura = Infinity;
  let limita = null;
  const mira = (h, q) => { if (h < holgura) { holgura = h; limita = q; } };
  const es = mod.vertices.map(([x, y]) => eps(mod, pl, x, y));
  const eSup = Math.max(...es);
  const eInf = Math.min(...es);
  mira(lim.ec - eSup, 'hormigon');
  if (lim.pivote) mira(lim.pivote.ec2 - (lim.pivote.a * eSup + (1 - lim.pivote.a) * eInf), 'pivote');
  const puntos = [...mod.armadura.barras.map((b) => [b.x, b.y]), ...mod.armadura.franjas.flatMap((f) => [[f.x1, f.y], [f.x2, f.y]])];
  for (const [x, y] of puntos) {
    const e = eps(mod, pl, x, y);
    mira(lim.esC - e, 'acero');
    mira(lim.esT + e, 'acero');
  }
  return { ok: holgura >= -TOL, holgura, limita };
}

/**
 * Intervalo [tMin, tMax] de t para el que p0 + t·d es admisible, partiendo de un p0 admisible (t = 0).
 * Se supone conexo en la recta (tramo a tramo con bisección). tope acota las direcciones sin límite.
 * @param {(pl:{e0:number,kx:number,ky:number})=>boolean} oraculo
 */
export function intervaloEnRecta(oraculo, p0, d, tope = 1) {
  const en = (t) => oraculo({ e0: p0.e0 + t * d.e0, kx: p0.kx + t * d.kx, ky: p0.ky + t * d.ky });
  const lado = (s) => {
    let ok = 0;
    let mal = null;
    const N = 64;
    for (let i = 1; i <= N; i++) {
      const t = (s * tope * i) / N;
      if (en(t)) ok = t; else { mal = t; break; }
    }
    if (mal === null) return ok;
    for (let i = 0; i < 50; i++) { const m = (ok + mal) / 2; if (en(m)) ok = m; else mal = m; }
    return ok;
  };
  return [lado(-1), lado(1)];
}
