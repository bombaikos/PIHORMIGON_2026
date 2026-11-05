// Armadura mínima de control de fisuración que debe tener la zona traccionada, para compararla con la dispuesta.
//   · EHE-08: mínima mecánica de flexión, art. 42.3.2 (la misma de Flexión: cuantiaMinima).
//   · EC-2 2004 + AN, 7.3.2: As,mín·σs = kc·k·fct,eff·Act (7.1) con σs = fyk, fct,eff = fctm, kc (7.2) y k (interpolado 1,0 a 0,65 entre h = 300 y 800 mm).
//     Las alas de una T traccionada llevan otra expresión (7.3, con la fuerza de fisuración del ala): no se comprueba.
//   · EC-2 2023, 9.2.2: flexión (9.2) y flexión con axil (9.4), con kh (9.5), fct,eff = fctm, Ac de la parte (alma o ala) y fyk.
// Unidades de entrada: m, kN, MPa en fck/fyk; de salida mm².
import { cuantiaMinima } from './cuantiaMinima.js';

const MM = 1000;

/** Área (mm²) de hormigón entre la cara traccionada y la profundidad hef (mm); trap: trapecios con la cara traccionada en y = h. */
export function areaHasta(trap, h, hef) {
  const y0 = h - hef / MM;
  let A = 0;
  for (const t of trap) {
    const a = Math.max(t.y1, y0);
    const b = Math.min(t.y2, h);
    if (b <= a) continue;
    const w = (y) => t.b1 + ((t.b2 - t.b1) * (y - t.y1)) / (t.y2 - t.y1 || 1);
    A += ((w(a) + w(b)) / 2) * (b - a);
  }
  return A * 1e6;
}

/**
 * @param {Object} c  { geo, mats, v, fck }
 * @param {{norma:string, N:number, M:number, signo:number}} o  M en valor absoluto
 * @param {Object} F  estado fisurado (barras con eps)
 * @param {{fctm:number}} m  propiedades del hormigón (MPa)
 * @returns {{req:number|null, dis:number, ok:boolean, ref:string, datos?:Object, motivo?:string}}
 */
export function armaduraMinima(c, { norma, N, M, signo }, F, m) {
  const { v, geo, mats } = c;
  const fyk = mats.acero.fk / 1000;
  const dis = geo.barras.reduce((a, b, i) => a + (F.barras[i].eps < 0 ? b.A : 0), 0) * 1e6;
  const h = v.h * MM;
  const fct = m.fctm;
  const bw = Math.min(...v.trapecios.flatMap((t) => [t.b1, t.b2]));
  const hf = v.trapecios.filter((t) => Math.min(t.b1, t.b2) > bw + 1e-9).reduce((a, t) => a + (t.y2 - t.y1), 0);
  const alaTraccionada = v.forma === 'T' && v.b > bw + 1e-9;
  const sal = (req, ref, datos) => ({ req, dis, ok: req === null || dis + 1e-6 >= req, ref, datos });

  if (norma === 'EHE08') {
    const r = cuantiaMinima({ norma: 'EHE-08', tipo: 'viga', h: v.h, Ac: v.Ac, yg: v.h - v.Ib / v.W, Ix: v.Ib, fctm: fct * 1000, fyk: mats.acero.fk, gammaS: mats.acero.gamma });
    return sal(r.inf.A * 1e6, '42.3.2', { fct: r.fct / 1000, z: r.z * MM });
  }
  if (norma === 'EC2-2004') {
    if (alaTraccionada) return { req: null, dis, ok: true, ref: '7.3.2(2)', motivo: 'ala' };
    const Wc = v.Ib / (v.h - v.Ib / v.W);
    const sigT = M / v.W - N / v.Ac;
    const sigC = M / Wc + N / v.Ac;
    if (sigT <= 0) return sal(0, '7.3.2(2)', { Act: 0 });
    const prof = (v.h * sigT) / (sigT + sigC);
    const Act = areaHasta(v.trapecios, v.h, prof * MM);
    const hs = Math.min(h, 1000);
    const sc = N / v.Ac / 1000;
    const k1 = N >= 0 ? 1.5 : (2 * hs) / (3 * h);
    const kc = Math.min(1, Math.max(0, 0.4 * (1 - sc / (k1 * (h / hs) * fct))));
    const k = h <= 300 ? 1 : h >= 800 ? 0.65 : 1 - (0.35 * (h - 300)) / 500;
    return sal((kc * k * fct * Act) / fyk, '7.3.2(2)', { kc, k, Act, fct, sigmaS: fyk });
  }
  const ancho = alaTraccionada ? v.b : bw;
  const alto = alaTraccionada ? hf : v.forma === 'T' ? v.h - hf : v.h;
  const Ac = v.forma === 'T' ? ancho * alto * 1e6 : v.Ac * 1e6;
  const kh = Math.min(0.8, Math.max(0.5, 0.8 - 0.6 * (Math.min(v.forma === 'T' ? ancho : v.b, alto) - 0.3)));
  const base = 0.2 * kh * fct * Ac;
  const Nt = -N * 1000;
  const req = Math.abs(N) < 1e-9 ? base / fyk : Math.min(Math.max((0.3 * Nt + base) / fyk, 0), (0.5 * kh * fct * Ac) / fyk);
  void M; void signo;
  return sal(req, Math.abs(N) < 1e-9 ? '9.2.2(2), (9.2)' : '9.2.2(2), (9.4)', { kh, Ac, fct });
}
