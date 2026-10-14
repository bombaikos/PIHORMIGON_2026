// Materiales según UNE-EN 1992-1-1:2013 (EN 1992-1-1:2004 + AC:2010) con el Anejo Nacional español (AN):
// lo que se añade al objeto EC2_2004 de normas.js. Texto: analisis/normativa/ec2-2004-an/texto.txt.

import { SERIE_EC2, claseEC2 } from './comun.js';

/** Clases de ductilidad del acero (tabla C.1): k = (ft/fy)k y εuk. */
export const DUCTILIDAD_EC2_2004 = {
  A: { k: 1.05, euk: 0.025 },
  B: { k: 1.08, euk: 0.05 },
  C: { k: 1.15, euk: 0.075 },
};

/** 3.1.3(2): reducción (caliza −10 %, arenisca −30 %) o aumento (basalto +20 %) del Ecm. */
export const ARIDOS_EC2_2004 = [['cuarcita', 1.0], ['caliza', 0.9], ['arenisca', 0.7], ['basalto', 1.2]];

const Ec = (fck, { coefArido = 1 } = {}) => 22000 * Math.pow((fck + 8) / 10, 0.3) * coefArido;

export const EXTRAS_EC2_2004 = {
  gammaAcc: { c: 1.3, s: 1.0 },
  /** AN 3.1.6(1)P: αcc = 1,00; entre 0,85 y 1,0 si la carga permanente supera el 80 %. */
  alfaCC: (fck, { alfaCC } = {}) => alfaCC ?? 1,
  alfaRango: [0.85, 1],
  /** Tabla 3.1: C12/15 …; AN 3.1.2(2)P: Cmáx = C90/105. */
  fckMin: 12,
  serie: SERIE_EC2.filter((x) => x <= 90),
  designacion: claseEC2,
  aridos: ARIDOS_EC2_2004,
  /** Tabla 3.1: Ecm = 22·(fcm/10)^0,3 [GPa]. */
  Ec,
  /** 3.1.4(2): el módulo tangente es Ec = 1,05·Ecm. */
  Ec28: (fck, o = {}) => 1.05 * Ec(fck, o),
  /** AN 3.2.7(2): εud = 0,9·εuk (o εuk si hay garantía) y nunca más de 10 ‰. */
  epsUdMax: 0.010,
  fykMax: 500,
  ductilidad: 'B',
  DUCTILIDAD: DUCTILIDAD_EC2_2004,
  art: {
    gamma: 'AN 2.4.2.4(1) (tabla AN/1)', fcd: '3.1.6(1)P · AN 3.1.6(1)P', diagrama: '3.1.7(1), tabla 3.1', fcm: 'tabla 3.1', fctm: 'tabla 3.1', fctk: 'tabla 3.1',
    Ec: 'tabla 3.1, 3.1.3(2)', fyd: '3.2.7', acero: '3.2.7(2) · AN 3.2.7(2) · tabla C.1', edad: '3.1.2(6) y (9), ecuaciones (3.1)-(3.4)', retraccion: '3.1.4(6), anexo B.2', fluencia: '3.1.4, anexo B.1',
    tipos: '3.1.2 (clases resistentes)',
  },
};
