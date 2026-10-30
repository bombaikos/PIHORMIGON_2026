# Guía de estilo del prontuario web

Esta guía recoge las decisiones de José Luis (8 de octubre de 2026) y las recomendaciones de diseño que ha aceptado. **Si choca con cualquier otro documento, manda esta guía.**
- Referencia visual y de comportamiento: `analisis/maqueta/maqueta-flexion.html`, también publicada en https://claude.ai/artifact/U5ahnrTcNyugsgFNm638cg
- Fundamentos y fuentes: `analisis/diseno-interfaz-recomendaciones.md`

## 1. Números y unidades
- Unidades: **m, mm, kN y MPa**. Nunca cm.
- **El separador decimal es el punto**, también en español. Al escribir se acepta la coma.
- En los miles se agrupa con espacio fino solo a partir de 5 cifras (12 345). Se usa el signo menos real (−).
- Entre el número y la unidad va un espacio fino que no se corta (U+202F). La unidad se escribe en peso normal y en el color suave.
- **Precisión fija por magnitud**, centralizada en una única tabla del código:

| Magnitud | Unidad | Decimales |
|---|---|---|
| Fuerzas | kN | 0 |
| Momentos | kN·m | 0 |
| Áreas de armadura | mm² | 0 |
| Longitudes y cotas | mm | 0 |
| Tensiones | MPa | 1 |
| Deformaciones | ‰ | 2 |
| Aprovechamiento | — | 2 |

## 2. Notación
- **Notación de EC2 en toda la app**, sea cual sea la norma de cálculo: M<sub>Ed</sub>, M<sub>Rd</sub>, N<sub>Ed</sub>, A<sub>s1</sub>, A<sub>s2</sub>, d, d<sub>1</sub>, d<sub>2</sub>, x, z, F<sub>c</sub>, F<sub>s1</sub>, F<sub>s2</sub>, f<sub>ck</sub>, f<sub>cd</sub>, f<sub>yk</sub>, f<sub>yd</sub>, γ<sub>C</sub>, γ<sub>S</sub>, ε<sub>c</sub>, ε<sub>cu</sub>, ε<sub>s1</sub>, σ<sub>s1</sub>, A<sub>s,min</sub> y A<sub>s1,req</sub>.
- Los subíndices se escriben con subíndices reales, no con guion bajo.
- Los nombres de material siguen a la norma elegida: HA-25 con EHE-98 y C25/30 con EC2.

## 3. Tipografía
- **Solo fuentes del sistema**, empezando la pila por `system-ui` (Segoe UI Variable, SF Pro o Roboto, según el equipo). Nada de fuentes web.
- **Sin monoespaciada** para las cifras: se usa la fuente del texto con `font-variant-numeric: tabular-nums`.
- **Serie tipográfica 10, 12 y 14 px**, más 16 px solo para el menú principal de módulos. Solo el resultado principal (normalmente uno, como mucho dos) va grande, a 28 px; títulos de panel a 14 px en negrita.

## 4. Color
- Neutros azulados, definidos en OKLCH, con tema claro y oscuro.
- **Un solo acento azul**, que es también el color de la **compresión** en dibujos y gráficas.
- **Acero en gris oscuro** (en el tema oscuro, gris claro). La **tracción va en gris rayado**. El hormigón es un gris cálido.
- **El rojo solo para lo que está mal**: "No cumple" y errores. También **el nombre de una norma no vigente** (EHE-08 y EC-2 2023 hoy; la vigente, EC-2 2004 + AN, va en el color normal), en el selector de norma y en el chip de la cabecera. El ámbar se usa para avisos y el verde para "Cumple".
- Hay que dar soporte a `prefers-contrast: more` y a `forced-colors` (temas de contraste de Windows).
- Rejilla de 4 px. Radios de 10 px en paneles, 6 px en campos y 4 px en chips.

