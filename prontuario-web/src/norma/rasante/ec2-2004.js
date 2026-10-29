// Rasante en juntas entre hormigones de distintas edades según la UNE-EN 1992-1-1:2013 con su Anejo Nacional
// (EC-2 2004 + AN), 6.2.5: v_Rdi = c·f_ctd + μ·σn + ρ·f_yd·(μ·senα + cosα) ≤ 0,5·ν·f_cd (6.25), con α entre 45° y 90°.
// Unidades: MPa, mm y kN. Compresión positiva. Mismo contrato que ehe08.js (parametros, resistencia, comprobar,
// dimensionar). Texto: analisis/normativa/ec2-2004-an/texto.txt, 6.2.5 (l.4172-4230). El AN no cambia 6.2.5; sí 3.1.6(2)P
// (α_ct = 1,00) y 6.2.2(6) (ν = 0,6·(1 − f_ck/250)).
// Muy lisa: la norma da c de 0,025 a 0,10; se toma el valor inferior (lado seguro).

import { EC2_2004 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { tauDe, esfuerzoDe, rhoDe, factorAlfa, validar, tablaCosido, comprobarAlfa, rhoLineal } from './comun.js';

export const ID = 'EC2-2004';
export const ALFA_MIN = 45;
export const ALFA_MAX = 90;
export const RUGOSIDADES = {
  muyLisa: { c: 0.025, mu: 0.5 },
  lisa: { c: 0.2, mu: 0.6 },
  rugosa: { c: 0.4, mu: 0.7 },
  dentada: { c: 0.5, mu: 0.9 },
};
export const RUGOSIDAD_DEFECTO = 'rugosa';

export function parametros(x) {
  validar(x);
  const R = RUGOSIDADES[x.rug];
  if (!R) throw new ErrorClave('ras.errRug');
  if (x.fck > EC2_2004.fckMax) throw new ErrorClave('ras.errFck', EC2_2004.fckMax);
  const alfa = x.alfa ?? 90;
  comprobarAlfa(alfa, ALFA_MIN, ALFA_MAX);
  const gc = EC2_2004.gammaC;
  const fcd = (EC2_2004.alfaCC() * x.fck) / gc;
  const fctd = EC2_2004.fctk05(x.fck) / gc; // α_ct = 1,00 (AN 3.1.6(2)P)
  const fyd = x.fykCosido / EC2_2004.gammaS;
  const nu = 0.6 * (1 - x.fck / 250);
  const sigBruta = x.sigN ?? 0;
  const sigTope = 0.6 * fcd;
  const sigN = Math.min(sigBruta, sigTope);
  const tracc = sigN < 0;
  // Cohesión c·f_ctd: nula con tracción normal (6.2.5(1)); a la mitad con fatiga o dinámica (6.2.5(5))
  const coh = tracc ? 0 : R.c * fctd * (x.fatiga ? 0.5 : 1);
  return { fck: x.fck, fcd, fctd, fyd, nu, R, sigN, sigBruta, sigTopada: sigBruta > sigTope, tracc, coh, alfa, lim: 0.5 * nu * fcd, gc };
}

/** Resistencia v_Rdi, MPa, para una cuantía ρ = A_s/A_i. */
export function resistencia(P, rho) {
  const cosido = rho * P.fyd * factorAlfa(P.R.mu, P.alfa);
  const fric = P.R.mu * P.sigN;
  const suma = Math.max(0, P.coh + fric + cosido);
  return { tauRd: Math.min(suma, P.lim), suma, coh: P.coh, fric, cosido, mu: P.R.mu, lim: P.lim, limita: suma > P.lim, contabiliza: rho > 0 };
}

function avisos(P) {
  const a = [];
  if (P.tracc) a.push({ clave: 'ras.av.traccion', args: [] });
  if (P.sigTopada) a.push({ clave: 'ras.av.sigTope', args: [P.sigBruta, P.sigN] });
  return a;
}

export function comprobar(x) {
  const P = parametros(x);
  const sinArm = !!x.sinArmadura;
  const rho = sinArm ? 0 : rhoDe(x.arm, x.b);
  const tauEd = tauDe(x.REd, x.b, x.L);
  const r = resistencia(P, rho);
  const Ru = esfuerzoDe(r.tauRd, x.b, x.L);
  return { P, tauEd, tauRd: r.tauRd, Ru, REd: x.REd, Rmax: esfuerzoDe(P.lim, x.b, x.L), aprov: r.tauRd > 0 ? tauEd / r.tauRd : Infinity, rho, res: r, manda: r.limita ? 'limite' : r.contabiliza ? 'cosido' : 'cohesion', formula: '6.25', avisos: avisos(P), norma: ID };
}

export function dimensionar(x, REd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  const P = parametros(x);
  const tauEd = tauDe(REd, x.b, x.L);
  const base = { P, tauEd, REd, Rmax: esfuerzoDe(P.lim, x.b, x.L), norma: ID, avisos: avisos(P), formula: '6.25' };
  if (tauEd > P.lim + 1e-12) return { ...base, caso: 'limite' };
  const fijo = P.coh + P.R.mu * P.sigN;
  if (tauEd <= fijo + 1e-12) return { ...base, caso: 'sin', tauSin: Math.max(0, fijo) };
  const rhoNec = rhoLineal(tauEd, fijo, P.fyd * factorAlfa(P.R.mu, P.alfa));
  if (!Number.isFinite(rhoNec)) return { ...base, caso: 'limite' };
  return { ...base, caso: 'calculo', mu: P.R.mu, rhoNec, AswSNec: rhoNec * x.b * 1000, tabla: tablaCosido(rhoNec, x, diametros) };
}
