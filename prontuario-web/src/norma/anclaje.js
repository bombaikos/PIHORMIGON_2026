// Anclaje y solape de armaduras pasivas (borrador de núcleo; aún sin pantalla).
// Fuentes (analisis/anclaje-solape-decisiones.md):
//  · EHE-08, 69.5 (texto.txt l.15856-16330): vía «ensayo de la viga» (m, β, α) y vía «geometría de corrugas» (τbd).
//  · CE art. 49.5 = misma vía de la viga que la EHE-08; el CE remite a su Anejo 19, 8.4-8.9, para la vía de corrugas (= EC-2).
//  · UNE-EN 1992-1-1:2013 + AN, 8.4 y 8.7 (texto.txt l.5972-6330); AN sin cambios en el cap. 8 (solo 8.2, 8.3, 8.6 y 8.8).
//  · EN 1992-1-1:2023, 11.4 y 11.5 (texto.txt l.7282-7900).
// Unidades: mm y MPa. Compresión positiva no interviene: aquí solo longitudes.
// No incluye aún: confinamiento (α3, α4, α5 = 1), grupos de barras, mallas, dispositivos mecánicos, efectos dinámicos.

import { norma } from './normas.js';

const NORMAS = ['EHE-08', 'EC2-2004', 'EC2-2023'];

/** EHE-08 Tabla 69.5.1.2.a (= CE Tabla 49.5.1.2.a): m por fck y familia de acero (B 400 / B 500). */
const M_VIGA = { 25: [1.2, 1.5], 30: [1.0, 1.3], 35: [0.9, 1.2], 40: [0.8, 1.1], 45: [0.7, 1.0], 50: [0.7, 1.0] };
export function coefM(fck, fyk) {
  const clave = Math.min(50, Math.max(25, Math.floor(fck / 5) * 5));
  return M_VIGA[clave][fyk >= 500 ? 1 : 0];
}

/** EHE-08 Tabla 69.5.2.2 (= CE 49.5.2.2): α según % solapado (columnas 20, 25, 33, 50, >50) y distancia a entre empalmes. */
const ALFA_SOLAPO = { cerca: [1.2, 1.4, 1.6, 1.8, 2.0], lejos: [1.0, 1.1, 1.2, 1.3, 1.4] };
const COLS_PCT = [20, 25, 33, 50];
export function alfaSolapoEHE(pct, lejos) {
  const i = COLS_PCT.findIndex((c) => pct <= c);
  return ALFA_SOLAPO[lejos ? 'lejos' : 'cerca'][i < 0 ? 4 : i];
}

