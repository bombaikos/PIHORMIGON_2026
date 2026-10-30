// ELU · Flexión compuesta recta: comprobación, dimensionamiento y diagrama de interacción N-M en rotura.
// La sección (geometría, disposición de la armadura y materiales) viene de Secciones y aquí no se toca.
// Solo M ≥ 0 (armadura simétrica: el negativo es el espejo; un M escrito con signo menos se toma en valor absoluto).
// Los esfuerzos solicitantes (N, M) entran en una tabla y se colocan en el diagrama: verdes dentro, rojos fuera.
// Coeficiente de seguridad a excentricidad constante: γ = |OQ| / |OP| (Q = corte de la recta O–P con el contorno).
// Dimensionar mantiene la disposición de la armadura de Secciones y busca el factor que da γ ≥ γ requerido.
// Compresión positiva; M > 0 comprime la cara superior. Motor: src/core/interaccion.js.

import { cuantiaMinima } from '../../core/cuantiaMinima.js';
import { diagramaNM, coeficienteNM, comprobarNM, momentoEn, dimensionarNM, escalarArmadura, soloHormigon } from '../../core/interaccion.js';
import { estadoUltimo } from '../../core/seccion.js';
import { sigma } from '../../core/materiales.js';
import { leerNumero } from '../../core/armado.js';
import { seccionMotor } from '../../core/geometria.js';
import { NORMAS } from '../../norma/normas.js';
import { geometriaDe, materialesSeccion, sepCapas } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, MAG, ESP, serieDiametros } from '../formato.js';
import { grupoSeccion, rotulaSeccion } from './secciones.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, cifras, pestanas } from '../campos.js';
import { rejilla } from '../rejilla.js';
import { grafica } from '../grafica.js';
import { dibujoSeccion, DEFS, encuadre, capasSeccion } from '../dibujoSeccion.js';
import { veredicto } from './flexion.js';

