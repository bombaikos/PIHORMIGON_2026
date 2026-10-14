# Prontuario Informático del Hormigón 3.1: análisis del código

Carpeta analizada (solo lectura): `C:\PORTABILIDAD\Programas en desarrollo\Delphicos\PRONTUARIO\Version 3.1`

## 1. Qué es técnicamente

- **Delphi (VCL), no Turbo Pascal puro.** Programa principal `EHE.dpr` → `EHE.exe` (título "PRONTUARIO INFORMÁTICO DEL HORMIGÓN 3.1"). Fuentes de 1999‑2003; hay un `EHE.dproj` de Delphi 2007 (2008) que solo es una reconversión del proyecto.
- Las units de cálculo más antiguas (`Marin.pas`, `marinvar.pas`, `utl.pas`, `CURV2.PAS`) conservan estilo Turbo Pascal (`text`, `readln`, `(* *)`, `{$R+}`): es el núcleo heredado.
- ~47.000 líneas en 54 `.pas`. Componentes de terceros: **TeeChart** (gráficas), **QuickReport**, **HtmlView** (visor de informes HTML), **VCF1** (Formula One, hoja de cálculo OLE).
- Unidades de trabajo internas: **kN y m** (tensiones en kN/m²; Es = 200 000 000 kN/m²; Ec = 8 500 000·(fck/1000+8)^(1/3)).

## 2. Estructura de units

### Núcleo (sin formulario)
| Unit | Contenido |
|---|---|
| `PIH_TIPOS` | Tipos: `ecuacion_constitutiva` (diagrama σ‑ε poligonal en compresión y tracción, E, fk, cansancio α, γ), `parte` (trapecios, polígono, círculo o redondos), `seccion` (hasta 50 partes, A, yg, Iy, Iz, inercias bruta/homogeneizada/fisurada, Mfis, ambiente y exposiciones, recubrimiento). |
| `PIH_VARIABLES` | **Estado global**: proyecto abierto, directorio, sección activa, listas de nombres de hormigones, aceros y secciones (5 tipos × 300), flags `ModXXX_Abierto`. |
| `Marin`, `marinvar` | Integración exacta de momentos de área de polígonos (método de Marín), giros, resolución de sistemas lineales. |
| `calcomun` | **Motor seccional genérico**: plano de deformaciones, N(curv,xm,α), My, Mz, curvatura última `curvu`, `Axil_Ultimo`, `Plano_de_deformaciones(N,M,α)`, `M_de_N`, axiles extremos, σ(ε). Sirve para flexión simple, compuesta y esviada de cualquier sección. |
| `varios` | Utilidades normativas: longitud de anclaje `lb`, diagrama σ‑ε CEB, cuantías mín/máx, `HallaMlim`, armadura de sección rectangular, diagramas polares para interacción. |
| `utl`, `pih_utl` | Lectura de ficheros de texto con cabeceras `**`, min/max. |
| `Simbulidi` | Fórmulas cerradas de viga sobre terreno elástico (reacción, M, V, flecha). |
| `pih_lee` | **Persistencia**: lee/graba proyecto `.EHE`, secciones `.sec`, materiales `.mat`, `EHE.ini`. |
| `pih_manipuleo` | Mezcla de utilidades de UI (combos, grids, portapapeles) y de datos; usa `GESTOR` ("chapuzón para dar mensajes en Form1"). |
| `PIH_GRAF`, `graficos` | Dibujo de secciones y diagramas sobre TImage/TChart. |
| `PIH_impresion`, `PIH_impresion3`, `PIH_ImpresionTTs` | Generación de informes HTML/impresión por módulo. |

