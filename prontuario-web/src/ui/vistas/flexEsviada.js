// ELU · Flexión compuesta esviada: axil y flexión en dos direcciones (N, Mx, My) en rotura.
// La sección (geometría, armadura y materiales) viene de Secciones y aquí no se toca.
// Resultado: contorno de interacción Mx–My al axil N_Ed y coeficiente de seguridad a excentricidad constante,
// γ = |OQ| / |OP| (Q = corte del rayo O–P con el contorno). Comprobar, Dimensionar (factor de la armadura de
// Secciones) y Diagrama (varios pares N, Mx, My; un contorno por cada N distinto).
// Compresión positiva. Mx > 0 comprime la cara superior; My > 0 comprime la cara derecha. Motor: src/core/esviada.js.

import { cuantiaMinima } from '../../core/cuantiaMinima.js';
import { modeloEsviada, contornoMxMy, razonMxMy, coeficienteMxMy, dimensionarEsviada, axilesEsviada } from '../../core/esviada.js';
import { leerNumero } from '../../core/armado.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, MAG, ESP, serieDiametros, decimalAlCopiar } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, cifras, regleta, tabla } from '../campos.js';
import { grafica } from '../grafica.js';
import { rejilla } from '../rejilla.js';
import { DEFS, encuadre, capasSeccion } from '../dibujoSeccion.js';
import { veredicto } from './flexion.js';

// Como el Prontuario 3.1: rectangulares definidas por redondo (pilares) y genéricas
const FORMAS = ['pilar', 'generica'];
const est = {
  i: null, fi: null, modo: 'comprobar', NEd: 800, MxEd: 120, MyEd: 70, Ndiag: 500, puntos: [['120', '70'], ['-80', '110'], ['180', '-60'], ['40', '40'], ['', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']],
  abiertos: new Set(),
};
export function reiniciar() { est.i = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const nv = (txt) => leerNumero(txt);
/** Globo (i) dentro de una etiqueta de cifra. */
const info = (tx) => `<span class="info-i izq" tabindex="0" role="img" aria-label="${tx}" data-tip="${tx}">i</span>`;
const sigla = (g) => (g === Infinity ? '∞' : fmt(g, 2));
const TOLCONT = 72; // direcciones del contorno dibujado

/** Excentricidades mínimas [m] en y (para Mx) y en x (para My): EHE-08 42.2.1 máx{h/20; 2 cm}; EC-2 6.1(4) y EC-2 2023 8.1.1(5) máx{h/30; 20 mm}. */
export function eMinimas(norma, geo) {
  const div = norma === 'EHE-08' ? 20 : 30;
  return { y: Math.max(geo.h / div, 0.02), x: Math.max((geo.caja.xmax - geo.caja.xmin) / div, 0.02) };
}

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  return est.i >= 0 ? p.secciones[est.i] : null;
}

/** Diámetro común [mm] de las barras de la sección, o null si hay franjas por área o diámetros distintos. */
function fiComun(geo) {
  if (!geo.barras.length || geo.franjas.length) return null;
  const f = geo.barras.map((b) => b.fi);
  return f.every((x) => Math.abs(x - f[0]) < 1e-9) ? f[0] : null;
}

let emin = { x: 0, y: 0 };
/** Pares válidos (N, Mx, My) con su fila; con compresión, cada momento sube hasta N·e_mín de su dirección (se marca con *). */
function pares() {
  if (est.modo === 'diagrama') return [];
  const crudos = [{ i: 0, N: est.NEd, Mx: est.MxEd, My: est.MyEd }];
  return crudos.filter((x) => Number.isFinite(x.N) && Number.isFinite(x.Mx) && Number.isFinite(x.My)).map((x) => {
    if (!(x.N > 0)) return x;
    const sube = (M, e) => (Math.abs(M) < x.N * e - 1e-9 ? (M < 0 ? -1 : 1) * x.N * e : M);
    const Mx = sube(x.Mx, emin.y);
    const My = sube(x.My, emin.x);
    return Mx !== x.Mx || My !== x.My ? { ...x, Mx, My, subeM: true } : x;
  });
}

let memo = { clave: '', c: null };
function calculo(p, s) {
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  emin = eMinimas(p.norma, geo);
  const ps = pares();
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p), est.modo, est.fi, serieDiametros(), ps.map((x) => [x.N, x.Mx, x.My])]);
  if (memo.clave === clave) return memo.c;
  const mats = materialesSeccion(p, s);
  const m0 = modeloEsviada(geo, mats.hormigon, mats.acero);
  const As0 = m0.As;
  const phi0 = fiComun(geo);
  // Cuantía mínima de pilar (EHE-08 42.3.3; EC-2 9.5.2(2)): máx{0,10·N/fyd; cuantía geométrica}, con el mayor N_Ed
  const cm = cuantiaMinima({ norma: p.norma, tipo: 'pilar', h: 0, Ac: m0.Ac, yg: 0, Ix: 0, fctm: 0, fyk: mats.acero.fk, gammaS: mats.acero.gamma, N: Math.max(0, ...ps.map((x) => x.N)) });
  const Amin = cm.A;
  const kMin = As0 > 0 ? Amin / As0 : 0;
  let k = 1;
  let kEstricto = 1;
  let phiEstricto = null;
  let phiProp = null;
  if (est.modo === 'dimensionar') {
    if (!(As0 > 0)) throw new Error(t('fcr.sinArmadura'));
    const x = ps[0];
    kEstricto = x ? dimensionarEsviada(geo, mats.hormigon, mats.acero, x.N, x.Mx, x.My) : 1;
    k = Number.isFinite(kEstricto) ? Math.max(kEstricto, kMin) : kEstricto;
    if (phi0 && Number.isFinite(k)) {
      phiEstricto = kEstricto > 0 ? phi0 * Math.sqrt(kEstricto) : 0;
      phiProp = serieDiametros().find((v) => v >= phi0 * Math.sqrt(k) - 1e-9) ?? null;
      if (phiProp) k = (phiProp / phi0) ** 2;
    }
  } else if (phi0 && est.fi > 0) k = (est.fi / phi0) ** 2;
  const m = modeloEsviada(geo, mats.hormigon, mats.acero, Number.isFinite(k) ? k : 1);
  const c = { geo, mats, m, ps, As0, Amin, cm, k, kEstricto, phi0, phiEstricto, phiProp, lim: axilesEsviada(m), cont: new Map() };
  memo = { clave, c };
  return c;
}