## 5. Disposición
- Menú arriba, datos a la izquierda y resultados a la derecha. **No se rotulan "Datos" ni "Resultados"**.
- Arriba de los resultados va una **franja de veredicto fija**: aprovechamiento M<sub>Ed</sub>/M<sub>Rd</sub> con barra y sello Cumple / No cumple. En Dimensionar muestra la armadura necesaria.
- A partir de unos 1240 px los resultados se parten en dos columnas: dibujo a un lado y cifras y traza al otro. En móvil, una sola columna.
- **La densidad compacta es la normal**: la etiqueta va a la izquierda del valor, los campos miden 24 px de alto y no hay líneas vacías bajo ellos. Existe una densidad cómoda opcional.

## 6. Comportamiento de los campos
- **Al entrar en un campo se selecciona su contenido**, también al hacer clic.
- No hay botón Calcular: **se recalcula al cambiar cualquier dato**, con una espera de unos 150 ms.
- Cada cambio, incluido pasar de Comprobar a Dimensionar, **recalcula el modo activo desde cero**. Si un dato es inválido, el último resultado válido queda atenuado y no se abren ventanas modales.
- Los campos numéricos admiten cuentas (`2*150`). ↑ y ↓ varían el valor, con Mayús de diez en diez, e Intro pasa al campo siguiente.
- **Los campos de armado van alineados a la derecha**, como los números (decidido el 11/10).
- **Armadura**: se aceptan `2D25+8D12`, `4ø16`, `4fi16`, `4x16`, el área en mm² (`1030`) y mezclas (`2D20+300`). Bajo el campo se muestra normalizada, por ejemplo "2ø25 + 8ø12 = 1887 mm²".
- Los errores se muestran en línea bajo el campo y dicen qué formato se espera.

## 7. Trazabilidad
- Cada resultado se despliega para ver la fórmula, los valores sustituidos y el artículo de la norma activa (EHE-98 o EN 1992-1-1:2023). **Todas las notas, referencias y ayudas van plegadas por defecto.**

## 8. Dibujos
- Sección, deformaciones y tensiones van en paralelo, **a la misma escala vertical**, con el eje neutro de lado a lado.
- Las barras se dibujan a su diámetro y separación reales. La armadura dada solo como área se dibuja como una franja de área equivalente.
- **Secciones apaisadas** (b > 2h): se dibuja un tramo de ancho 2h con líneas de rotura a los lados. La escala es la misma en horizontal y en vertical, y la cota indica "b = 1000 (tramo dibujado 500)".
- Al pasar el ratón por un elemento se resalta a la vez en el dibujo y en la tabla.

- **Los textos de dibujos y gráficas miden siempre lo mismo en pantalla**: 12 px las cotas y valores y 10 px los rótulos de cada diagrama, aunque el SVG se escale. La escala real se mide al dibujar y al cambiar el tamaño de la ventana (variable CSS `--k`), y la fuente se divide por ella.

## 9. Gráficas
- Mantienen la misma paleta y la misma fuente.
- **Series distinguidas por el trazo, no por el color** (decidido el 14/10; sustituye a la asignación por colores del 11/10): continuo, rayitas, puntos. Los colores de abajo solo valen para el relleno de los diagramas de esfuerzos y para dibujos donde el color ya significa algo. **Rojo, verde y ámbar no se usan como series**, porque significan «No cumple», «Cumple» y aviso.
  | Serie | Claro | Oscuro |
  |---|---|---|
  | M (momento) | azul del acento, `oklch(47% 0.13 252)` | `oklch(74% 0.11 250)` |
  | V (cortante) | verde oliva, `oklch(52% 0.11 125)` | `oklch(76% 0.11 125)` |
  | Giro | verde azulado, `oklch(52% 0.09 195)` | `oklch(76% 0.09 195)` |
  | Flecha | siena, `oklch(50% 0.10 55)` | `oklch(76% 0.10 60)` |
  - Todos pasan 5:1 sobre la hoja y 7:1 sobre la hoja oscura. La serie se identifica además con **su rótulo escrito junto a la curva**, no solo por el color.
  - Los diagramas de esfuerzos (M, V) llevan **área rayada** en su color; giro y flecha, solo línea. Las flechas de las cargas no se rayan. El eje de ordenadas no se dibuja.
  - Se usan siempre las mismas series con el mismo trazo (y, en los diagramas de esfuerzos, el mismo color) en toda la app.
