// Durabilidad según UNE-EN 1992-1-1:2013 con el Anejo Nacional (AN): recubrimiento por clase estructural
// (4.4.1.2, tablas AN/2 a AN/4, AN/14) y, como el EC-2 no da dosificación, a/c, cemento y fck mínimos del
// Código Estructural (CE 43.2.1) y recubrimientos CE para XF y XA, donde el EC-2 no trae tabla.
// Las indicaciones del CE para el resto se dan solo donde difieren del AN.
// Fuentes (analisis/normativa): ec2-2004-an texto.txt l.9756-9960 y 10844-10900; ce-hormigon texto.txt tablas 43.2.1, 44.2.1.1, 44.3, 44.4, 44.5.

export const X0 = ['X0'];
export const XC = ['XC1', 'XC2', 'XC3', 'XC4'];
export const XD = ['XD1', 'XD2', 'XD3'];
export const XS = ['XS1', 'XS2', 'XS3'];
export const XF = ['XF1', 'XF2', 'XF3', 'XF4'];
export const XA = ['XA1', 'XA2', 'XA3'];
export const XM = ['XM1', 'XM2', 'XM3'];
export const CLASES = [...X0, ...XC, ...XD, ...XS, ...XF, ...XA, ...XM];
export const TIPOS_HORMIGON = ['armado', 'pretensado', 'masa'];
export const CEMENTOS = ['cem1', 'cemII', 'cemS', 'cemP', 'cemV', 'cemAD', 'cem3', 'adic'];
export const VIDAS = [50, 100];

/** Equivalencia con la EHE-08 (AN, tabla AN/14), solo para orientar. */
export const EQUIV_EHE = { X0: 'I', XC1: 'I–IIa', XC2: 'IIa', XC3: 'IIa', XC4: 'IIb', XD1: 'IIIa', XD2: 'IV', XD3: 'IV', XS1: 'IIIa', XS2: 'IIIb', XS3: 'IIIc', XF1: 'H', XF2: 'F', XF3: 'H', XF4: 'F', XA1: 'Qa', XA2: 'Qb', XA3: 'Qc', XM1: 'E', XM2: 'E', XM3: 'E' };

/** Grupos excluyentes: una sola clase de cada uno; los cloruros son XD o XS, no los dos. */
export const GRUPOS = [X0, XC, [...XD, ...XS], XF, XA, XM];

export function deshabilitadas(sel, tipo = 'armado') {
  const no = new Set();
  const hay = (g) => g.some((c) => sel.includes(c));
  for (const g of GRUPOS) if (hay(g)) for (const c of g) if (!sel.includes(c)) no.add(c);
  const corrosion = [...XC, ...XD, ...XS];
  // X0 es «sin riesgo»: no va con las de corrosión; y las de corrosión quitan X0
  if (sel.includes('X0')) for (const c of corrosion) no.add(c);
  if (corrosion.some((c) => sel.includes(c))) no.add('X0');
  // El hormigón en masa no tiene armaduras que corroer
  if (tipo === 'masa') for (const c of corrosion) no.add(c);
  return no;
}

export function normalizar(sel = [], tipo = 'armado') {
  const out = [];
  for (const g of GRUPOS) {
    const v = sel.find((c) => g.includes(c) && !(tipo === 'masa' && (XC.includes(c) || XD.includes(c) || XS.includes(c))));
    if (v) out.push(v);
  }
  const corrosion = out.filter((c) => [...XC, ...XD, ...XS].includes(c));
  if (out.includes('X0') && corrosion.length) out.splice(out.indexOf('X0'), 1);
  return out;
}

