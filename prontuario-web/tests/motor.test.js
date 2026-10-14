import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hormigon, acero, sigma, propiedadesHormigon, resistenciaCalculo as resistencia } from '../src/core/materiales.js';
import { estadoUltimo } from '../src/core/seccion.js';
import { dimensionar, comprobar, momentoLimite, cuantiasMinMax, seccionRectangular, propuestaArmado, wkEC2 } from '../src/core/flexion.js';
import { importarProyecto, leerMaterial } from '../src/io/importEHE.js';
import { datosRectangular } from '../src/io/proyecto.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const cerca = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg ?? ''} ${a} ≉ ${b} (tol ${rel * 100}%)`);

const HA25 = hormigon({ fck: 25 });
const B500 = acero({ fyk: 500 });
const viga = { b: 0.3, h: 0.5, rinf: 0.05, rsup: 0.05, Ainf: 10e-4, Asup: 0, hormigon: HA25, acero: B500 };

function leerCarpeta(dir, base = dir) {
  const out = {};
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, leerCarpeta(p, base));
    else out[p.slice(base.length + 1)] = new TextDecoder('windows-1252').decode(readFileSync(p));
  }
  return out;
}

test('el diagrama del hormigón coincide con el .mat que escribe el Prontuario', () => {
  const txt = new TextDecoder('windows-1252').decode(readFileSync(join(aqui, 'fixtures/PRUEBA/Materiales/HA-25.mat')));
  const m = leerMaterial(txt, 'HA-25');
  assert.equal(m.tipo, 'hormigon');
  assert.equal(m.comp.length, HA25.comp.length);
  m.comp.forEach(([e, s], i) => {
    assert.ok(Math.abs(e - HA25.comp[i][0]) < 1e-8);
    assert.ok(Math.abs(s - HA25.comp[i][1]) < 0.06);
  });
  assert.equal(Math.round(m.E), Math.round(HA25.E));
  assert.equal(sigma(HA25, -0.003), -0.85 * 25000 / 1.5);
  assert.equal(sigma(HA25, 0.001), 0);
});

test('momento último a flexión simple = solución cerrada parábola-rectángulo', () => {
  // Bloque parábola-rectángulo: C = (17/21)·b·x·fcd, brazo d − (99/238)·x
  const fcd = 0.85 * 25000 / 1.5;
  const T = 10e-4 * 500000 / 1.15;
  const x = T / ((17 / 21) * 0.3 * fcd);
  const Mu = T * (0.45 - (99 / 238) * x);
  const r = comprobar(viga);
  cerca(r.x, x, 0.002, 'x');
  cerca(r.Mu, Mu, 0.001, 'Mu');
  assert.ok(Math.abs(r.epsSup + 0.0035) < 1e-9, 'pivote B: εc = −3,5 ‰');
});

test('momento límite: x_lim = εcu/(εcu+εy)·d', () => {
  const lim = momentoLimite(viga);
  const ey = 500 / 1.15 / 200000;
  cerca(lim.xlim, (0.0035 / (0.0035 + ey)) * 0.45, 1e-9);
  const fcd = 0.85 * 25000 / 1.5;
  const Mlim = (17 / 21) * 0.3 * lim.xlim * fcd * (0.45 - (99 / 238) * lim.xlim);
  cerca(lim.Mlim, Mlim, 0.002, 'Mlim');
});

test('compresión centrada: Nu = fcd·Ac + σs(2 ‰)·As (pivote C)', () => {
  const sec = seccionRectangular({ ...viga, Ainf: 10e-4, Asup: 10e-4 });
  const fcd = 0.85 * 25000 / 1.5;
  const Nu = fcd * 0.15 + 2 * 10e-4 * 400000; // 2 ‰ · 200 000 MPa = 400 MPa < fyd
  const r = estadoUltimo(sec, -Nu * 0.9999);
  assert.ok(r.converge);
  const fuera = estadoUltimo(sec, -Nu * 1.001);
  assert.equal(fuera.converge, false);
});

