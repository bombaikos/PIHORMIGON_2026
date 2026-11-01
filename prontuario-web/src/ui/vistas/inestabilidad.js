// ELU · Inestabilidad de soportes: soporte aislado con efectos de segundo orden.
// Es la Flexión compuesta recta (N–M en rotura) más los datos propios del segundo orden: longitud de pandeo a partir de
// los extremos (rigidez de soportes y vigas), esbeltez, fluencia simplificada y momento de cálculo amplificado.
// El diagrama es el de la Flexión compuesta recta; los efectos de segundo orden salen como una REDUCCIÓN del contorno
// (a cada axil se le resta el momento de segundo orden que le corresponde). La sección viene de Secciones.
// Norma: EHE-08 art. 43 (43.5.1), EC-2 2004+AN 5.8 (curvatura nominal) y EC-2 2023 7.4 / Anexo O (curvatura nominal).
// Núcleo: src/norma/inestabilidad.js y src/core/pandeo.js. Compresión positiva; unidades internas m, kN.

import { cuantiaMinima } from '../../core/cuantiaMinima.js';
import { diagramaNM, coeficienteNM, momentoEn, escalarArmadura, soloHormigon } from '../../core/interaccion.js';
import { estadoUltimo } from '../../core/seccion.js';
import { seccionMotor } from '../../core/geometria.js';
import { bruta } from '../../core/propiedades.js';
import { propiedadesHormigon, propiedadesAcero, opcionesHormigon, opcionesAcero } from '../../core/materiales.js';
import { psiExtremo, armaduraEnPlano } from '../../core/pandeo.js';
import { calcularInestabilidad, contornoReducido, excentricidadMinima } from '../../norma/inestabilidad.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, MAG, serieDiametros } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { h, poner, campoNum, segmentado, grupo, aviso, cifras, pestanas, apilado, filaCampos } from '../campos.js';
import { grafica } from '../grafica.js';
import { capasSeccion, encuadre, DEFS, topeEscala } from '../dibujoSeccion.js';
import { veredicto } from './flexion.js';
import { dibujoRotura, dibujoSeccionPeq, fiComun } from './flexRecta.js';

const FORMAS = ['pilar', 'circular'];
const TOL = 2e-5;
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;
const sigla = (g) => (g === Infinity ? '∞' : fmt(g, 2));
const est = { i: null, modo: 'comprobar', pagina: 'soporte', lado: 'res', abiertos: new Set() };
export function reiniciar() { est.i = null; }

const VIGA = (L = 0.0) => ({ b: 0.3, h: 0.5, L });
const EXTREMO = (tipo) => ({ tipo, pilar: { b: 0.4, h: 0.4, L: 3 }, vigas: [VIGA(6), VIGA(6)] });
const INICIAL = () => ({ L: 6, trasl: false, N: 800, MA: 20, MB: 40, phiInf: 2, perm: 0.6, fp: 0.7, fv: 0.3, A: EXTREMO('empotrado'), B: EXTREMO('nudo') });

/** Datos de la pantalla; se guardan con el proyecto. */
function datosDe(p) {
  const D = (p.calculos.inestabilidad ??= {});
  const base = INICIAL();
  for (const [k, v] of Object.entries(base)) if (D[k] === undefined) D[k] = v;
  for (const k of ['A', 'B']) D[k] = { ...base[k], ...D[k], pilar: { ...base[k].pilar, ...D[k].pilar }, vigas: [0, 1].map((j) => ({ ...base[k].vigas[j], ...D[k].vigas?.[j] })) };
  return D;
}

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  return est.i >= 0 ? p.secciones[est.i] : null;
}

