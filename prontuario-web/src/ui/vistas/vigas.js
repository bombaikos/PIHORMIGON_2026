// Análisis · Vigas de un vano: reacciones, esfuerzos, giros y flechas de una viga elástica de EI constante
// (módulo `analisis` del Prontuario 3.1). Solo cargas y esfuerzos dados: sin combinaciones de acciones.
// La rigidez sale de la sección elegida (EI bruta = Ec·I) pero Ec e I se pueden escribir a mano.

import { analizarViga } from '../../core/vigas.js';
import { bruta } from '../../core/propiedades.js';
import { leerNumero } from '../../core/armado.js';
import { geometriaDe, materialesSeccion } from '../../io/proyecto.js';
import { t, tx } from '../i18n.js';
import { fmt, decimalAlCopiar, MAG } from '../formato.js';
import { copiarPNG, guardar } from '../exportarSvg.js';
import { h, poner, campoNum, selector, grupo, par } from '../campos.js';
import { rejilla } from '../rejilla.js';
import { dibujarLeyes } from '../vigaLeyes.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const num = (x) => String(+Number(x).toFixed(4));
const nv = (txt) => leerNumero(txt);

const INICIAL = () => ({ L: 6, izq: 'apoyo', der: 'apoyo', sec: null, EI: 48000, cargas: [{ tipo: 'distribuida', a: 0, b: 6, q1: 20, q2: 20 }] });

/** Estado de la pantalla, dentro del proyecto para que se guarde con él. */
function datosVigas(p) {
  p.calculos.vigas1vano ??= INICIAL();
  const D = p.calculos.vigas1vano;
  if (!(D.EI > 0) && D.Ec > 0 && D.I > 0) D.EI = Math.round(D.Ec * D.I); // proyectos de la primera versión (Ec e I)
  delete D.Ec; delete D.I;
  return D;
}

/** EI bruta [kN·m²] de una sección del proyecto: Ec·I con el Ec del hormigón según la norma activa. */
function rigidezSeccion(p, s) {
  const { hormigon } = materialesSeccion(p, s);
  return Math.round(hormigon.E * bruta(geometriaDe(p, s)).Ix);
}

const APOYOS = ['apoyo', 'empotramiento', 'libre'];

export function datos(ctx, form) {
  const p = ctx.p;
  const D = datosVigas(p);
  const cambio = () => ctx.cambio();
  const tipo = (k) => D.cargas.filter((c) => c.tipo === k);
  const poner_ = (k, lista) => { D.cargas = [...D.cargas.filter((c) => c.tipo !== k), ...lista]; cambio(); };
  const numeros = (...cols) => cols.map((c) => ({ ...c, num: true }));
  const posicion = (txt) => { const v = nv(txt); return v >= 0 && v <= D.L + 1e-9 ? null : t('vig.err.posicion', fmt(D.L, 2)); };

  const rejillas = {
    P: () => rejilla({ id: 'v-puntual', altoMax: 90,
      columnas: [{ titulo: 'a [m]', num: true, validar: posicion }, { titulo: 'P [kN]', num: true }],
      filas: tipo('puntual').map((c) => [num(c.a), num(c.P)]),
      onCambio: (f) => poner_('puntual', f.map((r) => ({ tipo: 'puntual', a: nv(r[0]), P: nv(r[1]) }))) }),
    q: () => rejilla({ id: 'v-distrib', altoMax: 90,
      columnas: [{ titulo: 'a [m]', num: true, validar: posicion }, { titulo: 'b [m]', num: true, validar: posicion },
        { titulo: `${'q'}<sub>1</sub> [kN/m]`, num: true }, { titulo: `q<sub>2</sub> [kN/m]`, num: true }],
      filas: tipo('distribuida').map((c) => [num(c.a), num(c.b), num(c.q1), num(c.q2)]),
      onCambio: (f) => poner_('distribuida', f.map((r) => ({ tipo: 'distribuida', a: nv(r[0]), b: nv(r[1]), q1: nv(r[2]), q2: nv(r[3]) }))) }),
    M: () => rejilla({ id: 'v-momento', altoMax: 90,
      columnas: [{ titulo: 'a [m]', num: true, validar: posicion }, { titulo: 'M [kN·m]', num: true }],
      filas: tipo('momento').map((c) => [num(c.a), num(c.C)]),
      onCambio: (f) => poner_('momento', f.map((r) => ({ tipo: 'momento', a: nv(r[0]), C: nv(r[1]) }))) }),
  };

  // Rigidez: sección elegida o valores libres
  const secs = p.secciones;
  const elegir = (v) => {
    if (v === '') { D.sec = null; return cambio(); }
    const s = secs.find((x) => x.nombre === v);
    try { Object.assign(D, { EI: rigidezSeccion(p, s), sec: v }); } catch (e) { ctx.avisar(tx(e)); return; }
    ctx.cambio({ estructura: true });
  };
  const apoyo = (k) => selector({ id: `v-${k}`, etq: t(`vig.${k}`), linea: true, opciones: APOYOS.map((a) => [a, t(`vig.ap.${a}`)]), valor: D[k], onCambio: (v) => { D[k] = v; ctx.cambio({ estructura: true }); } });

  poner(form, h('div', { class: 'vigas-datos' },
    h('div', { class: 'cab' }, h('h1', {}, t('menu.vigas1vano')), h('p', {}, t('vig.subtitulo'))),
    grupo(t('vig.viga'),
      campoNum({ id: 'v-L', etq: 'L [m]', nombre: 'L', sinUd: true, valor: D.L, mag: 'm', paso: 0.5, min: 0.05, max: 1000, onCambio: (v) => { D.L = v; cambio(); } }),
      par(apoyo('izq'), apoyo('der'))),
    grupo(t('vig.rigidez'),
      selector({ id: 'v-sec', etq: t('seccion'), linea: true, opciones: [['', t('vig.personalizada')], ...secs.map((s) => [s.nombre, s.nombre])], valor: D.sec ?? '', onCambio: elegir }),
      campoNum({ id: 'v-EI', etq: 'EI [kN·m²]', nombre: 'EI', sinUd: true, ayuda: t('vig.eiBruta'), valor: D.EI, mag: 'EI', paso: 1000, min: 1, max: 1e12, onCambio: (v) => {
        D.EI = v;
        // Sin repintar los datos (se perdería el foco al teclear): solo el selector pasa a «Personalizada»
        if (D.sec) { D.sec = null; const sel = document.getElementById('v-sec'); if (sel) sel.value = ''; }
        cambio();
      } })),
    grupo(t('vig.cargas'),
      h('p', { class: 'etq-rejilla compacta', html: t('vig.puntuales') }), rejillas.P(),
      h('p', { class: 'etq-rejilla compacta', html: t('vig.distribuidas') }), rejillas.q(),
      h('p', { class: 'etq-rejilla compacta', html: t('vig.momentos') }), rejillas.M())));
}