/** Contorno a un axil (con memoria dentro del cálculo). */
function contornoA(c, N) {
  const clave = fmt(N, 6);
  if (!c.cont.has(clave)) c.cont.set(clave, contornoMxMy(c.m, N, { n: TOLCONT }));
  return c.cont.get(clave);
}

export function datos(ctx, form) {
  const p = ctx.p;
  const s = activa(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.flexEsviada')), h('p', {}, t('fce.subtitulo'))));
  if (!s) return poner(form, aviso(t('fcr.sinSec'), 'info'));
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; est.fi = null; ctx.pintar(); }
  } }));
  const cambio = () => ctx.cambio();
  let c = null;
  try { c = calculo(p, s); } catch { /* el error se muestra en resultados */ }
  const campoFi = () => {
    if (est.modo === 'dimensionar' || !c?.phi0) return null;
    const serie = [...new Set([...serieDiametros(), c.phi0])].sort((x, y) => x - y);
    return selector({ id: 'fe-fi', etq: 'ø [mm]', linea: true, opciones: serie.map((x) => [x, fmt(x, 0)]), valor: est.fi ?? c.phi0, onCambio: (v) => { est.fi = Number(v); cambio(); } });
  };
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('flex.v.comprobar')], ['dimensionar', t('flex.v.dimensionar')], ['diagrama', t('fcr.modoDiagrama')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    est.modo !== 'diagrama' ? grupo(t('g.esfuerzo'),
      campoNum({ id: 'fe-n', etq: sub('N', 'Ed'), ref: t('fcr.compPos'), valor: est.NEd, mag: 'N', paso: 10, min: -1e6, max: 1e6, nombre: t('fcr.axil'), onCambio: (v) => { est.NEd = v; cambio(); } }),
      campoNum({ id: 'fe-mx', etq: sub('M', 'x,Ed'), ref: t('fce.mx'), valor: est.MxEd, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('fce.nombreMx'), info: t('fce.infoMx'), onCambio: (v) => { est.MxEd = v; cambio(); } }),
      campoNum({ id: 'fe-my', etq: sub('M', 'y,Ed'), ref: t('fce.my'), valor: est.MyEd, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('fce.nombreMy'), info: t('fce.infoMy'), onCambio: (v) => { est.MyEd = v; cambio(); } }),
      campoFi()) : grupo(t('fce.puntos'),
      rejilla({ id: 'fe-pts', altoMax: 330,
        columnas: [{ titulo: `${sub('M', 'x,Ed')} [kN·m]`, num: true }, { titulo: `${sub('M', 'y,Ed')} [kN·m]`, num: true }],
        filas: est.puntos, onCambio: (f) => { est.puntos = Array.from({ length: Math.max(10, f.length) }, (_, i) => [f[i]?.[0] ?? '', f[i]?.[1] ?? '']); cambio(); } }),
      campoFi()));
}

