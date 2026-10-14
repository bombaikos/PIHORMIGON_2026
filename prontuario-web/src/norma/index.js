// Punto de entrada de las normas: datos básicos (normas.js) y módulos por norma.
// Cada norma tiene su carpeta; la interfaz y el núcleo piden aquí lo que necesitan
// en lugar de preguntar "si es EC-2…".

import { norma } from './normas.js';
import * as durEHE from './ehe98/durabilidad.js';
import * as durEC2 from './ec2-2023/durabilidad.js';
import * as durEHE08 from './ehe08/durabilidad.js';
import * as durEC2004 from './ec2-2004/durabilidad.js';

/** Durabilidad con cmin,dur escrito por el usuario (pendiente de volcar las tablas de cada norma). */
const manual = (id, articulos) => ({
  CLASES: durEC2.CLASES,
  durabilidad: (a) => ({ ...durEC2.durabilidad(a), norma: id, articulos }),
});

const MODULOS = {
  'EHE-98': { durabilidad: durEHE },
  'EC2-2023': { durabilidad: durEC2 },
  'EHE-08': { durabilidad: durEHE08 },
  'EC2-2004': { durabilidad: durEC2004 },
};

export function modulo(id) {
  const m = MODULOS[id];
  if (!m) throw new Error(`Norma desconocida: ${id}`);
  return { ...m, datos: norma(id) };
}

export { NORMAS, norma } from './normas.js';
