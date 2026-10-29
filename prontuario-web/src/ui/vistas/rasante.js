// Rasante en juntas entre hormigones (módulo TT5 del Prontuario 3.1, que era la formulación de la EHE-98): comprobar y
// dimensionar el cosido de una junta plana entre dos hormigones. Una sola pantalla que cambia con la norma del
// proyecto: EHE-08 (art. 47), EC-2 2004 + AN (6.2.5) y EC-2 2023 (8.2.6) (norma/rasante/). El esfuerzo rasante R_Ed
// se escribe directo (kN sobre la longitud L); no depende de una sección y se guarda con el proyecto.

import { nucleo } from '../../norma/rasante/index.js';
import { t } from '../i18n.js';
import { fmt, q, qh, ESP, serieDiametros } from '../formato.js';
import { h, poner, campoNum, selector, segmentado, grupo, aviso, cifras, tabla } from '../campos.js';
import { veredicto } from './flexion.js';
import { dibujoRasante } from '../dibujoRasante.js';
import { filaTraza } from './rasanteTraza.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const nuc = (p) => nucleo(p.norma);
const est = { modo: 'comprobar', abiertos: new Set() };
export function reiniciar() { est.abiertos = new Set(); }

const INICIAL = () => ({
  hormigon1: null, hormigon2: null, aceroCosido: null, rug: null,
  b: 200, L: 1000, REd: 200, sigN: 0, alfa: 90, h: 0, emin: 0,
  fatiga: false, anclado: true, topping: false, bordeCerca: false,
  sin: false, fi: 8, ramas: 2, s: 100,
});

/** Datos de la pantalla (se guardan con el proyecto); materiales y rugosidad por omisión si no valen. */
function datosDe(p, N) {
  const D = (p.calculos.rasante ??= {});
  for (const [k, v] of Object.entries(INICIAL())) if (D[k] === undefined) D[k] = v;
  const hor = (re) => (p.hormigones.find((m) => re.test(m.nombre)) ?? p.hormigones[0])?.nombre ?? null;
  if (!p.hormigones.some((m) => m.nombre === D.hormigon1)) D.hormigon1 = hor(/30/);
  if (!p.hormigones.some((m) => m.nombre === D.hormigon2)) D.hormigon2 = hor(/25/);
  if (!p.aceros.some((m) => m.nombre === D.aceroCosido)) D.aceroCosido = (p.aceros.find((m) => /500/.test(m.nombre)) ?? p.aceros[0])?.nombre ?? null;
  if (N && !(D.rug in N.RUGOSIDADES)) D.rug = N.id === 'EHE-08' ? 'alta' : 'rugosa';
  return D;
}

const diametrosEntrada = () => serieDiametros().filter((x) => x >= 6 && x <= 25);
const diametrosTabla = () => serieDiametros().filter((x) => x >= 8 && x <= 20);

/** Entrada común del núcleo en MPa, mm y kN. El hormigón que manda es el más débil de la junta. */
function entrada(p, D, { dimensionando = false } = {}) {
  const h1 = p.hormigones.find((m) => m.nombre === D.hormigon1);
  const h2 = p.hormigones.find((m) => m.nombre === D.hormigon2);
  const ace = p.aceros.find((m) => m.nombre === D.aceroCosido);
  if (!h1 || !h2 || !ace) return null;
  return {
    fck: Math.min(h1.fck, h2.fck), fykCosido: ace.fyk, rug: D.rug, b: D.b, L: D.L, REd: D.REd, sigN: D.sigN, alfa: D.alfa,
    fatiga: D.fatiga, anclado: D.anclado, topping: D.topping, bordeCerca: D.bordeCerca, h: D.h, emin: D.emin, ramas: D.ramas,
    sinArmadura: !dimensionando && (D.sin || (nuc(p).id !== 'EC2-2023' && !D.anclado)), arm: { fi: D.fi, ramas: D.ramas, s: D.s },
  };
}

const parejas = (campos) => {
  const c = campos.filter(Boolean);
  const filas = [];
  for (let i = 0; i < c.length; i += 2) filas.push(h('div', { class: 'par2' }, ...c.slice(i, i + 2)));
  return filas;
};

