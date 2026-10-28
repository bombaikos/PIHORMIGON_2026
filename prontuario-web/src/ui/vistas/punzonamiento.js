// Punzonamiento de losas macizas (módulo TT3 del Prontuario 3.1): pilar rectangular o circular, interior, de borde o de
// esquina. Una sola pantalla que cambia con la norma del proyecto: EHE-08, EC-2 2004 + AN y EC-2 2023 (norma/punzonamiento/).
// No depende de una sección: losa (canto útil, cuantías), pilar y esfuerzo se escriben aquí y se guardan en el proyecto.

import { nucleo } from '../../norma/punzonamiento/index.js';
import { betaDe, anillos, nBrazos, uExterior, ramasReticula } from '../../norma/punzonamiento/comun.js';
import { areaRama } from '../../norma/cortante/ehe08.js';
import { t } from '../i18n.js';
import { fmt, q, qh, ESP, serieDiametros } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, cifras, tabla } from '../campos.js';
import { veredicto } from './flexion.js';
import { dibujoPunzonamiento } from '../dibujoPunzonamiento.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const nuc = (p) => nucleo(p.norma);
const es23 = (p) => nuc(p)?.id === 'EC2-2023';
const esEC2 = (p) => nuc(p)?.id === 'EC2-2004';
const est = { modo: 'comprobar', abiertos: new Set() };
export function reiniciar() { est.abiertos = new Set(); }

const INICIAL = () => ({
  tipo: 'rect', pos: 'interior', c1: 300, c2: 300, D: 350, h: 250, d: 210, hormigon: null, aceroCercos: null,
  rhoX: 0.008, rhoY: 0.008, sigCd: 0, VEd: 400, exc: 'aprox', betaOtro: 1.15, Dlower: 20,
  armadura: true, esq: 'cruz', nx: 5, ny: 5, fi: 10, ramas: 16, sr: 150, a1: 100, nPer: 3,
});

/** Datos de la pantalla (se guardan con el proyecto); materiales por omisión si el elegido ya no existe. */
function datosDe(p) {
  const D = (p.calculos.punzonamiento ??= {});
  for (const [k, v] of Object.entries(INICIAL())) if (D[k] === undefined) D[k] = v;
  if (!p.hormigones.some((m) => m.nombre === D.hormigon)) D.hormigon = (p.hormigones.find((m) => /30/.test(m.nombre)) ?? p.hormigones[0])?.nombre ?? null;
  if (!p.aceros.some((m) => m.nombre === D.aceroCercos)) D.aceroCercos = (p.aceros.find((m) => /500/.test(m.nombre)) ?? p.aceros[0])?.nombre ?? null;
  return D;
}

const diametrosEntrada = () => serieDiametros().filter((x) => x >= 6 && x <= 25);
const diametrosTabla = () => serieDiametros().filter((x) => x >= 8 && x <= 16);

/** Entrada común del núcleo en MPa, mm y kN. */
function entrada(p, D, { dimensionando = false } = {}) {
  const hor = p.hormigones.find((m) => m.nombre === D.hormigon);
  const ace = p.aceros.find((m) => m.nombre === D.aceroCercos);
  if (!hor || !ace) return null;
  const N = nuc(p);
  const x = {
    tipo: D.tipo, pos: D.pos, c1: D.c1, c2: D.c2, D: D.D, d: D.d, fck: hor.fck, fykCercos: ace.fyk,
    rhoX: D.rhoX, rhoY: D.rhoY, sigCd: es23(p) ? 0 : D.sigCd, beta: betaDe(N.id, D.exc, D.pos, D.betaOtro), VEd: D.VEd, Dlower: D.Dlower,
    sinArmadura: !dimensionando && !D.armadura,
  };
  x.arm = { fi: D.fi, ramas: D.esq === 'ret' ? ramasReticula(D.pos, D.nx, D.ny) : D.ramas, nx: D.nx, ny: D.ny, sr: D.sr, a1: D.a1, nPer: D.nPer, esq: D.esq };
  return x;
}

const mostrar = (c, v, d) => { const i = c.querySelector('input'); i.value = String(+v.toFixed(d)); return c; };
const calculado = (c) => { const i = c.querySelector('input'); i.disabled = true; i.tabIndex = -1; c.classList.add('calculado'); return c; };
const parejas = (campos) => {
  const c = campos.filter(Boolean);
  const filas = [];
  for (let i = 0; i < c.length; i += 2) filas.push(h('div', { class: 'par2' }, ...c.slice(i, i + 2)));
  return filas;
};
const fila = (id, nom, val, cuenta) => ({ id, nom, val, cuenta });
let refNorma = 'EHE-08';
const art = (a) => `<span class="art">${refNorma} · ${a}</span>`;
const n1 = (v, d = 2) => fmt(v, d);

