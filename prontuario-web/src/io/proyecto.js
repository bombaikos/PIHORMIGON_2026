// Modelo de proyecto en JSON y persistencia en el navegador.
// Longitudes en m, áreas en m², resistencias de materiales en MPa (la interfaz muestra mm).
// Versión 2: secciones con el modelo único (forma, geo, armado) de src/core/geometria.js.

import { materialDeFicha } from '../core/materiales.js';
import { geometria, trapecios, SEP_CAPAS } from '../core/geometria.js';
import { bruta } from '../core/propiedades.js';
import { leerCapas } from '../core/armado.js';
import { ErrorClave } from '../core/errores.js';
import { NORMAS, NORMA_DEFECTO } from '../norma/normas.js';
import { GENERICA_EJEMPLO } from './ejemploGenerica.js';

const CLAVE = 'prontuario-web:proyecto';

/** Materiales que existen en todo proyecto nuevo: los seis hormigones tipificados y los dos aceros. */
export const HORMIGONES_TIPIFICADOS = [25, 30, 35, 40, 45, 50].flatMap((fck) => [
  { nombre: `HA-${fck}`, tipo: 'hormigon', fck },
  ...(fck === 30 ? [{ nombre: 'HA-30_EC2', tipo: 'hormigon', fck, diag: 'EC2' }] : []),
]);
export const ACEROS_TIPIFICADOS = [
  { nombre: 'B 400 S', tipo: 'acero', fyk: 400 }, { nombre: 'B 400 SD', tipo: 'acero', fyk: 400, ductilidad: 'C' },
  { nombre: 'B 500 S', tipo: 'acero', fyk: 500 }, { nombre: 'B 500 SD', tipo: 'acero', fyk: 500, ductilidad: 'C' },
];
/** Nombres sin espacios de versiones anteriores → escritos como en la norma. */
const NOMBRE_ACERO_ANTIGUO = { B500S: 'B 500 S', B400S: 'B 400 S', B500SD: 'B 500 SD', B400SD: 'B 400 SD' };

/** Añade los tipificados que falten (sin tocar los que ya hay). */
function conTipificados(p) {
  for (const a of p.aceros) if (NOMBRE_ACERO_ANTIGUO[a.nombre] && !p.aceros.some((x) => x.nombre === NOMBRE_ACERO_ANTIGUO[a.nombre])) {
    for (const sec of p.secciones ?? []) if (sec.acero === a.nombre) sec.acero = NOMBRE_ACERO_ANTIGUO[a.nombre];
    a.nombre = NOMBRE_ACERO_ANTIGUO[a.nombre];
  }
  for (const [k, lista] of [['hormigones', HORMIGONES_TIPIFICADOS], ['aceros', ACEROS_TIPIFICADOS]]) {
    const faltan = lista.filter((m) => !p[k].some((x) => x.nombre === m.nombre));
    p[k] = [...p[k], ...faltan.map((m) => ({ ...m }))].sort((a, b) => (a.fck ?? a.fyk) - (b.fck ?? b.fyk));
  }
  return p;
}

export function proyectoNuevo(nombre = 'Proyecto nuevo') {
  return {
    formato: 'prontuario-web',
    version: 2,
    nombre,
    datosObra: '',
    norma: NORMA_DEFECTO,
    ajustes: { sepCapas: SEP_CAPAS },
    hormigones: HORMIGONES_TIPIFICADOS.map((m) => ({ ...m })),
    aceros: ACEROS_TIPIFICADOS.map((m) => ({ ...m })),
    // Un ejemplo de cada tipo, para no empezar con la pantalla vacía
    secciones: ['rectangular', 'pilar', 'T', 'circular', 'generica'].map((forma, i) => seccionEjemplo(`ejemplo_${i + 1}`, forma)),
    calculos: {},
  };
}

/** Sección de ejemplo de un proyecto nuevo: la de cada forma por defecto y, en la genérica, la del puente aligerado. */
function seccionEjemplo(nombre, forma) {
  const s = seccionNueva(nombre, forma, 'HA-25', 'B 500 S');
  if (forma === 'generica') {
    const g = GENERICA_EJEMPLO;
    s.geo = { contorno: g.contorno.map((p) => [...p]), huecos: g.huecos.map((h) => h.map((p) => [...p])) };
    s.armado = [{ tipo: 'caras', d: g.d, textos: [...g.textos] }];
  }
  return s;
}

