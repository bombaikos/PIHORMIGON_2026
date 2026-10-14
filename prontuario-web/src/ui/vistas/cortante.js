// Cortante de vigas (rectangulares y en T), pilares y secciones circulares (módulo TT1 del Prontuario 3.1).
// Una sola pantalla que cambia con la norma del proyecto; migradas EHE-08 y EC-2 2004 + AN (norma/cortante/).
// La sección (geometría y armadura longitudinal) viene de Secciones y aquí no se toca: ρl, A_sl, d y b0 se pueden
// cambiar en el módulo sin modificar la sección. El cortante de cálculo lo escribe el usuario.

import { nucleo } from '../../norma/cortante/index.js';
import { AswSDe, COT_MIN, COT_MAX } from '../../norma/cortante/ehe08.js';
import { datosCortante, geometriaDe } from '../../io/proyecto.js';
import { t } from '../i18n.js';
import { fmt, q, qh, ESP, serieDiametros, paraCampo } from '../formato.js';
import { selectorSecciones } from './secciones.js';
import { h, poner, campoNum, selector, segmentado, grupo, par, aviso, cifras, tabla, boton } from '../campos.js';
import { veredicto } from './flexion.js';
import { dibujoCortante } from '../dibujoCortante.js';

const est = {
  i: null, modo: 'comprobar', signo: 1, dir: 'h',
  VEd: 120, NEd: 0, sigY: 0,
  cot: 1, alfa: 90, fi: 8, ramas: 2, s: 200, sin: false, circ: true, aceroCercos: null,
  ov: { b0: null, d: null, Asl: null, Asc: null }, abiertos: new Set(),
};
export function reiniciar() { est.i = null; est.ov = { b0: null, d: null, Asl: null, Asc: null }; est.aceroCercos = null; }

const RAD = Math.PI / 180;
const thetaDe = (cot) => (Math.atan(1 / cot) / RAD);
const THETA_MIN = +(Math.atan(1 / COT_MAX) / RAD).toFixed(1) + 0.1;
const THETA_MAX = +(Math.atan(1 / COT_MIN) / RAD).toFixed(1) - 0.1;
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const FORMAS = ['rectangular', 'T', 'pilar', 'circular'];
const secciones = (p) => p.secciones.map((s, i) => [s, i]).filter(([s]) => FORMAS.includes(s.forma));
const esViga = (s) => s.forma === 'rectangular' || s.forma === 'T';
const diametrosEntrada = () => serieDiametros().filter((x) => x >= 6 && x <= 25);
const diametrosTabla = () => serieDiametros().filter((x) => x >= 8 && x <= 20);
const nuc = (p) => nucleo(p.norma);
const esEC2 = (p) => nuc(p)?.id === 'EC2-2004';

/** Datos de la sección activa en m y m², con los cambios hechos en este módulo. */
function efectivos(p, s) {
  const sec = datosCortante(p, s, { signo: est.signo, dir: est.dir });
  const ef = {
    b0: est.ov.b0 ?? sec.b0,
    d: est.ov.d ?? sec.d,
    Asl: est.ov.Asl ?? sec.Asl,
    Asc: est.ov.Asc ?? sec.Asc,
  };
  return { sec, ef };
}

function cambiaSeccion(ctx) {
  est.ov = { b0: null, d: null, Asl: null, Asc: null };
  est.aceroCercos = null;
  ctx.pintar();
}

/** Campo de solo lectura (se calcula a partir de otros): caja atenuada, no editable. */
function calculado(c) {
  const i = c.querySelector('input');
  i.disabled = true;
  i.tabIndex = -1;
  c.classList.add('calculado');
  return c;
}

/** Sección activa; si la elegida ya no existe o no sirve, la primera válida. */
function activa(p) {
  const R = secciones(p);
  if (!R.length) return null;
  if (!R.some(([, i]) => i === est.i)) { est.i = R[0][1]; est.ov = { b0: null, d: null, Asl: null, Asc: null }; }
  return p.secciones[est.i];
}

/** Mismo selector de sección que el módulo Secciones (un desplegable por tipo). */
export function cabeza(ctx, el) {
  const p = ctx.p;
  if (!nuc(p)) return;
  const s = activa(p);
  if (!s) return;
  selectorSecciones(ctx, el, { formas: FORMAS, activa: s, alElegir: (nombre) => {
    const i = p.secciones.findIndex((x) => x.nombre === nombre);
    if (i >= 0) { est.i = i; cambiaSeccion(ctx); }
  } });
}