export function datos(ctx, form) {
  const p = ctx.p;
  form.classList.add('est-guia');
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.punzonamiento')), h('p', {}, t('pun.subtitulo'))));
  const N = nuc(p);
  if (!N) {
    return poner(form, aviso(t('pun.pendiente', p.norma), 'info'));
  }
  const D = datosDe(p);
  const comp = est.modo === 'comprobar';
  const e23 = es23(p);
  const cambio = () => ctx.cambio();
  const set = (k) => (v) => { D[k] = v; cambio(); };
  const rect = D.tipo === 'rect';
    const beta = betaDe(N.id, D.exc, D.pos, D.betaOtro);
  const arm = true;
  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('pun.pilar'),
      segmentado({ ancho: true, etiqueta: t('pun.forma'), opciones: [['rect', t('pun.rect')], ['circ', t('pun.circ')]], valor: D.tipo, onCambio: (v) => { D.tipo = v; ctx.cambio({ estructura: true }); } }),
      segmentado({ ancho: true, etiqueta: t('pun.pos'), opciones: [['interior', t('pun.interior')], ['borde', t('pun.borde')], ['esquina', t('pun.esquina')]], valor: D.pos, onCambio: (v) => { D.pos = v; D.exc = 'aprox'; ctx.cambio({ estructura: true }); } }),
      ...(rect
        ? parejas([
          campoNum({ id: 'p-c1', etq: sub('c', '1'), ref: D.pos === 'interior' ? '' : t('pun.c1Ref'), valor: D.c1, mag: 'diam', paso: 25, min: 1, max: 5000, ayuda: t('pun.c1Ayuda'), onCambio: set('c1') }),
          campoNum({ id: 'p-c2', etq: sub('c', '2'), ref: D.pos === 'interior' ? '' : t('pun.c2Ref'), valor: D.c2, mag: 'diam', paso: 25, min: 1, max: 5000, ayuda: t('pun.c2Ayuda'), onCambio: set('c2') }),
        ])
        : parejas([campoNum({ id: 'p-D', etq: 'D', valor: D.D, mag: 'diam', paso: 25, min: 1, max: 5000, ayuda: t('pun.DAyuda'), onCambio: set('D') })])),
    ),
    grupo(t('pun.losa'),
      ...parejas([
        selector({ id: 'p-hor', linea: true, etq: t('pun.hormigon'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: D.hormigon, onCambio: (v) => { D.hormigon = v; cambio(); } }),
        campoNum({ id: 'p-h', etq: 'e', valor: D.h, mag: 'diam', paso: 10, min: 50, max: 3000, ayuda: t('pun.hAyuda'), onCambio: set('h') }),
        campoNum({ id: 'p-d', etq: e23 ? sub('d', 'v') : 'd', valor: D.d, mag: 'diam', paso: 10, min: 20, max: 3000, ayuda: t('pun.dAyuda'), onCambio: set('d') }),
        e23 ? campoNum({ id: 'p-dlow', etq: t('pun.Dlower'), valor: D.Dlower, mag: 'diam', paso: 2, min: 4, max: 63, ayuda: t('pun.DlowerAyuda'), onCambio: set('Dlower') })
          : campoNum({ id: 'p-sig', etq: sub('σ', 'cd'), ref: t('pun.sigRef'), valor: D.sigCd, mag: 'tension', paso: 0.5, min: -20, max: 40, ayuda: t('pun.sigAyuda'), onCambio: set('sigCd') }),
        campoNum({ id: 'p-rx', etq: sub('ρ', 'x'), valor: D.rhoX, mag: 'cuantia', paso: 0.5, min: 0, max: 0.1, ayuda: t('pun.rhoAyuda'), onCambio: set('rhoX') }),
        campoNum({ id: 'p-ry', etq: sub('ρ', 'y'), valor: D.rhoY, mag: 'cuantia', paso: 0.5, min: 0, max: 0.1, ayuda: t('pun.rhoAyuda'), onCambio: set('rhoY') }),
      ]),
      ...parejas([
        campoNum({ id: 'p-ved', etq: sub('V', 'Ed'), valor: D.VEd, mag: 'N', paso: 10, min: 0.01, max: 1e6, nombre: t('pun.VEdNombre'), ayuda: t('pun.VEdAyuda'), onCambio: set('VEd') }),
        campoNum({ id: 'p-beta', etq: e23 ? sub('β', 'e') : 'β', valor: beta, mag: 'ratio', paso: 0.05, min: 1, max: 3, ayuda: t('pun.betaAyuda'), onCambio: (v) => { D.betaOtro = v; D.exc = 'otro'; cambio(); } }),
      ])),
    armaduraGrupo(),
  );
  // Grupo de armadura: con un tick junto al título al comprobar (sin él se calcula la losa sin armadura)
  function armaduraGrupo() {
    const motivoDim = t('pun.motivoDim');
    const apaga = (c, motivo) => { for (const el of c.querySelectorAll('input, select')) el.disabled = true; c.title = motivo; c.classList.add('no-aplica'); return c; };
    const cruz = D.esq === 'cruz';
    const campos = parejas([
      selector({ id: 'p-ace', linea: true, etq: t('pun.acero'), opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: D.aceroCercos, onCambio: (v) => { D.aceroCercos = v; cambio(); } }),
      (() => { const c = selector({ id: 'p-fi', etq: t('cor.fi'), linea: true, opciones: diametrosEntrada().map((x) => [String(x), `ø${x}`]), valor: String(D.fi), onCambio: (v) => { D.fi = Number(v); cambio(); } }); return comp ? c : apaga(c, motivoDim); })(),
      (() => { const c = campoNum({ id: 'p-nper', etq: t('pun.nPer'), valor: D.nPer, mag: 'n', paso: 1, min: 1, max: 30, ayuda: t('pun.nPerAyuda'), onCambio: set('nPer') }); return comp ? c : apaga(c, motivoDim); })(),
      (() => { const c = campoNum({ id: 'p-ramas', etq: t('pun.ramas'), valor: D.ramas, mag: 'n', paso: 1, min: nBrazos(D.pos), max: 200, ayuda: t('pun.ramasAyuda', nBrazos(D.pos)), onCambio: set('ramas') }); return comp && cruz ? c : apaga(c, comp ? t('pun.motivoRet') : motivoDim); })(),
      (() => { const c = campoNum({ id: 'p-nx', etq: sub('n', 'x'), valor: D.nx, mag: 'n', paso: 1, min: 2, max: 40, ayuda: t('pun.nxAyuda'), onCambio: set('nx') }); return comp && !cruz ? c : apaga(c, comp ? t('pun.motivoCruz') : motivoDim); })(),
      (() => { const c = campoNum({ id: 'p-ny', etq: sub('n', 'y'), valor: D.ny, mag: 'n', paso: 1, min: 2, max: 40, ayuda: t('pun.nyAyuda'), onCambio: set('ny') }); return comp && !cruz ? c : apaga(c, comp ? t('pun.motivoCruz') : motivoDim); })(),
      campoNum({ id: 'p-a1', etq: sub('a', '1'), valor: D.a1, mag: 'diam', paso: 5, min: 0, max: 2000, ayuda: t('pun.a1Ayuda'), onCambio: set('a1') }),
      campoNum({ id: 'p-sr', etq: sub('s', 'r'), valor: D.sr, mag: 'diam', paso: 5, min: 20, max: 2000, ayuda: t('pun.srAyuda'), onCambio: set('sr') }),
    ]);
    const cuerpo = h('div', { class: 'cuerpo-arm' },
      selector({ id: 'p-esq', etq: t('pun.esq'), opciones: [['cruz', t('pun.esqCruz')], ['ret', t('pun.esqRet')]], valor: D.esq, onCambio: (v) => { D.esq = v; ctx.cambio({ estructura: true }); } }),
      ...campos);
    const leyenda = h('legend', {}, comp
      ? h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'p-arm', checked: D.armadura, onchange: (e) => { D.armadura = e.target.checked; ctx.cambio({ estructura: true }); } }), h('span', { html: t('pun.cercos') }))
      : h('span', { html: t('pun.cercos') }));
    if (comp && !D.armadura) {
      for (const el of cuerpo.querySelectorAll('input, select')) el.disabled = true;
      cuerpo.classList.add('inactivo');
      cuerpo.title = t('pun.sinArmNota');
    }
    return h('fieldset', { class: 'grupo' }, leyenda, cuerpo);
  }
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  const N = nuc(p);
  if (!N) { res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  const D = datosDe(p);
  const comp = est.modo === 'comprobar';
  const e23 = es23(p);
  const ec = esEC2(p);
  refNorma = e23 ? 'EC-2 2023' : ec ? 'EC-2 + AN' : 'EHE-08';
  const x = entrada(p, D, { dimensionando: !comp });
  if (!x) { poner(centro, aviso(t('pun.sinMat'), 'info')); res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  let r;
  try {
    r = comp ? N.comprobar(x) : N.dimensionar(x, D.VEd, { diametros: diametrosTabla() });
  } catch (e) {
    poner(centro, aviso(String(e.clave ? t(e.clave, ...(e.args ?? [])) : e.message ?? e), 'error'));
    res.append(h('div', { class: 'cuerpo' }, centro, dcha));
    return;
  }
  const avisos = (r.avisos ?? []).filter((a) => a.clave !== 'pun.av.fyd400').map((a) => aviso(t(a.clave, ...(a.args ?? []))));
  const kN = (v) => q(v, 'N');

  p.calculos.punzonamientoRes = { modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), VEd: D.VEd, beta: r.beta,
    resultado: comp ? { Vu: r.Vu, Vc: r.Vc, Vmax: r.Vmax } : { caso: r.caso, Vmax: r.Vmax } };

  // Veredicto
  const manda = comp ? t(`pun.manda.${r.manda}`) : '';
  if (comp) {
    const ok = D.VEd <= r.Vu + 1e-9;
    const detalles = ok && (r.disp.length > 0 || (r.minima && !r.minima.ok));
    for (const dd of r.disp) avisos.push(aviso(t(dd.clave, ...dd.args.map((v) => (typeof v === 'number' ? fmt(v, 0) : v)))));
    res.append(veredicto(!ok ? 'nocumple' : detalles ? 'atencion' : 'cumple', !ok ? t('cor.ver.no') : detalles ? t('cor.ver.revisar') : t('cor.ver.cumple'),
      t('aprovechamiento'), fmt(r.aprov, 2), t('pun.ver.ecu', kN(D.VEd), kN(r.Vu), ok, manda), Math.min(r.aprov / 1.25, 1)));
  } else if (r.caso === 'biela') {
    res.append(veredicto('nocumple', t('cor.ver.aum'), t('pun.armNec'), '—', t('pun.ver.necAum', kN(D.VEd), kN(r.Vmax))));
  } else if (r.caso === 'sin') {
    res.append(veredicto('cumple', t('pun.ver.sinArm'), t('pun.armNec'), '—', t('pun.ver.sin', kN(D.VEd), kN(r.Vc))));
  } else {
    const filaMin = r.tabla.reduce((a, b) => (b.Asw < a.Asw ? b : a));
    res.append(veredicto('cumple', t('cor.ver.valida'), t('pun.armNec'), `${fmt(r.AswNec ?? filaMin.AswNec, 0)}<span class="u">${ESP}mm²</span>`, t('pun.ver.nec', fmt(r.nPer, 0), kN(D.VEd))));
  }
  if (avisos.length) res.append(h('div', { class: 'avisos' }, ...avisos));

  // Centro: planta
  const dibujo = planta(p, x, r, comp, D, e23, ec, N);
  const [infoBtn, infoPop] = notas(p, D);
  poner(centro, h('h2', { class: 'tit-info' }, t('pun.t.planta'), infoBtn), infoPop, h('div', { class: 'lienzo', html: dibujo }));

  // Derecha: cifras, tabla (al dimensionar) y filas desplegables
  poner(dcha, h('h2', {}, t('cor.t.res')), cifras(cifrasDe(r, comp, e23)));
  if (!comp && r.tabla) {
    const cab = [t('pun.tabla.fi'), t('pun.tabla.ramas'), t('pun.tabla.asw'), t('pun.tabla.st'), t('pun.tabla.nPer'), t('pun.tabla.vu')];
    const filas = r.tabla.map((f) => [`ø${f.fi}`, D.esq === 'ret' ? `${f.ramas} (${f.nx}×${f.ny})` : String(f.ramas), fmt(f.Asw, 0), fmt(f.st, 0), String(f.nPer), fmt(f.Vu, 0)]);
    poner(dcha, titulos(tabla(filas, { cabecera: cab, clase: 'rejilla-res' }), ['pun.tt.fi', 'pun.tt.ramas', 'pun.tt.asw', 'pun.tt.st', 'pun.tt.nPer', 'pun.tt.vu']));
  }
  // Comprobaciones explícitas en cada perímetro crítico (con los cercos pedidos, o los de la tabla al dimensionar)
  let rc = comp ? r : null;
  if (!comp && r.caso === 'calculo') {
    const f = r.tabla.find((k) => k.fi === D.fi) ?? r.tabla[Math.floor(r.tabla.length / 2)];
    try { rc = N.comprobar({ ...x, sinArmadura: false, arm: { ...x.arm, fi: f.fi, ramas: f.ramas, nPer: f.nPer, sr: r.sr, a1: r.a1 } }); } catch { rc = null; }
  }
  if (rc && !rc.sinArmadura) poner(dcha, criticos(rc, x, D, e23, ec));
  poner(dcha, h('div', { class: 'traza' }, ...trazas(r, x, comp, D, N.id).map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  })));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Planta con los perímetros que valen para la norma y la armadura (la pedida al comprobar o la de la tabla al dimensionar). */