/** Entrada del núcleo de cálculo y datos de la sección; en Dimensionar, con la armadura multiplicada por k. */
function preparar(p, s, D) {
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  const mats = materialesSeccion(p, s);
  const ph = propiedadesHormigon(mats.fichaH.fck, p.norma, opcionesHormigon(mats.fichaH, p.norma));
  const pa = propiedadesAcero(mats.fichaA.fyk, p.norma, opcionesAcero(mats.fichaA));
  const br = bruta(geo);
  const barras = [...geo.barras.map((b) => ({ y: b.y - geo.caja.ymin, A: b.A })), ...geo.franjas.map((f) => ({ y: f.y - geo.caja.ymin, A: f.A }))];
  const ar = armaduraEnPlano(barras, geo.h);
  const sec = seccionMotor(geo, mats.hormigonCalc, mats.acero);
  const psi = (ext) => psiExtremo(ext, { Ic: br.Ix, L: D.L, fp: D.fp, fv: D.fv });
  const entrada = (k = 1) => ({
    norma: p.norma, L: D.L, traslacional: D.trasl, psiA: psi(D.A), psiB: psi(D.B), forma: s.forma,
    h: geo.h, A: br.A, I: br.Ix, As: ar.As * k, is: ar.is, dd: ar.dd,
    fck: mats.fichaH.fck, fcd: ph.fcd * 1000, fyd: pa.fyd * 1000, Es: pa.Es * 1000,
    N: D.N, M1: D.MA, M2: D.MB, phiInf: D.phiInf, pPerm: D.perm,
  });
  return { geo, mats, br, ar, sec, entrada, psiA: psi(D.A), psiB: psi(D.B), emin: excentricidadMinima(p.norma, geo.h) };
}

let memo = { clave: '', c: null };
/** Contornos y resultados del soporte (la armadura de Secciones, o en Dimensionar la escalada para γ ≥ 1). */
function calculo(p, s, D) {
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p), D, est.modo, serieDiametros()]);
  if (memo.clave === clave) return memo.c;
  const c0 = preparar(p, s, D);
  const { sec, entrada } = c0;
  const As0 = sec.barras.reduce((a, b) => a + b.A, 0);
  const phi0 = fiComun(c0.geo);
  const Ac = c0.br.A;
  const cm = cuantiaMinima({ norma: p.norma, tipo: 'pilar', h: 0, Ac, yg: 0, Ix: 0, fctm: 0, fyk: c0.mats.acero.fk, gammaS: c0.mats.acero.gamma, N: Math.max(0, D.N) });
  const kMin = As0 > 0 ? cm.A / As0 : 0;
  const gammaDe = (k) => {
    const r = calcularInestabilidad(entrada(k));
    if (!r.valido || !Number.isFinite(r.MEd)) return { r, g: NaN, d: null };
    const d = diagramaNM(escalarArmadura(sec, k), { n: est.modo === 'dimensionar' ? 40 : 100, simetrica: true, tol: TOL });
    return { r, g: coeficienteNM(d, r.N, r.MEd), d };
  };
  let k = 1;
  let kEstricto = 1;
  let phiEstricto = null;
  let phiProp = null;
  if (est.modo === 'dimensionar' && As0 > 0) {
    // γ(k) crece con k: bisección entre 0 y 40 veces la armadura de Secciones
    const ok = (kk) => { const g = gammaDe(kk).g; return Number.isFinite(g) && g >= 1; };
    if (!ok(40)) kEstricto = Infinity;
    else if (ok(0.02)) kEstricto = 0.02;
    else { let a = 0.02; let b = 40; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (ok(m)) b = m; else a = m; } kEstricto = b; }
    k = Number.isFinite(kEstricto) ? Math.max(kEstricto, kMin) : kEstricto;
    if (phi0 && Number.isFinite(k)) {
      phiEstricto = phi0 * Math.sqrt(kEstricto);
      phiProp = serieDiametros().find((x) => x >= phi0 * Math.sqrt(k) - 1e-9) ?? null;
      if (phiProp) k = (phiProp / phi0) ** 2;
    }
  }
  const kk = Number.isFinite(k) ? k : 1;
  const g = gammaDe(kk);
  const secD = escalarArmadura(sec, kk);
  const dH = diagramaNM(soloHormigon(sec), { n: 100, simetrica: true, tol: TOL });
  const reducido = g.r.valido && g.r.segundoOrden && g.d ? contornoReducido(entrada(kk), g.d.pos) : null;
  const c = { ...c0, As0, phi0, Amin: cm.A, k, kEstricto, phiEstricto, phiProp, gamma: g.g, r: g.r, d: g.d, dH, secD, reducido, kk };
  memo = { clave, c };
  return c;
}