export function datos(ctx, form) {
  const p = ctx.p;
  poner(form, h('div', { class: 'cab' }, h('h1', {}, t('m.cortante'))));
  if (!nuc(p)) {
    return poner(form, aviso(t('cor.pendiente', p.norma === 'EC2-2023' ? 'EN 1992-1-1:2023' : 'EC-2 2004 + AN'), 'info'),
      boton(t('cor.aEC2'), () => { p.norma = 'EC2-2004'; ctx.cambio({ estructura: true }); }),
      boton(t('cor.aEHE'), () => { p.norma = 'EHE-08'; ctx.cambio({ estructura: true }); }));
  }
  const R = secciones(p);
  if (!R.length) return poner(form, aviso(t('cor.sinSec'), 'info'));
  const s = activa(p);
  let ef;
  let sec;
  try { ({ sec, ef } = efectivos(p, s)); } catch (e) { return poner(form, aviso(String(e.message ?? e), 'error')); }
  const comp = est.modo === 'comprobar';
  const cambio = () => ctx.cambio();
  const refrescar = () => {
    // ρl y A_sl se mantienen enlazados; el resumen del plegable se actualiza sin repintar el panel
    const rho = ef.Asl / (ef.b0 * ef.d);
    const a = document.getElementById('c-rho');
    if (a && document.activeElement !== a) a.value = String(+(rho * 1000).toFixed(2));
    const b = document.getElementById('c-asl');
    if (b && document.activeElement !== b) b.value = String(Math.round(ef.Asl * 1e6));
  };
  const nuevo = (k) => (v) => { est.ov[k] = v; ef[k] = v; refrescar(); cambio(); };
  const rho0 = ef.Asl / (ef.b0 * ef.d);
  const pilarOCirc = !esViga(s);
  const ec = esEC2(p);

  // Ángulo de las bielas: campo en grados y deslizador (el cotg θ queda dentro del cálculo)
  const gauge = h('input', { type: 'range', class: 'desliza-sec', min: THETA_MIN, max: THETA_MAX, step: 0.1, value: thetaDe(est.cot), 'aria-label': t('cor.theta') });
  const refrescarGauge = () => { gauge.value = thetaDe(est.cot); };
  gauge.addEventListener('input', () => {
    const v = Number(gauge.value);
    est.cot = 1 / Math.tan(v * RAD);
    const c = document.getElementById('c-theta');
    if (c) c.value = String(+v.toFixed(1));
    cambio();
  });
  const conEtq = (etq, c) => h('div', { class: 'fu-campo' }, h('span', { class: 'etq-grupo', html: etq }), c);
  poner(form,
    segmentado({ ancho: true, etiqueta: t('flex.modo'), opciones: [['comprobar', t('comprobar')], ['dimensionar', t('dimensionar')]], valor: est.modo, onCambio: (m) => { est.modo = m; ctx.pintar(); } }),
    esViga(s) ? conEtq(t('cor.signo'), segmentado({ ancho: true, etiqueta: t('cor.signo'), opciones: [['1', t('flex.positivo')], ['-1', t('flex.negativo')]], valor: String(est.signo), onCambio: (v) => { est.signo = Number(v); cambiaSeccion(ctx); } })) : null,
    s.forma === 'pilar' ? conEtq(t('cor.dir'), segmentado({ ancho: true, etiqueta: t('cor.dir'), opciones: [['h', t('cor.dirH')], ['b', t('cor.dirB')]], valor: est.dir, onCambio: (v) => { est.dir = v; cambiaSeccion(ctx); } })) : null,
    grupo(t('g.esfuerzo'),
      ...parejas([
        campoNum({ id: 'c-ved', etq: t('cor.VEd'), valor: est.VEd, mag: 'F', paso: 10, min: 0.01, max: 1e6, nombre: t('cor.VEdNombre'), onCambio: (v) => { est.VEd = v; cambio(); } }),
        campoNum({ id: 'c-ned', etq: t('cor.NEd'), ref: t('cor.NEdRef'), valor: est.NEd, mag: 'N', paso: 10, min: -1e6, max: 1e6, ayuda: t('cor.NEdNota'), onCambio: (v) => { est.NEd = v; cambio(); } }),
      ]),
      h('p', { class: 'nota-ned', html: t('cor.NEdNota') })),
    grupo(t('cor.datosCalc'),
      ...parejas([
        campoNum({ id: 'c-b0', etq: t('cor.b0'), valor: ef.b0, mag: 'long', paso: 5, min: 0.01, max: 20, ayuda: t('cor.b0Ayuda'), onCambio: nuevo('b0') }),
        campoNum({ id: 'c-d', etq: t('cor.d'), valor: ef.d, mag: 'long', paso: 5, min: 0.01, max: 20, ayuda: t('cor.dAyuda'), onCambio: nuevo('d') }),
        mostrar(campoNum({ id: 'c-asl', etq: t('cor.Asl'), valor: ef.Asl, mag: 'As', paso: 50, min: 0, max: 1, ayuda: t('cor.AslAyuda'), onCambio: nuevo('Asl') }), ef.Asl * 1e6, 0),
        calculado(mostrar(campoNum({ id: 'c-rho', etq: t('cor.rho'), valor: rho0, mag: 'cuantia', paso: 1, min: 0, max: 1, ayuda: t('cor.rhoAyuda'), onCambio: () => {} }), rho0 * 1000, 2)),
        ec ? null : campoNum({ id: 'c-sigy', etq: t('cor.sigY'), ref: t('cor.sigYRef'), valor: est.sigY, mag: 'tension', paso: 0.5, min: -50, max: 50, ayuda: t('cor.sigYAyuda'), onCambio: (v) => { est.sigY = v; cambio(); } }),
        pilarOCirc && !ec ? mostrar(campoNum({ id: 'c-asc', etq: t('cor.Asc'), valor: ef.Asc, mag: 'As', paso: 50, min: 0, max: 1, ayuda: t('cor.AscAyuda'), onCambio: nuevo('Asc') }), ef.Asc * 1e6, 0) : null,
      ]),
      sec.circular && !ec ? conEtq(t('cor.circ'), segmentado({ opciones: [['si', '× 0,85'], ['no', t('cor.sinReduccion')]], valor: est.circ ? 'si' : 'no', ancho: true, etiqueta: t('cor.circ'), onCambio: (v) => { est.circ = v === 'si'; ctx.pintar(); } })) : null),
    grupo(t('cor.cercos'),
      comp ? segmentado({ ancho: true, etiqueta: t('cor.cercos'), opciones: [['con', t('cor.conArm')], ['sin', t('cor.sinArm')]], valor: est.sin ? 'sin' : 'con', onCambio: (v) => { est.sin = v === 'sin'; ctx.pintar(); } }) : null,
      ...parejas([
        selector({ id: 'c-acero', etq: t('cor.cercosAcero'), linea: true, opciones: p.aceros.map((m) => [m.nombre, m.nombre]), valor: est.aceroCercos ?? s.acero, onCambio: (v) => { est.aceroCercos = v; cambio(); } }),
        comp && !est.sin ? selector({ id: 'c-fi', etq: t('cor.fi'), linea: true, opciones: diametrosEntrada().map((x) => [String(x), `ø${x}`]), valor: String(est.fi), onCambio: (v) => { est.fi = Number(v); cambio(); } }) : null,
        comp && !est.sin ? selector({ id: 'c-ramas', etq: t('cor.ramas'), linea: true, opciones: [2, 3, 4, 6].map((x) => [String(x), String(x)]), valor: String(est.ramas), onCambio: (v) => { est.ramas = Number(v); cambio(); } }) : null,
        comp && !est.sin ? campoNum({ id: 'c-s', etq: t('cor.s'), valor: est.s, mag: 'diam', paso: 25, min: 25, max: 1000, onCambio: (v) => { est.s = v; cambio(); } }) : null,
        !est.sin ? campoNum({ id: 'c-alfa', etq: t('cor.alfa'), ref: t('cor.alfaRef'), valor: est.alfa, mag: 'ang', paso: 5, min: 45, max: 90, onCambio: (v) => { est.alfa = v; cambio(); } }) : null,
        campoNum({ id: 'c-theta', etq: t('cor.theta'), valor: thetaDe(est.cot), mag: 'ang1', paso: 1, min: THETA_MIN, max: THETA_MAX, ayuda: t('cor.cotAyuda'), onCambio: (v) => { est.cot = 1 / Math.tan(v * RAD); cambio(); refrescarGauge(); } }),
      ]),
      gauge,
      boton(t('cor.optimo'), () => {
        try {
          const { sec: s2, ef: e2 } = efectivos(p, s);
          const base = entrada(p, s, s2, e2);
          est.cot = nuc(p).cotOptimo(base, { VEd: est.VEd, dim: !comp });
          ctx.pintar();
          ctx.avisar(t('cor.optimoPuesto', fmt(thetaDe(est.cot), 1)));
        } catch (e) { ctx.avisar(String(e.message ?? e)); }
      }, 'secundario pequeno')));
}

