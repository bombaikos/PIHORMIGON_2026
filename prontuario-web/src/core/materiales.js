// Ecuaciones constitutivas poligonales, equivalentes a los archivos .mat del
// Prontuario 3.1 (pih_lee.pas: Graba_Hormigon, Graba_Acero).
// Unidades internas: kN y m, tensiones en kN/m². Compresión negativa.

import { DUCTILIDAD } from '../norma/normas.js';
import { normaMat as getNorma } from '../norma/materiales/index.js';

/**
 * @typedef {Object} Material
 * @property {'hormigon'|'acero'|'generico'} tipo
 * @property {string} nombre
 * @property {number} E       Módulo de deformación [kN/m²]
 * @property {number} fk      Resistencia característica [kN/m²]
 * @property {number} gamma
 * @property {number} alfa    Cansancio (solo hormigón)
 * @property {number[][]} comp  Pares [eps, sigma] en compresión, desde 0 hacia negativos
 * @property {number[][]} tracc Pares [eps, sigma] en tracción, desde 0 hacia positivos
 * @property {boolean} roturaComp  Si la deformación no puede pasar del último punto
 * @property {boolean} roturaTracc
 */

/**
 * Hormigón con diagrama parábola-rectángulo discretizado como en el .mat original
 * (10 tramos en la parábola + 1 punto en el rectángulo; sin resistencia a tracción).
 * @param {{nombre?:string, fck:number, norma?:string, gammaC?:number, alfa?:number, tramos?:number}} p  fck en MPa
 * @returns {Material}
 */
export function hormigon({ nombre = '', fck, norma = 'EHE-98', gammaC, alfa, alfaCC, ktc, kE, coefArido, tramos = 10, diag = 'PR', refDiag = 'fcm', puntos, tracc = false }) {
  const n = getNorma(norma);
  if (!(fck > 0)) throw new Error('fck debe ser positivo');
  if (fck > n.fckMax) throw new Error(`${n.nombre}: esta versión solo admite fck ≤ ${n.fckMax} MPa`);
  const g = gammaC ?? n.gammaC;
  const a = alfa ?? n.alfaCC(fck, { ktc, alfaCC });
  if (diag === 'EC2' || diag === 'puntos') {
    const E = n.Ec(fck, { kE, coefArido }) * 1000;
    const fcd = (a * fck) / g;
    const comp = diag === 'EC2' ? compSargin(fck, norma, { kE, coefArido, refDiag, fcd }) : compPuntos(puntos);
    return {
      tipo: 'hormigon', nombre, norma: n.id, E, fk: fck * 1000, gamma: 1, alfa: 1,
      ktc: n.id === 'EC2-2023' ? ktc ?? n.ktc : undefined,
      diag, comp, tracc: tracc && diag === 'EC2' ? traccionElastica(n, fck, E) : [[0, 0], [0.0005, 0]], roturaComp: true, roturaTracc: false,
    };
  }
  const ec2 = n.epsC2(fck);
  const ecu = n.epsCu(fck);
  const np = n.nParab(fck);
  const fcd = (a * fck * 1000) / g; // kN/m²
  const comp = [];
  for (let i = 0; i <= tramos; i++) {
    const e = (ec2 * i) / tramos;
    const s = fcd * (1 - Math.pow(1 - e / ec2, np));
    comp.push([-e, -s]);
  }
  comp.push([-ecu, -fcd]);
  return {
    tipo: 'hormigon',
    nombre,
    norma: n.id,
    E: n.Ec(fck, { kE, coefArido }) * 1000,
    fk: fck * 1000,
    gamma: g,
    alfa: a,
    ktc: n.id === 'EC2-2023' ? ktc ?? n.ktc : undefined,
    comp,
    tracc: [[0, 0], [0.0005, 0]],
    roturaComp: true,
    roturaTracc: false,
  };
}

/** Tracción del diagrama EC-2: elástica con Ecm hasta fctm y caída casi vertical a cero (el EC-2 no da rama de ablandamiento). */
function traccionElastica(n, fck, E) {
  const fctm = n.fctm(fck) * 1000;
  const e = fctm / (n.Ec(fck, {}) * 1000);
  return [[0, 0], [e, fctm], [e * 1.05, 0]];
}

/** Aceros tipificados B 400 S, B 500 S, B 400 SD y B 500 SD (UNE 36065, EHE-08 34.2): fyk y ductilidad (SD = clase C) los fija el nombre. */
export function aceroTipificado(nombre) {
  const m = /^B\s?(400|500)\s?(SD|S)$/i.exec(String(nombre ?? '').trim());
  return m ? { fyk: Number(m[1]), ductilidad: m[2].toUpperCase() === 'SD' ? 'C' : 'B' } : null;
}

