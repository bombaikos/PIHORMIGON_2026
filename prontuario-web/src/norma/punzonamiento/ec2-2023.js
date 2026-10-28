// Punzonamiento de losas según la EN 1992-1-1:2023 (EC-2 2023), 8.4 y 12.5.1, expresado en esfuerzos (kN): las tensiones
// se multiplican por b0,5·dv. Perímetro de control a 0,5·dv (b0,5), con kpb por el cociente b0/b0,5.
//   Sin armadura (8.94): VRd,c = [0,6/γV·kpb·(100·ρl·fck·ddg/dv)^(1/3) ≤ 0,5/γV·√fck]·b0,5·dv.
//   Con armadura (8.104-8.108): VRd,cs = ηc·VRd,c + ηs·Vw ≥ Vw, con Vw = Asw,per·fywd·dv/sr, ηc = VRd,c/VEd,ef y
//   ηs = dv/(150·φw) + √(15·ddg/dv)·(1/(ηc·kpb))^(3/2) ≤ 0,8. Como ηc y ηs dependen de VEd,ef, la comprobación se
//   resuelve buscando el mayor VEd,ef que cumple VEd,ef ≤ VRd,cs (iteración, sin forma cerrada).
//   Máximo (8.109, 8.111): VRd,máx = ηsys·VRd,c, ηsys = 0,5 + 0,63·(b0/dv)^(1/4) ≥ 1. Zona exterior (8.112):
//   b0,5,out = b0,5·(dv/dv,out/ηc)², el último perímetro a no más de 0,5·dv,out dentro.
// Valores CEN, sin Anejo Nacional (γV = 1,4). Los tramos rectos del perímetro se limitan a 3·dv (8.4.2(3)).
// Unidades: MPa, mm y kN. Compresión positiva. Textos: analisis/normativa/ec2-2023/texto.txt, 8.4 (l.5593-6000) y
// 12.5.1 (l.8463-8540). No incluidos: σd/pretensado (kpp, no se lee bien el 8.101), ap (8.97), momento calculado.
//   [verificar] dv,out = dv − cv: la figura 8.23 no se extrae; se toma cv = φw del cerco.

import { EC2_2023 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { areaRama } from '../cortante/ehe08.js';
import { ddgDe } from '../cortante/ec2-2023.js';
import { perimetro, perimetroCara, deltaDePerimetro, validarPilar, validarArmadura, anillos, nPerimetrosExt, uExterior, ramasDe } from './comun.js';

export { areaRama };
export const ID = 'EC2-2023';
export const A1_MAX = 0.5; // s0 ≤ 0,5 dv,out (12.5.1(2))
export const SR_MAX = 0.75; // s1 ≤ 0,75 dv (flat slabs)
export const ST_PRIMERO = 0.75; // tangencial en el primer perímetro (12.5.1(2))
export const ST_MAX = 1.5; // tangencial a ≤ 2dv del pilar (12.5.1(2))

export function parametros(x) {
  validarPilar(x);
  const { fck, d } = x;
  if (!(fck > 0)) throw new ErrorClave('pun.errDatos');
  if (fck > EC2_2023.fckMax) throw new ErrorClave('pun.errFck', EC2_2023.fckMax);
  const gc = EC2_2023.gammaC;
  const gv = EC2_2023.gammaV;
  const fyk = x.fykCercos ?? 500;
  const fywd = fyk / EC2_2023.gammaS;
  const ddg = ddgDe(fck, x.Dlower ?? 20);
  const rho = Math.sqrt(Math.max(0, x.rhoX ?? 0) * Math.max(0, x.rhoY ?? 0));
  return { fck, fyk, fywd, ddg, gv, gc, dv: d, rho };
}

export function perimetros(x) {
  const dv = x.d;
  const b05 = perimetro(x, 0.5 * dv, 3 * dv);
  const b0 = perimetroCara(x, ID, dv);
  return { b05, b0, u1: b05, u0: b0 };
}

/** kpb (8.96), τRd,c (8.94) y VRd,c, VRd,máx. */
export function resistenciaSin(P, u) {
  const kpbBruto = 3.6 * (1 - u.b0 / u.b05);
  const kpb = Math.min(2.5, Math.max(1, kpbBruto));
  const conc = (0.6 / P.gv) * kpb * Math.cbrt(100 * P.rho * P.fck * (P.ddg / P.dv));
  const tope = (0.5 / P.gv) * Math.sqrt(P.fck);
  const tau = Math.min(conc, tope);
  const f = (u.b05 * P.dv) / 1000;
  const etaSys = Math.max(1, 0.5 + 0.63 * Math.pow(u.b0 / P.dv, 0.25));
  return { kpb, kpbBruto, conc, tope, tau, topeManda: conc > tope, VRdc: tau * f, etaSys, VRdMax: etaSys * tau * f };
}

/** ηc (8.105) y ηs (8.106) para un VEd,ef (kN) dado. */
export function etas(P, s, fiW, Vef) {
  const etaC = s.VRdc / Vef;
  const etaS = Math.min(0.8, P.dv / (150 * fiW) + Math.sqrt(15 * (P.ddg / P.dv)) * Math.pow(1 / (etaC * s.kpb), 1.5));
  return { etaC, etaS };
}

/** VRd,cs (8.104) para un VEd,ef: ηc·VRd,c + ηs·Vw ≥ Vw (kN). Vw = fuerza de plastificación de los cercos del perímetro. */
export function VRdcs(P, s, fiW, Vw, Vef) {
  if (Vef <= s.VRdc) return { VRdcs: s.VRdc + Vw, etaC: 1, etaS: 0.8 };
  const e = etas(P, s, fiW, Vef);
  return { ...e, VRdcs: Math.max(e.etaC * s.VRdc + e.etaS * Vw, Vw) };
}

/** Mayor VEd,ef ≤ VRd,máx para el que se cumple VEd,ef ≤ VRd,cs (búsqueda; la función no es monótona). */
export function VuConArmadura(P, s, fiW, Vw) {
  const tope = s.VRdMax;
  const N = 2000;
  let ant = s.VRdc;
  for (let i = 1; i <= N; i++) {
    const V = s.VRdc + ((tope - s.VRdc) * i) / N;
    if (V > VRdcs(P, s, fiW, Vw, V).VRdcs) {
      let lo = ant;
      let hi = V;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (m <= VRdcs(P, s, fiW, Vw, m).VRdcs) lo = m; else hi = m; }
      return { V: lo, manda: 'cercos' };
    }
    ant = V;
  }
  return { V: tope, manda: 'biela' };
}