/** Entrada común del núcleo en MPa, mm y kN. */
function entrada(p, s, sec, ef) {
  const acero = p.aceros.find((m) => m.nombre === (est.aceroCercos ?? s.acero)) ?? p.aceros[0];
  return {
    fck: sec.fck, fykCercos: acero.fyk, fykLong: sec.fyk,
    b0: ef.b0 * 1000, d: ef.d * 1000, Ac: sec.Ac * 1e6, Asl: ef.Asl * 1e6, Asc: ef.Asc * 1e6,
    NEd: est.NEd, sigY: est.sigY, cotTheta: est.cot, alfa: est.alfa, circular: sec.circular && est.circ,
  };
}

/** Valor mostrado con la precisión fija de la guía (§ 1): mm² sin decimales, ‰ con dos. */
const mostrar = (c, v, d) => { const i = c.querySelector('input'); i.value = String(+v.toFixed(d)); return c; };
/** Campos en dos columnas de igual ancho (la caja de cada uno mide lo mismo y va alineada). */
const parejas = (campos) => {
  const c = campos.filter(Boolean);
  const filas = [];
  for (let i = 0; i < c.length; i += 2) filas.push(h('div', { class: 'par2' }, ...c.slice(i, i + 2)));
  return filas;
};
const fila = (id, nom, val, cuenta) => ({ id, nom, val, cuenta });
let refNorma = 'EHE-08';
const art = (a) => `<span class="art">${refNorma} · ${a}</span>`;

