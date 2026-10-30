// Flexión simple en sección rectangular: módulo TN1 del Prontuario 3.1
// (comun_TN.pas: ClickEnBotonCalcular, Propuesta_de_Armado; varios.pas:
// CuantiasMinMax, HallaMlim). Unidades de entrada: m, m², kN, kN·m.

import { estadoUltimo, esfuerzos, centroHomogeneizado } from './seccion.js';
import { sigma, epsPlastificacion, resistenciaCalculo, acero } from './materiales.js';
import { norma as getNorma } from '../norma/normas.js';
import { fctmFlexotraccion } from './propiedades.js';

/**
 * @typedef {Object} DatosRect
 * @property {number} b   Ancho [m]
 * @property {number} h   Canto [m]
 * @property {number} rinf Distancia del c.d.g. de la armadura inferior a la cara inferior [m]
 * @property {number} rsup Ídem armadura superior a la cara superior [m]
 * @property {number} Ainf [m²]
 * @property {number} Asup [m²]
 * @property {import('./materiales.js').Material} hormigon
 * @property {import('./materiales.js').Material} acero
 */

/** Construye la sección del motor a partir de los datos de una rectangular. */
export function seccionRectangular(d, Ainf = d.Ainf, Asup = d.Asup) {
  const barras = [];
  if (Ainf > 0) barras.push({ y: d.h - d.rinf, A: Ainf, mat: d.acero });
  if (Asup > 0) barras.push({ y: d.rsup, A: Asup, mat: d.acero });
  for (const e of d.barrasExtra ?? []) barras.push({ y: e.y, A: e.A, mat: d.acero });
  return {
    trapecios: d.trapecios
      ? d.trapecios.map((t) => ({ ...t, mat: d.hormigon }))
      : [{ y1: 0, y2: d.h, b1: d.b, b2: d.b, mat: d.hormigon }],
    barras,
    h: d.h,
    epsC2: -d.hormigon.comp.find((p) => p[1] === Math.min(...d.hormigon.comp.map((q) => q[1])))[0],
  };
}

/**
 * Cuantías mínima y máxima (CuantiasMinMax). Mínima: mayor de la geométrica
 * (tabla 42.3.5 EHE interpolada) y la mecánica 0,25·(fcd/fyd)·Ib/(h·(h−yg)).
 * Máxima: la que iguala capacidades mecánicas de acero y hormigón.
 * @param {DatosRect} d
 * @param {'viga'|'losa'|'muro'|'pilar'} elemento
 * @returns {{Amin:number, Amax:number, romin:number, Amec:number, Ageo:number}}
 */
export function cuantiasMinMax(d, elemento = 'viga', { Nd = 0 } = {}) {
  if (d.hormigon.norma === 'EC2-2023') return cuantiasEC2(d, elemento, Nd);
  if (d.hormigon.norma === 'EC2-2004') return cuantiasEC2004(d, elemento, Nd);
  if (d.hormigon.norma === 'EHE-08') return cuantiasEHE08(d, elemento, Nd);
  const Ahor = d.b * d.h;
  const fcd = d.hormigon.fk / d.hormigon.gamma; // sin cansancio, como el original
  let fyk = d.acero.fk;
  if (fyk > 500000) fyk = 500000;
  const fyd = fyk / d.acero.gamma;
  const fykMPa = fyk / 1000;
  const romin = {
    viga: (5.3 - 0.005 * fykMPa) / 1000,
    pilar: 0.004,
    losa: (1.8 + 0.002 * (500 - fykMPa)) / 1000,
    muro: (0.9 + 0.003 * (500 - fykMPa)) / 1000,
  }[elemento];
  if (romin === undefined) throw new Error(`Elemento desconocido: ${elemento}`);
  const Ageo = romin * Ahor;
  const Ib = (d.b * d.h ** 3) / 12;
  const { yg } = centroHomogeneizado(seccionRectangular(d));
  let Amec = 0.25 * (fcd / fyd) * Ib / (d.h * (d.h - yg));
  if (elemento === 'pilar') Amec = Math.max(0.1 * Ahor * fcd / fyd, Amec);
  return { Amin: Math.max(Ageo, Amec), Amax: (Ahor * fcd) / fyd, romin, Amec, Ageo, norma: 'EHE-98' };
}

