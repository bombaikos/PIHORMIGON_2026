# Módulo ELS ▸ Fisuración: estudio y plan (borrador para discutir)

Fecha: 01/11/2026. Estado: **solo estudio, nada codificado**. Hilo «Módulo Fisuración».

## 0. Lo que hacía el 3.1 (leído de `fisuracion.pas`, 1760 líneas, y el `.dfm`)
El módulo F1 tiene **dos paneles**:

**A. Panel «clásico» (EHE-98 art. 49)** — `SpeedButton3Click` (armado) y `SpeedButton2Click` (cálculo)
- Solo **sección rectangular**, hasta 10 capas de armado (nº de barras y separación vertical por capa), un solo diámetro (12–32), recubrimiento geométrico (avisa si es menor que el nominal por ambiente), clase de exposición heredada de la sección.
- Dos solicitaciones: **flexión simple** (Mk, k1 = 0,125) y **tracción simple** (Nk, k1 = 0,25, armado simétrico obligatorio).
- Ac,eficaz con los tres casos de la figura 49.2.4.b (s ≤ 15φ: h/2 o h/4 según h>b; s > 15φ: h/4 y ancho 15φ) y cuenta solo las capas dentro de esa zona.
- σs en servicio con la sección fisurada elástica por el motor (`curvu`, `determina_xm`, `Calcula_my`: material lineal frágil sin tracción); σsr con Mfis = fctm·Ix/(h−yg) sobre la sección homogeneizada. Si Mk < Mfis: «fisuración mínima», wk = 0.
- wk = 1,7·sm·εsm, con sm = 2c + 0,2s + 0,4·k1·φ·Ac,ef/As, εsm = σs/Es·[1−0,5(σsr/σs)²] ≥ 0,4σs/Es. Avisos «hipótesis fuera de modelo» si σs o σsr > fyk. Imprime informe.

**B. Panel «Hugo» (flexocompresión, sección Rec1 o T)** — `SpeedButton1Click`, etiquetado «EC-2 DRAFT / EC-2 LEGAL / EHE»
- Entradas: Nk (signo), Mk, As (superior), Ai (inferior), φ, s. Calcula Mu para Nk (avisa si Mk > Mu), **Mfis para Nk**, plano de deformaciones en fisuración y en servicio (ε, κ, x, σs, σc), avisos si el acero plastifica o σc > 0,4·fck. Dibuja plano de deformaciones y tensiones (hormigón y armaduras) en los dos instantes.
- Calcula **tres wk a la vez**: (1) «EC-2 draft»: sm = φ/(3,6ρef) acotado, εsm de tipo ENV; (2) «EC-2 legal» (ENV 1992): sm = 0,05 + 0,2·k1·φ/ρef, wk = 1,7·sm·εsm; (3) EHE con Ac,ef por casos y k1 = (ε1+ε2)/(8ε1).

**Defectos a no heredar (detectados al leer el código)**
- Mfis con **fctm** (0,3·fck^(2/3)), no fctm,fl: la EHE-08 (49.2.3 y 49.2.4) usa fctm,fl, que depende del canto.
- Es = 200 000 MPa y σs de la capa inferior fijos en el código; Ec/fctm/b0 se leen de etiquetas de pantalla.
- En la rama «EC-2 legal» `e2` no se inicializa (se calcula `eps2` y se usa `e2`): k1 queda indefinido.
- En tracción simple hay dudas anotadas en el código (comentarios «COÑO/COJONES» sobre si dividir por Asef o 2·Asef); el cálculo de σsr (Nfis/Asef) y el sentido de Acef/Asef doble no están contrastados.
- Ac,ef de la EHE por casos usa «h>b» para elegir el caso 1 o 2, y rinf+7,5φ como cota (no es lo del artículo, que usa 7,5φ desde el eje de la barra).
- Sin pretensado, sin armadura de compresión en el panel A, sin T en el A, sin límites wmáx ni veredicto Cumple/No cumple (solo da wk; el usuario compara con la tabla).
- Lógica mezclada con la interfaz (se calcula y se pinta en la misma rutina). Además, el motor `calcomun` es el que ya hemos reescrito en `estadoTensional.js`.

## 1. Qué dicen las normas (leído de los textos de `analisis/normativa/`)