function planta(p, x, r, comp, D, e23, ec, N) {
  const d = x.d;
  const ctrl = e23 ? 0.5 * d : 2 * d;
  const esq = D.esq;
  let arm = null;
  if (comp) arm = r.sinArmadura ? null : { ramas: x.arm.ramas, nx: x.arm.nx, ny: x.arm.ny, an: anillos(x.arm), fi: x.arm.fi };
  else if (r.caso === 'calculo') {
    const f = r.tabla.find((k) => k.fi === D.fi) ?? r.tabla[Math.floor(r.tabla.length / 2)];
    arm = { ramas: f.ramas, nx: f.nx, ny: f.ny, an: anillos({ a1: r.a1, sr: r.sr, nPer: f.nPer }), fi: f.fi };
  }
  const perimetros = [{ delta: ctrl, clase: 'ctrl' }];
  const u = e23 ? r.u?.b05 : r.u?.u1;
  const leyenda = [['pilar', rectTexto(x)], ['ctrl', t(e23 ? 'pun.dib.b05' : 'pun.dib.u1', fmt(ctrl, 0), fmt(u ?? 0, 0))]];
  let ext = null;
  if (arm) {
    const dl = arm.an[arm.an.length - 1];
    const kd = e23 ? 0.5 * (x.d - arm.fi) : 2 * d;
    ext = { dl, kd };
    const a = { ...(x.arm ?? {}), esq, sr: comp ? x.arm.sr : r.sr, ramas: arm.ramas };
    const uProv = uExterior(x, a, dl, kd, e23 ? 3 * x.d : 0);
    const uReq = e23 ? r.b05out ?? r.tabla?.find((g) => g.fi === arm.fi)?.b05out : (r.uOutReq ?? r.unReq);
    leyenda.push(['cercos', t(esq === 'cruz' ? 'pun.dib.cercosCruz' : 'pun.dib.cercosRet', fmt(arm.ramas, 0), fmt(arm.an.length, 0), arm.fi, esq === 'ret' ? `${arm.nx}×${arm.ny}` : '')]);
    leyenda.push(['ext', t(e23 ? 'pun.dib.ext23' : ec ? 'pun.dib.extEC' : 'pun.dib.extEHE', fmt(dl + kd, 0), fmt(uProv, 0), Number.isFinite(uReq) ? fmt(uReq, 0) : '—')]);
  }
  const sv = (a, b) => `${a}<tspan baseline-shift="sub" font-size="75%">${b}</tspan>`;
  const nombres = e23 ? { u0: sv('b', '0'), ctrl: sv('b', '0,5'), ext: sv('b', '0,5,out') } : { u0: sv('u', '0'), ctrl: sv('u', '1'), ext: ec ? sv('u', 'out,ef') : sv('u', 'n,ef') };
  return dibujoPunzonamiento(x, { perimetros, anillos: arm?.an ?? [], ramas: arm?.ramas ?? 0, sinArmadura: !arm, leyenda, esq, nx: arm?.nx, ny: arm?.ny, sl: comp ? x.arm.sr : r.sr, ext, h: D.h, d: x.d, fi: arm?.fi, nombres });
}

