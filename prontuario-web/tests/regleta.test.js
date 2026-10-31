import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Regla de la guía (§9): todo deslizador sale de regleta(); no se crean <input type=range> sueltos.
test('los deslizadores usan regleta() y no hay rangos sueltos', () => {
  const dir = new URL('../src/ui/', import.meta.url);
  const sueltos = [];
  const ver = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
    const u = new URL(f.name + (f.isDirectory() ? '/' : ''), d);
    if (f.isDirectory()) ver(u);
    else if (f.name.endsWith('.js') && f.name !== 'campos.js' && /type:\s*'range'/.test(readFileSync(u, 'utf8'))) sueltos.push(f.name);
  } };
  ver(dir);
  assert.deepEqual(sueltos, []);
});
test('la regleta mide el 80 % y no hay CSS de gauges antiguos', () => {
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.regleta\s*\{[^}]*width:\s*80%/);
  assert.doesNotMatch(css, /\.gauge|\.desliza-sec|\.desl-md/);
});