/**
 * EHE-08, 42.3.2: A·fyd ≥ W·fct,m,fl/z con z ≈ 0,8h (flexión); pilares, 42.3.3: A·fyd ≥ 0,10·Nd.
 * Cuantías geométricas de la tabla 42.3.5 (fy = 500 N/mm², interpolando en fyk como el Prontuario 3.1).
 * Máxima: criterio del programa (la norma no la fija en flexión).
 */
function cuantiasEHE08(d, elemento, Nd) {
  const n = getNorma('EHE-08');
  const Ac = d.Ac ?? d.b * d.h;
  const W = d.W ?? (d.b * d.h ** 2) / 6;
  const fyk = Math.min(d.acero.fk, 500000);
  const fyd = d.acero.fk / d.acero.gamma;
  const fcd = resistenciaCalculo(d.hormigon);
  const fykMPa = fyk / 1000;
  const romin = {
    viga: (5.3 - 0.005 * fykMPa) / 1000,
    pilar: 0.004,
    losa: (1.8 + 0.002 * (500 - fykMPa)) / 1000,
    muro: (0.9 + 0.003 * (500 - fykMPa)) / 1000,
  }[elemento];
  if (romin === undefined) throw new Error(`Elemento desconocido: ${elemento}`);
  const Ageo = romin * Ac;
  const fctmfl = fctmFlexotraccion(n.fctm(d.hormigon.fk / 1000), d.h) * 1000;
  const Amec = elemento === 'pilar' ? (0.1 * Math.max(Nd, 0)) / fyd : (fctmfl * W) / (0.8 * d.h * fyd);
  return { Amin: Math.max(Ageo, Amec), Amax: (Ac * fcd) / fyd, romin, Amec, Ageo, norma: 'EHE-08',
    regla: elemento === 'pilar' ? '42.3.3: 0,10·Nd/fyd y tabla 42.3.5' : '42.3.2: W·fct,m,fl/(0,8h·fyd) y tabla 42.3.5' };
}

/**
 * UNE-EN 1992-1-1 con Anejo Nacional: vigas (AN 9.2.1.1(1)) As,min = W·fctm,fl/(z·fyd) con z = 0,8h;
 * As,máx = 0,04·Ac (AN 9.2.1.1(3)); pilares (9.5.2(2)): max{0,10·NEd/fyd; 0,002·Ac}.
 */
function cuantiasEC2004(d, elemento, Nd) {
  const n = getNorma('EC2-2004');
  if (!['viga', 'losa', 'muro', 'pilar'].includes(elemento)) throw new Error(`Elemento desconocido: ${elemento}`);
  const Ac = d.Ac ?? d.b * d.h;
  const W = d.W ?? (d.b * d.h ** 2) / 6;
  const fyk = d.acero.fk;
  const fyd = fyk / d.acero.gamma;
  const fck = d.hormigon.fk / 1000;
  const fctm = n.fctm(fck) * 1000;
  const kh = Math.min(0.8, Math.max(0.5, 0.8 - 0.6 * (Math.min(d.b, d.h) - 0.3)));
  const AminFis = (0.2 * kh * fctm * (Ac / 2)) / fyk;
  const base = { Amax: 0.04 * Ac, AminFis, kh, norma: 'EC2-2004' };
  if (elemento === 'pilar') {
    const Ageo = 0.002 * Ac;
    const Aaxil = (0.1 * Math.max(Nd, 0)) / fyd;
    return { ...base, Amin: Math.max(Ageo, Aaxil), Ageo, Amec: Aaxil, regla: '9.5.2(2): max{0,10·NEd/fyd; 0,002·Ac}' };
  }
  const A = (fctmFlexotraccion(n.fctm(fck), d.h) * 1000 * W) / (0.8 * d.h * fyd);
  return { ...base, Amin: A, Amec: A, Ageo: 0, regla: 'AN 9.2.1.1(1): W·fctm,fl/(0,8h·fyd)' };
}

