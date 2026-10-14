import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerArmado, leerNumero, textoArmado, leerCapas } from '../src/core/armado.js';
import { geometria, trapecios, seccionMotor } from '../src/core/geometria.js';
import { propiedades } from '../src/core/propiedades.js';
import { centroHomogeneizado } from '../src/core/seccion.js';
import { durabilidad as durEHE } from '../src/norma/ehe98/durabilidad.js';
import { durabilidad as durEC2 } from '../src/norma/ec2-2023/durabilidad.js';
import { proyectoNuevo, datosRectangular, migrarSeccion, normalizarCaras } from '../src/io/proyecto.js';
import { hormigon, acero } from '../src/core/materiales.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (±${tol})`);

test('lee armaduras en todos los formatos', () => {
  const a = leerArmado('2D25+8D12');
  assert.deepEqual(a.barras, [{ n: 2, fi: 25 }, { n: 8, fi: 12 }]);
  cerca(a.A, 2 * Math.PI * 625 / 4 + 8 * Math.PI * 144 / 4, 1e-9);
  assert.equal(leerArmado('4ø16').A, leerArmado('4fi16').A);
  assert.equal(leerArmado('4x16').A, leerArmado('4 D 16').A);
  assert.equal(leerArmado('1030').A, 1030);
  const m = leerArmado('2D20+300');
  assert.equal(m.Aarea, 300);
  assert.equal(textoArmado(m), '2D20+300');
  assert.equal(leerArmado('').A, 0);
  assert.equal(leerArmado('4D'), null);
  assert.equal(leerArmado('abc'), null);
  assert.equal(leerNumero('2*150'), 300);
  assert.equal(leerNumero('0,45'), 0.45);
  assert.ok(Number.isNaN(leerNumero('2**')));
});

test('propiedades de la rectangular coinciden con las fórmulas cerradas', () => {
  const g = geometria({ forma: 'rectangular', geo: { b: 0.3, h: 0.5 }, armado: [{ tipo: 'capa', cara: 'inf', texto: '4D16', d: 0.045 }] });
  const Ec = 8500 * Math.cbrt(33) * 1000;
  const Es = 2e8;
  const p = propiedades(g, { Ec, Es, fctm: 0.3 * 25 ** (2 / 3) * 1000 });
  cerca(p.bruta.A, 0.15, 1e-12);
  cerca(p.bruta.Ix, 0.3 * 0.5 ** 3 / 12, 1e-12);
  cerca(p.bruta.yg, 0.25, 1e-12);
  // Fisurada a mano: b·x²/2 = n·As·(d − x); Ifis = b·x³/3 + n·As·(d − x)²
  const n = Es / Ec;
  const As = 4 * Math.PI * 0.016 ** 2 / 4;
  const d = 0.455;
  const x = (-n * As + Math.sqrt((n * As) ** 2 + 2 * 0.3 * n * As * d)) / 0.3;
  cerca(p.fisurada.positivo.x, x, 1e-6, 'x');
  cerca(p.fisurada.positivo.Ifis, 0.3 * x ** 3 / 3 + n * As * (d - x) ** 2, 1e-9, 'Ifis');
  // Homogeneizada a mano
  const Ah = 0.15 + n * As;
  const yh = (0.15 * 0.25 + n * As * d) / Ah;
  cerca(p.homogeneizada.yg, yh, 1e-12);
  cerca(p.homogeneizada.Ix, 0.3 * 0.5 ** 3 / 12 + 0.15 * (yh - 0.25) ** 2 + n * As * (d - yh) ** 2, 1e-12);
  cerca(p.fisurada.positivo.Mfis, 0.3 * 25 ** (2 / 3) * 1000 * p.homogeneizada.Ix / (0.5 - yh), 1e-9);
});

test('T y circular: área, c.d.g. e inercia', () => {
  const T = geometria({ forma: 'T', geo: { b: 1, h: 0.6, bw: 0.3, hf: 0.15 }, armado: [] });
  const t = propiedades(T, { Ec: 3e7, Es: 2e8, fctm: 2565 }).bruta;
  const A = 1 * 0.15 + 0.3 * 0.45;
  const yg = (0.15 * 0.075 + 0.135 * 0.375) / A;
  cerca(t.A, A, 1e-12);
  cerca(t.yg, yg, 1e-12);
  cerca(t.Ix, 1 * 0.15 ** 3 / 12 + 0.15 * (yg - 0.075) ** 2 + 0.3 * 0.45 ** 3 / 12 + 0.135 * (0.375 - yg) ** 2, 1e-12);
  assert.equal(trapecios(T.contornos).length, 2);
  const C = geometria({ forma: 'circular', geo: { D: 0.5 }, armado: [{ tipo: 'anillo', texto: '8D20', r: 0.05 }] });
  const c = propiedades(C, { Ec: 3e7, Es: 2e8, fctm: 2565 }).bruta;
  cerca(c.A, Math.PI * 0.25 ** 2, 1e-9);
  cerca(c.Ix, Math.PI * 0.5 ** 4 / 64, 2e-6 * 0.0031);
  assert.equal(C.barras.length, 8);
  cerca(Math.hypot(C.barras[3].x - 0.25, C.barras[3].y - 0.25), 0.2, 1e-12);
});

