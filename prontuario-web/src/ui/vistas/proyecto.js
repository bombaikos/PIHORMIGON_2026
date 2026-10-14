// Pantalla de Proyecto: datos de obra, norma, importación del Prontuario 3.1 y archivo .json.

import { importarProyecto } from '../../io/importEHE.js';
import { proyectoNuevo, validarProyecto, aJSON, sepCapas } from '../../io/proyecto.js';
import { NORMAS } from '../../norma/normas.js';
import { t, tx } from '../i18n.js';
import { h, poner, campoNum, campoTexto, grupo, boton, aviso, tabla } from '../campos.js';

/** Guarda el JSON preguntando dónde cuando el navegador lo permite; si no, lo descarga. */
async function descargar(nombre, texto) {
  if (window.showSaveFilePicker) {
    try {
      const f = await window.showSaveFilePicker({ suggestedName: nombre, types: [{ description: 'Proyecto Prontuario (.json)', accept: { 'application/json': ['.json'] } }] });
      const w = await f.createWritable();
      await w.write(texto);
      await w.close();
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return; // cancelado: no se descarga nada
      // Sin permiso (visores incrustados): se cae a la descarga normal
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = h('a', { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* algunos visores bloquean las descargas: queda copiar el JSON */ }
}

async function leerArchivos(ctx, lista) {
  const archivos = {};
  for (const f of lista) {
    if (!/\.(ehe|sec|mat)$/i.test(f.name)) continue;
    archivos[f.webkitRelativePath || f.name] = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
  }
  try {
    const { proyecto, avisos } = importarProyecto(archivos);
    ctx.ponerProyecto(proyecto, avisos);
  } catch (e) {
    ctx.estado.avisosImport = [t('pro.noImporta', tx(e))];
    ctx.pintar();
  }
}

async function abrirJSON(ctx, e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    ctx.ponerProyecto(validarProyecto(JSON.parse(await f.text())));
  } catch (err) {
    ctx.estado.avisosImport = [t('pro.noAbre', f.name, tx(err))];
    ctx.pintar();
  }
}

export function datos(ctx, form) {
  const p = ctx.p;
  const archivo = (id, texto, attrs, onchange) => [
    h('label', { class: 'boton secundario', for: id }, texto),
    h('input', { id, type: 'file', hidden: true, ...attrs, onchange }),
  ];
  poner(form,
    h('div', { class: 'cab' }, h('h1', {}, t('m.proyecto')), h('p', {}, t('pro.subtitulo'))),
    grupo(t('pro.datos'),
      campoTexto({ id: 'p-nombre', etq: t('nombre'), valor: p.nombre, onCambio: (v) => { p.nombre = v; ctx.cambio(); } }),
      campoTexto({ id: 'p-obra', etq: t('pro.obra'), valor: p.datosObra, onCambio: (v) => { p.datosObra = v; ctx.cambio(); } })),
    grupo(t('pro.ajustes'),
      campoNum({ id: 'p-sep', etq: t('pro.sepCapas'), ref: t('pro.sepCapasRef'), valor: sepCapas(p), mag: 'long', paso: 5, min: 0.02, max: 0.2, onCambio: (v) => { p.ajustes = { ...(p.ajustes ?? {}), sepCapas: v }; ctx.cambio(); } })),
    grupo(t('pro.importar'),
      h('p', { class: 'nota' }, t('pro.importarCarpeta')),
      h('div', { class: 'fila-botones' },
        ...archivo('imp-carpeta', t('pro.elegirCarpeta'), { webkitdirectory: true, multiple: true }, (e) => leerArchivos(ctx, e.target.files)),
        ...archivo('imp-archivos', t('pro.elegirArchivos'), { multiple: true, accept: '.ehe,.EHE,.sec,.SEC,.mat,.MAT' }, (e) => leerArchivos(ctx, e.target.files)))),
    grupo(t('pro.archivo'),
      h('div', { class: 'fila-botones' },
        boton(t('pro.guardar'), () => descargar(`${p.nombre || 'proyecto'}.json`, aJSON(p)), ''),
        ...archivo('abrir-json', t('pro.abrir'), { accept: '.json,application/json' }, (e) => abrirJSON(ctx, e)),
        boton(t('pro.nuevo'), () => ctx.ponerProyecto(proyectoNuevo(t('pro.nuevoNombre'))), 'discreto'))),
  );
}

export function resultados(ctx, res) {
  const p = ctx.p;
  const tarjeta = h('article', { class: 'panel tarjeta' },
    h('h2', {}, p.nombre || t('sinNombre')),
    p.datosObra ? h('p', { class: 'sub' }, p.datosObra) : null,
    p.importadoDe ? h('p', { class: 'nota' }, t('pro.importadoDe', p.importadoDe.archivo, p.importadoDe.fecha)) : null,
    tabla([
      [t('norma'), NORMAS[p.norma]?.nombre ?? p.norma],
      [t('mat.hormigones'), p.hormigones.map((m) => m.nombre).join(', ') || '—'],
      [t('mat.aceros'), p.aceros.map((m) => m.nombre).join(', ') || '—'],
      [t('m.secciones'), p.secciones.map((s) => `${s.nombre} (${t(`forma.${s.forma}`)})`).join(', ') || '—'],
    ]),
    p.normaMigrada ? aviso(t('pro.normaMigrada')) : null,
    p.norma === 'EC2-2023' ? aviso(t('pro.avisoEC2')) : null,
    ctx.estado.avisosImport.length ? h('div', {}, h('h3', {}, t('pro.avisosImport')), h('ul', { class: 'nota' }, ...ctx.estado.avisosImport.map((a) => h('li', {}, a)))) : null,
    h('details', { class: 'json' }, h('summary', {}, t('pro.verJSON')),
      boton(t('copiar'), async (e) => {
        try { await navigator.clipboard.writeText(aJSON(p)); e.target.textContent = t('copiado'); } catch { e.target.textContent = t('copiaManual'); }
      }, 'discreto'),
      h('pre', {}, aJSON(p))));
  res.append(tarjeta);
}

export function comandos(ctx) {
  return [{ k: 'p.guardarJSON', b: 'guardar save json proyecto project', f: () => descargar(`${ctx.p.nombre || 'proyecto'}.json`, aJSON(ctx.p)) }];
}