/** Ayuda emergente en las cabeceras de una tabla (guía de diseño § 3.3). */
function titulos(tab, claves) {
  tab.querySelectorAll('thead th').forEach((th, i) => { if (claves[i]) th.title = t(claves[i]); });
  return tab;
}

/** Tabla de comprobación en los perímetros críticos: cara del pilar, perímetro de control y perímetro exterior. */
function criticos(r, x, D, e23, ec) {
  const d = x.d;
  const ok = (b) => `<span class="${b ? 'ok' : 'no'}">${b ? '✓' : '✗'}</span>`;
  const kN = (v) => fmt(v, 0);
  const ctrl = e23 ? 0.5 * d : 2 * d;
  const dl = r.deltaUltimo;
  const kd = e23 ? 0.5 * r.dvOut : 2 * d;
  const V = D.VEd;
  const uCara = e23 ? r.u.b0 : r.u.u0;
  const uCtrl = e23 ? r.u.b05 : r.u.u1;
  const capCtrl = e23 ? r.VRdcs / r.beta : r.Vcs;
  const uProv = e23 ? r.bExt : (r.uOutEf ?? r.unEf);
  const uReq = e23 ? r.b05out : (r.uOutReq ?? r.unReq);
  const nombre = (a, b) => `${sub(a, b)}`;
  const filas = [
    [t('pun.crit.cara'), '0', fmt(uCara, 0), `${kN(V)} ≤ ${kN(r.Vmax)} kN ${ok(V <= r.Vmax + 1e-9)}`],
    [t('pun.crit.ctrl', e23 ? nombre('b', '0,5') : nombre('u', '1')), fmt(ctrl, 0), fmt(uCtrl, 0), `${kN(V)} ≤ ${kN(capCtrl)} kN ${ok(V <= capCtrl + 1e-9)}`],
    [t('pun.crit.ext', e23 ? nombre('b', '0,5,out') : ec ? nombre('u', 'out,ef') : nombre('u', 'n,ef')), fmt(dl + kd, 0), fmt(uProv, 0), `${fmt(uProv, 0)} ≥ ${fmt(uReq, 0)} mm ${ok(uProv >= uReq - 1e-6)}`],
  ];
  return h('div', { class: 'pun-criticos' },
    titulos(tabla(filas, { cabecera: [t('pun.crit.t'), t('pun.crit.dist'), t('pun.crit.long'), t('pun.crit.comp')], clase: 'rejilla-res' }), ['pun.tt.per', 'pun.tt.dist', 'pun.tt.long', 'pun.tt.comp']));
}

