# Fisuración: decisiones y estado (01/11/2026)

Detalle del estudio y del plan: `analisis/fisuracion-plan.md`. Maqueta: `analisis/maqueta/fisuracion.html`. Auditoría de diseño: `analisis/auditoria-fisuracion-maqueta.md`.

## Decidido por Pepiño
- Secciones: Rec viga/pilar y T primero; quizá genéricas después. Armadura mínima y de piel fuera. Sin pretensado ni tension stiffening. σs con el motor de Estado tensional (por hacer: hoy `core/fisuracion.js` resuelve la sección rectangular por sí mismo).
- Cápsula estándar Comprobación | Dimensionamiento | Diagrama. Diagrama: wk frente a M (N constante) con wmáx, Mfis y las tres normas superpuestas.
- EC-2 2023: wk en superficie (k1/r) incluido, sin aviso extra de «no vigente» (ya sale en rojo al elegir la norma). MC90 descartado.

- 04/11/2026: wk y wmáx con **2 decimales** (guía § 1, `MAG.wk`). Línea de wmáx en el Diagrama en **tinta fuerte**, no en rojo.

## Motor (rama `fisuracion-motor`)
- `src/core/fisuracion.js` (sección rectangular fisurada, una capa inferior y opcional superior; wk de las tres normas; dimensionamiento por diámetros) y `src/norma/fisuracion/limites.js` (wmáx por clase).
- `tests/fisuracion.test.js`: caso de referencia con cálculo independiente en forma cerrada (V-1 300×500, 3Ø20, M = 80 kN·m): wk = 0,214 (EHE-08), 0,165 (EC-2 2004 + AN), 0,169 (EC-2 2023); equilibrio con axil; monotonía; β; kb; 7.14; límites; dimensionamiento.
- Hipótesis propias a confirmar con José Luis: Ac,ef de la EHE-08 = b·mín{h/2; ay + 7,5φ} (la figura 49.2.4.b no se lee bien en el texto); fctm,fl en Mfis; EC-2 2023 con wmáx = 0,3 mm sin ksurf (lado seguro); en tracción simple, dividir Nk entre las dos caras (`fisuracion.pas` l. 1009 y 1017 dudaba).
- Pendiente: casos de EHE.exe del 3.1 si José Luis los aporta; secciones genéricas y circulares.

## Vista real (05/11/2026, rama `fisuracion-motor`)
- `src/ui/vistas/fisuracion.js`, `src/ui/dibujoFisuracion.js`, `src/i18n/fisuracion.{es,en}.js`; menú ELS ▸ Fisuración (entre Estado tensional y Flechas; la entrada «Flechas y fisuración» pasa a «Flechas»). Entrada en `tools/encaje.mjs` (6 pantallas).
- Secciones: Rec viga, T (M positivo y negativo) y pilar rectangular. Las barras por franjas de área no valen: se pide usar barras en Secciones.
- `src/core/fisuracionSeccion.js`: x, σs, σsr y ε1 salen del motor de Estado tensional con ley lineal, γC = αcc = γS = 1 (el estado fisurado, forzado con `estadoTensional(mod, dato, { fisurada: true })`; con axil, continuación desde N = 0 si Newton no converge). Reproduce V-1 en las tres normas. `wkNorma` (en `fisuracion.js`) recibe el estado ya resuelto.
- Armadura traccionada del cálculo: primer lecho (barras a menos de ø de la capa más próxima a la cara traccionada); ø equivalente Σnø²/Σnø; separación = mayor hueco entre barras del lecho; Ac,ef integra el ancho real de la sección (T) hasta h_ef desde la cara traccionada. Lechos posteriores no cuentan para ρ.
- Dimensionamiento: una capa de barras iguales a la misma distancia ay, para cada ø de 12 a 32 mm, el menor n con wk ≤ wmáx según la norma del proyecto, separación libre ≥ máx(ø, 20 mm). Marcado el ø con menos acero.
- wmáx: clase de exposición de la norma del proyecto (por defecto IIa en EHE-08, XC3 en EC-2) con el valor editable; la misma wmáx se aplica a las tres columnas de la tabla. Acción directa/indirecta solo EHE-08 y adherencia solo EC-2 2023: apagadas con (i) donde no aplican.
- Pendiente de confirmar con Pepiño/José Luis: la clase de exposición por defecto no se lee todavía de Durabilidad; ε2 de k1 (EHE-08) = 0 salvo toda la sección en tracción.