/**
 * Armaduras mínimas de la EN 1992-1-1:2023.
 * - Vigas, losas y muros (12.2(2), fórmula 12.1): MR,min ≥ Mcr, con la armadura a fyk
 *   y Mcr = fctm·W de la sección bruta.
 * - Pilares (tabla 12.3): max{0,1·NEd/fyd; 0,002·Ac}.
 * - Además se informa de la mínima por fisuración 9.2.2 (fórmula 9.2), que solo
 *   aplica cuando se exige control de fisuración.
 * La norma no fija cuantía máxima en vigas: Amax es un criterio del programa.
 * @param {DatosRect} d
 * @param {string} elemento
 * @param {number} Nd  [kN], compresión positiva
 */
function cuantiasEC2(d, elemento, Nd) {
  const n = getNorma('EC2-2023');
  const fck = d.hormigon.fk / 1000;
  const fyk = d.acero.fk;
  const fyd = fyk / d.acero.gamma;
  const fcd = resistenciaCalculo(d.hormigon);
  const fctm = n.fctm(fck) * 1000;
  const Ac = d.Ac ?? d.b * d.h;
  const W = d.W ?? (d.b * d.h ** 2) / 6;
  const Amax = (Ac * fcd) / fyd;
  const kh = Math.min(0.8, Math.max(0.5, 0.8 - 0.6 * (Math.min(d.b, d.h) - 0.3)));
  const AminFis = (0.2 * kh * fctm * (Ac / 2)) / fyk;
  const base = { Amax, criterioAmax: true, AminFis, kh, norma: 'EC2-2023' };
  if (!['viga', 'losa', 'muro', 'pilar'].includes(elemento)) throw new Error(`Elemento desconocido: ${elemento}`);
  if (elemento === 'pilar') {
    const Ageo = 0.002 * Ac;
    const Aaxil = (0.1 * Math.max(Nd, 0)) / fyd;
    return { ...base, Amin: Math.max(Ageo, Aaxil), Ageo, Amec: Aaxil, regla: 'Tabla 12.3: max{0,1·NEd/fyd; 0,002·Ac}' };
  }
  const Mcr = fctm * W;
  const aceroK = acero({ fyk: fyk / 1000, norma: 'EC2-2023', gammaS: 1, ductilidad: d.acero.ductilidad });
  const dK = { ...d, acero: aceroK, barrasExtra: [] };
  const MR = (A) => estadoUltimo(seccionRectangular(dK, A, 0), 0).M;
  const A = regulaFalsi((a) => MR(a) - Mcr, 1e-7, Amax, 1e-3);
  return { ...base, Amin: A, Amec: A, Ageo: 0, Mcr, regla: '12.2(2), fórmula 12.1: MR,min (acero a fyk) ≥ Mcr (fctm)' };
}

/**
 * Momento límite sin armadura de compresión (HallaMlim): plano con εcu arriba y
 * εy en la armadura de tracción; momento del bloque comprimido respecto a d.
 */
export function momentoLimite(d) {
  const ecu = d.hormigon.comp[d.hormigon.comp.length - 1][0];
  const ey = epsPlastificacion(d.acero);
  const dd = d.h - d.rinf;
  const kappa = (Math.abs(ecu) + ey) / dd;
  const xlim = Math.abs(ecu) / kappa;
  const sec = seccionRectangular({ ...d, barrasExtra: [] }, 0, 0);
  const { N, M } = esfuerzos(sec, ecu, kappa, dd);
  return { Mlim: M, Nlim: N, xlim, kappa };
}

/** Momento último para unas armaduras dadas (N = Nd). */
function Mu(d, Ainf, Asup, Nd) {
  const r = estadoUltimo(seccionRectangular(d, Ainf, Asup), Nd);
  if (!r.converge) throw new Error(r.motivo);
  return r;
}

/** Resuelve f(A) = 0 con regula falsi (Illinois), como el "algoritmo de Ohio". */
function regulaFalsi(f, a, b, tol = 0.01, maxIt = 100) {
  let fa = f(a);
  let fb = f(b);
  let x = b;
  let fx = fb;
  for (let i = 0; i < maxIt; i++) {
    x = b - (fb * (b - a)) / (fb - fa);
    fx = f(x);
    if (Math.abs(fx) < tol || Math.abs(b - a) < 1e-10) break;
    if (fx * fb > 0) {
      fa /= 2;
    } else {
      a = b;
      fa = fb;
    }
    b = x;
    fb = fx;
  }
  return x;
}

