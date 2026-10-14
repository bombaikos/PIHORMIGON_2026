// Importador de proyectos del Prontuario 3.1 (archivos .EHE, .sec y .mat).
// Réplica de la lectura de pih_lee.pas (Lee_Archivo_Proyecto, lee_seccion, lee_ec_const).
// Las funciones reciben texto ya decodificado (los originales están en Windows-1252).

import { NORMA_DEFECTO } from '../norma/normas.js';
import { normalizarCaras } from './proyecto.js';

/** Lector de líneas que imita readln de Pascal: lee números del principio de la línea. */
class Lector {
  constructor(texto) {
    this.lineas = texto.replace(/\r/g, '').split('\n');
    this.i = 0;
  }
  fin() {
    return this.i >= this.lineas.length;
  }
  linea() {
    if (this.fin()) throw new Error('Fin de archivo inesperado');
    return this.lineas[this.i++];
  }
  /** readln(f, a, b, ...): toma n números de la línea y descarta el resto. */
  numeros(n) {
    const tok = this.linea().trim().split(/\s+/);
    const v = tok.slice(0, n).map(Number);
    if (v.length < n || v.some((x) => Number.isNaN(x))) {
      throw new Error(`Se esperaban ${n} números en la línea ${this.i}: "${this.lineas[this.i - 1]}"`);
    }
    return v;
  }
  numero() {
    return this.numeros(1)[0];
  }
  /** Avanza hasta la línea que contiene la cabecera (cabecera en pih_utl.pas). */
  cabecera(txt) {
    while (!this.fin()) {
      if (this.linea().includes(txt)) return true;
    }
    return false;
  }
}

/**
 * Lee un archivo de proyecto .EHE.
 * @param {string} texto
 */
export function leerProyectoEHE(texto) {
  const L = new Lector(texto);
  if (!L.cabecera('**ARCHIVO DE PROYECTO')) throw new Error('Cabecera **ARCHIVO DE PROYECTO no encontrada');
  const nombre = L.linea().trim();
  const datosObra = L.linea().trim();
  const bloques = [
    ['**HORMIGONES DE PROYECTO', 'hormigones'],
    ['**ACEROS DE PROYECTO', 'aceros'],
    ['**SECCIONES RECTANGULARES DE PROYECTO (AREAS)', 'rec1'],
    ['**SECCIONES RECTANGULARES DE PROYECTO (REDONDOS)', 'rec2'],
    ['**SECCIONES EN T DE PROYECTO', 't'],
    ['**SECCIONES CIRCULARES DE PROYECTO', 'cir'],
    ['**SECCIONES GENÉRICAS DE PROYECTO', 'gen'],
    ['**IMPRESIONES EFECTUADAS', 'impresiones'],
    ['**FIN DEL ARCHIVO', null],
  ];
  const out = { nombre, datosObra, hormigones: [], aceros: [], rec1: [], rec2: [], t: [], cir: [], gen: [], impresiones: [] };
  let actual = null;
  for (const raw of L.lineas.slice(L.i)) {
    const l = raw.trim();
    const b = bloques.find(([c]) => l.startsWith(c));
    if (b) {
      actual = b[1];
      if (b[0] === '**FIN DEL ARCHIVO') break;
      continue;
    }
    if (actual && l !== '') out[actual].push(l);
  }
  return out;
}

/**
 * Lee un archivo de material .mat (ecuación constitutiva poligonal).
 * Unidades del original: kN y m.
 * @param {string} texto
 * @param {string} nombre
 * @returns {import('../core/materiales.js').Material}
 */
export function leerMaterial(texto, nombre = '') {
  const L = new Lector(texto);
  if (!L.cabecera('**MATERIALES')) throw new Error(`${nombre}.mat: cabecera **MATERIALES no encontrada`);
  const E = L.numero();
  const [nc, codc] = L.numeros(2);
  const comp = [];
  for (let j = 0; j < nc; j++) {
    const [s, e] = L.numeros(2);
    comp.push([e, s]);
  }
  const [nt, codt] = L.numeros(2);
  const tracc = [];
  for (let j = 0; j < nt; j++) {
    const [s, e] = L.numeros(2);
    tracc.push([e, s]);
  }
  const fk = L.numero();
  const alfa = L.numero();
  const gamma = L.numero();
  let tipo = 'generico';
  if (E >= 1e8) tipo = 'acero';
  else if (E > 1e6 && nt <= 2 && tracc.every((p) => p[1] === 0)) tipo = 'hormigon';
  return { tipo, nombre, E, fk, gamma, alfa, comp, tracc, roturaComp: codc === 0, roturaTracc: codt === 0 };
}