/* ------------------------------------------------------------ datos */

function filaViga(D, ext, clave, etq, cambio) {
  const v = clave === 'pilar' ? ext.pilar : ext.vigas[clave];
  const set = (k) => (x) => { v[k] = x; cambio(); };
  const id = `ine-${ext === D.A ? 'a' : 'b'}-${clave}`;
  return h('div', { class: 'ine-fila' }, h('span', { class: 'etq-grupo' }, etq),
    filaCampos(
      apilado(campoNum({ id: `${id}-b`, etq: t('ine.b'), valor: v.b, mag: 'long', paso: 25, min: 0, max: 5, sinUd: true, onCambio: set('b') })),
      apilado(campoNum({ id: `${id}-h`, etq: t('ine.h'), valor: v.h, mag: 'long', paso: 25, min: 0, max: 5, sinUd: true, onCambio: set('h') })),
      apilado(campoNum({ id: `${id}-l`, etq: t('ine.l'), valor: v.L, mag: 'long', paso: 100, min: 0, max: 100, sinUd: true, onCambio: set('L') }))));
}

function grupoExtremo(ctx, D, ext, titulo, cambio) {
  const nudo = ext.tipo === 'nudo';
  return grupo(titulo,
    segmentado({ ancho: true, etiqueta: titulo, opciones: [['empotrado', t('ine.t.empotrado')], ['articulado', t('ine.t.articulado')], ['nudo', t('ine.t.nudo')]], valor: ext.tipo, onCambio: (v) => { ext.tipo = v; ctx.pintar(); ctx.cambio(); } }),
    nudo ? [filaViga(D, ext, 'pilar', t('ine.f.pilar'), cambio), filaViga(D, ext, 0, t('ine.f.viga1'), cambio), filaViga(D, ext, 1, t('ine.f.viga2'), cambio)] : null);
}

