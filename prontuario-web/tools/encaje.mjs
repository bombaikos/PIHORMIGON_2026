// Comprobación de la guía § 13: cada módulo cabe en una pantalla de PC sin scroll.
// Abre dist/prontuario.html a 1536 × 730 y a 1366 × 657 y falla si la página o algún panel desborda.
// Uso: node tools/encaje.mjs   (necesita playwright; PW_CHROMIUM puede indicar el ejecutable)
import { chromium } from 'playwright';

const url = new URL('../dist/prontuario.html', import.meta.url).href;
const TAMANOS = [[1536, 730], [1366, 657]];
// Módulo y, si hace falta, acciones para llegar a cada pantalla
// Cortante con cada norma: el chip de norma abre una lista (1 EC-2 2004 + AN, que es la del proyecto, 2 EHE-08, 3 EC-2 2023)
const norma = (k) => async (p) => { await p.click('.chip-ajuste'); await p.click(`#menu-norma button:nth-child(${k})`); };
// Elegir sección: un solo desplegable en datos, con las secciones agrupadas por tipo (guía § 14.10)
const SEC = (tipo) => async (p) => { const v = await p.locator(`#sel-seccion optgroup[label="${tipo}"] option`).first().getAttribute('value'); await p.selectOption('#sel-seccion', v); };
const PANTALLAS = [
  ['Proyecto', 'proyecto', []],
  ['Materiales · hormigón', 'materiales', []],
  ['Materiales · Sargin', 'materiales', [async (p) => { await p.click('.selsec .desp:nth-child(1) > button'); await p.click('.menu-sec button[role=option]:nth-child(3)'); }]],
  ['Materiales · puntos', 'materiales', [(p) => p.selectOption('#m-diag', 'puntos')]],
  ['Materiales · acero', 'materiales', [async (p) => { await p.click('.selsec .desp:nth-child(2) > button'); await p.click('.menu-sec button[role=option]'); }]],
  ['Propiedades reológicas', 'reologicas', []],
  ['Reológicas · historia', 'reologicas', []],
  ['Reológicas · coef. fluencia', 'reologicas', [(p) => p.click('text=Coeficiente de fluencia')]],
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
  ['Flexión compuesta recta', 'flexRecta', []],
  ['Flexión compuesta recta · dimensionar', 'flexRecta', [(p) => p.click('.datos .seg button:nth-child(2)')]],
  ['Flexión compuesta recta · diagrama', 'flexRecta', [(p) => p.click('.datos .seg button:nth-child(3)')]],
  ['Flexión compuesta recta · circular', 'flexRecta', [SEC('Circular')]],
  ['Cortante · EC-2 comprobar', 'cortante', []],
  ['Cortante · EC-2 dimensionar', 'cortante', [(p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · EC-2 sin armadura', 'cortante', [(p) => p.click('.datos .seg >> nth=2 >> button >> nth=1')]],
  ['Cortante · EC-2 T momento negativo', 'cortante', [SEC('En T'), (p) => p.click('.datos .seg >> nth=1 >> button >> nth=1')]],
  ['Cortante · EC-2 pilar', 'cortante', [SEC('Rec pilar')]],
  ['Cortante · EC-2 circular dimensionar', 'cortante', [SEC('Circular'), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · EHE-08 comprobar', 'cortante', [norma(2)]],
  ['Punzonamiento · EC-2 comprobar', 'punzonamiento', []],
  ['Punzonamiento · EC-2 borde', 'punzonamiento', [(p) => p.click('button:text-is("Borde")')]],
  ['Punzonamiento · EC-2 circular esquina', 'punzonamiento', [(p) => p.click('button:text-is("Circular")'), (p) => p.click('button:text-is("Esquina")')]],
  ['Punzonamiento · EC-2 dimensionar', 'punzonamiento', [(p) => p.click('button:text-is("Dimensionar")')]],
  ['Punzonamiento · EC-2 sin armadura', 'punzonamiento', [(p) => p.uncheck('#p-arm')]],
  ['Punzonamiento · EC-2 retícula', 'punzonamiento', [(p) => p.selectOption('#p-esq', 'ret')]],
  ['Punzonamiento · EHE-08', 'punzonamiento', [norma(2)]],
  ['Punzonamiento · EHE-08 dimensionar', 'punzonamiento', [norma(2), (p) => p.click('button:text-is("Dimensionar")')]],
  ['Punzonamiento · EC-2 2023', 'punzonamiento', [norma(3)]],
  ['Punzonamiento · EC-2 2023 dimensionar', 'punzonamiento', [norma(3), (p) => p.click('button:text-is("Dimensionar")')]],
  ['Cortante · EHE-08 dimensionar', 'cortante', [norma(2), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · EHE-08 sin armadura', 'cortante', [norma(2), (p) => p.click('.datos .seg >> nth=2 >> button >> nth=1')]],
  ['Cortante · EHE-08 T momento negativo', 'cortante', [norma(2), SEC('En T'), (p) => p.click('.datos .seg >> nth=1 >> button >> nth=1')]],
  ['Cortante · EHE-08 pilar', 'cortante', [norma(2), SEC('Rec pilar')]],
  ['Cortante · EHE-08 circular dimensionar', 'cortante', [norma(2), SEC('Circular'), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · EC-2 2023 comprobar', 'cortante', [norma(3)]],
  ['Cortante · EC-2 2023 dimensionar', 'cortante', [norma(3), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Cortante · EC-2 2023 sin armadura', 'cortante', [norma(3), (p) => p.click('.datos .seg >> nth=2 >> button >> nth=1')]],
  ['Cortante · EC-2 2023 T momento negativo', 'cortante', [norma(3), SEC('En T'), (p) => p.click('.datos .seg >> nth=1 >> button >> nth=1')]],
  ['Cortante · EC-2 2023 pilar', 'cortante', [norma(3), SEC('Rec pilar')]],
  ['Cortante · EC-2 2023 circular dimensionar', 'cortante', [norma(3), SEC('Circular'), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Rasante · EC-2 comprobar', 'rasante', []],
  ['Rasante · EC-2 dimensionar', 'rasante', [(p) => p.click('button:text-is("Dimensionar")')]],
  ['Rasante · EC-2 sin armadura', 'rasante', [(p) => p.click('#r-arm')]],
  ['Rasante · EHE-08', 'rasante', [norma(2)]],
  ['Rasante · EHE-08 dimensionar', 'rasante', [norma(2), (p) => p.click('button:text-is("Dimensionar")')]],
  ['Rasante · EC-2 2023', 'rasante', [norma(3)]],
  ['Rasante · EC-2 2023 sin anclaje', 'rasante', [norma(3), (p) => p.click('button:has-text("Parcial")')]],
  ['Rasante · EC-2 2023 dimensionar', 'rasante', [norma(3), (p) => p.click('button:text-is("Dimensionar")')]],
  ['Flexión · comprobar', 'flexion', []],
  ['Flexión · dimensionar', 'flexion', [(p) => p.click('.datos .seg >> nth=0 >> button >> nth=1')]],
  ['Flexión · T momento negativo', 'flexion', [(p) => p.selectOption('#sel-seccion', { label: 'ejemplo_3' }), (p) => p.selectOption('#f-signo', '-1')]],
  ['Flexión · diagrama', 'flexion', [(p) => p.click('.datos .seg >> nth=0 >> button >> nth=2')]],
  ['Flexión · diagrama T momento negativo', 'flexion', [(p) => p.selectOption('#sel-seccion', { label: 'ejemplo_3' }), (p) => p.selectOption('#f-signo', '-1'), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=2')]],
  ['Flexión · T dimensionar, propuesta', 'flexion', [(p) => p.selectOption('#sel-seccion', { label: 'ejemplo_3' }), (p) => p.click('.datos .seg >> nth=0 >> button >> nth=1'), (p) => p.click('.pestanas button:nth-child(2)')]],
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
