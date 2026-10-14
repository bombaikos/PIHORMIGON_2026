// Parámetros normativos intercambiables.
// Unidades de entrada: MPa. Las funciones devuelven MPa salvo que se indique.

/** EHE-98: la normativa del Prontuario 3.1 original (se usa para validar). */
export const EHE98 = {
  id: 'EHE-98',
  ref: 'EHE-98',
  nombre: 'EHE-98 (Prontuario 3.1)',
  gammaC: 1.5,
  gammaS: 1.15,
  /** Coeficiente de cansancio α (el "cansancio" de los .mat). */
  alfaCC: () => 0.85,
  epsC2: () => 0.002,
  epsCu: () => 0.0035,
  /** Límite de alargamiento del acero (10 ‰, art. 39.4/42.1.2). */
  epsUd: 0.010,
  Es: 200000,
  /** Módulo de deformación longitudinal secante, Ej = 8500·(fck+8)^(1/3). */
  Ec: (fck) => 8500 * Math.cbrt(fck + 8),
  fcm: (fck) => fck + 8,
  fctm: (fck) => 0.30 * Math.pow(fck, 2 / 3),
  fctk05: (fck) => 0.21 * Math.pow(fck, 2 / 3),
  fctk95: (fck) => 0.39 * Math.pow(fck, 2 / 3),
  fctfl: (fck) => 0.37 * Math.pow(fck, 2 / 3),
  fckMax: 50,
};

/**
 * EN 1992-1-1:2023, valores recomendados por CEN (sin Anejo Nacional español).
 * Revisado contra el texto oficial: analisis/ec2-2023-revision.md.
 *  - fcd = ηcc·ktc·fck/γC (5.3), ηcc = (40/fck)^(1/3) ≤ 1 (5.4), ktc = 0,85 salvo 5.1.6(1)
 *  - Ecm = kE·fcm^(1/3) (5.1), kE = 9500 por defecto
 *  - fctm según tabla 5.1 (cambia de fórmula por encima de C50/60)
 *  - εc2 = 2 ‰ y εcu = 3,5 ‰ para todas las clases (8.1.2, fórmula 8.4)
 *  - Acero: εud = εuk/γS según la clase de ductilidad (5.2.4(2))
 */
const fctm2023 = (fck) => (fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 1.1 * Math.cbrt(fck));
export const DUCTILIDAD = {
  A: { k: 1.05, euk: 0.025 },
  B: { k: 1.08, euk: 0.05 },
  C: { k: 1.15, euk: 0.075 },
};
export const EC2_2023 = {
  id: 'EC2-2023',
  ref: 'EN 1992-1-1:2023',
  nombre: 'EN 1992-1-1:2023 (valores CEN, sin Anejo Nacional)',
  gammaC: 1.5,
  gammaS: 1.15,
  /** Tabla 4.3: para cortante y punzonamiento sin armadura. */
  gammaV: 1.4,
  etacc: (fck) => Math.min(1, Math.cbrt(40 / fck)),
  /** ktc por defecto: 0,85 (1,00 solo si tref ≤ 28 d y la carga de cálculo llega a partir de 3 meses). */
  ktc: 0.85,
  alfaCC: (fck, { ktc } = {}) => Math.min(1, Math.cbrt(40 / fck)) * (ktc ?? 0.85),
  epsC2: () => 0.002,
  epsCu: () => 0.0035,
  ductilidad: 'B',
  epsUd: DUCTILIDAD.B.euk / 1.15,
  Es: 200000,
  kE: 9500,
  Ec: (fck, { kE } = {}) => (kE ?? 9500) * Math.cbrt(fck + 8),
  fcm: (fck) => fck + 8,
  fctm: fctm2023,
  fctk05: (fck) => 0.7 * fctm2023(fck),
  fctk95: (fck) => 1.3 * fctm2023(fck),
  /** Fórmula 9.30 (solo flechas): depende del canto h [m]. */
  fctfl: null,
  fctmfl: (fck, h) => Math.max((1.6 - h) * fctm2023(fck), fctm2023(fck)),
  fckMax: 100,
};

/** Exponente de la parábola. Hasta C50 (EHE-98, EC-2 2023) vale 2. */
EHE98.nParab = () => 2;
EC2_2023.nParab = () => 2;
EHE98.familia = 'EHE';
EC2_2023.familia = 'EC2';