- **Zoom**: con la rueda, con un rectángulo arrastrado y con dos dedos en móvil. El doble clic vuelve a la vista completa.
- **Etiquetas emergentes**: una cruz que sigue al cursor con los valores del punto.
- **Debajo de cada gráfica, un selector Gráfico/Tabla**, como en el Prontuario 3.1 (decidido el 11/10).
- **Copiar como imagen**: con un botón o con Ctrl+C sobre la gráfica, que pasa un PNG al portapapeles a doble resolución y con fondo blanco. Hay además "Guardar PNG o SVG".

## 10. Idiomas y teclado
- **Español e inglés**. Todos los textos van en `src/i18n/es.js` y `src/i18n/en.js`, con una clave por texto. Si falta una clave en inglés, se muestra en español.
- La **paleta Ctrl+K** sirve para cambiar idioma, norma, modo y densidad, ir a un campo, cargar ejemplos y deshacer.
- La paleta tiene también **«Pantalla completa»** (entrar y salir), con la Fullscreen API sobre el documento. Si el navegador o la vista donde está abierta la app la rechaza, se avisa en una línea y se sugiere F11 (pedido el 11 de octubre de 2026).
- Ctrl+Z deshace el último cambio de datos cuando el foco no está en un campo.

## 11. Arquitectura que lo hace sostenible
Hay que construir una vez y reutilizar en todos los módulos estas piezas: el campo numérico, el campo de armadura, el veredicto, la traza, el dibujo de sección, la gráfica, la paleta de comandos, la tabla de precisiones y los diccionarios de idioma. Cada módulo debería ser sobre todo su cálculo más poca interfaz propia.

## 12. Rejillas de datos (decidido el 9 de octubre de 2026)
- **Se hacen a mano**, como componente común sobre `<table>`, sin librerías. Sirve para vértices, caras, armados y combinaciones.
- **La primera fila lleva los títulos** de las columnas, con su unidad (por ejemplo "y (mm)"). **No hay columna de numeración** de filas.
- Aspecto de hoja de cálculo: fila de títulos fija al hacer scroll, cifras alineadas a la derecha con `tabular-nums`, celda activa recuadrada en el azul del acento y rango seleccionado sombreado.
- Teclado como en Excel: flechas, Tab, Intro y F2 para editar. Al escribir se sustituye el contenido de la celda.
- **Decimales**:
  - **En pantalla, siempre el punto.**
  - **Al copiar** (Ctrl+C) se usa el separador decimal del sistema, detectado con `Intl.NumberFormat(navigator.language)`, para que Excel en español reciba números y no texto. El portapapeles lleva el texto separado por tabuladores y además una tabla HTML.
  - **Al pegar** se aceptan punto y coma, y se guarda con punto. La primera fila pegada se toma como títulos y se ignora cuando coincide con los títulos de la rejilla, o cuando en las columnas numéricas trae textos que no se leen como número y la segunda fila sí son números. Las columnas de texto, como el nombre de la cara o un armado "4D16", no cuentan, y si se pega una sola fila siempre son datos. Al descartarla se avisa ("Se ha omitido la fila de títulos") y Ctrl+Z la recupera.
- Al pegar se rellena desde la celda activa y se añaden filas si faltan. Las celdas no válidas se marcan en línea, sin ventanas modales.
- La rejilla va enlazada al dibujo: al pasar por una fila se resalta su vértice o su cara, y al revés.

