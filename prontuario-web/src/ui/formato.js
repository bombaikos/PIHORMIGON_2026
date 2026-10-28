// Formato de números de toda la app (guía de estilo §1): punto decimal, espacio fino
// antes de la unidad, signo menos real y una única tabla de precisiones por magnitud.

export const ESP = ' '; // espacio fino que no se corta

/**
 * Serie de diámetros de armadura que se ofrece en toda la app: «practica» (8, 10, 12, 16, 20, 25,
 * 32; por defecto) o «completa». Se fija en la paleta (Ctrl+K) y se recuerda en este equipo.
 */
const CLAVE_SERIE = 'prontuario-web:serie';
const SERIES = { completa: [6, 8, 10, 12, 14, 16, 20, 25, 32, 40], practica: [8, 10, 12, 16, 20, 25, 32] };
export function serieDiametros() {
  try { if (localStorage.getItem(CLAVE_SERIE) === 'completa') return SERIES.completa; } catch { /* sin almacenamiento */ }
  return SERIES.practica;
}
export function ponerSerieDiametros(v) {
  try { localStorage.setItem(CLAVE_SERIE, v === 'completa' ? 'completa' : 'practica'); } catch { /* sin almacenamiento */ }
}

/**
 * Separador decimal de lo que se copia al portapapeles (para pegar en Excel). El navegador no
 * puede leer la configuración regional de Windows: por defecto se toma el del idioma del
 * navegador, y el usuario lo fija en la paleta (Ctrl+K), que lo recuerda en este equipo.
 */
const CLAVE_DECIMAL = 'prontuario-web:decimal';
export function decimalAlCopiar() {
  try { const v = localStorage.getItem(CLAVE_DECIMAL); if (v === '.' || v === ',') return v; } catch { /* sin almacenamiento */ }
  try { return (1.5).toLocaleString(navigator.language).replace(/\d/g, '').charAt(0) || '.'; } catch { return '.'; }
}
export function ponerDecimalAlCopiar(v) {
  try { localStorage.setItem(CLAVE_DECIMAL, v); } catch { /* sin almacenamiento */ }
}

/**
 * Magnitudes: unidad en pantalla, factor desde la unidad interna (m, m², kN, kN·m, kN/m², tanto por uno)
 * y decimales. Cambiar aquí una unidad la cambia en toda la app.
 */
export const MAG = {
  long: { ud: 'mm', f: 1000, d: 0 },          // escuadrías, recubrimientos, cotas
  diam: { ud: 'mm', f: 1, d: 0 },             // diámetros (ya en mm)
  As: { ud: 'mm²', f: 1e6, d: 0 },            // áreas de armadura
  Ac: { ud: 'm²', f: 1, d: 4 },               // áreas de hormigón
  I: { ud: 'm⁴', f: 1, sig: 4 },              // inercias, en notación científica
  N: { ud: 'kN', f: 1, d: 0 },
  F: { ud: 'kN', f: 1, d: 0 },                  // fuerzas y reacciones en vigas (sin decimales, José Luis 19/10)
  m: { ud: 'm', f: 1, d: 2 },                  // luces y posiciones en vigas
  Imm: { ud: 'mm⁴', f: 1e12, d: 0 },           // inercia en mm⁴ (valor interno en m⁴)
  EI: { ud: 'kN·m²', f: 1, d: 0 },
  M: { ud: 'kN·m', f: 1, d: 0 },
  tension: { ud: 'MPa', f: 1, d: 1 },         // valores ya en MPa
  tensionKN: { ud: 'MPa', f: 1e-3, d: 1 },    // valores internos en kN/m²
  E: { ud: 'MPa', f: 1e-3, d: 0 },            // módulos internos en kN/m²
  def: { ud: '‰', f: 1000, d: 2 },
  curv: { ud: '‰/m', f: 1000, d: 2 },
  ratio: { ud: '', f: 1, d: 2 },
  n: { ud: '', f: 1, d: 0 },                   // números de barras
  cuantia: { ud: '‰', f: 1000, d: 2 },
  wk: { ud: 'mm', f: 1, d: 2 },
  ac: { ud: '', f: 1, d: 2 },
  dosis: { ud: 'kg/m³', f: 1, d: 0 },
  pct: { ud: '%', f: 1, d: 1 },
  ang1: { ud: '°', f: 1, d: 1 },
  ang: { ud: '°', f: 1, d: 0 },                // ángulos en grados
  AswS: { ud: 'cm²/m', f: 10, d: 2 },          // armadura transversal por unidad de longitud (valor interno en mm²/mm)
};

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Número con d decimales: punto decimal, miles con espacio fino desde 5 cifras, menos real. */
export function fmt(x, d = 0) {
  if (!Number.isFinite(x)) return '—';
  let [ent, dec] = Math.abs(x).toFixed(d).split('.');
  if (ent.length > 4) ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ESP);
  const cero = +Math.abs(x).toFixed(d) === 0;
  return (x < 0 && !cero ? '−' : '') + ent + (dec ? '.' + dec : '');
}

/** Notación científica con cifras significativas: 3.125 × 10⁻³ */
export function cientifico(x, sig = 4) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / 10 ** e;
  if (e >= -1 && e <= 3) return fmt(x, Math.max(0, sig - 1 - e));
  return `${fmt(m, sig - 1)} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

/**
 * Eje de una gráfica con la precisión de su magnitud (la cruz y las marcas usan los mismos decimales que las tablas):
 * eje('M', 'M_Rd') → { titulo: 'M_Rd [kN·m]', d: 0 }. Las vistas no fijan decimales a mano.
 */
export const eje = (mag, nombre) => {
  const d = MAG[mag].d ?? 0;
  // dt: decimales de la tabla del gráfico (un decimal más que la cruz, salvo en fuerzas y momentos, que van sin decimales)
  return { titulo: nombre ? `${nombre} [${MAG[mag].ud}]` : `[${MAG[mag].ud}]`, d, dt: d === 0 && /^kN/.test(MAG[mag].ud) ? 0 : d + 1 };
};

/** Valor de una magnitud en unidades de pantalla (número). */
export const enPantalla = (x, mag) => x * MAG[mag].f;
/** Valor interno a partir del de pantalla. */
export const dePantalla = (x, mag) => x / MAG[mag].f;

function cifra(x, mag) {
  const m = MAG[mag];
  return m.sig ? cientifico(x * m.f, m.sig) : fmt(x * m.f, m.d);
}

/** Texto: "312 kN·m" */
export function q(x, mag, { ud = true } = {}) {
  const u = MAG[mag].ud;
  return cifra(x, mag) + (ud && u && Number.isFinite(x) ? ESP + u : '');
}

/** HTML con la unidad en peso normal y color suave. */
export function qh(x, mag) {
  const u = MAG[mag].ud;
  return cifra(x, mag) + (u && Number.isFinite(x) ? `<span class="u">${ESP}${u}</span>` : '');
}

/** Texto para escribir en un campo (sin agrupar miles, punto decimal). */
export function paraCampo(x, mag) {
  if (!Number.isFinite(x)) return '';
  const m = MAG[mag];
  const v = x * m.f;
  return String(+v.toFixed(Math.max(m.d ?? 3, 3)));
}

/** Armadura normalizada para mostrar: "2ø25 + 8ø12 + 300 mm²". */
export function armadoBonito(a) {
  if (!a) return '';
  return [...a.barras.map((b) => `${b.n}ø${b.fi}`), ...(a.Aarea > 0 ? [`${fmt(a.Aarea, 0)}${ESP}mm²`] : [])].join(' + ');
}
