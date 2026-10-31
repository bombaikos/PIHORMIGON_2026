# Torsión: decisiones y alcance

Módulo `ELU ▸ Torsión` (`src/ui/vistas/torsion.js`, núcleo en `src/norma/torsion/index.js`, tests en `tests/torsion.test.js`). Decisiones de Pepiño del 31/10/2026.

## Alcance
- Una pantalla para las tres normas (EHE-08, EC-2 2004+AN, EC-2 2023), que cambia con la norma del proyecto.
- **Solo secciones rectangulares** (Rec viga y Rec pilar). T, circular y genéricas, más adelante.
- **Solo torsión pura de equilibrio.** La compatibilidad (sin armadura calculada) queda fuera; se avisa en las aclaraciones.
- **El programa NO hace la interacción** con cortante, flexión ni axil. Un desplegable «Interacción con otros esfuerzos» recuerda, con el apartado de cada norma, que hay que usar el mismo θ que en Cortante, sumar la armadura longitudinal de torsión a la de flexión y comprobar la biela con la interacción de la norma. «El usuario tiene que saber lo que hace.»
- Ángulo θ libre dentro del rango de la norma, con campo y regleta como en Cortante (EHE-08 y EC-2 2004: cotg θ 0,5–2,0; EC-2 2023: 0,4–2,5, 8.3.4(4)).
- Sección primero (desplegable único, `grupoSeccion()`), cápsula Comprobación | Dimensionamiento, un solo cartel con el aprovechamiento, resultados con tres barras (biela, cercos, longitudinal) y filas desplegables con fórmula, valores y artículo.

## Modelo
- Sección hueca eficaz: `he = A/u`, nunca menor que 2c; `Ae = (b − he)(h − he)`, `ue = 2[(b − he) + (h − he)]`. c = distancia de la cara al eje de la armadura longitudinal (viene de la sección, editable en el módulo). Se usa el `he` máximo (EHE-08 45.2.1 admite uno menor).
- EHE-08 45.2.2: `Tu1 = 2·K·α·f1cd·Ae·he·cotθ/(1+cot²θ)`, `Tu2 = 2·Ae·(At/s)·fyt,d·cotθ`, `Tu3 = 2·Ae·Al·fyl,d·tanθ/ue`. K = 1 (sin axil); α = 0,60 (cercos solo en el perímetro, por defecto) o 0,75 (ambas caras); f1cd = 0,60·fcd (fck ≤ 60); fyt,d ≤ 400 MPa (criterio ya usado en Cortante); separación `s ≤ ue/8` y las tres condiciones de 45.2.3 según Td/Tu1.
- EC-2 2004+AN 6.3.2: `TRd,máx = 2·ν·αcw·fcd·Ak·tef·senθ·cosθ` (6.30), ν = 0,6(1 − fck/250), αcw = 1; cercos y armadura longitudinal equivalentes a las fórmulas anteriores (6.2.3 con `VEd,i = τt,i·tef·zi` y (6.28)). Sin tope de 400 MPa.
- EC-2 2023 8.3.4: (8.82)-(8.84) pasadas a torsor; ν = 0,60 con cotθ = 1 y 0,50 en el resto (simplificado, sin Anejo G, como en Cortante); fcd con ηcc·ktc del material; con b_máx/b_mín < 1,5 y c > 0,07·b_mín se calcula con c = 0,07·b_mín (8.3.4(5)).
- Dimensionar: `At/s = Td/(2·Ae·fyt,d·cotθ)`, `Al = Td·ue·cotθ/(2·Ae·fyl,d)` con reparto por lados de la línea media; tabla ø × separación (múltiplos de 50 mm, una rama por pared).
- Sin mínimas de torsión ni de cortante (aviso en aclaraciones); sin pretensado.

## Pendiente
- Verificar contra el BOE las fórmulas de EHE-08 45.2.2.1 y 45.2.3 (texto ilegible en el comentario); ver `formulas-por-verificar.md`.
- Casos de comparación con el Prontuario 3.1 (TT2, EHE-98) y EHE.exe.
- T, circular y genéricas; mínimas; ayuda del módulo.
