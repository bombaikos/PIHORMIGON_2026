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

## Diagramas N–M a Mx o My constante (31/10)

- Pedido de Pepiño: además de Mx–My a N constante, mostrar N (eje x) frente a Mx o My (eje y) con el otro momento fijo en una regleta. Selector «Constante: N | Mx | My» en Diagrama.
- Motor (`superficieEsviada`, `corteNM`, `estadoEnPlano`, `razonNM`, `coeficienteNM`): la superficie de rotura (N × θ, 33 niveles × 48 direcciones, unos 2 s) se calcula una sola vez por modelo y se guarda. El corte para cada momento fijo se obtiene interpolando (instantáneo). El polígono sigue al estado exacto con error de ~2 % como mucho; los puntos (γ, β, x, κ, ε) se afinan con el estado último exacto.
- γ en N–M: análogo al de Mx–My. Con el momento fijo M0 y excentricidad constante (e = M/N), γ = λ con λ·(N, M) sobre el diagrama (Q = λ·P). Un punto dentro tiene γ ≥ 1 (el corte más lejano); fuera, el corte más cercano por debajo de 1 (0 si no hay).
- Cada punto lleva su N y el otro momento; todos usan el momento fijo de la regleta. Con N constante siguen usando el N de la regleta.
- Los ejes del diagrama N–M son fijos: N entre las capacidades de tracción y compresión; el otro momento hasta su máximo.
- La tarjeta grande de diagnóstico no lleva la palabra «γ» ni «|OQ|/|OP|», pero sí el coeficiente de seguridad (número) con esa etiqueta (Pepiño, 31/10).
- Figura de la sección: Mx y My como vectores de doble punta en gris (regla de la mano derecha: Mx>0 apunta a la izquierda, My>0 hacia arriba); β antihorario; x perpendicular a la recta neutra.

## Aviso de cálculo y selector de ø (31/10)

- Si la superficie de rotura aún no está calculada (primera vez con esa armadura, ~2 s), Diagrama muestra «Se está calculando…» en el centro del panel y se repinta al terminar.
- El selector de ø está en los tres modos. En Rec pilar es editable; en genéricas (más de un diámetro) se queda en gris con el motivo, no se oculta.
- En Dimensionamiento el selector va en gris con el ø que trae la sección (de él parte la propuesta); en genéricas, en gris con el motivo (Pepiño, 31/10).

## Tablas y diagramas N–M, segunda vuelta (31/10)

- Datos de Diagrama: primero «Esfuerzo fijo para el diagrama» (N | Mx | My) y luego «Esfuerzos solicitantes». La tabla de esfuerzos empieza con 5 puntos a cero, crece hasta 10 sin scroll y solo con más de 10 lleva scroll.
- La tabla de la derecha lleva solo N, Mx, My y el coeficiente; las filas fuera del diagrama, en rojo. β, x, κ, ε sup y ε inf van en la tabla detallada del gráfico (pestaña «Tabla»); en N–M se calculan al abrirla (estados exactos por nivel, ~0,5 s).
- El trazo N–M se dibuja con interpolación cúbica monótona entre los 48 niveles de la superficie (más densos hacia los extremos); el polígono sin suavizar sigue sirviendo para dentro/fuera y γ.

## Tres tarjetas (31/10)

- Los tres modos usan el estándar de tres tarjetas (datos | gráfico | resultados): `.cuerpo.dib-ancho` con la tarjeta del gráfico y la del lateral (sección, cifras, tabla o traza). La tarjeta de la derecha ya no se estrecha y las filas de las tablas no se parten a 1366×657.