export function comprobar(x) {
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const VEd = x.VEd ?? NaN;
  const u = perimetros(x);
  const s = resistenciaSin(P, u);
  const avisos = [];
  if (P.fck > 60) avisos.push({ clave: 'pun.av.fck60' });
  if (u.b0 / u.b05 > 1) avisos.push({ clave: 'pun.av.b0' });
  const sin = !!x.sinArmadura || !x.arm || !(x.arm.ramas > 0);
  const r = { norma: ID, P, u, s, beta, VEd, Vc: s.VRdc / beta, Vmax: s.VRdMax / beta, sinArmadura: sin, avisos, disp: [] };
  if (sin) {
    r.VuEf = s.VRdc;
    r.Vu = s.VRdc / beta;
    r.manda = 'hormigon';
  } else {
    validarArmadura(x.arm);
    const a = x.arm;
    const Ab = areaRama(a.fi);
    const Asw = a.ramas * Ab;
    const srEf = Math.max(a.a1 + a.sr / 2, a.sr);
    const Vw = (Asw * P.fywd * P.dv) / srEf / 1000;
    const st = u.b05 / a.ramas;
    const rhoW = Ab / (srEf * st);
    const u2 = VuConArmadura(P, s, a.fi, Vw);
    r.Asw = Asw;
    r.srEf = srEf;
    r.st = st;
    r.rhoW = rhoW;
    r.Vw = Vw;
    r.VuEf = u2.V;
    r.manda = u2.manda === 'biela' ? 'biela' : 'cercos';
    // Con el VEd dado (si hay): ηc, ηs y VRd,cs
    const Vef = Number.isFinite(VEd) ? beta * VEd : r.VuEf;
    const c = VRdcs(P, s, a.fi, Vw, Vef);
    r.etaC = c.etaC;
    r.etaS = c.etaS;
    r.VRdcs = c.VRdcs;
    // Zona exterior (8.112)
    const dvOut = P.dv - a.fi;
    const etaCEf = Math.min(1, s.VRdc / Vef);
    r.dvOut = dvOut;
    r.b05out = u.b05 * Math.pow((P.dv / dvOut) / etaCEf, 2);
    r.deltaOut = deltaDePerimetro(x, r.b05out, 3 * P.dv);
    r.deltaExtReq = r.deltaOut;
    r.deltaUltimo = anillos(a).at(-1);
    r.extOk = r.deltaUltimo >= r.deltaOut - 0.5 * dvOut - 1e-9;
    // Lo que admite la zona exterior con los perímetros dados: b0,5(δ_último + 0,5·dv,out) ≥ b0,5·(dv/dv,out/ηc)²
    const bExt = uExterior(x, a, r.deltaUltimo, 0.5 * dvOut, 3 * P.dv);
    r.bExt = bExt;
    const q = Math.sqrt(bExt / u.b05) * (dvOut / P.dv);
    r.etaCMinExt = 1 / q;
    r.VuExtEf = Math.max(s.VRdc, s.VRdc * q);
    if (r.VuExtEf < r.VuEf) { r.VuEf = r.VuExtEf; r.manda = 'exterior'; }
    r.Vu = r.VuEf / beta;
    // Disposiciones (12.5.1)
    const fiMax = 11 * Math.sqrt(P.dv / 200);
    r.fiMax = fiMax;
    if (a.fi > fiMax + 1e-9) r.disp.push({ clave: 'pun.disp.fiMax', ok: false, args: [a.fi, fiMax] });
    if (a.nPer < 2) r.disp.push({ clave: 'pun.disp.dos', ok: false, args: [ID] });
    if (a.a1 > A1_MAX * dvOut + 1e-9) r.disp.push({ clave: 'pun.disp.a1', ok: false, args: [a.a1, A1_MAX * dvOut, ID] });
    if (a.sr > SR_MAX * P.dv + 1e-9) r.disp.push({ clave: 'pun.disp.sr', ok: false, args: [a.sr, SR_MAX * P.dv, ID] });
    if (st > ST_PRIMERO * P.dv + 1e-9) r.disp.push({ clave: 'pun.disp.stPrimero', ok: false, args: [st, ST_PRIMERO * P.dv, ID] });
  }
  if (Number.isFinite(VEd)) r.aprov = VEd / r.Vu;
  return r;
}

