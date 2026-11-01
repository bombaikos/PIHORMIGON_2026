// ELS ▸ Fisuración: abertura característica de fisura wk de una sección rectangular (hormigón armado, sin pretensado
// ni rigidización a tracción de la sección entera) con las tres normas del Prontuario.
//   · EHE-08, art. 49.2.4:                 wk = β·sm·εsm
//   · EC-2 2004 + AN, 7.3.4:                wk = sr,máx·(εsm − εcm)
//   · EC-2 2023, 9.2.3:                     wk = kw·k1/r·sr,m,cal·(εsm − εcm)   (medida en la superficie)
// Unidades de este módulo (sentido N-mm-MPa del EC-2; la conversión a kN·m y kN se hace en la frontera, aquí ya en N y mm):
// longitudes en mm, áreas en mm², tensiones en MPa, M en kN·m y N en kN (solo en la entrada de `fisurada` y `calcula`).
// Convención del Prontuario: compresión positiva; M > 0 traciona la cara inferior (armadura principal abajo).
import { wmaxDe } from '../norma/fisuracion/limites.js';

export const ES = 200000; // MPa

/** Propiedades del hormigón para fisuración (fck en MPa). fctm y Ecm del EC-2 (3.1.3); fctm,fl del EC-2 (3.23) y EHE-08 39.1. */
export function propsHormigon(fck, h) {
  const fctm = fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10);
  const Ecm = 22000 * Math.pow((fck + 8) / 10, 0.3);
  return { fctm, Ecm, fctfl: Math.max((1.6 - h / 1000) * fctm, fctm), alfaE: ES / Ecm };
}

export const areaBarra = (fi) => (Math.PI * fi * fi) / 4;

/** Momento de fisuración con axil N (kN, compresión +) sobre la sección bruta: Mfis = W·(fctm,fl + N/A). kN·m. */
export function Mfis(sec, N = 0, fck = 30) {
  const { b, h } = sec;
  const { fctfl } = propsHormigon(fck, h);
  return ((b * h * h) / 6 * (fctfl + (N * 1e3) / (b * h))) / 1e6;
}

/**
 * Sección fisurada elástica (hormigón sin tracción), armadura traccionada As1 a la profundidad d y comprimida As2 a d2.
 * Resuelve x (desde la cara comprimida) y la curvatura κ para (M, N).
 * @returns {{x:number, k:number, ss:number, sc:number, es:number, ec:number, e1:number}|null}
 *   x en mm; k = curvatura (1/mm); ss, sc en MPa; ec, e1 = deformación del borde comprimido y de la fibra más traccionada.
 */
export function fisurada(sec, M, N, fck) {
  const { b, h, As1, d, As2 = 0, d2 = 0 } = sec;
  const Ec = propsHormigon(fck, h).Ecm;
  const f1 = (x) => {
    const Fc = (Ec * b * x * x) / 2, F1 = -ES * As1 * (d - x), F2 = ES * As2 * (x - d2);
    return [Fc + F1 + F2, Fc * (h / 2 - x / 3) + F1 * (h / 2 - d) + F2 * (h / 2 - d2)];
  };
  const g = (x) => { const [N1, M1] = f1(x); return M * 1e6 * N1 - N * 1e3 * M1; };
  let lo = 1e-3, hi = h * 0.999;
  if (g(lo) * g(hi) > 0) return null;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
  const x = (lo + hi) / 2, [N1, M1] = f1(x);
  const k = Math.abs(M1) > 1e-6 ? (M * 1e6) / M1 : (N * 1e3) / N1;
  return { x, k, ss: ES * k * (d - x), sc: Ec * k * x, es: k * (d - x), ec: k * x, e1: k * (h - x) };
}

/**
 * wk por norma.
 * @param {'EHE08'|'EC2-2004'|'EC2-2023'} norma
 * @param {{b,h,c,fi,n,fiSup?,nSup?}} sec  c = recubrimiento a la armadura (mm); n barras de ø fi en una capa inferior
 * @param {{M:number,N?:number,larga?:boolean,directa?:boolean,buenaAdh?:boolean,fck?:number}} o  M kN·m, N kN
 */