const rectTexto = (x) => (x.tipo === 'rect' ? t('pun.dib.pilarR', fmt(x.c1, 0), fmt(x.c2, 0), t(`pun.${x.pos}`).toLowerCase())
  : t('pun.dib.pilarC', fmt(x.D, 0), t(`pun.${x.pos}`).toLowerCase()));

/** Cifras de la columna de resultados. */
function cifrasDe(r, comp, e23) {
  const kN = (v) => qh(v, 'N');
  const mmL = (v) => `${fmt(v, 0)}<span class="u">${ESP}mm</span>`;
  const per = e23 ? [[`${sub('b', '0,5')} · ${sub('b', '0')}`, `${fmt(r.u.b05, 0)} · ${fmt(r.u.b0, 0)}<span class="u">${ESP}mm</span>`]]
    : [[`${sub('u', '1')} · ${sub('u', '0')}`, `${fmt(r.u.u1, 0)} · ${fmt(r.u.u0, 0)}<span class="u">${ESP}mm</span>`]];
  const b = [[e23 ? sub('β', 'e') : 'β', fmt(r.beta, 2)]];
  void mmL;
  if (!comp) return [[t('pun.c.vc'), kN(r.Vc)], [t('pun.c.vmax'), kN(r.Vmax)], ...per, ...b];
  if (r.sinArmadura) return [[t('pun.c.vc'), kN(r.Vc)], [t('pun.c.vmax'), kN(r.Vmax)], ...per, ...b];
  if (e23) return [[t('pun.c.vc'), kN(r.Vc)], [t('pun.c.vcs'), kN(r.VuEf / r.beta)], [t('pun.c.vmax'), kN(r.Vmax)], ['η<sub>c</sub> · η<sub>s</sub>', `${fmt(r.etaC, 2)} · ${fmt(r.etaS, 2)}`], ...per];
  return [[t('pun.c.vc'), kN(r.Vc)], [t('pun.c.vcs'), kN(r.Vcs)], [t('pun.c.vmax'), kN(r.Vmax)], [t('pun.c.vext'), kN(r.Vext)], ...per];
}

/** Filas desplegables con el cálculo (fórmula, valores y artículo). */
function trazas(r, x, comp, D, id) {
  if (id === 'EC2-2023') return trazas23(r, x, comp);
  if (id === 'EC2-2004') return trazasEC2(r, x, comp);
  return trazasEHE(r, x, comp);
}

const filaPerim = (r, x, e23) => fila('per', t('pun.r.per'), e23 ? q(r.u.b05, 'diam') : q(r.u.u1, 'diam'),
  `<span class="f">${t(e23 ? 'pun.f.per23' : 'pun.f.per')}</span><span class="n">${e23 ? `${sub('b', '0,5')} = ${n1(r.u.b05, 0)} mm · ${sub('b', '0')} = ${n1(r.u.b0, 0)} mm · d<sub>v</sub> = ${n1(x.d, 0)} mm` : `${sub('u', '1')} = ${n1(r.u.u1, 0)} mm (2d = ${n1(2 * x.d, 0)} mm) · ${sub('u', '0')} = ${n1(r.u.u0, 0)} mm`}</span>${art(e23 ? '8.4.2(2)-(3)' : refNorma === 'EHE-08' ? '46.2, 46.4.3' : '6.4.2, 6.4.5(3)')}`);

