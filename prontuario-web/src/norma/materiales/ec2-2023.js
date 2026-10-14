// Materiales según EN 1992-1-1:2023 (valores recomendados CEN, sin Anejo Nacional: aún no vigente en España):
// lo que se añade al objeto EC2_2023 de normas.js. Texto: analisis/normativa/ec2-2023/texto.txt.

import { SERIE_EC2, claseEC2 } from './comun.js';

export const EXTRAS_EC2_2023 = {
  gammaAcc: { c: 1.15, s: 1.0 },
  alfaRango: null,
  fckMin: 12,
  serie: SERIE_EC2,
  designacion: claseEC2,
  /** 5.1.4(2): kE entre 5000 y 13000 según el árido (NDP), 9500 para cuarcita. */
  aridos: null,
  /** B.5(7), (B.21) y (B.22): Ec,28 = αc·Ecm con αc = 1/(0,8 + 0,2·fcm/88) ≥ 1. */
  Ec28: (fck, { kE } = {}) => Math.max(1 / (0.8 + 0.2 * (fck + 8) / 88), 1) * (kE ?? 9500) * Math.cbrt(fck + 8),
  fykMax: 700,
  art: {
    gamma: '4.3.3 (tabla 4.3)', fcd: '5.1.6(1), fórmulas (5.3) y (5.4)', diagrama: '8.1.2 (fórmula 8.4)', fcm: 'tabla 5.1', fctm: 'tabla 5.1', fctk: 'tabla 5.1',
    Ec: '5.1.4(2), fórmula (5.1)', fyd: '5.2.4(1)', acero: '5.2.4(2), tablas 5.4 y 5.5', edad: 'B.4, fórmulas (B.1)-(B.4)', retraccion: 'B.6', fluencia: 'B.5',
    tipos: '5.1.3, tabla 5.1',
  },
};
