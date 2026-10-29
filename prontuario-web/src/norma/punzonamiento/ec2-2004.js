// Punzonamiento de losas según la UNE-EN 1992-1-1:2013 con su Anejo Nacional (EC-2 2004 + AN), 6.4 y 9.4.3.
// Sin armadura: vRd,c (6.47) con el mínimo del AN (νmín = 0,075/γc·k^(3/2)·fck^(1/2), fck ≤ 60), CRd,c = 0,18/γc, k1 = 0,1.
// Con armadura: vRd,cs = 0,75·vRd,c + 1,5·(d/sr)·Asw·fywd,ef·senα/(u1·d) (6.52), fywd,ef = 250 + 0,25 d ≤ fywd.
// Biela junto al pilar: vEd ≤ vRd,máx = 0,5·ν·fcd con ν = 0,6(1 − fck/250) (6.53, AN). Zona exterior: uout,ef = β·VEd/(vRd,c·d)
// (6.54) y último perímetro de cercos a no más de k·d = 2d dentro (AN 6.4.5(4)). Mínima: 9.11 y 9.4.3.
// Unidades: MPa, mm y kN. Compresión positiva. Textos: analisis/normativa/ec2-2004-an/texto.txt, 6.4 (l.4341-4720),
// 9.4.3 (l.6855) y AN (l.10162-10190). Mismo contrato que ehe08.js (comprobar, dimensionar).