export function dimensionar(x, VEd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  if (!(VEd > 0)) throw new ErrorClave('pun.errVEd');
  const P = parametros(x);
  const beta = x.beta ?? 1;
  const u = perimetros(x);
  const s = resistenciaSin(P, u);
  const a = x.arm ?? { sr: 0.75 * x.d, a1: 0.5 * x.d };
  const Vef = beta * VEd;
  const r = { norma: ID, P, u, s, beta, VEd, Vef, avisos: [], Vc: s.VRdc / beta, Vmax: s.VRdMax / beta };
  if (Vef > s.VRdMax + 1e-9) { r.caso = 'biela'; return r; }
  if (Vef <= s.VRdc + 1e-9) { r.caso = 'sin'; return r; }
  r.sr = a.sr;
  r.a1 = a.a1;
  r.srEf = Math.max(a.a1 + a.sr / 2, a.sr);
  const nMinSt = Math.ceil(u.b05 / (ST_PRIMERO * P.dv) - 1e-9);
  r.nMinSt = nMinSt;
  r.caso = 'calculo';
  r.etaCEf = s.VRdc / Vef;
  r.tabla = diametros.map((fi) => {
    const Ab = areaRama(fi);
    const { etaC, etaS } = etas(P, s, fi, Vef);
    // Dos ramas de la ecuación 8.104: ηc·VRd,c + ηs·Vw ≥ Vef, o Vw ≥ Vef; vale la que pide menos armadura
    const Vw1 = (Vef - etaC * s.VRdc) / etaS;
    const Vw = Math.min(Vw1, Vef);
    const AswNec = (Vw * 1000 * r.srEf) / (P.fywd * P.dv);
    const gr = ramasDe(a, x.pos, Math.max(Math.ceil(AswNec / Ab - 1e-9), nMinSt, 2));
    const n = gr.ramas;
    const Asw = n * Ab;
    const VwR = (Asw * P.fywd * P.dv) / r.srEf / 1000;
    const c = VRdcs(P, s, fi, VwR, Vef);
    // Zona exterior (8.112) con dv,out = dv − φw: perímetros de cercos hasta 0,5·dv,out de b0,5,out
    const dvOut = P.dv - fi;
    const b05out = u.b05 * Math.pow((P.dv / dvOut) / Math.min(1, etaC), 2);
    const nPer = nPerimetrosExt(x, { ...a, ramas: n }, 0.5 * dvOut, b05out, 2, 3 * P.dv);
    return { fi, ramas: n, nx: gr.nx, ny: gr.ny, Asw, st: u.b05 / n, etaC, etaS, AswNec, nPer, b05out, Vu: VuConArmadura(P, s, fi, VwR).V / beta, ok: c.VRdcs >= Vef - 1e-9 };
  });
  r.nPer = Math.max(...r.tabla.map((f) => f.nPer));
  return r;
}