/* ---------- resultados ---------- */

const COLS = [['x', 'x [m]', 3, 1], ['M', 'M [kN·m]', MAG.M.d, 1], ['V', 'V [kN]', MAG.N.d, 1], ['flecha', 'δ [mm]', 1, 1000], ['giro', 'θ [mrad]', 1, 1000]];

export function resultados(ctx, res) {
  const p = ctx.p;
  const D = datosVigas(p);
  const r = analizarViga({ L: D.L, EI: D.EI, izq: D.izq, der: D.der, cargas: D.cargas });
  p.calculos.vigas1vano_resultado = { fecha: new Date().toISOString().slice(0, 10), EI: r.EI, reacciones: r.reacciones, maximos: r.maximos };
  // Mitad de la pantalla para el dibujo (esquema y las cuatro leyes, al tamaño real) y la otra mitad para la tabla
  const lienzo = h('div', { class: 'lienzo vigas-leyes' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'graf vl');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('vig.leyes'));
  lienzo.append(svg);
  const medida = () => [+svg.getAttribute('width') || lienzo.clientWidth, +svg.getAttribute('height') || lienzo.clientHeight];
  const pintar = () => { const W = lienzo.clientWidth, H = lienzo.clientHeight; if (W > 0 && H > 0) dibujarLeyes(svg, W, H, D, r); };
  if (typeof ResizeObserver === 'function') new ResizeObserver(pintar).observe(lienzo);
  requestAnimationFrame(pintar);

  const tecla = (txt, titulo, f) => h('button', { type: 'button', class: 'tecla', title: titulo, onclick: f }, txt);
  const barraDib = h('div', { class: 'graf-barra' },
    tecla(t('graf.copiar'), t('graf.copiarTit'), () => copiarPNG(svg, ...medida(), 'viga', ctx.avisar)),
    tecla('PNG', t('graf.guardarPNG'), () => guardar(svg, ...medida(), 'viga', 'png', ctx.avisar)),
    tecla('SVG', t('graf.guardarSVG'), () => guardar(svg, ...medida(), 'viga', 'svg', ctx.avisar)));

  // Tabla con todos los valores (se copia con el decimal del sistema, como las demás tablas)
  const tabla = h('div', { class: 'graf-tabla', html: `<table><thead><tr>${COLS.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${
    r.tabla.map((f) => `<tr>${COLS.map(([k, , d, m]) => `<td>${fmt(f[k] * m, d)}</td>`).join('')}</tr>`).join('')}</tbody></table>` });
  const copiarTabla = async () => {
    const num = (v) => (Number.isFinite(v) ? String(Math.abs(v) < 1e-6 ? 0 : +v.toPrecision(6)).replace('.', decimalAlCopiar()) : '');
    const lineas = [COLS.map((c) => c[1]).join('\t'), ...r.tabla.map((f) => COLS.map(([k, , , m]) => num(f[k] * m)).join('\t'))];
    try { await navigator.clipboard.writeText(lineas.join('\n')); ctx.avisar(t('graf.tablaCopiada')); } catch { ctx.avisar(t('graf.error')); }
  };
  const barraTabla = h('div', { class: 'graf-barra' }, tecla(t('graf.copiar'), t('graf.copiarTablaTit'), copiarTabla));
  res.append(h('div', { class: 'cuerpo mitad' },
    h('article', { class: 'panel tarjeta' }, barraDib, lienzo),
    h('article', { class: 'panel tarjeta' }, barraTabla, tabla)));
}