## 13. Todo en una pantalla de PC (decidido el 9 de octubre de 2026)
El scroll despista: en un PC hay que ver todos los datos y todos los resultados sin desplazarse.
- **Pantalla objetivo: 1536 × 730 px de ventana útil** (un monitor de 1920 × 1080 con Windows al 125 %). Además debe caber en 1366 × 657 (portátil de 1366 × 768). Por debajo de unos 1100 × 600, y en móvil, la página vuelve a una columna con scroll normal.
- **Tres columnas a toda la altura**: datos | dibujo | resultados, con la franja de veredicto arriba de las dos últimas. La página no hace scroll. Si un panel concreto no cabe, solo ese panel se desplaza, nunca la página.
- **Barra superior de una línea** (unos 40 px), con el proyecto, el menú, la norma y Ctrl+K.
- **El dibujo absorbe el espacio sobrante**: se escala a la altura disponible (SVG con viewBox), y así la pantalla queda llena sin huecos ni desbordes. **Siempre justificado arriba** (`preserveAspectRatio="xMinYMin meet"`), igual que las columnas de datos y resultados, con la leyenda encima del dibujo; el espacio que sobre queda debajo.
- **Solo un cartel grande**: el resultado principal en la franja de veredicto. El resto de resultados son filas de etiqueta y valor a 12 y 14 px. No hay tarjetones de cifras.
- **Plegado por defecto**: la traza (fórmula y artículo), las notas de cálculo, los formatos admitidos y el "acerca de". Los avisos son de una línea.
- **Las unidades van en la cabecera de las columnas** de las tablas, no repetidas en cada celda.
- **Pestañas antes que scroll**: si un módulo tiene más resultados de los que caben (por ejemplo, propuesta de armado más comprobaciones de servicio), se reparten en pestañas dentro del panel de resultados.
- **Panel de datos plegable** (por ejemplo con Ctrl+B) para revisar resultados con más espacio para el dibujo.
- **Información secundaria en etiquetas emergentes al pasar el ratón**: por ejemplo, las propiedades del material junto a su nombre o la definición de un símbolo.
- **Comprobación automática**: un test con Playwright abre cada módulo a 1536 × 730 y a 1366 × 657 y falla si la página o algún panel desborda. La maqueta lo cumple en Comprobar y en Dimensionar.

## 14. Jerarquía visual: una forma por nivel (decidido el 10 de octubre de 2026)
Cada nivel de control tiene un aspecto propio, para que no se confundan menú, selectores, datos y pestañas. Referencia: `analisis/maqueta/jerarquia-secciones.html`, también publicada en https://claude.ai/artifact/23o8ga2zXLAsdUHVTuvKfg
1. **Módulo**: texto en la barra de arriba. El activo va en píldora azul (fondo azul suave, texto azul). **Los textos del menú principal van a 16 px** (peso normal; el activo en seminegrita), por encima del resto de la serie, para que se lea como el primer nivel (pedido el 11/10).
2. **Qué objeto (sección)**: una fila fija de desplegables, **uno por tipo** (Rec viga, Rec pilar, En T, Circular, Genérica), cada uno con **el nombre del tipo escrito siempre** (la app es de textos; el icono solo apoya), el número de secciones y un icono pequeño. Son botones con contorno, sin fondo gris. El del tipo activo va en azul y muestra tipo y sección: «Rec viga · V-1». En el móvil se mantiene el texto y la fila pasa a dos líneas. La fila no cambia de forma al elegir.
   - Dentro del desplegable se ven **10 secciones como mucho**; el resto, con scroll dentro del desplegable. A partir de 9 secciones aparece arriba un **buscador** con el foco puesto (Intro elige la primera). Al abrirse, se coloca en la sección activa.
   - **Nueva sección en dos sitios**: al pie de cada desplegable, «+ Nueva Rec viga», etc. (fija, fuera del scroll), y un botón pequeño «+ Nueva» al final de la fila, que crea una del tipo activo y lo dice al pasar el ratón.