/**
 * Lee un archivo de sección .sec y devuelve sus partes tal cual (coordenadas en m,
 * y hacia abajo desde la cara superior).
 * @param {string} texto
 */
export function leerSeccion(texto) {
  const L = new Lector(texto);
  if (!L.cabecera('**SECCION')) throw new Error('Cabecera **SECCION no encontrada');
  const nombre = L.linea().trim();
  const tipo = L.linea().trim();
  const nPartes = L.numero();
  const partes = [];
  for (let i = 0; i < nPartes; i++) {
    const l = L.linea().trim();
    const tipoParte = l[0];
    const ySup = Number(l.slice(1).trim().split(/\s+/)[0]);
    const p = { tipo: tipoParte };
    switch (tipoParte) {
      case 'P':
      case 'f': {
        p.fi = ySup;
        const n = L.numero();
        p.barras = [];
        for (let k = 0; k < n; k++) {
          const [x, y] = L.numeros(2);
          p.barras.push({ x, y });
        }
        break;
      }
      case 'T': {
        p.ySup = ySup;
        const n = L.numero();
        p.trapecios = [];
        for (let k = 0; k < n; k++) {
          const [bSup, bInf, h] = L.numeros(3);
          p.trapecios.push({ bSup, bInf, h });
        }
        break;
      }
      case 'X':
      case 'H': {
        p.ySup = ySup;
        const n = L.numero();
        p.puntos = [];
        for (let k = 0; k < n; k++) {
          const [x, y] = L.numeros(2);
          p.puntos.push({ x, y });
        }
        break;
      }
      case 'C': {
        p.ySup = ySup;
        p.nPuntos = L.numero();
        p.R = L.numero();
        [p.xc, p.yc] = L.numeros(2);
        break;
      }
      case 'A': {
        p.ySup = ySup;
        p.R = L.numero();
        p.rec = L.numero();
        p.nPuntos = L.numero();
        p.nPuntosInt = L.numero();
        [p.xc, p.yc] = L.numeros(2);
        p.ar = L.numero();
        break;
      }
      default:
        throw new Error(`Tipo de parte desconocido "${tipoParte}" en la sección ${nombre}`);
    }
    [p.eps0, p.curv0] = L.numeros(2);
    p.material = L.linea().trim().split(/\s+/)[0];
    partes.push(p);
  }
  const extra = {};
  try {
    [extra.A, extra.Ib, extra.Ih, extra.Ifis, extra.Mfis, extra.Ifisneg, extra.Mfisneg] = L.numeros(7);
    const v = L.numeros(9);
    extra.ambiente = v[0];
    extra.exposiciones = v.slice(1, 8).map((x) => x === 1);
    extra.recubrimiento = v[8];
  } catch {
    // Secciones antiguas (3.0) sin inercias ni ambiente.
  }
  return { nombre, tipo, partes, ...extra };
}

const AMBIENTES = ['I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IIIc', 'IV'];
const EXPOSICIONES = ['Nada', 'Qa', 'Qb', 'Qc', 'H', 'F', 'E'];

/**
 * Convierte una sección leída de un .sec al modelo único de la app (src/core/geometria.js):
 * contorno de hormigón y grupos de armadura. En el .sec, x va centrada en el eje de la
 * sección e y hacia abajo desde la fibra superior; aquí x empieza en el borde izquierdo.
 * La parte "ficticio" (pivote a 3h/7 del original) se descarta: la app lo hace por su cuenta.
 */
