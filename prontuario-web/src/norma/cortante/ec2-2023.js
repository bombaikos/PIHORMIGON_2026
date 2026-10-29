// Esfuerzo cortante de piezas lineales según la EN 1992-1-1:2023 (EC-2 2023), 8.2, expresado en esfuerzos (kN):
// las tensiones de 8.2 se multiplican por bw·z con z = 0,9 d (8.18). Versión simplificada: ν = 0,5 (8.2.3(6)),
// sin el método refinado de ν(εx) (8.45), sin pretensado y sin las cargas próximas al apoyo (8.2.2(9), 8.2.3(12)).
// Sin armadura: VRd,c = τRd,c·bw·z ≥ VRdc,min (8.20 y 8.27). Con armadura: solo la celosía,
// VRd = mín(VRd,s; VRd,máx) (8.42, 8.44), sin aporte del hormigón. Mínima: 12.4; separaciones: Tabla 12.1.
// Unidades: MPa, mm y kN. En la interfaz y en el núcleo la compresión es positiva; la norma usa tracción
// positiva en 8.31 y 8.50-8.52, así que aquí se convierte una sola vez (NEdN = −NEd).
// Mismo contrato que ehe08.js y ec2-2004.js (comprobar, dimensionar, cotOptimo, rangoCot).
// Textos de la norma: analisis/normativa/ec2-2023/texto.txt, 8.2 (l.4695-5200) y 12.2(4), 12.3 (l.8180-8300).