### Formularios (cada uno un módulo del menú de `GESTOR`)
| Unit | Módulo |
|---|---|
| `GESTOR` | Ventana MDI principal, menú, nuevo/abrir/guardar proyecto, últimos archivos. |
| `Unit2`, `DatosObra`, `portada`, `Creditos`, `responsabilidad`, `VisorHTML`, `Control` | Nombre de proyecto, datos de obra, portada, créditos, aviso legal, visor de informes. |
| `Materiales` | Hormigón y acero: fck, fcm, fctm, fctk, Ec, evolución con la edad, **fluencia y retracción (CEB‑FIP MC90/EHE)**, diagramas σ‑ε (parábola‑rectángulo y CEB). |
| `Unit4` (ModuloSecciones) | Definición de secciones: rectangular (áreas o redondos), T, circular y **genérica poligonal** con huecos; características mecánicas, inercias, Mfis, diagrama M‑curvatura. |
| `TN1` + `comun_TN` | Flexión simple, sección rectangular (dimensionamiento, comprobación, diagrama de interacción, propuesta de armado). |
| `TN3` | Flexión compuesta recta. |
| `TN6` (ModuloTN5) | Flexión compuesta esviada (diagramas de interacción 3D por ángulo). |
| `TT1` | Cortante (Vu1, Vu2, Vcu, θ variable, separación máxima). |
| `TT2` | Torsión. |
| `TT3` | Punzonamiento (pilar interior, borde, esquina; armadura de punzonamiento). |
| `TT4` | Anclaje y solapo. |
| `TT5` | Rasante en juntas entre hormigones. |
| `Pandeo` (ModuloP1) | Pandeo de soportes, excentricidad adicional `ea` según el método aproximado de la EHE (art. 43.5). |
| `fisuracion` | Abertura de fisura wk, comparando **EHE**, **EC‑2 (ENV 1992)** y MC90. |
| `flechas` | Flechas instantáneas y diferidas (inercia de **Branson**, λ = ξ/(1+50ρ')), cantos mínimos. |
| `analisis` | Esfuerzos y flechas en vigas de un vano (funciones de singularidad, inercia variable). |
| `VigasContinuas` | Vigas continuas de varios vanos. |
| `ModuloSimbulidi` | Vigas sobre terreno (balasto). |
| `Control`, `curado`, `Desencofrado` | Control estadístico del hormigón, duración del curado, plazos de desencofrado y descimbrado. |

### Restos no usados
`Materiales2.pas` (versión antigua, fuera del `.dpr`), `cosa.pas`, `CURV2.PAS`, `Unit1.pas`, `DLLzator.dpr`, `*.dcu` sin fuente (`TN2`, `impresion`, `LEECOMUN`, `QRHTML`, `Fmxutils`), copias `.zip` y `backup/`.

### Acoplamiento
La lógica de cálculo está **muy mezclada con la interfaz**: en los formularios hay de 20 a 300 accesos a `.Text`, `.Caption` o `.Cells`, y las fórmulas se evalúan dentro de los manejadores de eventos (por ejemplo `fisuracion.pas` calcula wk y escribe en `STepsm1.Caption` en la misma rutina). Solo `calcomun`, `Marin`, `varios`, `Simbulidi` y parte de `pih_lee` son aprovechables casi tal cual, y aun así `calcomun` importa `TN6` y `pih_graf`. Hay dependencias circulares a través de `GESTOR`.

## 3. Datos de proyecto

Todo es **texto plano** con cabeceras `**`, en una carpeta por proyecto:

```
<Directorio_Proyecto>\
  <Nombre>.EHE          índice del proyecto
  Secciones\*.sec       una sección por archivo
  Materiales\*.mat      un material por archivo (ecuación constitutiva)
  Resultados\           salidas e informes
EHE.ini (junto al exe)  últimos proyectos abiertos
```

- **`.EHE`**: cabecera, nombre, datos de obra, fecha, y listas de nombres bajo `**HORMIGONES DE PROYECTO`, `**ACEROS DE PROYECTO`, `**SECCIONES RECTANGULARES… (AREAS)`, `(REDONDOS)`, `EN T`, `CIRCULARES`, `GENÉRICAS`, `**IMPRESIONES EFECTUADAS` (novedad de la 3.1) y `**FIN DEL ARCHIVO`.
- **`.mat`**: E; nº de puntos y código de rotura; pares σ‑ε de compresión; ídem de tracción; fk; cansancio; γ. El hormigón se genera como parábola‑rectángulo de 12 puntos (εc2 = 0,002, εcu = 0,0035) y el acero como bilineal con εu = 0,010.
- **`.sec`**: tipo (`Rec1`, `Rec2`, `T`, `Cir`, `Gen`), nº de partes y, para cada parte, tipo (`T` trapecios, `P`/`f` redondos, polígono…), geometría, predeformaciones y material; al final las inercias, Mfis, ambiente, 7 exposiciones y recubrimiento. Las armaduras de sección rectangular se modelan como trapecios finos, y se añade un material "ficticio" para detectar el pivote en 2‰.
- **No se guardan los esfuerzos ni los resultados de cada módulo** en el proyecto; solo materiales y secciones.

## 4. Normativa

- **EHE (Instrucción de Hormigón Estructural, 1998)**, la normativa base: γ, parábola‑rectángulo, ambientes I, IIa, IIb, IIIa‑c, IV y Qa‑c, H, F, E, cortante, torsión, punzonamiento (art. 46), anclajes, pandeo (art. 43), fisuración (art. 49), flechas (art. 50), curado y desencofrado.
- **CEB‑FIP Model Code 1990**: diagrama σ‑ε no lineal, evolución con la edad, fluencia y retracción.
- **EC‑2 (ENV 1992‑1‑1)**: solo como comparación en fisuración.
- Hay que actualizar todo a **EN 1992‑1‑1:2023**, que además en España sustituye a la EHE a través del Código Estructural. Los cambios que más afectan al código: γc y γs y el factor ηcc (fcd = ηcc·kt·fck/γc), cortante sin armadura con la nueva fórmula basada en τRd,c y ddg, punzonamiento por perímetro de control a d/2, fisuración con la nueva wk y clases de exposición por XC/XD/XS…, recubrimientos por ERC, fluencia y retracción del anejo B, y pandeo por rigidez nominal o curvatura nominal.

## 5. Orden de migración propuesto

Arquitectura: `core/` (módulos ES puros, sin DOM, con tests contra resultados del EHE.exe), `norma/` (parámetros intercambiables EHE ↔ EN 1992‑1‑1:2023), `ui/` (un módulo por pantalla) y `store/` (proyecto en JSON, localStorage/IndexedDB, exportar e importar archivo).

1. **Tipos y persistencia.** Pasar `PIH_TIPOS` a JSON Schema o JSDoc y escribir un **importador de `.EHE`, `.sec` y `.mat`** para abrir proyectos antiguos. Definir el formato JSON nuevo, que también guarde los esfuerzos y resultados.
2. **Geometría.** Portar `Marin` (momentos de área de polígonos) y el cálculo de características mecánicas de `Unit4` (A, yg, I, Ih, Ifis, Mfis) para los 5 tipos de sección.
3. **Materiales.** Portar `Materiales` y `DiagramaCEB` como funciones puras, ya con las propiedades de la EN 1992‑1‑1:2023 (tabla 5.1, fluencia y retracción del anejo B).
4. **Motor seccional (`calcomun`).** Plano de deformaciones, N‑M, curvatura última. Es la pieza crítica: se valida comparando con EHE.exe en una batería de secciones.
5. **Flexión simple, compuesta y esviada** (TN1, TN3, TN6 + `comun_TN`, `varios`): dimensionamiento, comprobación y diagramas de interacción.
6. **ELU de tensiones tangenciales**: cortante (TT1), torsión (TT2), punzonamiento (TT3), rasante (TT5), con las fórmulas nuevas de la 2023.
7. **Anclaje y solapo** (TT4), con la nueva formulación de lbd.
8. **ELS**: fisuración y flechas (necesitan Ifis y Mfis de los pasos 2 y 4).
9. **Esfuerzos en vigas**: un vano (`analisis`), continuas y sobre terreno (`Simbulidi`). Son independientes de la norma y pueden adelantarse si conviene.
10. **Pandeo de soportes**, con los métodos de la 2023.
11. **Módulos de obra**: control, curado y desencofrado. Hoy remiten al Código Estructural y a la EN 13670 más que al EC2.
12. **Informes**: sustituir `PIH_impresion*` por plantillas HTML imprimibles o PDF desde el navegador.

Las pantallas se pueden ir construyendo en paralelo desde el paso 4, cada una sobre su módulo de `core/` ya probado.