export function seccionAModelo(s) {
  const avisos = [];
  const esFicticio = (p) => p.tipo === 'f' || /^ficticio$/i.test(p.material);
  const partes = s.partes.filter((p) => !esFicticio(p));
  const hor = partes[0];
  const durabilidad = {
    ambiente: s.ambiente !== undefined ? AMBIENTES[s.ambiente] : undefined,
    exposiciones: s.exposiciones ? EXPOSICIONES.filter((e, i) => s.exposiciones[i] && e !== 'Nada') : [],
  };
  const base = { nombre: s.nombre, hormigon: hor?.material, durabilidad, origen: { formato: s.tipo } };
  if (s.recubrimiento) base.durabilidad.rnomImportado = s.recubrimiento;

  // Contorno de hormigón
  let forma = 'generica';
  let geo;
  let xc = 0; // desplazamiento para que x empiece en 0
  if (hor?.tipo === 'T' && hor.trapecios?.length) {
    const tr = hor.trapecios;
    const h = tr.reduce((t, x) => t + x.h, 0);
    const bmax = Math.max(...tr.flatMap((t) => [t.bSup, t.bInf]));
    xc = bmax / 2;
    const rect = (t) => Math.abs(t.bSup - t.bInf) < 1e-9;
    if (tr.length === 1 && rect(tr[0])) {
      forma = 'rectangular';
      geo = { b: tr[0].bSup, h };
    } else if (tr.length === 2 && rect(tr[0]) && rect(tr[1]) && tr[0].bSup > tr[1].bSup) {
      forma = 'T';
      geo = { b: tr[0].bSup, h, bw: tr[1].bSup, hf: tr[0].h };
    } else {
      // Pila de trapecios simétricos: contorno por la derecha y vuelta por la izquierda
      const der = [];
      let y = hor.ySup ?? 0;
      for (const t of tr) { der.push([xc + t.bSup / 2, y], [xc + t.bInf / 2, y + t.h]); y += t.h; }
      const izq = der.map(([x, yy]) => [2 * xc - x, yy]).reverse();
      geo = { contorno: [...der, ...izq] };
    }
  } else if (hor?.tipo === 'C') {
    forma = 'circular';
    geo = { D: 2 * hor.R };
    xc = hor.R - (hor.xc ?? 0);
  } else if (hor?.tipo === 'X') {
    const xs = hor.puntos.map((q) => q.x);
    xc = -Math.min(...xs);
    const ys0 = Math.min(...hor.puntos.map((q) => q.y));
    geo = { contorno: hor.puntos.map((q) => [q.x + xc, q.y - ys0]), huecos: partes.filter((p) => p.tipo === 'H').map((p) => p.puntos.map((q) => [q.x + xc, q.y - ys0])) };
  } else {
    return { ...base, forma: 'generica', geo: { contorno: [[0, 0], [0.3, 0], [0.3, 0.5], [0, 0.5]] }, armado: [], aviso: `No se reconoce el contorno de ${s.nombre}`, acero: undefined };
  }
  const H = forma === 'circular' ? geo.D : (geo.h ?? Math.max(...geo.contorno.map((q) => q[1])));

  // Armadura
  const armado = [];
  let acero;
  const capa = (y, texto) => (y > H / 2 ? { tipo: 'capa', cara: 'inf', texto, d: +(H - y).toFixed(4) } : { tipo: 'capa', cara: 'sup', texto, d: +y.toFixed(4) });
  for (const p of partes.slice(1)) {
    if (p.tipo === 'H') continue;
    acero ??= p.material;
    if (p.tipo === 'P') {
      const fi = Math.round(p.fi * 1000);
      const ys = [...new Set(p.barras.map((b) => b.y.toFixed(4)))];
      if (forma !== 'generica' && forma !== 'circular' && ys.length === 1 && p.barras.length >= 2) armado.push(capa(p.barras[0].y, `${p.barras.length}D${fi}`));
      else armado.push({ tipo: 'puntual', barras: p.barras.map((b) => ({ x: +(b.x + xc).toFixed(4), y: +b.y.toFixed(4), fi })) });
    } else if (p.tipo === 'T' && p.trapecios?.length === 1) {
      // Armadura dada como área: trapecio fino
      const t = p.trapecios[0];
      const A = ((t.bSup + t.bInf) / 2) * t.h;
      armado.push(capa((p.ySup ?? 0) + t.h / 2, String(Math.round(A * 1e6))));
    } else if (p.tipo === 'A') {
      const fi = Math.round(Math.sqrt((4 * p.ar) / Math.PI) * 1000);
      armado.push({ tipo: 'anillo', texto: `${p.nPuntos}D${fi}`, r: +(p.rec ?? 0).toFixed(4) });
    } else {
      avisos.push(`Parte ${p.tipo} de ${s.nombre} no reconocida`);
    }
  }
  return normalizarCaras({ ...base, forma, geo, armado, acero, ...(avisos.length ? { aviso: avisos.join('; ') } : {}) });
}

