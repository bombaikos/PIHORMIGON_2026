// Flexión simple de viga rectangular o en T, con momento positivo o negativo (módulo TN1 del Prontuario 3.1), con la interfaz de la
// maqueta de diseño: veredicto fijo, cifras, dibujo a la misma escala vertical y traza desplegable.
// La sección (geometría y materiales) viene de Secciones y aquí no se toca; solo se cambia la armadura.

import { comprobar, dimensionar, propuestaArmado, clasificarRotura, curvaMRd } from '../../core/flexion.js';
import { geometria } from '../../core/geometria.js';
import { NORMAS } from '../../norma/normas.js';
import { datosViga, geometriaDe } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, ESP, MAG, serieDiametros } from '../formato.js';
import { h, poner, campoNum, campoArmado, selector, segmentado, grupo, par, aviso, cifras, tabla, pestanas } from '../campos.js';
import { grafica } from '../grafica.js';
import { DEFS, encuadre, capasSeccion } from '../dibujoSeccion.js';

const est = { i: null, modo: 'comprobar', signo: 1, Md: 180, elemento: 'viga', abiertos: new Set(['mrd']), desp: 0.5 };
export function reiniciar() { est.i = null; }

const sub = (a, b) => `${a}<sub>${b}</sub>`;

function vigas(p) {
  return p.secciones.map((s, i) => [s, i]).filter(([s]) => s.forma === 'rectangular' || s.forma === 'T');
}

const mmS = (x) => fmt(x * 1000, 0);
/** Resumen de solo lectura de la sección activa. */
function resumenSeccion(s) {
  const g = s.geo;
  const dim = s.forma === 'T' ? `T ${mmS(g.b)} × ${mmS(g.h)} (b<sub>w</sub> ${mmS(g.bw)}, h<sub>f</sub> ${mmS(g.hf)}) mm` : `${mmS(g.b)} × ${mmS(g.h)} mm`;
  return `${dim} · ${s.hormigon} · ${s.acero}`;
}

/** Primera capa de una cara (la crea si no existe). */
function capa(s, cara) {
  let c = s.armado.find((g) => g.tipo === 'capa' && g.cara === cara);
  if (!c) { c = { tipo: 'capa', cara, texto: '', d: cara === 'inf' ? 0.045 : 0.04 }; s.armado.push(c); }
  return c;
}

