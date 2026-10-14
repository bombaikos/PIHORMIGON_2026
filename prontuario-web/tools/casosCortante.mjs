// Calcula con el módulo Cortante (EHE-08) los casos de analisis/cortante/casos-ehe31.csv y escribe
// casos-ehe31-app.csv con las mismas columnas de resultado, para compararlo con lo que dé EHE.exe (Prontuario 3.1).
// Uso: node tools/casosCortante.mjs   (desde prontuario-web/)
// Convenciones: N de compresión positivo (como la pantalla); σ'cd en compresión positiva; cercos B 500 S (fyd = 400 MPa).
import { readFileSync, writeFileSync } from 'node:fs';
import { comprobar, dimensionar, AswSDe, thetaDe } from '../src/norma/cortante/ehe08.js';

const ruta = new URL('../../analisis/cortante/', import.meta.url);
const txt = readFileSync(new URL('casos-ehe31.csv', ruta), 'utf8').replace(/^﻿/, '');
const [cab, ...filas] = txt.trim().split(/\r?\n/);
const AVISOS = { 'cor.av.fyd400': 'fyd limitado a 400 MPa', 'cor.av.rho': 'ρl topado a 20 ‰', 'cor.av.sigCd': "σ'cd topado a 0,30 fcd", 'cor.av.traccion': 'tracción', 'cor.av.minima': 'armadura menor que la mínima', 'cor.av.tercio': 'cercos inclinados: 1/3 a 90°', 'cor.av.sinArm': 'sin cercos', 'cor.av.fck60': 'fck > 60' };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
const salida = [cab];
for (const linea of filas) {
  const c = linea.split(';');
  const [caso, modo, sec, b0, h, d, hor, fck, ace, ro, Nd, sy, teta, alfa, fi, s, ramas, Vd] = c;
  const fykCercos = ace.includes('400') ? 400 : 500;
  const x = {
    fck: +fck, fykCercos, fykLong: fykCercos, b0: +b0 * 1000, d: +d * 1000, Ac: +b0 * +h * 1e6,
    Asl: (+ro / 1000) * +b0 * 1000 * +d * 1000, NEd: +Nd, sigY: -+sy, alfa: +alfa, cotTheta: 1 / Math.tan((+teta * Math.PI) / 180),
  };
  let res = [];
  if (modo.startsWith('dimension')) {
    const r = dimensionar(x, +Vd);
    const tabla = r.tabla ? r.tabla.map((t) => `ø${t.fi}: ${t.s ? `${t.ramas}R a ${t.s} mm` : '—'}`).join(' | ') : '';
    res = [f(r.P.sigCd), f(thetaDe(r.cotE ?? 1), 1), f(r.Vu1, 1), f(r.Vcu, 1), '', '', '', f(r.AswS * 10, 3),
      `${r.caso === 'biela' ? 'Vd > Vu1: aumentar la sección' : r.caso === 'minima' ? 'Cuantía mínima' : 'Armadura calculada'} · necesaria ${f(r.AswSNec * 10, 3)} · mínima ${f(r.AswSMin * 10, 3)} cm²/m · ${tabla}`];
  } else {
    const sin = modo.includes('sin');
    const r = comprobar({ ...x, AswS: !sin && fi ? AswSDe(+fi, +ramas, +s * 1000) : 0, sinArmadura: sin });
    res = [f(r.P.sigCd), r.cotE ? f(r.thetaE, 1) : '', sin ? '' : f(r.Vu1, 1), f(r.Vcu, 1), f(r.Vsu, 1), f(r.Vu2, 1), f(r.Vu, 1), r.AswS ? '' : '', r.avisos.map((a) => AVISOS[a.clave] ?? a.clave).join(' · ')];
  }
  // Las columnas de resultado empiezan tras la columna vacía (índice 18)
  salida.push([...c.slice(0, 19), ...res].join(';'));
}
writeFileSync(new URL('casos-ehe31-app.csv', ruta), `﻿${salida.join('\r\n')}\r\n`);
console.log(`escrito analisis/cortante/casos-ehe31-app.csv (${filas.length} casos)`);
