// Cuantía mínima mecánica de una sección, para compararla con la armadura que dispone el usuario.
// Vigas (rectangular y T, flexión simple): A·fyd ≥ W·fct,m,fl/z con z ≈ 0,8h (EHE-08 42.3.2; UNE-EN 1992-1-1, AN 9.2.1.1(1)).
// EN 1992-1-1:2023 (12.2(2), fórmula 12.1): M_R,min ≥ M_cr = fct,m·W con el acero a fyk; aquí con z ≈ 0,8h.
// Pilares y circulares: A ≥ 0,10·N/fyd y la geométrica (EHE-08 42.3.3 y tabla 42.3.5; EC-2 9.5.2(2); EC-2 2023 tabla 12.3).
// Unidades: m, m², kN, kN/m². Compresión positiva en N.

import { fctmFlexotraccion } from './propiedades.js';

/**
 * @param {Object} d
 * @param {string} d.norma    'EHE-08' | 'EC2-2004' | 'EC2-2023'
 * @param {'viga'|'pilar'} d.tipo
 * @param {number} d.h        canto [m]
 * @param {number} d.Ac       área bruta [m²]
 * @param {number} d.yg       c.d.g. desde arriba [m]
 * @param {number} d.Ix       inercia bruta [m⁴]
 * @param {number} d.fctm     fct,m [kN/m²]
 * @param {number} d.fyk      [kN/m²]
 * @param {number} d.gammaS
 * @param {number} [d.N=0]    axil de compresión [kN] (pilares)
 */
export function cuantiaMinima({ norma, tipo, h, Ac, yg, Ix, fctm, fyk, gammaS, N = 0 }) {
  const fyd = fyk / gammaS;
  if (tipo === 'viga') {
    const dosMil23 = norma === 'EC2-2023';
    const fct = dosMil23 ? fctm : fctmFlexotraccion(fctm, h);
    const f = dosMil23 ? fyk : fyd;
    const A = (W) => (fct * W) / (0.8 * h * f);
    return { tipo, fct, f, z: 0.8 * h, inf: { W: Ix / (h - yg), A: A(Ix / (h - yg)) }, sup: { W: Ix / yg, A: A(Ix / yg) } };
  }
  const Nd = Math.max(N, 0);
  const mec = (0.1 * Nd) / fyd;
  const geo = (norma === 'EHE-08' ? 0.004 : 0.002) * Ac;
  return { tipo, mec, geo, A: Math.max(mec, geo), fyd, Nd };
}
