// Genera un proyecto de ejemplo con el mismo formato que escribe el Prontuario 3.1
// (réplica de Graba_Archivo_de_proyecto, Graba_Hormigon, Graba_Acero, Graba_Sec_Rec,
// Graba_Sec_Rec2 y Graba_Sec_T de pih_lee.pas). Uso: node tools/genFixtures.mjs <carpeta>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'tests/fixtures/PRUEBA';
const f = (x, d) => x.toFixed(d);
const pas = (x) => {
  // writeln de un real sin formato en Delphi: " 1.00000000000000E-0003"
  const [m, e] = x.toExponential(14).split('e');
  const ex = Number(e);
  return ` ${m}E${ex < 0 ? '-' : '+'}${String(Math.abs(ex)).padStart(4, '0')}`;
};
const latin1 = (s) => Buffer.from(s.replace(/\n/g, '\r\n'), 'latin1');
mkdirSync(join(dir, 'Secciones'), { recursive: true });
mkdirSync(join(dir, 'Materiales'), { recursive: true });

function grabaHormigon(nombre, fck, cansancio, gamma) {
  const L = ['**MATERIALES', f(8500000 * Math.pow(fck / 1000 + 8, 0.33333333333), 0), '12 0'];
  let eps = 0;
  for (let i = 1; i <= 11; i++) {
    const s = -(cansancio * fck / gamma) * (-250000 * eps ** 2 + 1000 * eps);
    L.push(`${f(s, 1)}  ${f(-eps, 5)}`);
    eps += 0.0002;
  }
  L.push(`${f(-(cansancio * fck / gamma), 1)}   -0.0035`, '2  1', '0  0', '0  0.0005', f(fck, 1), f(cansancio, 3), f(gamma, 4));
  writeFileSync(join(dir, 'Materiales', `${nombre}.mat`), latin1(L.join('\n') + '\n'));
}
function grabaAcero(nombre, fyk, gamma) {
  const fyd = fyk / gamma;
  const ey = fyd / 200000000;
  const L = ['**MATERIALES', '200000000', '3  0', '0  0', `${f(-fyd, 6)}  ${f(-ey, 10)}`, `${f(-fyd, 6)}  -0.010`,
    '3  0', '0  0', `${f(fyd, 6)}  ${f(ey, 10)}`, `${f(fyd, 6)}  0.010`, f(fyk, 6), '-1', f(gamma, 3)];
  writeFileSync(join(dir, 'Materiales', `${nombre}.mat`), latin1(L.join('\n') + '\n'));
}
function grabaFicticio() {
  writeFileSync(join(dir, 'Materiales', 'ficticio.mat'),
    latin1(['**MATERIALES', '1', '2  0', '0 0', '-0.10  -0.002', '2  1', '0 0', '0 0.001', '0.10', '0.85', '1'].join('\n') + '\n'));
}
const pie = (A, Ib) => [`${pas(A)}  ${pas(Ib)}  ${pas(0)}  ${pas(0)}  ${pas(0)}  ${pas(0)}  ${pas(0)}`, `1 1 0 0 0 0 0 0 ${pas(0.03)}`];

