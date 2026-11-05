// Abertura máxima de fisura wmáx (mm) para hormigón armado, combinación cuasipermanente.
//   EHE-08: tabla 5.1.1.2.  EC-2 2004 + AN: tabla AN/9 (7.1N).  EC-2 2023: tablas 9.1 (aspecto) y 9.2 (durabilidad, 0,3·ksurf).
// Cada grupo recoge las clases de exposición que comparten límite.
export const CLASES = {
  'EHE08': [
    { w: 0.4, clases: ['I'] },
    { w: 0.3, clases: ['IIa', 'IIb', 'H'] },
    { w: 0.2, clases: ['IIIa', 'IIIb', 'IV', 'F', 'Qa'] },
    { w: 0.1, clases: ['IIIc', 'Qb', 'Qc'] },
  ],
  'EC2-2004': [
    { w: 0.4, clases: ['X0', 'XC1'] },
    { w: 0.3, clases: ['XC2', 'XC3', 'XC4', 'XF1', 'XF3'] },
    { w: 0.2, clases: ['XS1', 'XS2', 'XD1', 'XD2', 'XD3', 'XF2', 'XF4', 'XA1'] },
    { w: 0.1, clases: ['XS3', 'XA2', 'XA3'] },
  ],
  // EC-2 2023: sin límite por durabilidad en X0 y XC1 (0,4 por aspecto); resto 0,3·ksurf con ksurf ≥ 1 → aquí 0,3 (lado seguro)
  'EC2-2023': [
    { w: 0.4, clases: ['X0', 'XC1'] },
    { w: 0.3, clases: ['XC2', 'XC3', 'XC4', 'XF1', 'XF2', 'XF3', 'XF4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XA1', 'XA2', 'XA3'] },
  ],
};
/** @returns {number|null} wmáx en mm; null si la clase no figura en la norma. EC-2 2023 sin ksurf (ver arriba). */
export function wmaxDe(norma, clase) {
  const g = (CLASES[norma] ?? []).find((x) => x.clases.includes(clase));
  return g ? g.w : null;
}
