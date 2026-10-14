# Resistencia al fuego (módulo Fuego) — decisiones

Construido el 11/10/2026. Entrada propia «Fuego» en el menú (entre ELS y Bielas y tirantes), sin sección de proyecto: se elige el tipo de elemento y el tiempo, y la pantalla da la dimensión mínima y la distancia mínima equivalente al eje de las armaduras.

## Fuentes (método de tablas, curva normalizada, R 30 … R 240)
- **EHE-08, Anejo 6, apartado 5** (texto.txt l.22935; tablas A.6.5.2 pilares, A.6.5.3.1/2 muros, A.6.5.5.2 vigas, A.6.5.6 losas macizas). EHE-98 se trata como EHE-08.
- **EC-2 2004+AN y EC-2 2023**: remiten a EN 1992-1-2 / prEN 1992-1-2. Desde el 11/10 está la **UNE-EN 1992-1-2** (analisis/normativa/ec2-fuego/) y se cita como «UNE-EN 1992-1-2, 5.x, Tabla 5.y»; las tablas coinciden con el **Anejo 20 del CE** (ver fuego-verificacion-tablas.md) (versión española de EN 1992-1-2), apartado 5 (ce-anejos/texto.txt l.31012-31960; tablas A20.5.2a pilares Método A, A20.5.3/4 muros, A20.5.5/6 vigas, A20.5.8 losas). Decisión de José Luis, 11/10. Es la única excepción en que el CE sirve de fuente fuera de durabilidad.
- El EC-2 2023 remite a prEN 1992-1-2 (no disponible): se avisa en pantalla.

## Alcance de la primera versión
Pilar, muro (portante y no portante), viga (simple/continua en CE) y losa maciza. Entradas: elemento, caras expuestas, ηfi (solo CE), tiempo, árido silíceo/calizo. Salida: combinaciones b/a (o h/a, e/a), espesor del alma, condiciones que acompañan a la tabla.
- Árido calizo: −10 % en vigas y losas (EHE-08: dimensión y a_min; CE: solo la dimensión) y en muros no portantes; pilares y muros portantes no admiten reducción.
- Pilares con Método A (ηfi) o Método B (n y ω, tabla 5.2b, añadido el 11/10; «(1)» = ancho > 600 mm, sin valor).
- Fuera de esta versión: tirantes, vigas en doble T continuas (A20.5.7), forjados nervados y losas planas, isoterma 500, valores de ηfi y μfi calculados, hormigones de alta resistencia (EHE-08 fck 50–80: incrementos; CE apartado 6).
- Sin cambios en la corrección Δa_si ni en el cálculo de a_m: la pantalla da los mínimos, no comprueba una sección.

## Código
`src/norma/fuego.js` (tablas y `fuego()`), `src/ui/vistas/fuego.js`, claves `fu.*` y `f.*` en i18n, `tests/fuego.test.js`, pantalla incluida en `tools/encaje.mjs`.
Valores transcritos a mano del texto: revisar contra el PDF/BOE antes de dar por cerrado.

## Pantalla (12/10, a petición de José Luis)
- Cada selector con su título en una línea y los botones debajo, a todo el ancho de la columna (clase `.fu-campo`).
- Esquema sin escala de la sección en la tarjeta central (`src/ui/dibujoFuego.js`): cara o caras expuestas en rojo con la etiqueta «Fuego», armadura, losa protectora en vigas y cotas b/h/e y a_min con los valores de la primera combinación. Pendiente de pasar por el hilo de diseño (pertenece a la guía de estilo § dibujos).

## Segunda vuelta de pantalla (12/10)
- Pilar: caras expuestas «Más de una» / «Una» (la UNE-EN distingue solo eso); EHE-08 sin selector (su tabla es para tres o cuatro caras). No se hace 4/3/2/1 porque la norma no distingue.
- Muro: 1 o 2 caras; viga: 3 caras (losa más gruesa y ancha arriba en el dibujo) o 4 caras (canto ≥ b_min y área ≥ 2·b_min², calculados con la combinación 1).
- Dibujos: muro y losa en tramo de 1 m con líneas de rotura; viga con cota a_sd = a + 10 mm.
- Métodos de pilar con nombre claro («Con η_fi», «Con n y ω») y filas desplegables «¿Qué son?» que explican η_fi, n y ω.