export function datos(ctx, form) {
  const p = ctx.p;
  const s = activa(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.inestabilidad')), h('p', {}, t('ine.subtitulo'))));
  if (!s) return poner(form, aviso(t('ine.sinSec'), 'info'));
  const D = datosDe(p);
  const cambio = () => ctx.cambio();
  const set = (k) => (v) => { D[k] = v; cambio(); };
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => { const i = p.secciones.findIndex((x) => x.nombre === nombre); if (i >= 0) { est.i = i; ctx.pintar(); } } }));
  poner(form,
    segmentado({ ancho: true, capsula: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('flex.v.comprobar')], ['dimensionar', t('flex.v.dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    pestanas({ lista: [['soporte', t('ine.pSoporte')], ['extremos', t('ine.pExtremos')]], activa: est.pagina, onCambio: (k) => { est.pagina = k; ctx.pintar(); } }));
  if (est.pagina === 'soporte') {
    poner(form,
      grupo(t('ine.gSoporte'),
        campoNum({ id: 'ine-l', etq: 'l', valor: D.L, mag: 'long', paso: 100, min: 0.1, max: 100, nombre: t('ine.LNombre'), ayuda: t('ine.LAyuda'), onCambio: set('L') }),
        segmentado({ ancho: true, etiqueta: t('ine.porticoEtq'), opciones: [[false, t('ine.intra')], [true, t('ine.trasl')]], valor: D.trasl, onCambio: (v) => { D.trasl = v; cambio(); ctx.pintar(); } })),
      grupo(t('ine.gEsfuerzos'),
        campoNum({ id: 'ine-n', etq: sub('N', 'Ed'), ref: t('fcr.compPos'), valor: D.N, mag: 'N', paso: 10, min: -1e6, max: 1e6, nombre: t('ine.nombreN'), onCambio: set('N') }),
        campoNum({ id: 'ine-ma', etq: t('ine.MA'), ref: t('ine.refM'), valor: D.MA, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('ine.nombreM'), ayuda: t('ine.MAyuda'), onCambio: set('MA') }),
        campoNum({ id: 'ine-mb', etq: t('ine.MB'), valor: D.MB, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('ine.nombreM'), ayuda: t('ine.MAyuda'), onCambio: set('MB') })),
      p.norma === 'EHE-08' ? null : grupo(t('ine.gFluencia'),
        campoNum({ id: 'ine-phi', etq: t('ine.phi'), valor: D.phiInf, mag: 'ratio', paso: 0.1, min: 0, max: 10, nombre: t('ine.phiNombre'), ayuda: t('ine.phiAyuda'), onCambio: set('phiInf') }),
        campoNum({ id: 'ine-perm', etq: t('ine.perm'), valor: D.perm, mag: 'ratio', paso: 0.05, min: 0, max: 1, nombre: t('ine.permNombre'), ayuda: t('ine.permAyuda'), onCambio: set('perm') })));
  } else {
    poner(form,
      grupo(t('ine.gRigidez'),
        h('div', { class: 'par2' },
          campoNum({ id: 'ine-fp', etq: t('ine.fp'), valor: D.fp, mag: 'ratio', paso: 0.05, min: 0.01, max: 1, nombre: t('ine.fpNombre'), ayuda: t('ine.fAyuda'), onCambio: set('fp') }),
          campoNum({ id: 'ine-fv', etq: t('ine.fv'), valor: D.fv, mag: 'ratio', paso: 0.05, min: 0.01, max: 1, nombre: t('ine.fvNombre'), ayuda: t('ine.fAyuda'), onCambio: set('fv') }))),
      grupoExtremo(ctx, D, D.A, t('ine.extremoA'), cambio),
      grupoExtremo(ctx, D, D.B, t('ine.extremoB'), cambio));
  }
}

/* ------------------------------------------------------------ resultados */

export function resultados(ctx, res) {
  resultadosInestabilidad(ctx, res);
  rotulaSeccion(res, activa(ctx.p)?.nombre);
}

function resultadosInestabilidad(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const D = datosDe(p);
  const c = calculo(p, s, D);
  const { r } = c;
  const dim = est.modo === 'dimensionar';
  p.calculos.inestabilidadRes = { modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { lambda: r.lambda, lamLim: r.lamLim, MEd: r.MEd, gamma: c.gamma } };

  // Veredicto
  if (!r.valido) res.append(veredicto('neutro', t('ine.revisar'), t('ine.aprov'), '—', t('ine.ver.traccion')));
  else if (r.metodo === 'general') res.append(veredicto('atencion', t('ine.revisar'), t('ine.aprov'), '—', t('ine.ver.general')));
  else if (r.metodo === 'fuera') res.append(veredicto('nocumple', t('ine.noCumple'), t('ine.aprov'), '—', t('ine.ver.fuera')));
  else if (dim && !Number.isFinite(c.k)) res.append(veredicto('nocumple', t('aumentar'), t('armaduraNec'), '—', t('ine.noBasta')));
  else if (dim) {
    const As = c.As0 * c.k;
    if (c.phiProp) res.append(veredicto('cumple', t('valida'), t('fcr.fiProp'), `ø${fmt(c.phiProp, 0)}<span class="u"> mm</span>`, t('fcr.fiArm', c.phiEstricto > 0 ? fmt(c.phiEstricto, 1) : '—', q(As, 'As'), q(c.As0 * c.kEstricto, 'As'), '1,00')));
    else res.append(veredicto('cumple', t('valida'), t('armaduraNec'), qh(As, 'As'), t('fcr.kArm', fmt(c.k, 2), q(c.As0, 'As'), '1,00')));
  } else {
    const ok = c.gamma >= 1 - 1e-6;
    res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('ine.cumple') : t('ine.noCumple'), 'γ = |OQ|/|OP|', sigla(c.gamma),
      r.segundoOrden ? t('ine.ver.con', q(r.M0eq, 'M'), q(r.MEd - r.M0eq, 'M'), q(r.MEd, 'M')) : t('ine.ver.sin', fmt(r.lambda, 1), fmt(r.lamLim, 1)), Math.min(1 / Math.max(c.gamma, 1e-9) / 1.25, 1)));
  }
  if (c.As0 * c.k + 1e-12 < c.Amin && c.As0 > 0) res.append(aviso(t('fcr.bajoMin', q(c.As0 * c.k, 'As'), q(c.Amin, 'As'))));
  if (!(c.As0 > 0)) res.append(aviso(t('ine.av.sinArm')));
  for (const a of r.avisos ?? []) res.append(aviso(t(a.clave, ...(a.args ?? []).map((v) => (typeof v === 'number' ? fmt(v, 0) : v))), a.clave === 'ine.av.eMin' ? 'info' : ''));
  if (r.valido && p.norma !== 'EC2-2023' && r.metodo !== 'fuera') res.append(aviso(t('ine.av.lim'), 'info'));

  // Gráfico N-M con el segundo orden como reducción del contorno
  const grafico = h('article', { class: 'panel tarjeta' }, h('h2', {}, `${t('ine.diagrama')} · ${s.nombre}${c.phi0 ? ` · ø${fmt(c.phiProp ?? c.phi0, 0)}` : ''}`),
    h('div', { class: 'fcr-graf' }, graficoNM(ctx, c, s), notaDiagrama(c)));
  const lado = h('article', { class: 'panel tarjeta fcr-lado' },
    pestanas({ lista: [['res', t('ine.pRes')], ['sop', t('ine.pSoporteDib')], ['rot', t('ine.pRotura')]], activa: est.lado, onCambio: (k) => { est.lado = k; ctx.cambio(); } }),
    est.lado === 'sop' ? h('div', { class: 'lienzo', html: dibujoSoporte(D, c, s, p) })
      : est.lado === 'rot' ? rotura(c, s)
        : [cifras(cifrasDe(c, D, p, dim)), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(p, c, D)]);
  res.append(h('div', { class: 'cuerpo dib-ancho fcr-diagrama' }, grafico, lado));
}

function rotura(c, s) {
  const r = c.r;
  if (!r.valido || !c.d || !Number.isFinite(r.MEd)) return h('div');
  const Q = coeficienteQ(c);
  const e = Q ? estadoUltimo(c.secD, -Q[0], { signo: 1, yref: c.d.yref }) : null;
  return h('div', { class: 'fcr-sec' }, h('div', { class: 'lienzo', html: e?.converge ? dibujoRotura(c.geo, s, { secD: c.secD }, e) : dibujoSeccionPeq(c.geo, s) }));
}

/** Punto Q del contorno en la dirección (N, M_Ed). */
function coeficienteQ(c) {
  const g = c.gamma;
  return Number.isFinite(g) && g > 0 && Number.isFinite(c.r.MEd) ? [g * c.r.N, g * c.r.MEd] : null;
}

function cifrasDe(c, D, p, dim) {
  const r = c.r;
  if (!r.valido) return [];
  const mm = (x) => `${fmt(x * 1000, 0)}<span class="u"> mm</span>`;
  const lista = [[t('ine.c.l0'), Number.isFinite(r.l0) ? mm(r.l0) : '—'], [t('ine.c.lam'), fmt(r.lambda, 1)], [t('ine.c.lamLim'), fmt(r.lamLim, 1)]];
  if (p.norma === 'EHE-08') lista.splice(1, 0, [t('ine.c.alfa'), fmt(r.alfa, 2)]);
  else lista.push([t('ine.c.phiEf'), fmt(r.phiEf, 2)]);
  lista.push([t('ine.c.psi'), `${sigla(c.psiA)} · ${sigla(c.psiB)}`]);
  if (Number.isFinite(r.MEd)) {
    lista.push([t('ine.c.M0'), qh(r.M0eq, 'M')]);
    if (r.segundoOrden) lista.push([t('ine.c.dM'), qh(r.MEd - r.M0eq, 'M')]);
    lista.push([t('ine.c.MEd'), qh(r.MEd, 'M')]);
  }
  const arm = c.phi0 ? [['ø', `${fmt(c.phiProp ?? c.phi0, 0)}<span class="u"> mm</span>`], [sub('A', 's'), qh(c.As0 * c.kk, 'As')], [sub('A', 's,mín'), qh(c.Amin, 'As')]] : [[sub('A', 's'), qh(c.As0 * c.kk, 'As')]];
  void dim;
  const todas = [...lista, ...arm];
  if (todas.length % 2) todas.push(['', '']); // la rejilla de cifras va a dos columnas
  return todas;
}

function notaDiagrama(c) {
  const d = c.d;
  const r = c.r;
  if (!d) return h('p', { class: 'nota-diag', html: '' });
  return h('p', { class: 'nota-diag', html: [`${sub('N', 'Rd')} <b>${q(d.Ncomp, 'N')}</b>`, `${sub('N', 'Rd,t')} <b>${q(d.Ntrac, 'N')}</b>`,
    `${sub('e', 'mín')} <b>${fmt(c.emin * 1000, 0)}</b> mm`, r.valido && r.segundoOrden ? `ΔM <b>${q(r.MEd - r.M0eq, 'M')}</b>` : t('ine.nota.sin')].join(' · ') });
}

function graficoNM(ctx, c, s) {
  const d = c.d ?? c.dH;
  const r = c.r;
  const xy = (rama) => [...rama].reverse().map((v) => [v.N, v.M]);
  const series = [
    { nombre: t('ine.sinSegundo'), clase: 'ref', xy: xy(d.pos) },
  ];
  if (c.reducido) series.push({ nombre: t('ine.conSegundo'), clase: 's1', xy: [...c.reducido].reverse().map((v) => [v.N, v.M]) });
  else series[0].clase = 's1';
  series.push({ nombre: t('fcr.hormigon'), clase: 'ref', cruz: false, xy: xy(c.dH.pos) });
  series.push({ nombre: `e mín = ${fmt(c.emin * 1000, 0)} mm`, clase: 'ref', cruz: false, xy: [[0, 0], [d.Ncomp, d.Ncomp * c.emin]] });
  const puntos = [];
  if (r.valido && Number.isFinite(r.MEd)) {
    puntos.push({ x: r.N, y: r.M0eq, etq: ind('M', '0'), marca: 'neutro' });
    if (r.segundoOrden) puntos.push({ x: r.N, y: r.MEd, etq: ind('M', 'Ed'), marca: c.gamma >= 1 - 1e-6 ? 'ok' : 'no' });
    else puntos[0].marca = c.gamma >= 1 - 1e-6 ? 'ok' : 'no';
  }
  return h('div', { class: 'lienzo' }, grafica({
    series, puntos, detalle: null,
    ejeX: { titulo: `N [${MAG.N.ud}], ${t('fcr.compPos')}`, d: MAG.N.d, dt: MAG.N.d },
    ejeY: { titulo: `M [${MAG.M.ud}]`, d: MAG.M.d, dt: MAG.M.d },
    archivo: `Inestabilidad ${s.nombre}`, avisar: ctx.avisar, sinTabla: true,
  }));
}

/** Alzado del soporte: extremos A y B, longitud libre l, longitud de pandeo l₀ y forma de pandeo. */
function dibujoSoporte(D, c, s, p) {
  const r = c.r;
  const W = 380;
  const H = 360;
  const cx = 175;
  const y0 = 50; // extremo B (arriba)
  const y1 = 300; // extremo A (abajo)
  const ancho = 22;
  const out = [];
  const tinta = 'var(--tinta)';
  const trazo = `fill="none" stroke="${tinta}" stroke-width="1.5"`;
  const extremo = (ext, y, arriba, psi, nombre) => {
    const g = [];
    const dir = arriba ? -1 : 1;
    if (ext.tipo === 'empotrado') {
      g.push(`<line x1="${cx - 40}" y1="${y}" x2="${cx + 40}" y2="${y}" stroke="${tinta}" stroke-width="2.5"/>`);
      for (let x = cx - 40; x <= cx + 32; x += 8) g.push(`<line x1="${x}" y1="${y}" x2="${x + 8}" y2="${y - dir * 8}" stroke="${tinta}" stroke-width="1"/>`);
    } else if (ext.tipo === 'articulado') {
      g.push(`<path d="M${cx} ${y} l-12 ${-dir * 18} h24 z" ${trazo}/>`, `<line x1="${cx - 30}" y1="${y - dir * 18}" x2="${cx + 30}" y2="${y - dir * 18}" stroke="${tinta}" stroke-width="2"/>`);
    } else {
      const v = (lado, e) => (e.L > 0 && e.b > 0 && e.h > 0
        ? `<rect x="${lado < 0 ? cx - ancho / 2 - 62 : cx + ancho / 2}" y="${y - 6}" width="62" height="12" fill="var(--hormigon)" stroke="var(--hormigon-borde)"/>` : '');
      g.push(v(-1, ext.vigas[0]), v(1, ext.vigas[1]));
      if (ext.pilar.L > 0) g.push(`<rect x="${cx - ancho / 2}" y="${arriba ? y - 36 : y}" width="${ancho}" height="36" fill="var(--hormigon)" stroke="var(--hormigon-borde)" stroke-dasharray="3 3"/>`);
    }
    g.push(`<text x="${cx + 80}" y="${y + (arriba ? -12 : 24)}" class="fuerte">${nombre}: Ψ = ${sigla(psi)}</text>`);
    return g.join('');
  };
  out.push(extremo(D.B, y0, true, c.psiB, 'B'), extremo(D.A, y1, false, c.psiA, 'A'));
  out.push(`<rect x="${cx - ancho / 2}" y="${y0}" width="${ancho}" height="${y1 - y0}" fill="var(--hormigon)" stroke="var(--hormigon-borde)"/>`);
  // Forma de pandeo (esquema): sinusoide sobre l0
  if (Number.isFinite(r.l0) && D.L > 0) {
    const f = Math.min(r.l0 / D.L, 2.2);
    const amp = 26;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      pts.push(`${cx + (D.trasl ? amp * (u) : amp * Math.sin(Math.PI * u)) * (f > 0.9 ? 1 : 0.7)},${y1 - u * (y1 - y0)}`);
    }
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--acento)" stroke-width="1.5" stroke-dasharray="5 3"/>`);
  }
  // Cotas: l (izquierda) y l0 (derecha)
  const cota = (x, ya, yb, txt, lado) => `<line x1="${x}" y1="${ya}" x2="${x}" y2="${yb}" stroke="${tinta}" stroke-width="1"/><line x1="${x - 4}" y1="${ya}" x2="${x + 4}" y2="${ya}" stroke="${tinta}"/><line x1="${x - 4}" y1="${yb}" x2="${x + 4}" y2="${yb}" stroke="${tinta}"/><text x="${x + lado * 8}" y="${(ya + yb) / 2 + 4}" text-anchor="${lado < 0 ? 'end' : 'start'}" class="fuerte">${txt}</text>`;
  out.push(cota(cx - 78, y0, y1, `l = ${fmt(D.L * 1000, 0)}`, -1));
  if (Number.isFinite(r.l0)) {
    const mid = (y0 + y1) / 2;
    const m = (D.L > 0 ? (r.l0 / D.L) * (y1 - y0) : 0) / 2;
    out.push(cota(cx + 110, Math.max(mid - m, 10), Math.min(mid + m, H - 10), `l₀ = ${fmt(r.l0 * 1000, 0)}`, 1));
  }
  if (D.trasl) out.push(`<path d="M${cx - 30} ${y0 - 36} h60 m-8 -5 l8 5 l-8 5" ${trazo}/>`);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('ine.dibAria')}">${out.join('')}</svg>`;
}

