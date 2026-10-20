// Puerto de las fórmulas de TT3.pas (punzonamiento del Prontuario 3.1, EHE-98) para contrastar el módulo Punzonamiento.
// Solo referencia de pruebas: leídas en analisis/punzonamiento-plan.md §1 (el código Delphi está en el equipo de José Luis).
// Unidades del original: kN y m (fck en MPa). Sin σ'cd, sin tope de fck y sin τrd mínimo; Vcu con coeficiente 1.

const PI = Math.PI;

/** Perímetros u1 (2d) y u0 del 3.1. rect: interior, borde, esquina; circ: con el sumando D extra en borde y esquina. */
export function perimetros31({ tipo, pos, c1, c2, D, d }) {
  if (tipo === 'rect') {
    if (pos === 'interior') return { u1: 2 * (c1 + c2) + 4 * PI * d, u0: 2 * (c1 + c2) };
    if (pos === 'borde') return { u1: c1 + 2 * c2 + 2 * PI * d, u0: Math.min(c1 + 3 * d, c1 + 2 * c2) };
    return { u1: c1 + c2 + PI * d, u0: Math.min(c1, 1.5 * d) + Math.min(c2, 1.5 * d) };
  }
  if (pos === 'interior') return { u1: PI * (D + 4 * d), u0: PI * D };
  if (pos === 'borde') return { u1: D + PI * (D / 2 + 2 * d), u0: PI * D / 2 };
  return { u1: D + 0.5 * PI * (D / 2 + 2 * d), u0: PI * D / 4 };
}

/**
 * @param {Object} x  tipo, pos, c1, c2, D, d (m), rho (tanto por uno), fck (MPa), beta, Fsd (kN),
 *                    Asw (m², todas las ramas dentro del perímetro), fyd (MPa)
 */
export function tt3(x) {
  const fcd = x.fck / 1.5;
  const xi = 1 + Math.sqrt(0.2 / x.d);
  const tau = 0.12 * xi * Math.cbrt(100 * x.rho * x.fck) * 1000; // kN/m²
  const { u1, u0 } = perimetros31(x);
  const Fu1 = (0.3 * fcd * 1000 * u0 * x.d) / x.beta;
  const Vcu = tau * u1 * x.d;
  const z = 0.9 * x.d;
  const Vsu = x.Asw ? (z * Math.sin(Math.PI / 2) * (0 + 1) * x.Asw * x.fyd * 1000) / (2.25 * x.d) : 0;
  return { xi, tauMPa: tau / 1000, u1, u0, Fu1, Vcu, Vsu, Fu: (Vcu + Vsu) / x.beta, FuSin: Vcu / x.beta };
}
