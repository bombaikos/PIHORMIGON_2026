# Arquitectura del Prontuario web

Código en `prontuario-web/`. SPA de una página, JS vanilla con módulos ES, sin servidor.

## Flujo

```
index.html → src/ui/app.js → vistas (src/ui/vistas/*.js) → core/ (cálculo) + norma/ (lógica por norma)
```

- `index.html`: marco (barra superior, tres columnas datos | dibujo | resultados).
- `src/ui/app.js`: estado global, menú (`MENU`), registro de vistas (`VISTAS`), paleta Ctrl+K, idioma y tema. Una vista que no está en `VISTAS` sale atenuada en el menú; al registrarla se activa sola. Cada vista expone `datos(ctx, el)`, y opcionalmente `sincronizar` / `reiniciar`.
- **Build:** `node tools/build.mjs` (esbuild) empaqueta `src/ui/app.js`, `css/app.css` y el cuerpo de `index.html` en `dist/prontuario.html` (con doble clic) y `dist/artifact.html` (fragmento). Inyecta la fecha de emisión de la portada BETA.

## Carpetas

| Ruta | Contenido |
|---|---|
| `src/core/` | Motor de cálculo puro, sin DOM: `seccion.js` (motor seccional), `geometria.js` (contorno + huecos + grupos de armadura), `propiedades.js` (bruta/homogeneizada/fisurada), `armado.js` (notación `5D20+2D16`), `flexion.js`, `interaccion.js` (N-M), `momentoCurvatura.js`, `materiales.js` (diagramas σ-ε), `reologia.js`, `vigas.js`, `cuantiaMinima.js`. |
| `src/norma/` | Lógica normativa, una carpeta/archivo por módulo y norma: `normas.js` (parámetros comunes), `cortante/{ehe08,ec2-2004,ec2-2023}.js`, `rasante/`, `punzonamiento/`, `anclaje.js`, `fuego.js`, `materiales/`, y `durabilidad` por norma (`ehe08/`, `ec2-2004/`, `ec2-2023/`; `ehe98/` solo para migrar proyectos antiguos). Cada módulo con las tres normas expone un `index.js` que elige según la norma del proyecto. |
| `src/ui/vistas/` | Una vista por pantalla/módulo: proyecto, materiales, reologicas, secciones (también Diagramas M-κ), durabilidad (+EC2, EHE08), vigas, flexion, flexRecta, cortante, punzonamiento, anclaje, rasante, fuego. |
| `src/ui/` | Componentes compartidos: `campos.js` (entradas), `rejilla.js` (tablas tipo Excel), `grafica.js` (gráfica x-y común), `formato.js` (tabla única de decimales/unidades), `paleta.js` (Ctrl+K), `i18n.js`, `designacion.js`, `exportarSvg.js`, dibujos por módulo (`dibujoSeccion.js`, `dibujoCortante.js`…), `vigaLeyes.js`. |
| `src/i18n/` | Diccionarios `es`/`en`; los módulos grandes tienen los suyos (`cortante.es.js`, `anclaje.en.js`…), que `ui/i18n.js` suma. |
| `src/io/` | `proyecto.js` (JSON + guardado en el navegador), `importEHE.js` (proyectos del Prontuario 3.1), `importDXF.js` (secciones desde DXF), `ejemploGenerica.js`. |
| `css/app.css` | Estilos (claro y oscuro) con tokens. |
| `tests/` | `node:test`; `fixtures/` (proyecto de ejemplo), `ref31/` (casos del 3.1). |
| `tools/` | `build.mjs`, `encaje.mjs` (test de pantalla), `genFixtures.mjs`, `casosCortante.mjs`. |
| `dist/` | Salida del build; se versiona. |
| `analisis/` (raíz) | Guías, decisiones por módulo, planes. `analisis/normativa/` es local (no se sube). |

## Menú (constante `MENU` de `app.js`)

Proyecto | Materiales {Crear y editar, Propiedades reológicas} | Secciones {Crear y editar, Durabilidad, Diagramas} | Análisis {Vigas de un vano} | ELU {Flexión simple, Flexión compuesta recta, (esviada) | Cortante, (Torsión), Punzonamiento, Anclaje y solapo, Rasante | (Inestabilidad de soportes)} | Fuego | ELS (pendiente) | Bielas y tirantes (pendiente) | Ejecución y control (pendiente) | Ayuda (pendiente).

## Cómo añadir un módulo

1. Lógica en `src/norma/<modulo>/` (si depende de la norma) o `src/core/`, con test en `tests/`.
2. Vista en `src/ui/vistas/<modulo>.js` siguiendo la plantilla común (sección primero con `grupoSeccion()`/`rotulaSeccion()`, cápsula de modo, tres columnas).
3. Textos en `src/i18n/<modulo>.es.js` y `.en.js`; súmalos en `ui/i18n.js`.
4. Registrar en `VISTAS` y `MENU` de `app.js`, y en `tools/encaje.mjs`.
5. Decisiones en `analisis/<modulo>-decisiones.md`; actualizar `docs/HANDOFF.md`.
