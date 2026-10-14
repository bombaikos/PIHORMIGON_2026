# Prontuario informático del hormigón (web) · prueba 0.1

Primera prueba de la migración del Prontuario 3.1 (Delphi) a una web de una sola página,
sin servidor y con módulos ES. Incluye proyecto, materiales, sección rectangular y flexión simple
(el antiguo módulo TN1).

## Cómo probarla

**Opción rápida (sin instalar nada):** abre `dist/prontuario.html` con doble clic. Es la app entera en
un solo archivo y funciona sin conexión (sin internet usa las fuentes del sistema).

**Opción de desarrollo (módulos ES sueltos):** los navegadores no cargan módulos desde `file://`,
así que hace falta un servidor local en esta carpeta:

```
python -m http.server 8000
```

y abrir http://localhost:8000.

**Importar un proyecto antiguo:** pestaña *Proyecto* → *Elegir carpeta…* y selecciona la carpeta del
proyecto (la que tiene el `.EHE` y las carpetas `Secciones` y `Materiales`). En `tests/fixtures/PRUEBA`
hay un proyecto de ejemplo escrito con el mismo formato que el Prontuario 3.1.

**Tests del motor:** `node --test tests/*.test.js` (Node 18 o superior).

**Regenerar `dist/prontuario.html`:** `npm i -D esbuild` y después `node tools/build.mjs`.

## Estructura

```
index.html            Marco de la SPA (barra de proyecto, datos a la izquierda, resultados a la derecha)
css/app.css           Estilos (claro y oscuro)
src/norma/normas.js   Parámetros de EHE-98 y EN 1992-1-1:2023 (intercambiables)
src/core/             Motor de cálculo puro, sin DOM
  materiales.js       Diagramas σ-ε poligonales, como los .mat originales
  seccion.js          Motor seccional (equivale a calcomun.pas: curvu, calcula_Ne, calcula_My)
  flexion.js          Flexión simple en sección rectangular (comun_TN.pas, varios.pas)
  momentoCurvatura.js Diagrama M-κ con axil constante (pestaña Diagramas M-κ de Secciones)
src/io/
  importEHE.js        Lectura de .EHE, .sec y .mat (pih_lee.pas)
  proyecto.js         Proyecto en JSON y guardado en el navegador
src/ui/               Interfaz: app.js (vistas) y dibujo.js (SVG)
  grafica.js          Gráfica x-y común (zoom, cruz, copiar imagen, guardar PNG/SVG)
tests/                Tests con node:test y proyecto de ejemplo
tools/                build.mjs (empaquetado) y genFixtures.mjs (proyecto de ejemplo)
```

Unidades internas del motor: kN y m (como el original). La interfaz trabaja en m, mm, mm², kN, kN·m y MPa (ver Convenios).

## Diferencias con el Prontuario 3.1

- Los datos se guardan en un único `.json` que además conserva los cálculos hechos. El proyecto
  también se guarda solo en el navegador.
- El motor integra exactamente el diagrama poligonal en vez de usar la integración de Marín sobre
  polígonos; para secciones rectangulares es equivalente.
- La armadura de las rectangulares "por áreas" se trata como una capa puntual; el original la
  modelaba como un rectángulo muy fino. La diferencia es despreciable.
- El pivote C se coloca a 3h/7 de la fibra más comprimida también con momento negativo; el original
  lo dejaba siempre a 3h/7 de la cara superior.
- Con la opción EN 1992-1-1:2023 (valores recomendados CEN, sin Anejo Nacional) la app usa
  fcd = ηcc·ktc·fck/γC con ktc = 0,85 por defecto, kE editable, hormigones hasta C100/115, acero
  por clase de ductilidad (εud = εuk/γS), armadura mínima según 12.2 y wk según 9.2.3. La
  revisión artículo por artículo está en `analisis/ec2-2023-revision.md` del proyecto. Con EHE-98
  todo sigue igual que en el Delphi.

## Convenios de interfaz (decididos por José Luis, 8 de octubre de 2026)

Obligatorios para todos los módulos. **La guía completa y vinculante es `analisis/guia-estilo-prontuario.md`, que manda sobre este resumen** (incluida su §11, componentes comunes reutilizables antes de añadir módulos). Origen: este hilo, la maqueta `analisis/maqueta/maqueta-flexion.html` y `analisis/diseno-interfaz-recomendaciones.md` (§4 y §7).

**Unidades y precisión** (una única tabla de formato en el código, no decimales sueltos por llamada)
- m y mm, kN y MPa. Nunca cm.
- Escuadrías, recubrimientos, diámetros, cotas del dibujo y wk en mm, sin decimales (wk con 2). Internamente el motor sigue en m.
- Fuerzas en kN y momentos en kN·m, sin decimales.
- Áreas de armadura en mm², sin decimales.
- Tensiones en MPa con un decimal.
- Deformaciones en ‰ con dos decimales.
- Separador decimal: el punto, también en español; sin separador de miles. Al escribir se acepta la coma.
- Unidad separada por espacio fino que no corta (U+202F), en peso normal y color suave. Signo menos real (−).

**Notación**
- La de EC2 en toda la app, con subíndices reales, sea cual sea la norma: MEd, MRd, NEd, As1, As2, Fc, Fs1, fck, fcd, fyd, γC, εcu…

**Tipografía**
- Solo fuentes del sistema (system-ui / Segoe UI), también para las cifras: sin monospace, con tabular-nums. Nada descargado de internet.

**Color**
- Neutros con un solo acento azul para acciones y selección.
- Compresión en azul; acero en gris oscuro; tracción en gris rayado.
- Rojo solo para avisos malos (no cumple, errores); verde/rojo solo en la franja de veredicto.
- Debe leerse impreso en blanco y negro (rayados, no solo color).

**Campos de entrada**
- Al entrar en un campo se selecciona su contenido.
- Densidad compacta de verdad: etiqueta a la izquierda del valor, sin líneas vacías.
- Armadura: acepta área en mm², `2D25+8D12` (D = diámetro), `ø`, `fi`, `x` y mezclas (`2D20+300`); se muestra normalizada como `2ø25 + 8ø12`.

**Cálculo**
- Sin botón Calcular: cada cambio, incluido pasar de Comprobar a Dimensionar, recalcula el modo activo desde cero.

**Dibujos y gráficas**
- Sección, deformaciones y tensiones a la misma escala vertical. Secciones apaisadas: tramo de 2·h con líneas de rotura y barras a su separación real, sin falsear la escala.
- Gráficas con la misma paleta y fuente; zoom (rueda, rectángulo, pellizco; doble clic restablece); cruz con etiqueta emergente de valores; copiar como imagen (botón o Ctrl+C → PNG al portapapeles) y guardar PNG/SVG.

**Idioma y teclado**
- Español e inglés, alternables desde la paleta Ctrl+K.
- Diccionarios en archivos propios: `src/i18n/es.js` y `src/i18n/en.js`, nunca textos sueltos en la interfaz.

## Todo en una pantalla (guía § 13)

En un PC cada módulo se ve entero sin scroll de página: datos | dibujo | resultados a toda la altura,
con el veredicto arriba. `npm run test:pantalla` abre cada pantalla a 1536 × 730 y a 1366 × 657 y
falla si la página o algún panel desborda (necesita Playwright; `PW_CHROMIUM` puede indicar el
ejecutable de Chromium). Ctrl+B pliega el panel de datos. La densidad compacta es la normal.
