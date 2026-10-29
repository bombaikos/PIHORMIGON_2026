// Empaqueta la app en un único HTML (dist/prontuario.html) que funciona con doble clic,
// sin servidor. Uso: node tools/build.mjs  (necesita esbuild: npm i -D esbuild)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const d = new Date();
const fechaEmision = [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map(n => String(n).padStart(2, '0')).join('.');
const r = await build({ entryPoints: ['src/ui/app.js'], bundle: true, format: 'iife', write: false, minify: false, target: 'es2020', define: { __FECHA_EMISION__: JSON.stringify(fechaEmision) } });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = readFileSync('css/app.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const cuerpo = html.slice(html.indexOf('<!--CUERPO-->') + 13, html.indexOf('<!--/CUERPO-->'));
mkdirSync('dist', { recursive: true });
const fragmento = `<title>Prontuario Informático del Hormigón 2026 BETA a</title>\n<style>\n${css}</style>\n${cuerpo}\n<script>\n${js}</script>\n`;
writeFileSync('dist/prontuario.html', `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${fragmento}</body>\n</html>\n`);
writeFileSync('dist/artifact.html', fragmento);
console.log('dist/prontuario.html', (fragmento.length / 1024).toFixed(0), 'KB');