/** Resultados detallados de un estado último sobre la sección rectangular. */
export function detalle(d, r, Ainf, Asup) {
  const yInf = d.h - d.rinf;
  const yS = d.rsup;
  const eInfA = r.epsSup + r.kappa * yInf;
  const eSupA = r.epsSup + r.kappa * yS;
  const curvaHormigon = [];
  for (let i = 0; i <= 40; i++) {
    const y = (d.h * i) / 40;
    curvaHormigon.push([y, Math.min(0, sigma(d.hormigon, r.epsSup + r.kappa * y))]);
  }
  return {
    curvaHormigon,
    Mu: r.M,
    Nu: r.N,
    x: r.x,
    kappa: r.kappa,
    epsSup: r.epsSup,
    epsInf: r.epsInf,
    epsAinf: eInfA,
    epsAsup: eSupA,
    sigAinf: sigma(d.acero, eInfA),
    sigAsup: Asup > 0 ? sigma(d.acero, eSupA) : 0,
    Ainf,
    Asup,
    d: yInf,
    dprima: yS,
  };
}

/**
 * Comprobación: momento último de la sección con su armadura.
 * @param {DatosRect} d
 * @param {{Nd?:number, elemento?:string}} [opc]  Nd en kN, compresión positiva
 */
export function comprobar(d, { Nd = 0, elemento = 'viga' } = {}) {
  const avisos = [];
  const c = cuantiasMinMax(d, elemento, { Nd });
  if (d.Ainf < c.Amin) avisos.push('La cuantía de armadura es inferior a la mínima');
  if (d.Ainf > c.Amax) avisos.push('La cuantía supera el criterio de cuantía máxima del programa (capacidad mecánica del acero = hormigón)');
  const r = Mu(d, d.Ainf, d.Asup, -Nd);
  return { ...detalle(d, r, d.Ainf, d.Asup), cuantias: c, avisos };
}

/**
 * Dimensionamiento a flexión simple (o con axil Nd) de una sección rectangular.
 * @param {DatosRect} d
 * @param {number} Md [kN·m] positivo
 * @param {{Nd?:number, elemento?:string}} [opc]
 */
export function dimensionar(d, Md, { Nd = 0, elemento = 'viga' } = {}) {
  if (!(Md > 0)) throw new Error('El momento solicitante debe ser un número positivo');
  const N = -Nd;
  const c = cuantiasMinMax(d, elemento, { Nd });
  const lim = momentoLimite(d);
  const base = { Md, cuantias: c, Mlim: lim.Mlim, xlim: lim.xlim };

  const rMin = Mu(d, c.Amin, 0, N);
  if (rMin.M > Md) {
    return { ...base, caso: 'minima', mensaje: 'Cuantía mínima', ...detalle(d, rMin, c.Amin, 0) };
  }
  const fyd = resistenciaCalculo(d.acero);
  const Alim = -lim.Nlim / fyd;
  const AsupMax = (c.Amax - Alim) / 2;
  const rMax = Mu(d, Alim + AsupMax, AsupMax, N);
  if (rMax.M < Md) {
    return { ...base, caso: 'escuadria', mensaje: 'Hay que aumentar la escuadría', MuMax: rMax.M };
  }
  if (Md <= lim.Mlim) {
    const A = regulaFalsi((a) => Mu(d, a, 0, N).M - Md, c.Amin, Alim);
    const r = Mu(d, A, 0, N);
    return { ...base, caso: 'simple', mensaje: 'Md ≤ Mlim. No se dispone armadura de compresión', ...detalle(d, r, A, 0) };
  }
  const dA = regulaFalsi((a) => Mu(d, Alim + a, a, N).M - Md, 0, AsupMax);
  const r = Mu(d, Alim + dA, dA, N);
  return { ...base, caso: 'doble', mensaje: 'Md > Mlim. Se dispone armadura de compresión', ...detalle(d, r, Alim + dA, dA) };
}

const DIAMETROS = [12, 14, 16, 20, 25];
const AREA_CM2 = [1.130972, 1.5393791, 2.010618, 3.14159, 4.908734];

