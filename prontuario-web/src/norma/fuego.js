// Resistencia al fuego por tablas (curva normalizada, R 30 … R 240): dimensión mínima y distancia mínima
// equivalente al eje de las armaduras, según la norma del proyecto.
//  - EHE-08: Anejo 6, apartado 5 (tablas A.6.5.2 a A.6.5.6). EHE-98 migra a EHE-08.
//  - EC-2 2004+AN y EC-2 2023: Anejo 20 del Código Estructural (versión española de EN 1992-1-2), apartado 5.
//    Los textos del EC-2 solo remiten a EN 1992-1-2 / prEN 1992-1-2, que no están en analisis/normativa/.
// Una combinación es [dimensión, a, marca]; marca '*' = manda el recubrimiento geométrico, '**' = mínimo
// 8 barras. Una celda es una lista de combinaciones; sin `a`, solo hay una dimensión (muros no portantes).

export const TIEMPOS = [30, 60, 90, 120, 180, 240];
export const ELEMENTOS = ['pilar', 'muro', 'viga', 'losa'];
export const ETA_PILAR = [0.2, 0.5, 0.7];
export const ETA_MURO = [0.35, 0.7];
export const N_PILAR = [0.15, 0.3, 0.5, 0.7];
export const OMEGA_PILAR = [0.1, 0.5, 1];

/* ---------------- EHE-08, Anejo 6 ---------------- */
const ehePilar = [[150, 15], [200, 20], [250, 30], [250, 40], [350, 45], [400, 50]]; // A.6.5.2 (3 o 4 caras)
const eheMuroNoPort = [60, 80, 100, 120, 150, 175]; // A.6.5.3.1 (también A20.5.3 del CE)
const eheMuroPort = [ // A.6.5.3.2: [una cara, ambas caras]
  [[100, 15], [120, 15]], [[120, 15], [140, 15]], [[140, 20], [160, 25]], [[160, 25], [180, 35]], [[200, 40], [250, 45]], [[250, 50], [300, 50]],
];
const eheViga = [ // A.6.5.5.2: opciones 1-4 y ancho mínimo del alma b0
  { o: [[80, 20], [120, 15], [200, 10]], w: 80 }, { o: [[100, 30], [150, 25], [200, 20]], w: 100 },
  { o: [[150, 40], [200, 35], [250, 30], [400, 25]], w: 100 }, { o: [[200, 50], [250, 45], [300, 40], [500, 35]], w: 120 },
  { o: [[300, 75], [350, 65], [400, 60], [600, 50]], w: 140 }, { o: [[400, 75], [500, 70], [700, 60]], w: 160 },
];
const eheLosa = [ // A.6.5.6: h, a unidireccional, a bidireccional ly/lx ≤ 1,5, a bidireccional 1,5 < ly/lx ≤ 2
  [60, 10, 10, 10], [80, 20, 10, 20], [100, 25, 15, 25], [120, 35, 20, 30], [150, 50, 30, 40], [175, 60, 50, 50],
];