test('el motor ve la misma sección que la geometría', () => {
  const H = hormigon({ fck: 25 });
  const S = acero({ fyk: 500 });
  const g = geometria({ forma: 'T', geo: { b: 1, h: 0.6, bw: 0.3, hf: 0.15 }, armado: [{ tipo: 'capa', cara: 'inf', texto: '4D20', d: 0.05 }] });
  const sec = seccionMotor(g, H, S);
  const p = propiedades(g, { Ec: H.E, Es: S.E, fctm: 2565 });
  const c = centroHomogeneizado(sec);
  cerca(c.A, p.homogeneizada.A, 1e-12);
  cerca(c.yg, p.homogeneizada.yg, 1e-12);
});

test('durabilidad EHE-98 como el Prontuario 3.1', () => {
  const r = durEHE({ ambiente: 'IIa', exposiciones: [], fck: 25, control: 'normal', arido: 20 });
  assert.equal(r.ac, 0.6);
  assert.equal(r.cemento, 275);
  assert.equal(r.fckMin, 25);
  assert.equal(r.rmin, 25);
  assert.equal(r.rnom, 35);
  assert.equal(r.tipificacion, 'HA-25/B/20/IIa');
  const q = durEHE({ ambiente: 'IIIa', exposiciones: ['Qb', 'F'], fck: 30, control: 'intenso', arido: 40 });
  assert.equal(q.ac, 0.5);
  assert.equal(q.cemento, 350);
  assert.equal(q.rmin, 40); // clase Qb y 0,8·40 = 32
  assert.equal(q.rnom, 45);
  assert.ok(q.notas.some((n) => n.clave === 'dur.aire'));
  assert.equal(durEHE({ ambiente: 'I', fck: 25, arido: 40 }).rmin, 32); // manda el árido
});

test('recubrimiento EC2-2023 con cmin,dur del usuario', () => {
  const r = durEC2({ clases: ['XC3'], cminDur: 25, fiMax: 16, dcdev: 10 });
  assert.equal(r.cmin, 25);
  assert.equal(r.rnom, 35);
  cerca(r.ksurf(40), 40 / 35, 1e-12);
  assert.equal(durEC2({ cminDur: 10, fiMax: 25 }).rnom, 35);
});

test('las secciones de la versión 1 se migran y la flexión sigue igual', () => {
  const p = proyectoNuevo();
  const v1 = { nombre: 'V', tipo: 'rectangular', b: 0.3, h: 0.5, rinf: 0.05, rsup: 0.05, Ainf: 10e-4, Asup: 2e-4, hormigon: 'HA-25', acero: 'B 500 S' };
  const s = migrarSeccion(v1);
  assert.equal(s.forma, 'rectangular');
  const d = datosRectangular(p, s);
  cerca(d.Ainf, 10e-4, 1e-12);
  cerca(d.Asup, 2e-4, 1e-12);
  cerca(d.rinf, 0.05, 1e-12);
});

test('capas: cada sumando es una capa, sin mezclar diámetros ni barras sueltas', () => {
  const r = leerCapas('5D20+2D16');
  assert.equal(r.capas.length, 2);
  assert.deepEqual([r.capas[0].n, r.capas[0].fi, r.capas[1].n, r.capas[1].fi], [5, 20, 2, 16]);
  assert.equal(leerCapas('1D20').error, 'err.unaBarra');
  assert.equal(leerCapas('4D16+2D12', { maxCapas: 1 }).error, 'err.unaCapa');
  assert.equal(leerCapas('8D16+300', { soloBarras: true }).error, 'err.soloBarras');
  assert.equal(leerCapas('1030').A, 1030);
  assert.equal(leerCapas('4Z25'), null);
});

