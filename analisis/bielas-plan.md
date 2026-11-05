# Plan del módulo «Bielas y tirantes · Nudos» (CCC, CCT, CTT, TTT)

Estado: propuesta para discutir el alcance. Sin código. Maqueta interactiva: `analisis/bielas/maqueta-bielas.html` (cifras ilustrativas). Autor: hilo «Módulo Bielas y tirantes», 1/11/2026.


## 0. Decisiones de Pepiño (5/11/2026)
1. Solo fase 1 (comprobación de un nudo); plantillas de región D, más adelante.
2. El usuario da la fuerza de un miembro y el resto sale por equilibrio.
3. Ancho de biela calculado por geometría, pero editable.
4. EHE-08: límite de 400 MPa en el tirante activado por defecto.
5. TTT se incluye (con aviso).
6. Anclaje: cálculo aproximado propio, sin enlazar con el módulo Anclaje y solape.

## 1. Qué pide cada norma

Solo se comprueba el **nudo** y sus elementos de contorno (biela, tirante, anclaje). El modelo de bielas y tirantes (hallar las fuerzas) lo aporta el usuario o una plantilla (fase 2).

| | EHE-08 (art. 40) | EC-2 2004 + AN (6.5) | EC-2 2023 (8.5) |
|---|---|---|---|
| Clasificación | Solo dos casos: nudos multicomprimidos y nudos con tirantes anclados (40.4.2, 40.4.3) | Tres casos: sin tirantes (6.60), un tirante o tirantes en una dirección (6.61), tirantes en más de una dirección (6.62) | Cuatro casos explícitos: CCC, CCT, CTT y TTT (8.5.4.1) |
| CCC | σ ≤ f2cd = fcd (biaxial); triaxial 3,30·fcd, con armadura transversal (40.4.2) | σ ≤ k1·ν'·fcd, **k1 = 1,00** | ν = 1,0 en los extremos de las bielas; si las bielas cumplen, no hace falta comprobar el nudo (8.5.4.2) |
| CCT | σ ≤ 0,70·fcd (40.4.3) | σ ≤ k2·ν'·fcd, **k2 = 0,70** (AN; recomendado 0,85) | ν de 8.5.2(4) si el tirante se ancla dentro del nudo; ν = 1,0 si se ancla fuera; interpolación lineal (8.5.4.3(4)) |
| CTT | ídem 0,70·fcd | σ ≤ k3·ν'·fcd, **k3 = 0,75** | ν de 8.5.2(4) con barras dobladas o ancladas dentro; 1,0 si fuera (8.5.4.4(2)) |
| TTT | ídem 0,70·fcd | no tratado; se reduce a anclaje | solo con ν coherente con anclaje, detalles y deformaciones (8.5.4.1(2)) |
| Bielas | f1cd = fcd sin fisurar; 0,70·fcd con fisuras paralelas; 0,60·fcd en alma de vigas; 0,40·fcd con fisuras anchas (40.3.1-40.3.2) | 6.55: fcd; 6.56: 0,6·ν'·fcd con tracción transversal; **ν' = 1 − fck/200** en el AN (6.5.2(2)) | ν = 0,40 / 0,55 / 0,70 / 0,85 según el ángulo θcs entre biela y tirante (20-30°, 30-40°, 40-60°, 60-90°; 8.115-8.118); ν = 1,0 sin fisuración transversal; alternativa 8.119 |
| Aumentos | Confinamiento (40.3.4), triaxial 3,30·fcd | +10 % si triaxial, ángulos > 55°, tensión uniforme con cercos, varias capas o confinamiento (6.5.4(5)); triaxial hasta k4·ν'·fcd, k4 = 3,0 (6.5.4(6)) | Confinamiento 8.1.4 y áreas cargadas 8.6 (νpart = 3,0) |
| Tirante | As·fyd (+ Ap·fpd); recomendado σs ≤ 400 MPa (40.2) | fyd (6.5.3) | FRd = As·fyd (8.122) |
| Anclaje | Arts. 69 y 70 | Empieza en la cara interior del nudo (6.5.4(7)) | lbd ≥ ancho del nudo si recta; curvas no empiezan antes del centro del nudo (8.5.4.3(2)) |

Lo que **no** dice ninguna norma y es mecánica: el equilibrio de tres fuerzas concurrentes y el ancho de biela por geometría (w = a·senθ + u·cosθ en un CCT). Se deriva en el motor, no se cita como fórmula normativa.

### Alertas para verificar contra BOE/UNE (a `analisis/formulas-por-verificar.md`)
1. EHE-08 40.4.3: el texto extraído da «f2cd = 0,70 fcd»; confirmar si es 0,70·f1cd y que f1cd = fcd.
2. EC-2 2004 AN 6.5.2(2): la extracción del ν' es confusa (1 − fck/200 y 2/3 de ese valor con fisuras anchas). Hay que confirmar si el 0,6 de la (6.56) se mantiene.
3. AN 6.5.4(4): k2 = 0,70 < k3 = 0,75 resulta raro (más direcciones de tirantes dan más resistencia). Está así en el texto; confirmar.
4. EC-2 2023: confirmar cómo se define fcd (ηfc, kTc) y reutilizar el de Materiales.