function grabaSecRec(nombre, ancho, canto, rinf, rsup, ainf, asup, hor, ace) {
  const rlat = 0.05;
  const bs = ancho - 2 * rlat;
  const hsinf = ainf / bs;
  const hssup = asup / bs;
  const L = ['PRONTUARIO INFORMÁTICO DEL HORMIGÓN 3.0', '**SECCION ', nombre, 'Rec1',
    '4                        numero de partes',
    'T 0.00                   tipo_sec y_sup (T:seccion definida por trapecios)',
    '1                        n_trapecios',
    `${f(ancho, 4)} ${f(ancho, 4)} ${f(canto, 4)}                b_sup[1] b_inf[1] h_trap[1]`,
    '0 0                      predeformaciones', `${hor}                 Hormigón de la sección`,
    `T   ${f(canto - rinf - hsinf / 2, 6)}`, '1', `${f(bs, 8)} ${f(bs, 8)} ${f(hsinf, 8)}`, '0 0', ace,
    `T   ${f(rsup - hssup / 2, 8)}`, '1', `${f(bs, 8)} ${f(bs, 8)} ${f(hssup, 8)}`, '0 0', ace,
    `f   ${pas(0.001)}`, '1', `0 ${f(canto * 3 / 7, 4)}`, '0 0', 'ficticio',
    ...pie(ancho * canto, ancho * canto ** 3 / 12)];
  writeFileSync(join(dir, 'Secciones', `${nombre}.sec`), latin1(L.join('\n') + '\n'));
}
function grabaSecRec2(nombre, ancho, canto, rinf, rsup, fih, fiv, nh, nv, hor, ace) {
  const bs = ancho - 2 * 0.05;
  const x0 = -bs / 2;
  const dx = bs / (nh - 1);
  const grupo = (fi, pts) => [`P  ${f(fi, 6)}`, String(pts.length), ...pts.map(([x, y]) => `${f(x, 5)} ${f(y, 5)}`), '0 0', ace];
  const inf = Array.from({ length: nh }, (_, i) => [x0 + dx * i, canto - rinf]);
  const sup = Array.from({ length: nh }, (_, i) => [x0 + dx * i, rsup]);
  const dy = (canto - rsup - rinf) / (nv - 1);
  const izq = Array.from({ length: nv - 2 }, (_, i) => [-bs / 2, rsup + dy * (i + 1)]);
  const der = Array.from({ length: nv - 2 }, (_, i) => [bs / 2, rsup + dy * (i + 1)]);
  const L = ['PRONTUARIO INFORMÁTICO DEL HORMIGÓN 3.0', '**SECCION ', nombre, 'Rec2', '6                        numero de partes',
    'T 0.00                   tipo_sec y_sup (T:seccion definida por trapecios)', '1                        n_trapecios',
    `${f(ancho, 4)} ${f(ancho, 4)} ${f(canto, 4)}                b_sup[1] b_inf[1] h_trap[1]`, '0 0                      predeformaciones',
    `${hor}                 Hormigón de la sección`, ...grupo(fih, inf), ...grupo(fih, sup), ...grupo(fiv, izq), ...grupo(fiv, der),
    `f   ${pas(0.001)}`, '1', `0 ${f(canto * 3 / 7, 4)}`, '0 0', 'ficticio', ...pie(ancho * canto, ancho * canto ** 3 / 12)];
  writeFileSync(join(dir, 'Secciones', `${nombre}.sec`), latin1(L.join('\n') + '\n'));
}
function grabaSecT(nombre, Binf, Bsup, Htot, h, rinf, rsup, Ainf, Asup, hor, ace) {
  const bs = Binf - 0.1;
  const L = ['PRONTUARIO INFORMÁTICO DEL HORMIGÓN 3.0', '**SECCION ', nombre, 'T', '4', 'T 0.00', '2',
    `${f(Bsup, 4)} ${f(Bsup, 4)} ${f(h, 4)}`, `${f(Binf, 4)} ${f(Binf, 4)} ${f(Htot - h, 4)}`, '0 0', hor,
    `T   ${f(Htot - rinf - Ainf / bs / 2, 6)}`, '1', `${f(bs, 8)} ${f(bs, 8)} ${f(Ainf / bs, 8)}`, '0 0', ace,
    `T   ${f(rsup - Asup / (Bsup - 0.1) / 2, 8)}`, '1', `${f(Bsup - 0.1, 8)} ${f(Bsup - 0.1, 8)} ${f(Asup / (Bsup - 0.1), 8)}`, '0 0', ace,
    `f   ${pas(0.001)}`, '1', `0 ${f(Htot * 3 / 7, 4)}`, '0 0', 'ficticio', ...pie(0, 0)];
  writeFileSync(join(dir, 'Secciones', `${nombre}.sec`), latin1(L.join('\n') + '\n'));
}

grabaHormigon('HA-25', 25000, 0.85, 1.5);
grabaHormigon('HA-30', 30000, 0.85, 1.5);
grabaAcero('B500S', 500000, 1.15);
grabaAcero('B400S', 400000, 1.15);
grabaFicticio();
grabaSecRec('V30x50', 0.30, 0.50, 0.05, 0.05, 10e-4, 2e-4, 'HA-25', 'B500S');
grabaSecRec('V25x40', 0.25, 0.40, 0.04, 0.04, 6e-4, 0, 'HA-30', 'B400S');
grabaSecRec2('P40x40', 0.40, 0.40, 0.05, 0.05, 0.016, 0.016, 4, 4, 'HA-25', 'B500S');
grabaSecT('T60', 0.25, 0.60, 0.60, 0.12, 0.05, 0.05, 12e-4, 2e-4, 'HA-25', 'B500S');

const fecha = '08/10/2026';
const ehe = ['PRONTUARIO INFORMÁTICO DEL HORMIGÓN 3.1 PRUEBAS', '**ARCHIVO DE PROYECTO ', 'PRUEBA', 'Obra de prueba para validar la migración',
  `Última modificación ${fecha}`, '**HORMIGONES DE PROYECTO', 'HA-25', 'HA-30', '**ACEROS DE PROYECTO', 'B500S', 'B400S',
  '**SECCIONES RECTANGULARES DE PROYECTO (AREAS)', 'V30x50', 'V25x40', '**SECCIONES RECTANGULARES DE PROYECTO (REDONDOS)', 'P40x40',
  '**SECCIONES EN T DE PROYECTO', 'T60', '**SECCIONES CIRCULARES DE PROYECTO', '**SECCIONES GENÉRICAS DE PROYECTO',
  '**IMPRESIONES EFECTUADAS', '0', '**FIN DEL ARCHIVO'];
writeFileSync(join(dir, 'PRUEBA.EHE'), latin1(ehe.join('\n') + '\n'));
console.log('Proyecto de ejemplo escrito en', dir);
