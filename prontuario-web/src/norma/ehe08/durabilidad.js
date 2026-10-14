// Durabilidad según EHE-08 (arts. 8.2, 37.2.4, 37.3), pensada para informar, no para reproducir las tablas:
// se pregunta lo que hace falta y se devuelve recubrimiento, a/c, cemento y fck mínimos con lo que manda.
// Las indicaciones del Código Estructural (CE, arts. 43-44) se dan solo donde difieren de la EHE-08.
// Fuentes (analisis/normativa): EHE-08 tablas 8.2.2, 8.2.3.a, 37.2.4.1.a-c, 37.3.2.a-b; CE tablas 43.2.1, 44.2.1.1, 44.3, 44.4, 44.5.

export const GENERALES = ['I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IIIc', 'IV'];
export const QUIMICAS = ['Qa', 'Qb', 'Qc'];
export const HIELO = ['H', 'F'];
export const EROSION = ['E'];
export const ESPECIFICAS = [...QUIMICAS, ...HIELO, ...EROSION];
export const TIPOS_HORMIGON = ['armado', 'pretensado', 'masa'];

/** Grupos de clases que no pueden darse a la vez (una sola de cada grupo; E va sola). */
export const GRUPOS = [GENERALES, QUIMICAS, HIELO, EROSION];

/** Clases del CE / UNE-EN 206 más próximas, solo para orientar. */
export const EQUIV_CE = { I: 'X0', IIa: 'XC1–XC2', IIb: 'XC3–XC4', IIIa: 'XS1', IIIb: 'XS2', IIIc: 'XS3', IV: 'XD1–XD3', Qa: 'XA1', Qb: 'XA2', Qc: 'XA3', H: 'XF1, XF3', F: 'XF2, XF4', E: 'XM1–XM3' };

export const CEMENTOS = ['cem1', 'cemII', 'cemS', 'cemP', 'cemV', 'cemAD', 'cem3', 'adic'];
export const VIDAS = [50, 100];

/** Clases que no se pueden marcar con la selección actual (lo que se pone en gris). */
export function deshabilitadas(sel, tipo = 'armado') {
  const no = new Set();
  for (const g of GRUPOS) if (g.some((c) => sel.includes(c))) for (const c of g) if (!sel.includes(c)) no.add(c);
  // El hormigón en masa no tiene armaduras que corroer: siempre clase I
  if (tipo === 'masa') for (const c of GENERALES) if (c !== 'I') no.add(c);
  return no;
}

/** Quita lo incompatible (cambio de tipo de hormigón, proyecto antiguo…) y fuerza I en masa. */
export function normalizar(sel = [], tipo = 'armado') {
  const out = [];
  for (const g of GRUPOS) {
    const v = sel.find((c) => g.includes(c) && !(tipo === 'masa' && g === GENERALES && c !== 'I'));
    if (v) out.push(v);
  }
  if (tipo === 'masa' && !out.includes('I')) out.unshift('I');
  return out;
}

// ----- Tablas de dosificación (37.3.2.a y b). Orden: general, Q, H, F, E -----
const COD = ['I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IIIc', 'IV', 'Qa', 'Qb', 'Qc', 'H', 'F', 'E'];
const fila = (v) => Object.fromEntries(COD.map((c, i) => [c, v[i]]).filter(([, x]) => x !== null));
export const AC = {
  masa: fila([0.65, null, null, null, null, null, null, 0.50, 0.50, 0.45, 0.55, 0.50, 0.50]),
  armado: fila([0.65, 0.60, 0.55, 0.50, 0.50, 0.45, 0.50, 0.50, 0.50, 0.45, 0.55, 0.50, 0.50]),
  pretensado: fila([0.60, 0.60, 0.55, 0.45, 0.45, 0.45, 0.45, 0.50, 0.45, 0.45, 0.55, 0.50, 0.50]),
};
export const CEMENTO = {
  masa: fila([200, null, null, null, null, null, null, 275, 300, 325, 275, 300, 275]),
  armado: fila([250, 275, 300, 300, 325, 350, 325, 325, 350, 350, 300, 325, 300]),
  pretensado: fila([275, 300, 300, 300, 325, 350, 325, 325, 350, 350, 300, 325, 300]),
};
export const FCK = {
  masa: fila([20, null, null, null, null, null, null, 30, 30, 35, 30, 30, 30]),
  armado: fila([25, 25, 30, 30, 30, 35, 30, 30, 30, 35, 30, 30, 30]),
  pretensado: fila([25, 25, 30, 30, 35, 35, 35, 30, 35, 35, 30, 30, 30]),
};

