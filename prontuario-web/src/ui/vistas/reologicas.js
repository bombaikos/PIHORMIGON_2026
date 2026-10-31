// Pantalla de Materiales · Propiedades reológicas: historia de deformaciones de un hormigón del proyecto bajo una
// historia de humedad y de incrementos de tensión, y coeficientes de fluencia φ(t, t0)
// (EHE-08 39.7 y 39.8, EC-2 2004 3.1.4 y anexo B, EC-2 2023 anexo B). Solo calcula: no cambia el proyecto.
// Datos a la izquierda (los mismos en las dos pestañas, nada aparece ni desaparece), figura y tabla a la derecha.

import { propiedadesHormigon, opcionesHormigon } from '../../core/materiales.js';
import { fluencia, historia, tablaFluencia, humedadEn } from '../../core/reologia.js';
import { normaMat } from '../../norma/materiales/index.js';
import { t } from '../i18n.js';
import { fmt, ESP } from '../formato.js';
import { h, poner, campoNum, selector, grupo, aviso, pestanas, tabla, segmentado, regleta } from '../campos.js';
import { rejilla } from '../rejilla.js';
import { grafica } from '../grafica.js';
import { botonCopiar } from '../designacion.js';

const TIEMPOS = [3, 7, 14, 28, 60, 90, 180, 360, 1000, 3650];
const filasPorDefecto = () => TIEMPOS.map((tt) => [String(tt), '60', '0']);
const inicial = () => ({ hormigon: null, cemento: null, Ac: 0.2, u: 2, h0: 200, ts: null, pestana: 'historia', logT: false, completa: false, t0: 28,
  filas: filasPorDefecto(), ver: { elastica: true, diferida: true, retraccion: true, total: true } });
const est = inicial();
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const U = (ud) => `${ESP}<span class="u u-cab">[${ud}]</span>`;

export function reiniciar() { Object.assign(est, inicial()); }

function hormigonActivo(ctx) {
  const L = ctx.p.hormigones;
  return L.find((x) => x.nombre === est.hormigon) ?? L[0] ?? null;
}

export function datos(ctx, form) {
  const L = ctx.p.hormigones;
  const m = hormigonActivo(ctx);
  const norma = ctx.p.norma;
  if (!m) return poner(form, aviso(t('rg.sinHormigon'), ''));
  const cem = est.cemento ?? m.cemento ?? 'N';
  const cambio = () => ctx.pintar();
  const h0 = () => { est.h0 = (2000 * est.Ac) / est.u; };
  poner(form,
    grupo(null,
      selector({ id: 'rg-hor', etq: t('hormigon'), opciones: L.map((x) => [x.nombre, x.nombre]), valor: m.nombre, onCambio: (v) => { est.hormigon = v; est.cemento = null; cambio(); } }),
      selector({ id: 'rg-cem', etq: t('mat.cemento'), opciones: ['S', 'N', 'R'].map((c) => [c, t(`mat.cem.${c}`)]), valor: cem, onCambio: (v) => { est.cemento = v; cambio(); } })),
    grupo(t('rg.ambiente'),
      campoNum({ id: 'rg-ac', etq: sub('A', 'c') + U('m²'), ayuda: t('rg.AcAyuda'), valor: est.Ac, paso: 0.05, min: 0.001, max: 100, onCambio: (v) => { est.Ac = v; h0(); cambio(); } }),
      campoNum({ id: 'rg-u', etq: 'u' + U('m'), ayuda: t('rg.uAyuda'), valor: est.u, paso: 0.1, min: 0.01, max: 1000, onCambio: (v) => { est.u = v; h0(); cambio(); } }),
      h('p', { class: 'sub', html: `${sub('h', '0')} = 2·${sub('A', 'c')}/u = ${fmt(est.h0, 0)}${ESP}mm` }),
      campoNum({ id: 'rg-ts', etq: sub('t', 's') + U(t('dias')), info: t('rg.tsAyuda'), valor: est.ts ?? 1, paso: 1, min: 0, max: 365, onCambio: (v) => { est.ts = v; cambio(); } })),
    grupo(t('rg.hHistoria'),
      rejilla({ id: 'rg-historia', altoMax: 340,
        columnas: [{ titulo: `t [${t('dias')}]`, num: true, validar: (v) => (+v > 0 ? null : t('rg.avTpos')) },
          { titulo: 'HR [%]', num: true, validar: (v) => (+v >= 20 && +v <= 100 ? null : t('rg.avHR')) },
          { titulo: `Δ${sub('σ', 'c')} [MPa]`, num: true }],
        filas: est.filas, onCambio: (f) => { est.filas = f.map((r) => [r[0], r[1], r[2]]); cambio(); } })));
}

