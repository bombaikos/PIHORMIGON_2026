// Propiedades reológicas del hormigón (fluencia, retracción y evolución con la edad) para las tres normas del proyecto.
// Funciones puras: edades en días, humedad relativa en %, espesor medio h0 = 2·Ac/u en mm, resistencias en MPa.
// Deformaciones en tanto por uno, con la retracción negativa (acortamiento).
//
//  · EHE-08: 39.7 (retracción), 39.8 (fluencia), 31.3 y 39.6 (comentarios) para la edad.
//  · EC-2 2004 + AN: 3.1.2(6) y 3.1.3(3) (edad), 3.1.4 y anexo B (B.1: fluencia, B.2: retracción).
//  · EC-2 2023: 5.1.5 y anexo B (B.4: edad, B.5: fluencia, B.6: retracción).
// La EHE-08 y el EC-2 2004 usan el mismo modelo (el de la EN 1992-1-1:2004, anexo B); la 2023 trae otro.
// Validado contra las tablas 39.7.c/d y 39.8.a/b de la EHE-08 y 5.2/5.3 del EC-2 2023 (tests/reologia.test.js).
// No se modela la temperatura (se supone la media de 20 °C) ni el cemento más allá de su clase S/N/R.

export const CEMENTOS = ['S', 'N', 'R'];
const T_INF = 1e12;
/** Edad «final» de la EC-2 2023: sus modelos no se estabilizan (la fluencia básica crece con el logaritmo), así que su valor es a 50 años. */
export const T_FINAL_2023 = 50 * 365;
/** Edad final por defecto de cada norma: infinito en EHE-08 y EC-2 2004; 50 años en el EC-2 2023. */
export const edadFinal = (norma) => (norma === 'EC2-2023' ? T_FINAL_2023 : Infinity);
const esFin = (t) => !Number.isFinite(t) || t >= T_INF;

/* ---------------- evolución con la edad ---------------- */

/** s de la edad: EHE-08 31.3 y EC-2 2004 (3.2): rápido 0,20, normal 0,25, lento 0,38. */
const S_EDAD = { R: 0.20, N: 0.25, S: 0.38 };
/** Tabla B.2 del EC-2 2023: sC según la clase CS/CN/CR y la resistencia. */
function sC2023(cemento, fck) {
  const i = fck <= 35 ? 0 : fck < 60 ? 1 : 2;
  return { S: [0.6, 0.5, 0.4], N: [0.5, 0.4, 0.3], R: [0.3, 0.2, 0.1] }[cemento][i];
}

/**
 * Resistencias y módulo a la edad t. fcmT = βcc·fcm, fctmT = βcc^α·fctm, EcmT = (fcmT/fcm)^0,3·Ecm.
 * Con EC-2 2023: fctmT = βcc^0,6·fctm y EcmT = βcc^(1/3)·Ecm (B.3, B.4).
 * @param {string} norma 'EHE-08' | 'EC2-2004' | 'EC2-2023'
 * @param {{fck:number, fcm:number, fctm:number, Ecm:number, cemento?:'S'|'N'|'R', t:number}} o  Ecm en MPa
 */
export function evolucionEdad(norma, { fck, fcm, fctm, Ecm, cemento = 'N', t }) {
  const x = Math.sqrt(28 / t);
  const s = norma === 'EC2-2023' ? sC2023(cemento, fck) : S_EDAD[cemento];
  const beta = Math.exp(s * (1 - x));
  let alfa;
  let Et;
  if (norma === 'EC2-2023') { alfa = 0.6; Et = Math.cbrt(beta) * Ecm; } else {
    // EHE-08 (31.3): α = 1 hasta 28 días; 2/3 después (fck < 50) o 1/2 (fck ≥ 50). EC-2 2004 (3.4): 2/3 a partir de 28
    alfa = t < 28 ? 1 : norma === 'EHE-08' && fck >= 50 ? 0.5 : 2 / 3;
    Et = Math.pow(beta, 0.3) * Ecm;
  }
  return { t, beta, fcm: beta * fcm, fctm: Math.pow(beta, alfa) * fctm, Ecm: Et, alfa };
}

/** Resistencia característica a la edad de carga, fck(t0) (EC-2 2004, 3.1.2(5)): fcm(t) − 8 entre 3 y 28 días. */
export const fckEdad = (fck, fcmT, t) => (t >= 28 ? fck : Math.min(fck, fcmT - 8));