test('las capas de una cara van a d, d + sep…, con las barras de extremo a extremo', () => {
  const s = { forma: 'rectangular', geo: { b: 0.3, h: 0.5 }, armado: [{ tipo: 'capa', cara: 'inf', texto: '3D20+2D16', d: 0.05 }] };
  const g = geometria(s, { sep: 0.05 });
  const c1 = g.barras.filter((b) => b.capa === 0);
  const c2 = g.barras.filter((b) => b.capa === 1);
  assert.deepEqual(c1.map((b) => +b.x.toFixed(3)), [0.05, 0.15, 0.25]);
  assert.ok(c1.every((b) => cerca(b.y, 0.45, 1e-9) ?? true));
  assert.deepEqual(c2.map((b) => +b.x.toFixed(3)), [0.05, 0.25]);
  cerca(c2[0].y, 0.40, 1e-9);
  const g2 = geometria(s, { sep: 0.06 });
  cerca(g2.barras.find((b) => b.capa === 1).y, 0.39, 1e-9);
});

test('las capas importadas a sep de distancia se juntan en un solo texto', () => {
  const s = normalizarCaras({ forma: 'rectangular', geo: { b: 0.3, h: 0.5 }, armado: [
    { tipo: 'capa', cara: 'inf', texto: '2D16', d: 0.1 }, { tipo: 'capa', cara: 'inf', texto: '5D20', d: 0.05 }] }, 0.05);
  assert.deepEqual(s.armado.map((g) => [g.cara, g.texto, g.d]), [['sup', '', 0.04], ['inf', '5D20+2D16', 0.05]]);
});

test('genérica: barras por caras sobre la paralela interior, con la esquina común una sola vez', () => {
  const s = { forma: 'generica', geo: { contorno: [[0, 0], [0.6, 0], [0.6, 0.15], [0.4, 0.15], [0.4, 0.5], [0.2, 0.5], [0.2, 0.15], [0, 0.15]], huecos: [] },
    armado: [{ tipo: 'caras', d: 0.04, textos: ['4D12', '', '', '3D16', '3D20', '', '', ''] }] };
  const g = geometria(s);
  assert.deepEqual(g.errores, []);
  const mm = (b) => [Math.round(b.x * 1000), Math.round(b.y * 1000), b.fi];
  // Cada cara manda en su vértice de salida y no pone la barra del siguiente
  assert.deepEqual(g.barras.filter((b) => b.cara === 0).map(mm), [[40, 40, 12], [170, 40, 12], [300, 40, 12], [430, 40, 12]]);
  // La cara 4 baja por el alma a 40 mm del paramento; su esquina inferior es el arranque de la cara 5 (ø20)
  assert.deepEqual(g.barras.filter((b) => b.cara === 3).map(mm), [[360, 110, 16], [360, 227, 16], [360, 343, 16]]);
  assert.deepEqual(g.barras.filter((b) => b.cara === 4).map(mm), [[360, 460, 20], [320, 460, 20], [280, 460, 20]]);
  assert.equal(g.barras.length, 10);
  // Una sola barra vale: es la del vértice de salida
  const una = geometria({ ...s, armado: [{ tipo: 'caras', d: 0.04, textos: ['1D12'] }] });
  assert.deepEqual(una.errores, []);
  assert.deepEqual(una.barras.map(mm), [[40, 40, 12]]);
});

test('pilar rectangular: barras por cara horizontal y vertical, esquinas contadas en las dos', () => {
  const s = { forma: 'pilar', geo: { b: 0.4, h: 0.6 }, armado: [{ tipo: 'perimetral', nx: 5, ny: 4, fi: 20, d: 0.05 }] };
  const g = geometria(s);
  assert.deepEqual(g.errores, []);
  assert.equal(g.barras.length, 2 * 5 + 2 * (4 - 2));
  cerca(g.barras.reduce((a, b) => a + b.A, 0), 14 * Math.PI * 0.02 ** 2 / 4, 1e-12);
  const esquinas = [[0.05, 0.05], [0.35, 0.05], [0.05, 0.55], [0.35, 0.55]];
  for (const [x, y] of esquinas) assert.equal(g.barras.filter((b) => Math.hypot(b.x - x, b.y - y) < 1e-9).length, 1, `esquina ${x},${y}`);
  // Laterales a tercios de la altura útil
  const lat = g.barras.filter((b) => b.cara === 'lat').map((b) => b.y).sort((a, b) => a - b);
  cerca(lat[0], 0.05 + 0.5 / 3, 1e-12);
  cerca(lat[3], 0.05 + 1 / 3, 1e-12);
  assert.match(geometria({ ...s, armado: [{ tipo: 'perimetral', nx: 1, ny: 3, fi: 16, d: 0.05 }] }).errores[0].clave, /perimMinimo/);
  assert.match(geometria({ ...s, forma: 'rectangular' }).errores[0].clave, /perimSoloPilar/);
});

