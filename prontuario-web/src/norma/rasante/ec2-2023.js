// Rasante en interfaces entre hormigones según la EN 1992-1-1:2023 (EC-2 2023), 8.2.6.
//  · Cosido anclado para σsd = f_yd (o sin cosido), (8.76): τ_Rdi = c_v1·√f_ck/γc + μv·σn + ρ·f_yd·(μv·senα + cosα)
//    ≤ 0,30·f_cd + ρ·f_yd·cosα.
//  · Cosido que no garantiza plastificar, por anclaje insuficiente (recrecidos estructurales), (8.77):
//    τ_Rdi = c_v2·√f_ck/γc + μv·σn + k_v·ρ·f_yd·μv + k_dowel·ρ·√(f_yd·f_cd) ≤ 0,25·f_cd.
// Unidades: MPa, mm y kN. Compresión positiva. Mismo contrato que ehe08.js. Texto: analisis/normativa/ec2-2023/texto.txt,
// 8.2.6 (l.5299-5440), tabla 8.2. Sin fatiga (cap. 10.7, queda fuera) y sin el cálculo por llave de las juntas dentadas.
// α entre 35° y 135° (35° a 90° en juntas muy lisas). Con tracción normal c_v1 = c_v2 = 0 y μv·σn = 0.

import { EC2_2023 } from '../normas.js';
import { ErrorClave } from '../../core/errores.js';
import { tauDe, esfuerzoDe, rhoDe, factorAlfa, validar, tablaCosido, comprobarAlfa, rhoLineal } from './comun.js';

export const ID = 'EC2-2023';
export const ALFA_MIN = 35;
export const ALFA_MAX = 135;
/** Tabla 8.2. Las juntas dentadas solo tienen (8.76). */
export const RUGOSIDADES = {
  muyLisa: { cv1: 0.01, mu: 0.5, cv2: 0, kv: 0, kdowel: 1.5 },
  lisa: { cv1: 0.08, mu: 0.6, cv2: 0, kv: 0.5, kdowel: 1.1 },
  rugosa: { cv1: 0.15, mu: 0.7, cv2: 0.08, kv: 0.5, kdowel: 0.9 },
  muyRugosa: { cv1: 0.19, mu: 0.9, cv2: 0.15, kv: 0.5, kdowel: 0.9 },
  dentada: { cv1: 0.37, mu: 0.9, cv2: null, kv: null, kdowel: null },
};
export const RUGOSIDAD_DEFECTO = 'rugosa';

export function parametros(x) {
  validar(x);
  const R = RUGOSIDADES[x.rug];
  if (!R) throw new ErrorClave('ras.errRug');
  if (x.fck > EC2_2023.fckMax) throw new ErrorClave('ras.errFck', EC2_2023.fckMax);
  const alfa = x.alfa ?? 90;
  comprobarAlfa(alfa, ALFA_MIN, x.rug === 'muyLisa' ? 90 : ALFA_MAX);
  const anclado = x.anclado !== false;
  if (!anclado && R.cv2 === null) throw new ErrorClave('ras.errDentada');
  const gc = EC2_2023.gammaC;
  const fcd = (EC2_2023.alfaCC(x.fck) * x.fck) / gc;
  const fyd = x.fykCosido / EC2_2023.gammaS;
  const sigBruta = x.sigN ?? 0;
  const sigTope = 0.6 * fcd;
  const sigN = Math.min(sigBruta, sigTope);
  const tracc = sigN < 0;
  const sqrtFck = Math.sqrt(x.fck);
  // 8.77: cv2 × 1,2 en recrecidos estructurales con rugosa o muy rugosa (8.2.6(7)); kdowel = 0 a menos de 10ø del borde
  const topping = !!x.topping && (x.rug === 'rugosa' || x.rug === 'muyRugosa');
  const cv = anclado ? R.cv1 : R.cv2 * (topping ? 1.2 : 1);
  const coh = tracc ? 0 : (cv * sqrtFck) / gc;
  const kdowel = x.bordeCerca ? 0 : R.kdowel;
  return { fck: x.fck, fcd, fyd, R, anclado, sigN, sigBruta, sigTopada: sigBruta > sigTope, tracc, coh, cv, topping, kdowel, alfa, gc, mu: R.mu,
    lim: anclado ? 0.3 * fcd : 0.25 * fcd };
}

/** Resistencia τ_Rdi, MPa, para una cuantía ρ = A_si/A_i. */
export function resistencia(P, rho) {
  const fric = P.tracc ? 0 : P.mu * P.sigN;
  let cosido;
  let lim;
  if (P.anclado) {
    cosido = rho * P.fyd * factorAlfa(P.mu, P.alfa);
    lim = P.lim + rho * P.fyd * Math.cos((P.alfa * Math.PI) / 180);
  } else {
    cosido = rho * (P.R.kv * P.fyd * P.mu + P.kdowel * Math.sqrt(P.fyd * P.fcd));
    lim = P.lim;
  }
  const suma = Math.max(0, P.coh + fric + cosido);
  return { tauRd: Math.min(suma, lim), suma, coh: P.coh, fric, cosido, mu: P.mu, lim, limita: suma > lim, contabiliza: rho > 0 };
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
  return { P, tauEd, tauRd: r.tauRd, Ru, REd: x.REd, Rmax: esfuerzoDe(r.lim, x.b, x.L), aprov: r.tauRd > 0 ? tauEd / r.tauRd : Infinity, rho, res: r, manda: r.limita ? 'limite' : r.contabiliza ? 'cosido' : 'cohesion', avisos: avisos(P), norma: ID };
}

export function dimensionar(x, REd, { diametros = [8, 10, 12, 16, 20] } = {}) {
  const P = parametros(x);
  const tauEd = tauDe(REd, x.b, x.L);
  const base = { P, tauEd, REd, Rmax: esfuerzoDe(resistencia(P, 0).lim, x.b, x.L), norma: ID, avisos: avisos(P) };
  const fijo = P.coh + (P.tracc ? 0 : P.mu * P.sigN);
  if (tauEd <= fijo + 1e-12) return { ...base, caso: 'sin', tauSin: Math.max(0, fijo) };
  const pend = P.anclado ? P.fyd * factorAlfa(P.mu, P.alfa) : P.R.kv * P.fyd * P.mu + P.kdowel * Math.sqrt(P.fyd * P.fcd);
  let rhoNec = rhoLineal(tauEd, fijo, pend);
  if (P.anclado) {
    // el límite superior crece con ρ·f_yd·cosα: puede pedir más cuantía que la resistencia
    const cosA = Math.cos((P.alfa * Math.PI) / 180);
    if (tauEd > P.lim) rhoNec = Math.max(rhoNec, cosA > 1e-9 ? (tauEd - P.lim) / (P.fyd * cosA) : Infinity);
  } else if (tauEd > P.lim) rhoNec = Infinity;
  if (!Number.isFinite(rhoNec) || resistencia(P, rhoNec).tauRd < tauEd - 1e-6) return { ...base, caso: 'limite' };
  return { ...base, caso: 'calculo', mu: P.mu, rhoNec, AswSNec: rhoNec * x.b * 1000, tabla: tablaCosido(rhoNec, x, diametros) };
}