// Solo secciones con armadura simétrica respecto al eje de flexión (pilar rectangular y circular): basta el diagrama con M ≥ 0
const FORMAS = ['pilar', 'circular'];
const est = {
  i: null, fi: null, modo: 'comprobar', gamma: 1, NEd: 500, MEd: 150,
  filas: [['500', '150'], ['1500', '100'], ['-150', '60'], ['2500', '200']],
  abiertos: new Set(), pestana: 'resultados', resAbierto: false,
};
export function reiniciar() { est.i = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;
const nv = (txt) => leerNumero(txt);

/** Excentricidad mínima [m]: EHE-08 42.2.1 máx{h/20; 2 cm}; EC-2 6.1(4) y EC-2 2023 8.1.1(5) máx{h/30; 20 mm}. h = canto (o diámetro). */
export function eMinima(norma, s) {
  const h = s.forma === 'circular' ? s.geo.D : s.geo.h;
  return Math.max(h / (norma === 'EHE-08' ? 20 : 30), 0.02);
}
let emin = 0;

function activa(p) {
  if (!FORMAS.includes(p.secciones[est.i]?.forma)) est.i = p.secciones.findIndex((x) => FORMAS.includes(x.forma));
  const s = est.i >= 0 ? p.secciones[est.i] : null;
  emin = s ? eMinima(p.norma, s) : 0;
  return s;
}

/** Pares (N, M) válidos de la tabla, con su fila. */
const pares = () => (est.modo !== 'diagrama'
  ? [{ i: 0, N: est.NEd, M: Math.abs(est.MEd) }]
  : est.filas.map((f, i) => ({ i, N: nv(f[0]), M: Math.abs(nv(f[1])) }))).filter((x) => Number.isFinite(x.N) && Number.isFinite(x.M))
  // Con compresión, el momento de cálculo no baja de N·e_mín (se marca con *)
  .map((x) => (x.N > 0 && x.M < x.N * emin - 1e-9 ? { ...x, M: x.N * emin, subeM: true } : x));

/** Diámetro común [mm] de las barras de la sección, o null si hay franjas por área o diámetros distintos. */
function fiComun(geo) {
  if (!geo.barras.length || geo.franjas.length) return null;
  const f = geo.barras.map((b) => b.fi);
  return f.every((x) => Math.abs(x - f[0]) < 1e-9) ? f[0] : null;
}

// Los diagramas de una sección circular o genérica tardan: se guarda el último cálculo mientras no cambien los datos
let memo = { clave: '', c: null };
/** Contornos (armado y solo hormigón) para la sección activa; en Dimensionar, con la armadura escalada. */
function calculo(p, s) {
  const ps = pares();
  const clave = JSON.stringify([p.norma, s.geo, s.armado, s.hormigon, s.acero, sepCapas(p), est.modo, est.fi, serieDiametros(), emin, est.modo === 'dimensionar' ? [ps.map((x) => [x.N, x.M])] : 0]);
  if (memo.clave === clave) return memo.c;
  const geo = geometriaDe(p, s);
  if (geo.errores?.length) throw new Error(geo.errores.join(' '));
  const mats = materialesSeccion(p, s);
  const sec = seccionMotor(geo, mats.hormigon, mats.acero);
  const As0 = sec.barras.reduce((a, b) => a + b.A, 0);
  const phi0 = fiComun(geo);
  // Cuantía mínima de pilar (EHE-08 42.3.3; EC-2 9.5.2(2)): máx{0,10·N/fyd; cuantía geométrica}, con el mayor N_Ed
  const Ac = sec.trapecios.reduce((a, t) => a + ((t.b1 + t.b2) / 2) * (t.y2 - t.y1), 0);
  const cm = cuantiaMinima({ norma: p.norma, tipo: 'pilar', h: 0, Ac, yg: 0, Ix: 0, fctm: 0, fyk: mats.acero.fk, gammaS: mats.acero.gamma, N: Math.max(0, ...ps.map((x) => x.N)) });
  const Amin = cm.A;
  const kMin = As0 > 0 ? Amin / As0 : 0;
  let k = 1;
  let kEstricto = 1;
  let phiEstricto = null;
  let phiProp = null;
  if (est.modo === 'dimensionar') {
    if (!(As0 > 0)) throw new Error(t('fcr.sinArmadura'));
    kEstricto = dimensionarNM(sec, ps.map((x) => [x.N, x.M]), { gamma: 1, simetrica: true });
    k = Number.isFinite(kEstricto) ? Math.max(kEstricto, kMin) : kEstricto;
    // A_s crece con ø²: el diámetro estricto es ø₀·√k y el propuesto el primero de la serie que lo alcanza (y cumple la cuantía mínima)
    if (phi0 && Number.isFinite(k)) {
      phiEstricto = kEstricto > 0 ? phi0 * Math.sqrt(kEstricto) : 0;
      phiProp = serieDiametros().find((x) => x >= phi0 * Math.sqrt(k) - 1e-9) ?? null;
      if (phiProp) k = (phiProp / phi0) ** 2;
    }
  } else if (phi0 && est.fi > 0) k = (est.fi / phi0) ** 2; // el ø de cálculo no tiene por qué ser el de la sección
  const dibujada = Number.isFinite(k) ? escalarArmadura(sec, k) : escalarArmadura(sec, 1);
  const c = { geo, sec, secD: dibujada, As0, Amin, cm, k, kEstricto, phi0, phiEstricto, phiProp, d: diagramaNM(dibujada, { n: 100, simetrica: true, tol: TOL }), dH: diagramaNM(soloHormigon(sec), { n: 100, simetrica: true, tol: TOL }) };
  memo = { clave, c };
  return c;
}

// Resolución del contorno: la recta entre puntos no se separa de la curva más de 0,01 % del M máximo
const TOL = 2e-5;
const sigla = (g) => (g === Infinity ? '∞' : fmt(g, 2));

export function datos(ctx, form) {
  const p = ctx.p;
  const s = activa(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('menu.flexRecta')), h('p', {}, t('fcr.subtitulo'))));
  if (!s) return poner(form, aviso(t('fcr.sinSec'), 'info'));
  poner(form, grupoSeccion(ctx, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; est.fi = null; ctx.pintar(); }
  } }));
  const cambio = () => ctx.cambio();
  let c = null;
  try { c = calculo(p, s); } catch { /* el error se muestra en resultados */ }
  // Diámetro de cálculo: dato propio de este módulo (el de Secciones solo es el valor inicial), de la serie de diámetros válidos
  const campoFi = () => {
    if (est.modo === 'dimensionar' || !c?.phi0) return null;
    const serie = [...new Set([...serieDiametros(), c.phi0])].sort((x, y) => x - y);
    return selector({ id: 'fr-fi', etq: 'ø [mm]', linea: true, opciones: serie.map((x) => [x, fmt(x, 0)]), valor: est.fi ?? c.phi0, onCambio: (v) => { est.fi = Number(v); cambio(); } });
  };
  const coefFila = (datosTabla, r) => {
    if (!c) return '';
    const N = nv(datosTabla[r][0]);
    const M0 = nv(datosTabla[r][1]);
    const M = Number.isFinite(N) && N > 0 ? Math.max(Math.abs(M0), N * emin) : Math.abs(M0);
    return Number.isFinite(N) && Number.isFinite(M) ? sigla(coeficienteNM(c.d, N, M)) : '';
  };
  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')], ['diagrama', t('fcr.modoDiagrama')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    est.modo !== 'diagrama' ? grupo(t('g.esfuerzo'),
      campoNum({ id: 'fr-n', etq: sub('N', 'Ed'), ref: t('fcr.compPos'), valor: est.NEd, mag: 'N', paso: 10, min: -1e6, max: 1e6, nombre: t('fcr.axil'), onCambio: (v) => { est.NEd = v; cambio(); } }),
      campoNum({ id: 'fr-m', etq: sub('M', 'Ed'), valor: est.MEd, mag: 'M', paso: 5, min: -1e6, max: 1e6, nombre: t('flex.momento'), onCambio: (v) => { est.MEd = v; cambio(); } }),
      campoFi()) :
    grupo(t('fcr.esfuerzos'),
      rejilla({ id: 'fr-esf', altoMax: 190,
        columnas: [{ titulo: `${sub('N', 'Ed')} [kN]`, num: true }, { titulo: `${sub('M', 'Ed')} [kN·m]`, num: true }],
        filas: est.filas, calculada: { titulo: 'γ', f: coefFila },
        onCambio: (f) => { est.filas = f.map((r) => [r[0], r[1]]); cambio(); } }),
      campoFi()));
}