### EHE-08, art. 49 (texto.txt l.11725–11990)
- Se comprueba solo si la fibra más traccionada supera fctm,fl (49.2.3). Con sección fisurada, comportamiento lineal y sin tracción del hormigón (49.1).
- wk = β·sm·εsm (49.2.4), β = 1,3 (solo acciones indirectas) o 1,7 (resto).
- sm = 2c + 0,2s + 0,4·k1·φ·Ac,eficaz/As; s ≤ 15φ; en vigas, s = b/n. k1 = (ε1+ε2)/(8ε1): 0,125 flexión simple, 0,25 tracción simple.
- εsm = σs/Es·[1 − k2·(σsr/σs)²] ≥ 0,4·σs/Es; k2 = 1,0 carga instantánea no repetida, 0,5 resto. σsr = tensión de la armadura en la sección fisurada cuando la fibra extrema llega a fctm,fl.
- Ac,eficaz: figura 49.2.4.b (tres casos según s y h).
- Límites: tabla 5.1.1.2 (I 0,4; IIa, IIb, H 0,3; IIIa, IIIb, IV, F, Qa 0,2; IIIc, Qb, Qc 0,1), cuasipermanente. Pretensado: frecuente y descompresión.
- Cortante y torsión: fisuración asegurada si se cumplen 44 y 45 (49.3, 49.4).

### EC-2 2004 + AN, §7.3 (texto.txt l.5281–5600; AN l.10283)
- wk = sr,máx·(εsm − εcm) (7.8). εsm − εcm = [σs − kt·fct,eff/ρp,eff·(1+αe·ρp,eff)]/Es ≥ 0,6·σs/Es (7.9); kt = 0,6 corta, 0,4 larga.
- sr,máx = k3·c + k1·k2·k4·φ/ρp,eff (7.11), con AN k3 = 3,4 y k4 = 0,425; k1 = 0,8 (corrugada); k2 = 0,5 flexión, (ε1+ε2)/(2ε1) en general (7.13). Si las barras están separadas más de 5(c+φ/2): sr,máx = 1,3(h−x) (7.14). Ac,eff con hc,ef = mín{2,5(h−d); (h−x)/3; h/2}.
- Límites: Tabla AN/9 (X0, XC1 0,4; XC1 interior, XC2–XC4, XF1, XF3 0,3; XS1, XS2, XD, XF2, XF4, XA1 0,2; XS3, XA2, XA3 0,1).
- 7.3.2: As,mín·σs = kc·k·fct,eff·Act (7.1), con kc (7.2) y k según canto. 7.3.3: tablas 7.2N (φ máx.) y 7.3N (separación máx.) con σs, correcciones (7.6N). Armadura de piel si h ≥ 1000 mm.

### EC-2 2023, §9.2 (texto.txt l.6362–6760; resumen en `ec2-2023-revision.md` §5)
- wk,cal = kw·k1/r·sr,m,cal·(εsm − εcm) (9.8), **en la superficie**: k1/r = (h−x)/(h−ay−x) (9.9). kw = 1,7.
- εsm − εcm (9.11) con kt = 0,6 / 0,4 según fase (formación de fisuras vs estabilizada) y mínimo (1−kt)σs/Es; para deformaciones impuestas coaccionadas en borde, (9.13) con Rax.
- sr,m,cal = 1,5c + kfl·kb/7,2·φ/ρp,eff ≤ 1,3/kw·(h−x) (9.15); kfl (9.16/9.17), kb 0,9 buena / 1,2 mala adherencia. hc,eff: figura 9.3.
- Límites: tablas 9.1 (aspecto) y 9.2 (durabilidad, 0,3·ksurf). Mínima 9.2.2. Anejo S: método simplificado (aún por leer).
- Ojo: el AN español aplica a la 2004; para la 2023 no hay AN, y la norma no está vigente (nombre en rojo).

## 2. Qué ya tiene el repositorio
- `src/core/estadoTensional.js` (motor de la sección fisurada: x, σs, ε1/ε2, estado fisurado/sin fisurar, leyes de servicio) y su vista: base natural para σs y la profundidad de la neutra de cualquier sección.
- `core/propiedades.js`: fctm, Ecm. `core/flexion.js`: `propuestaArmado` ya usa el wk de la EHE-98 (revisar/retirar).
- Durabilidad por norma en Secciones: da la clase de exposición → wmáx automático.
- Menú: el grupo ELS ya existe (`app.js`: `estadoTensional`, `flechas`); Fisuración sería la tercera vista. Flechas aún no existe (comparte Mfis, Ifis y tension stiffening).