const PESTANAS = () => [['historia', t('rg.historiaDef')], ['fluencia', t('rg.coefFluencia')]];
const logx = (a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => a * Math.pow(b / a, i / n));
const dias = (x) => fmt(x, x < 10 && x !== Math.round(x) ? 1 : 0);

/** Lee la tabla de historia: filas [t, HR, Δσ] con t creciente. */
function leerTabla() {
  const filas = est.filas.map((r) => r.map(Number));
  const ok = filas.length > 0 && filas.every((r) => r.every(Number.isFinite));
  const orden = ok && filas.every((r, i) => i === 0 || r[0] > filas[i - 1][0]);
  return { filas, ok, orden };
}

function entradas(ctx, m) {
  const norma = ctx.p.norma;
  const q = propiedadesHormigon(m.fck, norma, opcionesHormigon(m, norma));
  const cemento = est.cemento ?? m.cemento ?? 'N';
  const ts = est.ts ?? 1;
  return { norma, q, cemento, ts };
}

/** Datos para el núcleo: escalones de carga (Δσ ≠ 0), humedad y edades. */
function paraNucleo(m, E, filas) {
  const humedad = filas.map((r) => [r[0], r[1]]);
  const cargas = filas.filter((r) => r[2] !== 0).map((r) => [r[0], r[2]]);
  return { fck: m.fck, fcm: E.q.fcm, fctm: E.q.fctm, Ecm: E.q.Ec, Ec28: E.q.Ec28, cemento: E.cemento, h0: est.h0, ts: E.ts, cargas, humedad };
}

