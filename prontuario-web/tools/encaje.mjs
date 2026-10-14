// Comprobación de la guía § 13: cada módulo cabe en una pantalla de PC sin scroll.
// Abre dist/prontuario.html a 1536 × 730 y a 1366 × 657 y falla si la página o algún panel desborda.
// Uso: node tools/encaje.mjs   (necesita playwright; PW_CHROMIUM puede indicar el ejecutable)
import { chromium } from 'playwright';

const url = new URL('../dist/prontuario.html', import.meta.url).href;
const TAMANOS = [[1536, 730], [1366, 657]];
// Módulo y, si hace falta, acciones para llegar a cada pantalla
// Con la norma por defecto (EC-2 2004) Cortante aún no está migrado: la primera acción pasa el proyecto a EHE-08
const aEHE = (p) => p.click('.datos .boton');
const PANTALLAS = [
  ['Proyecto', 'proyecto', []],
  ['Materiales · hormigón', 'materiales', []],
  ['Materiales · Sargin', 'materiales', [async (p) => { await p.click('.selsec .desp:nth-child(1) > button'); await p.click('.menu-sec button[role=option]:nth-child(3)'); }]],
  ['Materiales · puntos', 'materiales', [(p) => p.selectOption('#m-diag', 'puntos')]],
  ['Materiales · acero', 'materiales', [async (p) => { await p.click('.selsec .desp:nth-child(2) > button'); await p.click('.menu-sec button[role=option]'); }]],
  ['Propiedades reológicas', 'reologicas', []],
  ['Secciones · rec viga', 'secciones', []],
  ['Durabilidad', 'durabilidad', []],
  ['Secciones · diagramas M-κ', 'diagramas', []],
  ['Secciones · pilar', 'secciones', [async (p) => { await p.click('.selsec .desp:nth-child(2) > button'); await p.click('.menu-sec .alta'); }]],
  ['Secciones · en T', 'secciones', [async (p) => { await p.click('.selsec .desp:nth-child(3) > button'); await p.click('.menu-sec .alta'); }]],
  ['Secciones · genérica', 'secciones', [async (p) => { await p.click('.selsec .desp:nth-child(5) > button'); await p.click('.menu-sec .alta'); }]],
  ['Secciones · circular', 'secciones', [async (p) => { await p.click('.selsec .desp:nth-child(4) > button'); await p.click('.menu-sec .alta'); }]],
  ['Fuego · viga', 'fuego', []],
  ['Fuego · pilar CE', 'fuego', [(p) => p.click('.datos .seg button:nth-child(1)')]],
  ['Anclaje y solapo', 'anclaje', []],
  ['Anclaje y solapo · compresión', 'anclaje', [(p) => p.click('.datos .seg button:nth-child(2)')]],
  ['Análisis · vigas de un vano', 'vigas1vano', []],
  ['Análisis · apoyo empotrado', 'vigas1vano', [(p) => p.selectOption('#v-izq', { index: 1 })]],
  ['Cortante · comprobar', 'cortante', [aEHE]],
  ['Cortante · dimensionar', 'cortante', [aEHE, (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · sin armadura', 'cortante', [aEHE, (p) => p.click('.datos .seg >> nth=2 >> button >> nth=1')]],
  ['Cortante · T momento negativo', 'cortante', [aEHE, async (p) => { await p.click('.selsec .desp:nth-child(2) > button'); await p.click('.menu-sec button[role=option]'); }, (p) => p.click('.datos .seg >> nth=1 >> button >> nth=1')]],
  ['Cortante · pilar', 'cortante', [aEHE, async (p) => { await p.click('.selsec .desp:nth-child(3) > button'); await p.click('.menu-sec button[role=option]'); }]],
  ['Cortante · circular dimensionar', 'cortante', [aEHE, async (p) => { await p.click('.selsec .desp:nth-child(4) > button'); await p.click('.menu-sec button[role=option]'); }, (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · norma sin migrar', 'cortante', []],
  ['Flexión · comprobar', 'flexion', []],
  ['Flexión · dimensionar', 'flexion', [(p) => p.click('.datos .seg >> nth=1 >> button >> nth=1')]],
  ['Flexión · T momento negativo', 'flexion', [(p) => p.selectOption('#f-sec', { label: 'ejemplo_3' }), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Flexión · gráfico', 'flexion', [(p) => p.click('.pestanas button:nth-child(2)')]],
  ['Flexión · T dimensionar, propuesta', 'flexion', [(p) => p.selectOption('#f-sec', { label: 'ejemplo_3' }), (p) => p.click('.datos .seg >> nth=1 >> button >> nth=1'), (p) => p.click('.pestanas button:nth-child(3)')]],
];

const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let fallos = 0;
for (const [W, H] of TAMANOS) {
  for (const [nombre, vista, pasos] of PANTALLAS) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.addInitScript((v) => { localStorage.clear(); localStorage.setItem('prontuario-web:vista', v); }, vista);
    await p.goto(url);
    for (const paso of pasos) await paso(p);
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const de = document.scrollingElement;
      const mal = [];
      if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) mal.push(`página ${de.scrollWidth}×${de.scrollHeight}`);
      for (const el of document.querySelectorAll('.panel')) {
        if (el.scrollHeight > el.clientHeight + 1) mal.push(`${el.id || el.className.replace(/\s+/g, '.')} +${el.scrollHeight - el.clientHeight}px`);
      }
      return mal;
    });
    console.log(`${r.length ? '✗' : '✓'} ${W}×${H} ${nombre}${r.length ? ': ' + r.join(', ') : ''}`);
    if (r.length) fallos++;
    await p.close();
  }
}
await b.close();
process.exit(fallos ? 1 : 0);