## 3. Propuesta de módulo (para discutir)

**Cápsula de modo** (como Flexión): *Comprobación* | *Dimensionamiento* | *Diagrama*.

**Datos (izquierda)**: selector de Sección; norma (ya global); clase de exposición (de la sección, editable) → wmáx; solicitación de servicio M y N (combinación cuasipermanente; opción de dar también la característica para la limitación de σs); duración de la carga (kt / k2); tipo de acción (directa/indirecta, solo EHE-08 β); adherencia (kb, EC-2 2023).

**Dibujo (centro)**: la sección con Ac,eficaz sombreada, neutra x, plano de deformaciones y las cotas c, s, hc,eff. Reutiliza el dibujo del Estado tensional.

**Resultados (derecha)**: cartel único con wk frente a wmáx (Cumple / No cumple); debajo σs, x, sr,máx (sm), εsm−εcm, Mfis, ρp,eff, y avisos (sección sin fisurar → no hace falta; separación > 5(c+φ/2); sección en T; PR).

### Mejoras respecto al 3.1
1. **Unifica los dos paneles del 3.1** (clásico y Hugo) en uno solo con N y M (el clásico era un caso particular: N=0 o N de tracción), con σs y σsr calculados por el motor de Estado tensional, para cualquier sección y armadura en capas o puntos.
2. **Las tres normas a la vez**, como ya hacía el panel de Hugo pero con las normas vigentes: EHE-08 | EC-2 2004+AN | EC-2 2023 con el mismo (N, M) (sustituye a EHE-98/ENV/MC90, que se descartan).
3. **wmáx automático** desde la clase de exposición de la sección y veredicto Cumple / No cumple (el 3.1 solo daba wk).
   Además: fctm,fl en Mfis, Ac,ef según el artículo, y los avisos del 3.1 que sí valen (σs > fyk, σc > 0,4 fck / límites del 7.2, M > Mu, sección sin fisurar → wk = 0).
4. **Armadura mínima** (7.3.2 / 9.2.2 / EHE-08 art. 42.3 si procede) y armadura de piel como comprobaciones adicionales.
5. **Dimensionamiento**: dado wmáx, σs máximo admisible; φ y separación máximos (7.2N/7.3N, Anejo S) o M máximo que cumple; **propuesta de armado** que cumpla (sustituye a `propuestaArmado` con EHE-98).
6. **Diagrama**: wk frente a M (o σs) con la línea de wmáx, el punto de fisuración (Mfis) y el cambio sin fisurar/fisurado.
7. Armadura en capas con diámetros mezclados (φeq, 7.12 / 9.19), barras en grupos y 2 caras (piezas con dos caras traccionadas, k1/r 9.10).

## 4. Decisiones de Pepiño (01/11/2026)
1. Secciones: Rec viga/pilar y T primero; quizá genéricas después.
2. Armadura mínima y de piel: fuera del módulo.
3. Pretensado: fuera por ahora.
4. Tension stiffening: fuera por ahora (σs con el motor de Estado tensional).
5. EC-2 2023: wk en superficie (k1/r) incluido; sin avisos extra de «no vigente» (ya sale en rojo al elegir la norma).
6. MC90: descartado (ni aparece en `fisuracion.pas`). Comparativa solo entre las tres normas actuales.
7. Cápsula estándar Comprobación | Dimensionamiento | Diagrama. Diagrama aprobado: wk frente a M (N constante) con wmáx y Mfis, tres normas superpuestas.
Pendiente de comprobar: tracción simple, σs/σsr con Asef frente a 2·Asef (fisuracion.pas l.1009 y 1017).

## 5. Siguiente paso
1. Con tus respuestas, maqueta de la vista (artefacto) antes de programar.
3. Rama `fisuracion` desde `main`; motor en `src/core/fisuracion.js` + `src/norma/fisuracion/{ehe08,ec2_2004,ec2_2023}.js`, tests con casos de ejemplo trabajados a mano y los del 3.1.