// ----- Dosificación (CE 43.2.1.a y b). Orden CLASES = X0, XC1-4, XD1-3, XS1-3, XF1-4, XA1-3, XM1-3 -----
const COL = [...X0, ...XC, ...XS, ...XD, ...XF, ...XA, ...XM]; // orden de las tablas del CE
const tabla = (v) => Object.fromEntries(COL.map((c, i) => [c, v[i]]).filter(([, x]) => x !== null));
const _ = null;
export const AC = {
  masa: tabla([0.60, _, _, _, _, _, _, _, _, _, _, 0.55, 0.50, 0.55, 0.50, 0.50, 0.50, 0.45, 0.50, 0.50, 0.50]),
  armado: tabla([0.60, 0.60, 0.60, 0.55, 0.55, 0.50, 0.50, 0.45, 0.50, 0.50, 0.50, 0.55, 0.50, 0.55, 0.50, 0.50, 0.50, 0.45, 0.50, 0.50, 0.50]),
  pretensado: tabla([0.60, 0.60, 0.60, 0.55, 0.55, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.50, 0.45, 0.50, 0.50, 0.45, 0.45, 0.50, 0.50, 0.50]),
};
export const CEMENTO = {
  masa: tabla([200, _, _, _, _, _, _, _, _, _, _, 275, 300, 275, 300, 275, 300, 325, 300, 300, 300]),
  armado: tabla([250, 275, 275, 300, 300, 300, 325, 350, 325, 325, 325, 300, 325, 300, 325, 325, 350, 350, 325, 325, 325]),
  pretensado: tabla([275, 300, 300, 300, 300, 300, 325, 350, 325, 325, 325, 300, 325, 300, 325, 325, 350, 350, 325, 325, 325]),
};
export const FCK = {
  masa: tabla([20, _, _, _, _, _, _, _, _, _, _, 30, 30, 30, 30, 30, 30, 35, 30, 30, 30]),
  armado: tabla([25, 25, 25, 30, 30, 30, 30, 35, 30, 30, 30, 30, 30, 30, 30, 30, 30, 35, 30, 30, 30]),
  pretensado: tabla([25, 25, 25, 30, 30, 30, 35, 35, 35, 35, 35, 30, 30, 30, 30, 30, 35, 35, 30, 30, 30]),
};
/** Clase de resistencia indicativa (AN, tabla AN/13) para armado y pretensado. */
const CLASE_AN13 = { XC1: ['C25/30', 'C25/30'], XC2: ['C25/30', 'C25/30'], XC3: ['C25/30', 'C25/30'], XC4: ['C30/35', 'C30/35'], XD1: ['C30/35', 'C30/35'], XD2: ['C30/35', 'C35/40'], XD3: ['C30/35', 'C35/40'], XS1: ['C30/35', 'C30/35'], XS2: ['C30/35', 'C35/40'], XS3: ['C35/40', 'C35/40'] };

// ----- Clase estructural (AN/2) y recubrimiento mínimo por durabilidad (AN/3) -----
const COLS_AN = ['X0', 'XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XS1', 'XS2'];
const AN3 = {
  1: [10, 10, 10, 10, 15, 30, 30, 30],
  2: [10, 10, 10, 10, 20, 35, 35, 35],
  3: [15, 15, 15, 15, 20, 40, 40, 35],
  4: [15, 15, 20, 20, 25, 40, 40, 35],
  5: [20, 20, 25, 25, 30, 50, 50, 45],
  6: [25, 25, 30, 30, 35, 60, 60, 60],
};
const ESTUDIO_AN = new Set(['XD2', 'XD3', 'XS3']); // el AN pide estudio específico (comprobación del ELD)
// Cemento adecuado y 50 / 100 años: clases que se bajan
const BAJA_CEMENTO = { X0: [0, 0], XC1: [0, 0], XC2: [1, 1], XC3: [1, 1], XC4: [2, 1], XD1: [3, 4], XS1: [3, 4], XS2: [3, 4] };
// AN/4: incremento adicional Δcdur,γ (mm) por tipo y cemento; null = el AN no lo da (estudio específico)
const DELTA_GAMMA = {
  armado: { adecuado: { XD1: -5, XS1: -5, XS2: 0 }, otros: { XD1: 5, XS1: 5, XS2: null } },
  pretensado: { adecuado: { XD1: 0, XS1: 0, XS2: 5 }, otros: { XD1: null, XS1: null, XS2: null } },
};
const CLORUROS_DUROS = new Set([...XD, ...XS]);
// Cemento adecuado: en XC cualquier cemento común; en XD y XS los de la lista favorable (Anejo 6 del CE)
const ADECUADO_CLORUROS = new Set(['cemS', 'cemP', 'cemV', 'cemAD', 'cem3', 'adic']);
const adecuado = (cemento, c) => (CLORUROS_DUROS.has(c) ? ADECUADO_CLORUROS.has(cemento) : true);