/** Sección por defecto de cada forma. */
export function seccionNueva(nombre, forma, hormigon, acero) {
  const comun = { nombre, forma, hormigon, acero, durabilidad: { ambiente: 'I', exposiciones: [] } };
  switch (forma) {
    case 'T':
      return { ...comun, geo: { b: 1.0, h: 0.6, bw: 0.3, hf: 0.15 }, armado: [{ tipo: 'capa', cara: 'sup', texto: '6D12', d: 0.04 }, { tipo: 'capa', cara: 'inf', texto: '4D20', d: 0.05 }] };
    case 'pilar':
      return { ...comun, geo: { b: 0.4, h: 0.4 }, armado: [{ tipo: 'perimetral', nx: 3, ny: 3, fi: 16, d: 0.05 }] };
    case 'circular':
      return { ...comun, geo: { D: 0.5 }, armado: [{ tipo: 'anillo', texto: '8D16', r: 0.05 }] };
    case 'generica':
      return { ...comun, geo: { contorno: [[0, 0], [0.6, 0], [0.6, 0.15], [0.4, 0.15], [0.4, 0.5], [0.2, 0.5], [0.2, 0.15], [0, 0.15]], huecos: [] }, armado: [{ tipo: 'caras', d: 0.04, textos: ['4D12', '1D12', '', '', '3D16', '1D16', '', ''] }] };
    default:
      return { ...comun, geo: { b: 0.3, h: 0.5 }, armado: [{ tipo: 'capa', cara: 'sup', texto: '2D12', d: 0.04 }, { tipo: 'capa', cara: 'inf', texto: '5D16', d: 0.045 }] };
  }
}

/** Separación entre capas del proyecto [m]. */
export const sepCapas = (p) => p?.ajustes?.sepCapas ?? SEP_CAPAS;

/** Geometría de una sección con los ajustes del proyecto. */
export const geometriaDe = (p, s) => geometria(s, { sep: sepCapas(p) });

/**
 * Rectangulares y en T: una capa por cara, la superior primero. Las capas de una misma cara
 * separadas exactamente sep (como las importadas del Prontuario 3.1) se juntan en un texto
 * "5D20+2D16"; lo que no encaje queda detrás como grupos adicionales.
 */
export function normalizarCaras(s, sep = SEP_CAPAS) {
  if (s.forma === 'generica') {
    // Genéricas: un grupo por caras al principio (las barras sueltas importadas quedan detrás)
    if (!s.armado.some((g) => g.tipo === 'caras')) s.armado.unshift({ tipo: 'caras', d: 0.04, textos: [] });
    return s;
  }
  if (s.forma !== 'rectangular' && s.forma !== 'T') return s;
  const resto = [];
  const caras = {};
  for (const cara of ['sup', 'inf']) {
    const lista = s.armado.filter((g) => g.tipo === 'capa' && g.cara === cara).sort((a, b) => a.d - b.d);
    if (!lista.length) { caras[cara] = { tipo: 'capa', cara, texto: '', d: cara === 'sup' ? 0.04 : 0.045 }; continue; }
    const base = { ...lista[0] };
    let k = 1;
    for (const g of lista.slice(1)) {
      const r = leerCapas(g.texto);
      const r0 = leerCapas(base.texto);
      if (r && !r.error && r.capas.length === 1 && r0 && !r0.error && Math.abs(g.d - base.d - r0.capas.length * sep) < 0.003) { base.texto = `${base.texto}+${g.texto}`; k++; } else resto.push(g);
    }
    caras[cara] = base;
  }
  s.armado = [caras.sup, caras.inf, ...resto, ...s.armado.filter((g) => g.tipo !== 'capa')];
  return s;
}

/** Sección de la versión 1 (rectangular con áreas en m²) al modelo único. */
export function migrarSeccion(s) {
  if (s.forma) return s;
  if (s.tipo === 'rectangular') {
    const armado = [];
    if (s.Ainf > 0) armado.push({ tipo: 'capa', cara: 'inf', texto: String(Math.round(s.Ainf * 1e6)), d: s.rinf });
    if (s.Asup > 0) armado.push({ tipo: 'capa', cara: 'sup', texto: String(Math.round(s.Asup * 1e6)), d: s.rsup });
    for (const e of s.barrasExtra ?? []) armado.push({ tipo: 'capa', cara: e.y > s.h / 2 ? 'inf' : 'sup', texto: String(Math.round(e.A * 1e6)), d: e.y > s.h / 2 ? s.h - e.y : e.y });
    return {
      nombre: s.nombre, forma: 'rectangular', geo: { b: s.b, h: s.h }, armado, hormigon: s.hormigon, acero: s.acero,
      durabilidad: { ambiente: s.ambiente ?? 'I', exposiciones: s.exposiciones ?? [] },
    };
  }
  // Las "importadas" de la versión 1 no guardaban la geometría en un formato útil
  return { ...seccionNueva(s.nombre, 'rectangular', s.hormigon, s.acero), aviso: 'Sección importada con la prueba 0.1: vuelve a importarla del .sec' };
}