import { EC2_2004 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { areaRama } from '../cortante/ehe08.js';
import { perimetro, perimetroCara, deltaDePerimetro, validarPilar, validarArmadura, anillos, nPerimetrosExt, uExterior, ramasDe } from './comun.js';

export { areaRama };
export const ID = 'EC2-2004';
export const RHO_MAX = 0.02;
export const K_EXT = 2; // AN 6.4.5(4)
export const A1_MAX = 0.5; // 9.4.3(4): primera armadura a ≤ d/2 de la cara
export const SR_MAX = 0.75; // 9.4.3(1)
export const ST_MAX = 1.5; // 9.4.3(1): dentro del primer perímetro crítico
export const ST_EXT = 2; // 9.4.3(1): 2d en los perímetros exteriores al primero

export function parametros(x) {
  validarPilar(x);
  const { fck, d } = x;
  if (!(fck > 0)) throw new ErrorClave('pun.errDatos');
  if (fck > EC2_2004.fckMax) throw new ErrorClave('pun.errFck', EC2_2004.fckMax);
  const gc = EC2_2004.gammaC;
  const fcd = (EC2_2004.alfaCC() * fck) / gc;
  const fyk = x.fykCercos ?? 500;
  const fywd = fyk / EC2_2004.gammaS;
  const fywdEf = Math.min(250 + 0.25 * d, fywd);
  const sigCp = x.sigCd ?? 0;
  const k = Math.min(2, 1 + Math.sqrt(200 / d));
  const rhoBruta = Math.sqrt(Math.max(0, x.rhoX ?? 0) * Math.max(0, x.rhoY ?? 0));
  const rho = Math.min(rhoBruta, RHO_MAX);
  const nu = 0.6 * (1 - fck / 250);
  return { fck, fcd, fyk, fywd, fywdEf, sigCp, k, rhoBruta, rho, rhoTopado: rhoBruta > RHO_MAX, nu, vRdMax: 0.5 * nu * fcd, gc, d, CRdc: 0.18 / gc, k1: 0.1 };
}

/** vRd,c (6.47) y su mínimo con νmín del AN, MPa. */
export function vRdc(P) {
  const sig = P.k1 * P.sigCp;
  const conc = P.CRdc * P.k * Math.cbrt(100 * P.rho * P.fck) + sig;
  const nuMin = (0.075 / P.gc) * Math.pow(P.k, 1.5) * Math.sqrt(Math.min(P.fck, 60));
  const min = nuMin + sig;
  return { v: Math.max(conc, min, 0), conc, min, nuMin, minManda: min > conc };
}

export function perimetros(x) {
  return { u1: perimetro(x, 2 * x.d), u0: perimetroCara(x, ID, x.d) };
}

export function comprobar(x) {
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const VEd = x.VEd ?? NaN;
  const u = perimetros(x);
  const v = vRdc(P);
  const avisos = [];
  if (P.rhoTopado) avisos.push({ clave: 'pun.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (P.fck > 60) avisos.push({ clave: 'pun.av.fck60' });
  const sin = !!x.sinArmadura || !x.arm || !(x.arm.ramas > 0);
  const F0 = (v.v * u.u1 * x.d) / 1000;
  const Fmax = (P.vRdMax * u.u0 * x.d) / 1000;
  const r = { norma: ID, P, u, v, beta, VEd, F0, Fmax, Vc: F0 / beta, Vmax: Fmax / beta, sinArmadura: sin, avisos, disp: [] };
  if (sin) {
    r.Vu = Math.min(r.Vc, r.Vmax);
    r.manda = r.Vc <= r.Vmax ? 'hormigon' : 'biela';
  } else {
    validarArmadura(x.arm);
    const a = x.arm;
    const Ab = areaRama(a.fi);
    const Asw = a.ramas * Ab;
    const Fs = (1.5 * (x.d / a.sr) * Asw * P.fywdEf) / 1000;
    const Fcs = 0.75 * F0 + Fs;
    r.Asw = Asw;
    r.Fs = Fs;
    r.Fcs = Fcs;
    r.Vcs = Fcs / beta;
    // Zona exterior: uout,ef = β·VEd/(vRd,c·d) → el último perímetro, a no más de k·d dentro (6.54, AN)
    const dl = anillos(a).at(-1);
    r.deltaUltimo = dl;
    r.uOutEf = uExterior(x, a, dl, K_EXT * x.d);
    r.Vext = (v.v * r.uOutEf * x.d) / 1000 / beta;
    r.Vu = Math.min(r.Vcs, r.Vmax, r.Vext);
    r.manda = r.Vu === r.Vmax ? 'biela' : r.Vu === r.Vext ? 'exterior' : 'cercos';
    // Mínima (9.11, cercos verticales): Asw·1,5/(sr·st) ≥ 0,08·√fck/fyk con st = u1/ramas
    const st = u.u1 / a.ramas;
    r.st = st;
    const rhoW = (1.5 * Ab) / (a.sr * st);
    const rhoMin = (0.08 * Math.sqrt(P.fck)) / P.fyk;
    r.minima = { rhoW, rhoMin, ok: rhoW >= rhoMin - 1e-12 };
    if (!r.minima.ok) avisos.push({ clave: 'pun.av.minima', args: [(rhoW * 1000).toFixed(2), (rhoMin * 1000).toFixed(2)] });
    if (a.nPer < 2) r.disp.push({ clave: 'pun.disp.dos', ok: false, args: [ID] });
    if (a.a1 > A1_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.a1', ok: false, args: [a.a1, A1_MAX * x.d, ID] });
    if (a.sr > SR_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.sr', ok: false, args: [a.sr, SR_MAX * x.d, ID] });
    if (st > ST_MAX * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.st', ok: false, args: [st, ST_MAX * x.d, ID] });
    // Perímetros exteriores: separación media en el último perímetro de cercos (9.4.3(1))
    if (a.nPer >= 2) {
      const stExt = perimetro(x, dl) / a.ramas;
      r.stExt = stExt;
      if (stExt > ST_EXT * x.d + 1e-9) r.disp.push({ clave: 'pun.disp.stExt', ok: false, args: [stExt, ST_EXT * x.d, ID] });
    }
  }
  if (Number.isFinite(VEd)) {
    r.aprov = VEd / r.Vu;
    // uout,ef que haría falta (6.54)
    r.uOutReq = (beta * VEd * 1000) / (v.v * x.d);
    r.deltaExtReq = deltaDePerimetro(x, r.uOutReq);
  }
  return r;
}

export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('pun.errVEd');
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const u = perimetros(x);
  const v = vRdc(P);
  const a = x.arm ?? { sr: 0.75 * x.d, a1: 0.5 * x.d };
  const Fef = beta * VEd;
  const F0 = (v.v * u.u1 * x.d) / 1000;
  const Fmax = (P.vRdMax * u.u0 * x.d) / 1000;
  const r = { norma: ID, P, u, v, beta, VEd, F0, Fmax, Fef, avisos: [], Vc: F0 / beta, Vmax: Fmax / beta };
  if (P.rhoTopado) r.avisos.push({ clave: 'pun.av.rho', args: [(P.rhoBruta * 1000).toFixed(1)] });
  if (Fef > Fmax + 1e-9) { r.caso = 'biela'; return r; }
  r.sinArmaduraBasta = Fef <= F0 + 1e-9;
  if (r.sinArmaduraBasta) { r.caso = 'sin'; return r; }
  // uout,ef = β·VEd/(vRd,c·d)
  r.uOutReq = (Fef * 1000) / (v.v * x.d);
  r.deltaOut = deltaDePerimetro(x, r.uOutReq);
  r.deltaExtReq = r.deltaOut;
  const AswNec = ((Fef - 0.75 * F0) * 1000 * a.sr) / (1.5 * x.d * P.fywdEf);
  r.AswNec = AswNec;
  r.sr = a.sr;
  r.a1 = a.a1;
  r.caso = 'calculo';
  const nMinSt = Math.ceil(u.u1 / (ST_MAX * x.d) - 1e-9);
  r.nMinSt = nMinSt;
  const rhoMin = (0.08 * Math.sqrt(P.fck)) / P.fyk;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    // Mínima: 1,5·Ab·n/(sr·u1) ≥ ρmín → n ≥ ρmín·sr·u1/(1,5·Ab)
    const nMin = Math.ceil((rhoMin * a.sr * u.u1) / (1.5 * Ab) - 1e-9);
    const gr = ramasDe(a, x.pos, Math.max(Math.ceil(AswNec / Ab - 1e-9), nMinSt, nMin, 2));
    const n = gr.ramas;
    const Asw = n * Ab;
    const Fcs = 0.75 * F0 + (1.5 * (x.d / a.sr) * Asw * P.fywdEf) / 1000;
    const nPer = nPerimetrosExt(x, { ...a, ramas: n }, K_EXT * x.d, r.uOutReq, 2);
    return { fi, ramas: n, nx: gr.nx, ny: gr.ny, nPer, Asw, st: u.u1 / n, mandaMin: nMin > Math.ceil(AswNec / Ab - 1e-9) && nMin >= nMinSt, Vu: Math.min(Fcs / beta, Fmax / beta) };
  });
  r.nPer = Math.max(...r.tabla.map((f) => f.nPer));
  return r;
}