/* ---------------- CE, Anejo 20 ---------------- */
const cePilar = [ // A20.5.2a (Método A): ηfi 0,2 / 0,5 / 0,7 con más de una cara expuesta, y una cara (ηfi 0,7)
  { 0.2: [[200, 25]], 0.5: [[200, 25]], 0.7: [[200, 32], [300, 27]], una: [[155, 25]] },
  { 0.2: [[200, 25]], 0.5: [[200, 36], [300, 31]], 0.7: [[250, 46], [350, 40]], una: [[155, 25]] },
  { 0.2: [[200, 31], [300, 25]], 0.5: [[300, 45], [400, 38]], 0.7: [[350, 53], [450, 40, '**']], una: [[155, 25]] },
  { 0.2: [[250, 40], [350, 35]], 0.5: [[350, 45, '**'], [450, 40, '**']], 0.7: [[350, 57, '**'], [450, 51, '**']], una: [[175, 35]] },
  { 0.2: [[350, 45, '**']], 0.5: [[350, 63, '**']], 0.7: [[450, 70, '**']], una: [[230, 55]] },
  { 0.2: [[350, 61, '**']], 0.5: [[450, 75, '**']], 0.7: [], una: [[295, 70]] },
];
// Tabla A20.5.2b (Método B), igual que la 5.2b de UNE-EN 1992-1-2: por R y ω, una celda por n = 0,15 / 0,3 / 0,5 / 0,7.
// Cada celda: combinaciones «b/a» separadas por «:»; «*» = manda el recubrimiento geométrico; «(1)» = ancho > 600 mm.
const ceMetodoB = {
  0.1: ['150/25* | 150/25* | 200/30:250/25* | 300/30:350/25*', '150/30:200/25* | 200/40:300/25* | 300/40:500/25* | 500/25*', '200/40:250/25* | 300/40:400/25* | 500/50:550/25* | 550/40:600/25*',
    '250/50:350/25* | 400/50:550/25* | 550/25* | 550/60:600/45', '400/50:500/25* | 500/60:550/25* | 550/60:600/30 | (1)', '500/60:550/25* | 550/40:600/25* | 600/75 | (1)'],
  0.5: ['150/25* | 150/25* | 150/25* | 200/30:250/25*', '150/25* | 150/35:200/25* | 250/35:350/25* | 350/40:550/25*', '150/35:200/25* | 200/45:300/25* | 300/45:550/25* | 500/50:600/40',
    '200/45:300/25* | 300/45:550/25* | 450/50:600/25* | 500/60:600/50', '300/45:450/25* | 450/50:600/25* | 500/60:600/50 | 600/75', '450/45:500/25* | 550/55:600/25* | 600/70 | (1)'],
  1: ['150/25* | 150/25* | 150/25* | 200/30:300/25*', '150/25* | 150/30:200/25* | 200/40:400/25* | 300/50:600/30', '200/25* | 200/40:300/25* | 250/40:550/25* | 500/50:600/45',
    '200/40:250/25* | 250/50:400/25* | 450/45:600/30 | 600/60', '300/35:400/25* | 450/50:550/25* | 500/60:600/45 | (1)', '400/45:500/25* | 500/40:600/30 | 600/60 | (1)'],
};
/** «200/30:250/25*» → [[200,30],[250,25,'*']]; «(1)» → []. */
const celdaB = (x) => (x === '(1)' ? [] : x.split(':').map((c) => { const m = /^(\d+)\/(\d+)(\*)?$/.exec(c); return m[3] ? [+m[1], +m[2], '*'] : [+m[1], +m[2]]; }));
const ceMuroPort = [ // A20.5.4: ηfi 0,35 (una cara, dos caras) y 0,7 (una cara, dos caras)
  [[100, 10, '*'], [120, 10, '*'], [120, 10, '*'], [120, 10, '*']], [[110, 10, '*'], [120, 10, '*'], [130, 10, '*'], [140, 10, '*']],
  [[120, 20, '*'], [140, 10, '*'], [140, 25], [170, 25]], [[150, 25], [160, 25], [160, 35], [220, 35]],
  [[180, 40], [200, 45], [210, 50], [270, 55]], [[230, 55], [250, 55], [270, 60], [350, 60]],
];
const ceVigaSimple = [ // A20.5.5: combinaciones b/a y espesor del alma (clases WA, WB, WC)
  { o: [[80, 25], [120, 20], [160, 15, '*'], [200, 15, '*']], w: [80, 80, 80] }, { o: [[120, 40], [160, 35], [200, 30], [300, 25]], w: [100, 80, 100] },
  { o: [[150, 55], [200, 45], [300, 40], [400, 35]], w: [110, 100, 100] }, { o: [[200, 65], [240, 60], [300, 55], [500, 50]], w: [130, 120, 120] },
  { o: [[240, 80], [300, 70], [400, 65], [600, 60]], w: [150, 150, 140] }, { o: [[280, 90], [350, 80], [500, 75], [700, 70]], w: [170, 170, 160] },
];
const ceVigaCont = [ // A20.5.6
  { o: [[80, 15, '*'], [160, 12, '*']], w: [80, 80, 80] }, { o: [[120, 25], [200, 12, '*']], w: [100, 80, 100] },
  { o: [[150, 35], [250, 25]], w: [110, 100, 100] }, { o: [[200, 45], [300, 35], [450, 35], [500, 30]], w: [130, 120, 120] },
  { o: [[240, 60], [400, 50], [550, 50], [600, 40]], w: [150, 150, 140] }, { o: [[280, 75], [500, 60], [650, 60], [700, 50]], w: [170, 170, 160] },
];
const ceLosa = [ // A20.5.8: h, y a como [valor, marca] en unidireccional, bidireccional ≤ 1,5 y 1,5 < ly/lx ≤ 2
  [60, [10, '*'], [10, '*'], [10, '*']], [80, [20], [10, '*'], [15, '*']], [100, [30], [15, '*'], [20]], [120, [40], [20], [25]],
  [150, [55], [30], [40]], [175, [65], [40], [50]],
];