3. **Qué vista**: pestañas subrayadas, justo encima de lo que cambian. Un solo estilo de pestaña en toda la app.
4. **Dato editable**: caja gris. **El fondo gris queda solo para los datos que se escriben o eligen.**
5. **Opción excluyente** (una de pocas): botones juntos con contorno, sin fondo gris; la elegida en azul con subrayado.
6. **Ajuste de todo el proyecto** (la norma): chip arriba a la derecha.
7. **Acción**: botón. Solo la principal va en azul relleno (Guardar); las demás con contorno.
8. **Sección activa** (aprobado el 10/10 por la noche): además de marcarse en su desplegable, va en un **tarjetón** bajo los selectores, encabezando la columna de datos. Fondo blanco de hoja y borde gris fuerte, radio de panel, sin azul: el azul queda reservado a botones pulsados y opciones seleccionadas (pedido el 11/10). Dentro: el tipo en pequeño (10 px, mayúsculas, con su icono), **el nombre a 28 px en negrita** y una línea de resumen a 12 px («300 × 500 mm · HA-25 · 4D20 / 2D12»). Se actualiza al cambiar de sección o de dato. Es la excepción aprobada a la regla del cartel grande único (§ 13) en la pantalla de Secciones.

**Campos alineados**: dentro de un panel de datos, **todas las cajas de valor tienen el mismo ancho** (130 px en PC) y quedan alineadas en una columna a la derecha, con la etiqueta a la izquierda. Selectores de material y campos de armadura también. No se ajusta el ancho al contenido.
9. **Aclaraciones plegadas** (fórmula, valores sustituidos, artículo de la norma; decidido el 11/10 a propuesta de José Luis): fondo **chocolate claro**, que no es el gris de los datos, ni el azul de lo seleccionado, ni el ámbar de los avisos. Tokens: `--nota` y `--nota-borde`.
   - Claro: `--nota: oklch(94.8% 0.014 78)` y `--nota-borde: oklch(85.5% 0.024 75)`.
   - Oscuro: `--nota: oklch(25.5% 0.014 72)` y `--nota-borde: oklch(36% 0.022 70)`.
   - Borde de 1 px, radio de campo (6 px) y texto en `--tinta-2`; la expresión en `--tinta`; el artículo de la norma en `--tinta-3`.
   - Los avisos siguen en ámbar, con borde marcado y el icono ⚠, para que no se confundan con una aclaración (el chocolate se queda en croma bajo, muy cerca de neutro).
   - **No lleva título aparte** («Cómo se calcula…»): **la propia fila del resultado se despliega** al pulsarla, con un ▸ delante de la etiqueta. Al abrirse, la fila y su explicación toman juntas el fondo chocolate con borde fino; cerrada, la fila es como las demás (pedido el 11/10).
   - Va en el panel de resultados, plegada por defecto. Con la extensión del texto, las filas de resultados pueden ser más anchas para que la expresión ocupe menos líneas.

10. **Elección de sección en los módulos de cálculo** (Flexión simple, Flexión compuesta recta, Cortante y todos los que vengan; decidido el 29/10 por Pepiño, opción B). **Regla común**:
   - Un **único desplegable «Sección»**, lo **primero de los datos** (justo bajo el título del módulo), con las secciones válidas agrupadas por tipo. No hay fila de tipos encima de las columnas; los cinco desplegables por tipo son solo del módulo Secciones.
   - El **nombre de la sección va grande en la pastilla de resultados**, a la izquierda del aprovechamiento (rótulo pequeño «Sección» y nombre a 24 px + `--mas`, en negrita).
   - **Debajo del desplegable no se pone ningún texto** (ni resumen de dimensiones y materiales, ni «La sección viene de Secciones»).
   - En código: `grupoSeccion()` en datos y `rotulaSeccion()` al final de `resultados()` (`vistas/secciones.js`); lo comprueba `tests/seccionActiva.test.js`.

