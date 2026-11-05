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

## 05/11/2026 (tarde): fct, armadura mínima y figura
- **fct por norma** (Pepiño): EHE-08 usa fct,m,fl para decidir si fisura y para σsr (49.2.3, 49.2.4). EC-2 2004 + AN (7.1(2)) y EC-2 2023 (9.1(2)-(3)): **fctm para todo** (umbral de no fisura y εsm − εcm). `fisuraSeccion` calcula Mfis por norma (`MfisNorma`); `Mfis` es el de la norma del proyecto. σsr solo existe en la EHE-08.
- **Armadura mínima** de control de fisuración, aviso ámbar si la dispuesta (barras traccionadas) no llega: EHE-08 mínima mecánica de flexión (42.3.2, la de Flexión); EC-2 2004 7.3.2 (kc·k·fct,eff·Act/fyk; el ala traccionada de una T no se comprueba); EC-2 2023 9.2.2 (9.2 y 9.4, kh de 9.5, Ac del alma o del ala). Módulo `src/core/armaduraMinFisuracion.js`. Pendiente de confirmar: parte de la T que se toma como alma en el EC-2 2023 (bw × (h − hf)) y N repartido entre partes.
- **Figura (opción A)**: sección con las dos fibras neutras; planos de deformación y σs para Mfis(Nk) + Nk y Mk + Nk. Convenio del estado tensional: compresión azul, tracción rayado gris en el plano (nada en la sección). Tensiones sin decimales. Deformación media con 2 decimales. Desplegables solo con la norma activa. «Capa» (no «lecho») para la armadura.