export function resultados(ctx, res) {
  resultadosEsviada(ctx, res);
  rotulaSeccion(res, activa(ctx.p)?.nombre);
}

function resultadosEsviada(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const c = calculo(p, s);
  const { m, ps } = c;
  if (est.modo === 'diagrama') return res.append(panelDiagrama(ctx, { s, c }));
  if (!ps.length) throw new Error(t('fce.sinEsfuerzos'));
  const gam = ps.map((x) => {
    const r = razonMxMy(m, x.N, x.Mx, x.My);
    return { ...x, g: Number.isFinite(r.ratio) ? (r.ratio > 0 ? 1 / r.ratio : Infinity) : 0, Q: r.Q, e: r.e };
  });
  const gmin = Math.min(...gam.map((x) => x.g));
  const dim = est.modo === 'dimensionar';
  p.calculos.flexionEsviada ??= {};
  p.calculos.flexionEsviada[s.nombre] = { modo: est.modo, esfuerzos: ps.map((x) => [x.N, x.Mx, x.My]), norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { gammaMin: gmin, k: c.k } };

  if (dim && !Number.isFinite(c.k)) {
    res.append(veredicto('nocumple', t('aumentar'), t('armaduraNec'), '—', t('fcr.noBasta')));
  } else if (dim) {
    const As = c.As0 * c.k;
    if (c.phiProp) {
      res.append(veredicto('cumple', t('valida'), t('fcr.fiProp'), `ø${fmt(c.phiProp, 0)}<span class="u"> mm</span>`,
        t('fcr.fiArm', c.phiEstricto > 0 ? fmt(c.phiEstricto, 1) : '—', q(As, 'As'), q(c.As0 * c.kEstricto, 'As'), '1,00')));
    } else {
      res.append(veredicto(c.k === 0 ? 'atencion' : 'cumple', c.k === 0 ? t('fcr.sinArm') : t('valida'), t('armaduraNec'), qh(As, 'As'),
        t('fcr.kArm', fmt(c.k, 2), q(c.As0, 'As'), '1,00')));
    }
  } else {
    const ok = gmin >= 1 - 1e-6;
    res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('cumple') : t('noCumple'), 'γ = |OQ|/|OP|', sigla(gmin),
      `${sub('N', 'Ed')} <b>${q(gam[0].N, 'N')}</b> · ${sub('M', 'x,Ed')} <b>${q(gam[0].Mx, 'M')}</b> · ${sub('M', 'y,Ed')} <b>${q(gam[0].My, 'M')}</b>`, Math.min(1 / Math.max(gmin, 1e-9) / 1.25, 1)));
  }

  const Asd = c.As0 * c.k;
  if (Asd + 1e-12 < c.Amin) res.append(aviso(t('fcr.bajoMin', q(Asd, 'As'), q(c.Amin, 'As'))));
  else if (dim && c.As0 * c.kEstricto + 1e-12 < c.Amin) res.append(aviso(t('fcr.mandaMin', q(c.Amin, 'As')), 'info'));
  if (gam.some((x) => x.subeM)) res.append(aviso(t('fce.subeEmin', fmt(emin.x * 1000, 0), fmt(emin.y * 1000, 0)), 'info'));
  if (gam.some((x) => x.N > c.lim.Ncomp + 1e-9 || x.N < c.lim.Ntrac - 1e-9)) res.append(aviso(t('fce.fueraAxil', `${q(c.lim.Ntrac, 'N')} … ${q(c.lim.Ncomp, 'N')}`)));
  return resultadoUnico(ctx, res, { s, c, gam: gam[0], gmin, dim });
}