export function datos(ctx, form) {
  const p = ctx.p;
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.rasante')), h('p', {}, t('ras.subtitulo'))));
  const N = nuc(p);
  if (!N) return poner(form, aviso(t('ras.pendiente', p.norma), 'info'));
  const D = datosDe(p, N);
  const comp = est.modo === 'comprobar';
  const cambio = () => ctx.cambio();
  const set = (k) => (v) => { D[k] = v; cambio(); };
  const ehe = N.id === 'EHE-08';
  const e23 = N.id === 'EC2-2023';
  const arm = !D.sin || !comp;
  const rugs = Object.keys(N.RUGOSIDADES);
  const opciones = [];
  if (!e23) opciones.push(['fatiga', t('ras.fatiga')]);
  if (e23 && !D.anclado) opciones.push(['topping', t('ras.topping')], ['bordeCerca', t('ras.bordeCerca')]);
  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('ras.junta'),
      selector({ id: 'r-h1', linea: true, etq: t('ras.hormigon1'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: D.hormigon1, onCambio: (v) => { D.hormigon1 = v; cambio(); } }),
      selector({ id: 'r-h2', linea: true, etq: t('ras.hormigon2'), opciones: p.hormigones.map((m) => [m.nombre, m.nombre]), valor: D.hormigon2, onCambio: (v) => { D.hormigon2 = v; cambio(); } }),
      selector({ id: 'r-rug', linea: true, etq: t('ras.rug'), opciones: rugs.map((k) => [k, t(`ras.rug.${k}`)]), valor: D.rug, onCambio: (v) => { D.rug = v; cambio(); } }),
      ...parejas([
        campoNum({ id: 'r-b', etq: 'b', valor: D.b, mag: 'diam', paso: 25, min: 10, max: 5000, ayuda: t('ras.bAyuda'), onCambio: set('b') }),
        campoNum({ id: 'r-L', etq: 'L', valor: D.L, mag: 'diam', paso: 100, min: 10, max: 100000, ayuda: t('ras.LAyuda'), onCambio: set('L') }),
        campoNum({ id: 'r-red', etq: sub('R', 'Ed'), valor: D.REd, mag: 'N', paso: 10, min: 0.01, max: 1e7, nombre: t('ras.REdNombre'), ayuda: t('ras.REdAyuda'), onCambio: set('REd') }),
        campoNum({ id: 'r-sig', etq: sub('σ', 'n'), ref: t('ras.sigRef'), valor: D.sigN, mag: 'tension', paso: 0.5, min: -20, max: 40, ayuda: t('ras.sigAyuda'), onCambio: set('sigN') }),
      ]),
      ehe ? h('div', { class: 'par2' },
        campoNum({ id: 'r-hc', etq: 'h', valor: D.h, mag: 'diam', paso: 25, min: 0, max: 5000, ayuda: t('ras.hAyuda'), onCambio: set('h') }),
        campoNum({ id: 'r-emin', etq: sub('e', 'mín'), valor: D.emin, mag: 'diam', paso: 10, min: 0, max: 2000, ayuda: t('ras.eminAyuda'), onCambio: set('emin') })) : null,
      ...opciones.map(([k, etq]) => h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: `r-${k}`, checked: D[k], onchange: (e) => { D[k] = e.target.checked; cambio(); } }), h('span', { html: etq })))),
    (() => {
      const cuerpo = h('div', { class: 'cuerpo-arm' },
        h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'r-anc', checked: D.anclado, onchange: (e) => { D.anclado = e.target.checked; ctx.pintar(); } }), h('span', { html: t(e23 ? 'ras.anclado' : 'ras.anclado2') })),
        h('div', { class: 'par2' },
          selector({ id: 'r-ace', linea: true, etq: t('ras.acero'), opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: D.aceroCosido, onCambio: (v) => { D.aceroCosido = v; cambio(); } }),
          (e23 && !D.anclado) ? null : campoNum({ id: 'r-alfa', etq: 'α', valor: D.alfa, mag: 'ang', paso: 5, min: N.ALFA_MIN, max: e23 && D.rug === 'muyLisa' ? 90 : N.ALFA_MAX, ayuda: t('ras.alfaAyuda', N.ALFA_MIN, N.ALFA_MAX), onCambio: set('alfa') })),
        ...parejas([
          comp ? selector({ id: 'r-fi', etq: t('cor.fi'), linea: true, opciones: diametrosEntrada().map((x) => [String(x), `ø${x}`]), valor: String(D.fi), onCambio: (v) => { D.fi = Number(v); cambio(); } }) : null,
          campoNum({ id: 'r-ramas', etq: t('ras.ramas'), valor: D.ramas, mag: 'n', paso: 1, min: 1, max: 100, ayuda: t('ras.ramasAyuda'), onCambio: set('ramas') }),
          comp ? campoNum({ id: 'r-s', etq: 's', valor: D.s, mag: 'diam', paso: 25, min: 20, max: 2000, ayuda: t('ras.sAyuda'), onCambio: set('s') }) : null,
        ]));
      const leyenda = h('legend', {}, comp
        ? h('label', { class: 'tick' }, h('input', { type: 'checkbox', id: 'r-arm', checked: !D.sin, onchange: (e) => { D.sin = !e.target.checked; ctx.pintar(); } }), h('span', { html: t('ras.cosido') }))
        : h('span', { html: t('ras.cosido') }));
      if (!arm) {
        for (const el of cuerpo.querySelectorAll('input, select')) el.disabled = true;
        cuerpo.classList.add('inactivo');
        cuerpo.title = t('ras.sinArmNota');
      }
      return h('fieldset', { class: 'grupo' }, leyenda, cuerpo);
    })());
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  const N = nuc(p);
  if (!N) { res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  const D = datosDe(p, N);
  const comp = est.modo === 'comprobar';
  const x = entrada(p, D, { dimensionando: !comp });
  if (!x) { poner(centro, aviso(t('ras.sinMat'), 'info')); res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  let r;
  try {
    r = comp ? N.comprobar(x) : N.dimensionar(x, D.REd, { diametros: diametrosTabla() });
  } catch (e) {
    poner(centro, aviso(String(e.clave ? t(e.clave, ...(e.args ?? [])) : e.message ?? e), 'error'));
    res.append(h('div', { class: 'cuerpo' }, centro, dcha));
    return;
  }
  const avisos = (r.avisos ?? []).map((a) => aviso(t(a.clave, ...(a.args ?? []).map((v) => (typeof v === 'number' ? fmt(v, Math.abs(v) < 10 ? 2 : 0) : v)))));
  const kN = (v) => q(v, 'N');

  p.calculos.rasanteRes = { modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), REd: D.REd,
    resultado: comp ? { Ru: r.Ru, tauRd: r.tauRd, tauEd: r.tauEd } : { caso: r.caso, rhoNec: r.rhoNec ?? null } };

  // Veredicto
  if (comp) {
    const ok = D.REd <= r.Ru + 1e-9;
    const hayAviso = (r.avisos ?? []).length > 0;
    res.append(veredicto(!ok ? 'nocumple' : hayAviso ? 'atencion' : 'cumple', !ok ? t('cor.ver.no') : hayAviso ? t('cor.ver.revisar') : t('cor.ver.cumple'),
      t('aprovechamiento'), fmt(r.aprov, 2), t('ras.ver.ecu', kN(D.REd), kN(r.Ru), ok, `${t(`ras.manda.${r.manda}`)} (${r.formula})`), Math.min(r.aprov / 1.25, 1)));
  } else if (r.caso === 'limite') {
    res.append(veredicto('nocumple', t('cor.ver.aum'), t('ras.armNec'), '—', t('ras.ver.necAum', kN(D.REd), kN(r.Rmax))));
  } else if (r.caso === 'sin') {
    res.append(veredicto('cumple', t('ras.ver.sinArm'), t('ras.armNec'), '—', t('ras.ver.sin', kN(D.REd), q(r.tauSin, 'tension'))));
  } else {
    const rhoTxt = fmt(r.rhoNec * 1000, 2);
    res.append(veredicto('cumple', t('cor.ver.valida'), t('ras.armNec'), qh(r.AswSNec / 1000, 'AswS'), t('ras.ver.nec', rhoTxt, kN(D.REd))));
  }
  if (N.id !== 'EC2-2023' && !D.anclado) avisos.push(aviso(t(comp ? 'ras.av.noAnclado' : 'ras.av.noAncladoDim')));
  if (avisos.length) res.append(h('div', { class: 'avisos' }, ...avisos));

  // Centro: alzado de la junta
  const sinArm = comp ? !!x.sinArmadura : r.caso !== 'calculo';
  const ley = [['h2', t('ras.dib.l2', D.hormigon2)], ['h1', t('ras.dib.l1', D.hormigon1)], ['junta', t('ras.dib.lj', t(`ras.rug.${D.rug}`).toLowerCase())]];
  let sDib = D.s;
  if (!comp && r.caso === 'calculo') {
    const f = r.tabla.find((k) => k.fi === D.fi && k.s) ?? r.tabla.find((k) => k.s);
    sDib = f?.s ?? D.s;
    if (f) ley.push(['cosido', t('ras.dib.lc', fmt(f.ramas, 0), f.fi, fmt(f.s, 0))]);
  } else if (comp && !sinArm) ley.push(['cosido', t('ras.dib.lc', fmt(D.ramas, 0), D.fi, fmt(D.s, 0))]);
  poner(centro, h('h2', {}, t('ras.t.junta')), h('div', { class: 'lienzo', html: dibujoRasante({ ramas: D.ramas, fi: !comp && r.caso === 'calculo' ? (r.tabla.find((k) => k.fi === D.fi && k.s) ?? r.tabla.find((k) => k.s))?.fi : D.fi, alfa: N.id === 'EC2-2023' && !D.anclado ? 90 : D.alfa, sinAlfa: N.id === 'EC2-2023' && !D.anclado, L: D.L, s: sDib, sinArmadura: sinArm || (!comp && r.caso !== 'calculo'), rugosa: D.rug !== 'muyLisa', REd: D.REd, b: D.b, leyenda: ley }) }), notas(N, D));

  // Derecha: cifras, tabla (al dimensionar) y filas desplegables
  poner(dcha, h('h2', {}, t('cor.t.res')), cifras(cifrasDe(r, comp, N)));
  if (!comp && r.caso === 'calculo') {
    const cab = [t('cor.tabla.fi'), t('ras.tabla.ramas'), t('ras.tabla.asw'), t('ras.tabla.s'), t('ras.tabla.asws')];
    const filas = r.tabla.map((f) => [`ø${f.fi}`, String(f.ramas), fmt(f.Asw, 0), f.s ? fmt(f.s, 0) : '—', f.s ? fmt(f.AswS / 100, 2) : '—']);
    poner(dcha, tabla(filas, { cabecera: cab }), h('p', { class: 'nota', html: t('ras.tabla.nota', fmt(D.ramas, 0), r.sMax != null && Number.isFinite(r.sMax) ? fmt(Math.min(300, r.sMax), 0) : '300') }));
  }
  poner(dcha, h('div', { class: 'traza' }, ...filaTraza(r, x, comp, D, N).map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  })));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Cifras de la columna de resultados. */
