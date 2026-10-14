// Durabilidad según EHE-98 (capítulo VII), con las mismas tablas y reglas que Unit4.pas
// del Prontuario 3.1: RelacionAguaCemento, MinimoCemento, MinimaResistencia,
// HallaRecubrimientomm, RequisitosAdicionales y Tipifica.

export const AMBIENTES = ['I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IIIc', 'IV'];
export const EXPOSICIONES = ['Qa', 'Qb', 'Qc', 'H', 'F', 'E'];
export const CONSISTENCIAS = ['S', 'P', 'B', 'F'];

// Tabla 37.3.2.a (máxima relación a/c), 37.3.2.a (mínimo contenido de cemento, kg/m³)
// y 37.3.2.b (resistencia mínima, N/mm²), por ambiente general y por clase específica.
export const AC = { I: 0.65, IIa: 0.60, IIb: 0.55, IIIa: 0.50, IIIb: 0.50, IIIc: 0.45, IV: 0.50, Qa: 0.50, Qb: 0.50, Qc: 0.45, H: 0.55, F: 0.50, E: 0.50 };
export const CEMENTO = { I: 250, IIa: 275, IIb: 300, IIIa: 300, IIIb: 325, IIIc: 350, IV: 325, Qa: 325, Qb: 350, Qc: 350, H: 300, F: 325, E: 300 };
export const FCK = { I: 25, IIa: 25, IIb: 30, IIIa: 30, IIIb: 30, IIIc: 35, IV: 30, Qa: 30, Qb: 30, Qc: 35, H: 30, F: 30, E: 30 };

// Tabla 37.2.4: recubrimiento mínimo (mm). Las clases Q mandan sobre el ambiente general.
export const RMIN = {
  general: { bajo: [20, 25, 30, 35, 35, 40, 35, 40, 40, 40], alto: [15, 20, 25, 30, 30, 35, 30, 35, 35, 35] },
  prefabricado: { bajo: [15, 20, 25, 30, 30, 35, 30, 35, 35, 35], alto: [15, 20, 25, 25, 25, 30, 25, 30, 30, 30] },
};

/** Incremento del recubrimiento por control de ejecución (37.2.4). */
export const CONTROLES = { prefabricadoIntenso: 0, intenso: 5, normal: 10 };

/**
 * @param {Object} d
 * @param {string} d.ambiente        'I' … 'IV'
 * @param {string[]} d.exposiciones  subconjunto de EXPOSICIONES
 * @param {number} d.fck             MPa
 * @param {'general'|'prefabricado'} [d.tipo='general']
 * @param {'prefabricadoIntenso'|'intenso'|'normal'} [d.control='normal']
 * @param {number} [d.arido=20]      tamaño máximo del árido, mm
 * @param {string} [d.consistencia='B']
 */
export function durabilidad({ ambiente, exposiciones = [], fck, tipo = 'general', control = 'normal', arido = 20, consistencia = 'B' }) {
  const ia = AMBIENTES.indexOf(ambiente);
  if (ia < 0) throw new Error(`Ambiente desconocido: ${ambiente}`);
  const clases = [ambiente, ...exposiciones];
  const peor = (tabla, f) => clases.map((c) => tabla[c]).reduce((a, b) => f(a, b));
  const ac = peor(AC, Math.min);
  const cemento = peor(CEMENTO, Math.max);
  const fckMin = peor(FCK, Math.max);

  // El recubrimiento usa la clase Q más agresiva si la hay (como el original).
  let iv = ia;
  if (exposiciones.includes('Qa')) iv = 7;
  if (exposiciones.includes('Qb')) iv = 8;
  if (exposiciones.includes('Qc')) iv = 9;
  const tabla = RMIN[tipo] ?? RMIN.general;
  let rmin = (fck < 40 ? tabla.bajo : tabla.alto)[iv];
  const porArido = 0.8 * arido;
  const manda = porArido > rmin ? 'arido' : 'tabla';
  rmin = Math.max(rmin, porArido);
  const dr = CONTROLES[control] ?? 10;

  const notas = [];
  if (exposiciones.includes('F')) notas.push({ clave: 'dur.aire', v: 4.5 });
  if (exposiciones.includes('E')) notas.push({ clave: 'dur.cementoMax', v: arido <= 10 ? 400 : arido <= 20 ? 375 : 350 }, { clave: 'dur.losAngeles' }, { clave: 'dur.curado' });
  if (exposiciones.some((e) => e === 'Qa' || e === 'Qb' || e === 'Qc')) notas.push({ clave: 'dur.sulfatos' });
  if (['IIIa', 'IIIb', 'IIIc'].includes(ambiente)) notas.push({ clave: 'dur.aguaMar' });
  if (ambiente !== 'I' && ambiente !== 'IIb') notas.push({ clave: 'dur.alcali' });

  const expo = exposiciones.length ? ' + ' + exposiciones.join(' + ') : '';
  return {
    norma: 'EHE-98',
    ac,
    cemento,
    fckMin,
    cumpleFck: fck >= fckMin,
    rmin,
    mandaRmin: manda,
    dr,
    rnom: rmin + dr,
    notas,
    tipificacion: `HA-${Math.round(fck)}/${consistencia}/${arido}/${ambiente}${expo}`,
    articulos: { ac: 'art. 37.3.2', rnom: 'art. 37.2.4' },
  };
}
