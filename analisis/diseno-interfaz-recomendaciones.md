# Diseño de la interfaz del prontuario web: tendencias y recomendaciones

> Las decisiones finales están en `analisis/guia-estilo-prontuario.md`, que manda sobre este documento.

Fecha: 8 de octubre de 2026. Punto de partida: la prueba 0.1 de `prontuario-web` (menú arriba, datos a la izquierda, resultados a la derecha, `css/app.css` con tema claro y oscuro y solo fuentes del sistema).
Condiciones ya decididas por José Luis: unidades m, mm, kN y MPa (nunca cm); solo fuentes del sistema; funciona en cualquier navegador y sin conexión.

---

## 1. Resumen en una frase

Lo que hoy da prestigio a una app técnica no es el efecto visual, sino la **calma, la densidad bien ordenada, el cálculo en vivo y la trazabilidad**: ver al instante cómo se ha llegado a cada número y de qué artículo de la norma sale. El "diseñazo" del prontuario debería parecer **una buena hoja de cálculo de ingeniero dibujada con el rigor de un plano**, y la parte expresiva debería quedarse para dos sitios: el dibujo de la sección y el veredicto (cumple o no cumple).

---

## 2. Qué dicen ahora las grandes guías

### Apple: Liquid Glass (iOS/macOS 26, 2025) y su corrección (iOS/macOS 27, 2026)
- En 2025 Apple presentó **Liquid Glass**: barras y controles translúcidos que flotan sobre el contenido, con esquinas concéntricas (el radio interior es el exterior menos el margen) y una jerarquía en la que el contenido manda y los controles "se apartan".
- Tuvo mucha contestación por la legibilidad. Primero Apple hizo más opacos los menús y diálogos en las betas, después añadió la opción *Tintado* en iOS 26.1, y en iOS 27 (2026) la sustituyó por un **regulador continuo de transparencia** (Ajustes › Apariencia › Liquid Glass). Además se mantienen *Reducir transparencia* y *Aumentar contraste*.
- **Lección para nosotros:** de Apple conviene tomar la jerarquía (el contenido delante y el marco discreto), las esquinas concéntricas y el respeto a las preferencias del sistema. No conviene copiar el vidrio: en una herramienta de cálculo resta legibilidad, va mal en PC antiguos y la propia Apple ha tenido que dar marcha atrás.

### Google: Material 3 Expressive (2025)
- Se basa en 46 estudios con más de 18 000 participantes. Con **color, forma, tamaño y contenedores** usados a propósito, los elementos clave se localizan hasta 4 veces más rápido, y los mayores de 45 años rinden igual que los jóvenes.
- La propia investigación avisa de los límites: en contextos utilitarios (pone el ejemplo de la banca) no conviene el mismo nivel de expresividad. Romper convenciones o quitar etiquetas de texto empeoró la usabilidad. Y la conclusión literal es *"No amount of expressive design will beat basic functionality"*.
- **Lección:** hay que usar la expresividad para dirigir la mirada (el veredicto, la acción principal) y no para decorar. Los contenedores con contraste agrupan mejor que las líneas finas.

### Microsoft: Fluent 2
- Usa una **rejilla de 4 px**, una escala tipográfica corta (Caption 12, Body 14, Subtitle 20, Title 28, Large Title 40) y Segoe UI Variable en Windows 11. La elevación se marca con pocas sombras suaves, las rampas de color de marca van de 10 a 160 y hay una densidad compacta para apps de productividad.
- Microsoft cuida mucho los **temas de contraste de Windows** (`forced-colors`), que mucha gente usa y casi ninguna web prueba.
- **Lección:** aplicar la rejilla de 4 px, la escala tipográfica corta y el soporte de `forced-colors`. Es lo más directamente aplicable porque la mayoría de usuarios del prontuario estará en Windows.

### Otras referencias útiles
- **IBM Carbon** separa la tipografía *productiva* (compacta, para interfaces de trabajo) de la *expresiva* (para presentar), y ofrece tablas en varias densidades. Es el mejor modelo para tablas de resultados.
- **Linear**, la referencia actual de "app sobria y bonita", explica su rediseño así: menos ruido en el marco, todo alineado en una rejilla y un acento de color usado con moderación. Además genera todo el tema a partir de tres valores (base, acento, contraste) en el espacio de color **LCH**, perceptualmente uniforme.

---