export function resultados(ctx, res) {
  resultadosFlexRecta(ctx, res);
  rotulaSeccion(res, activa(ctx.p)?.nombre);
}

function resultadosFlexRecta(ctx, res) {
  const p = ctx.p;
  const s = activa(p);
  if (!s) return;
  const c = calculo(p, s);
  const { d, dH, geo } = c;
  const ps = pares();
  if (!ps.length) throw new Error(t('fcr.sinEsfuerzos'));
  const gam = ps.map((x) => ({ ...x, g: coeficienteNM(d, x.N, x.M) }));
  const gmin = Math.min(...gam.map((x) => x.g));
  const dim = est.modo === 'dimensionar';
  const unico = est.modo !== 'diagrama';
  p.calculos.flexionCompuesta ??= {};
  p.calculos.flexionCompuesta[s.nombre] = { modo: est.modo, esfuerzos: ps.map((x) => [x.N, x.M]), norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { gammaMin: gmin, k: c.k } };

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
      unico ? `${sub('M', 'Rd')}(${sub('N', 'Ed')}) <b>${q(momentoEn(d.pos, gam[0].N), 'M')}</b> · ${sub('M', 'Ed')} <b>${q(gam[0].M, 'M')}</b>` : `${t('fcr.puntos')} <b>${gam.filter((x) => x.g >= 1 - 1e-6).length}</b> / ${gam.length} ${t('fcr.dentro')}`, Math.min(1 / Math.max(gmin, 1e-9) / 1.25, 1)));
  }

  const Asd = c.As0 * c.k;
  if (Asd + 1e-12 < c.Amin) res.append(aviso(t('fcr.bajoMin', q(Asd, 'As'), q(c.Amin, 'As'))));
  else if (dim && c.As0 * c.kEstricto + 1e-12 < c.Amin) res.append(aviso(t('fcr.mandaMin', q(c.Amin, 'As')), 'info'));
  if (gam.some((x) => x.subeM)) res.append(aviso(t('fcr.subeEmin', fmt(emin * 1000, 0)), 'info'));
  if (unico) return resultadoUnico(ctx, res, { s, c, gam: gam[0], gmin, dim });
  const Mmax = (rama) => rama.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a));
  const mp = Mmax(d.pos);
  // Todo a la vista: diagrama grande con los resultados principales como nota; a su lado, la sección pequeña y la tabla de esfuerzos
  const nota = h('p', { class: 'nota-diag', html: [
    `${sub('N', 'Rd')} <b>${q(d.Ncomp, 'N')}</b>`, `${sub('N', 'Rd,t')} <b>${q(d.Ntrac, 'N')}</b>`,
    `${sub('M', 'Rd,máx')} <b>${q(mp.M, 'M')}</b> (N = ${fmt(mp.N, MAG.N.d)})`, `${sub('N', 'Rd,hormigón')} <b>${q(dH.Ncomp, 'N')}</b>`,
    ...(c.phi0 ? [`ø <b>${fmt(est.fi ?? c.phi0, 0)}</b> mm · ${sub('A', 's')} <b>${q(c.As0 * c.k, 'As')}</b> (${sub('A', 's,mín')} ${q(c.Amin, 'As')})`] : [])].join(' · ') });
  const lado = h('aside', { class: 'fcr-lado' },
    h('div', { class: 'fcr-sec', html: dibujoSeccionPeq(geo, s) }),
    tablaEsfuerzos(gam));
  res.append(h('article', { class: 'panel tarjeta' }, h('h2', {}, `${t('fcr.diagrama')} · ${s.nombre}${c.phi0 ? ` · ø${fmt(est.fi ?? c.phi0, 0)}` : ''}`),
    h('div', { class: 'fcr-diag' }, h('div', { class: 'fcr-graf' }, graficoNM(ctx, d, dH, gam, s), nota), lado)));
}