## 15. Gráficos de vigas y leyes de esfuerzos (módulo Análisis; decidido el 11 de octubre de 2026)
Convenciones fijadas con José Luis al hacer el módulo de vigas de un vano. Valen para cualquier módulo parecido (pórticos, ménsulas, losas en una dirección, ejes de carga). Código de referencia: `src/ui/vistas/vigas.js` y `src/ui/vigaLeyes.js`; gráfica común en `src/ui/grafica.js`; exportación en `src/ui/exportarSvg.js`.
- **Todo a la vista, sin pestañas**: las tres tablas de cargas (puntuales, distribuidas, momentos) siempre visibles, con rejilla común y unidades en la cabecera; un solo campo EI (kN·m²) que se rellena al elegir una sección y se puede editar (el selector pasa a «Personalizada»). Las cargas se editan en una sola columna y los **cuatro gráficos se ven a la vez**, a todo el ancho disponible de la pantalla, con la **misma escala horizontal**.
- **La viga se dibuja**: esquema arriba, con apoyos (triángulo, empotramiento con rayas), cargas y reacciones. Además, **la viga se repite esquemática en cada ley**, como referencia de dónde está cada valor.
- **Cargas**: flechas en el **sentido físico** (positivo hacia abajo). **Sin color**: en gris con trama (distribuida con rayitas verticales y contorno fino; puntual con línea gris más gruesa; momento aplicado como arco gris), para que no se parezcan a ningún diagrama de resultados. Una carga distribuida que cambia de signo se dibuja con su signo (la parte positiva sobre la viga y la negativa bajo ella) y se corta donde pasa por cero. Los valores van en los extremos, fuera de la figura.
- **Reacciones**: escritas como números dentro del gráfico, junto a cada apoyo.
- **Etiquetas de carga a alturas escalonadas**: la de la distribuida, la de P y la del momento no pueden coincidir en altura. Las flechas de P son más altas que la distribuida para que su etiqueta suba.
- **Signos**: **M, giro y flecha, positivos hacia abajo** (M sobre la parte traccionada, flecha en el sentido físico) y **V positivo hacia arriba**.
- **Rayado solo en los diagramas de esfuerzos** (M y V), con su color de serie (§ 9). Giro y flecha, solo línea. Las flechas de las cargas no se rayan.
- **Sin eje de ordenadas.** Los **valores notables van escritos** en el gráfico (máximos, valores en apoyos, cruces por cero), y al pasar el cursor se leen los cuatro a la vez.
- **Cada ley lleva escrita su magnitud y unidad arriba a la izquierda, en su color de serie.** Los valores notables (máximos, extremos, saltos) se escriben con un contorno del color de fondo (`paint-order`) y **se omiten los que quedarían a menos de 38×14 px de otro ya puesto**, para que no se pisen. Dos guías discontinuas marcan los apoyos en todas las leyes.
- **Cursor**: una línea vertical y la lectura de las cuatro leyes en esa abscisa, junto al título de cada una.
- **Cada ley con su propia escala vertical**; la viga es en cada una la línea de referencia (el cero), con sus apoyos pequeños. Se dibuja a tamaño real en píxeles (ResizeObserver), así los textos miden siempre 12 px.
- **Eje x común** abajo, una sola vez, con **marcas y números cada metro** (paso de 1 m si L ≥ 3 m; décimas si es más corta; 2, 5 o 10 m si es muy larga; mínimo 24 px entre marcas). **Sin rejilla vertical** (parecería una reja): en cada ley las marcas van solo sobre la propia viga, como los trazos de un cartabón.
- **Unidades y decimales**: giros en **mrad** y flechas en **mm**, ambos con **un decimal**, también en las etiquetas, en la lectura del cursor y en la tabla; **esfuerzos (M en kN·m, V y N en kN) sin decimales**, como fija § 1 (decidido por José Luis el 12/10); **fuerzas externas puntuales y reacciones (kN, kN·m) también sin decimales** (José Luis, 19/10: regla general sin excepciones; solo kN/m lleva un decimal). Los decimales salen de la tabla `MAG` de `formato.js` y de `eje()` en las gráficas; un test (`tests/formatoUnidades.test.js`) impide escribirlos a mano.
- **Selector Gráfico/Tabla** debajo, con las columnas x (m), M (kN·m), V (kN), θ (mrad) y δ (mm). Los botones **Copiar, PNG y SVG** van sobre el gráfico (en modo tabla, Copiar copia la tabla y PNG y SVG se ocultan). La exportación es común: `exportarSvg.js`.
- **Zoom y cursor** como en cualquier gráfica (§ 9); la opción `invertirY` de la gráfica común sirve para ejes con el positivo hacia abajo.
- **Textos de 12 px reales** en pantalla, como en los demás dibujos (§ 8).