test('dimensionar y comprobar son inversos', () => {
  for (const Md of [150, 250, 300]) {
    const r = dimensionar(viga, Md);
    assert.equal(r.caso, 'simple');
    const c = comprobar({ ...viga, Ainf: r.Ainf, Asup: r.Asup });
    assert.ok(Math.abs(c.Mu - Md) < 0.05, `Md=${Md}: Mu=${c.Mu}`);
  }
  const d = dimensionar(viga, 400);
  assert.equal(d.caso, 'doble');
  assert.ok(d.Asup > 0);
  assert.ok(Math.abs(comprobar({ ...viga, Ainf: d.Ainf, Asup: d.Asup }).Mu - 400) < 0.05);
  assert.equal(dimensionar(viga, 20).caso, 'minima');
  assert.equal(dimensionar(viga, 2000).caso, 'escuadria');
});

test('cuantías mínimas de la EHE (tabla 42.3.5 interpolada)', () => {
  const c = cuantiasMinMax(viga, 'viga');
  cerca(c.romin, 0.0028, 1e-9);
  cerca(c.Amin, 0.0028 * 0.15, 1e-9);
  cerca(c.Amax, 0.15 * (25000 / 1.5) / (500000 / 1.15), 1e-9);
});

test('la propuesta de armado cubre el área pedida', () => {
  const p = propuestaArmado(viga, 12e-4, 0, 200);
  for (const o of p.inferior.filter((o) => o.n)) assert.ok(o.A >= 12 - 1e-9);
});

test('importa un proyecto .EHE con sus secciones y materiales', () => {
  const { proyecto, avisos } = importarProyecto(leerCarpeta(join(aqui, 'fixtures/PRUEBA')));
  assert.equal(proyecto.nombre, 'PRUEBA');
  assert.deepEqual(proyecto.hormigones.map((h) => h.nombre), ['HA-25', 'HA-30']);
  assert.deepEqual(proyecto.aceros.map((h) => h.nombre), ['B500S', 'B400S']);
  const v = proyecto.secciones.find((s) => s.nombre === 'V30x50');
  assert.equal(v.forma, 'rectangular');
  assert.deepEqual(v.geo, { b: 0.3, h: 0.5 });
  assert.deepEqual(v.armado.map((a) => [a.cara, a.texto, a.d]), [['sup', '200', 0.05], ['inf', '1000', 0.05]]);
  assert.equal(v.hormigon, 'HA-25');
  assert.equal(v.durabilidad.ambiente, 'IIa');
  const p = proyecto.secciones.find((s) => s.nombre === 'P40x40');
  assert.equal(p.forma, 'rectangular');
  assert.deepEqual(p.armado.filter((a) => a.tipo === 'capa').map((a) => [a.cara, a.texto]), [['sup', '4D16'], ['inf', '4D16']]);
  assert.equal(p.armado.filter((a) => a.tipo === 'puntual').flatMap((a) => a.barras).length, 4);
  const t = proyecto.secciones.find((s) => s.nombre === 'T60');
  assert.equal(t.forma, 'T');
  assert.deepEqual(t.geo, { b: 0.6, h: 0.6, bw: 0.25, hf: 0.12 });
  assert.deepEqual(t.armado.map((a) => [a.cara, a.texto]), [['sup', '200'], ['inf', '1200']]);
  // La importación pasa a la norma por defecto; para validar contra el 3.1 se usa la heredada EHE-98.
  proyecto.norma = 'EHE-98';
  const d = datosRectangular(proyecto, { ...v, armado: v.armado.filter((a) => a.cara === 'inf') });
  cerca(comprobar(d).Mu, comprobar(viga).Mu, 1e-4);
});