/** Sección pequeña, solo contorno y barras con sus cotas. */
function dibujoSeccionPeq(geo, s) {
  const e = encuadre(geo, 150, 150, { completa: true });
  const x0 = 46;
  const y0 = 10;
  const { svg, hp, bp } = capasSeccion(geo, s, { e, x0, y0, x: null, id: 'fcrs', cotasCapas: false });
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${x0 + bp + 30} ${y0 + hp + 32}" role="img" aria-label="${t('g.seccion')}">${DEFS}${svg}</svg>`;
}

function tablaEsfuerzos(gam) {
  const filas = gam.map((x) => [String(x.i + 1), fmt(x.N, MAG.N.d), fmt(x.M, MAG.M.d) + (x.subeM ? '*' : ''), x.N !== 0 ? fmt((x.M / x.N) * 1000, MAG.long.d) : '∞', sigla(x.g),
    `<span class="${x.g >= 1 - 1e-6 ? 'ok' : 'no'}">${x.g >= 1 - 1e-6 ? t('fcr.dentroSello') : t('fcr.fueraSello')}</span>`]);
  const cont = h('div', {}, h('table', { class: 'tabla', html: `<thead><tr>${['#', 'N<sub>Ed</sub> [kN]', 'M<sub>Ed</sub> [kN·m]', 'e [mm]', 'γ', ''].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>` }));
  return cont;
}

