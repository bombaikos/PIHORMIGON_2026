import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarViga } from '../src/core/vigas.js';

const cerca = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const L = 6, EI = 20000, q = 12, P = 50;
const udl = [{ tipo: 'distribuida', a: 0, b: L, q1: q, q2: q }];

test('biapoyada con carga uniforme', () => {
  const r = analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: udl });
  cerca(r.reacciones.izq.R, q * L / 2); cerca(r.reacciones.der.R, q * L / 2);
  cerca(r.maximos.Mpos.valor, q * L * L / 8);
  cerca(r.maximos.flecha.valor, 5 * q * L ** 4 / (384 * EI));
  cerca(Math.abs(r.maximos.giro.valor), q * L ** 3 / (24 * EI));
  cerca(Math.abs(r.maximos.V.valor), q * L / 2);
});

test('biapoyada con carga puntual centrada', () => {
  const r = analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: [{ tipo: 'puntual', a: L / 2, P }] });
  cerca(r.maximos.Mpos.valor, P * L / 4);
  cerca(r.maximos.flecha.valor, P * L ** 3 / (48 * EI));
  cerca(r.reacciones.der.R, P / 2);
});

test('empotrada-empotrada con carga uniforme', () => {
  const r = analizarViga({ L, EI, izq: 'empotramiento', der: 'empotramiento', cargas: udl });
  cerca(r.reacciones.izq.M, -q * L * L / 12);
  cerca(r.reacciones.der.M, -q * L * L / 12);
  cerca(r.maximos.Mpos.valor, q * L * L / 24);
  cerca(r.maximos.flecha.valor, q * L ** 4 / (384 * EI));
});

test('empotrada-apoyada con carga uniforme', () => {
  const r = analizarViga({ L, EI, izq: 'empotramiento', der: 'apoyo', cargas: udl });
  cerca(r.reacciones.der.R, 3 * q * L / 8);
  cerca(r.reacciones.izq.R, 5 * q * L / 8);
  cerca(r.reacciones.izq.M, -q * L * L / 8);
  const r2 = analizarViga({ L, EI, izq: 'apoyo', der: 'empotramiento', cargas: udl });
  cerca(r2.reacciones.izq.R, 3 * q * L / 8);
  cerca(r2.reacciones.der.M, -q * L * L / 8);
});

test('ménsula con carga en el extremo y con carga uniforme', () => {
  const r = analizarViga({ L, EI, izq: 'empotramiento', der: 'libre', cargas: [{ tipo: 'puntual', a: L, P }] });
  cerca(r.maximos.flecha.valor, P * L ** 3 / (3 * EI));
  cerca(r.maximos.giro.valor, P * L * L / (2 * EI));
  cerca(r.reacciones.izq.M, -P * L);
  const u = analizarViga({ L, EI, izq: 'empotramiento', der: 'libre', cargas: udl });
  cerca(u.maximos.flecha.valor, q * L ** 4 / (8 * EI));
  const v = analizarViga({ L, EI, izq: 'libre', der: 'empotramiento', cargas: udl });
  cerca(v.maximos.flecha.valor, q * L ** 4 / (8 * EI));
  cerca(v.reacciones.der.M, -q * L * L / 2);
});

test('momento aplicado en el apoyo de una biapoyada', () => {
  const C = 30;
  const r = analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: [{ tipo: 'momento', a: L / 2, C }] });
  cerca(r.reacciones.izq.R, -C / L);
  cerca(r.reacciones.der.R, C / L);
});

test('carga trapecial equivale a su resultante', () => {
  const r = analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: [{ tipo: 'distribuida', a: 0, b: L, q1: 0, q2: 2 * q }] });
  cerca(r.reacciones.izq.R, q * L / 3); cerca(r.reacciones.der.R, 2 * q * L / 3);
});

test('inestable y datos erróneos', () => {
  assert.throws(() => analizarViga({ L, EI, izq: 'libre', der: 'libre', cargas: [] }));
  assert.throws(() => analizarViga({ L, EI, izq: 'apoyo', der: 'libre', cargas: [] }));
  assert.throws(() => analizarViga({ L: 0, EI, izq: 'apoyo', der: 'apoyo', cargas: [] }));
  assert.throws(() => analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: [{ tipo: 'puntual', a: L + 1, P }] }));
});

test('la tabla recoge los dos valores del cortante en una carga puntual', () => {
  const r = analizarViga({ L, EI, izq: 'apoyo', der: 'apoyo', cargas: [{ tipo: 'puntual', a: L / 2, P }] });
  const medio = r.tabla.filter((f) => Math.abs(f.x - L / 2) < 1e-6);
  assert.equal(medio.length, 2);
  cerca(medio[0].V, P / 2); cerca(medio[1].V, -P / 2);
  cerca(medio[0].M, P * L / 4); cerca(medio[0].flecha, medio[1].flecha, 1e-6);
});