export function resultados(ctx, res) {
  const p = ctx.p;
  const centro = h('article', { class: 'panel tarjeta' });
  const dcha = h('article', { class: 'panel tarjeta' });
  if (!nuc(p) || !secciones(p).length) { res.append(h('div', { class: 'cuerpo' }, centro, dcha)); return; }
  const s = p.secciones[est.i];
  if (!s || !FORMAS.includes(s.forma)) return;
  const N = nuc(p);
  const ec = esEC2(p);
  refNorma = ec ? 'EC-2 + AN' : 'EHE-08';
  const { sec, ef } = efectivos(p, s);
  const x = entrada(p, s, sec, ef);
  const comp = est.modo === 'comprobar';
  const AswS = comp && !est.sin ? AswSDe(est.fi, est.ramas, est.s) : 0;
  const r = comp ? N.comprobar({ ...x, AswS, sinArmadura: est.sin, VEd: est.VEd }) : N.dimensionar(x, est.VEd, { diametros: diametrosTabla() });
  const P = r.P;
  const avisos = r.avisos.filter((a) => a.clave !== 'cor.av.fyd400').map((a) => aviso(t(a.clave, ...(a.args ?? []))));

  p.calculos.cortante ??= {};
  p.calculos.cortante[s.nombre] = {
    modo: est.modo, norma: p.norma, fecha: new Date().toISOString().slice(0, 10), VEd: est.VEd, NEd: est.NEd, cotTheta: est.cot, alfa: est.alfa,
    resultado: comp ? { Vu1: r.Vu1, Vu2: r.Vu2, Vcu: r.Vcu, Vsu: r.Vsu, Vu: r.Vu } : { caso: r.caso, AswS: r.AswS, Vu1: r.Vu1 },
  };

  if (comp) {
    const ok = est.VEd <= r.Vu + 1e-9;
    const sepOk = r.sinArmadura || est.s <= r.sep + 1e-9;
    const minOk = r.sinArmadura || r.minima.ok;
    const detalles = ok && (!sepOk || !minOk);
    if (!r.sinArmadura && !sepOk) avisos.push(aviso(t('cor.avs.sep', fmt(est.s, 0), fmt(r.sep, 0), ec ? '9.2.2(6)' : '44.2.3.4.1')));
    const P0 = ec ? 'cor.ec.manda.' : 'cor.manda.';
    const manda = r.sinArmadura ? t(`${P0}sin`) : r.mandaBiela ? t(`${P0}biela`) : t(`${P0}arm`);
    res.append(veredicto(!ok ? 'nocumple' : detalles ? 'atencion' : 'cumple', !ok ? t('cor.ver.no') : detalles ? t('cor.ver.revisar') : t('cor.ver.cumple'),
      t('aprovechamiento'), fmt(r.aprov, 2), t(ec ? 'cor.ec.ver.ecu' : 'cor.ver.ecu', q(est.VEd, 'F'), q(r.Vu, 'F'), ok, manda), Math.min(r.aprov / 1.25, 1)));
  } else if (r.caso === 'biela') {
    res.append(veredicto('nocumple', t('cor.ver.aum'), t('cor.armNec'), '—', t(ec ? 'cor.ec.ver.necAum' : 'cor.ver.necAum', q(est.VEd, 'F'), q(r.Vu1, 'F'))));
  } else {
    res.append(veredicto(r.caso === 'minima' ? 'atencion' : 'cumple', r.caso === 'minima' ? t('cor.ver.min') : t('cor.ver.valida'), t('cor.armNec'), qh(r.AswS, 'AswS'),
      t(ec ? 'cor.ec.ver.nec' : 'cor.ver.nec', q(est.VEd, 'F'), q(r.Vu1, 'F'))));
  }
  if (avisos.length) res.append(h('div', { class: 'avisos' }, ...avisos));

  // Centro: sección y celosía
  const geo = geometriaDe(p, s);
  const lienzo = h('div', { class: 'lienzo', html: dibujoCortante(geo, s, { b0: ef.b0, d: ef.d, z: P.z / 1000, cotTheta: est.cot, alfa: est.alfa, neg: esViga(s) && est.signo < 0, sinArmadura: comp && est.sin }) });
  poner(centro, h('h2', {}, t('cor.t.dibujo')), lienzo, notas(sec.circular, P, ec));

  // Derecha: cifras, tabla (al dimensionar) y filas desplegables
  const cif = ec ? cifrasEC2(r, comp, P) : comp
    ? (r.sinArmadura ? [[t('cor.c.Vu2'), qh(r.Vu2, 'F')], [t('cor.rho'), `${fmt(P.rho * 1000, 1)}<span class="u">${ESP}‰</span>`]]
      : [[t('cor.c.Vu1'), qh(r.Vu1, 'F')], [t('cor.c.Vu2'), qh(r.Vu2, 'F')], [`${t('cor.c.Vcu')} + ${t('cor.c.Vsu')}`, `${fmt(r.Vcu, 0)} + ${fmt(r.Vsu, 0)}<span class="u">${ESP}kN</span>`], [`θ · β`, `${fmt(r.theta, 1)}° · ${fmt(r.beta, 2)}`]])
    : [[t('cor.c.Vu1'), qh(r.Vu1, 'F')], [t('cor.c.Vcu'), qh(r.Vcu, 'F')], [t('cor.armNec'), qh(r.AswSNec, 'AswS')], [t('cor.c.Asw') + ' mín.', qh(r.AswSMin, 'AswS')]];
  poner(dcha, h('h2', {}, t('cor.t.res')), cifras(cif));
  if (!comp && r.tabla) {
    const filas = r.tabla.map((f) => (f.s ? [`ø${f.fi}`, String(f.ramas), fmt(f.s, 0), fmt(f.AswS * 10, 2), fmt(f.Vu, 0)] : [`ø${f.fi}`, String(f.ramas), '—', '—', '—']));
    poner(dcha, tabla(filas, { cabecera: [t('cor.tabla.fi'), t('cor.tabla.ramas'), t('cor.tabla.s'), t('cor.tabla.asw'), t('cor.tabla.vu')] }));
  }
  poner(dcha, h('div', { class: 'traza' }, ...trazas(p, r, { ...x, AswS }, comp, ef).map((f) => {
    const det = h('details', { 'data-ref': f.id, open: est.abiertos.has(f.id) },
      h('summary', {}, h('span', { class: 'nom', html: f.nom }), h('span', { class: 'val', html: f.val })),
      h('div', { class: 'cuenta', html: f.cuenta }));
    det.addEventListener('toggle', () => (det.open ? est.abiertos.add(f.id) : est.abiertos.delete(f.id)));
    return det;
  })));
  res.append(h('div', { class: 'cuerpo' }, centro, dcha));
}