/** Contorno N-M (x = N, y = M) con la envolvente del hormigón solo y los esfuerzos: verde dentro, rojo fuera. */
function graficoNM(ctx, d, dH, gam, s) {
  const eMm = fmt(emin * 1000, 0);
  const xy = (rama) => [...rama].reverse().map((v) => [v.N, v.M]);
  const series = [
    { nombre: ind('M', 'Rd'), clase: 's1', xy: xy(d.pos) },
    { nombre: t('fcr.hormigon'), clase: 'ref', cruz: false, xy: xy(dH.pos) },
    { nombre: `e mín = ${eMm} mm`, clase: 'ref', cruz: false, xy: [[0, 0], [d.Ncomp, d.Ncomp * emin]] },
  ];
  const puntos = gam.map((x) => ({ x: x.N, y: x.M, etq: String(x.i + 1), marca: x.g >= 1 - 1e-6 ? 'ok' : 'no' }));
  return h('div', { class: 'lienzo' }, grafica({
    series, puntos,
    ejeX: { titulo: `N [${MAG.N.ud}], ${t('fcr.compPos')}`, d: MAG.N.d, dt: MAG.N.d },
    ejeY: { titulo: `M [${MAG.M.ud}]`, d: MAG.M.d, dt: MAG.M.d },
    archivo: `N-M ${s.nombre}`,
    avisar: ctx.avisar,
  }));
}

