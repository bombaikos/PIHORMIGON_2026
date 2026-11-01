# Fisuración: decisiones y estado (01/11/2026)

Detalle del estudio y del plan: `analisis/fisuracion-plan.md`. Maqueta: `analisis/maqueta/fisuracion.html`. Auditoría de diseño: `analisis/auditoria-fisuracion-maqueta.md`.

## Decidido por Pepiño
- Secciones: Rec viga/pilar y T primero; quizá genéricas después. Armadura mínima y de piel fuera. Sin pretensado ni tension stiffening. σs con el motor de Estado tensional (por hacer: hoy `core/fisuracion.js` resuelve la sección rectangular por sí mismo).
- Cápsula estándar Comprobación | Dimensionamiento | Diagrama. Diagrama: wk frente a M (N constante) con wmáx, Mfis y las tres normas superpuestas.
- EC-2 2023: wk en superficie (k1/r) incluido, sin aviso extra de «no vigente» (ya sale en rojo al elegir la norma). MC90 descartado.

## Motor (rama `fisuracion-motor`)
- `src/core/fisuracion.js` (sección rectangular fisurada, una capa inferior y opcional superior; wk de las tres normas; dimensionamiento por diámetros) y `src/norma/fisuracion/limites.js` (wmáx por clase).
- `tests/fisuracion.test.js`: caso de referencia con cálculo independiente en forma cerrada (V-1 300×500, 3Ø20, M = 80 kN·m): wk = 0,214 (EHE-08), 0,165 (EC-2 2004 + AN), 0,169 (EC-2 2023); equilibrio con axil; monotonía; β; kb; 7.14; límites; dimensionamiento.
- Hipótesis propias a confirmar con José Luis: Ac,ef de la EHE-08 = b·mín{h/2; ay + 7,5φ} (la figura 49.2.4.b no se lee bien en el texto); fctm,fl en Mfis; EC-2 2023 con wmáx = 0,3 mm sin ksurf (lado seguro); en tracción simple, dividir Nk entre las dos caras (`fisuracion.pas` l. 1009 y 1017 dudaba).
- Pendiente: vista, i18n, tabla `MAG` (wk), entrada en `tools/encaje.mjs`, paso de σs al motor de Estado tensional (secciones T y genéricas), casos de EHE.exe del 3.1 si José Luis los aporta.
