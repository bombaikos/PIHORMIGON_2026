# Auditoría de la maqueta de Fisuración contra la guía de estilo (01/11/2026)

Hecha leyendo `analisis/guia-estilo-prontuario.md` punto por punto contra `analisis/maqueta/fisuracion.html` y su CSS, y con las capturas a 1536×730 y 1366×657 (sin scroll en ambas). La maqueta usa la serie 10/12/14 px; la app real usa 12/14/16 (`--mas` = 2 px), así que **todo lo que cabe justo en la maqueta puede no caber en la app**.

## Cumple
- Tres columnas, sin scroll de página a 1536×730 y 1366×657 (§ 13). Alineado arriba (§ 13).
- Cápsula Comprobación | Dimensionamiento | Diagrama con el CSS real `.seg.capsula` (Pepiño, 01/11).
- Un solo cartel grande (wk) y sello Cumple / No cumple en verde y rojo (§ 4, § 13).
- Notación EC-2 con subíndices reales; unidades entre corchetes en etiquetas y cabeceras (§ 1, § 2).
- Cifras: σ MPa 1 decimal, ε ‰ 2, longitudes mm 0, momentos y fuerzas 0 (§ 1). Punto decimal.
- Campos no editables (armado, c, wmáx) en gris con `title` que dice por qué; controles que no aplican (β, kb) en gris, no ocultos (§ 4, 28/10).
- Sección dibujada ≤ 300 px, justificada arriba, barras a su diámetro, plano de deformaciones a la misma escala vertical (§ 8, § 13).
- Series del Diagrama por trazo (continuo, rayas, puntos), sin marcadores, rótulo escrito junto a la curva (§ 9). Notas plegadas con fondo chocolate (§ 14.9). Tabla con «Copiar tabla» (§ 12).

## Incumple (corregir en la app real; los marcados * también en la maqueta)
1. **\* Rojo para la línea de wmáx** en el Diagrama. El rojo es solo para «No cumple» y errores (§ 4) y no se usa como serie (§ 9). Proponer: línea continua en tinta fuerte con rótulo «wmáx = 0.3 mm», o ámbar descartado; decidir.
2. **\* Rótulos en mayúsculas con símbolos**: `.rot` y `.pastilla .rr` usan `text-transform: uppercase` y salen «WK / WMÁX» (rompe la notación, § 2). Quitar las mayúsculas en los rótulos que llevan símbolos.
3. **\* Selectores con la etiqueta a la izquierda** (Duración, Exposición, Acción, Adherencia): la norma general de § 16 pide la etiqueta arriba (2 px) y el control a todo el ancho; solo las cajas de valor numérico van con la etiqueta a la izquierda.
4. **\* Desplegable «Sección» con etiqueta visible**: según § 14.10 es lo primero de los datos, sin etiqueta visible (solo accesible) y sin texto debajo. Usar `grupoSeccion()` y `rotulaSeccion()`.
5. **\* Ancho de las cajas de valor 120 px** (lo reduje al estrechar la columna): § 14 fija 130 px iguales y alineadas. Alto 28 px frente a `--alto-campo` (26 px). Usar los tokens.
6. **\* Selector Gráfico/Tabla** hecho con botones sueltos: debe ser el `segmentado()` estándar (§ 9), con ≥ 12 px entre el rótulo del eje X y el selector, y con Copiar / PNG / SVG sobre el gráfico. El botón «Tabla» no funciona en la maqueta.
7. **\* Filas de resultados que «se despliegan»**: la nota lo promete pero no hay ▸ ni fórmula (§ 14.9, § 7). Falta la traza de wk por norma (fórmula, valores sustituidos, artículo).
8. **Textos del dibujo a 12 px reales** (§ 8): en la maqueta el SVG escala con la ventana (a 1366 se ve a ~8 px). En la app: variable `--k` y `SECCION_MAX`/`topeEscala()`.
9. **Regleta**: en la maqueta está reproducida a mano; en la app usar `regleta()` de `campos.js` al 80 % del gráfico (§ 9). Prohibido otro `<input type=range>`.
10. **Tabla de resultados de 3 columnas en 345 px con texto de 12/14 px**: en la maqueta ya hay que partir «EC-2 2004+AN» en dos líneas. Con +2 px es probable que no quepa; opciones: columna derecha más ancha, nombres cortos «EHE-08 | EC-2 2004 | EC-2 2023» (con «+AN» en el título emergente) o una pestaña por norma.
11. **Hueco vacío bajo el dibujo** (Comprobación y Diagrama): normal por la regla de 300 px, pero a 1536×730 sobra casi la mitad de la columna central. Candidatos: tabla de fibras/armadura bajo el dibujo, como en Estado tensional.
12. **Resalte de la sección comprimida**: la guía pide la tracción en gris rayado y la compresión en azul; la maqueta sombrea solo Ac,ef y no raya la zona comprimida (como Flexión simple).
13. **Resaltado cruzado dibujo ↔ tabla** al pasar el ratón (§ 8): no está.
14. **Rojo en las cabeceras de columna de las normas no vigentes**: § 4 lo permite en el selector de norma y en el chip; en cabeceras de tabla es una extensión. Preguntar.
15. **Nombre de norma**: «EC-2 2004+AN» (maqueta) frente a «EC-2 2004 + AN» (chip). Un solo nombre en toda la app.

## Vacío de la guía
§ 1 no fija la precisión de la **abertura de fisura wk** (mm) ni de **wmáx**. Propuesta: wk con 2 decimales y wmáx con 1, en la tabla `MAG` de `formato.js` (hoy la maqueta formatea a mano; en la app lo impide `tests/formatoUnidades.test.js`). Pendiente de visto bueno.

## Pendiente de comprobar en la app
`npm run test:pantalla` con la entrada de Fisuración en `tools/encaje.mjs` (serie 12/14/16) a 1536×730 y 1366×657, claro y oscuro, español e inglés, y `prefers-contrast` / `forced-colors`.