function traza(p, d, dH, gmin) {
  const fam = NORMAS[p.norma];
  const art = (a, b, c) => `<span class="art">${fam.ref} · ${p.norma === 'EC2-2004' ? c ?? b : fam.familia === 'EHE' ? a : b}</span>`;
  const filas = [
    { id: 'coef', nom: t('fcr.coefSeg'), val: sigla(gmin), cuenta: `<span class="f">${t('fcr.f.rayo')}</span>` },
    { id: 'mrd', nom: t('fcr.contorno'), val: `${fmt(d.pos.length + d.neg.length, 0)} ${t('fcr.puntosCont')}`, cuenta: `<span class="f">${t('fcr.f.contorno')}</span>
      <span class="n">${t('fcr.f.ref', q(d.yref, 'long'))}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'nrd', nom: sub('N', 'Rd'), val: q(d.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.nrd')}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'env', nom: t('fcr.hormigon'), val: q(dH.Ncomp, 'N'), cuenta: `<span class="f">${t('fcr.f.env')}</span>` },
  ];
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
    { k: 'p.fcrComprobar', b: 'flexion compuesta recta comprobar interaccion', f: () => { est.modo = 'comprobar'; ctx.ir('flexRecta'); } },
    { k: 'p.fcrDimensionar', b: 'flexion compuesta recta dimensionar interaccion', f: () => { est.modo = 'dimensionar'; ctx.ir('flexRecta'); } },
  ];
}

/** Comprobar y Dimensionar con un solo par (N_Ed, M_Ed): sección, plano de rotura y tensiones, como Flexión simple. */
function resultadoUnico(ctx, res, { s, c, gam, gmin, dim }) {
  const { d, geo } = c;
  const Q = comprobarNM(d, gam.N, gam.M).Q;
  const e = Q ? estadoUltimo(c.secD, -Q[0], { signo: 1, yref: d.yref }) : null;
  const ok = e?.converge ? e : null;
  const rama = d.pos;
  const Mn = momentoEn(rama, gam.N);
  const cif = [
    [`${sub('M', 'Rd')}(${sub('N', 'Ed')})`, Number.isFinite(Mn) ? qh(Mn, 'M') : '—'],
    [sub('N', 'Rd'), qh(d.Ncomp, 'N')],
    ...(ok ? [[t('c.x'), Number.isFinite(ok.x) && ok.x > 0 ? qh(ok.x, 'long') : '—'], [sub('ε', 'c'), qh(-ok.epsSup, 'def')]] : []),
    ...cifrasArmadura(c, dim),
  ];
  const lienzo = h('div', { class: 'lienzo', html: ok ? dibujoRotura(geo, s, c, ok) : '' });
  const tarjetaDib = h('article', { class: 'panel tarjeta' }, h('h2', {}, t('t.dibujo')), h('p', { class: 'sub' }, t('fcr.dibujoSub')), lienzo);
  const tarjetaRes = h('article', { class: 'panel tarjeta' }, cifras(cif), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(ctx.p, d, c.dH, gmin));
  res.append(h('div', { class: 'cuerpo dib-ancho' }, tarjetaDib, tarjetaRes));
}

/** Sección, deformaciones y tensiones en rotura, a la misma escala vertical (como Flexión simple). */
function dibujoRotura(geo, s, c, e) {
  const sec = c.secD;
  const matH = sec.trapecios[0].mat;
  const matA = sec.barras[0]?.mat;
  const W = 640;
  const top = 56;
  const x0 = 64;
  const y0 = top;
  const em = encuadre(geo, 300, 290, { desp: 0.5 });
  const xn = Number.isFinite(e.x) ? Math.min(Math.max(e.x, 0), geo.h) : 0;
  const { svg, hp, bp } = capasSeccion(geo, s, { e: em, x0, y0, x: e.x > 0 ? e.x : null, id: 'fcr', cotasCapas: false });
  const Y = (y) => y0 + y * em.s;
  const eps = (y) => e.epsSup + e.kappa * y;
  const out = [DEFS, svg];
  out.push(`<text class="tit" x="${x0}" y="22">${t('tit.sec')}</text>`);
  if (e.x > 0 && e.x < geo.h) {
    out.push(`<line class="en" x1="${x0 - 8}" y1="${Y(xn)}" x2="${W - 12}" y2="${Y(xn)}"/>`);
    out.push(`<text x="${W - 12}" y="${Y(xn) + 14}" text-anchor="end" style="fill:var(--acento)">${t('ejeNeutro')}</text>`);
    out.push(`<text class="fuerte" x="${x0 + bp + 16}" y="${(Y(0) + Y(xn)) / 2 + 4}">x = ${fmt(e.x * 1000, 0)}</text>`);
  }
  // Deformaciones (compresión a la izquierda del eje, como en Flexión simple)
  const e0 = x0 + bp + 110;
  const emax = Math.max(Math.abs(eps(0)), Math.abs(eps(geo.h)), 0.001);
  const ke = 58 / emax;
  const X1 = (v) => e0 + v * ke;
  out.push(`<text class="tit" style="text-transform:none" x="${e0 - 58}" y="22">ε [‰]</text>`);
  out.push(`<line class="ref" x1="${e0}" y1="${y0 - 6}" x2="${e0}" y2="${y0 + hp + 6}"/>`);
  const poli = (cl, y1, y2) => `<polygon class="${cl}" points="${e0},${Y(y1)} ${X1(eps(y1))},${Y(y1)} ${X1(eps(y2))},${Y(y2)} ${e0},${Y(y2)}"/>`;
  if (e.x > 0 && e.x < geo.h) { out.push(`<polygon class="eps-c" points="${e0},${Y(0)} ${X1(eps(0))},${Y(0)} ${e0},${Y(xn)}"/>`); out.push(`<polygon class="eps-t" points="${e0},${Y(xn)} ${X1(eps(geo.h))},${Y(geo.h)} ${e0},${Y(geo.h)}"/>`); }
  else out.push(poli(e.x >= geo.h || (e.epsSup < 0 && e.epsInf < 0) ? 'eps-c' : 'eps-t', 0, geo.h));
  out.push(`<text x="${X1(eps(0)) - 4}" y="${y0 - 8}">ε<tspan baseline-shift="sub" font-size="75%">sup</tspan> = ${fmt(-eps(0) * 1000, 2)}</text>`);
  out.push(`<text x="${X1(eps(geo.h)) - 4}" y="${y0 + hp + 18}">ε<tspan baseline-shift="sub" font-size="75%">inf</tspan> = ${fmt(-eps(geo.h) * 1000, 2)}</text>`);
  // Tensiones: hormigón y barras
  const t0 = e0 + 185;
  const fcd = Math.max(...matH.comp.map((v) => -v[1]), 1);
  const kc = 64 / fcd;
  out.push(`<text class="tit" style="text-transform:none" x="${t0 - 64}" y="22">σ [MPa]</text>`);
  out.push(`<line class="ref" x1="${t0}" y1="${y0 - 6}" x2="${t0}" y2="${y0 + hp + 6}"/>`);
  const pts = [];
  const ys = [];
  const n = 40;
  for (let i = 0; i <= n; i++) { const y = (geo.h * i) / n; const sg = sigma(matH, eps(y)); if (sg < 0) { pts.push(`${t0 + sg * kc},${Y(y)}`); ys.push(y); } }
  if (pts.length) out.push(`<polygon class="sig-c" points="${t0},${Y(ys[0])} ${pts.join(' ')} ${t0},${Y(ys.at(-1))}"/>`);
  out.push(`<text x="${t0 - fcd * kc}" y="${y0 - 8}">${fmt(fcd / 1000, 1)}${ESP}MPa</text>`);
  if (matA) {
    const fy = Math.max(...matA.tracc.map((v) => v[1]), 1);
    const ks = 46 / fy;
    const barras = sec.barras.map((b) => ({ y: b.y, sg: sigma(matA, eps(b.y)), A: b.A }));
    const extremas = [barras.reduce((a, b) => (b.y < a.y ? b : a)), barras.reduce((a, b) => (b.y > a.y ? b : a))];
    for (const b of barras) out.push(`<line class="flecha" x1="${t0}" y1="${Y(b.y)}" x2="${t0 + b.sg * ks}" y2="${Y(b.y)}" marker-end="url(#pta)"/>`);
    for (const b of extremas) out.push(`<text class="fuerte" x="${t0 + 52}" y="${Y(b.y) + (b === extremas[0] ? -4 : 14)}">σ<tspan baseline-shift="sub" font-size="75%">s</tspan> = ${fmt(-b.sg / 1000, 1)}${ESP}MPa</text>`);
  }
  const Wt = t0 + 215;
  const H = y0 + hp + 40;
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${Wt} ${H}" role="img" aria-label="${t('fcr.dibujoAria')}">${out.join('')}</svg>`;
}

/** Cifras de la armadura: ø de cálculo, o en Dimensionar ø estricto y propuesto con sus áreas. */
function cifrasArmadura(c, dim) {
  const mm = (x, dd) => `${fmt(x, dd)}<span class="u"> mm</span>`;
  if (dim && c.phiProp) {
    return [[`ø ${t('fcr.estricto')}`, c.phiEstricto > 0 ? mm(c.phiEstricto, 1) : '—'], [`ø ${t('fcr.propuesto')}`, mm(c.phiProp, 0)],
      [`${sub('A', 's')} ${t('fcr.estricto')}`, qh(c.As0 * c.kEstricto, 'As')], [`${sub('A', 's')} ${t('fcr.propuesto')}`, qh(c.As0 * c.k, 'As')]];
  }
  if (dim && Number.isFinite(c.k)) return [[sub('A', 's,req'), qh(c.As0 * c.k, 'As')], ['k', fmt(c.k, 2)]];
  return c.phi0 ? [['ø', mm(est.fi ?? c.phi0, 0)], [sub('A', 's'), qh(c.As0 * c.k, 'As')], [sub('A', 's,mín'), qh(c.Amin, 'As')]] : [[sub('A', 's,mín'), qh(c.Amin, 'As')]];
}
