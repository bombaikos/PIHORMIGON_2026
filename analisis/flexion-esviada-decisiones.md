# Módulo ELU ▸ Flexión compuesta esviada: decisiones (31/10/2026)

Código: `src/core/esviada.js` (motor), `src/ui/vistas/flexEsviada.js`, textos en `src/i18n/flexEsviada.*.js`. Tests en `tests/esviada.test.js`.

## Alcance (Pepiño, 31/10)
- Igualar primero el Prontuario 3.1: secciones **rectangulares definidas por redondo (Rec pilar)** y **genéricas**. Sin viga, T ni circular por ahora.
- Primero el **diagrama de interacción Mx–My a axil constante**. El axil va en una **regleta** (gauge) bajo el diagrama; **tracción en rosa** (no rojo: el rojo es «No cumple»), compresión en azul. Tokens `--rosa` y `--rosa-suave`.
- En Rec pilar el **diámetro de la armadura es dato de cálculo** del módulo (selector ø), como en Flexión compuesta recta.
- Elección de sección y cápsula Comprobación | Dimensionamiento | Diagrama como en Flexión simple.

## Método
Como el «esviada por β» del 3.1: para cada dirección θ de la fibra más comprimida se gira la sección, se halla el estado último con el motor seccional (máxima curvatura con plano admisible que equilibra N) y se integran N, Mx y My en la sección entera (hormigón por tramos exactos entre vértices y quiebros; armadura puntual; las franjas por área se reparten en 11 puntos).
- Ejes: x a la derecha, y hacia abajo. **Mx > 0 comprime la cara superior; My > 0 comprime la cara derecha** (compresión positiva). Momentos respecto al c.d.g. del hormigón bruto.
- Gráfica: x = My, y = Mx, **misma escala en ambos ejes** (`escalaIgual` en `grafica.js`).
- Coeficiente de seguridad γ = |OQ|/|OP| a excentricidad constante; Q se halla por bisección en θ (no con el polígono).
- Dimensionar: factor k de la armadura de Secciones (misma disposición) para γ ≥ 1, ø propuesto de la serie, cuantía mínima de pilar como en la recta.
- Verificado con tests: coincide con el motor recto en θ = 90° y 270°, simetrías, y una integral de fibras independiente en una sección en L.

## Por verificar
- Excentricidad mínima en esviada: se aplica N·e_mín **por separado en cada dirección** (h/20 o h/30 en Mx; b/20 o b/30 en My; mín. 20 mm). No está comprobado que cada norma lo pida así.
- Pendiente (en la lista de Pepiño): puntos (N, Mx, My) sobre el diagrama, otros modos del 3.1 (N–My a Mx constante), pretensado.