function cifrasDe(r, comp, N) {
  const tau = (v, d = 2) => `${fmt(v, d)}<span class="u">${ESP}MPa</span>`;
  const kN = (v) => qh(v, 'N');
  const fyd = [sub('f', N.id === 'EHE-08' ? 'yα,d' : 'yd'), tau(r.P.fyd, 0)];
  if (comp) {
    const mu = r.res.mu == null ? '—' : fmt(r.res.mu, 1);
    const etqMu = N.id === 'EHE-08' && r.res.estado ? t('ras.c.muEstado', r.res.estado) : 'μ';
    return [[sub('τ', 'Ed'), tau(r.tauEd)], [sub('τ', 'Rd'), tau(r.tauRd)], [sub('R', 'u'), kN(r.Ru)], [t('ras.c.rmax'), kN(r.Rmax)],
      [t('ras.c.coh'), tau(r.res.coh)], [t('ras.c.fric'), tau(r.res.fric)], [t('ras.c.cosido'), tau(r.res.cosido)], ['ρ', `${fmt(r.rho * 1000, 2)}<span class="u">${ESP}‰</span>`],
      fyd, [etqMu, mu]];
  }
  const f = [[sub('τ', 'Ed'), tau(r.tauEd)], [t('ras.c.rmax'), kN(r.Rmax)], [t('ras.c.coh'), tau(r.P.coh)], fyd];
  if (r.caso === 'calculo') f.push(['ρ', `${fmt(r.rhoNec * 1000, 2)}<span class="u">${ESP}‰</span>`], [t('ras.armNec'), qh(r.AswSNec / 1000, 'AswS')]);
  return f;
}

/** Aclaraciones plegadas (guía § 14.9). */
function notas(N, D) {
  const clave = N.id === 'EC2-2023' ? '23' : N.id === 'EC2-2004' ? 'EC' : 'EHE';
  const claves = [['ras.n.alcance', `ras.alcance${clave}`], ['ras.n.rug', `ras.rugNota${clave}`], ['ras.n.cosido', `ras.cosidoNota${clave}`], ['ras.n.norma', `ras.notaNorma${clave}`]];
  void D;
  return h('div', { class: 'pun-notas' }, h('h3', {}, t('cor.notas')),
    ...claves.map(([k, v]) => h('details', { class: 'pleg' }, h('summary', {}, h('span', { html: t(k) })), h('div', { class: 'cuenta' }, h('p', { class: 'nota', html: t(v) })))));
}

export function comandos(ctx) {
  return [
    { k: 'ras.cmdComprobar', b: 'rasante comprobar junta interfaz shear interface check', f: () => { est.modo = 'comprobar'; ctx.ir('rasante'); } },
    { k: 'ras.cmdDimensionar', b: 'rasante dimensionar junta interfaz shear interface design', f: () => { est.modo = 'dimensionar'; ctx.ir('rasante'); } },
  ];
}