/** Cifras de la columna de resultados con el EC-2 2004 + AN. */
function cifrasEC2(r, comp, P) {
  const kN = (v) => qh(v, 'F');
  if (!comp) return [[t('cor.ec.c.vmax'), kN(r.Vu1)], [t('cor.ec.c.vc'), kN(r.Vu2SinArm)], [t('cor.armNec'), qh(r.AswSNec, 'AswS')], [t('cor.c.Asw') + ' mín.', qh(r.AswSMin, 'AswS')]];
  if (r.sinArmadura) return [[t('cor.ec.c.vc'), kN(r.Vu)], [t('cor.rho'), `${fmt(P.rho * 1000, 1)}<span class="u">${ESP}‰</span>`]];
  return [[t('cor.ec.c.vmax'), kN(r.VRdMax)], [t('cor.ec.c.vs'), kN(r.VRds)], [t('cor.ec.c.nu1'), fmt(r.nu1, 3)], ['θ', `${fmt(r.theta, 1)}°`]];
}

/** Filas desplegables con el cálculo del EC-2 2004 + AN (fórmula, valores y artículo). */
function trazasEC2(r, x, comp) {
  const P = r.P;
  const n1 = (v, d = 2) => fmt(v, d);
  const f = [];
  const cotA = r.alfa >= 90 ? 0 : 1 / Math.tan((r.alfa * Math.PI) / 180);
  if (!comp || !r.sinArmadura) {
    const Vmax = comp ? r.VRdMax : r.Vu1;
    const nu = comp ? r.nu1 : null;
    f.push(fila('vu1', t('cor.ec.r.vmax'), q(Vmax, 'F'),
      `<span class="f">${t('cor.ec.f.vmax')}</span><span class="n">${t('cor.ec.f.nu1')}</span>`
      + `<span class="n">${nu == null ? '' : `ν<sub>1</sub> = ${n1(nu, 3)} · `}α<sub>cw</sub> = 1 · b<sub>w</sub> = ${n1(P.b0, 0)} · z = ${n1(P.z, 0)} mm · f<sub>cd</sub> = ${n1(P.fcd, 1)} MPa · (cotg θ + cotg α)/(1 + cotg²θ) = ${n1((r.cotTheta + cotA) / (1 + r.cotTheta ** 2), 3)}</span>${art('6.2.3(3), AN')}`));
  }
  if (comp && r.sinArmadura) {
    f.push(fila('vcu', t('cor.ec.r.vc'), q(r.Vu, 'F'),
      `<span class="f">${t('cor.ec.f.vc')}</span><span class="n">${t('cor.ec.f.vcPar')}</span>`
      + `<span class="n">k = ${n1(P.k, 3)} · ρ<sub>l</sub> = ${n1(P.rho * 1000, 2)} ‰ · σ<sub>cp</sub> = ${n1(P.sigCpLim)} MPa · ν<sub>mín</sub> = ${n1(r.nuMin, 3)} MPa</span>`
      + `<span class="n">${t('cor.v.concMin', n1(r.VRdcConc, 1), n1(r.VRdcMin, 1))}</span>${art('6.2.2(1), AN')}`));
  }
  if (comp && !r.sinArmadura) {
    f.push(fila('vsu', t('cor.ec.r.vs'), q(r.VRds, 'F'),
      `<span class="f">${t('cor.ec.f.vs')}</span><span class="n">z = ${n1(P.z, 0)} mm · A<sub>sw</sub>/s = ${n1(x.AswS, 3)} mm²/mm · f<sub>ywd</sub> = ${n1(P.fyd, 1)} MPa</span>${art('6.2.3(3), (4)')}`));
    f.push(fila('min', t('cor.r.min'), r.minima.ok ? t('cor.ok') : t('cor.noOk'),
      `<span class="f">${t('cor.ec.f.min')}</span><span class="n">${t('cor.r.minVal', n1(x.AswS * 1000, 0), n1(r.minima.AswSMin * 1000, 0))}</span>${art('AN 9.2.2(5)')}`));
  }
  if (comp) {
    f.push(fila('sep', t('cor.r.sep'), r.sinArmadura ? '—' : `${fmt(est.s, 0)} ≤ ${fmt(r.sep, 0)} mm`,
      `<span class="f">${t('cor.ec.f.sep')}</span><span class="n">V<sub>Ed</sub> = ${n1(est.VEd, 1)} kN → s<sub>l,máx</sub> ≤ ${n1(r.sep, 0)} mm · ${t('cor.avs.trans', n1(r.sepTrans, 0))}</span>${art('AN 9.2.2(6), (8)')}`));
    f.push(fila('long', t('cor.ec.r.long'), r.long.dT == null ? `a<sub>l</sub> ${q(r.long.sd, 'long')}` : `ΔF<sub>td</sub> ${q(r.long.dT, 'F')}`,
      `<span class="f">${t('cor.ec.f.long')}</span><span class="n">${r.long.dT == null ? '' : `ΔF<sub>td</sub> = ${n1(r.long.dT, 1)} kN · `}a<sub>l</sub> = ${n1(r.long.sd, 0)} mm</span>${art('6.2.3(7); 9.2.1.3(2)')}`));
  } else if (r.caso !== 'biela') {
    f.push(fila('min', t('cor.r.min'), q(r.AswSMin, 'AswS'), `<span class="f">${t('cor.ec.f.min')}</span><span class="n">${n1(r.AswSMin * 1000, 0)} mm²/m</span>${art('AN 9.2.2(5)')}`));
    f.push(fila('sep', t('cor.r.sep'), `≤ ${fmt(r.sMax, 0)} mm`, `<span class="f">${t('cor.ec.f.sep')}</span>${art('AN 9.2.2(6), (8)')}`));
    f.push(fila('long', t('cor.ec.r.long'), `ΔF<sub>td</sub> ${q(r.long.dT, 'F')}`, `<span class="f">${t('cor.ec.f.long')}</span><span class="n">ΔF<sub>td</sub> = ${n1(r.long.dT, 1)} kN · a<sub>l</sub> = ${n1(r.long.sd, 0)} mm</span>${art('6.2.3(7); 9.2.1.3(2)')}`));
  }
  return f;
}