/** Hormigón tipificado HA-25…HA-50 (y su variante _EC2): su resistencia característica la fija el nombre (null si no lo es). */
export function fckTipificado(nombre) {
  const m = /^HA-(25|30|35|40|45|50)(_EC2)?$/i.exec(String(nombre ?? '').trim());
  return m ? Number(m[1]) : null;
}

/**
 * Parámetros de la curva de la UNE-EN 1992-1-1 (3.1.5, ec. 3.14; EC-2 2023: 5.1.6(3), ec. 5.6-5.10) para análisis no lineal:
 * σ/f = (k·η − η²)/(1 + (k − 2)·η), k = 1,05·Ecm·|εc1|/f, η = ε/εc1. Por defecto f = fcm; también fck o fcd.
 * @returns {{e1:number, eu1:number, k:number, ref:number, fcm:number, Ecm:number}} deformaciones en valor absoluto, MPa
 */
export function parametrosSargin(fck, normaId, { kE, coefArido, refDiag = 'fcm', fcd } = {}) {
  const n = getNorma(normaId);
  const fcm = fck + 8;
  const Ecm = n.Ec(fck, { kE, coefArido });
  const ec2023 = n.id === 'EC2-2023';
  const e1 = Math.min(0.7 * (ec2023 ? Math.cbrt(fcm) : Math.pow(fcm, 0.31)), 2.8) / 1000;
  const eu1 = (ec2023 ? Math.min(2.8 + 14 * Math.pow(1 - fcm / 108, 4), 3.5) : fck < 50 ? 3.5 : 2.8 + 27 * Math.pow((98 - fcm) / 100, 4)) / 1000;
  const ref = refDiag === 'fck' ? fck : refDiag === 'fcd' ? fcd : fcm;
  return { e1, eu1, k: (1.05 * Ecm * e1) / ref, ref, fcm, Ecm };
}

function compSargin(fck, normaId, o) {
  const { e1, eu1, k, ref } = parametrosSargin(fck, normaId, o);
  const comp = [];
  const tramo = (a, b, N, desde) => { for (let i = desde; i <= N; i++) { const e = a + ((b - a) * i) / N; const eta = e / e1; comp.push([-e, -ref * 1000 * (k * eta - eta * eta) / (1 + (k - 2) * eta)]); } };
  tramo(0, e1, 20, 0);
  tramo(e1, eu1, 10, 1);
  return comp;
}

/** Diagrama de compresión por puntos del usuario: [ε ‰, σ MPa] en positivo, ε creciente. */
function compPuntos(puntos) {
  const pts = (puntos ?? []).filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
  if (pts[0]?.[0] !== 0) pts.unshift([0, 0]);
  if (pts.length < 2) throw new Error('El diagrama por puntos necesita al menos un punto con ε > 0');
  for (let i = 1; i < pts.length; i++) if (!(pts[i][0] > pts[i - 1][0])) throw new Error('Diagrama por puntos: las deformaciones deben ser crecientes');
  if (pts.some((p) => p[1] < 0)) throw new Error('Diagrama por puntos: las tensiones se dan en positivo (compresión)');
  return pts.map(([e, s]) => [-e / 1000, -s * 1000]);
}

/**
 * Acero con diagrama bilineal. Con EHE-98: rama horizontal hasta 10 ‰.
 * Con EN 1992-1-1:2023 (5.2.4(2)): según la clase de ductilidad, εud = εuk/γS y
 * rama horizontal (por defecto) o inclinada hacia k·fyk/γS en εuk.
 * @param {{nombre?:string, fyk:number, norma?:string, gammaS?:number, Es?:number, epsUd?:number,
 *          ductilidad?:'A'|'B'|'C', rama?:'horizontal'|'inclinada'}} p fyk y Es en MPa
 * @returns {Material}
 */