export function validarProyecto(p) {
  if (!p || p.formato !== 'prontuario-web') throw new ErrorClave('err.noProyecto');
  for (const k of ['hormigones', 'aceros', 'secciones']) if (!Array.isArray(p[k])) p[k] = [];
  p.ajustes ??= { sepCapas: SEP_CAPAS };
  p.secciones = p.secciones.map(migrarSeccion).map((s) => normalizarCaras(s, sepCapas(p)));
  p.version = 2;
  p.calculos ??= {};
  // EHE-98 ya no es una norma del programa: el proyecto pasa a la EHE-08 y se avisa.
  if (p.norma === 'EHE-98') {
    p.norma = 'EHE-08';
    p.normaMigrada = 'EHE-98';
  }
  if (!NORMAS[p.norma]) p.norma = NORMA_DEFECTO;
  return p;
}

export function guardarLocal(p) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function cargarLocal() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? conTipificados(validarProyecto(JSON.parse(t))) : null;
  } catch {
    return null;
  }
}

export function aJSON(p) {
  return JSON.stringify(p, null, 2);
}

/** Materiales del motor para una sección del proyecto (según la norma activa). */
export function materialesSeccion(p, s) {
  const fh = p.hormigones.find((m) => m.nombre === s.hormigon);
  const fa = p.aceros.find((m) => m.nombre === s.acero);
  if (!fh) throw new ErrorClave('err.sinHormigon', s.nombre, s.hormigon);
  if (!fa) throw new ErrorClave('err.sinAcero', s.nombre, s.acero);
  // Los diagramas importados de un .mat se regeneran siempre a partir de fck/fyk con la norma activa.
  const usar = (f) => ({ ...f, diagrama: undefined });
  return { hormigon: materialDeFicha(usar(fh), p.norma), acero: materialDeFicha(usar(fa), p.norma), fichaH: fh, fichaA: fa };
}

/**
 * Datos de flexión simple de una sección rectangular (formato de src/core/flexion.js):
 * As1 = capas de la cara inferior, As2 = capas de la superior, en su c.d.g.
 */
export function datosRectangular(p, s) {
  if (s.forma !== 'rectangular') throw new ErrorClave('err.flexSoloRect', s.nombre, s.forma);
  const { hormigon, acero } = materialesSeccion(p, s);
  const g = geometriaDe(p, s);
  if (g.errores.length) throw new ErrorClave('err.varios', g.errores);
  const H = s.geo.h;
  const lado = (inf) => {
    const todas = [...g.barras, ...g.franjas].filter((b) => (b.y > H / 2) === inf);
    const A = todas.reduce((t, b) => t + b.A, 0);
    const y = A > 0 ? todas.reduce((t, b) => t + b.A * b.y, 0) / A : NaN;
    return { A, r: A > 0 ? (inf ? H - y : y) : (inf ? 0.05 : 0.05) };
  };
  const i = lado(true);
  const u = lado(false);
  return { b: s.geo.b, h: H, rinf: i.r, rsup: u.r, Ainf: i.A, Asup: u.A, barrasExtra: [], hormigon, acero };
}

/**
 * Datos de una viga (rectangular o en T) para Flexión simple. signo > 0: momento positivo (tracciona la
 * cara inferior); signo < 0: negativo (tracciona la superior). El motor trabaja siempre con la zona
 * comprimida arriba, así que con momento negativo la sección se gira 180°: «inf» pasa a ser la cara
 * traccionada y «sup» la comprimida, y la cabeza de la T queda abajo.
 * Además de DatosRect lleva trapecios, Ac, W (módulo resistente de la fibra traccionada), Ib y
 * b = ancho de la zona traccionada (para repartir barras y para w_k).
 */
