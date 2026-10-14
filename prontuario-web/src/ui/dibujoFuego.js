// Esquema (sin escala) de la sección que pide la pantalla de Fuego: la cara o caras expuestas al fuego,
// la armadura y las cotas que dan los mínimos de la tabla (b, h o e, y la distancia al eje a).

import { fmt } from './formato.js';
import { t } from './i18n.js';

const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="75%">${s}</tspan>`;
const cotaH = (x1, x2, y, texto, der = false) => `<line class="cota" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
  + (der ? `<text x="${x2 + 6}" y="${y + 4}" text-anchor="start" class="fuerte">${texto}</text>`
    : `<text x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle" class="fuerte">${texto}</text>`);
const cotaV = (x, y1, y2, texto, lado = 'izq') => `<line class="cota" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#tic)" marker-end="url(#tic)"/>`
  + `<text x="${lado === 'izq' ? x - 6 : x + 6}" y="${(y1 + y2) / 2 + 4}" text-anchor="${lado === 'izq' ? 'end' : 'start'}" class="fuerte">${texto}</text>`;
const ref = (x1, y1, x2, y2) => `<line class="ref" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const barra = (x, y, r = 4.5) => `<circle class="barra-ac" cx="${x}" cy="${y}" r="${r}"/>`;
const cara = (x1, y1, x2, y2) => `<line class="expuesta" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const rect = (x, y, w, h, cl = 'hor') => `<rect class="${cl}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
/** Etiqueta «Fuego» con una flecha hacia la cara expuesta. */
const fuego = (x, y, dx, dy) => `<text class="llama" x="${x}" y="${y}" text-anchor="middle">${t('fu.dib.fuego')}</text>`
  + `<line class="llama-fl" x1="${x}" y1="${y + (dy < 0 ? -12 : 4)}" x2="${x + dx}" y2="${y + dy}" marker-end="url(#pta)"/>`;

/** Tramo de 1 m (planta del muro o corte de la losa): línea de rotura a cada extremo y cota de longitud. */
function tramo(x, y, L, h, yCota) {
  const rot = (xx) => `<path class="corte" d="M${xx} ${y} l4 ${h / 4} l-8 ${h / 4} l8 ${h / 4} l-4 ${h / 4}"/>`;
  return rot(x) + rot(x + L) + cotaH(x, x + L, yCota, '1 m') + ref(x, y + h, x, yCota + 4) + ref(x + L, y + h, x + L, yCota + 4);
}

/**
 * @param {{elemento:string, caras?:string, nCaras?:number, portante?:boolean, dimEtq:string}} e
 * @param {{d:number, a:number|null}|undefined} o  primera combinación del resultado
 */
export function dibujoFuego(e, o) {
  const v = (x) => (x == null ? '—' : fmt(x, 0));
  const dim = (o ? `${sub(e.dimEtq, 'min')} = ${v(o.d)}` : sub(e.dimEtq, 'min'));
  const aTxt = (o && o.a != null) ? `${sub('a', 'min')} = ${v(o.a)}` : sub('a', 'min');
  let s = '';
  if (e.elemento === 'pilar') {
    const x = 130; const y = 36; const L = 110; const a = 20;
    const una = e.caras === 'una';
    s += rect(x, y, L, L) + `<rect class="cerco" x="${x + a - 4}" y="${y + a - 4}" width="${L - 2 * a + 8}" height="${L - 2 * a + 8}"/>`;
    for (const [bx, by] of [[x + a, y + a], [x + L - a, y + a], [x + a, y + L - a], [x + L - a, y + L - a], [x + L / 2, y + a], [x + L / 2, y + L - a], [x + a, y + L / 2], [x + L - a, y + L / 2]]) s += barra(bx, by);
    s += una ? cara(x, y, x, y + L) : cara(x, y, x + L, y) + cara(x + L, y, x + L, y + L) + cara(x + L, y + L, x, y + L) + cara(x, y + L, x, y);
    s += fuego(x - 48, y + L / 2, 32, 0);
    s += cotaH(x, x + L, y + L + 24, dim) + ref(x, y + L, x, y + L + 28) + ref(x + L, y + L, x + L, y + L + 28);
    s += cotaH(x, x + a, y - 12, aTxt, true) + ref(x, y - 16, x, y) + ref(x + a, y - 16, x + a, y + a);
  } else if (e.elemento === 'muro' || e.elemento === 'losa') {
    // Planta del muro o corte de la losa, en un tramo de 1 m: el espesor se acota en vertical
    const muro = e.elemento === 'muro';
    const x = 74; const L = 214; const h = muro ? 56 : 52; const y = muro ? 62 : 54; const a = 14;
    const dos = muro && e.portante && e.caras === 'dos';
    s += rect(x, y, L, h);
    if (!muro || e.portante) {
      for (let i = 0; i < 8; i++) {
        const bx = x + 14 + i * 26;
        s += (muro ? barra(bx, y + a, 3.5) + barra(bx, y + h - a, 3.5) : barra(bx, y + h - a, 3.5));
      }
    }
    if (muro) {
      // el fuego llega por arriba; con dos caras, también por abajo
      s += cara(x, y, x + L, y) + (dos ? cara(x, y + h, x + L, y + h) : '');
      s += fuego(x + L / 2, y - 22, 0, 16) + (dos ? fuego(x + L / 2, y + h + 40, 0, -16) : '');
    } else {
      s += cara(x, y + h, x + L, y + h) + fuego(x + L / 2, y + h + 40, 0, -16);
    }
    s += cotaV(x + L + 16, y, y + h, dim, 'der') + ref(x + L, y, x + L + 20, y) + ref(x + L, y + h, x + L + 20, y + h);
    if (!muro || e.portante) {
      const yb = muro ? y : y + h; const sg = muro ? 1 : -1;
      s += cotaV(x - 12, sg > 0 ? yb : yb - a, sg > 0 ? yb + a : yb, aTxt, 'izq') + ref(x - 16, yb, x, yb) + ref(x - 16, yb + sg * a, x + 14, yb + sg * a);
    }
    s += tramo(x, y, L, h, y + h + (dos ? 62 : 50));
  } else {
    // Viga: tres caras (cara superior protegida por una losa más ancha y gruesa) o cuatro
    const x = 150; const y = 62; const b = 90; const h = 96; const a = 18;
    const cuatro = e.nCaras === 4;
    if (!cuatro) s += rect(x - 55, y - 25, b + 110, 25, 'losa-sup');
    s += rect(x, y, b, h);
    s += `<rect class="cerco" x="${x + a - 4}" y="${y + 14}" width="${b - 2 * a + 8}" height="${h - 14 - a + 4}"/>`;
    for (const bx of [x + a, x + b / 2, x + b - a]) s += barra(bx, y + h - a);
    for (const bx of [x + a, x + b - a]) s += barra(bx, y + 18, 3.5);
    s += cara(x, y, x, y + h) + cara(x, y + h, x + b, y + h) + cara(x + b, y + h, x + b, y) + (cuatro ? cara(x, y, x + b, y) : '');
    s += fuego(x - 56, y + 26, 40, 0);
    s += cotaH(x, x + b, y + h + 20, dim) + ref(x, y + h, x, y + h + 24) + ref(x + b, y + h, x + b, y + h + 24);
    s += cotaV(x + b + 14, y + h - a, y + h, aTxt, 'der') + ref(x + b - a, y + h - a, x + b + 18, y + h - a) + ref(x + b, y + h, x + b + 18, y + h);
    // a_sd: la barra de esquina de una sola capa va 10 mm más hacia dentro desde la cara lateral
    const asd = o && o.a != null ? `${sub('a', 'sd')} = ${v(o.a + 10)}` : sub('a', 'sd');
    s += cotaH(x, x + a, y + h - a - 16, asd).replace(/<text[^>]*>.*<\/text>/, `<text x="${x - 4}" y="${y + h - a - 12}" text-anchor="end" class="fuerte">${asd}</text>`) + ref(x + a, y + h - a - 20, x + a, y + h - a);
    s += `<text class="nota-d" x="${x + b / 2}" y="${y - (cuatro ? 14 : 32)}" text-anchor="middle">${cuatro ? t('fu.dib.cuatro') : t('fu.dib.losa')}</text>`;
  }
  return `<svg class="dib dib-fuego" viewBox="${e.elemento === 'viga' ? '52 4 260 192' : '56 4 246 196'}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('fu.dib.aria')}">`
    + `<defs><pattern id="rayado-t" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)" class="rayas-t"><line x1="0" y1="0" x2="0" y2="5"/></pattern><marker id="tic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 8L8 2" class="tic"/></marker>`
    + `<marker id="pta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" class="punta-fuego"/></marker></defs>${s}</svg>`;
}