import { EC2_2023 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { S_TABLA_MAX, S_TABLA_PASO, areaRama, AswSDe, thetaDe } from './ehe08.js';

export { areaRama, AswSDe, thetaDe };
export const ID = 'EC2-2023';
/** Rango por defecto de cotg θ (8.41): de 1 a cotg θmín. Las cotas reales dependen del axil y de la ductilidad: rangoCot. */
export const COT_MIN = 1;
export const COT_MAX = 2.5;
/** ν de la biela con los ángulos de 8.41 (8.2.3(6)). */
export const NU = 0.5;
/** Tamaño por defecto del árido grueso (mm), para ddg. */
export const DLOWER_DEFECTO = 20;

const rad = (g) => (g * Math.PI) / 180;
const cot = (g) => 1 / Math.tan(rad(g));

/** ddg (8.2.1(4)): 16 + Dlower ≤ 40 mm (fck ≤ 60); 16 + Dlower (60/fck)² ≤ 40 mm (fck > 60). */
export function ddgDe(fck, Dlower = DLOWER_DEFECTO) {
  return Math.min(40, fck <= 60 ? 16 + Dlower : 16 + Dlower * (60 / fck) ** 2);
}

/** Factor de los cercos por la sección: bw/Dh en circulares (8.2.3(9)); 1 en el resto. */
const factorCercos = (x) => (x.circular && x.Dh > 0 ? Math.min(1, x.b0 / x.Dh) : 1);

/** Valores derivados comunes. */
export function parametros(x) {
  const { fck, fykCercos, b0, d } = x;
  if (!(fck > 0) || !(b0 > 0) || !(d > 0) || !(x.Ac > 0)) throw new ErrorClave('cor.errDatos');
  if (fck > EC2_2023.fckMax) throw new ErrorClave('cor.errFck', EC2_2023.fckMax);
  const gc = EC2_2023.gammaC;
  const gs = EC2_2023.gammaS;
  const gv = EC2_2023.gammaV;
  const fcd = (EC2_2023.alfaCC(fck) * fck) / gc;
  const fctm = EC2_2023.fctm(fck);
  const fyd = fykCercos / gs;
  // Armadura longitudinal que sirvió para el diseño a flexión: fyd con el acero longitudinal (8.20)
  const fydLong = (x.fykLong ?? fykCercos) / gs;
  const NEd = x.NEd ?? 0; // compresión +
  const NEdN = -NEd; // tracción + (convención de la norma)
  const ddg = ddgDe(fck, x.Dlower ?? DLOWER_DEFECTO);
  const z = x.z ?? 0.9 * d;
  const rho = (x.Asl ?? 0) / (b0 * d);
  const MEd = Number.isFinite(x.MEd) && x.MEd > 0 ? x.MEd : null; // kN·m, valor absoluto
  return { fck, fcd, fctm, fyk: fykCercos, fyd, fydLong, NEd, NEdN, gc, gv, ddg, z, rho, b0, d, MEd, ductilidad: x.ductilidad ?? 'B', sigCp: (NEd * 1000) / x.Ac };
}

/** Cotas de cotg θ (8.41): [1 (o tan(α/2) con cercos inclinados), cotg θmín], con cotg θmín según axil y ductilidad. */
export function rangoCot(x, VEd = NaN) {
  const P = parametros(x);
  let max = 2.5;
  const trac = P.NEdN > 0 && Number.isFinite(VEd) && Math.abs(VEd) > 0;
  if (trac) max = Math.max(1, 2.5 - (0.1 * P.NEdN) / Math.abs(VEd));
  if (P.ductilidad === 'A') max *= 0.8;
  const alfa = x.alfa ?? 90;
  const min = alfa >= 90 ? 1 : Math.tan(rad(alfa) / 2);
  return { min, max: Math.max(min, max) };
}

/** Longitud de cortante efectiva (8.2.2(3)-(4)): d_ef = av·kvp con MEd; sin MEd no se tiene en cuenta el axil ni la esbeltez. */
export function dEfectivo(P, VEd) {
  const base = { dEf: P.d, av: P.d, acs: null, kvp: 1, usado: false };
  if (!P.MEd || !(Math.abs(VEd) > 0)) return base;
  const acs = Math.max((P.MEd * 1000) / Math.abs(VEd), P.d);
  const av = acs < 4 * P.d ? Math.sqrt((acs * P.d) / 4) : P.d;
  const kvp = Math.max(0.1, 1 + (P.NEdN / Math.abs(VEd)) * (P.d / (3 * acs)));
  return { dEf: av * kvp, av, acs, kvp, usado: true };
}

/** VRd,c sin armadura (8.27) y mínimo VRdc,min (8.20), kN. */
export function VRdcSinArmadura(P, VEd = NaN) {
  const e = dEfectivo(P, VEd);
  const tauC = ((0.66 / P.gv) * Math.cbrt(100 * Math.max(P.rho, 0) * P.fck * (P.ddg / e.dEf)));
  const tauMin = (11 / P.gv) * Math.sqrt((P.fck / P.fydLong) * (P.ddg / P.d));
  const f = (P.b0 * P.z) / 1000;
  return { VRdc: Math.max(tauC, tauMin) * f, conc: tauC * f, min: tauMin * f, tauC, tauMin, minManda: tauMin > tauC, ...e };
}

/** VRd,máx (8.44 y 8.60), kN. */
export function VRdMax(P, cotT, cotA) {
  return (NU * P.fcd * P.b0 * P.z * (cotT + cotA)) / (1 + cotT * cotT) / 1000;
}

/** Armadura transversal mínima, mm²/mm (12.4): ρw,mín = 0,08 √fck/fyk (−10 % acero B, −20 % acero C); Asw/s ≥ ρw,mín·bw·senα. */
export function rhoWMin(P) {
  const k = P.ductilidad === 'C' ? 0.8 : P.ductilidad === 'B' ? 0.9 : 1;
  return (0.08 * Math.sqrt(P.fck) * k) / P.fyk;
}
export const AswSMinima = (P, alfa = 90) => rhoWMin(P) * P.b0 * Math.sin(rad(alfa));

/** Separaciones de la Tabla 12.1: longitudinal 0,75 d (1 + cotα); entre ramas 0,75 d ≤ 600 mm. */
export function separaciones(d, alfa = 90) {
  return { sep: 0.75 * d * (1 + (alfa >= 90 ? 0 : cot(alfa))), sepTrans: Math.min(0.75 * d, 600) };
}

/** Fuerza adicional NVd (8.50, 8.61), cordón traccionado Ftd (8.51) y decalaje al (12.5, 12.6). */
export function longitudinal(P, VEd, cotT, cotA, sinArmadura = false) {
  if (sinArmadura) return { NVd: null, dT: null, Ftd: null, sd: P.d };
  const NVd = Math.abs(VEd) * (cotT - cotA);
  // NVd se reparte entre los dos cordones: ΔFtd = NVd/2 es lo que el cortante añade a la tracción del cordón traccionado
  // (igual que ΔFtd del EC-2 2004); Ftd es la fuerza total con momento, cortante y axil (8.51)
  const Ftd = P.MEd ? (P.MEd * 1000) / P.z + (NVd + P.NEdN) / 2 : null;
  return { NVd, dT: NVd / 2, Ftd, sd: Math.max(0, (P.z * (cotT - cotA)) / 2) };
}

/**
 * Comprobación a cortante. Con AswS = 0 o sinArmadura se calcula VRd,c.
 * @param {Object} x  fck, fykCercos, fykLong, b0, d, Ac, Asl, NEd (compresión +), MEd (kN·m, opcional), Dlower (mm),
 *                    ductilidad ('A'|'B'|'C'), cotTheta, alfa, AswS, VEd, sinArmadura, circular, Dh
 */
export function comprobar(x) {
  const P = parametros(x);
  const alfa = x.alfa ?? 90;
  const cotT = x.cotTheta ?? 1;
  const VEd = x.VEd ?? NaN;
  const rg = rangoCot(x, VEd);
  if (!(cotT >= rg.min - 1e-9 && cotT <= rg.max + 1e-9)) throw new ErrorClave('cor.errCotRango', fmt2(cotT), fmt2(rg.min), fmt2(rg.max));
  if (!(alfa >= 45 && alfa <= 90)) throw new ErrorClave('cor.errAlfa');
  const avisos = [];
  const sin = x.sinArmadura || !((x.AswS ?? 0) > 0);
  const cotA = cot(alfa);
  const r = { P, norma: ID, alfa, cotTheta: cotT, theta: thetaDe(cotT), rango: rg, sinArmadura: sin, avisos, VEd, K: null, beta: null, cotE: null, reduc: 1 };
  if (sin && !P.MEd) avisos.push({ clave: 'cor.av.sinMEd' });

  if (sin) {
    const s = VRdcSinArmadura(P, VEd);
    // VRd,máx de referencia (cotg θ = 1, el mayor): con más cortante ni con cercos cumpliría
    const VmaxRef = VRdMax(P, 1, 0);
    Object.assign(r, { VRdc: s.VRdc, VRdcConc: s.conc, VRdcMin: s.min, tauC: s.tauC, tauMin: s.tauMin, minManda: s.minManda, dEf: s.dEf, av: s.av, acs: s.acs, kvp: s.kvp, efecto: s.usado,
      Vu: s.VRdc, Vu2: s.VRdc, Vu1: null, VmaxRef, Vcu: s.VRdc, Vsu: 0, mandaBiela: false });
    if (Number.isFinite(VEd)) {
      if (VEd > VmaxRef) avisos.push({ clave: 'cor.av.sinBiela', args: [VEd.toFixed(0), VmaxRef.toFixed(0), '8.2.3(5), (6)'] });
      // Armadura mínima en vigas aunque VEd ≤ VRd,c (8.2.1(2)); obligatoria con d > 500 mm en vigas isostáticas
      else if (VEd <= s.VRdc && x.viga !== false) {
        avisos.push({ clave: 'cor.av.minObligatoria', args: ['8.2.1(2)'] });
        if (P.d > 500) avisos.push({ clave: 'cor.av.d500' });
      }
    }
  } else {
    const fc = factorCercos(x);
    const AswEf = x.AswS * fc;
    const unidad = (P.z * P.fyd * Math.sin(rad(alfa)) * (cotT + cotA)) / 1000; // kN por mm²/mm
    const VRds = AswEf * unidad;
    const Vmax = VRdMax(P, cotT, cotA);
    Object.assign(r, { VRds, VRdMax: Vmax, nu: NU, factorCirc: fc, AswEf, Vu1: Vmax, Vu2: VRds, Vsu: VRds, Vcu: 0, Vu: Math.min(VRds, Vmax), mandaBiela: Vmax < VRds });
    const mn = AswSMinima(P, alfa);
    r.minima = { AswSMin: mn, rhoW: AswEf / (P.b0 * Math.sin(rad(alfa))), rhoWMin: rhoWMin(P), ok: AswEf >= mn - 1e-12 };
    if (!r.minima.ok) avisos.push({ clave: 'cor.av.minima', args: [(AswEf * 1000).toFixed(0), (mn * 1000).toFixed(0), '12.2(4)'] });
    if (alfa < 90) avisos.push({ clave: 'cor.av.tercioEC2' });
    if (fc < 1) avisos.push({ clave: 'cor.av.circ2023', args: [fc.toFixed(2)] });
  }
  if (Number.isFinite(VEd)) {
    r.aprov = VEd / r.Vu;
    const sp = separaciones(P.d, alfa);
    r.sep = sp.sep;
    r.sepTrans = sp.sepTrans;
    r.long = longitudinal(P, VEd, cotT, cotA, sin);
  }
  return r;
}
const fmt2 = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/** Armadura transversal necesaria para VEd con el ángulo dado: (Asw/s)nec = VEd/(z fywd (cotθ + cotα) senα), mm²/mm. */
export function AswSNecesaria(x, VEd) {
  const c = comprobar({ ...x, VEd, AswS: 1e-6, sinArmadura: false });
  const P = c.P;
  const alfa = x.alfa ?? 90;
  const unidad = (P.z * P.fyd * Math.sin(rad(alfa)) * (c.cotTheta + cot(alfa))) / 1000;
  // Con cercos circulares la armadura que cuenta es Asw·bw/Dh: hay que colocar más
  const nec = VEd / unidad / factorCercos(x);
  const mn = AswSMinima(P, alfa) / factorCercos(x);
  const Vmax = VRdMax(P, c.cotTheta, cot(alfa));
  return { c, nec, mn, usar: Math.max(nec, mn), manda: nec >= mn ? 'calculo' : 'minima', Vcu: 0, Vu1: Vmax };
}

/** Dimensionamiento: armadura para VEd y tabla de cercos Ø × s. */
export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20], ramas } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('cor.errVEd');
  const n = AswSNecesaria(x, VEd);
  const P = n.c.P;
  const alfa = x.alfa ?? 90;
  const sin = VRdcSinArmadura(P, VEd);
  const r = { P, norma: ID, VEd, Vu1: n.Vu1, Vcu: 0, AswSNec: n.nec, AswSMin: n.mn, AswS: n.usar, manda: n.manda, avisos: [...n.c.avisos.filter((a) => a.clave !== 'cor.av.minima')] };
  r.cotTheta = n.c.cotTheta; r.theta = n.c.theta; r.rango = n.c.rango; r.beta = null; r.cotE = null; r.K = null; r.alfa = alfa;
  r.Vu2SinArm = sin.VRdc;
  r.sinArm = sin;
  if (VEd > n.Vu1) {
    r.caso = 'biela';
    return r;
  }
  r.caso = n.manda === 'minima' ? 'minima' : 'calculo';
  r.sinArmaduraBasta = VEd <= sin.VRdc;
  // VEd ≤ VRd,c: no se requiere armadura de cortante calculada (8.2.1(1)b); queda la mínima (12.2(4))
  if (r.sinArmaduraBasta) {
    r.caso = 'minima'; r.manda = 'minima'; r.AswSNec = 0; n.usar = n.mn; r.AswS = n.mn;
    r.avisos.push({ clave: 'cor.av.bastaSinArm', args: [VEd.toFixed(0), sin.VRdc.toFixed(0)] });
  }
  const sp = separaciones(P.d, alfa);
  r.sMax = sp.sep;
  const sTope = Math.floor(Math.min(r.sMax, S_TABLA_MAX) / S_TABLA_PASO) * S_TABLA_PASO;
  const nr = ramas ?? (x.circular ? 2 : x.b0 < 500 ? 2 : 4);
  r.ramas = nr;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    const sOk = Math.floor(Math.min(sTope, (nr * Ab) / n.usar) / S_TABLA_PASO) * S_TABLA_PASO;
    if (sOk < S_TABLA_PASO) return { fi, ramas: nr, s: null };
    const AswS = AswSDe(fi, nr, sOk);
    const v = comprobar({ ...x, VEd, AswS, sinArmadura: false });
    // Si VEd ≤ VRd,c la pieza resiste al menos VRd,c aunque los cercos mínimos aporten menos
    return { fi, ramas: nr, s: sOk, AswS, Vsu: v.VRds, Vu2: v.VRds, Vu: r.sinArmaduraBasta ? Math.max(v.Vu, sin.VRdc) : v.Vu };
  });
  r.long = longitudinal(P, VEd, n.c.cotTheta, cot(alfa));
  return r;
}

/**
 * cotg θ óptimo (rejilla de 0,01): con VEd y armadura dada, el que da mayor VRd = mín(VRd,s; VRd,máx); en
 * dimensionamiento (dim), el que pide menos armadura entre los que cumplen la biela.
 */
export function cotOptimo(x, { VEd, dim = false } = {}) {
  const { min, max } = rangoCot(x, VEd);
  let mejor = null;
  for (let c = Math.ceil(min * 100 - 1e-9); c <= Math.floor(max * 100 + 1e-9); c++) {
    const cotTheta = c / 100;
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
  return mejor?.cotTheta ?? min;
}