/**
 * Propuesta de armado y abertura de fisura aproximada (Propuesta_de_Armado).
 * Hipótesis del original: Mk = Md/1,50; cuasipermanente 0,82·Mk en una capa
 * (0,80 en dos capas); separación entre ejes 5 cm; recubrimiento lateral 5 cm.
 * @param {DatosRect} d
 * @param {number} Ainf [m²]
 * @param {number} Asup [m²]
 * @param {number} Md [kN·m]
 */
export function propuestaArmado(d, Ainf, Asup, Md) {
  const rlat = 0.05;
  const espaciado = 0.05;
  const ec2 = d.hormigon.norma === 'EC2-2023';
  const ec04 = d.hormigon.norma === 'EC2-2004';
  const fck = d.hormigon.fk;
  const Ib = d.Ib ?? (d.b * d.h ** 3) / 12;
  const { yg } = centroHomogeneizado(seccionRectangular(d));
  const redondear = (x) => (x - Math.trunc(x) > 1e-6 ? Math.trunc(x) + 1 : Math.trunc(x));
  const util = (b) => {
    const u = b - 2 * rlat;
    return u <= 0 ? 0.8 * b : u;
  };
  const bu = util(d.b);
  const nmax = Math.round(bu / espaciado) + 1;
  let nmin = redondear(bu / 0.3);
  if (nmin === 1) nmin = 2;

  const inferior = DIAMETROS.map((fi, i) => {
    let n = Math.max(redondear((Ainf * 1e4) / AREA_CM2[i]), nmin);
    if (n > 2 * nmax) return { fi, n: null, capas: null, A: null, wk: null };
    let capas = 1;
    let factor = 0.82;
    let nHuecos = n - 1;
    if (n > nmax) {
      if (n === nmax + 1) n = nmax + 2;
      capas = 2;
      factor = 0.8;
      nHuecos = nmax - 1;
    }
    const A = n * AREA_CM2[i];
    const fiM = Math.sqrt((AREA_CM2[i] * 1e-4 * 4) / Math.PI);
    let Acef;
    if (d.h >= d.b) Acef = Math.min(0.5 * d.h * d.b, (7.5 * fiM + d.rinf) * d.b);
    else if (d.b / nHuecos <= 15 * fiM) Acef = (d.b * d.h) / 4;
    else Acef = (15 * fiM * (capas === 1 ? n : nHuecos) * d.h) / 4;
    const sm = 2 * d.rinf + (0.2 * d.b) / nHuecos + (0.4 * 0.125 * fiM * Acef) / (A * 1e-4);
    const sigmas = ((Md / 1.5) * factor) / (0.8 * (d.h - d.rinf) * A * 1e-4);
    const Mfis = d.hormigon.norma === 'EHE-98'
      ? 300 * Math.pow(fck / 1000, 2 / 3) * Ib / (d.h - yg)
      : fctmFlexotraccion(getNorma(d.hormigon.norma).fctm(fck / 1000), d.h) * 1000 * Ib / (d.h - yg);
    let esm = 0;
    if (Md !== 0) {
      const rel = Mfis / (Md * 0.547);
      esm = Math.max((sigmas / 2e8) * (1 - 0.5 * rel * rel), (0.4 * sigmas) / 2e8);
    }
    // Barras por capa: la primera llena (nmax) y el resto en la segunda
    const texto = capas === 1 ? `${n}D${fi}` : `${nmax}D${fi}+${n - nmax}D${fi}`;
    if (ec2 || ec04) {
      const w = (ec2 ? wkEC2 : wkEC2004)(d, A * 1e-4, fiM, capas, (Md / 1.5) * factor);
      return { fi, n, capas, A, texto, wk: w.wk, detalleWk: w };
    }
    return { fi, n, capas, A, texto, wk: 1.7 * esm * sm * 1000 };
  });

  let superior = [];
  if (Asup > 0) {
    superior = DIAMETROS.map((fi, i) => {
      const n = Math.max(redondear((Asup * 1e4) / AREA_CM2[i]), nmin);
      if (n > 2 * nmax) return { fi, n: null, capas: null, A: null };
      return { fi, n, capas: n > nmax ? 2 : 1, A: n * AREA_CM2[i] };
    });
  }
  return { inferior, superior };
}