## 3. Apps técnicas con prestigio y qué tomar de cada una

| App | Por qué se admira | Qué copiar en el prontuario |
|---|---|---|
| **Desmos** | Respuesta instantánea: cambias un número y la gráfica se mueve | Recalcular en vivo al teclear, sin botón "Calcular" |
| **ClearCalcs / Tekla Tedds** | Hojas de cálculo con referencias a la norma y salida lista para la memoria | El "por qué" de cada resultado (fórmula y artículo) y una impresión impecable |
| **Mathcad / Calcpad** | Las cuentas se leen como si estuvieran hechas a mano, con unidades | Desplegar el cálculo paso a paso con símbolos reales (f<sub>cd</sub>, γ<sub>c</sub>, ε<sub>cu</sub>) |
| **Dlubal RFEM 6 / CYPE** | Navegador de datos, tablas densas y gráficos sincronizados | Al pasar el ratón por una fila de la tabla se ilumina la barra o la fibra en el dibujo, y al revés |
| **Figma** | Panel de propiedades compacto y muy rápido de editar con teclado | Campos con la unidad dentro, flechas para variar el valor (Mayús ×10) y arrastrar sobre la etiqueta |
| **Linear / VS Code** | Teclado primero y paleta de comandos | Paleta con Ctrl+K: "ir a Flexión simple", "cambiar a EC2", "exportar PDF" |
| **Bloomberg / tablas financieras** | Densidad extrema pero legible | Números tabulares alineados por la coma y decimales coherentes por magnitud |

---

## 4. Recomendaciones concretas para el prontuario

Están ordenadas por impacto. Las cinco primeras son las que cambian la percepción de calidad.

### 4.1 Cálculo en vivo y estado siempre visible
- Recalcular al cambiar cualquier dato (con una espera de unos 150 ms) y quitar el botón "Calcular".
- Si un dato es inválido, el campo se marca en línea y los resultados se muestran atenuados con el último cálculo válido, sin ventanas modales.

### 4.2 Una franja de veredicto arriba de los resultados
- Colocar arriba del panel de resultados una franja fija con el **aprovechamiento**, por ejemplo M<sub>Ed</sub> / M<sub>Rd</sub> = 0,87, con una barra de 0 a 1 y la palabra **Cumple** o **No cumple**.
- Ese es el único sitio con color semántico fuerte, que es donde Material 3 Expressive demuestra que acelera la lectura. El resto de la pantalla debería quedarse neutro.

### 4.3 Trazabilidad: "¿de dónde sale esto?"
- Cada cifra de resultado debería poder desplegarse (`<details>`) para mostrar la fórmula con símbolos reales, los valores sustituidos y el artículo (EHE-98 art. 42.x o EN 1992-1-1:2023 §8.1.x). Como la app ya conmuta entre las dos normas, la referencia también debería cambiar.
- Esto es lo que distingue a ClearCalcs y a Tedds de una calculadora cualquiera, y a un ingeniero le da confianza.

### 4.4 El dibujo como protagonista, con convenciones de plano
- Dibujar la sección, el diagrama de deformaciones y el de tensiones **en paralelo y a la misma escala vertical**, como en los libros clásicos de hormigón armado.
- Usar cotas en mm con flechas y líneas de referencia, el eje neutro discontinuo y las barras a su diámetro real.
- Sincronizar el dibujo con la tabla al pasar el ratón por encima.
- Debe verse bien también impreso en blanco y negro, distinguiendo zonas con rayado y no solo con color.

### 4.5 Tipografía de números
- **Abandonar la monoespaciada para las cifras.** Segoe UI, SF Pro y Roboto tienen dígitos tabulares (`font-variant-numeric: tabular-nums`), que alinean igual y se ven mucho más finos. La monoespaciada da aspecto de terminal y debería quedarse solo para el JSON.
- Separar la unidad con un espacio fino que no se corta (U+202F) y escribirla en peso normal y en el color suave, por ejemplo **312,4** kN·m.
- Usar el signo menos real (−, U+2212), el ‰ para deformaciones y subíndices de verdad.
- Fijar una precisión por magnitud y aplicarla en toda la app. La tabla definitiva, decidida por José Luis, está en `analisis/guia-estilo-prontuario.md`: kN y kN·m sin decimales, mm² sin decimales, MPa con 1 y ‰ con 2.
- Escala tipográfica corta y fija (estilo Fluent): 12 · 14 · 16 · 20 · 28 px. Basta `system-ui` como primera fuente: da Segoe UI Variable en Windows 11, SF Pro en Mac y Roboto en Android.