test('EN 1992-1-1:2023: fcd = ηcc·ktc·fck/γC con ktc = 0,85 por defecto (5.3, 5.4, 5.1.6)', () => {
  const h50 = hormigon({ fck: 50, norma: 'EC2-2023' });
  cerca(h50.alfa, Math.cbrt(40 / 50) * 0.85, 1e-12);
  assert.equal(hormigon({ fck: 30, norma: 'EC2-2023' }).alfa, 0.85);
  assert.equal(hormigon({ fck: 30, norma: 'EC2-2023', ktc: 1 }).alfa, 1);
  // Con ktc = 0,85 y fck ≤ 40 coincide con el fcd de la EHE-98.
  cerca(resistencia(hormigon({ fck: 25, norma: 'EC2-2023' })), resistencia(HA25), 1e-12);
  // Hasta C100/115 y fctm = 1,1·fck^(1/3) por encima de C50/60 (tabla 5.1).
  assert.doesNotThrow(() => hormigon({ fck: 100, norma: 'EC2-2023' }));
  cerca(propiedadesHormigon(70, 'EC2-2023').fctm, 1.1 * Math.cbrt(70), 1e-12);
  cerca(propiedadesHormigon(30, 'EC2-2023', { kE: 11000 }).Ec, 11000 * Math.cbrt(38), 1e-12);
});

test('EN 1992-1-1:2023: εud = εuk/γS según la clase de ductilidad (5.2.4)', () => {
  for (const [c, euk] of [['A', 0.025], ['B', 0.05], ['C', 0.075]]) {
    const a = acero({ fyk: 500, norma: 'EC2-2023', ductilidad: c });
    cerca(a.tracc[2][0], euk / 1.15, 1e-12);
    assert.equal(a.tracc[2][1], a.tracc[1][1]);
  }
  const inc = acero({ fyk: 500, norma: 'EC2-2023', ductilidad: 'B', rama: 'inclinada' });
  assert.ok(inc.tracc[2][1] > inc.tracc[1][1] && inc.tracc[2][1] < 1.08 * 500000 / 1.15);
  // La EHE-98 no cambia: rama horizontal hasta 10 ‰.
  assert.equal(B500.tracc[2][0], 0.010);
});

test('EN 1992-1-1:2023: armadura mínima con MR,min(fyk) ≥ Mcr (12.2, fórmula 12.1)', () => {
  const d = { ...viga, hormigon: hormigon({ fck: 25, norma: 'EC2-2023' }), acero: acero({ fyk: 500, norma: 'EC2-2023' }) };
  const c = cuantiasMinMax(d, 'viga');
  const Mcr = propiedadesHormigon(25, 'EC2-2023').fctm * 1000 * 0.3 * 0.5 ** 2 / 6;
  cerca(c.Mcr, Mcr, 1e-12);
  const aK = acero({ fyk: 500, norma: 'EC2-2023', gammaS: 1 });
  const MR = estadoUltimo(seccionRectangular({ ...d, acero: aK }, c.Amin, 0), 0).M;
  cerca(MR, Mcr, 1e-3, 'MR,min');
  // A mano: As ≈ Mcr/(fyk·z) con z ≈ 0,98·d (bloque comprimido muy pequeño)
  cerca(c.Amin, Mcr / (500000 * 0.98 * 0.45), 0.01);
  const p = cuantiasMinMax(d, 'pilar', { Nd: 2000 });
  cerca(p.Amin, Math.max(0.1 * 2000 / (500000 / 1.15), 0.002 * 0.15), 1e-12);
});

test('EN 1992-1-1:2023: wk según 9.2.3 en un caso de referencia', () => {
  const d = { ...viga, hormigon: hormigon({ fck: 25, norma: 'EC2-2023' }), acero: acero({ fyk: 500, norma: 'EC2-2023' }) };
  const w = wkEC2(d, 15.7e-4, 0.020, 1, 100);
  // A mano: n·As = 0,02355; x = (−0,02355 + √(0,02355² + 2·0,3·0,02355·0,45))/0,3 = 0,1986 m
  // σs = 100/(15,7e-4·(0,45 − 0,1986/3)) = 165,9 MPa; hc,eff = min(0,15; 0,20; 0,175; 0,30; 0,25)
  cerca(w.x, 0.1986, 0.001);
  cerca(w.sigmaS / 1000, 165.9, 0.002);
  cerca(w.hcef, 0.15, 1e-9);
  assert.ok(w.wk > 0.05 && w.wk < 0.3, `wk = ${w.wk}`);
});
