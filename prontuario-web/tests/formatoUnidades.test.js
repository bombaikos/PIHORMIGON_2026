// Guía § 1: esfuerzos en kN y kN·m sin decimales. Los decimales los fija una sola tabla (MAG en formato.js);
// las vistas no los escriben a mano. Este test falla si una vista pone decimales a una cifra en kN o kN·m.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAG } from '../src/ui/formato.js';

const raiz = new URL('../src/ui/', import.meta.url).pathname;
const ficheros = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? ficheros(join(d, f)) : f.endsWith('.js') ? [join(d, f)] : []));
// Sin excepciones: también las cargas puntuales y reacciones de vigas (José Luis, 19/10). Solo kN/m va con un decimal.
const EXENTOS = ['formato.js'];

test('la tabla de precisiones: esfuerzos sin decimales', () => {
  assert.equal(MAG.N.d, 0);
  assert.equal(MAG.M.d, 0);
});

test('ninguna vista fija decimales en cifras de kN o kN·m', () => {
  const malos = [];
  for (const f of ficheros(raiz)) {
    if (EXENTOS.some((e) => f.endsWith(e))) continue;
    readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/fmt\([^()]*(\([^()]*\))?[^()]*,\s*[1-9]\)[^`'"\n]{0,40}(kN|ESP\}kN)(?!\/m)/.test(l) || /n1\([^()]*,\s*[1-9]\)[^`'"\n]{0,12}\s*kN/.test(l)) malos.push(`${f.replace(raiz, '')}:${i + 1}`);
      if (/eje[XY]: \{.*(kN|MAG\.(M|N)\.ud).*d: [1-9]/.test(l)) malos.push(`${f.replace(raiz, '')}:${i + 1} (eje)`);
    });
  }
  assert.deepEqual(malos, [], 'usa q()/qh() con la magnitud o eje() de formato.js');
});