**Series genéricas sin marcadores (aprobado por José Luis 12/10)**: sin marcadores nunca (José Luis). Cada serie se distingue en blanco y negro por el trazo: 1 continua 2,4 px; 2 discontinua larga `9 5`; 3 punteada `2 4` con extremos redondos; 4 raya-punto `12 4 2 4`; 5 discontinua corta `5 3`; todas 2 px salvo la 1. Colores en este orden: azul, verde oliva, verde azulado, siena, gris pizarra. Etiqueta directa al final de cada curva en lugar de leyenda. Excepción: el círculo del cursor al leer valores se mantiene (es un indicador, no un marcador de serie; José Luis 12/10). Maqueta: `maqueta/series-bn.html`.

**Posible choque con § 9 que queda por decidir**: la gráfica común (`grafica.js`) sigue usando como series 1 y 2 el azul y el ámbar, y como serie 5 un coral. Según § 9, el ámbar y el rojo no deben servir de serie. Propuesta: que las series genéricas tomen el mismo orden que las leyes (azul, verde oliva, verde azulado, siena).

## 16. Selectores con muchas opciones y ayuda gráfica (decidido el 11 de octubre de 2026, a raíz del módulo Fuego)
- **NORMA GENERAL (José Luis, 12/10): ningún selector va apelmazado en una fila con su etiqueta.** Todo selector, sea de opciones excluyentes o desplegable (hormigón, tipo de hormigón, vida útil, norma, consistencia, tamaño de árido, tipo de elemento...), lleva **la etiqueta en una línea y el control debajo, a todo el ancho del panel**. Excepción única: las cajas de valor numérico (etiqueta a la izquierda, caja de 130 px a la derecha, § 14). Dos selectores cortos pueden compartir línea solo si cada uno conserva su etiqueta encima.
Implementación: helper `apilado()` y clase `.campo-apilado` en `src/ui/campos.js`; `filaCampos()` para dos o tres campos cortos en una fila (ejemplo: `vistas/durabilidadEHE08.js`). Las tablas de resultados copiables llevan botón «Copiar tabla».
- **Selector de opciones excluyentes, en dos líneas**: la etiqueta arriba, en una línea propia, y debajo las opciones **a todo el ancho del panel**, con celdas iguales (`display: grid; grid-auto-flow: column; grid-auto-columns: 1fr`). Así 4 a 6 opciones caben sin apelmazarse. El estilo es el de § 14.5 (contorno, la elegida en azul con subrayado). Dos selectores cortos (de 2 a 4 opciones cada uno) pueden compartir línea en dos columnas.
- **Etiquetas de opción cortas** («Losa», no «Losa maciza»); el nombre largo va en el título emergente. Si aun así una opción no cabe, el selector pasa a desplegable (§ 14.2), no se recorta el texto.
- **Los controles que no aplican se ocultan**, no se desactivan (por ejemplo, método y n/ω solo para pilares).
- **Dibujo acotado de ayuda**: cuando el dato es una geometría (ancho, canto, recubrimiento, distancia al eje) el módulo lleva **un dibujo esquemático de la sección con cotas**, además de los textos, que cambia con el elemento elegido. Reglas: textos de 12 px reales (cotas en seminegrita, 10 px los rótulos pequeños), líneas de cota finas con marcas en los extremos, barras con su diámetro relativo, cerco fino, y **las caras expuestas (o cargadas) marcadas con trazo de puntos en el color de tinta, no en rojo** (el rojo es solo para «No cumple» y errores, § 4) y su leyenda debajo. La leyenda explica cada letra en una línea (por ejemplo «a: distancia al eje de la armadura»). Alineado arriba y a la altura disponible, como los demás dibujos (§ 13).
- Referencia: `analisis/maqueta/fuego-ayuda-grafica.html` (https://claude.ai/artifact/ACAeHTpvbSuJgtz2QmuMVW).