// ----- Recubrimientos mínimos (mm). [50 años, 100 años]; null = recubrimiento excesivo (estudio específico) -----
const CEM1 = new Set(['cem1', 'cemII', 'cemS']); // los que se tratan como CEM I en clases I y II (comentario a 37.2.4.1)
const FAV_ARMADO = new Set(['cemS', 'cemP', 'cemV', 'cemAD', 'cem3', 'adic']); // tabla 37.2.4.1.b, fila favorable
const FAV_PRETENSADO = new Set(['cemAD', 'adic']);
const REC_A = {
  I: { cem1: { bajo: [15, 25], alto: [15, 25] }, otros: { bajo: [15, 25], alto: [15, 25] } },
  IIa: { cem1: { bajo: [15, 25], alto: [10, 20] }, otros: { bajo: [20, 30], alto: [15, 25] } },
  IIb: { cem1: { bajo: [20, 30], alto: [15, 25] }, otros: { bajo: [25, 35], alto: [20, 30] } },
};
// Columnas IIIa, IIIb, IIIc, IV; por vida útil
const REC_B = {
  armado: { fav: { 50: [25, 30, 35, 35], 100: [30, 35, 40, 40] }, resto: { 50: [45, 40, null, null], 100: [65, null, null, null] } },
  pretensado: { fav: { 50: [30, 35, 40, 40], 100: [35, 40, 45, 45] }, resto: { 50: [65, 45, null, null], 100: [null, null, null, null] } },
};
const IDX_B = { IIIa: 0, IIIb: 1, IIIc: 2, IV: 3 };
const REC_C = {
  H: { cem3: { bajo: [25, 50], alto: [15, 25] }, otros: { bajo: [20, 35], alto: [10, 20] } },
  F: { cemAD: { bajo: [25, 50], alto: [15, 35] }, cem3: { bajo: [40, 75], alto: [20, 40] }, otros: { bajo: [20, 40], alto: [10, 20] } },
  E: { cualquiera: { bajo: [40, 80], alto: [20, 35] } },
};
const REC_QA = { fav: [40, 55], resto: [null, null] };

const iv = (vida) => (vida === 100 ? 1 : 0);

/** Recubrimiento mínimo por durabilidad de una clase: { valor (mm) | null si excesivo | 'proyecto' }, y el artículo. */
function recClase(c, { tipo, cemento, vida, fck }) {
  const k = iv(vida);
  const alto = fck >= 40 ? 'alto' : 'bajo';
  if (c === 'I' || c === 'IIa' || c === 'IIb') {
    const t = REC_A[c][CEM1.has(cemento) ? 'cem1' : 'otros'][alto];
    return { valor: t[k], art: '37.2.4.1.a' };
  }
  if (c in IDX_B) {
    const pret = tipo === 'pretensado';
    const fav = (pret ? FAV_PRETENSADO : FAV_ARMADO).has(cemento);
    return { valor: REC_B[pret ? 'pretensado' : 'armado'][fav ? 'fav' : 'resto'][vida === 100 ? 100 : 50][IDX_B[c]], art: '37.2.4.1.b' };
  }
  if (c === 'Qb' || c === 'Qc') return { valor: 'proyecto', art: '37.2.4.1.c' };
  if (c === 'Qa') return { valor: REC_QA[FAV_ARMADO.has(cemento) ? 'fav' : 'resto'][k], art: '37.2.4.1.c' };
  if (c === 'H') return { valor: REC_C.H[cemento === 'cem3' ? 'cem3' : 'otros'][alto][k], art: '37.2.4.1.c' };
  if (c === 'F') return { valor: REC_C.F[cemento === 'cemAD' ? 'cemAD' : cemento === 'cem3' ? 'cem3' : 'otros'][alto][k], art: '37.2.4.1.c' };
  return { valor: REC_C.E.cualquiera[alto][k], art: '37.2.4.1.c' };
}

export const MARGEN = { prefabricadoIntenso: 0, intenso: 5, normal: 10 };