export function datos(ctx, form) {
  const p = ctx.p;
  const R = vigas(p);
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.flexion')), h('p', {}, t('flex.subtitulo'))));
  if (!R.length) return poner(form, aviso(t('flex.sinRect'), 'info'));
  if (!R.some(([, i]) => i === est.i)) est.i = R[0][1];
  const s = p.secciones[est.i];
  const cambio = () => ctx.cambio();
  const pos = est.signo > 0;

  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.signo'), opciones: [['1', t('flex.positivo')], ['-1', t('flex.negativo')]], valor: String(est.signo), onCambio: (v) => { est.signo = Number(v); ctx.pintar(); } }),
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    grupo(t('g.esfuerzo'),
      campoNum({ id: 'f-md', etq: sub('M', 'Ed') + (pos ? '⁺' : '⁻'), valor: est.Md, mag: 'M', paso: 1, min: 0.1, max: 1e5, nombre: t('flex.momento'), onCambio: (v) => { est.Md = v; cambio(); } })),
    grupo(t('g.seccion'),
      selector({ id: 'f-sec', etq: t('seccion'), opciones: R.map(([x, i]) => [String(i), x.nombre]), valor: String(est.i), onCambio: (v) => { est.i = Number(v); ctx.pintar(); } }),
      h('p', { class: 'calculada', html: `${resumenSeccion(s)}<br>${t('flex.deSecciones')}` })),
  );
  // Con momento positivo se traccionan las barras de la cara inferior; con negativo, las de la superior
  const ct = capa(s, pos ? 'inf' : 'sup');
  const cc = capa(s, pos ? 'sup' : 'inf');
  const otras = s.armado.filter((g) => g !== ct && g !== cc).length;
  poner(form, grupo(t('g.armadura'),
    est.modo === 'comprobar' ? h('div', { class: 'grupo', style: 'border:0;padding:0' },
      campoArmado({ id: 'f-as1', etq: sub('A', 's1'), ref: t('traccion') + (pos ? '' : ` (${t('caraSup')})`), texto: ct.texto, capas: {}, onCambio: (v) => { ct.texto = v; cambio(); } }),
      campoArmado({ id: 'f-as2', etq: sub('A', 's2'), ref: t('compresion'), texto: cc.texto, capas: {}, onCambio: (v) => { cc.texto = v; cambio(); } }))
      : h('p', { class: 'calculada', html: t('flex.armCalculada') }),
    par(
      campoNum({ id: 'f-d1', etq: sub('d', '1'), valor: ct.d, mag: 'long', paso: 5, min: 0.01, max: 1, onCambio: (v) => { ct.d = v; cambio(); } }),
      campoNum({ id: 'f-d2', etq: sub('d', '2'), valor: cc.d, mag: 'long', paso: 5, min: 0.01, max: 1, onCambio: (v) => { cc.d = v; cambio(); } })),
    otras ? h('p', { class: 'pista', html: t('flex.otrasCapas', otras) }) : null));
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const s = p.secciones[est.i];
  if (!s || (s.forma !== 'rectangular' && s.forma !== 'T')) return;
  const geo = geometriaDe(p, s);
  const d = datosViga(p, s, est.signo);
  const neg = est.signo < 0;
  const opt = { elemento: est.elemento };
  let r;
  let dim = null;
  let prop = null;
  if (est.modo === 'comprobar') {
    if (!(d.Ainf > 0)) throw new Error(t('flex.faltaAs1'));
    r = comprobar(d, opt);
    try { dim = dimensionar(d, est.Md, opt); } catch { dim = null; }
  } else {
    dim = dimensionar(d, est.Md, opt);
    r = dim;
    if (dim.caso !== 'escuadria') prop = propuestaArmado(d, dim.Ainf, dim.Asup, est.Md);
  }
  // Se guarda el último cálculo para la memoria
  p.calculos.flexionSimple ??= {};
  p.calculos.flexionSimple[s.nombre] = { modo: est.modo, signo: est.signo, elemento: est.elemento, MEd: est.Md, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), resultado: { caso: r.caso, MRd: r.Mu, As1: r.Ainf, As2: r.Asup, x: r.x, rotura: clasificarRotura(d, r.x).clase } };

  const dd = d.h - d.rinf;
  const avisos = [];
  if (est.modo === 'comprobar') {
    const ratio = est.Md / r.Mu;
    const ok = ratio <= 1;
    res.append(veredicto(ok ? 'cumple' : 'nocumple', ok ? t('cumple') : t('noCumple'), t('aprovechamiento'), fmt(ratio, 2),
      `${sub('M', 'Ed')} <b>${q(est.Md, 'M')}</b> ${ok ? '≤' : '>'} ${sub('M', 'Rd')} <b>${q(r.Mu, 'M')}</b>`, Math.min(ratio / 1.25, 1)));
    const cu = r.cuantias;
    if (r.Ainf < (cu.Amec ?? 0) - 1e-12) avisos.push(t('a.minMec', q(cu.Amec, 'As'), q(r.Ainf, 'As'), cu.regla ?? ''));
    else if (r.Ainf < (cu.Ageo ?? 0) - 1e-12) avisos.push(t('a.minGeo', q(cu.Ageo, 'As'), q(r.Ainf, 'As')));
    if (r.Ainf > r.cuantias.Amax) avisos.push(t('a.maxima'));
  } else {
    if (r.caso === 'escuadria') {
      res.append(veredicto('nocumple', t('aumentar'), t('armaduraNec'), '—', t('a.escuadria', q(r.MuMax, 'M'))));
      return;
    }
    res.append(veredicto(r.caso === 'minima' ? 'atencion' : 'cumple', r.caso === 'minima' ? t('minima') : t('valida'), t('armaduraNec'), qh(r.Ainf, 'As'),
      t(`a.caso.${r.caso}`) + (r.Asup > 0 ? ` ${sub('A', 's2,req')} = <b>${q(r.Asup, 'As')}</b>` : '')));
  }
  const rot = clasificarRotura(d, r.x);
  if (rot.xd > rot.xdLim && !(r.Asup > 0)) avisos.push(t('a.ductil'));
  if (avisos.length) res.append(h('div', { class: 'avisos' }, ...avisos.map((a) => aviso(a))));

  const Asreq = dim && dim.caso !== 'escuadria' ? dim.Ainf : NaN;
  const cif = est.modo === 'comprobar'
    ? [[sub('M', 'Rd'), qh(r.Mu, 'M')], [t('c.x'), qh(r.x, 'long')], ['x / d', fmt(rot.xd, 3)], [sub('A', 's1,req'), qh(Asreq, 'As')]]
    : [[sub('A', 's1,req'), qh(r.Ainf, 'As')], [sub('A', 's2,req'), qh(r.Asup, 'As')], [t('c.x'), qh(r.x, 'long')], ['x / d', fmt(rot.xd, 3)]];

  const [caraT, caraC] = neg ? ['sup', 'inf'] : ['inf', 'sup'];
  const dibGeo = est.modo === 'comprobar' ? geo : geometriaDe(p, { ...s, armado: [
    { tipo: 'capa', cara: caraT, texto: String(Math.round(r.Ainf * 1e6)), d: d.rinf },
    ...(r.Asup > 0 ? [{ tipo: 'capa', cara: caraC, texto: String(Math.round(r.Asup * 1e6)), d: d.rsup }] : [])] });
  // Sección muy ancha (más de 2 : 1): se ve un tramo de proporción 2 : 1 y un deslizador lo recorre
  const ancha = dibGeo.caja.xmax - dibGeo.caja.xmin > 2 * dibGeo.h;
  const lienzo = h('div', { class: 'lienzo', html: dibujoFlexion(dibGeo, s, d, r, est.desp) });
  const deslizador = h('input', { type: 'range', class: 'desliza-sec', min: 0, max: 1000, value: Math.round(est.desp * 1000), 'aria-label': t('dib.desliza'),
    title: t('dib.desliza'), oninput: (ev) => { est.desp = +ev.target.value / 1000; lienzo.innerHTML = dibujoFlexion(dibGeo, s, d, r, est.desp); } });
  const tarjetaDib = h('article', { class: 'panel tarjeta' },
    h('h2', {}, t('t.dibujo')), h('p', { class: 'sub' }, t('t.dibujoSub')),
    lienzo,
    ...(ancha ? [deslizador] : []),
    leyenda());
  // Pestañas antes que scroll (guía § 13): resultados, gráfico y, al dimensionar, la propuesta de armado
  const tarjetaRes = h('article', { class: 'panel tarjeta' });
  const lista = [['resultados', t('t.resultados')], ['grafico', t('t.grafico')], ...(prop ? [['propuesta', t('t.propuesta')]] : [])];
  if (!lista.some(([k]) => k === est.pestanaRes)) est.pestanaRes = 'resultados';
  tarjetaRes.append(pestanas({ lista, activa: est.pestanaRes, onCambio: (k) => { est.pestanaRes = k; ctx.pintar(); } }));
  if (est.pestanaRes === 'propuesta') tarjetaRes.append(propuesta(ctx, s, prop, r, neg));
  else if (est.pestanaRes === 'grafico') tarjetaRes.append(graficoMRd(ctx, d, r, dim));
  else tarjetaRes.append(roturaChip(rot), cifras(cif), h('p', { class: 'sub', style: 'margin:0' }, t('t.desplegar')), traza(p, d, r, Asreq, rot));
  res.append(h('div', { class: 'cuerpo dib-ancho' }, tarjetaDib, tarjetaRes));
}