/* ---------------- ayudas ---------------- */
/** Celda → texto «d/a» por combinación (o «—» si no hay). */
export function textoCelda(cel) {
  if (!cel || !cel.length) return '—';
  return cel.map(([d, a, m]) => (a == null ? `${d}` : `${d}/${a}${m ?? ''}`)).join(' · ');
}
const reducir = (cel, tambienA) => cel.map(([d, a, m]) => [Math.ceil(d * 0.9 - 1e-9), a == null || !tambienA ? a : Math.ceil(a * 0.9 - 1e-9), m]);
const opc = (cel) => cel.map(([d, a, m]) => ({ d, a: a ?? null, geom: m === '*', barras8: m === '**' }));
const col = (lista) => lista.map((x) => [[Array.isArray(x) ? x : [x]]]); // tabla de una columna con una combinación por fila

/**
 * Requisitos de resistencia al fuego por tablas.
 * @param {object} e { norma, elemento, R, arido:'siliceo'|'calizo', ... }
 *   pilar: caras ('varias'|'una'), eta (0.2|0.5|0.7)    muro: portante, caras ('una'|'dos'), eta (0.35|0.7)
 *   viga: continua    losa: dir ('uni'|'bi15'|'bi2')
 * @returns {{fuente, articulo, tabla, cab:string[], filas:{R,cel,activa}[], opciones, extra, notas:string[], dimEtq}}
 */
