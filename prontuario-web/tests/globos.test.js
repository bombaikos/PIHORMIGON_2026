// Regla de diseño: el globo de las (i) es flotante (src/ui/globo.js) y no un ::after dentro del panel,
// porque un panel con scroll lo cortaba en su borde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('el CSS no dibuja el globo de .info-i dentro del panel', () => {
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.info-i[^{]*::after/);
  assert.match(css, /\.globo-i\s*\{[^}]*position:\s*fixed/);
});
