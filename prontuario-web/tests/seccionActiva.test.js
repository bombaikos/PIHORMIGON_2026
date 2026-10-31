// Regla de diseño (guía § 14): los módulos de cálculo que eligen sección la eligen igual:
// desplegable único primero en datos y nombre grande en la pastilla de resultados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const m of ['flexion', 'flexRecta', 'cortante', 'estadoTensional']) {
  test(`${m}: elige la sección con grupoSeccion y rotula el nombre en la pastilla`, () => {
    const src = readFileSync(new URL(`../src/ui/vistas/${m}.js`, import.meta.url), 'utf8');
    assert.match(src, /grupoSeccion\(/);
    assert.match(src, /rotulaSeccion\(/);
    assert.doesNotMatch(src, /export function cabeza/, 'sin fila de tipos encima: la sección se elige en datos');
  });
}