export function materialAModelo(m) {
  if (m.tipo === 'hormigon') {
    return { nombre: m.nombre, tipo: 'hormigon', fck: m.fk / 1000, gammaC: m.gamma, alfa: m.alfa, diagrama: m };
  }
  if (m.tipo === 'acero') {
    return {
      nombre: m.nombre,
      tipo: 'acero',
      fyk: m.fk / 1000,
      gammaS: m.gamma,
      Es: m.E / 1000,
      epsUd: m.tracc[m.tracc.length - 1][0],
      diagrama: m,
    };
  }
  return { nombre: m.nombre, tipo: 'generico', diagrama: m };
}

/**
 * Importa un proyecto completo a partir de un mapa {rutaRelativa: texto}.
 * Acepta rutas con cualquier mayúscula y separador ("Secciones/V1.sec", "materiales\\HA25.mat").
 * @param {Record<string,string>} archivos
 * @returns {{proyecto:object, avisos:string[]}}
 */
export function importarProyecto(archivos) {
  const avisos = [];
  const porNombre = new Map();
  for (const [ruta, txt] of Object.entries(archivos)) {
    const partes = ruta.replace(/\\/g, '/').split('/');
    const base = partes[partes.length - 1].toLowerCase();
    const carpeta = (partes[partes.length - 2] ?? '').toLowerCase();
    porNombre.set(`${carpeta}/${base}`, txt);
    if (!porNombre.has(base)) porNombre.set(base, txt);
  }
  const ehe = Object.entries(archivos).find(([r]) => /\.ehe$/i.test(r));
  if (!ehe) throw new Error('No se encuentra ningún archivo .EHE');
  const p = leerProyectoEHE(ehe[1]);

  const buscar = (carpeta, nombre, ext) =>
    porNombre.get(`${carpeta}/${nombre.toLowerCase()}.${ext}`) ?? porNombre.get(`${nombre.toLowerCase()}.${ext}`);

  const materiales = new Map();
  const cargaMat = (nombre) => {
    if (!nombre || materiales.has(nombre)) return;
    const txt = buscar('materiales', nombre, 'mat');
    if (txt === undefined) {
      avisos.push(`No se encuentra el material ${nombre}.mat`);
      return;
    }
    try {
      materiales.set(nombre, materialAModelo(leerMaterial(txt, nombre)));
    } catch (e) {
      avisos.push(String(e.message ?? e));
    }
  };
  p.hormigones.forEach(cargaMat);
  p.aceros.forEach(cargaMat);

  const secciones = [];
  for (const n of [...p.rec1, ...p.rec2, ...p.t, ...p.cir, ...p.gen]) {
    const txt = buscar('secciones', n, 'sec');
    if (txt === undefined) {
      avisos.push(`No se encuentra la sección ${n}.sec`);
      continue;
    }
    try {
      const s = seccionAModelo(leerSeccion(txt));
      s.nombre = n;
      cargaMat(s.hormigon);
      cargaMat(s.acero);
      if (s.aviso) { avisos.push(s.aviso); delete s.aviso; }
      secciones.push(s);
    } catch (e) {
      avisos.push(`${n}.sec: ${e.message ?? e}`);
    }
  }
  const mats = [...materiales.values()];
  return {
    proyecto: {
      formato: 'prontuario-web',
      version: 2,
      ajustes: { sepCapas: 0.05 },
      nombre: p.nombre,
      datosObra: p.datosObra,
      norma: NORMA_DEFECTO,
      hormigones: mats.filter((m) => m.tipo === 'hormigon'),
      aceros: mats.filter((m) => m.tipo === 'acero'),
      secciones,
      calculos: {},
      importadoDe: { archivo: ehe[0], fecha: new Date().toISOString().slice(0, 10) },
    },
    avisos,
  };
}
