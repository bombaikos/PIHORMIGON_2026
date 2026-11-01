// Inestabilidad de soportes: piezas de geometría y rigidez que no dependen de la norma.
// Unidades: m, m², m⁴ (los esfuerzos y tensiones los tratan las funciones de src/norma/inestabilidad.js).

/** Inercia de una pieza rectangular b × h (h es el canto en el plano del pórtico). */
export const inerciaRect = (b, h) => (b * h ** 3) / 12;

/**
 * Relación de rigideces Ψ en un extremo del soporte (EHE-08 43.1.2):
 *   Ψ = Σ(fp·E·I/L)_soportes / Σ(fv·E·I/L)_vigas
 * con la inercia bruta multiplicada por la fracción fp (soportes) o fv (vigas). El módulo E es el mismo y se simplifica.
 * Los voladizos no aportan rigidez: no se pasan.
 *  - 'empotrado' → Ψ = 0; 'articulado' → Ψ = ∞.
 *  - 'nudo': soporte propio (Ic, L) + soporte contiguo opcional (b, h, L) frente a las vigas (b, h, L) que concurren.
 *    Sin vigas, el nudo no coacciona el giro (Ψ = ∞).
 * @param {{tipo:'empotrado'|'articulado'|'nudo', pilar?:{b:number,h:number,L:number}|null, vigas?:{b:number,h:number,L:number}[]}} ext
 * @param {{Ic:number, L:number, fp:number, fv:number}} d   Ic y L del soporte que se comprueba
 */
export function psiExtremo(ext, { Ic, L, fp, fv }) {
  if (ext.tipo === 'empotrado') return 0;
  if (ext.tipo === 'articulado') return Infinity;
  const kc = (fp * Ic) / L + (ext.pilar && ext.pilar.L > 0 ? (fp * inerciaRect(ext.pilar.b, ext.pilar.h)) / ext.pilar.L : 0);
  const kv = (ext.vigas ?? []).filter((v) => v && v.L > 0 && v.b > 0 && v.h > 0).reduce((a, v) => a + (fv * inerciaRect(v.b, v.h)) / v.L, 0);
  return kv > 0 ? kc / kv : Infinity;
}

/**
 * Flexibilidad relativa k (EC-2 5.8.3.2(3), EC-2 2023 O.5) a partir de Ψ. La viga que coacciona el giro tiene una rigidez
 * de giro 2·EI/L con el pórtico arriostrado (extremo lejano girando en sentido contrario) y 6·EI/L con el pórtico
 * traslacional (mismo giro en ambos extremos), de modo que k = Ψ/2 y k = Ψ/6. Mínimo 0,1 (nota de 5.8.3.2(3)).
 */
export function flexibilidad(psi, traslacional) {
  if (!Number.isFinite(psi)) return Infinity;
  return Math.max(psi / (traslacional ? 6 : 2), 0.1);
}

/**
 * Radio de giro de la armadura longitudinal i_s respecto al c.d.g. de la sección, y distancia entre barras extremas (d − d′).
 * @param {{y:number, A:number}[]} barras  y en m medida desde un borde; A en m²
 * @param {number} h  canto de la sección [m]
 */
export function armaduraEnPlano(barras, h) {
  const As = barras.reduce((a, b) => a + b.A, 0);
  if (!(As > 0)) return { As: 0, is: 0, dd: 0, yg: h / 2 };
  const yg = h / 2; // armadura simétrica: el centro de la sección
  const is2 = barras.reduce((a, b) => a + b.A * (b.y - yg) ** 2, 0) / As;
  const ys = barras.map((b) => b.y);
  return { As, is: Math.sqrt(is2), dd: Math.max(...ys) - Math.min(...ys), yg };
}