/** Indicación de rotura dúctil, media o frágil (verde, ámbar o rojo, que se reservan a estados). */
function roturaChip(rot) {
  const clase = { ductil: 'cumple', media: 'atencion', fragil: 'nocumple' }[rot.clase];
  return h('div', { class: `rotura ${clase}` },
    h('span', { class: 'etq' }, t('r.rotura')),
    h('span', { class: 'sello', html: t(`rot.${rot.clase}`) }),
    h('span', { class: 'pista', html: `x/d = ${fmt(rot.xd, 3)}` }));
}

/** Curva M_Rd–A_s1: solo con A_s1 y con armadura de compresión; el punto de la sección y la línea de M_Ed. */
const ind = (a, b) => `${a}<tspan class="ind" dy="3">${b}</tspan>`;
function graficoMRd(ctx, d, r, dim) {
  const c = curvaMRd(d, { elemento: est.elemento });
  const KA = MAG.As.f;
  const simple = c.simple.map(([a, m]) => [a * KA, m]);
  const doble = c.doble.map(([a, m]) => [a * KA, m]);
  const xmax = Math.max(...simple.map((v) => v[0]), 1);
  const series = [
    { nombre: t('g.soloAs1'), clase: 's1', xy: simple },
    { nombre: t('g.conAs2'), clase: 's2', xy: doble },
    { nombre: `${ind('M', 'Ed')}`, clase: 'ref', cruz: false, xy: [[0, est.Md], [xmax, est.Md]] },
  ];
  const puntos = [{ x: r.Ainf * KA, y: r.Mu, etq: est.modo === 'comprobar' ? t('g.estaSeccion') : t('g.dimensionada'), clase: 's1' }];
  if (est.modo === 'comprobar' && Number.isFinite(c.Amin)) puntos.push({ x: c.Amin * KA, y: curvaPunto(d, c.Amin), etq: `${ind('A', 's,min')}`, clase: 'ref', abajo: true });
  return h('div', { class: 'grafica-flex' }, grafica({
    series, puntos,
    ejeX: { titulo: `${ind('A', 's1')} (${MAG.As.ud})`, d: 0 },
    ejeY: { titulo: `${ind('M', 'Rd')} (${MAG.M.ud})`, d: 1 },
    archivo: `MRd-As ${ctx.p.secciones[est.i].nombre}${est.signo < 0 ? ' M-' : ' M+'}`,
    avisar: ctx.avisar,
  }), h('p', { class: 'nota', html: t('g.nota', q(c.Alim, 'As')) }));
}
/** M_Rd con solo A_s1 (para marcar A_s,min sobre la curva). */
function curvaPunto(d, A) {
  return comprobar({ ...d, Ainf: A, Asup: 0 }).Mu;
}

