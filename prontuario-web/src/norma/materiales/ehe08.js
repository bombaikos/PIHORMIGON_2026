// Materiales según la EHE-08 (RD 1247/2008): lo que se añade al objeto EHE08 de normas.js (valores base:
// γ, αcc, diagrama, fct, Ecm). Texto: analisis/normativa/ehe-08/texto.txt. Números de artículo de la Instrucción.

import { SERIE_EHE08 } from './comun.js';

/** Áridos: coeficiente corrector del módulo de deformación (tabla 39.6, comentarios de 39.6, texto.txt l.7866). */
export const ARIDOS_EHE08 = [
  ['cuarcita', 1.0], ['arenisca', 0.7], ['caliza', 0.9], ['calizaDensa', 1.2],
  ['ofita', 1.2], ['ofitaPorosa', 0.9], ['granito', 1.1], ['diabasa', 1.3],
];

export const EXTRAS_EHE08 = {
  gammaAcc: { c: 1.3, s: 1.0 },
  /** 39.4: αcc = 1 con carácter general; el proyectista puede bajarlo hasta 0,85. */
  alfaCC: (fck, { alfaCC } = {}) => alfaCC ?? 1,
  alfaRango: [0.85, 1],
  /** 31.4 (comentarios) y 39.2: fck ≥ 20 en masa, ≥ 25 en armado. */
  fckMin: 20,
  fckMinArmado: 25,
  serie: SERIE_EHE08,
  designacion: (fck) => `HA-${fck}`,
  /** La EHE-08 solo da la resistencia característica inferior (fct,k = 0,7·fct,m). */
  fctk95: null,
  aridos: ARIDOS_EHE08,
  /** 39.6: Ecm = 8500·fcm^(1/3), por el coeficiente del árido. */
  Ec: (fck, { coefArido = 1 } = {}) => 8500 * Math.cbrt(fck + 8) * coefArido,
  /** 39.6: módulo inicial (tangente en el origen) = βE·Ecm con βE = 1,30 − fck/400 ≥ 1,175 (el de la fluencia, 39.8). */
  Ec28: (fck, o = {}) => Math.max(1.30 - fck / 400, 1.175) * 8500 * Math.cbrt(fck + 8) * (o.coefArido ?? 1),
  fykMax: 500,
  art: {
    gamma: '15.3 (tabla 15.3)', fcd: '39.4', diagrama: '39.5 a)', fcm: '39.1 (comentarios)', fctm: '39.1', fctk: '39.1',
    Ec: '39.6 (tabla 39.6)', fyd: '38.3', acero: '38.4', edad: '31.3 (comentarios), 39.6 (comentarios)', retraccion: '39.7', fluencia: '39.8',
    tipos: '39.2 (tipificación), 32.2 (aceros)',
  },
};
