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

## Excentricidad mínima (verificado 31/10)
- **EHE-08 42.2.1**: máx{h/20; 2 cm}, «contada desde el c.d.g. de la sección bruta y en la dirección más desfavorable de las direcciones principales y sólo en una de ellas».
- **EC-2 2004 6.1(4)**: e0 = h/30, no menor que 20 mm (h = canto); **EC-2 2023 8.1.1(5)**: M_Ed,min = ±N_Ed·e_d,min con e_d,min = máx{h/30; 20 mm}. Ninguno dice nada de la esviada: se aplica como la EHE-08, en una sola dirección.
- Decisión (Pepiño): selector en datos «e_mín» con la dirección (y → Mx, o x → My); por defecto y. No se aplica en las dos a la vez.
- Todos los puntos del modo Diagrama usan el axil de la regleta.

## Por verificar
- Pendiente (en la lista de Pepiño): puntos (N, Mx, My) sobre el diagrama, otros modos del 3.1 (N–My a Mx constante), pretensado.