function trazasEHE(r, x, comp) {
  const P = r.P;
  const f = [filaPerim(r, x, false)];
  f.push(fila('tau', t('pun.r.tau'), `${fmt(r.tau.tau, 3)}<span class="u">${ESP}MPa</span>`,
    `<span class="f">${t('pun.f.tauEHE')}</span><span class="n">ξ = ${n1(P.xi, 3)} · ρ<sub>l</sub> = ${n1(P.rho * 1000, 2)} ‰ · f<sub>cv</sub> = ${n1(P.fcv, 0)} MPa · σ'<sub>cd</sub> = ${n1(P.sigCdLim)} MPa</span>`
    + `<span class="n">${t('pun.v.concMin', fmt(r.tau.conc, 3), fmt(r.tau.min, 3))}</span>${art('46.3')}`));
  f.push(fila('vc', t('pun.r.vc'), q(r.Vc, 'N'),
    `<span class="f">${t('pun.f.vcEHE')}</span><span class="n">${fmt(r.tau.tau, 3)} × ${n1(r.u.u1, 0)} × ${n1(x.d, 0)} / ${n1(r.beta, 2)} = ${q(r.Vc, 'N')}</span>${art('46.3')}`));
  f.push(fila('vmax', t('pun.r.vmax'), q(r.Vmax, 'N'),
    `<span class="f">${t('pun.f.vmaxEHE')}</span><span class="n">${t('cor.f.f1cd', P.fck)} → ${n1(P.f1cd)} MPa · ${sub('u', '0')} = ${n1(r.u.u0, 0)} mm</span>${art('46.4.3')}`));
  if (comp && !r.sinArmadura) {
    f.push(fila('vcs', t('pun.r.vcs'), q(r.Vcs, 'N'),
      `<span class="f">${t('pun.f.vcsEHE')}</span><span class="n">${sub('A', 'sw')} = ${n1(r.Asw, 0)} mm² · s = ${n1(x.arm.sr, 0)} mm · f<sub>yα,d</sub> = ${n1(P.fyd, 0)} MPa${P.topada ? ` (${t('pun.tope400')})` : ''}</span>`
      + `<span class="n">0,75 × ${n1(r.F0, 0)} + ${n1(r.Fs, 0)} = ${n1(r.Fcs, 0)} kN → ${q(r.Vcs, 'N')} (÷ β)</span>${art('46.4.1')}`));
    f.push(fila('ext', t('pun.r.ext'), q(r.Vext, 'N'),
      `<span class="f">${t('pun.f.extEHE')}</span><span class="n">${sub('u', 'n,ef')} = ${n1(r.unEf, 0)} mm (a 2d = ${n1(2 * x.d, 0)} mm del último perímetro, que está a ${n1(r.deltaUltimo, 0)} mm del pilar)</span>${art('46.4.2')}`));
    f.push(...filasDisp(r, x));
  } else if (!comp && r.caso === 'calculo') {
    f.push(fila('asw', t('pun.r.asw'), `${fmt(r.AswNec, 0)}<span class="u">${ESP}mm²</span>`,
      `<span class="f">${t('pun.f.aswEHE')}</span><span class="n">β·V<sub>Ed</sub> = ${n1(r.Fef, 0)} kN · 0,75 τ<sub>rd</sub> u<sub>1</sub> d = ${n1(0.75 * r.F0, 0)} kN · s = ${n1(r.sr, 0)} mm</span>${art('46.4.1')}`));
    f.push(fila('nper', t('pun.r.nper'), String(r.nPer),
      `<span class="f">${t('pun.f.nperEHE')}</span><span class="n">${sub('u', 'n,ef')} ≥ ${n1(r.unReq, 0)} mm → δ = ${n1(r.deltaExt, 0)} mm; a<sub>1</sub> = ${n1(r.a1, 0)} mm, s = ${n1(r.sr, 0)} mm</span>${art('46.4.2')}`));
  }
  return f;
}