### 4.6 Campos de entrada de ingeniero
- Poner la unidad dentro del campo, a la derecha, y alinear el valor a la derecha.
- Las flechas ↑↓ deberían variar el valor según la magnitud, con Mayús multiplicando por 10. Enter debería pasar al siguiente campo.
- Aceptar expresiones simples: `2*150`, `4ø16+2ø12`, que se convierte en A<sub>s</sub> y muestra debajo "= 1030 mm²".
- La armadura debería introducirse como la piensa el ingeniero (nº de barras y ø) y no solo como área.

### 4.7 Color: neutros con un solo acento, generados en OKLCH
- Definir las rampas de grises y el acento con `oklch()` y `color-mix()`, que funcionan en todos los navegadores actuales desde 2023. Así claro, oscuro y alto contraste salen de pocas variables, igual que hace Linear.
- La paleta actual (azul acento, gris hormigón, teja para el acero) es buena base. Bastaría con reducir el azul a acciones y estado seleccionado.
- Separar superficies por **diferencia de tono** y no por bordes en todas partes, porque hoy hay muchas líneas de 1 px compitiendo.

### 4.8 Accesibilidad y preferencias del sistema
- Añadir `@media (prefers-contrast: more)` y `@media (forced-colors: active)` (temas de contraste de Windows), además del modo oscuro que ya existe.
- Cumplir el contraste AA de WCAG 2.2 (4,5:1 en texto) y un tamaño mínimo de 24 px en cualquier zona que se pueda pulsar.
- El foco visible ya existe y está bien hecho.

### 4.9 Ritmo y forma
- Usar una rejilla de 4 px en todos los espaciados: 4, 8, 12, 16, 24 y 32.
- Esquinas concéntricas: panel de 10 px, campos de 6 px y elementos pequeños de 4 px.
- Ofrecer dos densidades (compacta y cómoda) con un selector, como hacen Carbon y Fluent. Los ingenieros con monitores grandes suelen preferir la compacta.

### 4.10 Teclado primero y paleta de comandos
- Ctrl+K para la paleta de comandos, Ctrl+Z / Ctrl+Y para deshacer y rehacer cambios de datos, y Alt+1…4 para los módulos del menú.

### 4.11 Memoria de cálculo imprimible
- Crear una hoja `@media print` que convierta la pantalla en una **memoria de cálculo**: cabecera con el proyecto, la norma y la fecha, datos, resultados con fórmulas y artículos, y dibujos en vectorial.
- Es lo que el ingeniero entrega, y donde Tedds y ClearCalcs se ganan su fama. Con "Imprimir › Guardar como PDF" no hace falta ninguna librería.

### 4.12 Movimiento mínimo
- Limitar las transiciones a 120–200 ms en cambios de estado (pestaña, desplegable o veredicto) y respetar `prefers-reduced-motion`, que ya está.
- Nada de rebotes ni animaciones decorativas.

### 4.13 Disposición en pantallas anchas
- A partir de unos 1440 px, partir los resultados en dos columnas: dibujo a la izquierda y cifras y tablas a la derecha. Así el usuario lo ve todo sin hacer scroll.
- Mantener una sola columna en móvil, como ahora.
- Permitir plegar el panel de datos para dejar sitio a los resultados.

---

## 5. Qué no hacer
- **No usar vidrio ni desenfoques** (`backdrop-filter`): restan legibilidad y rendimiento, y Apple ha tenido que suavizarlo.
- **No usar fuentes web ni de iconos**, que ya están descartadas. Los pocos iconos necesarios deberían ser SVG en línea, dibujados a trazo de 1,5 px.
- **No colorear por colorear**: el verde y el rojo se reservan para cumple y no cumple, y el resto de la pantalla queda neutro.
- **No quitar etiquetas de texto** en favor de iconos (la propia investigación de Google muestra que empeora la usabilidad).

---

