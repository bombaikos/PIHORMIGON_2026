# Punzonamiento: decisiones y puntos a verificar

Módulo construido el 20/10/2026 a partir de `analisis/punzonamiento-plan.md`, con las tres normas (EHE-08, EC-2 2004+AN, EC-2 2023). Rama `punzonamiento-oeqv03`, pendiente del visto bueno de José Luis.

## Decidido por José Luis (19/10)
- Seis tipos de pilar: rectangular y circular, cada uno interior, borde y esquina. Muros más adelante.
- Perímetro geométrico mínimo, sin el término D extra del 3.1.
- ηc y ηs (EC-2 2023) se muestran como resultados intermedios con desplegable explicativo.
- EC-2 2023 trabaja en esfuerzos (kN).

## Valores por defecto elegidos (sin respuesta aún)
- Cuantía: ρx y ρy por separado; ρl = √(ρx·ρy) ≤ 0,02 (EHE-08 y EC-2 2004).
- σcd opcional, 0 por defecto (en la EC-2 2023 no se usa).
- Solo cercos verticales; sin barras levantadas.
- EC-2 2023: dv,out = dv − φw.
- EHE-08: un,ef a 2d del último perímetro de cercos; disposiciones constructivas con el criterio del EC-2 (la EHE-08 las remite a la buena práctica).
- Pilar circular tangente a los bordes (borde y esquina); geometría exacta, sin el D extra del 3.1.
- Excentricidad: «Sin momento» β=1; «Simplificado» β aproximado (1,15 interior, 1,4 borde, 1,5 esquina); «Otro β» manual.

## A verificar en el BOE
- EHE-08 art. 46.3: τrd mínimo, y los coeficientes 0,75 y 1,5 del 46.4.1.
- Exponente de la expresión 8.112 del EC-2 2023.

## Validación
- Ejemplo del plan: 533 / 533 / 298 kN (EC-2 2004 / EHE-08 / EC-2 2023 sin armadura). Test en `tests/punzonamiento.test.js`.
- Puerto de TT3 (3.1) en `tests/ref31/tt3.js`, hecho desde la descripción del plan, no desde el Delphi original.
- Encaje en pantalla (1536×730 y 1366×657) en `tools/encaje.mjs`, 9 pantallas.