/**
 * Abertura de fisura calculada según EN 1992-1-1:2023, 9.2.3 (fórmulas 9.8 a 9.18), en la
 * superficie de la pieza. Hipótesis de esta versión: sección fisurada elástica con
 * Es/Ec,eff = 15 (9.1(5)), carga de larga duración (kt = 0,4), buena adherencia (kb = 0,9),
 * recubrimiento libre c = r − Ø/2 y kw = 1,7 (NDP).
 * @param {DatosRect} d
 * @param {number} As [m²]
 * @param {number} fi Diámetro [m]
 * @param {number} capas
 * @param {number} Mqp Momento cuasipermanente [kN·m]
 */
export function wkEC2(d, As, fi, capas, Mqp, { kt = 0.4, kb = 0.9, kw = 1.7 } = {}) {
  const n = getNorma('EC2-2023');
  const fck = d.hormigon.fk / 1000;
  const fctm = n.fctm(fck) * 1000;
  const Es = d.acero.E;
  const alfaE = Es / d.hormigon.E;
  const dd = d.h - d.rinf;
  // Fibra neutra de la sección fisurada (n = 15): b·x²/2 = n·As·(d − x)
  const nn = 15;
  const x = (-nn * As + Math.sqrt((nn * As) ** 2 + 2 * d.b * nn * As * dd)) / d.b;
  const sigmaS = Mqp / (As * (dd - x / 3));
  const ay = d.rinf;
  const sy = fi + Math.max(fi, 0.025);
  let hcef = Math.min(ay + 5 * fi, 10 * fi, 3.5 * ay, d.h - x, d.h / 2);
  if (capas > 1) hcef += (capas - 1) * sy;
  const rho = As / (d.b * hcef);
  const deps = Math.max((sigmaS - (kt * fctm / rho) * (1 + alfaE * rho)) / Es, ((1 - kt) * sigmaS) / Es);
  const c = d.rinf - fi / 2;
  const kfl = (d.h - hcef) / d.h;
  const sr = Math.min(1.5 * c + ((kfl * kb) / 7.2) * (fi / rho), (1.3 / kw) * (d.h - x));
  const k1r = (d.h - x) / (d.h - ay - x);
  return { wk: kw * k1r * sr * deps * 1000, sigmaS, x, hcef, rho, sr, deps, k1r };
}

/**
 * Abertura de fisura según UNE-EN 1992-1-1 7.3.4 (k1 = 0,8; k2 = 0,5; k3 = 3,4; k4 = 0,425; kt = 0,4).
 * sr,máx = k3·c + k1·k2·k4·φ/ρp,eff, o 1,3(h−x) si la separación supera 5(c+φ/2).
 * @param {DatosRect} d
 * @param {number} As [m²]
 * @param {number} fi Diámetro [m]
 * @param {number} capas
 * @param {number} Mqp [kN·m]
 */
export function wkEC2004(d, As, fi, capas, Mqp, { kt = 0.4 } = {}) {
  const n = getNorma('EC2-2004');
  const fctm = n.fctm(d.hormigon.fk / 1000) * 1000;
  const Es = d.acero.E;
  const alfaE = Es / d.hormigon.E;
  const dd = d.h - d.rinf;
  const nn = 15;
  const x = (-nn * As + Math.sqrt((nn * As) ** 2 + 2 * d.b * nn * As * dd)) / d.b;
  const sigmaS = Mqp / (As * (dd - x / 3));
  const hcef = Math.min(2.5 * d.rinf, (d.h - x) / 3, d.h / 2);
  const rho = As / (d.b * hcef);
  const deps = Math.max((sigmaS - (kt * fctm / rho) * (1 + alfaE * rho)) / Es, (0.6 * sigmaS) / Es);
  const c = d.rinf - fi / 2;
  const sr = 3.4 * c + (0.8 * 0.5 * 0.425 * fi) / rho;
  return { wk: sr * deps * 1000, sigmaS, x, hcef, rho, sr, deps };
}