export const MARGEN = { prefabricadoIntenso: 0, intenso: 5, normal: 10 };
const ABRASION = { XM1: 5, XM2: 10, XM3: 15 }; // 4.4.1.2(13)

/** Clase estructural y cmin,dur de una clase XC/XD/XS/X0, con los pasos del cálculo. */
function clasePorAN(c, { tipo, cemento, vida, fck }) {
  if (ESTUDIO_AN.has(c)) return { estudio: true, motivo: 'clase' };
  const k = vida === 100 ? 1 : 0;
  const pasos = [];
  let s = 4;
  if (vida === 100) { s += 2; pasos.push({ clave: 'ec.paso100' }); }
  const baja = adecuado(cemento, c) ? BAJA_CEMENTO[c][k] : 0;
  if (baja) { s -= baja; pasos.push({ clave: 'ec.pasoCemento', v: [baja] }); }
  if (fck >= 40 && !CLORUROS_DUROS.has(c)) { s -= 1; pasos.push({ clave: 'ec.pasoFck' }); }
  s = Math.min(6, Math.max(1, s));
  const cminDur = AN3[s][COLS_AN.indexOf(c)];
  let delta = 0;
  if (CLORUROS_DUROS.has(c)) {
    const d = DELTA_GAMMA[tipo === 'pretensado' ? 'pretensado' : 'armado'][adecuado(cemento, c) ? 'adecuado' : 'otros'][c];
    if (d === null || d === undefined) return { estudio: true, motivo: 'cemento', s };
    delta = d;
  }
  return { estudio: false, s, cminDur, delta, valor: cminDur + delta, pasos };
}

// ----- Recubrimientos del CE (44.2.1.1.a y b, 44.3, 44.4) -----
const CE_FAV = new Set(['cem3', 'cemV', 'cemAD', 'adic']);
const CE_A = {
  X0: { cualquiera: [[15, 25], [15, 25]] },
  XC13: { cem1: [[15, 25], [10, 20]], otros: [[20, 30], [15, 25]] },
  XC4: { cem1: [[20, 30], [15, 25]], otros: [[25, 35], [20, 30]] },
};
const CE_B = {
  armado: { fav: { 50: [25, 30, 45, 35], 100: [30, 35, 50, 40] }, bsbp: { 50: [30, 35, 65, 40], 100: [35, 40, 70, 45] }, resto: { 50: [40, 45, null, null], 100: [65, null, null, null] } },
  pretensado: { fav: { 50: [30, 35, 50, 40], 100: [35, 40, 65, 45] }, resto: { 50: [45, 55, null, null], 100: [null, null, null, null] } },
};
const IDX_CE = { XS1: 0, XS2: 1, XS3: 2, XD1: 3, XD2: 3, XD3: 3 };
const CE_FAV_XA = new Set(['cemS', 'cemP', 'cemV', 'cemAD', 'cem3', 'adic']);