## 2. Alcance propuesto

**Fase 1 (este módulo): comprobación de un nudo.** Plano (tensión plana) con tres miembros concurrentes, los cuatro tipos. Datos: tipo, hormigón y acero (del proyecto), espesor t, un miembro con su fuerza (el resto sale del equilibrio), ángulos, anchos de las caras, armadura del tirante y longitud de anclaje disponible. Resultados: σ en cada cara contra su límite según la norma, aprovechamiento de cada tirante y de su anclaje, y un único cartel con el aprovechamiento máximo.

**Fase 2: plantillas de región D** que generan el modelo y las fuerzas: apoyo extremo de viga, ménsula corta, viga pared, cabezal de dos o cuatro pilotes, zapata rígida. Cada plantilla pasa sus nudos a la comprobación de la fase 1.

**Fase 3 (a valorar):** nudos con cuatro o más miembros (se descomponen en nudos de tres, 8.5.4.1(3)), confinamiento, pretensado en tirantes, áreas parcialmente cargadas.

Queda fuera: 3D (nudos triaxiales calculados), fisuración (salvo la limitación de 400 MPa de EHE-08) y análisis no lineal de campos de tensiones.

## 3. Interfaz (maqueta)

- Tres columnas, sin scroll, a 1536×730 y 1366×657 (comprobado en la maqueta: la página no desborda).
- **Datos:** selector de tipo (CCC | CCT | CTT | TTT, dos líneas, § 16), hormigón y acero apilados, espesor, y una **rejilla de elementos** con ángulo, ancho y fuerza. Lo que se calcula va en gris con su explicación en el título emergente. Después, el tirante (armadura y longitud disponible) y las opciones de la norma activa (casillas de la guía, § opción D).
- **Centro:** dibujo del nudo, con biela en azul y tirante en rosa con trazo discontinuo (convención de Flexión esviada), placa de apoyo, barras, flechas de fuerza, cotas y, junto a cada miembro, F, ancho y σ/σRd. El contorno del nudo sale de las caras perpendiculares a cada miembro; en CCC es el triángulo de igual tensión (6.5.4(8)), que sale solo del equilibrio.
- **Resultados:** pastilla con el tipo en grande y el aprovechamiento máximo con sello; tabla de caras; tabla de tirantes con anclaje; traza plegada con artículos. Botón «Copiar tabla».
- Norma en el chip de arriba; EHE-08 y EC-2 2023 en rojo.
- Con la norma activa solo cambian los controles que le afectan: EHE-08 (triaxial, estado de la biela, límite de 400 MPa), EC-2 2004 (+10 %, triaxial, tracción transversal), EC-2 2023 (regleta de anclaje fuera del nudo, ν manual en TTT).

Pendiente de la maqueta: a 1366 el dibujo se reduce y el texto baja de 12 px; en la versión real se aplica `--k` (guía § 8). El contorno exacto de CTT y TTT se afinará al programar.

## 4. Arquitectura (cuando se apruebe)

- `src/core/nudos.js`: equilibrio de tres fuerzas, anchos por geometría, polígono del nudo. Sin DOM.
- `src/norma/nudos/{ehe08,ec2-2004,ec2-2023}.js`: límites por tipo de nudo y de biela, y tirante. El anclaje reutiliza `src/norma/anclaje.js`.
- `src/ui/vistas/nudos.js`, `src/ui/dibujoNudos.js`, `src/i18n/nudos.{es,en}.js`.
- `tests/nudos.test.js` con casos a mano (CCT: R = 700 kN, θ = 45°, a = 300, u = 100) y entrada en `tools/encaje.mjs`.
- Activar «Bielas y tirantes» en el menú (hoy en gris, `docs/HANDOFF.md`).

## 5. Preguntas (con mi recomendación)

1. **¿Fase 1 sola o con plantillas?** Recomiendo fase 1 primero: es lo «rollo de comprobar a mano»; las plantillas después, con tus casos reales.
2. **¿El usuario da la fuerza de un miembro y el resto sale por equilibrio?** Recomiendo que sí (lo hace la maqueta); alternativa: dar las tres fuerzas y avisar si no equilibran.
3. **Ancho de biela:** ¿calculado por geometría (como la maqueta) o libre? Recomiendo calculado, con opción de tecleo.
4. **EHE-08:** ¿límite de 400 MPa en el tirante activado por defecto? Es una recomendación, no una obligación; lo dejo activado.
5. **¿Incluir TTT?** Solo EC-2 2023 lo trata, y se reduce a anclaje. Lo mantengo por completitud, con aviso.
6. **Anclaje:** ¿enlazar con el módulo Anclaje y solape (recomendado) o mantener el cálculo aproximado de la maqueta?