/**
 * Clase de rotura (dúctil, media o frágil) según x/d, con el criterio del EC-2 (UNE-EN 1992-1-1, 5.5(4) y
 * Anejo Nacional) para las tres normas: sin comprobar la capacidad de giro se puede redistribuir
 * δ = M redistribuido / M elástico ≥ k1 + k2·x/d (fck ≤ 50 MPa) o k3 + k4·x/d (fck > 50 MPa), con
 * k1 = 0,44; k3 = 0,54; k2 = k4 = 1,25·(0,6 + 0,0014/εcu2). La redistribución posible es r = 1 − δ.
 *  - Dúctil: r ≥ 20 % (δ = 0,8, el mínimo con acero clase A), es decir x/d ≤ (0,8 − k1)/k2 = 0,288 con εcu2 = 3,5 ‰.
 *  - Media: 0 < r < 20 %, hasta δ = 1: x/d ≤ (1 − k1)/k2 = 0,448 (el límite de 0,45 de 5.6.3(2)).
 *  - Frágil: más allá no se puede redistribuir; también si x/d supera el de plastificación de la armadura
 *    (sobrearmada: rompe el hormigón antes de plastificar el acero).
 * El umbral del 20 % es criterio del Prontuario. La EHE-08 (19.2.3: r = 56 − 125·x/d) da los mismos umbrales.
 * @param {DatosRect} d
 * @param {number} x Profundidad de la fibra neutra [m]
 */
export function clasificarRotura(d, x) {
  const dd = d.h - d.rinf;
  const xd = x / dd;
  const ecu = -d.hormigon.comp[d.hormigon.comp.length - 1][0];
  const k2 = 1.25 * (0.6 + 0.0014 / ecu);
  const k1 = d.hormigon.fk / 1000 <= 50 ? 0.44 : 0.54;
  const xdLim = ecu / (ecu + epsPlastificacion(d.acero));
  const umbralDuctil = (0.8 - k1) / k2;
  const umbralMedia = (1 - k1) / k2;
  const redMax = Math.max(0, 1 - (k1 + k2 * xd));
  const clase = xd > xdLim || xd > umbralMedia ? 'fragil' : xd > umbralDuctil ? 'media' : 'ductil';
  return { xd, clase, umbralDuctil, umbralMedia, xdLim, redMax, k1, k2, ecu, norma: 'EC2-2004', ref: 'UNE-EN 1992-1-1, 5.5(4) y AN (k1 = 0,44; k3 = 0,54)' };
}

/**
 * Diagrama de dimensionamiento de una sección: para cada A_s1 (armadura de la cara traccionada, «principal»)
 * el momento resistente M_Rd y la armadura de la cara opuesta A_s2 que usa el dimensionamiento:
 * A_s2 = máx(0, A_s1 − A_lim), la mínima que mantiene plastificada la de tracción (nula hasta M_lim).
 * Parte de A_s,min y llega a 1,3·A_lim.
 * @param {DatosRect} d
 * @returns {{as1:number[][], as2:number[][], Alim:number, Amin:number, Amax:number, Mlim:number, Mmin:number, Mmax:number}}
 *   as1 = [A_s1 (m²), M (kN·m)], as2 = [A_s2 (m²), M (kN·m)]
 */
export function curvaDiseno(d, { Nd = 0, elemento = 'viga', n = 60 } = {}) {
  const c = cuantiasMinMax(d, elemento, { Nd });
  const lim = momentoLimite(d);
  const Alim = -lim.Nlim / resistenciaCalculo(d.acero);
  const Atope = Math.max(Math.min(Alim + Math.max(0, (c.Amax - Alim) / 2), 1.3 * Alim), 1.5 * c.Amin);
  const N = -Nd;
  const as1 = [];
  const as2 = [];
  for (let i = 0; i <= n; i++) {
    const A = c.Amin + (Atope - c.Amin) * (i / n);
    const A2 = Math.max(0, A - Alim);
    try {
      const M = Mu(d, A, A2, N).M;
      as1.push([A, M]);
      as2.push([A2, M]);
    } catch { /* sin plano admisible */ }
  }
  return { as1, as2, Alim, Amin: c.Amin, Amax: c.Amax, Mlim: lim.Mlim, Mmin: as1[0]?.[1], Mmax: as1.at(-1)?.[1] };
}