/** Contornos Mx–My (x = My, y = Mx, la cara comprimida cae del lado del signo): uno por cada axil distinto, con los esfuerzos. */
function graficoMxMy(ctx, c, gam, s) {
  const axiles = [];
  for (const x of gam) if (!axiles.some((a) => Math.abs(a - x.N) < 1e-9)) axiles.push(x.N);
  const clases = ['s1', 's2', 's3', 's4'];
  const series = axiles.slice(0, 4).map((N, i) => {
    const cont = contornoA(c, N);
    return { nombre: t('fce.serieN', fmt(N, MAG.N.d)), clase: clases[i], xy: cont.length ? [...cont, cont[0]].map((v) => [v.My, v.Mx]) : [] };
  });
  // En un solo par, la recta de O a Q (cuánto falta o sobra)
  if (gam.length === 1 && gam[0].Q) series.push({ nombre: t('fce.rayo'), clase: 'ref', cruz: false, xy: [[0, 0], [gam[0].Q[1], gam[0].Q[0]]] });
  const puntos = gam.map((x) => ({ x: x.My, y: x.Mx, etq: String(x.i + 1), marca: x.g >= 1 - 1e-6 ? 'ok' : 'no' }));
  // Q: corte de la recta O–P con el contorno; sus coordenadas son M_Rd,y y M_Rd,x
  if (gam.length === 1 && gam[0].Q) puntos.push({ x: gam[0].Q[1], y: gam[0].Q[0], etq: 'Q', marca: 'neutro' });
  return h('div', { class: 'lienzo' }, grafica({
    series, puntos, escalaIgual: true,
    ejeX: { titulo: t('fce.ejeX'), d: MAG.M.d, dt: MAG.M.d },
    ejeY: { titulo: t('fce.ejeY'), d: MAG.M.d, dt: MAG.M.d },
    archivo: `Mx-My ${s.nombre}`,
    avisar: ctx.avisar,
  }));
}

/** Título de los gráficos: la acción (N, y Mx y My si los hay), el ø de la armadura y la sección. */
function tituloGraf(c, s, { N, Mx, My }) {
  const partes = [`${sub('N', 'Ed')} = ${fmt(N, MAG.N.d)} ${MAG.N.ud}`];
  if (Mx !== undefined) partes.push(`${sub('M', 'x,Ed')} = ${fmt(Mx, MAG.M.d)} ${MAG.M.ud}`, `${sub('M', 'y,Ed')} = ${fmt(My, MAG.M.d)} ${MAG.M.ud}`);
  if (c.phi0) partes.push(`ø${fmt(c.phiProp ?? est.fi ?? c.phi0, 0)} mm`);
  return `${t('fce.contorno')} · ${partes.join(' · ')}`;
}