export function veredicto(clase, sello, etq, valor, ecu, barra) {
  const icos = {
    cumple: '<path d="M2.5 7.5l3 3 6-7"/>',
    nocumple: '<path d="M3 3l8 8M11 3l-8 8"/>',
    atencion: '<path d="M7 2v6M7 10.5v1.5"/>',
  };
  const ico = `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">${icos[clase]}</svg>`;
  return h('div', { class: `veredicto ${clase}${barra === undefined ? ' sin-barra' : ''}` },
    h('div', { class: 'ratio' }, h('span', { class: 'etq', html: etq }), h('span', { class: 'v', html: valor })),
    h('div', { class: 'medidor' }, h('div', { class: 'ecu', html: ecu }),
      h('div', { class: 'pista-barra', 'aria-hidden': 'true' }, h('i', { style: `width:${(barra ?? 0) * 100}%` }), h('span', { class: 'uno' }))),
    h('span', { class: 'sello', html: ico + sello }));
}

function leyenda() {
  const it = (estilo, k) => h('span', {}, h('i', { style: estilo }), h('span', {}, t(k)));
  return h('div', { class: 'leyenda' },
    it('background:var(--hormigon);border:1px solid var(--hormigon-borde)', 'l.hormigon'),
    it('background:color-mix(in oklch, var(--compr) 35%, transparent);border:1px solid var(--compr)', 'l.compresion'),
    it('background:repeating-linear-gradient(135deg, var(--traccion) 0 1px, transparent 1px 4px);border:1px solid var(--traccion)', 'l.traccion'),
    it('background:var(--acero);border-radius:50%', 'l.acero'));
}

function propuesta(ctx, s, prop, r, neg) {
  const serie = serieDiametros();
  const filas = prop.inferior.filter((o) => serie.includes(o.fi)).map((o) => (o.n
    ? [`ø${o.fi}`, String(o.n), String(o.capas), fmt(o.A * 100, 0), fmt(o.wk, 2), `<button type="button" class="adoptar" data-arm="${o.texto}">${t('adoptar')}</button>`]
    : [`ø${o.fi}`, '—', '—', '—', '—', '']));
  const cont = h('div', {}, h('h3', { html: t('propuesta') }), tabla(filas, { cabecera: [t('diam'), t('barras'), t('capas'), t('areaMm2'), t('wk'), ''] }),
    h('p', { class: 'nota', html: ctx.p.norma === 'EC2-2023' ? t('flex.notaWkEC2') : ctx.p.norma === 'EC2-2004' ? t('flex.notaWkEC2004') : t('flex.notaWkEHE') }));
  cont.addEventListener('click', (e) => {
    const b = e.target.closest('[data-arm]');
    if (!b) return;
    capa(s, neg ? 'sup' : 'inf').texto = b.dataset.arm;
    capa(s, neg ? 'inf' : 'sup').texto = r.Asup > 0 ? String(Math.round(r.Asup * 1e6)) : '';
    est.modo = 'comprobar';
    ctx.cambio({ estructura: true });
    ctx.avisar(t('adoptado', b.dataset.arm.replace(/D/g, 'ø').replace(/\+/g, ' + ')));
  });
  return cont;
}