export function acero({ nombre = '', fyk, norma = 'EHE-98', gammaS, Es, epsUd, ductilidad, rama = 'horizontal', epsUdModo, k }) {
  const n = getNorma(norma);
  if (!(fyk > 0)) throw new Error('fyk debe ser positivo');
  const g = gammaS ?? n.gammaS;
  const E = (Es ?? n.Es) * 1000;
  const fyd = (fyk * 1000) / g;
  const ey = fyd / E;
  let eu = epsUd ?? n.epsUd;
  let sU = fyd;
  let clase;
  const conClase = n.id === 'EC2-2023' || n.id === 'EC2-2004';
  if (conClase) {
    clase = ductilidad ?? n.ductilidad;
    const dc = (n.DUCTILIDAD ?? DUCTILIDAD)[clase];
    if (!dc) throw new Error(`Clase de ductilidad desconocida: ${clase}`);
    // EC-2 2023 (5.2.4): εud = εuk/γS. EC-2 2004 con el AN (3.2.7(2)): 0,9·εuk (εuk con garantía), nunca más de 10 ‰
    if (n.id === 'EC2-2023') eu = epsUd ?? dc.euk / g;
    else eu = epsUd ?? Math.min((epsUdModo === 'euk' ? 1 : 0.9) * dc.euk, n.epsUdMax);
    if (rama === 'inclinada') {
      // Recta de (εyd, fyd) a (εuk, k·fyk/γS), cortada en εud
      const sMax = ((k ?? dc.k) * fyk * 1000) / g;
      sU = fyd + ((sMax - fyd) * (eu - ey)) / (dc.euk - ey);
    }
  }
  return {
    tipo: 'acero',
    nombre,
    norma: n.id,
    E,
    fk: fyk * 1000,
    gamma: g,
    alfa: 1,
    ductilidad: clase,
    k: conClase && rama === 'inclinada' ? k ?? (n.DUCTILIDAD ?? DUCTILIDAD)[clase].k : undefined,
    rama: conClase ? rama : undefined,
    comp: [[0, 0], [-ey, -fyd], [-eu, -sU]],
    tracc: [[0, 0], [ey, fyd], [eu, sU]],
    roturaComp: true,
    roturaTracc: true,
  };
}

/** Resistencia de cálculo (valor absoluto de la meseta) [kN/m²]. */
export function resistenciaCalculo(mat) {
  if (mat.tipo === 'acero') return mat.tracc[1][1];
  return Math.max(...mat.comp.map((p) => Math.abs(p[1])), ...mat.tracc.map((p) => Math.abs(p[1])));
}

/**
 * Diagrama característico a partir del de cálculo: sin γ ni α (fck, fyk). En el hormigón las
 * deformaciones no cambian; en el acero la meseta empieza en fyk/Es. Sirve también para
 * diagramas importados de un .mat, que llevan su γ y su α.
 * @param {Material} mat
 * @returns {Material}
 */
export function caracteristico(mat) {
  const k = (mat.gamma ?? 1) / (mat.alfa ?? 1);
  if (k === 1) return mat;
  const esc = (pts) => pts.map(([e, s]) => [e, s * k]);
  if (mat.tipo === 'acero') {
    // La rama elástica se alarga en la misma proporción; el final (εu) se mantiene
    const rama = (pts) => pts.map(([e, s], i) => [i === 1 ? e * k : e, s * k]).filter((p, i, a) => i < 2 || Math.abs(p[0]) > Math.abs(a[1][0]));
    return { ...mat, gamma: 1, alfa: 1, comp: rama(mat.comp), tracc: rama(mat.tracc) };
  }
  return { ...mat, gamma: 1, alfa: 1, comp: esc(mat.comp), tracc: esc(mat.tracc) };
}

/** Deformación de plastificación del acero (primer punto de la rama de tracción). */
export function epsPlastificacion(mat) {
  return mat.tracc[1][0];
}

/** Límites de deformación del material: [epsMin, epsMax]. */
export function limites(mat) {
  return [
    mat.roturaComp ? mat.comp[mat.comp.length - 1][0] : -Infinity,
    mat.roturaTracc ? mat.tracc[mat.tracc.length - 1][0] : Infinity,
  ];
}

/** Deformaciones donde cambia la pendiente del diagrama (para integrar exacto). */
export function quiebros(mat) {
  return [...mat.comp.map((p) => p[0]), ...mat.tracc.map((p) => p[0])];
}

/**
 * Tensión para una deformación. Fuera del último punto devuelve 0, igual que la
 * integración por tramos de calcomun.pas (calcula_Ne).
 */
export function sigma(mat, eps) {
  const pts = eps < 0 ? mat.comp : mat.tracc;
  for (let j = 1; j < pts.length; j++) {
    const [e0, s0] = pts[j - 1];
    const [e1, s1] = pts[j];
    const dentro = eps < 0 ? eps <= e0 && eps >= e1 : eps >= e0 && eps <= e1;
    if (dentro) {
      if (e1 === e0) return s1;
      return s0 + ((s1 - s0) * (eps - e0)) / (e1 - e0);
    }
  }
  return 0;
}

/**
 * Propiedades derivadas del hormigón para la ficha de materiales (MPa).
 * @param {number} fck MPa
 * @param {string} normaId
 */