/** Tabla de puntos con su γ y botón «Copiar tabla» (guía: más de 4 filas). */
function tablaPuntos(ctx, pts) {
  const dec = decimalAlCopiar();
  const cab = ['#', 'Mx,Ed [kN·m]', 'My,Ed [kN·m]', 'γ [-]'];
  const num = (x, d) => fmt(x, d).replace('−', '-').replace('.', dec);
  const filas = pts.map((x) => [String(x.i + 1), num(x.Mx, MAG.M.d), num(x.My, MAG.M.d), x.g === Infinity ? '∞' : num(x.g, 2)]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText([cab.join('\t'), ...filas.map((f) => f.join('\t'))].join('\r\n')); ctx.avisar(t('graf.tablaCopiada')); } catch { ctx.avisar(t('graf.error')); }
  };
  return h('div', { class: 'fce-tabla' },
    h('button', { type: 'button', class: 'tecla', title: t('graf.copiarTablaTit'), onclick: copiar }, t('fce.copiarTabla')),
    tabla(pts.map((x) => [String(x.i + 1), fmt(x.Mx, MAG.M.d), fmt(x.My, MAG.M.d), sigla(x.g),
      `<span class="${x.g >= 1 - 1e-6 ? 'ok' : 'no'}">${x.g >= 1 - 1e-6 ? t('fce.si') : t('fce.no')}</span>`]),
    { cabecera: ['#', `${sub('M', 'x,Ed')} [kN·m]`, `${sub('M', 'y,Ed')} [kN·m]`, 'γ [-]', t('fcr.dentroSello')], clase: 'rejilla' }));
}

/** Momentos mayores del contorno entre todos los axiles (muestreo): los ejes del diagrama no se mueven con la regleta. */
function rangoFijo(c) {
  if (!c.rango) {
    const { Ntrac, Ncomp } = c.lim;
    let mx = 0;
    let my = 0;
    for (let i = 1; i < 24; i++) {
      for (const v of contornoMxMy(c.m, Ntrac + ((Ncomp - Ntrac) * i) / 24, { n: 24 })) { mx = Math.max(mx, Math.abs(v.Mx)); my = Math.max(my, Math.abs(v.My)); }
    }
    const a = 1.08 * Math.max(mx, my, 1);
    c.rango = { x0: -a, x1: a, y0: -a, y1: a };
  }
  return c.rango;
}

/** Modo Diagrama (como el del Prontuario 3.1): contorno Mx–My para un axil constante que se mueve con una regleta;
 *  en tracción (N < 0) el contorno y la regleta van en rosa, en compresión en azul. */