function traza(p, d, r, Asreq, rot) {
  const fam = NORMAS[p.norma];
  const art = (a, b, c) => `<span class="art">${fam.ref} · ${p.norma === 'EC2-2004' ? c ?? b : fam.familia === 'EHE' ? a : b}</span>`;
  const fcd = d.hormigon.fk / d.hormigon.gamma / 1000;
  const meseta = Math.max(...d.hormigon.comp.map((x) => -x[1])) / 1000;
  const fyd = d.acero.fk / d.acero.gamma / 1000;
  const dd = d.h - d.rinf;
  const Fs1 = r.Ainf * r.sigAinf;
  const Fs2 = r.Asup > 0 ? Math.abs(r.Asup * r.sigAsup) : 0;
  const Fc = Fs1 - Fs2;
  const z = r.Mu / Fs1;
  const ecu = -r.epsSup;
  const es = r.epsAinf;
  const filas = [
    { id: 'mrd', nom: t('r.MRd'), val: q(r.Mu, 'M'), cuenta: `<span class="f">${t('f.equilibrio')}</span>
      <span class="n">${sub('F', 's1')} = ${sub('A', 's1')}·${sub('σ', 's1')} = ${q(r.Ainf, 'As')} × ${q(r.sigAinf, 'tensionKN')} = ${q(Fs1, 'N')}</span>
      <span class="n">${sub('F', 'c')} = ${q(Fc, 'N')} · ${sub('F', 's2')} = ${q(Fs2, 'N')} · ${t('f.brazo')} z = ${sub('M', 'Rd')}/${sub('F', 's1')} = ${q(z, 'long')}</span>${art('art. 42.1', '8.1.1', '6.1')}` },
    { id: 'x', nom: t('r.x'), val: q(r.x, 'long'), cuenta: `<span class="f">x = ${sub('ε', 'c')} / (${sub('ε', 'c')} + ${sub('ε', 's1')}) · d</span>
      <span class="n">x = ${fmt(ecu * 1000, 2)} / (${fmt(ecu * 1000, 2)} + ${fmt(es * 1000, 2)}) × ${q(dd, 'long')} = ${q(r.x, 'long')}</span>${art('art. 42.1.3', '8.1.1', '6.1')}` },
    { id: 'epsc', nom: t('r.epsc'), val: q(ecu, 'def'), cuenta: `<span class="f">${t('f.pivote')}</span><span class="n">${sub('ε', 'c')} = ${q(ecu, 'def')} ${t('f.fibraSup')}</span>${art('art. 39.5', '5.1.6', '3.1.7')}` },
    { id: 'g0', nom: t('r.ss1'), val: q(r.sigAinf, 'tensionKN'), cuenta: `<span class="f">${sub('σ', 's1')} = min(${sub('E', 's')}·${sub('ε', 's1')}; ${sub('f', 'yd')}), ${sub('f', 'yd')} = ${sub('f', 'yk')}/${sub('γ', 'S')}</span>
      <span class="n">${sub('ε', 's1')} = ${q(es, 'def')} · ${sub('f', 'yd')} = ${fmt(d.acero.fk / 1000, 0)} / ${fmt(d.acero.gamma, 2)} = ${q(fyd, 'tension')}</span>${art('art. 38.4', '5.2.4', '3.2.7')}` },
    { id: 'fcd', nom: t('r.fcd'), val: q(meseta, 'tension'), cuenta: `<span class="f">${t('f.meseta')}</span>
      <span class="n">${sub('f', 'ck')}/${sub('γ', 'C')} = ${fmt(d.hormigon.fk / 1000, 0)} / ${fmt(d.hormigon.gamma, 2)} = ${q(fcd, 'tension')} → ${q(meseta, 'tension')}</span>${art('art. 39.4', '5.1.6', '3.1.6')}` },
    { id: 'amin', nom: t('r.amin'), val: `${q(r.cuantias.Amin, 'As', { ud: false })} / ${q(r.Ainf, 'As')}`, cuenta: `<span class="f">${t('f.minima')}</span>
      <span class="n">${q(r.Ainf, 'As')} ${r.Ainf >= r.cuantias.Amin - 1e-12 ? '≥' : '<'} ${q(r.cuantias.Amin, 'As')}${r.cuantias.regla ? ` · ${r.cuantias.regla}` : ''}</span>${art('art. 42.3', '12.2', 'AN 9.2.1.1')}` },
  ];
  filas.push({ id: 'rotura', nom: t('r.rotura'), val: t(`rot.${rot.clase}`), cuenta: `<span class="f">${t('f.rotura')}</span>
      <span class="n">δ ≥ ${fmt(rot.k1, 2)} + ${fmt(rot.k2, 2)}·x/d (k<sub>2</sub> = 1,25·(0,6 + 0,0014/ε<sub>cu2</sub>), ε<sub>cu2</sub> = ${fmt(rot.ecu * 1000, 1)} ‰) → r = 1 − δ = ${fmt(rot.redMax * 100, 1)} % con x/d = ${fmt(rot.xd, 3)}</span>
      <span class="n">${t('rot.ductil')}: r ≥ 20 % → x/d ≤ ${fmt(rot.umbralDuctil, 3)} · ${t('rot.media')}: 0 &lt; r &lt; 20 % → x/d ≤ ${fmt(rot.umbralMedia, 3)} · ${t('rot.fragil')}: x/d &gt; ${fmt(rot.umbralMedia, 3)} ${t('f.o')} x/d &gt; x/d<sub>lim</sub> = ${fmt(rot.xdLim, 3)} (${t('f.sobrearmada')})</span>
      <span class="n">${t('f.rotEHE')}</span><span class="art">${rot.ref}</span>` });
  if (r.Mlim !== undefined) filas.push({ id: 'mlim', nom: t('r.mlim'), val: q(r.Mlim, 'M'), cuenta: `<span class="f">${t('f.mlim')}</span>${art('art. 42.1', '8.1.1', '6.1')}` });
  if (est.modo === 'comprobar' && Number.isFinite(Asreq)) filas.push({ id: 'asnec', nom: t('r.asreq'), val: q(Asreq, 'As'), cuenta: `<span class="f">${t('f.estricta')}</span><span class="n">${t('dispuesta')} ${q(r.Ainf, 'As')} · ${t('margen')} ${q(r.Ainf - Asreq, 'As')}</span>${art('art. 42.1', '8.1.1', '6.1')}` });
  const cont = h('div', { class: 'traza' }, ...filas.map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  }));
  return cont;
}