export function propiedadesHormigon(fck, normaId = 'EHE-98', { ktc, kE, h, alfaCC, coefArido, gammaC } = {}) {
  const n = getNorma(normaId);
  const alfa = n.alfaCC(fck, { ktc, alfaCC });
  const gc = gammaC ?? n.gammaC;
  const ktt = n.id === 'EC2-2023' ? ((ktc ?? n.ktc) === 1 ? 0.8 : 0.7) : 1; // factor de la resistencia a tracción de cálculo (5.5)
  return {
    fck,
    fcm: n.fcm(fck),
    alfa,
    etacc: n.etacc ? n.etacc(fck) : undefined,
    ktc: n.id === 'EC2-2023' ? ktc ?? n.ktc : undefined,
    kE: n.id === 'EC2-2023' ? kE ?? n.kE : undefined,
    coefArido: n.id === 'EC2-2023' ? undefined : coefArido ?? 1,
    gammaC: gc,
    gammaV: n.gammaV,
    fcd: (alfa * fck) / gc,
    fctm: n.fctm(fck),
    fctk05: n.fctk05(fck),
    fctk95: n.fctk95 ? n.fctk95(fck) : null,
    fctd: (ktt * n.fctk05(fck)) / gc,
    ktt: n.id === 'EC2-2023' ? ktt : undefined,
    fctfl: n.fctfl ? n.fctfl(fck) : null,
    fctmfl: n.fctmfl && h ? n.fctmfl(fck, h) : null,
    Ec: n.Ec(fck, { kE, coefArido }),
    Ec28: n.Ec28 ? n.Ec28(fck, { kE, coefArido }) : undefined,
    epsC2: n.epsC2(fck),
    epsCu: n.epsCu(fck),
    nExp: n.nExp ? n.nExp(fck) : 2,
  };
}

export function propiedadesAcero(fyk, normaId = 'EHE-98', { gammaS, Es, epsUd, ductilidad, rama, epsUdModo, k } = {}) {
  const n = getNorma(normaId);
  const m = acero({ fyk, norma: normaId, gammaS, Es, epsUd, ductilidad, rama, epsUdModo, k });
  const dc = m.ductilidad ? (n.DUCTILIDAD ?? DUCTILIDAD)[m.ductilidad] : null;
  return {
    fyk,
    gammaS: m.gamma,
    fyd: m.tracc[1][1] / 1000,
    Es: m.E / 1000,
    epsY: m.tracc[1][0],
    epsUd: m.tracc[2][0],
    sigmaUd: m.tracc[2][1] / 1000,
    ductilidad: m.ductilidad,
    k: m.k ?? dc?.k,
    euk: dc?.euk,
    rama: m.rama,
  };
}

/** Rehace el objeto Material a partir de una ficha de proyecto. */
export function materialDeFicha(ficha, normaId, { tracc = false } = {}) {
  if (ficha.diagrama) return { ...ficha.diagrama, nombre: ficha.nombre };
  if (ficha.tipo !== 'acero') ficha = { ...ficha, fck: fckTipificado(ficha.nombre) ?? ficha.fck };
  else if (aceroTipificado(ficha.nombre)) ficha = { ...ficha, ...aceroTipificado(ficha.nombre) };
  if (ficha.tipo === 'hormigon') {
    return hormigon({ nombre: ficha.nombre, fck: ficha.fck, norma: normaId, gammaC: ficha.gammaC, alfa: ficha.alfa, alfaCC: ficha.alfaCC, ktc: ktcDe(ficha, normaId), kE: ficha.kE, coefArido: coefAridoDe(ficha, normaId), diag: ficha.diag, refDiag: ficha.refDiag, puntos: ficha.puntos, tracc });
  }
  return acero({ nombre: ficha.nombre, fyk: ficha.fyk, norma: normaId, gammaS: ficha.gammaS, Es: ficha.Es, epsUd: ficha.epsUd, ductilidad: ficha.ductilidad, rama: ficha.rama, epsUdModo: ficha.epsUdModo, k: ficha.k });
}

/** ktc de la ficha: por defecto 1,00 (coeficiente de los hormigones tipificados), no el 0,85 de EC-2 2023. */
export const ktcDe = (ficha, normaId) => ficha.ktc ?? (normaId === 'EC2-2023' ? 1 : undefined);

/** Coeficiente del árido de la ficha (clave de n.aridos); 1 si la norma no lo tiene o no se ha elegido. */
export function coefAridoDe(ficha, normaId) {
  const lista = getNorma(normaId).aridos;
  return lista?.find(([k]) => k === ficha.arido)?.[1] ?? 1;
}

/** Opciones de normas que lleva la ficha de un hormigón (para propiedadesHormigon). */
export function opcionesHormigon(ficha, normaId) {
  return { ktc: ktcDe(ficha, normaId), kE: ficha.kE, alfaCC: ficha.alfaCC, gammaC: ficha.gammaC, coefArido: coefAridoDe(ficha, normaId) };
}

/** Opciones que lleva la ficha de un acero (para propiedadesAcero). */
export function opcionesAcero(ficha) {
  return { gammaS: ficha.gammaS, Es: ficha.Es, epsUd: ficha.epsUd, ductilidad: ficha.ductilidad, rama: ficha.rama, epsUdModo: ficha.epsUdModo, k: ficha.k };
}