function trazasEC2(r, x, comp) {
  const P = r.P;
  const f = [filaPerim(r, x, false)];
  f.push(fila('tau', t('pun.r.vRdc'), `${fmt(r.v.v, 3)}<span class="u">${ESP}MPa</span>`,
    `<span class="f">${t('pun.f.vRdcEC')}</span><span class="n">k = ${n1(P.k, 3)} · ρ<sub>l</sub> = ${n1(P.rho * 1000, 2)} ‰ · σ<sub>cp</sub> = ${n1(P.sigCp)} MPa · ν<sub>mín</sub> = ${n1(r.v.nuMin, 3)} MPa</span>`
    + `<span class="n">${t('pun.v.concMin', fmt(r.v.conc, 3), fmt(r.v.min, 3))}</span>${art('6.4.4(1), AN')}`));
  f.push(fila('vc', t('pun.r.vc'), q(r.Vc, 'N'),
    `<span class="f">${t('pun.f.vcEC')}</span><span class="n">${fmt(r.v.v, 3)} × ${n1(r.u.u1, 0)} × ${n1(x.d, 0)} / ${n1(r.beta, 2)} = ${q(r.Vc, 'N')}</span>${art('6.4.3(2), (3)')}`));
  f.push(fila('vmax', t('pun.r.vmax'), q(r.Vmax, 'N'),
    `<span class="f">${t('pun.f.vmaxEC')}</span><span class="n">ν = ${n1(P.nu, 3)} · f<sub>cd</sub> = ${n1(P.fcd)} MPa → v<sub>Rd,máx</sub> = ${n1(P.vRdMax)} MPa · ${sub('u', '0')} = ${n1(r.u.u0, 0)} mm</span>${art('6.4.5(3), AN')}`));
  if (comp && !r.sinArmadura) {
    f.push(fila('vcs', t('pun.r.vcs'), q(r.Vcs, 'N'),
      `<span class="f">${t('pun.f.vcsEC')}</span><span class="n">${sub('A', 'sw')} = ${n1(r.Asw, 0)} mm² · s<sub>r</sub> = ${n1(x.arm.sr, 0)} mm · f<sub>ywd,ef</sub> = ${n1(P.fywdEf, 0)} MPa (f<sub>ywd</sub> = ${n1(P.fywd, 0)})</span>`
      + `<span class="n">0,75 × ${n1(r.F0, 0)} + ${n1(r.Fs, 0)} = ${n1(r.Fcs, 0)} kN → ${q(r.Vcs, 'N')} (÷ β)</span>${art('6.4.5(1)')}`));
    f.push(fila('ext', t('pun.r.ext'), q(r.Vext, 'N'),
      `<span class="f">${t('pun.f.extEC')}</span><span class="n">${sub('u', 'out,ef')} ≤ ${n1(r.uOutEf, 0)} mm (k·d = ${n1(2 * x.d, 0)} mm del último perímetro, a ${n1(r.deltaUltimo, 0)} mm del pilar)</span>${art('6.4.5(4), AN')}`));
    f.push(fila('min', t('pun.r.min'), r.minima.ok ? t('cor.ok') : t('cor.noOk'),
      `<span class="f">${t('pun.f.minEC')}</span><span class="n">${t('pun.v.minVal', n1(r.minima.rhoW * 1000, 2), n1(r.minima.rhoMin * 1000, 2))}</span>${art('9.4.3(2), (9.11)')}`));
    f.push(...filasDisp(r, x));
  } else if (!comp && r.caso === 'calculo') {
    f.push(fila('asw', t('pun.r.asw'), `${fmt(r.AswNec, 0)}<span class="u">${ESP}mm²</span>`,
      `<span class="f">${t('pun.f.aswEC')}</span><span class="n">β·V<sub>Ed</sub> = ${n1(r.Fef, 0)} kN · 0,75 v<sub>Rd,c</sub> u<sub>1</sub> d = ${n1(0.75 * r.F0, 0)} kN · s<sub>r</sub> = ${n1(r.sr, 0)} mm</span>${art('6.4.5(1)')}`));
    f.push(fila('nper', t('pun.r.nper'), String(r.nPer),
      `<span class="f">${t('pun.f.nperEC')}</span><span class="n">${sub('u', 'out,ef')} = ${n1(r.uOutReq, 0)} mm → δ = ${n1(r.deltaOut, 0)} mm; mínimo 2 perímetros</span>${art('6.4.5(4), 9.4.3(1)')}`));
  }
  return f;
}

