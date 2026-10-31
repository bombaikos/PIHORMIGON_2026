# Módulo ELS ▸ Estado tensional: decisiones (31/10/2026)

Código: `src/core/estadoTensional.js` (motor), tests en `tests/estadoTensional.test.js`. Maqueta de la pantalla: `analisis/maqueta/estado-tensional.html`. La vista y el menú están **pendientes** (rama `els-estado-tensional`).

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
