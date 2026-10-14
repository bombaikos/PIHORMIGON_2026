// Esfuerzo cortante de piezas lineales según la UNE-EN 1992-1-1:2013 con su Anejo Nacional (EC-2 2004 + AN), 6.2.
// Sin armadura de cortante: VRd,c (6.2.a) con el mínimo del AN (νmin = 0,075/γc·k^(3/2)·fck^(1/2)).
// Con armadura: solo celosía, VRd = mín(VRd,s; VRd,máx) (6.8, 6.9, 6.13, 6.14), sin aporte del hormigón.
// Unidades: MPa, mm y kN. Compresión positiva. Mismo contrato que ehe08.js (comprobar, dimensionar, cotOptimo).
// Textos de la norma: analisis/normativa/ec2-2004-an/texto.txt, 6.2.2 (l.3895-3935), 6.2.3 (l.3993-4130) y AN
// (6.2.2(1), 6.2.3(2)-(3), 9.2.2(4)-(8), l.10093-10160 y 10370-10430).

import { EC2_2004 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { COT_MIN, COT_MAX, RHO_MAX, S_TABLA_MAX, S_TABLA_PASO, sepMaxima, areaRama, AswSDe, thetaDe } from './ehe08.js';

export { COT_MIN, COT_MAX, RHO_MAX, areaRama, AswSDe, thetaDe };
export const ID = 'EC2-2004';

const rad = (g) => (g * Math.PI) / 180;
const cot = (g) => 1 / Math.tan(rad(g));

/** Valores derivados comunes. Mismos datos de entrada que ehe08.js; Asc y sigY no intervienen. */
export function parametros(x) {
  const { fck, fykCercos, b0, d } = x;
  if (!(fck > 0) || !(b0 > 0) || !(d > 0) || !(x.Ac > 0)) throw new ErrorClave('cor.errDatos');
  if (fck > EC2_2004.fckMax) throw new ErrorClave('cor.errFck', EC2_2004.fckMax);
  const gc = EC2_2004.gammaC;
  const gs = EC2_2004.gammaS;
  const fcd = (EC2_2004.alfaCC() * fck) / gc;
  const fctm = EC2_2004.fctm(fck);
  const fyd = fykCercos / gs;
  const NEd = x.NEd ?? 0;
  // σcp = NEd/Ac < 0,2 fcd (6.2.2(1)), compresión positiva
  const sigCp = (NEd * 1000) / x.Ac;
  const sigCpLim = Math.min(sigCp, 0.2 * fcd);
  const k = Math.min(2, 1 + Math.sqrt(200 / d));
  const rhoBruta = (x.Asl ?? 0) / (b0 * d);
  const rho = Math.min(rhoBruta, RHO_MAX);
  const z = x.z ?? 0.9 * d;
  return { fck, fcd, fctm, fyk: fykCercos, fyd, topada: false, NEd, sigCp, sigCpLim, k, rhoBruta, rho, rhoTopado: rhoBruta > RHO_MAX, z, gc, b0, d, CRdc: 0.18 / gc, k1: 0.15 };
}

/** VRd,c sin armadura de cortante (6.2.a y mínimo 6.2.b con νmin del AN), kN. */
export function VRdcSinArmadura(P) {
  const sig = P.k1 * P.sigCpLim;
  const conc = P.CRdc * P.k * Math.cbrt(100 * P.rho * P.fck) + sig;
  const nuMin = (0.075 / P.gc) * Math.pow(P.k, 1.5) * Math.sqrt(Math.min(P.fck, 60));
  const min = nuMin + sig;
  const f = (P.b0 * P.d) / 1000;
  return { VRdc: Math.max(conc, min, 0) * f, conc: Math.max(conc, 0) * f, min: Math.max(min, 0) * f, nuMin, minManda: min > conc };
}

/** ν1 de la biela (AN 6.2.3(3)): 0,6(1 − fck/250); con tensión de cálculo en los cercos menor que 0,8 fyk, 0,6 o 0,9 − fck/200 ≥ 0,5. */
export function nu1De(fck, sigSw, fyk) {
  if (sigSw < 0.8 * fyk - 1e-9) return fck <= 60 ? 0.6 : Math.max(0.9 - fck / 200, 0.5);
  return 0.6 * (1 - fck / 250);
}
/** αcw = 1 (estructuras no pretensadas); el axil no lo modifica (decisión del Prontuario, analisis/cortante-decisiones.md). */
export const ALFA_CW = 1;

/** VRd,máx (6.9 y 6.14), kN. */
export function VRdMax(P, nu1, cotT, cotA) {
  return (ALFA_CW * P.b0 * P.z * nu1 * P.fcd * (cotT + cotA)) / (1 + cotT * cotT) / 1000;
}

/** Armadura transversal mínima, mm²/mm: ρw,mín = fctm/(7,5 fyk) (AN 9.2.2(5)); Asw/s ≥ ρw,mín·bw·senα. */
export function AswSMinima(P, alfa = 90) {
  return ((P.fctm / (7.5 * P.fyk)) * P.b0 * Math.sin(rad(alfa)));
}

/** Fuerza de tracción adicional ΔFtd y decalaje al (6.18 y 9.2.1.3(2)). Sin armadura de cortante al = d. */
export function decalaje(VEd, cotT, cotA, z, d, sinArmadura = false) {
  if (sinArmadura) return { dT: null, sd: d };
  return { dT: 0.5 * VEd * (cotT - cotA), sd: Math.max(0, (z * (cotT - cotA)) / 2) };
}

/**
 * Comprobación a cortante. Con AswS = 0 o sinArmadura se calcula VRd,c.
 * @param {Object} x  igual que en ehe08.js (fck, fykCercos, b0, d, Ac, Asl, NEd, cotTheta, alfa, AswS, VEd, sinArmadura)
 */
export function comprobar(x) {
  const P = parametros(x);
  const alfa = x.alfa ?? 90;
  const cotT = x.cotTheta ?? 1;
  if (!(cotT >= COT_MIN - 1e-9 && cotT <= COT_MAX + 1e-9)) throw new ErrorClave('cor.errCot', cotT);
  if (!(alfa >= 45 && alfa <= 90)) throw new ErrorClave('cor.errAlfa');
  const avisos = [];
  const VEd = x.VEd ?? NaN;
  if (P.rhoTopado) avisos.push({ clave: 'cor.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (P.sigCp > 0.2 * P.fcd + 1e-9) avisos.push({ clave: 'cor.av.sigCp', args: [P.sigCp.toFixed(2), (0.2 * P.fcd).toFixed(2)] });
  const sin = x.sinArmadura || !((x.AswS ?? 0) > 0);
  const cotA = cot(alfa);
  const r = { P, norma: ID, alfa, cotTheta: cotT, theta: thetaDe(cotT), sinArmadura: sin, avisos, VEd, K: null, beta: null, cotE: null, reduc: 1 };

  if (sin) {
    const s = VRdcSinArmadura(P);
    Object.assign(r, { VRdc: s.VRdc, VRdcConc: s.conc, VRdcMin: s.min, nuMin: s.nuMin, minManda: s.minManda, Vu: s.VRdc, Vu2: s.VRdc, Vu1: null, Vcu: s.VRdc, Vsu: 0, mandaBiela: false });
  } else {
    const unidad = (P.z * P.fyd * Math.sin(rad(alfa)) * (cotT + cotA)) / 1000; // kN por mm²/mm
    const VRds = x.AswS * unidad;
    // Tensión de cálculo en los cercos para elegir ν1: con VEd la que piden; sin él, la de cálculo del acero
    const sigSw = Number.isFinite(VEd) ? Math.min(P.fyd, VEd / (x.AswS * unidad / P.fyd)) : P.fyd;
    const nu1 = nu1De(P.fck, sigSw, P.fyk);
    const Vmax = VRdMax(P, nu1, cotT, cotA);
    Object.assign(r, { VRds, VRdMax: Vmax, nu1, sigSw, alfaCw: ALFA_CW, Vu1: Vmax, Vu2: VRds, Vsu: VRds, Vcu: 0, Vu: Math.min(VRds, Vmax), mandaBiela: Vmax < VRds });
    const mn = AswSMinima(P, alfa);
    r.minima = { AswSMin: mn, rhoW: x.AswS / (P.b0 * Math.sin(rad(alfa))), rhoWMin: P.fctm / (7.5 * P.fyk), ok: x.AswS >= mn - 1e-12 };
    if (!r.minima.ok) avisos.push({ clave: 'cor.av.minima', args: [(x.AswS * 1000).toFixed(0), (mn * 1000).toFixed(0), '9.2.2(5)'] });
    if (alfa < 90) avisos.push({ clave: 'cor.av.tercioEC2' });
  }
  if (Number.isFinite(VEd)) {
    r.aprov = VEd / r.Vu;
    const Vmax = sin ? VRdMaxReferencia(P, cotT, cotA) : r.VRdMax;
    r.sep = sepMaxima(VEd, Vmax, P.d, alfa);
    r.sepTrans = Math.min(P.d, 500);
    r.long = decalaje(VEd, cotT, cotA, P.z, P.d, sin);
  }
  return r;
}

/** VRd,máx de referencia para las separaciones cuando no hay cercos: con ν1 de la norma sin reducir por tensión. */
const VRdMaxReferencia = (P, cotT, cotA) => VRdMax(P, nu1De(P.fck, P.fyd, P.fyk), cotT, cotA);

/** Armadura transversal necesaria para VEd con el ángulo dado: (Asw/s)nec = VEd/(z fywd (cotθ + cotα) senα), mm²/mm. */
export function AswSNecesaria(x, VEd) {
  const c = comprobar({ ...x, VEd, AswS: 1e-6, sinArmadura: false });
  const P = c.P;
  const alfa = x.alfa ?? 90;
  const unidad = (P.z * P.fyd * Math.sin(rad(alfa)) * (c.cotTheta + cot(alfa))) / 1000;
  const nec = VEd / unidad;
  const mn = AswSMinima(P, alfa);
  const nuAlto = nu1De(P.fck, 0, P.fyk);
  const VmaxAlto = VRdMax(P, nuAlto, c.cotTheta, cot(alfa));
  // Con ν1 reducido (σ ≥ 0,8 fyk) la biela puede no bastar aunque sí con más armadura, que baja la tensión de los cercos
  let usar = Math.max(nec, mn);
  let extra = null;
  if (VEd <= VmaxAlto) {
    const baja = VEd / (unidad * 0.8 * P.fyk) * (1 + 1e-9);
    const cm = comprobar({ ...x, VEd, AswS: usar, sinArmadura: false });
    if (VEd > cm.VRdMax) { usar = Math.max(usar, baja); extra = 'biela'; }
  }
  return { c, nec, mn, usar, manda: extra ? 'biela' : nec >= mn ? 'calculo' : 'minima', Vcu: 0, Vu1: VmaxAlto };
}

/** Dimensionamiento: armadura para VEd y tabla de cercos Ø × s. */
export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20], ramas } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('cor.errVEd');
  const n = AswSNecesaria(x, VEd);
  const P = n.c.P;
  const alfa = x.alfa ?? 90;
  const sin = VRdcSinArmadura(P);
  const r = { P, norma: ID, VEd, Vu1: n.Vu1, Vcu: 0, AswSNec: n.nec, AswSMin: n.mn, AswS: n.usar, manda: n.manda, avisos: [...n.c.avisos.filter((a) => a.clave !== 'cor.av.minima')] };
  r.cotTheta = n.c.cotTheta; r.theta = n.c.theta; r.beta = null; r.cotE = null; r.K = null; r.alfa = alfa;
  r.Vu2SinArm = sin.VRdc;
  if (VEd > n.Vu1) {
    r.caso = 'biela';
    return r;
  }
  r.caso = n.manda === 'minima' ? 'minima' : 'calculo';
  r.sinArmaduraBasta = VEd <= sin.VRdc;
  const cm = comprobar({ ...x, VEd, AswS: n.usar, sinArmadura: false });
  r.nu1 = cm.nu1;
  r.sMax = sepMaxima(VEd, cm.VRdMax, P.d, alfa);
  const sTope = Math.floor(Math.min(r.sMax, S_TABLA_MAX) / S_TABLA_PASO) * S_TABLA_PASO;
  const nr = ramas ?? (x.circular ? 2 : x.b0 < 500 ? 2 : 4);
  r.ramas = nr;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    const sOk = Math.floor(Math.min(sTope, (nr * Ab) / n.usar) / S_TABLA_PASO) * S_TABLA_PASO;
    if (sOk < S_TABLA_PASO) return { fi, ramas: nr, s: null };
    const AswS = AswSDe(fi, nr, sOk);
    const v = comprobar({ ...x, VEd, AswS, sinArmadura: false });
    return { fi, ramas: nr, s: sOk, AswS, Vsu: v.VRds, Vu2: v.VRds, Vu: v.Vu };
  });
  r.long = decalaje(VEd, n.c.cotTheta, cot(alfa), P.z, P.d);
  return r;
}

/**
 * cotg θ óptimo (rejilla de 0,01): con VEd y armadura dada, el que da mayor VRd = mín(VRd,s; VRd,máx); en
 * dimensionamiento (dim), el que pide menos armadura entre los que cumplen la biela.
 */
export function cotOptimo(x, { VEd, dim = false } = {}) {
  let mejor = null;
  for (let c = COT_MIN; c <= COT_MAX + 1e-9; c += 0.01) {
    const cotTheta = Math.round(c * 100) / 100;
    let valor;
    try {
      if (dim) {
        const n = AswSNecesaria({ ...x, cotTheta }, VEd);
        if (VEd > n.Vu1) continue;
        valor = -n.usar;
      } else {
        valor = comprobar({ ...x, cotTheta, VEd }).Vu;
      }
    } catch { continue; }
    if (!mejor || valor > mejor.valor + 1e-9 || (Math.abs(valor - mejor.valor) <= 1e-9 && Math.abs(cotTheta - 1) < Math.abs(mejor.cotTheta - 1))) mejor = { cotTheta, valor };
  }
  return mejor?.cotTheta ?? 1;
}