function panelDiagrama(ctx, { s, c }) {
  const { lim } = c;
  const lo = Math.ceil(lim.Ntrac);
  const hi = Math.floor(lim.Ncomp) - 1;
  est.Ndiag = Math.min(Math.max(est.Ndiag, lo), hi);
  const caja = h('div', { class: 'fcr-graf' });
  const lado = h('aside', { class: 'fcr-lado' });
  const titulo = h('h2', {});
  let rg = null;
  const dibujar = (N, n) => {
    const cont = contornoMxMy(c.m, N, { n });
    const pts = est.puntos.map((f, i) => ({ i, Mx: nv(f[0]), My: nv(f[1]) })).filter((x) => Number.isFinite(x.Mx) && Number.isFinite(x.My))
      .map((x) => ({ ...x, g: coeficienteMxMy(c.m, N, x.Mx, x.My) }));
    const trac = N < 0;
    const xy = cont.length ? [...cont, cont[0]].map((v) => [v.My, v.Mx]) : [];
    const g = h('div', { class: 'lienzo' }, grafica({
      series: [{ nombre: t('fce.serieN', fmt(N, MAG.N.d)), clase: `s1${trac ? ' trac' : ''}`, xy }], escalaIgual: true, rango: rangoFijo(c),
      puntos: pts.map((x) => ({ x: x.My, y: x.Mx, etq: String(x.i + 1), marca: x.g >= 1 - 1e-6 ? 'ok' : 'no' })),
      ejeX: { titulo: t('fce.ejeX'), d: MAG.M.d, dt: MAG.M.d }, ejeY: { titulo: t('fce.ejeY'), d: MAG.M.d, dt: MAG.M.d },
      archivo: `Mx-My ${s.nombre} N=${fmt(N, 0)}`, avisar: ctx.avisar,
    }));
    const ext = (f, mx) => (cont.length ? (mx ? Math.max : Math.min)(...cont.map(f)) : NaN);
    lado.replaceChildren(
      h('div', { class: 'fcr-sec', html: dibujoSeccionPeq(c.geo, s) }),
      cifras([[sub('M', 'x,Rd,máx'), qh(ext((v) => v.Mx, true), 'M')], [sub('M', 'x,Rd,mín'), qh(ext((v) => v.Mx, false), 'M')],
        [sub('M', 'y,Rd,máx'), qh(ext((v) => v.My, true), 'M')], [sub('M', 'y,Rd,mín'), qh(ext((v) => v.My, false), 'M')],
        [sub('N', 'Rd'), qh(lim.Ncomp, 'N')], [sub('N', 'Rd,t'), qh(lim.Ntrac, 'N')]]),
      pts.length ? tablaPuntos(ctx, pts) : null);
    titulo.innerHTML = tituloGraf(c, s, { N });
    if (rg) rg.classList.toggle('trac', trac);
    return g;
  };
  let graf = dibujar(est.Ndiag, TOLCONT);
  caja.append(graf);
  const z = ((0 - lo) / (hi - lo)) * 100;
  rg = regleta({ etq: sub('N', ''), min: lo, max: hi, step: 1, valor: est.Ndiag, etiqueta: t('fcr.axil'),
    texto: (N) => `${fmt(N, MAG.N.d)} ${MAG.N.ud}`, clase: `rg-dual${est.Ndiag < 0 ? ' trac' : ''}`,
    onInput: (N) => { est.Ndiag = N; const g = dibujar(N, 36); graf.replaceWith(g); graf = g; },
    onChange: (N) => { est.Ndiag = N; const g = dibujar(N, TOLCONT); graf.replaceWith(g); graf = g; ctx.cambio(); } });
  rg.style.setProperty('--z', `${z}%`);
  // Números pequeños bajo la regleta: tracción máxima, cero y compresión máxima
  const escala = h('div', { class: 'regleta escala' }, h('span', { class: 'rg-et', html: sub('N', ''), style: 'visibility:hidden' }),
    h('div', { class: 'rg-num' }, h('span', { style: 'left:0' }, fmt(lo, 0)), h('span', { style: `left:${z}%;transform:translateX(-50%)` }, '0'), h('span', { style: 'right:0' }, fmt(hi, 0))), h('span', { class: 'rg-v' }));
  caja.append(rg, escala);
  return h('article', { class: 'panel tarjeta' }, titulo,
    h('div', { class: 'fcr-diag' }, caja, lado));
}

/** Sección pequeña, solo contorno y barras con sus cotas. */
function dibujoSeccionPeq(geo, s) {
  const e = encuadre(geo, 150, 150, { completa: true });
  const x0 = 46;
  const y0 = 10;
  const { svg, hp, bp } = capasSeccion(geo, s, { e, x0, y0, x: null, id: 'fces', cotasCapas: false });
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${x0 + bp + 30} ${y0 + hp + 46}" role="img" aria-label="${t('g.seccion')}">${DEFS}${svg}</svg>`;
}


/** Recorta un polígono por el semiplano {p : u·p ≥ c} (Sutherland–Hodgman). */
function recortar(pts, ux, uy, cte) {
  const out = [];
  const f = (p) => ux * p[0] + uy * p[1] - cte;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])]); }
  }
  return out;
}