export function calcula(norma, sec, o) {
  const { b, h, c, fi, n } = sec;
  const { M, N = 0, larga = true, directa = true, buenaAdh = true, fck = 30 } = o;
  const m = propsHormigon(fck, h);
  const As1 = n * areaBarra(fi), d = h - c - fi / 2;
  const s2 = { b, h, As1, d, As2: (sec.nSup ?? 0) * areaBarra(sec.fiSup ?? 0), d2: c + (sec.fiSup ?? 0) / 2 };
  const Mf = Mfis(sec, N, fck);
  const r = { norma, Mfis: Mf };
  if (M <= Mf) return { ...r, sinFisurar: true, wk: 0 };
  const F = fisurada(s2, M, N, fck);
  if (!F) return { ...r, error: 'fuera de modelo' };
  const Fr = fisurada(s2, Mf, N, fck);
  const ss = F.ss, ssr = Fr ? Fr.ss : ss, x = F.x;
  const ay = c + fi / 2, s = n > 1 ? (b - 2 * ay) / (n - 1) : b;
  Object.assign(r, { x, ss, ssr, sc: F.sc, ec: F.ec, e1: F.e1, As1, d, s });
  const kt = larga ? 0.4 : 0.6;

  if (norma === 'EHE08') {
    // 49.2.4: Ac,ef (fig. 49.2.4.b, caso 1/2 con s ≤ 15φ); k1 = (ε1+ε2)/(8ε1) con ε2 = 0 en la neutra; k2 = 0,5 larga / 1,0 corta
    const hef = Math.min(h / 2, ay + 7.5 * fi), Acef = hef * b;
    const k1 = (F.e1 + 0) / (8 * F.e1), k2 = larga ? 0.5 : 1.0, beta = directa ? 1.7 : 1.3;
    const sm = 2 * c + 0.2 * Math.min(s, 15 * fi) + 0.4 * k1 * fi * Acef / As1;
    const esm = Math.max((ss / ES) * (1 - k2 * (ssr / ss) ** 2), 0.4 * ss / ES);
    return { ...r, hef, Acef, rho: As1 / Acef, k1, sr: sm, sm, esm, beta, wk: beta * sm * esm };
  }
  if (norma === 'EC2-2004') {
    // 7.3.4: hc,ef = mín{2,5(h−d); (h−x)/3; h/2}; k1 = 0,8; k2 = 0,5 flexión; k3 = 3,4 y k4 = 0,425 (AN); 7.14 si s > 5(c+φ/2)
    const hef = Math.min(2.5 * (h - d), (h - x) / 3, h / 2), Acef = hef * b, rho = As1 / Acef;
    const sr = s > 5 * (c + fi / 2) ? 1.3 * (h - x) : 3.4 * c + (0.8 * 0.5 * 0.425 * fi) / rho;
    const esm = Math.max((ss - kt * m.fctm / rho * (1 + m.alfaE * rho)) / ES, 0.6 * ss / ES);
    return { ...r, hef, Acef, rho, sr, esm, wk: sr * esm };
  }
  if (norma === 'EC2-2023') {
    // 9.2.3: hc,ef = mín{ay+5φ; 10φ; 3,5ay; h−x; h/2} (una capa); kfl (9.16); kb 0,9/1,2; kw = 1,7; k1/r (9.9)
    const kw = 1.7, kb = buenaAdh ? 0.9 : 1.2;
    const hef = Math.min(ay + 5 * fi, 10 * fi, 3.5 * ay, h - x, h / 2), Acef = hef * b, rho = As1 / Acef;
    const kfl = (h - hef) / h;
    const sr = Math.min(1.5 * c + (kfl * kb / 7.2) * fi / rho, (1.3 / kw) * (h - x));
    const esm = Math.max((ss - kt * m.fctm / rho * (1 + m.alfaE * rho)) / ES, (1 - kt) * ss / ES);
    const k1r = (h - x) / (h - ay - x);
    return { ...r, hef, Acef, rho, sr, esm, k1r, kw, wk: kw * k1r * sr * esm };
  }
  throw new Error(`Norma desconocida: ${norma}`);
}

/** Límite wmáx (mm) para la clase de exposición de la norma (combinación cuasipermanente, hormigón armado). */
export { wmaxDe };

/** Armado mínimo en una capa inferior: para cada ø, el menor n con wk ≤ wmáx (separación libre ≥ máx(ø, 20 mm)). */
export function dimensiona(norma, sec, o, wmax, diametros = [12, 16, 20, 25, 32], nMax = 12) {
  return diametros.map((fi) => {
    for (let n = 2; n <= nMax; n++) {
      if (n > 2 && (sec.b - 2 * (sec.c + fi / 2)) / (n - 1) - fi < Math.max(fi, 20)) break;
      const r = calcula(norma, { ...sec, fi, n }, o);
      if (r.sinFisurar || (!r.error && r.wk <= wmax)) return { fi, n, As: n * areaBarra(fi), r };
    }
    return { fi, n: null };
  });
}