/**
 * @param {Object} d
 * @param {'armado'|'pretensado'|'masa'} d.tipo
 * @param {string[]} d.clases       p. ej. ['IIIa', 'F']
 * @param {string} d.cemento        clave de CEMENTOS
 * @param {50|100} d.vida
 * @param {number} d.fck            MPa
 * @param {'normal'|'intenso'|'prefabricadoIntenso'} [d.control]
 * @param {number} [d.arido]        tamaño máximo, mm
 * @param {number} [d.fiMax]        diámetro de la barra mayor, mm
 * @param {boolean} [d.muyJuntas]   armaduras que dificultan el paso del hormigón (1,25·árido)
 * @param {boolean} [d.contraTerreno] hormigonado contra el terreno, sin hormigón de limpieza
 */
export function durabilidad({ tipo = 'armado', clases = [], cemento = 'cem1', vida = 50, fck, control = 'normal', arido = 20, fiMax = 0, muyJuntas = false, contraTerreno = false }) {
  const sel = normalizar(clases, tipo);
  const general = sel.find((c) => GENERALES.includes(c)) ?? null;
  const T = tipo in AC ? tipo : 'armado';
  const entrada = { tipo: T, cemento, vida, fck };

  // Dosificación: para cada parámetro manda la clase más exigente
  const pesos = (tab, f, ini) => sel.reduce((m, c) => (c in tab[T] ? f(m, tab[T][c]) : m), ini);
  const ac = sel.length ? pesos(AC, Math.min, Infinity) : null;
  const cem = sel.length ? pesos(CEMENTO, Math.max, 0) : null;
  const fckMin = sel.length ? pesos(FCK, Math.max, 0) : null;
  const mandaDos = (tab, v) => sel.filter((c) => tab[T][c] === v);

  // Recubrimiento: tabla de cada clase y condiciones geométricas (37.2.4.1 a y e del artículo)
  const detalle = sel.map((c) => ({ clase: c, ...recClase(c, entrada) }));
  const excesivo = detalle.filter((x) => x.valor === null).map((x) => x.clase);
  const fijaProyecto = detalle.filter((x) => x.valor === 'proyecto').map((x) => x.clase);
  const numeros = detalle.filter((x) => typeof x.valor === 'number');
  const rTabla = numeros.length ? Math.max(...numeros.map((x) => x.valor)) : 0;
  const mandaTabla = numeros.filter((x) => x.valor === rTabla).map((x) => x.clase);
  const rBarra = Math.max(fiMax, (muyJuntas ? 1.25 : 0.8) * arido);
  const rTerreno = contraTerreno ? 70 : 0;
  const rmin = Math.max(rTabla, rBarra, rTerreno);
  const manda = rmin === rTabla ? 'tabla' : rmin === rTerreno ? 'terreno' : (muyJuntas ? 1.25 : 0.8) * arido >= fiMax ? 'arido' : 'barra';
  const dr = MARGEN[control] ?? 10;
  const estudio = excesivo.length > 0;

  const alcali = sel.some((c) => GENERALES.includes(c) && c !== 'I' && c !== 'IIb');

  // Notas de requisitos adicionales (37.3.3 a 37.3.8, 37.2.4.1)
  const notas = [];
  if (sel.includes('F')) notas.push({ clave: 'eh.aire', v: 4.5 });
  if (sel.includes('H') || sel.includes('F')) notas.push({ clave: 'eh.aridoHielo' });
  if (sel.includes('E')) notas.push({ clave: 'eh.erosion', v: arido <= 10 ? 400 : arido <= 20 ? 375 : 350 });
  if (sel.some((c) => QUIMICAS.includes(c))) notas.push({ clave: 'eh.sulfatos' });
  if (sel.includes('IIIb') || sel.includes('IIIc') || (tipo === 'masa' && sel.includes('Qb'))) notas.push({ clave: 'eh.aguaMar' });
  if (alcali) notas.push({ clave: 'eh.alcali' });
  if (rmin > 50) notas.push({ clave: 'eh.malla', v: fiMax > 32 ? 10 : 5 });
  if (tipo === 'pretensado') notas.push({ clave: 'eh.cementoPret' });
  if (cemento === 'adic') notas.push({ clave: 'eh.adiciones' });

  // Impermeabilidad (37.3.3): penetración de agua máxima / media (mm) del ensayo
  const duro = sel.some((c) => c === 'IIIc' || c === 'Qc' || (c === 'Qb' && tipo === 'pretensado'));
  const exige = sel.some((c) => ['IIIa', 'IIIb', 'IIIc', 'IV'].includes(c) || ESPECIFICAS.includes(c));
  const impermeabilidad = exige ? (duro ? { max: 30, med: 20 } : { max: 50, med: 30 }) : null;

  return {
    norma: 'EHE-08',
    clases: sel,
    general,
    ac,
    mandaAc: ac === null ? [] : mandaDos(AC, ac),
    cemento: cem,
    mandaCemento: cem === null ? [] : mandaDos(CEMENTO, cem),
    fckMin,
    mandaFck: fckMin === null ? [] : mandaDos(FCK, fckMin),
    cumpleFck: fckMin === null ? true : fck >= fckMin,
    detalle,
    rTabla,
    mandaTabla,
    rmin,
    mandaRmin: manda,
    dr,
    rnom: estudio ? null : rmin + dr,
    estudio: excesivo,
    fijaProyecto,
    impermeabilidad,
    notas,
    ce: indicacionesCE({ ...entrada, sel, ac, cem, rmin: rTabla, arido }),
    articulos: { rnom: '37.2.4', dosificacion: '37.3.2', clases: '8.2.2 y 8.2.3' },
  };
}