/* ------------------------------------------------------------ traza */

function traza(p, c, D) {
  const r = c.r;
  if (!r.valido) return h('div', { class: 'traza' });
  const fam = NORMAS[p.norma];
  const art = (a, b, c3) => `<span class="art">${fam.ref} · ${p.norma === 'EHE-08' ? a : p.norma === 'EC2-2023' ? c3 : b}</span>`;
  const mm = (x) => `${fmt(x * 1000, 0)} mm`;
  const ehe = p.norma === 'EHE-08';
  const filas = [
    { id: 'esb', nom: t('ine.t.esb'), val: `λ = ${fmt(r.lambda, 1)}`, cuenta: `<span class="f">${t('ine.f.esb')}</span><span class="f">${t(ehe ? 'ine.f.alfaEHE' : 'ine.f.l0EC')}</span><span class="n">l₀ = ${mm(r.l0)} · i = ${mm(r.i)}</span>${art('43.1.1 y 43.1.2', '5.8.3.2', 'O.5')}` },
    { id: 'lim', nom: t('ine.t.lim'), val: `λlim = ${fmt(r.lamLim, 1)}`, cuenta: `<span class="f">${t(p.norma === 'EC2-2023' ? 'ine.f.lim23' : 'ine.f.limEHE')}</span><span class="n">n = ${fmt(ehe ? r.nu : r.n, 2)} · ω = ${fmt(r.omega, 2)}${r.C && p.norma !== 'EC2-2023' ? ` · C = ${fmt(r.C, 2)}` : ''}</span>${art('43.1.2', '5.8.3.1 (AN)', 'O.6')}` },
  ];
  if (!ehe) filas.push({ id: 'flu', nom: t('ine.t.flu'), val: `φef = ${fmt(r.phiEf, 2)}`, cuenta: `<span class="f">${t('ine.f.flu')}</span><span class="f">${t('ine.f.fluIgn')}</span><span class="n">φ(∞,t₀) = ${fmt(D.phiInf, 2)} · ${fmt(D.perm, 2)}</span>${art('', '5.8.4', '7.4.2')}` });
  if (r.segundoOrden && ehe) filas.push({ id: 'seg', nom: t('ine.t.seg'), val: `e<sub>a</sub> = ${mm(r.ea)}`, cuenta: `<span class="f">${t('ine.f.ea')}</span><span class="f">${t('ine.f.ee')}</span><span class="n">β = ${fmt(r.beta, 2)} · ε<sub>y</sub> = ${fmt(r.epsY * 1000, 2)} ‰ · e<sub>e</sub> = ${mm(r.ee)}</span>${art('43.5.1', '', '')}` });
  else if (r.segundoOrden) filas.push({ id: 'seg', nom: t('ine.t.seg'), val: `e<sub>2</sub> = ${mm(r.e2)}`, cuenta: `<span class="f">${t('ine.f.curv')}</span><span class="n">1/r₀ = ${fmt(r.r0 * 1000, 2)} ‰/m · K<sub>r</sub> = ${fmt(r.Kr, 2)} · K<sub>φ</sub> = ${fmt(r.Kphi, 2)} · 1/r = ${fmt(r.curv * 1000, 2)} ‰/m · c = ${fmt(r.c, 0)}</span>${art('', '5.8.8', 'O.7')}` });
  if (Number.isFinite(r.MEd)) filas.push({ id: 'med', nom: t('ine.t.med'), val: q(r.MEd, 'M'), cuenta: `<span class="f">${t(ehe ? 'ine.f.medEHE' : 'ine.f.med')}</span><span class="n">M<sub>01</sub> = ${fmt(r.M01, 0)} · M<sub>02</sub> = ${fmt(r.M02, 0)} kN·m · e<sub>mín</sub> = ${mm(c.emin)}</span>` });
  return h('div', { class: 'traza' }, ...filas.map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  }));
}

export function comandos(ctx) {
  return [
    { k: 'ine.cmdComprobar', b: 'inestabilidad pandeo soportes segundo orden comprobar buckling columns second order', f: () => { est.modo = 'comprobar'; ctx.ir('inestabilidad'); } },
    { k: 'ine.cmdDimensionar', b: 'inestabilidad pandeo soportes segundo orden dimensionar buckling columns design', f: () => { est.modo = 'dimensionar'; ctx.ir('inestabilidad'); } },
  ];
}