/** Filas desplegables con el cálculo (fórmula, valores y artículo). */
function trazas(p, r, x, comp, ef) {
  if (r.norma === 'EC2-2004') return trazasEC2(r, x, comp);
  const P = r.P;
  const f = [];
  const n1 = (v, d = 2) => fmt(v, d);
  f.push(fila('vu1', t('cor.r.Vu1'), q(r.Vu1, 'F'),
    `<span class="f">${t('cor.f.Vu1')}</span><span class="n">${t('cor.f.f1cd', P.fck)} → ${n1(P.f1cd)} MPa</span><span class="n">${t('cor.f.K')}</span>`
    + `<span class="n">σ'<sub>cd</sub> = (${n1(P.NEd, 0)}·10³ − ${n1(P.Asc, 0)}·${n1(P.fyd, 0)}) / ${n1(x.Ac, 0)} = ${n1(P.sigCd)} MPa → K = ${n1(r.K, 3)}</span>`
    + `<span class="n">${n1(r.K, 3)} × ${n1(P.f1cd)} × ${n1(P.b0, 0)} × ${n1(P.d, 0)} × ${n1((r.cotTheta + (r.alfa >= 90 ? 0 : 1 / Math.tan((r.alfa * Math.PI) / 180))) / (1 + r.cotTheta ** 2), 3)} = ${q(r.Vu1, 'F')}</span>${art('44.2.3.1')}`));
  if (comp) {
    f.push(fila('vcu', r.sinArmadura ? t('cor.r.Vu2') : t('cor.r.Vcu'), q(r.Vcu, 'F'),
      `<span class="f">${r.sinArmadura ? t('cor.f.Vu2sin') : t('cor.f.Vcu')}</span><span class="n">${t('cor.f.xi')}</span>`
      + `<span class="n">ξ = ${n1(P.xi, 3)} · ρ<sub>l</sub> = ${n1(P.rho * 1000, 2)} ‰ · f<sub>cv</sub> = ${n1(r.sinArmadura ? Math.min(P.fck, 60) : P.fck, 0)} MPa · σ'<sub>cd</sub> = ${n1(P.sigCdLim)} MPa</span>`
      + `<span class="n">${t('cor.v.concMin', n1(r.VcuConc, 1), n1(r.VcuMin, 1))}</span>`
      + (r.sinArmadura ? '' : `<span class="n">${t('cor.f.beta')}</span><span class="n">cotg θ<sub>e</sub> = ${n1(r.cotE, 3)} (θ<sub>e</sub> = ${n1(r.thetaE, 1)}°) → β = ${n1(r.beta, 3)}</span><span class="n">${t('cor.f.thetaE')}</span>`)
      + art(r.sinArmadura ? '44.2.3.2.1.2' : '44.2.3.2.2')));
    if (!r.sinArmadura) {
      f.push(fila('vsu', t('cor.r.Vsu'), q(r.Vsu, 'F'),
        `<span class="f">${t('cor.f.Vsu')}</span><span class="n">z = 0,9 d = ${n1(P.z, 0)} mm · A<sub>sw</sub>/s = ${n1(x.AswS, 3)} mm²/mm · f<sub>yα,d</sub> = ${n1(P.fyd, 1)} MPa${r.reduc < 1 ? ' · × 0,85 (cercos circulares)' : ''}</span>`
        + `<span class="n">V<sub>u2</sub> = ${n1(r.Vcu, 1)} + ${n1(r.Vsu, 1)} = ${q(r.Vu2, 'F')}</span>${art('44.2.3.2.2')}`));
      f.push(fila('min', t('cor.r.min'), r.minima.ok ? t('cor.ok') : t('cor.noOk'),
        `<span class="f">${t('cor.f.min')}</span><span class="n">${t('cor.r.minVal', n1(x.AswS * 1000, 0), n1(r.minima.AswSMin * 1000, 0))}</span>${art('44.2.3.4.1')}`));
    }
    f.push(fila('sep', t('cor.r.sep'), r.sinArmadura ? '—' : `${fmt(est.s, 0)} ≤ ${fmt(r.sep, 0)} mm`,
      `<span class="f">${t('cor.f.sep')}</span><span class="n">V<sub>Ed</sub> = ${n1(est.VEd, 1)} kN · V<sub>u1</sub> = ${n1(r.Vu1, 1)} kN → s<sub>t</sub> ≤ ${n1(r.sep, 0)} mm · ${t('cor.avs.trans', n1(r.sepTrans, 0))}</span>${art('44.2.3.4.1')}`));
    f.push(fila('long', t('cor.r.long'), `ΔT ${q(r.long.dT, 'F')}`,
      `<span class="f">${t('cor.f.long')}</span><span class="n">ΔT = ${n1(r.long.dT, 1)} kN · s<sub>d</sub> = ${n1(r.long.sd, 0)} mm</span>${art('44.2.3.4.2')}`));
  } else if (r.caso !== 'biela') {
    f.push(fila('vcu', t('cor.r.Vcu'), q(r.Vcu, 'F'),
      `<span class="f">${t('cor.f.Vcu')}</span><span class="n">β = ${n1(r.beta, 3)} (cotg θ<sub>e</sub> = ${n1(r.cotE, 3)})</span><span class="n">${t('cor.f.beta')}</span>${art('44.2.3.2.2')}`));
    f.push(fila('min', t('cor.r.min'), q(r.AswSMin, 'AswS'), `<span class="f">${t('cor.f.min')}</span><span class="n">${n1(r.AswSMin * 1000, 0)} mm²/m</span>${art('44.2.3.4.1')}`));
    f.push(fila('sep', t('cor.r.sep'), `≤ ${fmt(r.sMax, 0)} mm`, `<span class="f">${t('cor.f.sep')}</span>${art('44.2.3.4.1')}`));
    f.push(fila('long', t('cor.r.long'), `ΔT ${q(r.long.dT, 'F')}`, `<span class="f">${t('cor.f.long')}</span><span class="n">ΔT = ${n1(r.long.dT, 1)} kN · s<sub>d</sub> = ${n1(r.long.sd, 0)} mm</span>${art('44.2.3.4.2')}`));
  }
  return f;
}

/** Aclaraciones plegadas (guía § 14.9). */
function notas(circular, P, ec) {
  const claves = ec ? [['cor.n.alcance', 'cor.alcanceEC'], ['cor.n.ec', 'cor.ecNota']]
    : [['cor.n.alcance', 'cor.alcance'], ['cor.n.fyd', 'cor.fydNota'], ...(circular ? [['cor.n.circ', 'cor.circNota']] : [])];
  return h('div', { class: 'cor-notas' }, h('h3', {}, t('cor.notas')),
    ...claves.map(([k, v]) => h('details', { class: 'pleg' }, h('summary', {}, h('span', { html: t(k) })), h('div', { class: 'cuenta' }, h('p', { class: 'nota', html: t(v, fmt(P.fydLibre, 1)) })))));
}

export function comandos(ctx) {
  return [
    { k: 'cor.cmdComprobar', b: 'cortante comprobar shear check', f: () => { est.modo = 'comprobar'; ctx.ir('cortante'); } },
    { k: 'cor.cmdDimensionar', b: 'cortante dimensionar shear design', f: () => { est.modo = 'dimensionar'; ctx.ir('cortante'); } },
  ];
}