/** Coeficientes de la vía de corrugas (EHE-08 69.5.1.2, EC-2 2004 8.4.2): η1, η2 y fbd. */
function fbd(n, fck, phi, bueno) {
  const fckEf = Math.min(fck, 60); // fctk,0,05 limitado al de C60/75 (EC-2 8.4.2(2)); EHE-08 69.5.1.2: HA-60
  const fctd = (n.alfaCT ?? 1) * n.fctk05(fckEf) / n.gammaC;
  const eta1 = bueno ? 1 : 0.7;
  const eta2 = phi <= 32 ? 1 : (132 - phi) / 100;
  return 2.25 * eta1 * eta2 * fctd;
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Longitud de anclaje de una barra.
 * @param {object} p
 * @param {'EHE-08'|'EC2-2004'|'EC2-2023'} p.norma
 * @param {number} p.fck  MPa
 * @param {number} p.fyk  MPa (400 o 500)
 * @param {number} p.phi  mm
 * @param {'buena'|'deficiente'} p.adherencia  posición I / II (EHE-08), condiciones buenas / deficientes (EC-2)
 * @param {'recta'|'patilla'} [p.forma]  patilla = patilla, gancho o U (en compresión cuenta como recta)
 * @param {'traccion'|'compresion'} [p.esfuerzo]
 * @param {number} [p.r]  As,req/As,real (≈ σsd/fyd), 0-1
 * @param {number} [p.cd]  recubrimiento de cálculo, mm (EC-2; EHE-08 vía corrugas). Sin dato: no se reduce (α2 = 1).
 * @param {'viga'|'corrugas'} [p.via]  solo EHE-08: forma de certificar la adherencia (CE 34.2)
 * @param {number} [p.recPerp]  EHE-08 vía viga: recubrimiento perpendicular al plano de doblado (β = 0,7 si > 3φ)
 * @returns {{lb:number, lbd:number, lbMin:number, rige:string, coef:object, ref:string}}
 */
export function anclaje(p) {
  if (!NORMAS.includes(p.norma)) throw new Error(`Norma desconocida: ${p.norma}`);
  const { fck, fyk, phi } = p;
  const bueno = p.adherencia !== 'deficiente';
  const comp = p.esfuerzo === 'compresion';
  const patilla = p.forma === 'patilla' && !comp;
  const r = p.r ?? 1;
  const n = norma(p.norma);
  const fyd = fyk / n.gammaS;

  if (p.norma === 'EHE-08' && (p.via ?? 'viga') === 'viga') {
    const m = coefM(fck, fyk);
    const lb = bueno ? Math.max(m * phi * phi, (fyk / 20) * phi) : Math.max(1.4 * m * phi * phi, (fyk / 14) * phi);
    const rec = p.recPerp ?? p.cd;
    const beta = patilla ? (rec != null && rec > 3 * phi ? 0.7 : 1) : 1;
    const lbMin = Math.max(10 * phi, 150, (comp ? 2 : 1) * lb / 3);
    const lbd = Math.max(lb * beta * r, lbMin);
    return { lb, lbd, lbMin, coef: { m, beta }, ref: 'EHE-08 69.5.1.2 (ensayo de la viga) = CE 49.5.1.2', norma: p.norma };
  }

  if (p.norma === 'EHE-08' || p.norma === 'EC2-2004') {
    const f = fbd(n, fck, phi, bueno);
    const lb = (phi / 4) * ((r * fyd) / f); // (8.3) con σsd = r·fyd
    const cd = p.cd ?? phi; // sin dato: α2 = 1
    const a1 = patilla ? (cd > 3 * phi ? 0.7 : 1) : 1;
    const a2 = comp ? 1 : patilla ? 1 : clamp(1 - (0.15 * (cd - phi)) / phi, 0.7, 1); // patilla: lb,eq = α1·lb,rqd (8.4.4(2))
    let lbd;
    let lbMin;
    if (p.norma === 'EC2-2004') {
      lbMin = Math.max((comp ? 0.6 : 0.3) * lb, 10 * phi, 100);
      lbd = Math.max(a1 * a2 * lb, lbMin);
      return { lb, lbd, lbMin, coef: { fbd: f, a1, a2 }, ref: 'UNE-EN 1992-1-1 8.4.2-8.4.4', norma: p.norma };
    }
    // EHE-08 vía corrugas: lb,neta = lb·β·σsd/fyd con β = α1·…·α5 (69.5.1.2) y mínimos de 69.5.1.1
    const beta = a1 * a2;
    const lbMinE = Math.max(10 * phi, 150, (comp ? 2 : 1) * lb / 3);
    lbd = Math.max(((phi / 4) * (fyd / f)) * beta * r, lbMinE);
    return { lb: (phi / 4) * (fyd / f), lbd, lbMin: lbMinE, coef: { fbd: f, a1, a2, beta }, ref: 'EHE-08 69.5.1.2 (geometría de corrugas)', norma: p.norma };
  }

  // EC-2 2023, 11.4.2(3) (11.3); nσ = 3/2 y klb = 50 (valores NDP recomendados, sin AN español)
  const kcp = bueno ? 1 : 1.2;
  const cdE = p.cd != null ? Math.min(p.cd, 3.75 * phi) : 1.5 * phi;
  const rf = Math.max(phi / 20, 0.6);
  const rc = Math.max(25 / fck, 0.3);
  const lb = 50 * kcp * phi * Math.pow(clamp(r * fyd / 435, 0, 10), 1.5) * Math.sqrt(rc) * Math.cbrt(rf) * Math.sqrt((1.5 * phi) / cdE);
  const lbMin = 10 * phi;
  let lbd = Math.max(lb, lbMin);
  if (patilla) lbd = Math.max(lb - 15 * phi, lbMin); // 11.4.4(1): gancho o codo normalizado
  return { lb, lbd, lbMin, coef: { kcp, cd: cdE }, ref: 'EN 1992-1-1:2023 11.4.2(3), 11.4.4(1)', norma: p.norma };
}

/**
 * Longitud de solape de barras rectas.
 * Además de los datos de anclaje(): pct (% de barras solapadas en la sección) y, solo EHE-08 / CE,
 * lejos (true si la distancia entre empalmes más próximos a > 10φ).
 */
export function solape(p) {
  const a = anclaje({ ...p, forma: 'recta' });
  const comp = p.esfuerzo === 'compresion';
  const pct = p.pct ?? 100;
  if (p.norma === 'EHE-08') {
    const alfa = comp ? 1 : alfaSolapoEHE(pct, !!p.lejos);
    return { ...a, ls: alfa * a.lbd, alfa, ref: `${a.ref}; 69.5.2.2 Tabla 69.5.2.2` };
  }
  if (p.norma === 'EC2-2004') {
    const a6 = clamp(Math.sqrt(pct / 25), 1, 1.5);
    const l0Min = Math.max(0.3 * a6 * a.lb, 15 * p.phi, 200);
    // l0 = α1α2α3α5α6·lb,rqd ≥ l0,min  (8.7.3); aquí lbd/lb ya lleva α1·α2 pero también el mínimo de anclaje, así que se rehace:
    const a2 = a.coef.a2;
    const l0 = Math.max(a.coef.a1 * a2 * a6 * a.lb, l0Min);
    return { ...a, ls: l0, alfa: a6, lsMin: l0Min, ref: 'UNE-EN 1992-1-1 8.7.3 (8.10, 8.11), Tabla 8.3' };
  }
  const kls = 1.2;
  const ls = Math.max(kls * a.lbd, 15 * p.phi);
  return { ...a, ls, alfa: kls, lsMin: 15 * p.phi, ref: 'EN 1992-1-1:2023 11.5.2(2), Tabla 11.3' };
}

export const DIAMETROS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