/** Sección, deformaciones y tensiones a la misma escala vertical (maqueta de diseño). */
function dibujoFlexion(geo, s, d, r, desp = 0.5) {
  const W = 680;
  const top = 56;
  const e = encuadre(geo, 300, 290, { desp });
  const x0 = 64;
  const y0 = top;
  const neg = d.signo < 0;
  const { svg, hp, bp } = capasSeccion(geo, s, { e, x0, y0, x: r.x, id: 'flex', cotasCapas: false, abajo: neg });
  const sc = e.s;
  // y interna: desde la fibra más comprimida; con momento negativo esa fibra es la inferior
  const Y = (y) => y0 + (neg ? d.h - y : y) * sc;
  const yTop = neg ? y0 + hp + 14 : y0 - 8;
  const H = y0 + hp + (s.forma === 'T' ? 92 : 64);
  const yx = Y(Math.min(Math.max(r.x, 0), d.h));
  const out = [DEFS, svg];
  const tit = (x, k) => `<text class="tit" x="${x}" y="22">${t(k)}</text>`;
  out.push(tit(x0, 'tit.sec'));
  out.push(`<line class="en" x1="${x0 - 8}" y1="${yx}" x2="${W - 12}" y2="${yx}"/>`);
  out.push(`<text x="${W - 12}" y="${neg ? yx - 6 : yx + 14}" text-anchor="end" style="fill:var(--acento)">${t('ejeNeutro')}</text>`);
  out.push(`<text class="fuerte" x="${x0 + bp + 16}" y="${(Y(0) + yx) / 2 + 4}">x = ${fmt(r.x * 1000, 0)}</text>`);
  // Deformaciones
  const e0 = Math.max(x0 + bp + 130, 400);
  const ke = 58 / Math.max(-r.epsSup, r.epsInf, 0.001);
  const eps = (y) => r.epsSup + r.kappa * y;
  const X1 = (v) => e0 + v * ke;
  const xn = Math.min(Math.max(r.x, 0), d.h);
  out.push(`<text class="tit" x="${e0 - 58}" y="22">${t('tit.def')}</text>`);
  out.push(`<line class="ref" x1="${e0}" y1="${y0 - 6}" x2="${e0}" y2="${y0 + hp + 6}"/>`);
  out.push(`<polygon class="eps-c" points="${e0},${Y(0)} ${X1(eps(0))},${Y(0)} ${e0},${Y(xn)}"/>`);
  out.push(`<polygon class="eps-t" points="${e0},${Y(xn)} ${X1(eps(d.h))},${Y(d.h)} ${e0},${Y(d.h)}"/>`);
  out.push(`<text x="${X1(eps(0)) - 4}" y="${yTop}">ε<tspan baseline-shift="sub" font-size="75%">c</tspan> = ${fmt(-r.epsSup * 1000, 2)}</text>`);
  const ys1 = Y(d.h - d.rinf);
  out.push(`<line class="ref" x1="${x0 + bp}" y1="${ys1}" x2="${X1(r.epsAinf)}" y2="${ys1}" stroke-dasharray="2 3"/><circle cx="${X1(r.epsAinf)}" cy="${ys1}" r="3" class="barra-ac"/>`);
  out.push(`<text class="fuerte" x="${X1(r.epsAinf) + 7}" y="${ys1 + 4}">ε<tspan baseline-shift="sub" font-size="75%">s1</tspan> = ${fmt(r.epsAinf * 1000, 2)}</text>`);
  // Tensiones
  const t0 = Math.max(e0 + 190, 590);
  const smax = Math.max(...d.hormigon.comp.map((v) => -v[1]));
  const kc = 64 / smax;
  out.push(`<text class="tit" x="${t0 - 64}" y="22">${t('tit.ten')}</text>`);
  out.push(`<line class="ref" x1="${t0}" y1="${y0 - 6}" x2="${t0}" y2="${y0 + hp + 6}"/>`);
  const pts = r.curvaHormigon.filter(([y]) => y <= xn + 1e-9).map(([y, sg]) => `${t0 + sg * kc},${Y(y)}`);
  if (pts.length) out.push(`<polygon class="sig-c" points="${t0},${Y(0)} ${pts.join(' ')} ${t0},${Y(xn)}"/>`);
  out.push(`<text x="${t0 - smax * kc}" y="${yTop}">${fmt(smax / 1000, 1)}${ESP}MPa</text>`);
  const Fs1 = r.Ainf * r.sigAinf;
  out.push(`<line class="flecha" x1="${t0}" y1="${ys1}" x2="${t0 + 46}" y2="${ys1}" marker-end="url(#pta)"/>`);
  out.push(`<text class="fuerte" x="${t0 + 4}" y="${ys1 + 18}">F<tspan baseline-shift="sub" font-size="75%">s1</tspan> = ${fmt(Fs1, 0)}${ESP}kN</text>`);
  if (r.Asup > 0) {
    const ys2 = Y(d.rsup);
    const Fs2 = Math.abs(r.Asup * r.sigAsup);
    out.push(`<line class="flecha" x1="${t0 + 46}" y1="${ys2}" x2="${t0 + 2}" y2="${ys2}" marker-end="url(#pta)"/>`);
    out.push(`<text x="${t0 + 6}" y="${ys2 + 16}">F<tspan baseline-shift="sub" font-size="75%">s2</tspan> = ${fmt(Fs2, 0)}${ESP}kN</text>`);
  }
  const Wt = Math.max(W, t0 + 110);
  out.push(`<text x="${x0}" y="${H - 8}" style="fill:var(--tinta-3)">${t('notaDib')}</text>`);
  return `<svg class="dib" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${Wt} ${H}" role="img" aria-label="${t('dibFlexAria', fmt(d.b * 1000, 0), fmt(d.h * 1000, 0), fmt(r.x * 1000, 0))}">${out.join('')}</svg>`;
}

export function comandos(ctx) {
  return [
    { k: 'p.comprobar', b: 'modo mode comprobar check', f: () => { est.modo = 'comprobar'; ctx.ir('flexion'); } },
    { k: 'p.dimensionar', b: 'modo mode dimensionar design', f: () => { est.modo = 'dimensionar'; ctx.ir('flexion'); } },
  ];
}