// ----- Indicaciones del CE donde difieren de la EHE-08 -----
// CE 44.2.1.1.b, columnas XS1, XS2, XS3, XD (XD1-XD3 con el mismo valor)
const CE_B = {
  armado: {
    fav: { 50: [25, 30, 45, 35], 100: [30, 35, 50, 40] },
    bsbp: { 50: [30, 35, 65, 40], 100: [35, 40, 70, 45] },
    resto: { 50: [40, 45, null, null], 100: [65, null, null, null] },
  },
  pretensado: {
    fav: { 50: [30, 35, 50, 40], 100: [35, 40, 65, 45] },
    resto: { 50: [45, 55, null, null], 100: [null, null, null, null] },
  },
};
const CE_NOMBRE = { IIIa: 'XS1', IIIb: 'XS2', IIIc: 'XS3', IV: 'XD1-XD3' };
const CE_FAV = new Set(['cem3', 'cemV', 'cemAD', 'adic']);

function indicacionesCE({ tipo, sel, cemento, vida, fck, ac, cem }) {
  const out = [];
  const pret = tipo === 'pretensado';
  // Recubrimiento por cloruros (CE 44.2.1.1.b)
  for (const c of sel) {
    if (!(c in IDX_B)) continue;
    const t = CE_B[pret ? 'pretensado' : 'armado'];
    const cat = pret ? (new Set(['cemAD', 'adic']).has(cemento) ? 'fav' : 'resto')
      : CE_FAV.has(cemento) ? 'fav' : (cemento === 'cemS' || cemento === 'cemP') ? 'bsbp' : 'resto';
    const ce = t[cat][vida === 100 ? 100 : 50][IDX_B[c]];
    const eh = recClase(c, { tipo: pret ? 'pretensado' : 'armado', cemento, vida, fck }).valor;
    if (ce !== eh) out.push({ clave: 'eh.ceRec', v: [CE_NOMBRE[c], c, ce, eh, '44.2.1.1.b'] });
  }
  // Heladas con sales: CEM III a 100 años y fck < 40 (CE 44.3)
  if (sel.includes('F') && cemento === 'cem3' && vida === 100 && fck < 40) out.push({ clave: 'eh.ceRec', v: ['XF2/XF4', 'F', null, 75, '44.3'] });
  // Erosión: sobreespesor en vez de tabla (CE 44.5)
  if (sel.includes('E')) out.push({ clave: 'eh.ceErosion' });
  // Dosificación (CE 43.2.1): diferencias con la EHE-08
  if (sel.includes('I') && (tipo === 'armado' || tipo === 'masa')) out.push({ clave: 'eh.ceAcX0', v: [0.60, 0.65] });
  if (sel.includes('H') && pret) out.push({ clave: 'eh.ceAcH', v: [0.45, 0.55] });
  if (sel.includes('E')) out.push({ clave: 'eh.ceCemE', v: [tipo === 'masa' ? 300 : 325, tipo === 'masa' ? 275 : 300] });
  // Casos especiales: la EHE-08 y el CE lo dejan al proyectista
  if (sel.some((c) => c === 'Qb' || c === 'Qc')) out.push({ clave: 'eh.ceQ' });
  return out;
}