/** Sección con la zona comprimida y el eje neutro del estado último en Q. */
function dibujoPlano(c, s, e) {
  const { geo, m } = c;
  const em = encuadre(geo, 220, 220, { completa: true });
  const x0 = 46;
  const y0 = 14;
  const { svg, hp, bp } = capasSeccion(geo, s, { e: em, x0, y0, x: null, id: 'fe', cotasCapas: false });
  const X = (xm) => x0 + (xm - em.x0m) * em.s;
  const Y = (ym) => y0 + (ym - geo.caja.ymin) * em.s;
  const ux = Math.cos(e.theta);
  const uy = Math.sin(e.theta);
  const smax = Math.max(...geo.contornos[0].pts.map((p) => ux * p[0] + uy * p[1]));
  const out = [DEFS, svg];
  const corte = smax - e.x; // u·p = corte en el eje neutro
  if (e.x > 0 && Number.isFinite(e.x)) {
    const zona = geo.contornos.filter((k) => k.signo > 0).map((k) => recortar(k.pts, ux, uy, corte)).filter((r) => r.length > 2);
    for (const r of zona) out.push(`<polygon class="zc" points="${r.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/>`);
    // Recta neutra: perpendicular a u, por el punto u·p = corte
    const gx = (geo.caja.xmin + geo.caja.xmax) / 2;
    const gy = (geo.caja.ymin + geo.caja.ymax) / 2;
    const d0 = corte - (ux * gx + uy * gy);
    const px = gx + ux * d0;
    const py = gy + uy * d0;
    const L = Math.hypot(geo.caja.xmax - geo.caja.xmin, geo.caja.ymax - geo.caja.ymin);
    out.push(`<clipPath id="fe-vb"><rect x="${x0 - 10}" y="${y0 - 10}" width="${bp + 20}" height="${hp + 20}"/></clipPath>`);
    out.push(`<line class="en" clip-path="url(#fe-vb)" x1="${X(px + uy * L)}" y1="${Y(py - ux * L)}" x2="${X(px - uy * L)}" y2="${Y(py + ux * L)}"/>`);
  }
  // β: ángulo de la recta neutra con la horizontal, acotado en la figura (positivo si baja hacia la derecha)
  if (e.x > 0 && Number.isFinite(e.x)) {
    const b = alfa(e.theta);
    const gx = (geo.caja.xmin + geo.caja.xmax) / 2;
    const gy = (geo.caja.ymin + geo.caja.ymax) / 2;
    const d0 = corte - (ux * gx + uy * gy);
    const ax = X(gx + ux * d0);
    const ay = Y(gy + uy * d0);
    const r = Math.min(hp, bp) * 0.22;
    const rad = (b * Math.PI) / 180;
    out.push(`<line class="ref" x1="${ax - r * 1.3}" y1="${ay}" x2="${ax + r * 1.3}" y2="${ay}" stroke-dasharray="3 3"/>`);
    out.push(`<path class="cota" d="M${ax + r} ${ay} A${r} ${r} 0 0 ${b >= 0 ? 1 : 0} ${ax + r * Math.cos(rad)} ${ay + r * Math.sin(rad)}"/>`);
    out.push(`<text x="${ax + r * 0.5}" y="${ay + (b >= 0 ? -5 : 14)}">β</text>`);
  }
  // x: profundidad de la fibra neutra, medida perpendicularmente a la recta neutra desde la fibra más comprimida
  if (e.x > 0 && Number.isFinite(e.x)) {
    const ext = geo.contornos[0].pts.reduce((m, v) => (ux * v[0] + uy * v[1] > ux * m[0] + uy * m[1] ? v : m));
    const x1 = X(ext[0]);
    const y1 = Y(ext[1]);
    const x2 = x1 - ux * e.x * em.s;
    const y2 = y1 - uy * e.x * em.s;
    out.push(`<line class="cota" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#tic)" marker-end="url(#tic)"/>`);
    out.push(`<text class="fuerte" x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 4}">x</text>`);
  }
  // Flecha hacia la cara comprimida, desde el c.d.g.
  const flecha = Math.min(hp, bp) * 0.28;
  out.push(`<line class="flecha" x1="${X(m.xc)}" y1="${Y(m.yc)}" x2="${X(m.xc) + ux * flecha}" y2="${Y(m.yc) + uy * flecha}" marker-end="url(#pta)"/>`);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${x0 + bp + 30} ${y0 + hp + 46}" role="img" aria-label="${t('fce.dibujoAria')}">${out.join('')}</svg>`;
}

