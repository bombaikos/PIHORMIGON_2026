// Puerto literal de las fórmulas de TT1.pas (Prontuario 3.1, EHE-98) para contrastar el módulo Cortante.
// Solo referencia de pruebas: HallarVu1, HallarVu2, Calculasigmacd y CalculaTetae, leídas en analisis/cortante-plan.md §1.2.
// Aquí kN y m como en el original; tracción positiva dentro (sigma en MPa, como el 3.1 internamente: tracción +).

const rad = (g) => (g * Math.PI) / 180;

/**
 * @param {{fck:number, b0:number, d:number, rho:number, Nd:number, Ac:number, sy:number, tetaDeg:number, alfaDeg:number, A:number, fyd:number, z?:number}} x
 *   fck MPa, b0 y d en m, rho en tanto por uno (ya topado a 0,02), Nd en kN con la COMPRESIÓN positiva, Ac m², sy en MPa tracción +,
 *   A = Aα por unidad de longitud en m²/m, fyd en MPa (ya limitado a 400)
 */
export function tt1(x) {
  const fcd = x.fck / 1.5;
  const fctm = 0.3 * Math.pow(x.fck, 2 / 3);
  const z = x.z ?? 0.9 * x.d;
  const sigmaCd = -(x.Nd / x.Ac) / 1000; // tracción +, MPa
  const sigmaX = sigmaCd;
  const cot = 1 / Math.tan(rad(x.tetaDeg));
  const cotA = 1 / Math.tan(rad(x.alfaDeg));
  // Ángulo de fisuras
  let cotE = Math.sqrt(Math.max(fctm * fctm - fctm * (sigmaX + x.sy) + sigmaX * x.sy, 0)) / (fctm - x.sy);
  cotE = Math.min(2, Math.max(0.5, cotE));
  const K = Math.min(1, Math.max(0, 1.6667 * (1 + sigmaCd / fcd)));
  const Vu1 = K * 0.6 * fcd * 1000 * x.b0 * x.d * (cot + cotA) / (1 + cot * cot);
  const xi = 1 + Math.sqrt(0.2 / x.d);
  const beta = cot < cotE ? (2 * cot - 1) / (2 * cotE - 1) : (cot - 2) / (cotE - 2);
  const hay = x.A > 0;
  const Vcu = hay
    ? Math.max(0, (100 * xi * Math.cbrt(0.1 * x.rho * 1000 * x.fck) - 0.15 * sigmaCd * 1000) * x.b0 * x.d * beta)
    : Math.max(0, (120 * xi * Math.cbrt(0.1 * x.rho * 1000 * x.fck) - 0.15 * sigmaCd * 1000) * x.b0 * x.d);
  const Vsu = hay ? z * Math.sin(rad(x.alfaDeg)) * (cotA + cot) * x.A * x.fyd * 1000 : 0;
  return { sigmaCd: -sigmaCd, cotE, thetaE: (Math.atan(1 / cotE) * 180) / Math.PI, K, Vu1, Vcu, Vsu, Vu2: Vcu + Vsu, Vu: Math.min(Vu1, Vcu + Vsu), beta };
}
