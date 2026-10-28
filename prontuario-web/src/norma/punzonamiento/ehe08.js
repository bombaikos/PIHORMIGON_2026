// Punzonamiento de losas según la EHE-08, art. 46: losas sin armadura (46.3), con armadura transversal (46.4.1),
// zona exterior (46.4.2) y biela junto al pilar (46.4.3). Puerto del módulo TT3 del Prontuario 3.1 (EHE-98) con los
// cambios de la EHE-08: mínimo de τrd, σ'cd, 0,75·τrd con cercos, fyα,d ≤ 400 MPa y u0 de 46.4.3.
// Seis tipos de pilar (rectangular o circular; interior, borde o esquina), cercos verticales, losa maciza.
// Unidades: MPa, mm y kN. Compresión positiva. Textos de la norma: analisis/normativa/ehe-08/texto.txt, art. 46
// (l.11052-11470).
//   [verificar contra el BOE] el exponente ½ y el 0,075 del mínimo de τrd, el 0,75 y el 1,5 de 46.4.1 y el tope
//   de fcv (60 MPa); las figuras 46.5 (un,ef y disposiciones) no se extraen del PDF.

import { EHE08 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { areaRama } from '../cortante/ehe08.js';
import { perimetro, perimetroCara, deltaDePerimetro, validarPilar, validarArmadura, anillos, nPerimetrosExt, uExterior, ramasDe } from './comun.js';

export { areaRama };
export const ID = 'EHE-08';
/** Tope de fyα,d de las armaduras de punzonamiento (46.4.1). */
export const FYD_TOPE = 400;
/** Cuantía geométrica máxima (46.3). */
export const RHO_MAX = 0.02;
/** Distancias máximas del criterio de disposición (figura 46.5: primer perímetro d/2, radial 0,75 d). */
export const A1_MAX = 0.5;
export const SR_MAX = 0.75;
export const ST_MAX = 1.5;

/** Valores derivados comunes a todas las comprobaciones. */
export function parametros(x) {
  validarPilar(x);
  const { fck, d } = x;
  if (!(fck > 0)) throw new ErrorClave('pun.errDatos');
  if (fck > EHE08.fckMax) throw new ErrorClave('pun.errFck', EHE08.fckMax);
  const gc = EHE08.gammaC;
  const fcd = (EHE08.alfaCC() * fck) / gc;
  const fydLibre = (x.fykCercos ?? 500) / EHE08.gammaS;
  const fyd = Math.min(fydLibre, FYD_TOPE);
  const sigCd = x.sigCd ?? 0;
  const sigCdLim = Math.min(sigCd, 0.3 * fcd, 12);
  const xi = Math.min(2, 1 + Math.sqrt(200 / d));
  const rhoBruta = Math.sqrt(Math.max(0, x.rhoX ?? 0) * Math.max(0, x.rhoY ?? 0));
  const rho = Math.min(rhoBruta, RHO_MAX);
  const fcv = Math.min(fck, 60);
  const f1cd = fck <= 60 ? 0.6 * fcd : Math.max(0.9 - fck / 200, 0.5) * fcd;
  return { fck, fcd, fcv, f1cd, fyd, fydLibre, topada: fydLibre > FYD_TOPE, gc, d, sigCd, sigCdLim, xi, rhoBruta, rho, rhoTopado: rhoBruta > RHO_MAX };
}

/** τrd (46.3): fórmula general y mínimo; vale el mayor. MPa. */
export function tauRd(P) {
  const sig = 0.1 * P.sigCdLim;
  const conc = ((0.18 / P.gc) * P.xi * Math.cbrt(100 * P.rho * P.fcv)) + sig;
  const min = ((0.075 / P.gc) * Math.pow(P.xi, 1.5) * Math.sqrt(P.fcv)) + sig;
  return { tau: Math.max(conc, min, 0), conc, min, minManda: min > conc };
}

/** Perímetros del pilar: u1 (2d), u0 (46.4.3) en mm. */
export function perimetros(x) {
  return { u1: perimetro(x, 2 * x.d), u0: perimetroCara(x, ID, x.d) };
}

/**
 * Comprobación a punzonamiento.
 * @param {Object} x  tipo, pos, c1, c2, D, d (mm), fck, fykCercos, rhoX, rhoY (tanto por uno), sigCd, beta, VEd (kN),
 *                    arm {fi, ramas, sr, a1, nPer}, sinArmadura
 */
export function comprobar(x) {
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const VEd = x.VEd ?? NaN;
  const u = perimetros(x);
  const t = tauRd(P);
  const avisos = [];
  if (P.topada) avisos.push({ clave: 'pun.av.fyd400', args: [P.fydLibre.toFixed(1)] });
  if (P.rhoTopado) avisos.push({ clave: 'pun.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (P.sigCd > 0.3 * P.fcd + 1e-9 || P.sigCd > 12) avisos.push({ clave: 'pun.av.sigCd', args: [P.sigCd.toFixed(2), Math.min(0.3 * P.fcd, 12).toFixed(2)] });
  const sin = !!x.sinArmadura || !x.arm || !(x.arm.ramas > 0);
  const F0 = (t.tau * u.u1 * x.d) / 1000; // sin armadura, β·V (kN)
  const Fmax = (0.5 * P.f1cd * u.u0 * x.d) / 1000;
  const r = { norma: ID, P, u, tau: t, beta, VEd, F0, Fmax, Vc: F0 / beta, Vmax: Fmax / beta, sinArmadura: sin, avisos, disp: [] };
  if (sin) {
    r.Vu = Math.min(r.Vc, r.Vmax);
    r.manda = r.Vc <= r.Vmax ? 'hormigon' : 'biela';
  } else {
    validarArmadura(x.arm);
    const a = x.arm;
    const Ab = areaRama(a.fi);
    const Asw = a.ramas * Ab;
    const Fs = (1.5 * (x.d / a.sr) * Asw * P.fyd) / 1000;
    const Fcs = 0.75 * F0 + Fs;
    r.Asw = Asw;
    r.Fs = Fs;
    r.Fcs = Fcs;
    r.Vcs = Fcs / beta;
    // Zona exterior (46.4.2): β = 1, perímetro un,ef a 2d del último perímetro de cercos
    const dl = anillos(a).at(-1);
    r.deltaUltimo = dl;
    r.unEf = uExterior(x, a, dl, 2 * x.d);
    r.Vext = (t.tau * r.unEf * x.d) / 1000;
    r.Vu = Math.min(r.Vcs, r.Vmax, r.Vext);
    r.manda = r.Vu === r.Vmax ? 'biela' : r.Vu === r.Vext ? 'exterior' : 'cercos';
    if (a.a1 > A1_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.a1', ok: false, args: [a.a1, A1_MAX * x.d, ID] });
    if (a.sr > SR_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.sr', ok: false, args: [a.sr, SR_MAX * x.d, ID] });
    const st = u.u1 / a.ramas;
    r.st = st;
    if (st > ST_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.st', ok: false, args: [st, ST_MAX * x.d, ID] });
  }
  if (Number.isFinite(VEd)) {
    r.aprov = VEd / r.Vu;
    // Perímetro un,ef que haría falta (46.4.2, β = 1): VEd ≤ τrd·un,ef·d
    r.unReq = (VEd * 1000) / (t.tau * x.d);
    r.deltaExtReq = deltaDePerimetro(x, r.unReq);
  }
  return r;
}

/**
 * Dimensionamiento: cercos para VEd. Con `arm.sr` y `arm.a1` fijos, calcula Asw por perímetro, el número de perímetros
 * hasta la zona exterior y una tabla de ramas por diámetro.
 */
export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('pun.errVEd');
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const u = perimetros(x);
  const t = tauRd(P);
  const a = x.arm ?? { sr: 0.75 * x.d, a1: 0.5 * x.d };
  const Fef = beta * VEd;
  const F0 = (t.tau * u.u1 * x.d) / 1000;
  const Fmax = (0.5 * P.f1cd * u.u0 * x.d) / 1000;
  const r = { norma: ID, P, u, tau: t, beta, VEd, F0, Fmax, Fef, avisos: [], Vc: F0 / beta, Vmax: Fmax / beta };
  if (P.topada) r.avisos.push({ clave: 'pun.av.fyd400', args: [P.fydLibre.toFixed(1)] });
  if (P.rhoTopado) r.avisos.push({ clave: 'pun.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (Fef > Fmax + 1e-9) { r.caso = 'biela'; return r; }
  r.sinArmaduraBasta = Fef <= F0 + 1e-9;
  // Zona exterior con β = 1: un,ef ≥ VEd/(τrd·d)
  const unReq = (VEd * 1000) / (t.tau * x.d);
  r.unReq = unReq;
  r.deltaExt = deltaDePerimetro(x, unReq);
  r.deltaExtReq = r.deltaExt;
  if (r.sinArmaduraBasta) { r.caso = 'sin'; return r; }
  const AswNec = ((Fef - 0.75 * F0) * 1000 * a.sr) / (1.5 * x.d * P.fyd);
  r.AswNec = AswNec;
  r.sr = a.sr;
  r.a1 = a.a1;
  r.caso = 'calculo';
  const nMinSt = Math.ceil(u.u1 / (ST_MAX * x.d) - 1e-9);
  r.nMinSt = nMinSt;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    const gr = ramasDe(a, x.pos, Math.max(Math.ceil(AswNec / Ab - 1e-9), nMinSt, 2));
    const n = gr.ramas;
    const Asw = n * Ab;
    const Fcs = 0.75 * F0 + (1.5 * (x.d / a.sr) * Asw * P.fyd) / 1000;
    const nPer = nPerimetrosExt(x, { ...a, ramas: n }, 2 * x.d, r.unReq, 1);
    return { fi, ramas: n, nx: gr.nx, ny: gr.ny, nPer, Asw, st: u.u1 / n, Vu: Math.min(Fcs / beta, Fmax / beta) };
  });
  r.nPer = Math.max(...r.tabla.map((f) => f.nPer));
  return r;
}