/** cmin por durabilidad según el CE: número, null (excesivo, «*») o 'proyecto'. */
function recCE(c, { tipo, cemento, vida, fck }) {
  const k = vida === 100 ? 1 : 0;
  const alto = fck >= 40 ? 1 : 0;
  if (c === 'X0') return CE_A.X0.cualquiera[alto][k];
  if (c === 'XC1' || c === 'XC2' || c === 'XC3') return CE_A.XC13[cemento === 'cem1' ? 'cem1' : 'otros'][alto][k];
  if (c === 'XC4') return CE_A.XC4[cemento === 'cem1' ? 'cem1' : 'otros'][alto][k];
  if (c in IDX_CE) {
    const pret = tipo === 'pretensado';
    const cat = pret ? (cemento === 'cemAD' || cemento === 'adic' ? 'fav' : 'resto')
      : CE_FAV.has(cemento) ? 'fav' : (cemento === 'cemS' || cemento === 'cemP') ? 'bsbp' : 'resto';
    return CE_B[pret ? 'pretensado' : 'armado'][cat][vida === 100 ? 100 : 50][IDX_CE[c]];
  }
  if (c === 'XF1' || c === 'XF3') return (cemento === 'cem3' ? [[25, 50], [15, 25]] : [[20, 35], [10, 20]])[alto][k];
  if (c === 'XF2' || c === 'XF4') {
    const t = cemento === 'cemAD' ? [[25, 50], [15, 35]] : cemento === 'cem3' ? [[40, null], [20, 40]] : [[20, 40], [10, 20]];
    return t[alto][k];
  }
  if (c === 'XA1') return CE_FAV_XA.has(cemento) ? [40, 55][k] : null;
  if (c === 'XA2' || c === 'XA3') return 'proyecto';
  return 0; // XM: sobreespesor, no tabla
}

/**
 * @param {Object} d
 * @param {'armado'|'pretensado'|'masa'} d.tipo
 * @param {string[]} d.clases        p. ej. ['XC4', 'XD3']
 * @param {string} d.cemento
 * @param {50|100} d.vida
 * @param {number} d.fck
 * @param {'normal'|'intenso'|'prefabricadoIntenso'} [d.control]
 * @param {number} [d.arido]  mm
 * @param {number} [d.fiMax]  ø de la barra mayor, mm
 * @param {'no'|'limpieza'|'directo'} [d.terreno]
 */
