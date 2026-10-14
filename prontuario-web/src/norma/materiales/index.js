// Materiales de las normas del proyecto. normas.js (hilo de Secciones) define cada norma con sus valores
// base; aquí se le añaden los datos propios de Materiales (rangos, series, áridos, ductilidad, artículos).

import { norma as base, NORMAS } from '../normas.js';
import { EXTRAS_EHE08 } from './ehe08.js';
import { EXTRAS_EC2_2004 } from './ec2-2004.js';
import { EXTRAS_EC2_2023 } from './ec2-2023.js';

const EXTRAS = { 'EHE-08': EXTRAS_EHE08, 'EC2-2004': EXTRAS_EC2_2004, 'EC2-2023': EXTRAS_EC2_2023 };
const cache = {};

/** Norma con los datos de materiales ya fundidos: las del selector y, si no, la heredada (EHE-98). */
export function normaMat(id) {
  const n = base(id);
  if (!EXTRAS[id]) return n;
  return (cache[id] ??= { ...n, ...EXTRAS[id] });
}

export const IDS_NORMAS = Object.keys(EXTRAS);
export const normasMateriales = () => IDS_NORMAS.filter((id) => NORMAS[id]);

/** Norma que usa una vista aunque el proyecto lleve una heredada (EHE-98 → la de por defecto). */
export const normaVigente = (id, defecto = 'EC2-2004') => (EXTRAS[id] ? id : defecto);