export function datosViga(p, s, signo = 1) {
  if (s.forma !== 'rectangular' && s.forma !== 'T') throw new ErrorClave('err.flexSoloRect', s.nombre, s.forma);
  const { hormigon, acero } = materialesSeccion(p, s);
  const g = geometriaDe(p, s);
  if (g.errores.length) throw new ErrorClave('err.varios', g.errores);
  const H = s.geo.h;
  const lado = (inf) => {
    const todas = [...g.barras, ...g.franjas].filter((b) => (b.y - g.caja.ymin > H / 2) === inf);
    const A = todas.reduce((t, b) => t + b.A, 0);
    const y = A > 0 ? todas.reduce((t, b) => t + b.A * (b.y - g.caja.ymin), 0) / A : NaN;
    return { A, r: A > 0 ? (inf ? H - y : y) : 0.05 };
  };
  const i = lado(true);
  const u = lado(false);
  const pos = signo >= 0;
  const tr = pos ? i : u;
  const co = pos ? u : i;
  const y0 = g.caja.ymin;
  let trap = trapecios(g.contornos).map((t) => ({ y1: t.y1 - y0, y2: t.y2 - y0, b1: t.b1, b2: t.b2 }));
  if (!pos) trap = trap.map((t) => ({ y1: H - t.y2, y2: H - t.y1, b1: t.b2, b2: t.b1 })).reverse();
  const br = bruta(g);
  const ancho = (y) => { const t = trap.find((q) => y >= q.y1 - 1e-12 && y <= q.y2 + 1e-12); return t.b1 + ((t.b2 - t.b1) * (y - t.y1)) / (t.y2 - t.y1 || 1); };
  return {
    b: ancho(H - 1e-6), h: H, rinf: tr.r, rsup: co.r, Ainf: tr.A, Asup: co.A, barrasExtra: [], hormigon, acero,
    trapecios: trap, Ac: br.A, Ib: br.Ix, W: br.Ix / (pos ? H - br.yg : br.yg), signo: pos ? 1 : -1, forma: s.forma,
  };
}

/**
 * Datos de cortante de una sección (módulo Cortante), en m y m²: rectangular y T (b0 = menor ancho del alma,
 * d = h − r de la cara traccionada según el signo de M, Asl = armadura traccionada), pilar rectangular
 * (cortante paralelo al lado h o al b; d = lado − recubrimiento mecánico; Asl = 0; A's = toda la armadura) y
 * circular (d = D/2 + (D/2 − r)·0,707, b0 = 2·√((d/2)² − (d/4)²) = 0,866·d, cuerda a d/4 del centro; Asl = 0; A's = toda la armadura).
 * @param {{signo?: number, dir?: 'h'|'b'}} [o]  signo > 0: M+ (tracciona la cara inferior); dir: solo pilares
 */
export function datosCortante(p, s, { signo = 1, dir = 'h' } = {}) {
  const { fichaH, fichaA } = materialesSeccion(p, s);
  const comun = { forma: s.forma, nombre: s.nombre, hormigon: s.hormigon, acero: s.acero, fck: fichaH.fck, fyk: fichaA.fyk };
  if (s.forma === 'rectangular' || s.forma === 'T') {
    const v = datosViga(p, s, signo);
    const b0 = Math.min(...v.trapecios.flatMap((t) => [t.b1, t.b2]));
    return { ...comun, b0, h: v.h, d: v.h - v.rinf, Ac: v.Ac, Asl: v.Ainf, Asc: 0, circular: false };
  }
  const g = geometriaDe(p, s);
  if (g.errores.length) throw new ErrorClave('err.varios', g.errores);
  const A = [...g.barras, ...g.franjas].reduce((t, b) => t + b.A, 0);
  const Ac = bruta(g).A;
  if (s.forma === 'pilar') {
    const arm = s.armado.find((a) => a.tipo === 'perimetral');
    const r = arm?.d ?? 0.05;
    const [b0, h] = dir === 'b' ? [s.geo.h, s.geo.b] : [s.geo.b, s.geo.h];
    return { ...comun, b0, h, d: h - r, Ac, Asl: 0, Asc: A, circular: false, r };
  }
  if (s.forma === 'circular') {
    const D = s.geo.D;
    const arm = s.armado.find((a) => a.tipo === 'anillo');
    const r = arm?.r ?? 0.05;
    const d = D / 2 + (D / 2 - r) * Math.SQRT1_2;
    // Ancho eficaz (José Luis, 14/10): cuerda del círculo de diámetro d a d/4 del centro
    const b0 = 2 * Math.sqrt((d / 2) ** 2 - (d / 4) ** 2);
    return { ...comun, b0, h: D, d, Ac, Asl: 0, Asc: A, circular: true, r };
  }
  throw new ErrorClave('cor.errForma', s.nombre, s.forma);
}
