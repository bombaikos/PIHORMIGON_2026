// Torsión pura de piezas lineales rectangulares con las tres normas del Prontuario (sección hueca eficaz equivalente):
//  · EHE-08, art. 45.2 (Tu1, Tu2, Tu3; 45.2.3 separación de cercos),
//  · EC-2 2004 + AN, 6.3.2 ((6.28) Asl, (6.30) TRd,máx; cercos como en 6.2.3 con VEd,i = τt,i·tef·zi),
//  · EC-2 2023, 8.3.4 ((8.82)-(8.84); recubrimiento reducido 8.3.4(5)).
// No hay interacción con cortante, flexión ni axil: el usuario suma a mano (EHE-08 45.3; EC-2 2004 6.3.2(2),(3),(4);
// EC-2 2023 8.3.5, 8.3.6). Unidades: MPa, mm, mm² y kN; los torsores salen en kN·m. Compresión positiva.
// Textos: analisis/normativa/ehe-08/texto.txt l.10671-10945, ec2-2004-an/texto.txt l.4233-4335, ec2-2023/texto.txt l.5456-5560.

import { EHE08, EC2_2004, EC2_2023 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';

export const FYD_TOPE_EHE = 400;
export const S_TABLA_MAX = 300;
export const S_TABLA_PASO = 50;
export const areaRama = (fi) => (Math.PI * fi * fi) / 4;
const RAD = Math.PI / 180;
export const thetaDe = (cot) => Math.atan(1 / cot) / RAD;

const NORMAS = {
  'EHE-08': { id: 'EHE-08', def: EHE08, cotMin: 0.5, cotMax: 2.0 },
  'EC2-2004': { id: 'EC2-2004', def: EC2_2004, cotMin: 0.5, cotMax: 2.0 },
  'EC2-2023': { id: 'EC2-2023', def: EC2_2023, cotMin: 1 / 2.5, cotMax: 2.5 },
};
/** Núcleo de la norma del proyecto (EHE-98 migra a EHE-08), o null. */
export function nucleo(normaId) {
  const id = normaId === 'EHE-98' ? 'EHE-08' : normaId;
  const n = NORMAS[id];
  return n ? { id, rangoCot: () => ({ min: n.cotMin, max: n.cotMax }), comprobar: (x) => comprobar(id, x), dimensionar: (x, Td, o) => dimensionar(id, x, Td, o), geometria: (x) => geometria(id, x), resistencias: (id2 = id, x) => parametros(id2, x) } : null;
}

/** Sección hueca eficaz: he = A/u (≥ 2c); Ae y ue de la línea media. Con la 2023 y b_máx/b_mín < 1,5, c ≤ 0,07·b_mín (8.3.4(5)). */
export function geometria(id, { b, h, c, he: heUsuario }) {
  if (!(b > 0) || !(h > 0) || !(c >= 0)) throw new ErrorClave('tor.errDatos');
  const bmin = Math.min(b, h);
  const bmax = Math.max(b, h);
  const cRed = id === 'EC2-2023' && bmax / bmin < 1.5 && c > 0.07 * bmin;
  const cEf = cRed ? 0.07 * bmin : c;
  const A = b * h;
  const u = 2 * (b + h);
  const heNom = A / u;
  const heMin = 2 * cEf;
  const heMax = Math.max(heNom, heMin);
  const he = Math.min(Math.max(heUsuario ?? heMax, heMin), heMax, bmin / 2 - 1e-6);
  if (!(he > 0) || he > bmin / 2) throw new ErrorClave('tor.errHe');
  const bk = b - he;
  const hk = h - he;
  return { b, h, c, cEf, cRed, A, u, heNom, heMin, heMax, he, heTopado: heUsuario == null && heMin > heNom, bk, hk, Ae: bk * hk, ue: 2 * (bk + hk) };
}

/** Resistencias de cálculo y coeficiente de la biela de cada norma. */
export function parametros(id, x) {
  const { fck, fykCercos, fykLong } = x;
  const def = NORMAS[id].def;
  if (!(fck > 0) || !(fykCercos > 0) || !(fykLong > 0)) throw new ErrorClave('tor.errDatos');
  if (fck > def.fckMax) throw new ErrorClave('cor.errFck', def.fckMax);
  const gs = def.gammaS;
  const fydLibre = fykCercos / gs;
  const fyl = fykLong / gs;
  if (id === 'EHE-08') {
    const fcd = (def.alfaCC() * fck) / def.gammaC;
    const f1cd = (fck <= 60 ? 0.6 : Math.max(0.9 - fck / 200, 0.5)) * fcd;
    const alfa = x.alfaCercos ?? 0.6; // 0,60 cercos solo en el perímetro exterior; 0,75 cercos en ambas caras (45.2.2.1)
    const fyt = Math.min(fydLibre, FYD_TOPE_EHE);
    return { fck, fcd, f1cd, K: 1, alfa, nu: null, fyt, fytLibre: fydLibre, topada: fydLibre > FYD_TOPE_EHE, fyl, gc: def.gammaC };
  }
  if (id === 'EC2-2004') {
    const fcd = (def.alfaCC() * fck) / def.gammaC;
    return { fck, fcd, nu: 0.6 * (1 - fck / 250), fyt: fydLibre, fytLibre: fydLibre, topada: false, fyl, gc: def.gammaC };
  }
  const fcd = (def.alfaCC(fck, { ktc: x.ktc }) * fck) / def.gammaC;
  return { fck, fcd, nuBase: 0.5, fyt: fydLibre, fytLibre: fydLibre, topada: false, fyl, gc: def.gammaC, ktc: x.ktc ?? 0.85 };
}

const rad = (g) => g * RAD;
const sc = (cot) => cot / (1 + cot * cot); // senθ·cosθ

/** Torsor que agotan las bielas, kN·m. */
export function Tu1(id, P, G, cot) {
  const f = sc(cot);
  if (id === 'EHE-08') return (2 * P.K * P.alfa * P.f1cd * G.Ae * G.he * f) / 1e6;
  const nu = id === 'EC2-2023' ? (Math.abs(cot - 1) < 1e-9 ? 0.6 : P.nuBase) : P.nu;
  return (2 * nu * P.fcd * G.Ae * G.he * f) / 1e6;
}
export const nuDe = (id, P, cot) => (id === 'EHE-08' ? null : id === 'EC2-2023' ? (Math.abs(cot - 1) < 1e-9 ? 0.6 : P.nuBase) : P.nu);
/** Torsor que agotan los cercos, kN·m. AtS = área de una rama / separación (mm²/mm). */
export const Tu2 = (P, G, cot, AtS) => (2 * G.Ae * AtS * P.fyt * cot) / 1e6;
/** Torsor que agotan las barras longitudinales, kN·m. */
export const Tu3 = (P, G, cot, Al) => (2 * G.Ae * Al * P.fyl) / (G.ue * cot) / 1e6;

/** Separación máxima entre cercos, mm: u_e/8 (todas) y, en la EHE-08, las condiciones de 45.2.3 según Td/Tu1. */
export function sepMaxima(id, G, Td, Tu1v) {
  const ue8 = G.ue / 8;
  if (id !== 'EHE-08') return { sMax: ue8, ue8, tramo: null, a: null };
  const a = Math.min(G.bk, G.hk);
  const r = Td / Tu1v;
  const [k, tope, tramo] = r <= 1 / 5 ? [0.75, 600, 1] : r <= 2 / 3 ? [0.6, 450, 2] : [0.3, 300, 3];
  return { sMax: Math.min(ue8, k * a, tope), ue8, tramo, a };
}

function avisosBase(P, G) {
  const av = [];
  if (P.topada) av.push({ clave: 'tor.av.fyd400', args: [P.fytLibre.toFixed(1)] });
  if (G.heTopado) av.push({ clave: 'tor.av.he2c', args: [G.heNom.toFixed(0), G.heMin.toFixed(0)] });
  if (G.cRed) av.push({ clave: 'tor.av.cRed', args: [G.cEf.toFixed(1)] });
  return av;
}

/**
 * Comprobación. x: { fck, ktc?, fykCercos, fykLong, b, h, c, he?, cotTheta, AtS (mm²/mm), s, Al (mm²), TEd (kN·m), alfaCercos? }
 */
export function comprobar(id, x) {
  const G = geometria(id, x);
  const P = parametros(id, x);
  const cot = x.cotTheta;
  const Td = x.TEd;
  const t1 = Tu1(id, P, G, cot);
  const t2 = Tu2(P, G, cot, x.AtS);
  const t3 = Tu3(P, G, cot, x.Al);
  const Tu = Math.min(t1, t2, t3);
  const sm = sepMaxima(id, G, Td, t1);
  const avisos = avisosBase(P, G);
  const sepOk = !(x.s > sm.sMax + 1e-9);
  if (!sepOk) avisos.push({ clave: 'tor.av.sep', args: [Math.round(x.s), Math.round(sm.sMax)] });
  const manda = Tu === t1 ? 'biela' : Tu === t2 ? 'cercos' : 'longitudinal';
  return { norma: id, P, G, cotTheta: cot, theta: thetaDe(cot), nu: nuDe(id, P, cot), Tu1: t1, Tu2: t2, Tu3: t3, Tu, TEd: Td, aprov: Td / Tu, ap1: Td / t1, ap2: Td / t2, ap3: Td / t3, manda, sep: sm, sepOk, avisos };
}

/**
 * Dimensionamiento. Devuelve AtS y Al necesarias y una tabla ø × separación (una rama por pared).
 */
export function dimensionar(id, x, Td, { diametros = [8, 10, 12, 16] } = {}) {
  const G = geometria(id, x);
  const P = parametros(id, x);
  const cot = x.cotTheta;
  const t1 = Tu1(id, P, G, cot);
  const avisos = avisosBase(P, G);
  const base = { norma: id, P, G, cotTheta: cot, theta: thetaDe(cot), nu: nuDe(id, P, cot), Tu1: t1, TEd: Td, avisos };
  if (Td > t1 + 1e-9) return { ...base, caso: 'biela', aprov: Td / t1 };
  const AtS = (Td * 1e6) / (2 * G.Ae * P.fyt * cot);
  const Al = (Td * 1e6 * G.ue * cot) / (2 * G.Ae * P.fyl);
  const sm = sepMaxima(id, G, Td, t1);
  const reparto = {
    sup: (Al * G.bk) / G.ue, inf: (Al * G.bk) / G.ue, lat: (Al * G.hk) / G.ue, // cada cara de la línea media; lat = cada lado vertical
  };
  const sTope = Math.floor(sm.sMax / S_TABLA_PASO) * S_TABLA_PASO;
  const tabla = diametros.map((fi) => {
    const A = areaRama(fi);
    const sNec = A / AtS;
    const s = Math.floor(Math.min(sNec, sTope, S_TABLA_MAX) / S_TABLA_PASO) * S_TABLA_PASO;
    return s >= S_TABLA_PASO ? { fi, s, AtS: A / s, Tu2: Tu2(P, G, cot, A / s) } : { fi, s: null };
  });
  return { ...base, caso: 'ok', aprov: Td / t1, AtS, Al, reparto, sep: sm, tabla };
}