function trazas23(r, x, comp) {
  const P = r.P;
  const s = r.s;
  const f = [filaPerim(r, x, true)];
  f.push(fila('kpb', t('pun.r.kpb'), n1(s.kpb, 2),
    `<span class="f">${t('pun.f.kpb')}</span><span class="n">${sub('b', '0')} = ${n1(r.u.b0, 0)} mm · ${sub('b', '0,5')} = ${n1(r.u.b05, 0)} mm → 3,6·(1 − ${n1(r.u.b0 / r.u.b05, 3)}) = ${n1(s.kpbBruto, 2)}</span>${art('8.4.3(1), (8.96)')}`));
  f.push(fila('tau', t('pun.r.tau'), `${fmt(s.tau, 3)}<span class="u">${ESP}MPa</span>`,
    `<span class="f">${t('pun.f.tau23')}</span><span class="n">ρ<sub>l</sub> = ${n1(P.rho * 1000, 2)} ‰ · d<sub>dg</sub> = ${n1(P.ddg, 0)} mm · γ<sub>V</sub> = ${n1(P.gv, 1)} · d<sub>v</sub> = ${n1(x.d, 0)} mm</span>`
    + `<span class="n">${t('pun.v.tau23', fmt(s.conc, 3), fmt(s.tope, 3))}</span>${art('8.4.3(1), (8.94)')}`));
  f.push(fila('vc', t('pun.r.vRdc'), q(s.VRdc, 'N'),
    `<span class="f">${t('pun.f.vRdc23')}</span><span class="n">${fmt(s.tau, 3)} × ${n1(r.u.b05, 0)} × ${n1(x.d, 0)} = ${q(s.VRdc, 'N')} → ${q(r.Vc, 'N')} (÷ β<sub>e</sub> = ${n1(r.beta, 2)})</span>${art('8.4.2(6), (8.92)')}`));
  f.push(fila('vmax', t('pun.r.vmax'), q(r.Vmax, 'N'),
    `<span class="f">${t('pun.f.vmax23')}</span><span class="n">η<sub>sys</sub> = ${n1(s.etaSys, 3)} (b<sub>0</sub>/d<sub>v</sub> = ${n1(r.u.b0 / x.d, 2)}) → V<sub>Rd,máx</sub> = ${q(s.VRdMax, 'N')}</span>${art('8.4.4(5), (8.111)')}`));
  if (comp && !r.sinArmadura) {
    f.push(fila('etas', t('pun.r.etas'), `${fmt(r.etaC, 2)} · ${fmt(r.etaS, 2)}`,
      `<span class="f">${t('pun.f.etas')}</span><span class="n">V<sub>Ed,ef</sub> = ${n1(Number.isFinite(r.VEd) ? r.beta * r.VEd : r.VuEf, 0)} kN → η<sub>c</sub> = ${n1(r.etaC, 3)} · η<sub>s</sub> = ${n1(r.etaS, 3)} (≤ 0,8) · φ<sub>w</sub> = ${n1(x.arm.fi, 0)} mm</span>${art('8.4.4(1), (8.105), (8.106)')}`));
    f.push(fila('vcs', t('pun.r.vcs'), q(r.VuEf / r.beta, 'N'),
      `<span class="f">${t('pun.f.vcs23')}</span><span class="n">${sub('A', 'sw,per')} = ${n1(r.Asw, 0)} mm² · s<sub>r</sub> = ${n1(r.srEf, 0)} mm · f<sub>ywd</sub> = ${n1(P.fywd, 0)} MPa → V<sub>w</sub> = ${q(r.Vw, 'N')}</span>`
      + `<span class="n">${t('pun.v.vcs23', n1(r.VRdcs, 0), q(r.VuEf, 'N'))}</span>${art('8.4.4(1), (8.104), (8.107)')}`));
    f.push(fila('ext', t('pun.r.ext'), n1(r.b05out, 0) + `${ESP}mm`,
      `<span class="f">${t('pun.f.ext23')}</span><span class="n">d<sub>v,out</sub> = ${n1(r.dvOut, 0)} mm · ${sub('b', '0,5,out')} = ${n1(r.b05out, 0)} mm → δ = ${n1(r.deltaOut, 0)} mm; el último perímetro está a ${n1(r.deltaUltimo, 0)} mm${r.extOk ? '' : ' (' + t('pun.noLlega') + ')'}</span>${art('8.4.4(7), (8.112)')}`));
    f.push(...filasDisp(r, x));
  } else if (!comp && r.caso === 'calculo') {
    f.push(fila('etas', t('pun.r.etas'), `${fmt(r.etaCEf, 2)}`,
      `<span class="f">${t('pun.f.etasDim')}</span><span class="n">V<sub>Ed,ef</sub> = ${n1(r.Vef, 0)} kN → η<sub>c</sub> = ${n1(r.etaCEf, 3)}; η<sub>s</sub> por diámetro en la tabla</span>${art('8.4.4(1)')}`));
    f.push(fila('nper', t('pun.r.nper'), String(r.nPer),
      `<span class="f">${t('pun.f.nper23')}</span><span class="n">${sub('b', '0,5,out')} → δ = ${n1(r.deltaOut, 0)} mm; a<sub>1</sub> = ${n1(r.a1, 0)} mm, s<sub>1</sub> = ${n1(r.sr, 0)} mm; mínimo 2 perímetros</span>${art('8.4.4(7), 12.5.1(2)')}`));
  }
  return f;
}

function filasDisp(r, x) {
  if (!r.disp?.length) return [fila('disp', t('pun.r.disp'), t('cor.ok'), `<span class="f">${t('pun.f.disp')}</span>${art(refNorma === 'EC-2 2023' ? '12.5.1' : refNorma === 'EHE-08' ? '46.5' : '9.4.3')}`)];
  return [fila('disp', t('pun.r.disp'), t('cor.noOk'), `<span class="f">${t('pun.f.disp')}</span>${r.disp.map((dd) => `<span class="n">${t(dd.clave, ...dd.args.map((v) => (typeof v === 'number' ? fmt(v, 0) : v)))}</span>`).join('')}${art(refNorma === 'EC-2 2023' ? '12.5.1' : refNorma === 'EHE-08' ? '46.5' : '9.4.3')}`)];
}

/** Aclaraciones plegadas (guía § 14.9). */
function notas(p, D) {
  const e23 = es23(p);
  const ec = esEC2(p);
  const claves = [['pun.n.alcance', e23 ? 'pun.alcance23' : 'pun.alcance'], ['pun.n.perim', e23 ? 'pun.perim23' : 'pun.perim'], ['pun.n.beta', e23 ? 'pun.beta23' : 'pun.beta']];
  claves.push(['pun.n.esq', 'pun.esqNota']);
  if (D.tipo === 'circ') claves.push(['pun.n.circ', 'pun.circNota']);
  claves.push(['pun.n.norma', e23 ? 'pun.nota23' : ec ? 'pun.notaEC' : 'pun.notaEHE']);
  const pop = h('div', { class: 'pun-info', hidden: true, role: 'dialog', 'aria-label': t('cor.notas') },
    ...claves.map(([k, v]) => h('details', { class: 'pleg' }, h('summary', {}, h('span', { html: t(k) })), h('div', { class: 'cuenta' }, h('p', { class: 'nota', html: t(v) })))));
  const cerrar = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) fuera(); };
  const fuera = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', cerrar); };
  const btn = h('button', { type: 'button', class: 'info-btn', 'aria-label': t('cor.notas'), 'aria-expanded': 'false', title: t('cor.notas'),
    onclick: () => { if (pop.hidden) { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); setTimeout(() => document.addEventListener('click', cerrar), 0); } else fuera(); } }, 'i');
  return [btn, pop];
}

export function comandos(ctx) {
  return [
    { k: 'pun.cmdComprobar', b: 'punzonamiento comprobar punching check', f: () => { est.modo = 'comprobar'; ctx.ir('punzonamiento'); } },
    { k: 'pun.cmdDimensionar', b: 'punzonamiento dimensionar punching design', f: () => { est.modo = 'dimensionar'; ctx.ir('punzonamiento'); } },
  ];
}
