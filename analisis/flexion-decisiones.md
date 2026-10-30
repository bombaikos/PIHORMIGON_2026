# Módulo ELU ▸ Flexión simple: decisiones (12/10/2026)

Código: `src/ui/vistas/flexion.js`, `src/core/flexion.js` (motor y cuantías), `datosViga` en `src/io/proyecto.js`. Tests en `tests/flexionViga.test.js`.

## Datos
- La sección sale de Secciones (Rec viga o T) y aquí es de solo lectura: solo se edita la armadura (A_s1 tracción, A_s2 compresión, d1, d2), que se guarda en la sección.
- Se pregunta siempre el signo del momento: positivo (tracciona la cara inferior) o negativo (superior). Con M− la sección se gira 180° para el motor: la cabeza de la T queda traccionada y solo trabaja el alma (b_w) a compresión. El dibujo se hace en la posición real, con la zona comprimida abajo.
- Comprobar y Dimensionar como antes. Se quitó el selector de elemento (viga/losa/muro/pilar): estas secciones son vigas.
- Cuantía mínima en T con la sección total y el módulo resistente de la fibra traccionada (EHE-08 42.3.2, EC-2 AN 9.2.1.1, EC-2 2023 12.2); tabla 42.3.5 referida a la sección total.
- La propuesta de armado y w_k de la T usan el ancho de la zona traccionada (b_w con M+, b con M−) como si fuera rectangular: es aproximado.

## Rotura dúctil, media o frágil (según x/d)
Criterio del EC-2 (UNE-EN 1992-1-1, 5.5(4) y AN) para las tres normas (decidido 12/10): δ ≥ k1 + k2·x/d, k1 = 0,44 (0,54 si fck > 50), k2 = 1,25·(0,6 + 0,0014/εcu2); redistribución posible r = 1 − δ. La EHE-08 (19.2.3, r = 56 − 125·x/d) da los mismos umbrales.
- **Dúctil**: r ≥ 20 % → x/d ≤ 0,288 (εcu2 = 3,5 ‰). **Media**: hasta x/d ≤ 0,448. **Frágil**: por encima, o si x/d supera el de plastificación del acero (sobrearmada).
- El 20 % es criterio del Prontuario (`clasificarRotura`, core/flexion.js). x es la profundidad en rotura y d = h − r de la armadura traccionada.
- La explicación va en el desplegable «Rotura» de Resultados.

## Avisos de cuantía mínima
Si A_s1 < A_s,min mecánica (EHE-08 42.3.2, EC-2 AN 9.2.1.1(1), EC-2 2023 12.2) el aviso da su valor en mm² y la regla; si solo falla la geométrica (tabla 42.3.5) se avisa aparte con su valor.

## Gráfico
Pestaña «Gráfico» junto a Resultados: eje X A_s1 (mm²), eje Y M_Rd (kN·m). Dos curvas: solo A_s1, y con armadura de compresión A_s2 = A_s1 − A_lim (la mínima que mantiene plastificada la de tracción, la misma regla del dimensionamiento). Línea de M_Ed y punto de la sección (o de la dimensionada). Llega a 1,3·A_lim.

## Modo Diagrama y cápsula (30/10/2026)
- Cápsula Comprobación · Dimensionamiento · Diagrama bajo el desplegable Sección; luego «Signo del momento» (desplegable + Positivo / − Negativo). Pepiño la aprueba y la extenderá a todos los módulos (`segmentado({ capsula: true })`, `.seg.capsula`).
- Diagrama: X = A_s [mm²] con A_s1 (principal, continua) y A_s2 (cara opuesta, a trazos); Y = M_Rd [kN·m]; línea de M_Ed con deslizador; la sección con la fibra neutra y las armaduras necesarias se actualizan en directo.
- El dimensionamiento con armadura de compresión no pasa de rotura media (x/d ≤ 0,448 del EC-2 5.5(4)); se explica en la (i) junto a A_s2,req. Opción `xdMax` de `dimensionar`/`curvaDiseno`; sin ella queda el criterio del Prontuario 3.1 (x = x_lim) que usan los tests de validación.

## Rotura admitida y cuantías máximas (30/10/2026)

- Selector «Rotura admitida» Dúctil / Media / Frágil (por defecto Media), con (i), en Dimensionamiento y Diagrama. Fija el x/d máximo antes de poner armadura de compresión (0,288 / 0,448 / x/d límite). En Comprobación se muestra desactivado.
- Cuantía máxima por cara, igual en las tres pantallas: A_s,max (tracción) y A_s,max2 (compresión) = 0,04·Ac en EC-2 2004+AN (9.2.1.1(3)). EC-2 2023 adopta el valor de EC-2 2004 (oficial, no criterio del Prontuario 3.1). EHE-08 conserva su criterio A_s1 (Ac·fcd/fyd) y A_s2 ≤ 0,04·Ac como criterio del Prontuario.
- Mínima: A_s,min = máx(geométrica, mecánica) en tracción, igual en Comprobación (aviso con valor), Dimensionamiento (resultado «mínima») y Diagrama (la curva arranca en A_s,min). En compresión no hay mínima en ninguna norma (EHE-08 42.3.5 nota 4 solo recomienda el 30 % de la mínima de tracción; no se aplica).
- Test «Coherencia de cuantías» en tests/flexionViga.test.js.
