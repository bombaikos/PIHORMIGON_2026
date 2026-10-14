// Designación del hormigón: la del CE / EHE-08 (T-R/C/TM/A, p. ej. HA-25/B/20/XC4) y la de la UNE-EN 206
// (clase resistente, exposición, árido, consistencia y cloruros, p. ej. C25/30 XC4 D20 S2 Cl 0,40).

export const CONSISTENCIAS = ['S', 'P', 'B', 'F', 'L'];
/** Asiento en cono de Abrams, mm (CE 33.5.a, EHE-08). */
export const ASIENTO = { S: '0–20', P: '30–40', B: '50–90', F: '100–150', L: '160–210' };
/** Clase de consistencia de la UNE-EN 206 más próxima (S1 10–40, S2 50–90, S3 100–150, S4 160–210). */
export const CONSISTENCIA_EN = { S: 'S1', P: 'S1', B: 'S2', F: 'S3', L: 'S4' };
/** fck cilíndrica → resistencia cúbica de la clase C (UNE-EN 206 tabla 12). */
export const CUBICA = { 12: 15, 16: 20, 20: 25, 25: 30, 30: 37, 35: 45, 40: 50, 45: 55, 50: 60, 55: 67, 60: 75, 70: 85, 80: 95, 90: 105, 100: 115 };
const PREFIJO = { armado: 'HA', pretensado: 'HP', masa: 'HM' };

/** HA-25/B/20/XC4+XD3 (en EHE-08, HA-25/B/20/IIa+Qa). */
export function designacionCE({ tipo = 'armado', fck, consistencia = 'B', arido = 20, clases = [] }) {
  return `${PREFIJO[tipo] ?? 'HA'}-${fck}/${consistencia}/${arido}/${clases.length ? clases.join('+') : '…'}`;
}

/** C25/30 XC4, XD3 D20 S2 Cl 0,40. El contenido de cloruros: 0,40 % armado, 0,20 % pretensado, sin dato en masa. */
export function designacionEN({ tipo = 'armado', fck, consistencia = 'B', arido = 20, clases = [] }) {
  const cubica = CUBICA[fck];
  const clase = `C${fck}/${cubica ?? '?'}`;
  const cl = tipo === 'armado' ? ' Cl 0,40' : tipo === 'pretensado' ? ' Cl 0,20' : '';
  return `${clase} ${clases.length ? clases.join(', ') : '…'} D${arido} ${CONSISTENCIA_EN[consistencia] ?? 'S2'}${cl}`;
}
