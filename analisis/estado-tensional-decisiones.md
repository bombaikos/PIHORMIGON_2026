# Módulo ELS ▸ Estado tensional: decisiones (31/10/2026)

Código: `src/core/estadoTensional.js` (motor), tests en `tests/estadoTensional.test.js`. Maqueta de la pantalla: `analisis/maqueta/estado-tensional.html`. Vista: `src/ui/vistas/estadoTensional.js` (rama `els-estado-tensional-vista`; menú ELS, primera entrada), textos en `src/i18n/estadoTensional.*.js`.

## Alcance (Pepiño)
- Solo calcula; no comprueba límites. Motor general (contornos con huecos, barras y franjas); la elección de sección es la de siempre (todos los tipos).
- Tres formas de dar el estado, con regletas: (N, Mx, My), (ε_cdg, κx, κy) y (ε_sup, β, x). Resultados: las tres, más ε_inf, tensiones del hormigón (compresión máxima y tracción) y ε, σ de cada barra. Las tensiones sobre el dibujo, en una fase posterior.
- (ε_sup, β, x) y no (ε_cdg, β, x): con ε_cdg = 0 (flexión pura) el plano no queda definido. x sin cota: ∞ es compresión uniforme; negativa si toda la sección está en tracción; ε_sup y x han de tener el mismo signo.
- Vista: sección girada con la neutra horizontal y el plano de deformaciones perpendicular a ella (sin interruptor de «sección fija»); zona comprimida rayada.

## Convenciones del motor
- kN y m; deformaciones absolutas, κ en 1/m, β en rad, tensiones del resultado en MPa (la interfaz pasa a ‰ y grados).
- Compresión positiva; Mx > 0 comprime la cara superior (β = 90°); My > 0 la derecha (β = 0). β antihorario desde +x, u = (cos β, −sin β) en ejes x→, y↓.
- Plano: ε(x, y) = ε_cdg + ky·(x − xc) − kx·(y − yc). ε_sup es la deformación de la fibra más comprimida y x se mide desde ella (x = ε_sup/|κ|).
- Se reutiliza `esfuerzosPlano` de `esviada.js` (integración exacta por tramos), sin cambios en ese archivo.

## Leyes de servicio
- Hormigón: el diagrama del material de la sección (Sargin `EC2` o por puntos), con cada punto (ε, σ) → (ε·(1+φ), σ·αcc/γC). γC y αcc son datos del módulo (por defecto, los de la ficha del material en la vista); φ a mano, 0 por defecto.
- Parábola-rectángulo: es un diagrama de rotura y ya lleva αcc/γC dentro; no se le aplica el factor y se devuelve el aviso `PR` (la vista lo muestra en pardo).
- Casilla «Ley lineal (Ecm)»: recta de pendiente (αcc/γC)·Ecm/(1+φ); la vista muestra un aviso pardo fijo mientras esté marcada (aviso `lineal`).
- Acero: elástico lineal con su Es, sin plastificación.
- **Regla de estado**: se calcula primero con la sección íntegra (tracción elástica sin límite); si la fibra más traccionada supera la deformación de fisuración (fctm/Ecm estirada por (1+φ)), se vuelve a calcular sin tracción. El resultado dice `fisurada`. Evita el corte brusco de la rama de tracción del Sargin y la doble solución.
- El tension stiffening no se trata aquí (corresponde a Flechas y fisuración: EC-2 7.4.3, EHE-08 art. 50 y coeficiente de distribución ζ; por verificar contra los textos).

## Pendiente / por decidir
- Parámetros de fctm: la vista debe pasar `fctm` de la norma (`normaMat(...).fctm(fck)`).
- Aviso `eps-cu`: ε_sup por encima de 3,5 ‰·(1+φ) (fuera de servicio).
- Si se quiere restar el hueco de las barras comprimidas en el hormigón (n − 1): hoy no se descuenta, como en el motor de rotura.