const flexo = (fctm) => (fck, h) => Math.max((1.6 - h) * fctm(fck), fctm(fck));

/**
 * EHE-08 (arts. 15, 38.4, 39.1, 39.4, 39.5): αcc = 1, fctm con raíz para fck > 50,
 * εc0, εcu y n según 39.5; Ecm = 8500·∛fcm; εud = 10 ‰ (art. 38.4/39.6).
 */
const fctmEHE08 = (fck) => (fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 0.58 * Math.sqrt(fck));
export const EHE08 = {
  id: 'EHE-08',
  ref: 'EHE-08',
  corto: 'EHE-08',
  nombre: 'EHE-08 (Instrucción de Hormigón Estructural)',
  familia: 'EHE',
  vigente: false,
  gammaC: 1.5,
  gammaS: 1.15,
  alfaCC: () => 1,
  epsC2: (fck) => (fck <= 50 ? 0.002 : 0.002 + 0.000085 * Math.pow(fck - 50, 0.53)),
  epsCu: (fck) => (fck <= 50 ? 0.0035 : 0.0026 + 0.0144 * Math.pow((100 - fck) / 100, 4)),
  nParab: (fck) => (fck <= 50 ? 2 : 1.4 + 9.6 * Math.pow((100 - fck) / 100, 4)),
  epsUd: 0.010,
  Es: 200000,
  Ec: (fck) => 8500 * Math.cbrt(fck + 8),
  fcm: (fck) => fck + 8,
  fctm: fctmEHE08,
  fctk05: (fck) => 0.7 * fctmEHE08(fck),
  fctk95: (fck) => 1.3 * fctmEHE08(fck),
  fctfl: null,
  fctmfl: flexo(fctmEHE08),
  fckMax: 100,
};

/**
 * UNE-EN 1992-1-1:2013 con el Anejo Nacional (norma vigente): γC = 1,5, γS = 1,15 (AN 2.4.2.4),
 * αcc = 1,00 (AN 3.1.6(1)P), εud = 10 ‰ (AN 3.2.7(2): 0,9·εuk con tope 10 ‰), fck ≤ 90 (AN 3.1.2(2)P).
 * Tabla 3.1: εc2, εcu2, n; Ecm = 22·(fcm/10)^0,3 [GPa].
 */
const fctmEC2004 = (fck) => (fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10));
export const EC2_2004 = {
  id: 'EC2-2004',
  ref: 'UNE-EN 1992-1-1:2013 + AN',
  corto: 'EC-2 2004 + AN',
  nombre: 'UNE-EN 1992-1-1:2013 con Anejo Nacional (vigente)',
  familia: 'EC2',
  vigente: true,
  gammaC: 1.5,
  gammaS: 1.15,
  alfaCC: () => 1,
  epsC2: (fck) => (fck <= 50 ? 0.002 : 0.002 + 0.000085 * Math.pow(fck - 50, 0.53)),
  epsCu: (fck) => (fck <= 50 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4)),
  nParab: (fck) => (fck <= 50 ? 2 : 1.4 + 23.4 * Math.pow((90 - fck) / 100, 4)),
  epsUd: 0.010,
  Es: 200000,
  Ec: (fck) => 22000 * Math.pow((fck + 8) / 10, 0.3),
  fcm: (fck) => fck + 8,
  fctm: fctmEC2004,
  fctk05: (fck) => 0.7 * fctmEC2004(fck),
  fctk95: (fck) => 1.3 * fctmEC2004(fck),
  fctfl: null,
  fctmfl: flexo(fctmEC2004),
  fckMax: 90,
};
EC2_2023.corto = 'EN 1992‑1‑1:2023';
EC2_2023.vigente = false;
EHE98.corto = 'EHE-98';
EHE98.vigente = false;

/** Normas seleccionables en la app (EHE-98 queda fuera; solo se conserva para validar contra el Prontuario 3.1). */
export const NORMAS = { [EC2_2004.id]: EC2_2004, [EHE08.id]: EHE08, [EC2_2023.id]: EC2_2023 };
export const NORMA_DEFECTO = EC2_2004.id;
const LEGADO = { [EHE98.id]: EHE98 };

export function norma(id) {
  const n = NORMAS[id] ?? LEGADO[id];
  if (!n) throw new Error(`Norma desconocida: ${id}`);
  return n;
}