export function fuego(e) {
  const ehe = e.norma === 'EHE-08' || e.norma === 'EHE-98';
  const k = TIEMPOS.indexOf(e.R);
  if (k < 0) throw new Error(`Tiempo no tabulado: R ${e.R}`);
  const caras2 = e.caras === 'dos';
  const notas = [];
  let colActiva = null; let cab; let filas; let extra = []; let articulo; let tabla; let dimEtq = 'b';

  if (e.elemento === 'pilar') {
    if (ehe) {
      articulo = 'Anejo 6, 5.2'; tabla = 'A.6.5.2';
      cab = ['b<sub>min</sub>/a<sub>min</sub>'];
      filas = col(ehePilar);
      notas.push('f.pilar.ehe');
    } else if (e.metodo === 'B') {
      articulo = 'Anejo 20, 5.3.3 (Método B)'; tabla = 'A20.5.2b';
      const w = OMEGA_PILAR.includes(e.omega) ? e.omega : 0.5;
      cab = N_PILAR.map((n) => `n = ${String(n).replace('.', ',')}`);
      filas = ceMetodoB[w].map((f) => f.split(' | ').map(celdaB));
      colActiva = Math.max(0, N_PILAR.indexOf(e.n));
      notas.push('f.pilar.ceB');
    } else {
      articulo = 'Anejo 20, 5.3.2 (Método A)'; tabla = 'A20.5.2a';
      const c = e.caras === 'una' ? 'una' : (e.eta ?? 0.7);
      cab = [c === 'una' ? '1 cara' : `η<sub>fi</sub> = ${String(c).replace('.', ',')}`];
      filas = cePilar.map((x) => [x[c]]);
      notas.push('f.pilar.ce');
      if (c !== 'una') notas.push('f.pilar.varias');
    }
    notas.push('f.pilar.arm2');
  } else if (e.elemento === 'muro') {
    if (!e.portante) {
      dimEtq = 'e'; articulo = ehe ? 'Anejo 6, 5.3.1' : 'Anejo 20, 5.4.1'; tabla = ehe ? 'A.6.5.3.1' : 'A20.5.3';
      cab = ['e<sub>min</sub> (EI)'];
      filas = col(eheMuroNoPort);
      notas.push('f.muro.esbeltez');
    } else if (ehe) {
      dimEtq = 'e'; articulo = 'Anejo 6, 5.3.2'; tabla = 'A.6.5.3.2';
      cab = [`e<sub>min</sub>/a<sub>min</sub> · ${caras2 ? '2 caras' : '1 cara'}`];
      filas = eheMuroPort.map((x) => [[x[caras2 ? 1 : 0]]]);
    } else {
      dimEtq = 'e'; articulo = 'Anejo 20, 5.4.2'; tabla = 'A20.5.4';
      const bajo = (e.eta ?? 0.7) <= 0.35;
      cab = [`η<sub>fi</sub> = ${bajo ? '0,35' : '0,7'} · ${caras2 ? '2 caras' : '1 cara'}`];
      filas = ceMuroPort.map((x) => [[x[(bajo ? 0 : 2) + (caras2 ? 1 : 0)]]]);
      notas.push('f.muro.esbeltez');
    }
  } else if (e.elemento === 'viga') {
    if (ehe) {
      articulo = 'Anejo 6, 5.5'; tabla = 'A.6.5.5.2';
      cab = [1, 2, 3, 4].map((n) => `Opción ${n}`);
      filas = eheViga.map((x) => [0, 1, 2, 3].map((i) => (x.o[i] ? [x.o[i]] : [])));
      extra = [['f.almaEHE', `${eheViga[k].w}`]];
      notas.push('f.viga.ehe');
    } else {
      const T = e.continua ? ceVigaCont : ceVigaSimple;
      articulo = `Anejo 20, ${e.continua ? '5.6.3' : '5.6.2'}`; tabla = e.continua ? 'A20.5.6' : 'A20.5.5';
      cab = [1, 2, 3, 4].map((n) => `Opción ${n}`);
      filas = T.map((x) => [0, 1, 2, 3].map((i) => (x.o[i] ? [x.o[i]] : [])));
      extra = [['f.almaCE', T[k].w.join(' · ')]];
      notas.push('f.viga.ce');
      if (e.continua) notas.push('f.viga.cont15');
    }
    notas.push(e.nCaras === 4 ? 'f.viga.cuatro' : 'f.viga.tres', 'f.viga.esquina');
  } else if (e.elemento === 'losa') {
    dimEtq = 'h';
    const j = e.dir === 'uni' ? 1 : e.dir === 'bi15' ? 2 : 3;
    articulo = ehe ? 'Anejo 6, 5.6' : 'Anejo 20, 5.7.2'; tabla = ehe ? 'A.6.5.6' : 'A20.5.8';
    cab = [`h<sub>min</sub>/a<sub>min</sub> · ${j === 1 ? 'una dirección' : j === 2 ? 'dos dir., l<sub>y</sub>/l<sub>x</sub> ≤ 1,5' : 'dos dir., 1,5 &lt; l<sub>y</sub>/l<sub>x</sub> ≤ 2'}`];
    filas = (ehe ? eheLosa : ceLosa).map((x) => [[ehe ? [x[0], x[j]] : [x[0], x[j][0], x[j][1]]]]);
    notas.push('f.losa.espesor', 'f.losa.neg');
  } else {
    throw new Error(`Elemento desconocido: ${e.elemento}`);
  }

  // Árido calizo: −10 % en vigas y losas (EHE-08: dimensión y a_min; CE: solo la dimensión) y en muros no
  // portantes (espesor); en pilares y muros portantes no se admite reducción.
  if (e.arido === 'calizo') {
    const admite = e.elemento === 'viga' || e.elemento === 'losa' || (e.elemento === 'muro' && !e.portante);
    if (admite) {
      filas = filas.map((f) => f.map((cel) => reducir(cel, ehe)));
      notas.push(ehe ? 'f.caliza.ehe' : 'f.caliza.ce');
    } else notas.push('f.caliza.noAdmite');
  }

  notas.push(ehe ? 'f.fck.ehe' : 'f.fck.ce');
  if (!ehe) notas.push('f.ce.fuente');
  if (e.norma === 'EC2-2023') notas.push('f.ec2023');
  if (e.norma === 'EC2-2004') notas.push('f.ec22004');
  if (e.norma === 'EHE-98') notas.push('f.ehe98');

  const crit = e.elemento === 'losa' || (e.elemento === 'muro' && e.portante) ? 'REI' : e.elemento === 'muro' ? 'EI' : 'R';
  let sinCaras = false;
  if (e.elemento === 'pilar' && ehe && e.nCaras && e.nCaras < 3) { sinCaras = true; notas.push('f.pilar.eheCaras'); }
  const out = filas.map((f, i) => ({ R: TIEMPOS[i], cel: f, activa: i === k }));
  const ceTabla = tabla;
  if (!ehe) { articulo = articulo.replace('Anejo 20, ', ''); tabla = tabla.replace('A20.', ''); }
  const opciones = sinCaras ? [] : colActiva != null ? opc(out[k].cel[colActiva]) : out[k].cel.flatMap(opc);
  if (e.elemento === 'viga' && e.nCaras === 4 && opciones[0]) {
    extra = [...extra, ['f.viga4.canto', `≥ ${opciones[0].d}`, 'mm'], ['f.viga4.area', `≥ ${2 * opciones[0].d * opciones[0].d}`, 'mm²']];
  }
  return { fuente: ehe ? 'EHE-08' : 'EN', ceTabla, colActiva, crit, articulo, tabla, cab, filas: out, dimEtq, opciones, extra, notas };
}