test('genérica: cara con diámetro y separación (D16/0.20) redondea el número de barras y avisa si no encaja', () => {
  const s = { forma: 'generica', geo: { contorno: [[0, 0], [1.0, 0], [1.0, 0.3], [0, 0.3]], huecos: [] },
    armado: [{ tipo: 'caras', d: 0.04, textos: ['D16/0.20', '', 'D12/200', ''] }] };
  const g = geometria(s);
  assert.deepEqual(g.errores, []);
  // Cara 1: paralela interior de 920 mm → round(4.6) = 5 barras a 184 mm, sin la del vértice siguiente
  assert.equal(g.barras.filter((b) => b.cara === 0).length, 5);
  assert.deepEqual(g.avisos, []);
  assert.equal(g.barras.filter((b) => b.cara === 2).length, 5);
  // Lado corto frente a la separación: una barra y aviso
  const corto = geometria({ ...s, armado: [{ tipo: 'caras', d: 0.04, textos: ['', 'D16/0.50', '', ''] }] });
  assert.equal(corto.barras.length, 1);
  assert.equal(corto.avisos[0].clave, 'geoAv.caraSep');
});

test('normas del proyecto: EC-2 2004 + AN por defecto, EHE-98 migra a EHE-08', async () => {
  const { NORMA_DEFECTO, NORMAS } = await import('../src/norma/normas.js');
  const { validarProyecto } = await import('../src/io/proyecto.js');
  assert.equal(NORMA_DEFECTO, 'EC2-2004');
  assert.equal(proyectoNuevo().norma, 'EC2-2004');
  assert.deepEqual(Object.keys(NORMAS).filter((k) => !NORMAS[k].vigente).sort(), ['EC2-2023', 'EHE-08']);
  const p = validarProyecto({ formato: 'prontuario-web', norma: 'EHE-98', hormigones: [], aceros: [], secciones: [] });
  assert.equal(p.norma, 'EHE-08');
  assert.equal(p.normaMigrada, 'EHE-98');
});

test('materiales EC-2 2004 + AN y EHE-08: α = 1, parábola n y εcu según fck', () => {
  const h25 = hormigon({ fck: 25, norma: 'EC2-2004' });
  cerca(-Math.min(...h25.comp.map((x) => x[1])), 25000 / 1.5, 1e-9);
  const h70 = hormigon({ fck: 70, norma: 'EC2-2004' });
  cerca(-h70.comp[h70.comp.length - 1][0], 0.0026 + 0.035 * 0.2 ** 4, 1e-12);
  cerca(h70.E, 22000 * (7.8) ** 0.3 * 1000, 1e-3);
  const e70 = hormigon({ fck: 70, norma: 'EHE-08' });
  cerca(-e70.comp[e70.comp.length - 1][0], 0.0026 + 0.0144 * 0.3 ** 4, 1e-12);
  assert.equal(hormigon({ fck: 30, norma: 'EHE-08' }).alfa, 1);
  assert.equal(acero({ fyk: 500, norma: 'EC2-2004' }).tracc[2][0], 0.010);
});

test('cuantía mínima mecánica: viga (EC-2 2004 + AN, AN 9.2.1.1) y pilar', async () => {
  const { cuantiaMinima } = await import('../src/core/cuantiaMinima.js');
  // 300×500, C25: W = bh²/6, fct,m,fl = (1,6−0,5)·fct,m, z = 0,8h, fyd = 500/1,15
  const fctm = 0.3 * 25 ** (2 / 3) * 1000;
  const r = cuantiaMinima({ norma: 'EC2-2004', tipo: 'viga', h: 0.5, Ac: 0.15, yg: 0.25, Ix: 3.125e-3, fctm, fyk: 500e3, gammaS: 1.15 });
  cerca(r.inf.A, (1.1 * fctm * 0.0125) / (0.4 * (500e3 / 1.15)), 1e-9);
  assert.equal(r.inf.A, r.sup.A);
  const p = cuantiaMinima({ norma: 'EHE-08', tipo: 'pilar', h: 0.4, Ac: 0.16, yg: 0.2, Ix: 0, fctm, fyk: 500e3, gammaS: 1.15, N: 0 });
  cerca(p.A, 0.004 * 0.16, 1e-12);
  const p2 = cuantiaMinima({ norma: 'EC2-2004', tipo: 'pilar', h: 0.4, Ac: 0.16, yg: 0.2, Ix: 0, fctm, fyk: 500e3, gammaS: 1.15, N: 3000 });
  cerca(p2.A, 0.1 * 3000 / (500e3 / 1.15), 1e-12);
});