/* ---------------- modelo de la EN 1992-1-1:2004 (EHE-08 y EC-2 2004) ---------------- */

const ALFA_DS = { S: [3, 0.13], N: [4, 0.12], R: [6, 0.11] };
const EXP_CEMENTO = { S: -1, N: 0, R: 1 };

/** Interpolación lineal del coeficiente kh de la tabla 3.3 / 39.7.a. */
export function kh(h0) {
  const T = [[100, 1.0], [200, 0.85], [300, 0.75], [500, 0.70]];
  if (h0 <= 100) return 1;
  if (h0 >= 500) return 0.7;
  for (let i = 1; i < T.length; i++) if (h0 <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (h0 - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return 0.7;
}

/** Edad de carga corregida por la clase del cemento, B.9 (solo EC-2 2004). */
const t0Cemento = (t0, cemento) => Math.max(t0 * Math.pow(9 / (2 + Math.pow(t0, 1.2)) + 1, EXP_CEMENTO[cemento]), 0.5);

function fluencia2004(norma, { fck, HR, h0, t0, t = Infinity, cemento = 'N' }) {
  const fcm = fck + 8;
  const a1 = Math.pow(35 / fcm, 0.7);
  const a2 = Math.pow(35 / fcm, 0.2);
  const a3 = Math.pow(35 / fcm, 0.5);
  const alta = fcm > 35;
  const t0e = norma === 'EC2-2004' ? t0Cemento(t0, cemento) : t0; // la EHE-08 solo sugiere ajustar t0 (39.8, comentarios)
  const dHR = (1 - HR / 100) / (0.1 * Math.cbrt(h0));
  const phiRH = alta ? (1 + dHR * a1) * a2 : 1 + dHR; // (B.3a/b)
  const bfcm = 16.8 / Math.sqrt(fcm); // (B.4)
  const bt0 = 1 / (0.1 + Math.pow(t0e, 0.2)); // (B.5)
  const bH = Math.min(1.5 * (1 + Math.pow(0.012 * HR, 18)) * h0 + 250 * (alta ? a3 : 1), 1500 * (alta ? a3 : 1)); // (B.8)
  const dt = t - t0;
  const bc = esFin(t) ? 1 : Math.pow(Math.max(dt, 0) / (bH + Math.max(dt, 0)), 0.3); // (B.7)
  const phi0 = phiRH * bfcm * bt0;
  return { phi: phi0 * bc, phi0, bc, phiRH, bfcm, bt0, bH, t0e };
}

function retraccion2004(norma, { fck, HR, h0, t = Infinity, ts = 7, cemento = 'N' }) {
  const fcm = fck + 8;
  const [a1, a2] = ALFA_DS[cemento];
  const sumergida = norma === 'EHE-08' && HR >= 99; // 39.7: βHR = 0,25 en estructuras sumergidas
  const bRH = sumergida ? -0.25 : 1.55 * (1 - Math.pow(HR / 100, 3)); // (B.12), con el signo del acortamiento
  const eCd0 = 0.85 * (220 + 110 * a1) * Math.exp(-a2 * fcm / 10) * 1e-6 * bRH; // (B.11)
  const k = kh(h0);
  const fin = esFin(t);
  const dts = fin ? 0 : Math.max(t - ts, 0);
  const bds = fin ? 1 : dts / (dts + 0.04 * Math.sqrt(h0 ** 3)); // (3.10)
  const bas = fin ? 1 : 1 - Math.exp(-0.2 * Math.sqrt(t)); // (3.13)
  const cd = -k * eCd0 * bds;
  const ca = -2.5 * (fck - 10) * 1e-6 * bas; // (3.11), (3.12)
  return { total: cd + ca, secado: cd, autogena: ca, kh: k, eCd0: -eCd0, bds, bas, bRH };
}

/* ---------------- modelo de la EN 1992-1-1:2023 (anexo B) ---------------- */

const A_SC = { S: -1, N: 0, R: 1 };
const AB_AD = { S: [800, 3], N: [700, 4], R: [600, 6] };

function fluencia2023({ fck, HR, h0, t0, t = Infinity, cemento = 'N' }) {
  const fcm = fck + 8;
  const t0adj = Math.max(t0 * Math.pow(9 / (2 + Math.pow(t0, 1.2)) + 1, A_SC[cemento]), 0.5); // (B.17)
  const bbcFcm = 1.8 / Math.pow(fcm, 0.7); // (B.7)
  const dt = (esFin(t) ? T_FINAL_2023 : t) - t0;
  const bbcT = Math.log(Math.pow(30 / t0adj + 0.035, 2) * dt + 1); // (B.8)
  const bdcFcm = 412 / Math.pow(fcm, 1.4); // (B.10)
  const bdcRH = (1 - HR / 100) / Math.cbrt(0.1 * h0 / 100); // (B.11)
  const bdcT0 = 1 / (0.1 + Math.pow(t0adj, 0.2)); // (B.12)
  const aF = Math.sqrt(35 / fcm); // (B.16)
  const bh = Math.min(1.5 * h0 + 250 * aF, 1500 * aF); // (B.15)
  const gam = 1 / (2.3 + 3.5 / Math.sqrt(t0adj)); // (B.14)
  const bdcT = Math.pow(dt / (bh + dt), gam); // (B.13)
  const phiB = bbcFcm * bbcT;
  const phiD = bdcFcm * bdcRH * bdcT0 * bdcT;
  return { phi: phiB + phiD, phiBasica: phiB, phiSecado: phiD, t0e: t0adj };
}

function retraccion2023({ fck, HR, h0, t = Infinity, ts = 1, cemento = 'N' }) {
  const fcm = fck + 8;
  const [abs, ads] = AB_AD[cemento];
  if (esFin(t)) t = T_FINAL_2023;
  const eBs = abs * Math.pow(fcm / (60 + fcm), 2.5) * 1e-6; // (B.26)
  const bBs = 1 - Math.exp(-0.2 * Math.sqrt(t)); // (B.27)
  const eDs = (220 + 110 * ads) * Math.exp(-0.012 * fcm) * 1e-6; // (B.28)
  const RHeq = Math.min(99 * Math.pow(35 / fcm, 0.1), 99); // (B.32)
  const bRH = HR >= 100 ? 1.55 * (1 - Math.pow(HR / RHeq, 2)) - 0.25 // (B.31)
    : HR <= RHeq ? 1.55 * (1 - Math.pow(HR / RHeq, 3)) // (B.29)
      : 1.55 * (1 - Math.pow(HR / RHeq, 2)); // (B.30)
  const bDs = Math.sqrt(Math.max(t - ts, 0) / (0.035 * h0 * h0 + Math.max(t - ts, 0))); // (B.33)
  const ca = -eBs * bBs;
  const cd = -eDs * bRH * bDs;
  return { total: ca + cd, secado: cd, autogena: ca, bRH };
}

/* ---------------- interfaz ---------------- */

/**
 * Coeficiente de fluencia φ(t, t0). Con t omitido o Infinity, el valor final.
 * @param {string} norma
 * @param {{fck:number, HR:number, h0:number, t0:number, t?:number, cemento?:'S'|'N'|'R'}} o
 */
export function fluencia(norma, o) {
  return norma === 'EC2-2023' ? fluencia2023(o) : fluencia2004(norma, o);
}

/**
 * Deformación de retracción εcs(t) = secado + autógena, negativa. ts: edad al empezar el secado
 * (EHE-08: 7 días, fin del curado, como en sus tablas; EC-2: 1 día al partir del vertido… se pide al usuario).
 */
export function retraccion(norma, o) {
  return norma === 'EC2-2023' ? retraccion2023(o) : retraccion2004(norma, o);
}

/** Retracción que desarrolla el hormigón entre dos edades (por ejemplo, desde la puesta en carga). */
export const retraccionEntre = (norma, o, t1, t2) => retraccion(norma, { ...o, t: t2 }).total - retraccion(norma, { ...o, t: t1 }).total;

/**
 * Edad de carga mínima y límite de tensión del modelo (dónde deja de valer la fluencia lineal).
 * 0,45·fcm(t0) en la EHE-08 (39.8) y 0,45·fck(t0) en el EC-2 2004 (3.1.4(4)); 0,40·fcm(t0) en el EC-2 2023 (B.3(3)).
 */
export function limiteTension(norma, { fck, fcmT0 }) {
  if (norma === 'EC2-2023') return 0.40 * fcmT0;
  if (norma === 'EC2-2004') return 0.45 * fckEdad(fck, fcmT0, 0);
  return 0.45 * fcmT0;
}

/** Fluencia no lineal: EC-2 2004 (3.7) por encima de 0,45·fck(t0); EC-2 2023 (B.19) entre 0,4 y 0,6·fcm(t0). */
export function fluenciaNoLineal(norma, phi, sigma, { fck, fcmT0, t0 }) {
  if (!(sigma > 0)) return phi;
  if (norma === 'EC2-2023') {
    const k = sigma / fcmT0;
    return k > 0.4 ? phi * Math.exp(1.5 * (k - 0.4)) : phi;
  }
  if (norma === 'EC2-2004') {
    const k = sigma / (t0 >= 28 ? fck : Math.min(fck, fcmT0 - 8));
    return k > 0.45 ? phi * Math.exp(1.5 * (k - 0.45)) : phi;
  }
  return phi; // la EHE-08 remite a la bibliografía
}

/* ---------------- historia de cargas y humedad (como el módulo de Materiales del Prontuario 3.1) ---------------- */

/** Humedad relativa a la edad t por interpolación lineal de la tabla [t, HR]; constante fuera de ella. */
export function humedadEn(tabla, t) {
  const T = tabla.slice().sort((a, b) => a[0] - b[0]);
  if (!T.length) return NaN;
  if (t <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    if (t <= T[i][0]) return T[i][0] === T[i - 1][0] ? T[i][1] : T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (t - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  }
  return T.at(-1)[1];
}

/**
 * Deformaciones diferidas bajo una historia de escalones de tensión, con la superposición lineal de las tres normas:
 *   ε_el(t)  = Σ Δσj / Ec,t0j                (t0j ≤ t)
 *   ε_dif(t) = Σ Δσj · φ(t, t0j) / Ec28      (Ec28: módulo tangente a 28 días; 1,05·Ecm si la norma no lo da)
 *   ε_cs(t)  = retracción de la norma con la HR que hay en t
 * Compresión y acortamiento positivos. φ y ε_cs usan la humedad que hay en el instante t (como el 3.1).
 * @param {string} norma
 * @param {{fck:number, fcm:number, fctm:number, Ecm:number, Ec28?:number, cemento?:'S'|'N'|'R', h0:number, ts:number,
 *          cargas:number[][], humedad:number[][], tiempos:number[]}} o
 *   cargas: [t0, Δσ] en días y MPa; humedad: [t, HR]; tiempos: edades en las que se dan los resultados
 * @returns {{t:number, HR:number, elastica:number, diferida:number, retraccion:number, total:number}[]}
 */
export function historia(norma, { fck, fcm, fctm, Ecm, Ec28, cemento = 'N', h0, ts, cargas, humedad, tiempos }) {
  const Ec0 = Ec28 ?? 1.05 * Ecm;
  const E0 = cargas.map(([t0]) => evolucionEdad(norma, { fck, fcm, fctm, Ecm, cemento, t: t0 }).Ecm);
  return tiempos.map((t) => {
    const HR = humedadEn(humedad, t);
    let elastica = 0;
    let diferida = 0;
    cargas.forEach(([t0, ds], j) => {
      if (t < t0) return;
      elastica += ds / E0[j];
      if (t > t0) diferida += (ds * fluencia(norma, { fck, HR, h0, t0, t, cemento }).phi) / Ec0;
    });
    const r = retraccion(norma, { fck, HR, h0, t, ts, cemento });
    const rc = -r.total;
    return { t, HR, elastica, diferida, retraccion: rc, autogena: -r.autogena, tension: cargas.reduce((a, [t0, ds]) => (t >= t0 ? a + ds : a), 0), total: elastica + diferida + rc };
  });
}

/** Coeficientes φ(t, t0) en una tabla: filas t0, columnas t; null si t ≤ t0. La HR es la de la tabla en cada t. */
export function tablaFluencia(norma, { fck, cemento = 'N', h0, humedad }, t0s, ts) {
  return t0s.map((t0) => ts.map((t) => (t > t0 ? fluencia(norma, { fck, HR: humedadEn(humedad, t), h0, t0, t, cemento }).phi : null)));
}