## 6. Detalle observado en el código actual (para el hilo que lleva el código)
- El README todavía dice "la interfaz trabaja en cm, cm², MPa y kN·m", lo que choca con la decisión de usar m, mm, kN y MPa. Hay que revisar si la interfaz ya está en mm.
- `--f-num` es una pila monoespaciada (Consolas…) usada en campos, tablas, cifras y en los textos del dibujo. Según el punto 4.5, convendría cambiarla por `var(--f-texto)` con `tabular-nums`.
- En `app.js`, `num()` usa `toLocaleString('es-ES')` con decimales fijos por llamada. Conviene centralizar la precisión por magnitud (punto 4.5) en una única tabla.

---

## Fuentes
- Apple, Liquid Glass y su evolución: [MacRumors, iOS 27: regulador de transparencia](https://www.macrumors.com/how-to/ios-27-tone-down-liquid-glass-transparency/) · [Gulf News, opción *Tintado* en iOS 26.1](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176) · [Macworld, betas de iOS 26](https://www.macworld.com/article/2854351/how-liquid-glass-will-and-wont-change-your-iphone-this-fall.html) · [Wikipedia, Liquid Glass](https://en.wikipedia.org/wiki/Liquid_Glass) · [MacStories, revisión de iOS 27](https://www.macstories.net/stories/ios-and-ipados-27-review/2/)
- Google: [Expressive Material Design, investigación de Google](https://design.google/library/expressive-material-design-google-research)
- Microsoft: [Fluent 2](https://fluent2.microsoft.design/)
- IBM: [Carbon, estrategias tipográficas](https://carbondesignsystem.com/elements/typography/style-strategies/)
- Linear: [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Tekla Tedds: [Interface Designer](https://support.tekla.com/doc/tekla-tedds/2026/ifd_introducing)
- Lo dicho sobre Fluent 2 (escala tipográfica y rejilla de 4 px), Desmos, Figma, Mathcad, Calcpad, RFEM y CYPE procede de conocimiento previo y no se ha comprobado de nuevo en esta sesión.

---

## 7. Decisiones de José Luis tras ver la maqueta (8 de octubre de 2026)
- Separador decimal: **el punto**, también en español. Se acepta la coma al escribir.
- Fuente del sistema para todo, sin monoespaciada (confirmado).
- Al entrar en un campo se **selecciona su contenido**, para escribir encima.
- Armadura: aceptar `2D25+8D12` (la D sustituye a ø, que no está en el teclado), además de `ø`, `fi`, `x` y el **área en mm²**, y mezclas (`2D20+300`). En pantalla se muestra normalizada como `2ø25 + 8ø12`.
- Colores: acero en **gris oscuro**; el **rojo solo para avisos malos** (no cumple, errores). La compresión mantiene un azul y la tracción va en gris rayado.
- Sin botón Calcular. Cada cambio, incluido pasar de Comprobar a Dimensionar, recalcula el modo activo desde cero.
- Densidad compacta de verdad: etiqueta a la izquierda del valor y sin líneas vacías bajo los campos.
- Secciones apaisadas: se dibuja un tramo de 2·h con líneas de rotura y las barras a su separación real, sin falsear la escala.
- **Notación de EC2** en toda la app (M<sub>Ed</sub>, M<sub>Rd</sub>, A<sub>s1</sub>, A<sub>s2</sub>, F<sub>c</sub>, F<sub>s1</sub>, f<sub>cd</sub>, γ<sub>C</sub>…), sea cual sea la norma de cálculo.
- **Español e inglés**, que se alternan desde la paleta Ctrl+K.

La maqueta que aplica todo esto está en `analisis/maqueta/maqueta-flexion.html`.

### 7.1 Gráficas (8 de octubre de 2026)
- Usan la **misma paleta y la misma fuente** que el resto: azul para la compresión, gris oscuro para el acero y rojo solo para lo que no cumple.
- **Zoom**: con la rueda, arrastrando un rectángulo y con dos dedos en móvil. El doble clic vuelve a la vista completa.
- **Etiquetas emergentes**: una cruz que sigue al cursor y muestra los valores del punto (por ejemplo A<sub>s1</sub>, A<sub>s2</sub> y M<sub>Rd</sub>).
- **Copiar como imagen**: con el botón Copiar o con Ctrl+C sobre la gráfica, que pasa a PNG al portapapeles (`navigator.clipboard.write` con `ClipboardItem`). Hay también **Guardar PNG o SVG**, que sirve cuando el navegador no deja copiar.
- **Idiomas**: el diccionario de textos debe ir en archivos propios (`src/i18n/es.js` y `src/i18n/en.js`), no mezclado con la interfaz.