function traza(p, c, gmin, e) {
  const fam = NORMAS[p.norma];
  const art = (a, b, cc) => `<span class="art">${fam.ref} · ${p.norma === 'EC2-2004' ? cc ?? b : fam.familia === 'EHE' ? a : b}</span>`;
  const filas = [
    { id: 'coef', nom: t('fcr.coefSeg'), val: sigla(gmin), cuenta: `<span class="f">${t('fce.f.coef')}</span>` },
    { id: 'cont', nom: t('fce.contorno'), val: t('fce.contornos', fmt(TOLCONT, 0)), cuenta: `<span class="f">${t('fce.f.contorno')}</span>
      <span class="n">${t('fce.f.ref', q(c.m.xc, 'long'), q(c.m.yc, 'long'))}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'nrd', nom: sub('N', 'Rd'), val: q(c.lim.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.nrd')}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
  ];
  return h('div', { class: 'traza' }, ...filas.map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  }));
}

/** Ángulo de la recta neutra con la horizontal, en (−90°, 90°]: la recta es perpendicular a u = (cos θ, sin θ). */
function alfa(theta) {
  let a = ((theta * 180) / Math.PI + 90) % 180; // dirección de la recta
  if (a > 90) a -= 180;
  if (a <= -90) a += 180;
  return a;
}

export function comandos(ctx) {
  return [
    { k: 'p.fceComprobar', b: 'flexion compuesta esviada comprobar biaxial interaccion', f: () => { est.modo = 'comprobar'; ctx.ir('flexEsviada'); } },
    { k: 'p.fceDimensionar', b: 'flexion compuesta esviada dimensionar biaxial interaccion', f: () => { est.modo = 'dimensionar'; ctx.ir('flexEsviada'); } },
  ];
}

/** Comprobar y Dimensionar con un solo par: sección con el plano de rotura, contorno Mx–My y cifras. */
function resultadoUnico(ctx, res, { s, c, gam, gmin, dim }) {
  const e = gam.e;
  const mm = (x, d) => `${fmt(x, d)}<span class="u"> mm</span>`;
  const cif = [
    ...(gam.Q ? [[sub('M', 'Rd,x') + info(t('fce.infoMrd')), qh(gam.Q[0], 'M')], [sub('M', 'Rd,y') + info(t('fce.infoMrd')), qh(gam.Q[1], 'M')]] : []),
    ...(e ? [[t('c.x'), Number.isFinite(e.x) && e.x > 0 ? qh(e.x, 'long') : '—'], ['β' + info(t('fce.infoBeta')), `${fmt(alfa(e.theta), 1)}<span class="u">${ESP}°</span>`], [sub('ε', 'c'), qh(-e.epsSup, 'def')]] : []),
    ...cifrasArmadura(c, dim, mm),
  ];
  // Como en Diagrama: contorno grande y, a un lado, la sección con el plano de rotura (tamaño acotado), las cifras y la traza
  const lado = h('aside', { class: 'fcr-lado' }, h('div', { class: 'fcr-sec', html: e ? dibujoPlano(c, s, e) : '' }), cifras(cif), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(ctx.p, c, gmin, e));
  res.append(h('article', { class: 'panel tarjeta' }, h('h2', { html: tituloGraf(c, s, { N: gam.N, Mx: gam.Mx, My: gam.My }) }),
    h('div', { class: 'fcr-diag' }, h('div', { class: 'fcr-graf' }, graficoMxMy(ctx, c, [gam], s)), lado)));
}

/** Cifras de la armadura: ø de cálculo, o en Dimensionar ø estricto y propuesto con sus áreas. */
function cifrasArmadura(c, dim, mm) {
  if (dim && c.phiProp) {
    return [[`ø ${t('fcr.estricto')}`, c.phiEstricto > 0 ? mm(c.phiEstricto, 1) : '—'], [`ø ${t('fcr.propuesto')}`, mm(c.phiProp, 0)],
      [`${sub('A', 's')} ${t('fcr.estricto')}`, qh(c.As0 * c.kEstricto, 'As')], [`${sub('A', 's')} ${t('fcr.propuesto')}`, qh(c.As0 * c.k, 'As')]];
  }
  if (dim && Number.isFinite(c.k)) return [[sub('A', 's,req'), qh(c.As0 * c.k, 'As')], ['k', fmt(c.k, 2)]];
  return [[sub('A', 's'), qh(c.As0 * c.k, 'As')], [sub('A', 's,mín'), qh(c.Amin, 'As')]];
}
