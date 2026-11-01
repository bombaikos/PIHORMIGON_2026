// Textos de la interfaz en español e inglés (guía de estilo §10).
// Los diccionarios viven en src/i18n/; si falta una clave en inglés se usa la española.

import es from '../i18n/es.js';
import en from '../i18n/en.js';
import anclajeEs from '../i18n/anclaje.es.js';
import anclajeEn from '../i18n/anclaje.en.js';
import cortanteEs from '../i18n/cortante.es.js';
import cortanteEn from '../i18n/cortante.en.js';
import torsionEs from '../i18n/torsion.es.js';
import torsionEn from '../i18n/torsion.en.js';
import punzonamientoEs from '../i18n/punzonamiento.es.js';
import punzonamientoEn from '../i18n/punzonamiento.en.js';
import flexEsviadaEs from '../i18n/flexEsviada.es.js';
import flexEsviadaEn from '../i18n/flexEsviada.en.js';
import estadoTensionalEs from '../i18n/estadoTensional.es.js';
import estadoTensionalEn from '../i18n/estadoTensional.en.js';
import rasanteEs from '../i18n/rasante.es.js';
import rasanteEn from '../i18n/rasante.en.js';

const DICC = { es: { ...es, ...anclajeEs, ...cortanteEs, ...torsionEs, ...punzonamientoEs, ...rasanteEs, ...flexEsviadaEs, ...estadoTensionalEs }, en: { ...en, ...anclajeEn, ...cortanteEn, ...torsionEn, ...punzonamientoEn, ...rasanteEn, ...flexEsviadaEn, ...estadoTensionalEn } };
const CLAVE = 'prontuario-web:lengua';
let lengua = 'es';
try { lengua = localStorage.getItem(CLAVE) === 'en' ? 'en' : 'es'; } catch { /* sin almacenamiento */ }

export const lenguaActual = () => lengua;

export function ponerLengua(l) {
  lengua = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(CLAVE, lengua); } catch { /* sin almacenamiento */ }
  document.documentElement.lang = lengua;
}

/** Texto de una clave; si es una función, se le pasan los argumentos. */
export function t(clave, ...args) {
  const v = DICC[lengua][clave] ?? DICC.es[clave];
  if (v === undefined) return clave;
  return typeof v === 'function' ? v(...args) : v;
}

/** Texto de un error: { clave, args } o ErrorClave del núcleo, o un Error o texto corriente. */
export function tx(e) {
  if (e?.clave === 'err.varios') return e.args[0].map(tx).join('; ');
  if (e?.clave) return t(e.clave, ...(e.args ?? []));
  return e?.message ?? String(e);
}