## Vista (31/10)
- Datos: desplegable de sección (todos los tipos), cápsula de modo, campos del modo, γC, αcc, φ, casilla «Ley lineal (Ecm)» y Ec,eff / n derivados. Al cambiar de modo se conserva el estado.
- Resultados: pastilla con el nombre de la sección, σc máx. y «Sección fisurada / sin fisurar» (pardo / neutro); avisos pardos (PR, ley lineal, ε_sup por encima de εcu); dibujo con regletas al 80 %; tablas de los tres modos, fibras extremas y armadura (con «Copiar tabla» si hay más de 4 barras y scroll interno).
- x = ∞ se escribe como 100 000 mm o más; la regleta de x es no lineal y acaba en ∞.

## Revisión de cálculo y auditoría de la guía (1/11/2026)
- **Cálculo**: el motor es correcto (equilibrio y compatibilidad verificados por los 11 tests propios). El ε de 947 ‰ salía de la regleta de κ, cuyo recorrido era 1000 veces mayor de lo debido (`8 / hy` en 1/m en vez de 0,008 / hy). Ahora el máximo es 8 ‰ de deformación a lo largo del canto. Los números enormes de σ_s (151 541 MPa) eran coherentes con el acero elástico lineal sin límite: el módulo solo calcula y avisa («pasa de la deformación última»).
- **Guía**: las etiquetas de σ del dibujo pasan a 1 decimal (§ 1, tabla de precisiones); la sección dibujada no pasa de 300 px y el SVG no se amplía (§ 8, `SECCION_MAX`, `topeEscala`); se resalta a la vez barra y fila de la tabla al pasar el ratón (§ 8); las etiquetas de σ que se pisarían se omiten, la tabla las da todas (§ 15).
- Pendiente de decidir: el color de las barras (hoy azul si comprimen y gris si traccionan; la guía § 4 dice acero en gris oscuro) y un aviso cuando σ_s supere f_yk.

## β y puesta a cero (4/11/2026, Pepiño)
- **β de pantalla = ángulo de la fibra neutra** (antihorario desde +x): β = 0 es la sección en su posición normal (Mx > 0, neutra horizontal, comprime la cara superior). El motor sigue usando el ángulo de la dirección hacia la fibra más comprimida (90° más); la conversión se hace en la vista (`aMotor` / `deMotor`).
- **Doble clic en una regleta la pone a cero** (la de x, en ∞). Es un parámetro opcional `reinicio` del componente común `regleta()` (`src/ui/campos.js`), con `title` «Doble clic: llevar a cero». Pendiente de que el hilo de estilo lo recoja como regla de la guía.

## Acero con la ley de su material (4/11/2026, Pepiño)
- **Regla**: nunca se sustituye en silencio la ley de un material. El acero lineal elástico sin plastificación era una sustitución mía y se retira.
- El acero usa la ley bilineal de su material, con **γS como dato editable** (por defecto el del material; 1,00 da la meseta en f_yk, como γC y αcc en el hormigón). La rigidez elástica no cambia con γS.
- Avisos pardos: «La armadura ha llegado a la meseta de su ley (plastifica)» y «supera la deformación última de su ley (la tensión es nula)»: el estado no es de servicio.

## Tensiones del hormigón, x a la izquierda y regleta de N rosa (4/11/2026, Pepiño)
- A la derecha del plano de deformaciones se dibuja el **diagrama de tensiones del hormigón** («Tensiones»), con la ley en uso (sin fisurar: con su rama de tracción; fisurada: sin ella), σc máxima arriba y σ de tracción abajo si la hay, en MPa con un decimal.
- La **x se acota a la izquierda** del plano; se quita el rótulo «fibra neutra» (la línea discontinua se queda).
- La **regleta de N se pone rosa** (clase `trac`, la misma de Flexión esviada) cuando N < 0 (tracción).
