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

## Armadura y esquemas (28/10/2026, Pepiño)
- Tick «Armadura de punzonamiento» (por defecto activo); sin tick se calcula sin armadura. Campos que no aplican, en gris.
- Esquema de armado: Cruz (nº perímetros y ramas/perímetro) o Retícula (nº ramas x y y). Perímetro exterior: casco convexo (cruz) o contorno (retícula) a k·d del último cerco.
- β editable (simplificado por defecto). Notas tras un (i) junto a «Planta».

## Revisión de la formulación (29/10/2026, Pepiño)
Informe en `/mnt/project-files/punzonamiento/revision-formulacion-ec2.md`. Contrastado con EC-2 2004+AN (6.4, 9.4.3, AN) y EC-2 2023 (8.4, 12.5.1). Incorporado: st ≤ 2d en el último perímetro (EC-2 2004, 9.4.3(1)); tipo de armadura en EC-2 2023 (cercos cerrados, abiertos o ramas simples, studs): ø máximo (12.7 a 12.9) y ηsys 0.70 en studs (8.110); avisos de d ≥ e, pilar alargado y lado > 6dv (2023); resalte del perímetro que manda y de la fila de menos acero.
- No incluido por decisión de Pepiño: β calculado con momento y descuento de cargas dentro del perímetro (zapatas y losas de cimentación, más adelante).
- Pendiente: huecos, capiteles y ábacos, barras levantadas, pilar separado del borde, st ≤ 2d en EHE-08.
- No hay armadura mínima de punzonamiento en el EC-2 2023 (ni en 8.4 ni en 12.5.1).