export function durabilidad({ tipo = 'armado', clases = [], cemento = 'cem1', vida = 50, fck, control = 'normal', arido = 20, fiMax = 0, terreno = 'no' }) {
  const sel = normalizar(clases, tipo);
  const T = tipo in AC ? tipo : 'armado';
  const ctx = { tipo: T, cemento, vida, fck };

  const pesos = (tab, f, ini) => sel.reduce((m, c) => (c in tab[T] ? f(m, tab[T][c]) : m), ini);
  const ac = sel.length ? pesos(AC, Math.min, Infinity) : null;
  const cem = sel.length ? pesos(CEMENTO, Math.max, 0) : null;
  const fckMin = sel.length ? pesos(FCK, Math.max, 0) : null;
  const manda = (tab, v) => sel.filter((c) => tab[T][c] === v);
  const an13 = sel.filter((c) => c in CLASE_AN13).map((c) => CLASE_AN13[c][T === 'pretensado' ? 1 : 0]).sort().pop() ?? null;

  // cmin,dur: AN para X0, XC, XD1, XS1, XS2; CE donde el EC-2 no da tabla (XF, XA); XM suma sobreespesor
  const detalle = [];
  for (const c of sel) {
    if (c.startsWith('XF') || c.startsWith('XA')) {
      const v = recCE(c, ctx);
      detalle.push({ clase: c, fuente: 'CE', valor: v, art: c.startsWith('XF') ? 'CE 44.3' : 'CE 44.4' });
    } else if (c.startsWith('XM')) {
      detalle.push({ clase: c, fuente: 'AN', abrasion: ABRASION[c], art: '4.4.1.2(13)' });
    } else {
      detalle.push({ clase: c, fuente: 'AN', ...clasePorAN(c, ctx), art: 'AN/2 · AN/3' });
    }
  }
  const estudio = detalle.filter((x) => x.estudio || x.valor === null).map((x) => x.clase);
  const fijaProyecto = detalle.filter((x) => x.valor === 'proyecto').map((x) => x.clase);
  const numeros = detalle.filter((x) => typeof x.valor === 'number');
  const cminDur = numeros.length ? Math.max(...numeros.map((x) => x.valor)) : 0;
  const mandaDur = numeros.filter((x) => x.valor === cminDur).map((x) => x.clase);
  const abrasion = detalle.find((x) => x.abrasion)?.abrasion ?? 0;
  const cminB = fiMax + (arido > 32 ? 5 : 0);
  const sinArmadura = tipo === 'masa';
  const durTotal = cminDur + abrasion;
  const cmin = Math.max(cminB, durTotal, 10);
  const mandaCmin = cmin === durTotal && durTotal >= cminB && durTotal >= 10 ? 'dur' : cmin === cminB && cminB >= 10 ? 'b' : 'diez';
  const dr = MARGEN[control] ?? 10;
  const cTerreno = terreno === 'directo' ? 75 : terreno === 'limpieza' ? 40 : 0;
  const cnomCalc = cmin + dr;
  const cnom = sinArmadura || estudio.length ? null : Math.max(cnomCalc, cTerreno);

  const notas = [];
  if (sel.includes('XF2') || sel.includes('XF4')) notas.push({ clave: 'ec.aire', v: 4.5 });
  if (sel.includes('XS2') || sel.includes('XS3') || (tipo === 'masa' && sel.includes('XA2'))) notas.push({ clave: 'ec.aguaMar' });
  if (sel.some((c) => XA.includes(c))) notas.push({ clave: 'ec.sulfatos' });
  if (sel.some((c) => XM.includes(c))) notas.push({ clave: 'ec.erosion', v: arido <= 10 ? 400 : arido <= 20 ? 375 : 350 });
  if (sel.some((c) => c !== 'X0')) notas.push({ clave: 'ec.alcali' });
  if (cnom !== null && cnom > 50) notas.push({ clave: 'ec.malla' });
  if (tipo === 'pretensado') notas.push({ clave: 'ec.postesas' });
  if (sel.some((c) => c in CLASE_AN13)) notas.push({ clave: 'ec.an13', v: an13 });
  if (sel.some((c) => XD.includes(c) || XS.includes(c))) notas.push({ clave: 'ec.proteccion' });
  const imperm = sel.some((c) => ['XS3', 'XA3'].includes(c) || (c === 'XA2' && tipo === 'pretensado')) ? { max: 30, med: 20 }
    : sel.some((c) => [...XS, ...XD, ...XF, ...XM, 'XA1', 'XA2'].includes(c)) ? { max: 50, med: 30 } : null;

  return {
    norma: 'EC2-2004',
    clases: sel,
    ac, mandaAc: ac === null ? [] : manda(AC, ac),
    cemento: cem, mandaCemento: cem === null ? [] : manda(CEMENTO, cem),
    fckMin, mandaFck: fckMin === null ? [] : manda(FCK, fckMin),
    cumpleFck: fckMin === null ? true : fck >= fckMin,
    detalle, cminB, cminDur, mandaDur, abrasion, cmin, mandaCmin, dr, cnom, cTerreno,
    mandaTerreno: cnom !== null && cTerreno > cnomCalc,
    sinArmadura, estudio, fijaProyecto, impermeabilidad: imperm, notas,
    ce: indicacionesCE({ ...ctx, detalle, sel }),
    articulos: { cnom: '4.4.1.1', cmin: '4.4.1.2' },
  };
}

// ----- Indicaciones del CE donde difieren del AN -----
function indicacionesCE({ tipo, cemento, vida, fck, detalle, sel }) {
  const out = [];
  const ctx = { tipo, cemento, vida, fck };
  for (const x of detalle) {
    if (x.fuente !== 'AN' || x.abrasion !== undefined) continue;
    const ce = recCE(x.clase, ctx);
    if (x.estudio) {
      if (typeof ce === 'number') out.push({ clave: 'ec.ceSinAN', v: [x.clase, ce] });
    } else if (typeof ce === 'number' && ce !== x.valor) out.push({ clave: 'ec.ceRec', v: [x.clase, ce, x.valor] });
    else if (ce === null) out.push({ clave: 'ec.ceExcesivo', v: [x.clase, x.valor] });
  }
  if (sel.some((c) => c === 'XA2' || c === 'XA3')) out.push({ clave: 'ec.ceXA' });
  return out;
}
