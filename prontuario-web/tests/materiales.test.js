import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propiedadesHormigon, propiedadesAcero, opcionesHormigon, opcionesAcero, materialDeFicha } from '../src/core/materiales.js';

const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test('Hormigón HA-25: Ecm de cada norma (EHE-08 39.6, EC-2 2004 tabla 3.1, EC-2 2023 con kE = 9500)', () => {
  cerca(propiedadesHormigon(25, 'EHE-08', {}).Ec, 27264, 1);
  cerca(propiedadesHormigon(25, 'EC2-2004', {}).Ec, 31476, 1);
  cerca(propiedadesHormigon(25, 'EC2-2023', { kE: 9500 }).Ec, 9500 * Math.cbrt(33), 1);
});

test('El coeficiente del árido reduce Ecm (arenisca 0,7) y αcc rebaja fcd', () => {
  const base = propiedadesHormigon(30, 'EC2-2004', {}).Ec;
  cerca(propiedadesHormigon(30, 'EC2-2004', opcionesHormigon({ fck: 30, arido: 'arenisca' }, 'EC2-2004')).Ec, 0.7 * base, 1);
  cerca(propiedadesHormigon(30, 'EC2-2004', { alfaCC: 0.85 }).fcd, 0.85 * 30 / 1.5, 1e-9);
});

test('Acero B500S: fyd y εud por norma', () => {
  cerca(propiedadesAcero(500, 'EHE-08', {}).fyd, 434.78, 0.01);
  const a04 = propiedadesAcero(500, 'EC2-2004', opcionesAcero({ fyk: 500 }));
  assert.ok(a04.epsUd <= 0.010 + 1e-12);
  const g = propiedadesAcero(500, 'EC2-2004', opcionesAcero({ fyk: 500, epsUdModo: 'euk' }));
  assert.ok(g.epsUd >= a04.epsUd);
});

test('materialDeFicha construye el diagrama en las tres normas', () => {
  for (const n of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const h = materialDeFicha({ nombre: 'H', tipo: 'hormigon', fck: 40 }, n);
    const a = materialDeFicha({ nombre: 'A', tipo: 'acero', fyk: 500 }, n);
    assert.ok(h.comp.length > 3 && a.tracc.length >= 3, n);
  }
});

test('Hormigón tipificado: el nombre HA-xx fija fck aunque la ficha diga otra cosa', () => {
  const m = materialDeFicha({ nombre: 'HA-30', tipo: 'hormigon', fck: 45 }, 'EHE-08');
  cerca(m.fk, 30000, 1e-9);
  cerca(materialDeFicha({ nombre: 'HA-30b', tipo: 'hormigon', fck: 45 }, 'EHE-08').fk, 45000, 1e-9);
});

test('Diagrama EC-2 (Sargin): máximo fcm en εc1 y sin γ ni α; por puntos respeta los datos', () => {
  for (const n of ['EHE-08', 'EC2-2004', 'EC2-2023']) {
    const m = materialDeFicha({ nombre: 'H', tipo: 'hormigon', fck: 30, diag: 'EC2' }, n);
    cerca(Math.max(...m.comp.map((p) => -p[1])), 38000, 1);
    assert.equal(m.gamma, 1);
  }
  const p = materialDeFicha({ nombre: 'H', tipo: 'hormigon', fck: 30, diag: 'puntos', puntos: [[1, 10], [2, 20], [3.5, 20]] }, 'EC2-2004');
  cerca(p.comp.at(-1)[0], -0.0035, 1e-12);
  cerca(p.comp.at(-1)[1], -20000, 1e-9);
  assert.throws(() => materialDeFicha({ nombre: 'H', tipo: 'hormigon', fck: 30, diag: 'puntos', puntos: [[2, 10], [1, 20]] }, 'EC2-2004'));
});

test('Todo proyecto nuevo trae los 6 hormigones tipificados y los 4 aceros tipificados', async () => {
  const { proyectoNuevo } = await import('../src/io/proyecto.js');
  const p = proyectoNuevo();
  assert.deepEqual(p.hormigones.map((m) => m.nombre), ['HA-25', 'HA-30', 'HA-30_EC2', 'HA-35', 'HA-40', 'HA-45', 'HA-50']);
  assert.deepEqual(p.aceros.map((m) => m.nombre), ['B 400 S', 'B 400 SD', 'B 500 S', 'B 500 SD']);
});

test('Sargin con tracción: elástica hasta fctm y luego cae; sin tracción por defecto (ELU)', () => {
  const f = { nombre: 'HA-30_EC2', tipo: 'hormigon', fck: 30, diag: 'EC2' };
  const sin = materialDeFicha(f, 'EC2-2004');
  assert.equal(Math.max(...sin.tracc.map((p) => p[1])), 0);
  const con = materialDeFicha(f, 'EC2-2004', { tracc: true });
  cerca(Math.max(...con.tracc.map((p) => p[1])), 2896, 1);
});
