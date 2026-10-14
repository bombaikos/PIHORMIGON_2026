// Lectura de datos escritos por el usuario: números con cuentas y armaduras como 2D25+8D12.
// No depende del DOM: lo usan el núcleo (geometría) y la interfaz.

/** Número con cuentas sencillas (2*150, 300+50, (1.2+0.3)/2). Admite punto o coma decimal. NaN si no vale. */
export function leerNumero(txt) {
  const s = String(txt ?? '').replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-');
  let i = 0;
  const num = () => {
    const m = s.slice(i).match(/^\d+(\.\d*)?(e[+-]?\d+)?|^\.\d+/i);
    if (!m) throw new Error();
    i += m[0].length;
    return +m[0];
  };
  const fac = () => {
    if (s[i] === '-') { i++; return -fac(); }
    if (s[i] === '+') { i++; return fac(); }
    if (s[i] === '(') { i++; const v = sum(); if (s[i++] !== ')') throw new Error(); return v; }
    return num();
  };
  const prod = () => { let v = fac(); while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const w = fac(); v = o === '*' ? v * w : v / w; } return v; };
  const sum = () => { let v = prod(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const w = prod(); v = o === '+' ? v + w : v - w; } return v; };
  if (!s) return NaN;
  try {
    const v = sum();
    return i === s.length && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

const SEP = '(?:D|ø|Ø|φ|Φ|fi|phi|#|x|X|o|O)';
const BARRAS = new RegExp(`^(\\d+)\\s*${SEP}\\s*(\\d+)$`, 'i');

/**
 * Armadura: "4D16+2D12", "4ø16", "4fi16", "4x16", el área en mm² ("1030") o mezclas ("2D20+300").
 * Vacío, "0" o "-" es sin armadura.
 * @returns {{barras:{n:number,fi:number}[], Aarea:number, A:number}|null}  A y Aarea en mm²; null si no se entiende
 */
export function leerArmado(txt) {
  const s = String(txt ?? '').trim();
  if (!s || s === '0' || s === '-' || s === '—') return { barras: [], Aarea: 0, A: 0 };
  const barras = [];
  let Aarea = 0;
  for (const parte of s.split('+')) {
    const p = parte.trim();
    const m = p.match(BARRAS);
    if (m) {
      const n = +m[1];
      const fi = +m[2];
      if (n < 1 || fi < 4 || fi > 50) return null;
      const igual = barras.find((b) => b.fi === fi);
      if (igual) igual.n += n;
      else barras.push({ n, fi });
      continue;
    }
    const a = leerNumero(p);
    if (!Number.isFinite(a) || a < 0) return null;
    Aarea += a;
  }
  barras.sort((a, b) => b.fi - a.fi);
  const A = Aarea + barras.reduce((t, b) => t + (b.n * Math.PI * b.fi ** 2) / 4, 0);
  return { barras, Aarea, A };
}

/** Texto normalizado para escribir en el campo: "2D25+8D12+300". */
export function textoArmado(a) {
  if (!a) return '';
  return [...a.barras.map((b) => `${b.n}D${b.fi}`), ...(a.Aarea > 0 ? [String(Math.round(a.Aarea))] : [])].join('+');
}

const POR_SEP = new RegExp(`^${SEP}?\\s*(\\d+)\\s*/\\s*(\\d+(?:[.,]\\d+)?)$`, 'i');

/**
 * Armadura de una cara de una sección genérica: «3D16» (número de barras) o «D16/0.20»
 * (diámetro y separación; hasta 5 se toma como metros, más como mm).
 * @returns {{vacia:true}|{n:number, fi:number}|{fi:number, sep:number}|{error:string}|null}  sep en m; null si no se entiende
 */
export function leerCara(txt) {
  const s = String(txt ?? '').trim();
  if (!s || s === '0' || s === '-' || s === '—') return { vacia: true };
  const m = s.match(POR_SEP);
  if (m) {
    const fi = +m[1];
    const v = leerNumero(m[2]);
    if (fi < 4 || fi > 50 || !(v > 0)) return null;
    return { fi, sep: v <= 5 ? v : v / 1000 };
  }
  const r = leerCapas(s, { maxCapas: 1, soloBarras: true, minBarras: 1 });
  if (!r) return null;
  if (r.error) return { error: r.error };
  return r.capas[0] ? { n: r.capas[0].n, fi: r.capas[0].fi } : { vacia: true };
}

/**
 * Armadura de una cara por capas: cada sumando es una capa, de la cara hacia dentro.
 * "5D20+2D16": 5ø20 en la capa más superficial y 2ø16 en la siguiente. Una capa no mezcla
 * diámetros ni lleva una sola barra; un número suelto es un área en mm² sin barras definidas.
 * @param {string} txt
 * @param {{maxCapas?: number, soloBarras?: boolean, minBarras?: number}} [opc]  minBarras: 2 en una cara de viga; 1 en las caras de una genérica
 * @returns {{capas: ({n:number, fi:number, A:number}|{A:number})[], A:number, error?:string}|null}
 *   A en mm²; null si no se entiende; error con una clave de i18n si se entiende pero no vale
 */
export function leerCapas(txt, { maxCapas = Infinity, soloBarras = false, minBarras = 2 } = {}) {
  const s = String(txt ?? '').trim();
  if (!s || s === '0' || s === '-' || s === '—') return { capas: [], A: 0 };
  const capas = [];
  for (const parte of s.split('+')) {
    const p = parte.trim();
    const m = p.match(BARRAS);
    if (m) {
      const n = +m[1];
      const fi = +m[2];
      if (fi < 4 || fi > 50) return null;
      capas.push({ n, fi, A: (n * Math.PI * fi ** 2) / 4 });
      continue;
    }
    const a = leerNumero(p);
    if (!Number.isFinite(a) || a <= 0) return null;
    capas.push({ A: a });
  }
  const A = capas.reduce((t, c) => t + c.A, 0);
  if (capas.some((c) => c.n !== undefined && c.n < minBarras)) return { capas, A, error: 'err.unaBarra' };
  if (soloBarras && capas.some((c) => c.n === undefined)) return { capas, A, error: 'err.soloBarras' };
  if (capas.length > maxCapas) return { capas, A, error: 'err.unaCapa' };
  return { capas, A };
}
