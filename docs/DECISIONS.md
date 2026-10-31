# Decisiones técnicas vinculantes

Resumen de lo decidido por José Luis (fechas de 2026). Cada módulo tiene su detalle en `analisis/<modulo>-decisiones.md`; la interfaz, en `analisis/guia-estilo-prontuario.md` (manda sobre este resumen). Añade aquí toda decisión nueva que otro hilo necesite.

## Normas
- **Tres normas activas**: EHE-08, EC-2 2004 + Anejo Nacional (vigente) y EC-2 2023 (aún no vigente). EHE-98 descartada (11/10); los proyectos EHE-98 migran a EHE-08.
- **Norma por defecto** al abrir un proyecto: EC-2 2004+AN. Si se elige EHE-08 o EC-2 2023 (no vigentes), el nombre va en rojo.
- **Código Estructural (CE)**: no es una cuarta norma. Solo para recubrimientos y durabilidad, con el Anejo Nacional como indicación según las guías de la DGC (se citan). En todo lo demás, EC-2.
- Los textos de las normas no se suben al repositorio (licencia). Citar «norma, apartado(párrafo)».
- Pendiente: durabilidad con tablas propias de EHE-08 y EC-2 2004 (hoy cmin,dur manual en parte); verificar contra el BOE las fórmulas ilegibles (`analisis/formulas-por-verificar.md`).

## Convenciones de cálculo
- **Compresión positiva** en todo el Prontuario; la curva del hormigón va en el primer cuadrante.
- Diagramas siempre **característicos**; el ELU usa γ de la ficha (1,5 hormigón); momento-curvatura usa γ = 1 (indicarlo).
- **En ELU siempre fc,tracción = 0** (también con Sargin).
- Motor interno en kN y m; interfaz en mm, mm², kN, kN·m, MPa.

## Materiales
- 6 hormigones tipificados **HA-25/30/35/40/45/50** con fck fijado por el nombre; diagrama parábola-rectángulo (PR) con **coeficiente 1,00** (no 0,85). Otros diagramas: EC-2 (Sargin, fcm por defecto) y por puntos de usuario.
- Aceros **B500S y B400S** y los 6 HA existen en todo proyecto nuevo. Acero solo por fyk (B 500 S = B 500 SD).
- EC-2 2023 sin tiempo infinito (50 años); EHE-08 y EC-2 2004 comparten modelo de fluencia/retracción; curvas en log t.

## Secciones
- Rectangulares en dos tipos: **Rec viga** (caras sup./inf.) y **Rec pilar** (barras en horizontal y vertical, un diámetro). Genéricas armadas por caras, como en el 3.1.
- Dimensiones en mm; armado en notación capas `5D20+2D16`, capas separadas 50 mm.
- Pestaña Sección única; **Durabilidad es módulo propio** del menú; ρ_inf / ρ_sup en vigas (referidas a Ac), ρ total en el resto.
- Guardar y Borrar abajo del todo; borrar sin confirmación.
- DXF: escala 1:1 (metros), solo LINE/POLYLINE/LWPOLYLINE/CIRCLE/ARC, capa 0 = contorno, otras = huecos, y invertida al importar.
- M-κ: diagramas característicos, 5 axiles 0–80 % Nu, M± en 1.º/3.er cuadrante, series distinguidas con **trazos, no colores**.
- **Sección primero en todo módulo con elección de sección** (29/10): el desplegable «Sección» es lo primero de los datos (agrupadas por tipo, un solo desplegable); el nombre va grande en la pastilla de resultados, sin textos debajo. Usar `grupoSeccion()` y `rotulaSeccion()` (guía §14.10).

## Flexión simple
- Sección viene de Secciones (Rec viga o T); solo se edita la armadura. M+ o M−; Comprobación | Dimensionamiento | Diagrama (cápsula, José Luis la extenderá a todos los módulos).
- Rotura: criterio EC-2 5.5(4) en las tres normas. Dúctil x/d ≤ 0,288, media hasta 0,448, frágil por encima. «Rotura admitida» por defecto Media. El 20 % es criterio propio.
- A_s,max y A_s,max2 = 0,04·Ac (EC-2 2023 adopta el de 2004); sin mínima en compresión.

## Cortante, punzonamiento, rasante, anclaje
- Un programa por norma (EHE-08, EC-2 2004+AN, EC-2 2023); detalle en `analisis/cortante-decisiones.md`, `punzonamiento-decisiones.md`, `rasante-plan.md`, `anclaje-solape-decisiones.md`.
- Anclaje: % solapado es un dato (defecto 100 %); cd por defecto 25 mm; EHE-08 vía «ensayo de la viga» por defecto (como el 3.1); contraste CE 49.5 plegado en EC-2 2004.
- Rasante: dos hormigones, se usa el más débil; R_Ed directo en kN sobre longitud L. Hipótesis EHE-08 pendientes de verificar contra el BOE.
- Punzonamiento: el 3.1 usa Vcu completo; EHE-08 y EC-2 2004 usan 0,75·τrd; EC-2 2023 mueve el perímetro a d/2.

## Análisis (vigas de un vano)
- Solo un vano, apoyo/empotramiento/libre, cargas puntuales/distribuidas/momentos, EI = Ec·I editable; sin combinaciones. M se dibuja del lado traccionado. Reacciones y esfuerzos sin decimales (manda la guía §1 sobre el 1 decimal antiguo).

## Fuego
- Módulo propio (tablas EHE-08 Anejo 6 y CE Anejo 20 para EC-2). Pendiente revisar tablas contra BOE. Ver `analisis/fuego-decisiones.md`.

## Diseño (resumen; manda la guía)
- Tres columnas (datos | dibujo | resultados), **sin scroll de página** a 1536×730 y 1366×657 (`npm run test:pantalla`); por debajo de 1100×600 y en móvil, una columna. Todo alineado arriba.
- Campos editables **blancos** con borde azul grisáceo; gris solo para desactivado (28/10). Controles que no aplican: en gris con explicación.
- Casillas (31/10): caja blanca, marcada con fondo azul suave y tick azul de acento; nunca el azul por defecto del navegador. Regla general (guía común).
- Unidades entre corchetes `[mm]` en cabeceras (no en cada celda). Texto 12/14/16 px, cartel 28; textos de dibujos a 12 px reales.
- Barra superior de 52 px; Ctrl+K se queda; menú Archivo con «Datos de proyecto» primero.
- Un solo cartel grande de resultado; notas y referencias plegadas; jerarquía «una forma por nivel».
- Rejillas de datos: copiar/pegar como Excel, detección de fila de títulos, punto decimal en pantalla; decimal al copiar configurable en Ctrl+K.
- kN·m sin decimales; razones con dos decimales. Armadura en mm² sin decimales.
- Sin botón Calcular: cada cambio recalcula.
- Proceso: **ver el resultado en Chromium antes de subir**, nunca código a ciegas; enseñar a José Luis antes de subir cambios de interfaz.
- Si una regla de un hilo choca con la guía común (`bombaikos/guia-de-diseno`), manda la guía y se avisa del choque antes de aplicar nada.

## Repositorios
- `bombaikos/pihormigon_2026`: código (fuente de verdad). `bombaikos/guia-de-diseno`: guía común de diseño (nacida de VLASTA; guía de reglas, no diario). Bitbucket `ines_dev/pih_2026`: copia automática, solo lectura para los hilos.
- Fuentes del Prontuario 3.1 (Delphi) en el equipo de José Luis: `C:\Users\jlmm\OneDrive - Ines Ingenieros Consultores\01_PROYECTOS\00_IA\26_PIH_2026\FUENTES_3_1`.