export function resultados(ctx, res) {
  const m = hormigonActivo(ctx);
  if (!m) return;
  const N = normaMat(ctx.p.norma);
  const E = entradas(ctx, m);
  const T = leerTabla();
  if (!T.ok) return poner(res, aviso(t('rg.avTabla'), 'error'));
  if (!T.orden) return poner(res, aviso(t('rg.avOrden'), 'error'));
  const base = paraNucleo(m, E, T.filas);
  const tiempos = T.filas.map((r) => r[0]);
  const tMin = tiempos[0];
  const tMax = tiempos.at(-1);

  const avisos = [];
  let acum = 0;
  for (const [t0, ds] of T.filas.map((r) => [r[0], r[2]])) {
    acum += ds;
    if (acum > 0.45 * E.q.fcm) { avisos.push(['', t('rg.avSigHist', dias(t0), fmt(acum, 1), fmt(0.45 * E.q.fcm, 1))]); break; }
    if (acum < 0) { avisos.push(['', t('rg.avTraccion', dias(t0))]); break; }
  }
  poner(res, ...avisos.map(([k, x]) => aviso(x, k)));

  const centro = h('article', { class: 'panel tarjeta' },
    pestanas({ lista: PESTANAS(), activa: est.pestana, onCambio: (k) => { est.pestana = k; ctx.pintar(); } }),
    h('p', { class: 'sub' }, `${m.nombre} · ${N.corto}`));
  const lg = (x) => (est.logT ? Math.log10(x) : x);
  const ejeX = (redibujar) => ({ titulo: est.logT ? 'log₁₀ t [días]' : 't [días]', d: est.logT ? 2 : 0, alternar: () => { est.logT = !est.logT; redibujar(); }, ayuda: t('rg.alternaEscala') });

  if (est.pestana === 'fluencia') {
    /* ---- Coeficiente de fluencia: tabla φ(t, t0) y φ(t) para un t0 con deslizador ---- */
    const PHI = tablaFluencia(E.norma, { ...base, humedad: base.humedad }, tiempos, tiempos);
    const cab = [`${sub('t', '0')}${ESP}\\${ESP}t`, ...tiempos.map((x) => dias(x))];
    const filasPhi = () => [cab.map((c) => String(c).replace(/\\/, '/')), ...PHI.map((f, i) => [dias(tiempos[i]), ...f.map((v) => (v === null ? '' : fmt(v, 2)))])];
    const tarjetaPhi = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('rg.resultados')), botonCopiar(filasPhi),
      h('p', { class: 'sub', html: `φ(t, ${sub('t', '0')}) · t ${t('rg.eje')} [${t('dias')}], ${sub('t', '0')} ${t('rg.eje2')} [${t('dias')}]` }),
      h('div', { class: 'edad' }, tabla(PHI.map((f, i) => [dias(tiempos[i]), ...f.map((v) => (v === null ? '–' : fmt(v, 2)))]), { cabecera: cab, clase: 'num excel' })));
    const phiMax = Math.max(...PHI.flat().filter((v) => v !== null));
    est.t0 = Math.min(Math.max(est.t0, tMin), tMax);
    const lienzo = h('div', { class: 'lienzo g32' });
    const dibuja = () => {
      const t0 = est.t0;
      const ts = est.logT ? logx(Math.min(t0 * 1.02, tMax), Math.max(tMax, t0 * 1.03), 60) : Array.from({ length: 61 }, (_, i) => t0 * 1.02 + ((Math.max(tMax, t0 * 1.03) - t0 * 1.02) * i) / 60);
      const xy = ts.map((tt) => [lg(tt), fluencia(E.norma, { fck: m.fck, HR: humedadEn(base.humedad, tt), h0: est.h0, t0, t: tt, cemento: E.cemento }).phi]);
      lienzo.replaceChildren(grafica({ series: [{ nombre: `t₀ = ${fmt(t0, 0)} d`, xy, clase: 's1' }], sinTabla: true, ejeX: ejeX(dibuja), ejeY: { titulo: 'φ(t, t₀)', d: 2, max: phiMax }, archivo: 'fluencia', avisar: ctx.avisar }));
    };
    const gauge = regleta({ etq: t('rg.t0Gauge'), min: tMin, max: tMax, valor: est.t0, texto: (v) => `${fmt(v, 0)} d`,
      onInput: (v) => { est.t0 = v; dibuja(); } });
    dibuja();
    poner(centro, h('h2', { html: `φ(t, ${sub('t', '0')})` }), lienzo, gauge);
    return poner(res, h('div', { class: 'cuerpo' }, centro, tarjetaPhi));
  }

  /* ---- Historia deformacional ---- */
  const saltos = base.cargas.flatMap(([t0]) => [t0, t0 - 0.001]);
  const mallaFig = [...logx(tMin, tMax, 90), ...tiempos, ...saltos].filter((x) => x >= tMin * 0.999).sort((a, b) => a - b);
  const mallaTabla = [...new Set([...logx(tMin, tMax, 40).map((x) => Math.round(x)), ...tiempos])].sort((a, b) => a - b);
  const H = (tt) => historia(E.norma, { ...base, tiempos: tt });
  const LINEAS = [['elastica', 'rg.elastica', 's2'], ['diferida', 'rg.diferida', 's3'], ['retraccion', 'rg.retraccion', 's4'], ['total', 'rg.total', 's1']];
  const lienzo = h('div', { class: 'lienzo g32' });
  const dibuja = () => {
    const G = H(mallaFig).map((g) => ({ ...g, secado: g.retraccion - g.autogena }));
    const ser = (k, nombre, clase) => ({ nombre, xy: G.map((g) => [lg(g.t), g[k] * 1000]), clase });
    const activas = LINEAS.filter(([k]) => est.ver[k]);
    const series = [];
    for (const [k, tx, cl] of activas) {
      series.push(ser(k, k === 'retraccion' && activas.length === 1 ? t('rg.retraccionTot') : t(tx), cl));
      // Con la retracción como única línea se ve también su parte autógena
      if (k === 'retraccion' && activas.length === 1) { series.push(ser('autogena', t('rg.autogena'), 's5'), ser('secado', t('rg.secado'), 's2')); }
    }
    if (!series.length) return lienzo.replaceChildren(h('p', { class: 'sub' }, t('rg.activaLinea')));
    lienzo.replaceChildren(grafica({ series, sinTabla: true, ejeX: ejeX(dibuja), ejeY: { titulo: 'ε [‰]', d: 3 }, archivo: 'historia-deformaciones', avisar: ctx.avisar }));
  };
  const muestra = (cl) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'graf ley-muestra'); s.setAttribute('width', '34'); s.setAttribute('height', '10');
    s.innerHTML = `<line class="serie ${cl}" x1="1" x2="33" y1="5" y2="5"/>`; return s; };
  const leyenda = h('div', { class: 'leyenda-v', role: 'group', 'aria-label': t('rg.lineas') },
    ...LINEAS.map(([k, tx, cl]) => h('label', { class: 'ley-item' },
      h('input', { type: 'checkbox', checked: est.ver[k], onchange: (e) => { est.ver[k] = e.target.checked; dibuja(); } }), muestra(cl), h('span', { html: t(tx) }))));
  dibuja();
  poner(centro, h('div', { class: 'fig-ley' }, lienzo, leyenda));

  const marco = h('div', { class: 'edad tabla-res' });
  let copia = [];
  const pintaTabla = () => {
    const R = H(est.completa ? mallaTabla : tiempos);
    const e = (x) => fmt(x * 1e6, 0);
    const cab = [`t<br><span class="u u-cab">[${t('dias')}]</span>`, `${sub('σ', 'c')}<br><span class="u u-cab">[MPa]</span>`,
      ...['el', 'dif', 'cs', 'tot'].map((k) => `${sub('ε', k)}<br><span class="u u-cab">[·10⁻⁶]</span>`)];
    copia = [['t [días]', 'σc [MPa]', 'εel [·10⁻⁶]', 'εdif [·10⁻⁶]', 'εcs [·10⁻⁶]', 'εtot [·10⁻⁶]'], ...R.map((g) => [dias(g.t), fmt(g.tension, 1), e(g.elastica), e(g.diferida), e(g.retraccion), e(g.total)])];
    marco.replaceChildren(tabla(R.map((g) => [dias(g.t), fmt(g.tension, 1), e(g.elastica), e(g.diferida), e(g.retraccion), e(g.total)]), { cabecera: cab, clase: 'num excel' }));
  };
  const tarjeta = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('rg.resultados')), h('p', { class: 'sub' }, t('rg.notaHistoria')), botonCopiar(() => copia),
    segmentado({ opciones: [[false, t('rg.resumida')], [true, t('rg.completa')]], valor: est.completa, etiqueta: t('rg.resultados'), ancho: true,
      onCambio: (v) => { est.completa = v; tarjeta.querySelectorAll('.seg button').forEach((b, i) => b.setAttribute('aria-checked', String((i === 1) === v))); pintaTabla(); } }),
    marco);
  pintaTabla();
  poner(res, h('div', { class: 'cuerpo' }, centro, tarjeta));
}
