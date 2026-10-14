// Piezas comunes de los materiales de las tres normas del proyecto (EHE-08, EC-2 2004 + AN y EC-2 2023).
// Unidades: MPa (los módulos de deformación también), deformaciones en tanto por uno.

/** Resistencia cúbica de cada clase del Eurocódigo (C25/30: fck 25, fck,cube 30). */
export const CUBICA = { 12: 15, 16: 20, 20: 25, 25: 30, 30: 37, 35: 45, 40: 50, 45: 55, 50: 60, 55: 67, 60: 75, 70: 85, 80: 95, 90: 105, 100: 115 };
export const SERIE_EC2 = Object.keys(CUBICA).map(Number);
/** Serie recomendada por EHE-08, 39.2. */
export const SERIE_EHE08 = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100];

/** C25/30 (o C27 si no es una clase de la serie). */
export const claseEC2 = (fck) => (CUBICA[fck] ? `C${fck}/${CUBICA[fck]}` : `C${fck}`);

/** fct,m,fl = max{(1,6 − h/1000)·fct,m ; fct,m}, h en mm (EHE-08 39.1; EC-2 2004 (3.23); EC-2 2023 (9.30)). */
export const flexotraccion = (fctm, hMm) => Math.max((1.6 - hMm / 1000) * fctm, fctm);

/** Cementos por velocidad de endurecimiento: S lento, N normal, R rápido (EHE-08 31.3; EC-2 3.1.2(6); EC-2 2023 B.3). */
export const CEMENTOS = ['S', 'N', 'R'];

/** Parábola-rectángulo de EC-2 2004 y EHE-08 para fck > 50 MPa. */
export const epsC2Alta = (fck) => (fck <= 50 ? 0.002 : 0.002 + 0.000085 * Math.pow(fck - 50, 0.53));
