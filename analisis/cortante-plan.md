# Cortante: estudio del Prontuario 3.1 y plan para los tres programas (EHE-08, EC-2 2004+AN, EC-2 2023)

Estado (14/10/2026; creado 13/10): estudio y plan, con las decisiones de José Luis del 14/10 incorporadas; **no se ha tocado el código de la app y no hay commit** (decisión de José Luis). Solo este documento.

Marcas en cada afirmación:
- **[3.1]**: lo hace el código original (`TT1.pas`, `TT2.pas`, `TT5.pas` de `C:\PORTABILIDAD\…\Version 3.1`, leído línea a línea).
- **[norma + artículo]**: sale del texto de la norma, con la línea de `analisis/normativa/<norma>/texto.txt` (`l.N`). Si el texto extraído tiene fórmulas ilegibles, se dice y la fórmula se da por el conocimiento de la norma, **marcada «verificar»**.
- **[propuesta]**: decisión de diseño mía, pendiente de José Luis.

Unidades de este documento: MPa, mm, kN, salvo que se diga otra cosa. (El 3.1 trabaja en kN y m.)

---

## Decisiones de José Luis (14/10/2026) y su efecto en el plan

Respuestas a las preguntas 1-5 del §9 y dos instrucciones nuevas:

1. **Una sola pantalla «Cortante» que cambia con la norma**, aunque la diferencia sea grande (coherencia con el resto del programa). Tres núcleos de cálculo por dentro (§5.1).
2. **Se aplica el tope `fyd ≤ 400 MPa`** en las armaduras transversales (§4, tabla maestra, fila fyα,d). Queda por decidir solo si también en EC-2 (el plan lo proponía solo para EHE-08; ver pregunta 2b).
3. **`M_Ed` es opcional.** Sin él se usa el método simplificado y se avisa de lo que no se comprueba.
4. **`V_Ed` lo introduce el usuario**, que es responsable de que sea el valor relevante (a un canto útil del apoyo, etc.). No se enlaza con Vigas por ahora.
5. **`ρl` y `A_sl` salen de la sección y se pueden cambiar en el módulo**, sin modificar la sección, igual que en Flexión (la armadura de cálculo se guarda en el cálculo, no en la sección).
6. **EC-2 2023 «en esfuerzos, como toda la vida»**: se traduce la formulación de tensiones a fuerzas (apartado A). La pantalla y los resultados hablan de `V_Rd` en kN, nunca de `τ`.
7. **Secciones admitidas**: rectangular de viga y T, **con pregunta M+/M−** para elegir la armadura longitudinal relevante (como Flexión simple), y **sección circular como novedad** (apartado B). (Queda por confirmar si Rec pilar sigue entrando; ver pregunta 7.)


### Respuestas del 14/10 (segunda tanda)
- **2b**: EC-2 **sin tope de 400 MPa** (la norma no lo exige; bastante penaliza ya no contar Vcu). Tope solo en EHE-08.
- **16**: lo que exige la norma va por defecto: **cercos circulares ×0,85 activo por defecto en EHE-08**; en EC-2 2023 se aplica `bw/Dh`; en EC-2 2004+AN sin reducción.
- **5 (ajuste)**: `ρl` se **topa** en 20 ‰ (no solo se avisa); si el valor de la sección es mayor, se usa 20 ‰ y se informa.
- **6**: el acero de los cercos se pregunta (selector propio).
- **7**: se admiten pilares (Rec pilar y circular); `ρl` editable con **cero por defecto** como en todas las secciones.
- **8**: cotθ con ángulo al lado y botón «cotθ óptimo» (recomendación aceptada).
- **9**: **este módulo es solo cortante.** Alas-alma, rasante en juntas, torsión e interacción cortante+torsión, en módulos posteriores (las fases 5-7 de §7 salen de este alcance).
- **10**: EC-2 2023 **simplificado** (ν = 0,5); desplegables que expliquen `ddg`, `γV`, `acs`/`av`, clase de ductilidad y demás datos nuevos.
- **11**: `σ'cd` con armadura comprimida de la sección en pilares; 0 en vigas (recomendación aceptada).
- **12**: tabla de dimensionamiento con **Ø8 hasta Ø20**, separación máxima **300 mm (criterio propio, a documentar)**, **de 50 en 50 mm**.
- **14**: José Luis ejecutará los casos en `EHE.exe`: plantilla en `analisis/cortante/casos-ehe31.csv` (10 casos; columnas de entrada rellenas, columnas de resultado en blanco). Convención de signo del axil: la que pida la pantalla del 3.1; anotar cuál es.
- **15**: documento de decisiones `analisis/cortante-decisiones.md` al cerrar; hay que explicar las diferencias entre normas.
Nota de numeración: su «12» responde a la tabla de dimensionamiento (mi pregunta 13). **Pregunta 12 respondida el 14/10: se acepta el mínimo de Vcu de la EHE-08 (cambio oportuno de la norma).** Antes figuraba sin respuesta: (mínimo de Vcu de la EHE-08, que el 3.1 no tiene; ~10 % de diferencia con el 3.1 en algunos casos) y la 14 solo en cuanto a resultados.

### A. EC-2 2023 expresado en esfuerzos (z = 0,9d)
Multiplicando cada tensión de 8.2 por `bw·z` (con `z = 0,9d`, 8.18):

| Magnitud | Fuerza (kN) | Origen |
|---|---|---|
| Cortante omitible | `V_Rdc,min = τRdc,min·bw·z`, `τRdc,min = 11/γV·√(fck/fyd·ddg/d)` | 8.20 |
| Sin armadura | `V_Rd,c = τRd,c·bw·z ≥ V_Rdc,min`, `τRd,c = 0,66/γV·(100ρl·fck·ddg/d)^(1/3)` | 8.27 |
| Con `N_Ed`: `d → d·kvp` o `τRdc,0 − k1σcp` | `kvp = 1 + N_Ed/|V_Ed|·d/(3acs) ≥ 0,1`; con `M_Ed` opcional: `acs = |M_Ed/V_Ed| ≥ d`, `av = √(acs·d/4)` | 8.29-8.35 |
| Cercos (Asw/s en mm²/mm) | `V_Rd,s = (Asw/s)·z·fywd·cotθ` (α = 90°); inclinados `(Asw/s)·z·fywd·(cotθ+cotα)·senα` | 8.42 = `ρw·fywd·cotθ` × `bw·z`, con `ρw = Asw/(bw·s)`; 8.59 |
| Biela | `V_Rd,max = ν·fcd·bw·z/(cotθ + tanθ)`; inclinados: `ν·fcd·bw·z·(cotθ+cotα)/(1+cot²θ)` | 8.44 (ν = 0,5, 8.2.3(6)); 8.60 |
| Mínima | `Asw,min/s = ρw,min·bw·senα`, `ρw,min = 0,08√fck/fyk` (−10 % acero B, −20 % C) | 12.4 |
| Longitudinal | `N_Vd = V_Ed·cotθ` (inclinados `V_Ed(cotθ − cotα)`); `Ftd = M_Ed/z + (N_Vd + N_Ed)/2`; decalaje `al = z(cotθ − cotα)/2` | 8.50-8.52, 12.5 |
| Refinado (fase 4) | `ν(εx)` de 8.45 aplicado a la misma `V_Rd,max` | 8.45 |
| Máx. admisible | `V_Rd = min(V_Rd,s ; V_Rd,max)` | 8.2.3 |

Es la misma estructura de EHE-08 y EC-2 2004 (`V_Rd,c`, `V_Rd,s`, `V_Rd,max`), lo que simplifica la pantalla común: los tres núcleos devuelven **kN**. `γV`, `ddg` y `acs` son datos propios de la 2023.

### B. Sección circular (novedad respecto al 3.1) [propuesta]
Qué dicen las normas (texto extraído; **verificar**):
- **EHE-08** 44.2.3.2.2 (l.10117-10160): en secciones circulares a flexión, `d` puede tomarse `0,8·h` (h = diámetro); en cercos **circulares** `V_su × 0,85` (pérdida de eficacia por la inclinación de las ramas); el comentario extiende el 0,85 a cercos octogonales/hexagonales. 44.1: se puede asimilar a una sección ficticia rectangular que resista igual o menos.
- **EC-2 2023** 8.2.3(9) (l.5095-5110): `Asw` se multiplica por `bw/Dh` (`Dh` = diámetro del cerco); `z` sale de una sección inscrita (segmento circular `xsb` comprimido y barras de tracción dentro de `bw`); `bw` **se elige libremente** cumpliendo equilibrio y resistencia, sin superar `Dh`. En espirales, `αw` es el ángulo medio de las dos ramas si difieren menos de 12° de 90°.
- **EC-2 2004+AN**: 6.2 no da regla; se aplica la práctica de rectángulo equivalente.
- **ACI 318** (referencia que citas): `bw = D`, `d = 0,8·D`; `Av` = dos ramas del cerco (2·Ab), sin reducción.

Las tres cuestiones, con propuesta:
1. **Ancho efectivo `bw`**: campo editable. Mientras no me des tu valor, valor provisional **`bw = D`** (ACI; para EHE-08 con `d = 0,8D`). Para EC-2 2023 se avisa de que `bw ≤ Dh`. Alternativa geométrica: `bw = Dh` (diámetro del cerco).
2. **Canto útil `d` y brazo `z`** (José Luis, 14/10): `d = D/2 + (D/2 − r)·0,707`, con `r` el recubrimiento mecánico (centro de barras a borde); equivale a `d = h/2 + i_s`, con `i_s` el radio de giro de la armadura (EC-2 2023, 5.8.5, fig. 5.34), y es ≈ `0,85·D − 0,04 m`. Sustituye a `0,8·D`. Editable. `z = 0,9d` (EHE-08, EC-2 2004), con aviso en EC-2 2023 de que la norma pide `z` de sección inscrita.
3. **Cuantía longitudinal `ρl`**: `A_sl` = **la mitad de las barras** (las del lado traccionado respecto al eje de flexión), `ρl = A_sl/(bw·d) ≤ 0,02`, editable. Opción «todas las barras» para comparar. (Con `N_Ed` de compresión grande sería conservador; avisar.)
4. **Reducción por cercos sin rama recta**: **por defecto, ninguna** (como ACI: dos ramas de área `Ab` cada una, `Asw = 2·Ab`). Casilla «reducir» que aplica el factor de cada norma: **0,85 en EHE-08** y **`bw/Dh` en EC-2 2023**. **Conflicto a decidir**: en EHE-08 el 0,85 es articulado, no recomendación; con la casilla desactivada por defecto el programa podría dar un valor no conforme a la norma (se avisaría). Ver pregunta 16.
5. Aviso común: `V_Ed` en circular es el cortante total; el 0,85/EC-2 `bw/Dh` solo tiene sentido para cercos circulares, no para espirales con paso pequeño.

---

## 0. Resumen para decidir

1. **El cortante del 3.1 es EHE-98 (art. 44), y EHE-08 y EC-2 se parecen a él menos de lo que parece.** Con N = 0 y fck ≤ 60, la EHE-08 da prácticamente lo mismo que el 3.1, salvo dos cosas: añade un **mínimo** a la contribución del hormigón (Vcu, Vu2) y cambia varias reglas de detalle (K del axil, armadura mínima, separaciones, σ'cd neto de armadura comprimida). El **EC-2 2004+AN** tiene el mismo cálculo sin armadura, **pero con armadura el hormigón no aporta** (solo celosía) y la biela se calcula con `z` y `ν1`. El **EC-2 2023** cambia todo: tensiones, `ddg`, `γV = 1,4`, esbeltez de cortante `av`, `cotθ` de 1 a 2,5 y `ν = 0,5` (o variable con εx).
2. **Un detalle clave** (ver ejemplo §3): con `cotθ = 2`, la EHE-08 vale lo mismo que el EC-2 2004+AN (β = 0 y Vcu = 0, queda la misma celosía). Con `cotθ = 1`, la EHE-08 da casi el doble (176 kN frente a 98 kN en la viga de ejemplo) porque suma el hormigón. Es la diferencia práctica más importante para el usuario.
3. **Propuesta de arquitectura**: un único módulo de menú «Cortante» (ya hay hueco en `app.js`, grupo ELU), con **tres núcleos de cálculo** (`src/norma/cortante/ehe08.js`, `ec2-2004.js`, `ec2-2023.js`) que comparten un módulo común de celosía y dimensionamiento, y una sola pantalla de tres columnas cuyos campos cambian según la norma del proyecto. José Luis habla de «tres programas»: lo son por dentro; por fuera es una pantalla (pregunta 1).
4. **Orden**: EHE-08 (puerto casi directo del 3.1 y validación contra `EHE.exe`) → EC-2 2004+AN (variante simple del anterior) → EC-2 2023 (modelo nuevo) → después alas-alma, rasante en juntas, torsión y refinamientos.
5. **preguntas abiertas** (§9; las 1-5 ya respondidas, quedan las 6-15 y la 16 nueva).

---

## 1. Qué hacía el Prontuario 3.1

### 1.1 Módulos relacionados

| Módulo 3.1 | Qué calcula | Norma |
|---|---|---|
| **TT1** Cortante | Comprobación y dimensionamiento de rectangular y T (Rec1, T) y pilar rectangular (Rec2) | EHE-98 art. 44 [3.1] (el manual de ayuda lo dice: «Artículo 44.º de la Instrucción EHE») |
| **TT2** Torsión | Comprobación y dimensionamiento de rectangular (Rec1, Rec2) | EHE-98 art. 45 [3.1] |
| **TT5** Rasante en juntas | Junta entre hormigones | EHE-98 art. 47 [3.1] |
| `VigasContinuas`, `analisis` | Esfuerzos V(x), M(x) | independiente de la norma |

No hay interacción cortante + torsión en el código [3.1]: la ayuda de TT2 solo dice que «el ángulo de biela debe ser idéntico al de la comprobación a cortante en la misma sección», y el usuario lo cuida a mano. Tampoco hay rasante alas-alma, decalaje de la ley de momentos, pretensado ni cortante en forjados.

### 1.2 TT1 paso a paso (`TT1.pas`)

**Datos que toma de la sección** (`ObtenerParametros`, l.360-415):
- Rec1 y T: `Aslong = Ainf`, `d = h − rinf`, `z = 0,90·d`, `b0 = min(b, b_sup de la primera parte)`, `ρ = Aslong/(b0·d)` **limitado en silencio a 0,02**. En T, `Ac = b0·d`.
- Rec2 (pilar): `b0 = b`, `d = y de la 2.ª parte`, `z = 0,9d`, `Aslong = 0` («suponemos que es un pilar con toda la sección comprimida»), o sea **ρ = 0**. Un comentario del autor admite que falla con pilar de 1 capa.
- `fck = fk del hormigón`, `fcd = fk/γ` (sin α = 0,85: «sin cansancio»), `fyd = min(fyk/γs, 400 MPa)` con el comentario «limitación artículo 40.2» (`RecopilaDatosComprobacion`, l.568-575).
- `fctm = 0,30·fck^(2/3)`.
- Todo se puede editar en pantalla: ρ (‰), b0, d, z.

**Datos de usuario**: θ (26°-63°, regla de 1°, por defecto 45°) y su `cotθ` (rango 0,5-2,0), α de los cercos (45°-90°, por defecto 90°), cercos Ø 6/8/10/12, separación `s` (m), nº de ramas (solo 2 o 4), `Nd` (kN) y `σy` (tensión vertical, MPa) con `σx = Nd/Ac`. Opción «Sin armadura de cortante». Casilla «la armadura transversal evita el pandeo de la armadura comprimida» (con Ø de las barras comprimidas 12-32).

**Axil y ángulo de fisuras** (`Calculasigmacd`, `CalculaTetae`, l.670-740): con `σx` (del axil) y `σy`, calcula
`cotθe = √(fctm² − fctm·(σx+σy) + σx·σy) / (fctm − σy)`, limitado a [0,5; 2,0], y `θe = arctg(1/cotθe)`. Es el «método simplificado» de la EHE (con fctm). Si θe sale fuera de 26,56°-63,44° da error. Internamente **tracción positiva** (la pantalla muestra compresión positiva).

**Fórmulas** (`HallarVu1`, `HallarVu2`, l.441-480):
- `K = 1,6667·(1 + σcd/fcd)`, acotado a [0, 1] (con σcd = tensión del axil, tracción +; compresión grande lo reduce).
- `Vu1 = K·0,60·fcd·b0·d·(cotθ + cotα)/(1 + cot²θ)`. **0,60·fcd fijo** (sin la reducción para fck > 60).
- Sin armadura transversal: `Vcu = (120·ξ·(0,1·ρ·fck)^(1/3) − 0,15·σcd)·b0·d`, con `ξ = 1 + √(0,2/d)` (d en m), mínimo 0; `Vu2 = Vcu`. **Sin tope de ξ ≤ 2 ni mínimo.**
- Con armadura: `Vcu = (100·ξ·(0,1·ρ·fck)^(1/3) − 0,15·σcd)·b0·d·β` (0,10 en vez de 0,12), `Vsu = z·sinα·(cotα + cotθ)·Aα·fyd`, `Vu2 = Vcu + Vsu`.
  `β = (2cotθ − 1)/(2cotθe − 1)` si `0,5 ≤ cotθ < cotθe`; `β = (cotθ − 2)/(cotθe − 2)` si no.
- `Aα = π·Ø²·n/4 / s`.
- Armadura mínima: `Aα,min = 0,02·fcd·b0·sinα/fyd`.
- Truco del código: en dimensionamiento fija `Astrans = 1e-5` solo para que `HallarVu2` use el 0,10 en vez del 0,12.

**Comprobación (`BotonCalcularClick`, caso 1)**: si `s > 0,80·d` y hay armadura, lo rechaza («compruebe como pieza sin armadura»). `Vu = min(Vu1, Vu2)`. Calcula `s_max` según `Vrd` frente a `Vu1`: ≤ 0,2·Vu1 → min(0,8d; 300 mm); ≤ 2/3·Vu1 → min(0,6d; 300); si no → min(0,3d; 200). Si hay armadura de compresión la limita a 15·Ø, 300 mm y min(b, h). Si `s > s_max`, avisa y **rebaja Vu** a `min(0,2·Vu1, Vu2)` o `min(0,667·Vu1, Vu2)`; si `s > 300 mm`, otro aviso. Avisa si `Aα < Aα,min`.

**Dimensionamiento (caso 0)**: pide `Vd`. Rechaza si `Vd > Vu1`. Calcula `Astrans = (Vd − Vcu)/(z·sinα·(cotα + cotθ)·fyd)`, la sube a la mínima si hace falta (rótulo «Cuantía mínima») y propone una tabla de **4 diámetros (6, 8, 10, 12) × separaciones {30, 25, 20, 15, 10 cm}**: para cada Ø, el primer `s` con `A ≥ Astrans` y `s ≤ s_max`; **2 ramas si b0 < 0,50 m, 4 ramas si no** (la ayuda: «doble cerco para secciones anchas»). Muestra s, nº de ramas, A, tipo, Vsu y Vu2 de cada opción.

**Código muerto/curiosidades**: `Hallastfis` (separación por tensión de la armadura, umbrales 50/75/100/150) se calcula pero nunca se muestra; `VTipos`, `Vstfis` no salen en la tabla. `Vcu` del dimensionamiento usa el último `A` probado. El rótulo azul «Label_mensaje_sutil» indica que Vu se ha limitado por separación.

### 1.3 TT2 (torsión) en una línea cada fórmula
`Tu1 = α·0,60·fcd·Ae·he·cotθ/(1+cot²θ)` (α = 1,20 o 1,50 según el tipo de cercos), `Tu2 = 2·Ae·At·fyd·cotθ`, `Tu3 = 2·Ae·Al·fyd·tanθ/ue`; `he` entre A/u y el mínimo 2c, `Ae = (b−he)(h−he)`, `ue = 2[(b−he)+(h−he)]`. Misma regla de `s_max` con `ue/8`. Dimensionamiento: `At = Td/(2Ae·fyd·cotθ)`, `Al = Td·ue/(2Ae·fyd·tanθ)`. Solo rectangulares.

### 1.4 TT5 (rasante en juntas) [3.1]
`Rmu = (β·fct,d + Ast·fyd·(μ·sinα + cosα)/(L·p) + μ·σcd)·p·L ≤ 0,25·fcd·L·p`; `fct,d = 0,21·fck^(2/3)/γc`; rugosidad baja (β 0,2; μ 0,6) o alta (β 0,4; μ 0,9); `Ast` solo cuenta si `≥ 0,38·L·p/fyd`; con N de tracción, β = 0. Es la formulación de la EHE-98 y **no es la de la EHE-08 art. 47** (§4.9).

---

## 2. Qué dice cada norma (cortante en elementos lineales)

Referencias: **EHE-08** `ehe-08/texto.txt`; **EC-2 2004** `ec2-2004-an/texto.txt` (AN desde l.9436); **EC-2 2023** `ec2-2023/texto.txt`.

### 2.1 Tabla maestra

| Tema | 3.1 (EHE-98) | EHE-08 (art. 44) | EC-2 2004 + AN (6.2) | EC-2 2023 (8.2) |
|---|---|---|---|---|
| Esquema de comprobación | `Vrd ≤ Vu1` y `Vrd ≤ Vu2` | Ídem: Vu1 en el borde del apoyo, Vu2 a un canto útil del borde (44.2.3, l.9788-9800). Bielas y tirantes para regiones D (44.1, l.9674) | `VEd ≤ VRd,c` (sin armadura) o `VEd ≤ VRd = min(VRd,s; VRd,max)`; no hace falta comprobar a menos de `d` del apoyo con carga repartida (6.2.1(8), l.3880); VRd,max sí en el apoyo | En tensiones `τEd = VEd/(bw·z)`, `z = 0,9d` (8.2.1(3), l.4717). Omitir si `τEd ≤ τRdc,min`; sin armadura si `τEd ≤ τRd,c`; si no, armadura (8.2.1(1), l.4700-4712) |
| Cálculo del cortante `Vrd/VEd` | `Vd` | `Vrd = Vd + Vpd + Vcd` (pretensado y cordones inclinados) (44.2.2, l.9778) | `VEd` con pretensado; cordones inclinados `VEd − Vccd − Vtd` (6.2.1(6)) | Igual, figura 8.4 (8.2.1(7), (8)) |
| **Sin armadura** | `Vcu = [0,12·ξ·(100ρl·fck)^(1/3) − 0,15σ]·b0·d`, sin tope de ξ ni mínimo | `Vu2 = [0,18/γc·ξ·(100ρl·fcv)^(1/3) + 0,15σ'cd]·b0·d`; **mínimo** `[0,075/γc·ξ^(3/2)·fcv^(1/2) + 0,15σ'cd]·b0·d`; `ξ = 1+√(200/d) ≤ 2`; `fcv = fck ≤ 60` (15 con control indirecto); `ρl ≤ 0,02` (44.2.3.2.1.2, l.10064-10090; fórmulas ilegibles en el texto, **verificar**) | `VRd,c = [CRd,c·k·(100ρl·fck)^(1/3) + k1·σcp]·bw·d ≥ (νmin + k1σcp)·bw·d`; `CRd,c = 0,18/γc`, `k1 = 0,15`, `k = 1+√(200/d) ≤ 2`; **AN: νmin = 0,075/γc·k^(3/2)·fck^(1/2), fck ≤ 60** (CEN: 0,035) (6.2.2(1) l.3895-3910; AN l.10093) | `τRd,c = 0,66/γV·(100ρl·fck·ddg/d)^(1/3) ≥ τRdc,min = 11/γV·√(fck/fyd·ddg/d)` (8.27, 8.20); `VRd,c = τRd,c·bw·z`. **Sin k de tamaño.** `ddg = 16 + Dlower ≤ 40` (fck ≤ 60) (8.2.1(4) l.4737-4766; 8.2.2(2) l.4844) |
| Axil en sección sin armadura | σ del axil (tracción +) en la fórmula | `σ'cd = (Nd − A's·fyd)/Ac` (compresión +; resta la armadura comprimida) con límite `≤ 0,30fcd` (**verificar**, texto ilegible); no aplica límite en sección no fisurada | `σcp = NEd/Ac < 0,2fcd` | Reduce `d` con `kvp = 1 + NEd/|VEd|·d/(3·acs) ≥ 0,1` (8.31, l.4877), o alternativa `τRd,c = τRdc,0 − k1·σcp` (8.32-8.35) |
| Efecto de la esbeltez de cortante | no | no | Cargas a `0,5d ≤ av ≤ 2d` del apoyo: reducción `β = av/2d` (6.2.2(6), 6.2.3(8)) | `av = √(acs·d/4)` si `acs = |M/V| < 4d`, con `acs ≥ d` (8.29-8.30): **pide MEd** |
| Sección no fisurada (Md ≤ Mfis,d) | no | `Vu2 = (I·b0/S)·√(fct,d² + αl·σ'cd·fct,d)` (44.2.3.2.1.1, l.9942-9990) | Solo pretensado de un vano (6.2.2(2), (6.4)) | — |
| **Biela comprimida** | `Vu1 = K·0,60fcd·b0·d·(cotθ+cotα)/(1+cot²θ)` | `Vu1 = K·f1cd·b0·d·(cotθ+cotα)/(1+cot²θ)`; `f1cd = 0,60fcd` (fck ≤ 60), `(0,90 − fck/200)·fcd ≥ 0,50fcd` por encima; **K** por tramos de σ'cd: 1 (sin axil de compresión), `1+σ'cd/fcd` hasta 0,25fcd, 1,25 hasta 0,50fcd, `2,5(1−σ'cd/fcd)` hasta fcd (44.2.3.1, l.9893-9936). Con θ = 45°, α = 90°, sin axil: `Vu1 = 0,30·fcd·b0·d` | `VRd,max = αcw·bw·z·ν1·fcd·(cotθ+cotα)/(1+cot²θ)` (6.9, 6.14); `z = 0,9d`; **AN: ν1 = 0,6(1−fck/250)**, o `0,6` (fck ≤ 60) / `0,9−fck/200 ≥ 0,5` si la tensión de cálculo del cercos es < 0,8·fyk; **αcw** = 1 (sin pretensado), `1+σcp/fcd` hasta 0,25fcd, 1,25 hasta 0,5fcd, `2,5(1−σcp/fcd)` hasta fcd (6.2.3(3) l.4030-4060; AN l.10127-10150; el texto del AN trae «2,5(1+σcp/fcd)», errata: usa el recomendado) | `σcd = τEd(cotθ+tanθ) ≤ ν·fcd`; **ν = 0,5** (8.44, 8.2.3(6)), o `ν = 1/(1,0 + 110(εx + (εx+0,001)cot²θ)) ≤ 1` si se usa el método refinado con εx (8.45, l.5043) |
| Ángulo de bielas θ | `0,5 ≤ cotθ ≤ 2,0` (26,6°-63,4°); el mismo θ en torsión | **`0,5 ≤ cotθ ≤ 2,0`** (44.2.3.1, l.9899-9915) | **AN: `0,5 ≤ cotθ ≤ 2,0`** (CEN: 1 a 2,5) (AN 6.2.3(2), l.10118) | **`1 ≤ cotθ ≤ cotθmin`**: 2,5 sin axil; hasta 3,0 con compresión grande (≥ 3 MPa, x < 0,25d); `2,5 − 0,1·NEd/|VEd| ≥ 1` con tracción; −20 % con acero clase A (8.41, l.5003-5013). Fuera de rango solo con ν(εx) (8.45) y acero B/C |
| **Con armadura** | `Vu2 = Vcu + Vsu` | `Vu2 = Vcu + Vsu`; `Vsu = z·Σ Aα·fyα,d·senα·(cotθ+cotα)`; `Vcu = [0,15/γc·ξ·(100ρl·fcv)^(1/3) + 0,15σ'cd]·b0·d·β` con **mínimo** `[0,075/γc·ξ^(3/2)·fcv^(1/2) + 0,15σ'cd]·b0·d·β`; fck hasta 100 con armadura; `z = 0,9d` en flexión simple (para flexocompresión, fórmula de 44.2.3.2.2); **×0,85 en cercos circulares** (44.2.3.2.2, l.10117-10270) | **Solo celosía, sin Vcu**: `VRd,s = (Asw/s)·z·fywd·cotθ` (6.8) o `(Asw/s)·z·fywd·(cotθ+cotα)·senα` (6.13) | **Solo celosía, sin τRd,c**: `τRd,sy = ρw·fywd·cotθ` (8.42) o `ρw·fywd·(cotθ+cotαw)·senαw` (8.59); `ρw = Asw/(bw·s)` |
| β y θe (aporte del hormigón en la EHE) | `β` según θ y `θe` simplificado | `β = (2cotθ−1)/(2cotθe−1)` si `0,5≤cotθ<cotθe`; `(cotθ−2)/(cotθe−2)` si `cotθe≤cotθ≤2`. **θe por dos métodos**: simplificado (el del 3.1, con fct,m y σxd, σyd) o **general**: `θe = 29° + 7·εx` (εx en ‰, ver fórmula de εx, **ilegible, verificar**; requiere Md, Nd, Vrd y As, Ap) (44.2.3.2.2, l.10170-10230) | no existe | no existe |
| fyα,d / fywd | `min(fyk/γs, 400)` | fyα,d (art. 40.2): el articulado de 40.2 obliga a **limitar la deformación del tirante** y los comentarios dan 400 MPa («se utiliza, por ejemplo, para la armadura transversal de cortante»); 45.3.1 y 47.2.2.2 lo fijan explícito a 400 (l.8330-8345, l.10991, l.11297). **Pregunta 2** | sin tope; pero `ν1 = 0,6` solo si σ < 0,8fyk, y con (6.10) `fywd → 0,8·fywk` (6.2.3(3) NOTA, l.4023) | `fywd`, sin tope |
| **Armadura mínima** | `Σ Aα·fyd/senα ≥ 0,02·fcd·b0` | `Σ Aα·fyα,d/senα ≥ (fct,m/7,5)·b0`; al menos 1/3 de la armadura necesaria en cercos a 90° (44.2.3.4.1, l.10423-10440) | **AN: `ρw,min = Asw/(s·bw·senα) ≥ fctm/(7,5·fyk)`** (CEN: 0,08√fck/fyk); `β3 = 0,33` (AN 9.2.2(4), (5), l.10380-10395). Se puede omitir en losas y dinteles menores (6.2.1(4)) | `ρw,min ≥ 0,08·√fck/fyk`, −10 % acero B, −20 % acero C (12.2(4), l.8180-8200); obligatoria en vigas isostáticas con d > 500 mm (8.2.1(2)); `ρw,stir ≥ 0,5·ρw,req` (Tabla 12.1 fila 8) |
| **Separación longitudinal** `st` | `0,8d/0,6d ≤ 300`; `0,3d ≤ 200` según Vd/Vu1 | `Vrd ≤ Vu1/5`: `0,75d(1+cotα) ≤ 600`; `≤ 2/3Vu1`: `0,60d(1+cotα) ≤ 450`; si no `0,30d(1+cotα) ≤ 300`; barras levantadas `≤ 0,60d(1+cotα)` (44.2.3.4.1, l.10360-10380) | **Igual que la EHE-08** con VRd,max (AN 9.2.2(6), (7), l.10400-10424) | `sl,max ≤ 0,75d(1+cotα)` (Tabla 12.1, sin escalones); si se incumple: factor `kns = 1 − s/(z·cotθ)` solo en evaluación de existentes (I.9) |
| Separación transversal de ramas | — | `st,trans ≤ d` y ≤ 500 mm (≤ 2d y ≤ 350 en edificación con h ≤ 30 cm) | `st,max ≤ d` y ≤ 500 (AN 9.2.2(8)) | `str,max ≤ 0,75d` y ≤ 600 (Tabla 12.1 fila 7) |
| Refuerzo longitudinal por cortante | `ΔT`, **no implementado en 3.1** | `ΔT = (Vrd − ½Vsu)·(cotθ − cotα)` [forma exacta ilegible, **verificar**]; equivale a decalar la ley de Md `sd = z/2·(…)`; con Vsu = 0, `sd = d` (44.2.3.4.2, l.10472-10520) | `ΔFtd = 0,5·VEd·(cotθ − cotα)`; `MEd/z + Ftd ≤ MEd,max/z` (6.2.3(7), l.4111); decalaje `al = d` sin armadura (6.2.2(5)) | `NVd = |VEd|·cotθ` repartido entre cordones: `Ftd = MEd/z + (NVd+NEd)/2`, `Fcd = MEd/z − (NVd+NEd)/2` (8.50-8.52, l.5074-5090); decalaje `al = z(cotθ − cotα)/2` (12.5), `al = d` sin armadura (12.6) |
| Cargas próximas al apoyo | — | 44.2.3.3 (cargas colgadas, comentarios) | 6.2.2(6), 6.2.3(8): reducción `β = av/2d` | 8.2.1(11), 8.2.2(1), (8), (9); fórmula (8.55) con `βincl` |
| Sección de ancho variable / hueca / vainas | `b0` mínimo en 3/4 d | `b0` = menor ancho en 3/4 d (44.1, figura 44.2.1.a); deduce vainas no inyectadas | `bw,nom = bw − 0,5Σφ` (vainas inyectadas) o `−1,2Σφ` (6.16-6.17) | `bw` mínimo entre cordón traccionado y fibra neutra; vainas `kduct` 0,5/0,8/1,2; circular: `Asw·bw/Dh` y z de sección inscrita (8.2.3(9), (10)) |
| Datos nuevos que exige la norma y el 3.1 no tiene | — | `fcv`, `A's` (comprimida), Md si θe general | — | **`Dlower`/`ddg`, `γV`, `acs = |M/V|`, clase de ductilidad (A/B/C)**, `εx` si refinado |

### 2.2 Coeficientes y valores concretos para validar
- `γc = 1,5`, `γs = 1,15` en las tres; **2023: `γV = 1,40`** (Tabla 4.3, l.2620-2630; 1,15 en accidental).
- `fcd`: EHE-08 y EC-2 2004+AN usan **αcc = 1** (decisión del hilo Materiales, 11/10); 2023: `ηcc·ktc = 0,85` por defecto (en la viga de ejemplo, 17 MPa en vez de 20).
- `fctm`: EHE-08 y EC-2 2004 `0,30·fck^(2/3)` hasta C50; el core ya lo tiene (`norma/normas.js`).

---

## 3. Ejemplo numérico comparado [propuesta, cálculo mío para ver magnitudes; no validado con programa]

Viga rectangular b = 300, d = 500 (z = 450), HA-30 (fck = 30), B 500 S, ρl = 1 %, sin axil, cercos Ø8 de 2 ramas a 200 mm (Asw/s = 0,503 mm²/mm, ρw = 1,68 ‰), α = 90°, árido 20 mm (ddg = 36). Script: `…/scratchpad/comp.py` (descartable; la prueba definitiva irá en `tests/cortante.test.js`).

**Sin armadura:**

| 3.1 (EHE-98) | EHE-08 | EC-2 2004+AN | EC-2 2023 |
|---|---|---|---|
| 91,3 kN | 91,3 kN (mínimo 85,7 no manda) | 91,3 kN | 82,3 kN (manda τRd,c; τRdc,min no) |

**Con armadura**, según `cotθ` (las celdas son resistencia total a cortante, kN; entre paréntesis lo que aporta el hormigón):

| cotθ | 3.1 (fyd ≤ 400) | EHE-08 con fyd = 400 | EHE-08 con fyd = 434,8 | EC-2 2004+AN (fywd = 434,8) | EC-2 2023 (τRd,sy·bw·z) |
|---|---|---|---|---|---|
| 1,0 | 90 + 76 = **167** | 90 + **85,7** (mínimo) = **176** | 98 + 85,7 = **184** | **98** | **98** |
| 1,5 | 136 + 38 = **174** | 136 + 43 = **179** | 148 + 43 = **190** | **148** | **148** |
| 2,0 | 181 + 0 = **181** | **181** | **197** | **197** | **197** |
| Biela (cotθ = 1) | Vu1 = 900 | Vu1 = 900 | — | VRd,max = 713 (ν1 = 0,528) / 810 (ν1 = 0,6) | 574 (ν = 0,5, fcd = 17) |

Lecturas: (a) el 3.1 y la EHE-08 difieren en ~9 kN por el mínimo de Vcu (con β = 1); (b) la elección de fyd (400 o 434,8) mueve ~5 %; (c) EC-2 2004+AN y 2023 coinciden en la celosía, la diferencia está en el rango de cotθ (2,0 frente a 2,5) y en que la biela de la 2023 es bastante menor (574 frente a 713-810); (d) con `cotθ = 2` EHE-08 (fyd = 434,8) = EC-2: el hormigón deja de aportar. Esto da un **caso de prueba cruzado** natural.

---

## 4. Diferencias que hay que marcar en cada norma (para el diseño)

### 4.1 EHE-08 respecto al 3.1
1. **Mínimo de Vcu/Vu2** (νmin·…): nuevo. Con β pequeño, el mínimo se multiplica por β (según el texto de 44.2.3.2.2).
2. **K por tramos** y `σ'cd = (Nd − A's·fyd)/Ac`, **compresión positiva** (el 3.1: `K = 5/3(1+σ/fcd)` en tracción positiva). Hay que decidir qué hace el 3.1 con σ de tracción (K = 1) y reescribir con compresión positiva (convención del Prontuario).
3. `f1cd` baja para fck > 60; `ξ ≤ 2`; `fcv ≤ 60` sin armadura, hasta 100 con armadura.
4. **Armadura mínima** `fct,m/7,5·b0` (era 0,02·fcd·b0); en C30: 0,89 ‰ frente a 1,00 ‰ del 3.1 (con fyd = 434,8 y 400 respectivamente).
5. **Separaciones** nuevas (600/450/300 mm con `(1+cotα)`) frente a (300/300/200 con 0,8/0,6/0,3·d); `st,trans ≤ d ≤ 500`.
6. **Cercos circulares ×0,85**; **θe general** con εx (necesita Md, As, Ap).
7. **Decalaje/ΔT** y **rasante alas-alma** (44.2.3.5), que el 3.1 no calculaba.
8. Sección no fisurada (Md ≤ Mfis,d, pretensado): fuera de alcance para HA (ver §6).

### 4.2 EC-2 2004 + AN respecto a la EHE-08
1. **Sin Vcu cuando hay armadura** (solo celosía): el módulo no calcula β ni θe.
2. Biela con `z = 0,9d` (≈ 10 % menos que la EHE) y `ν1`, `αcw`.
3. `νmin` y `ρw,min` del AN (formulas distintas a las de la EHE, aunque inspiradas).
4. Sin tope de 400 MPa (ν1 = 0,6 solo con σ < 0,8fyk).
5. Reducción de cortante por carga próxima al apoyo `β = av/2d`.
6. `Ftd = 0,5·VEd(cotθ − cotα)`; el AN no cambia nada de eso.

### 4.3 EC-2 2023 respecto al EC-2 2004
1. **Tensiones** y `bw·z`; `γV = 1,4`; `ddg` (dato nuevo de árido); sin tamaño k.
2. **`av = √(acs·d/4)`**: necesita MEd.
3. `cotθ` 1-2,5 (3,0 con axil); `ν = 0,5` o `ν(εx)` (método refinado, iterativo con acero en cordones).
4. `kvp`/`k1` para el axil.
5. Mínima `0,08√fck/fyk` (reducida con acero B/C), y ductilidad entra en `cotθmin`.
6. Armadura longitudinal por cortante con `NVd` repartido entre cordones (no `ΔFtd`).

### 4.4 Puntos del texto que hay que verificar (no se leen bien)
- EHE-08 44.2.3.2.1.2: tope de σ'cd (¿0,30fcd, 12 MPa?), forma del mínimo.
- EHE-08 44.2.3.2.2: fórmula de εx y de `ΔT`/decalaje `sd`, mínimo de Vcu multiplicado por β.
- EHE-08 47.2.2.1/47.2.2.2 y tabla 47.2.2.2: topes de τr,u (ver §6.3).
- EC-2 2004 AN 6.2.3(3): αcw del AN sale «2,5(1+σcp/fcd)»; se toma el recomendado `2,5(1−σcp/fcd)` (hay que confirmar con el BOE/PDF, que no está en el proyecto: solo hay texto).

---

## 5. Diseño propuesto

### 5.1 Estructura de código [propuesta]
```
src/norma/cortante/comun.js      celosía: z, Aα↔Asw/s, tabla de cercos, series de s, ξ, ddg, funciones de dimensionado genéricas
src/norma/cortante/ehe08.js      Vu1, Vcu, Vsu, β, θe (simplificado y general), mínimos, st, ΔT, tope fyd
src/norma/cortante/ec2-2004.js   VRd,c, VRd,s, VRd,max (ν1, αcw), ρw,min AN, sl, Ftd
src/norma/cortante/ec2-2023.js   τRd,c (ddg, γV, av, kvp), τRdc,min, τRd,sy, ν (0,5 / εx), ρw,min, Tabla 12.1, NVd
src/ui/vistas/cortante.js        pantalla (campos según norma)
src/ui/dibujoCortante.js         sección con cercos + esquema de celosía (θ, α, z)
src/i18n/cortante.es.js / .en.js (como anclaje.*.js)
tests/cortante.test.js           casos de la §7
tests/ref31/tt1.js               puerto literal de HallarVu1/HallarVu2/HallarAstransmin del 3.1 para comparar
```
El menú ya tiene `'cortante'` en el grupo ELU (`app.js` l.34, `menu.cortante` en `es.js` l.324), y `'rasante'`, `'torsion'`: solo hay que añadir la vista a `VISTAS`.

Interfaz común de cada núcleo (unidades MPa, mm, kN, como `norma/anclaje.js`):

```
comprobar(d)  → { sinArm:{VRdc, VRdcMin, minManda, …}, conArm:{cotTheta, VRdMax, VRds, Vcu?, VRd, aprov}, minima:{rhoWmin, ok}, sep:{slMax, ok, stTrans}, long:{dFtd, sd}, avisos[] }
dimensionar(d, VEd) → { AswSNec, AswSMin, tabla:[{phi, ramas, s, Asw/s, VRd}], cotThetaUsado, avisos[] }
rangos(d)     → { cotMin, cotMax, nu?, … }   // lo que la pantalla necesita para el deslizador de θ
```
`d` = {fck, fcd, fctm, γ…, bw, h, d, z, Asl, ρl, NEd, MEd?, VEd, cotθ, α, Asw/s, fywd, Ø, ramas, s, acero(clase), Dmax, …} (nombres de ejemplo).

### 5.2 Qué se reutiliza
| Pieza existente | Uso |
|---|---|
| `norma/normas.js` (`EHE08`, `EC2_2004`, `EC2_2023`: γ, fctm, `gammaV`, `fckMax`) | γc, γs, γV, fctm; se añaden `cortante:{…}` si hace falta |
| `core/materiales.js` (`hormigon`, `acero`, `resistenciaCalculo`) y `materialesSeccion` | fck, fcd, fyk, fyd; acero de cercos del proyecto |
| `io/proyecto.js::datosViga(p, s, signo)` | b, h, d (= h − rinf), Ainf/Asup traccionada según signo de M, trapecios (para bw), Ac. Hay que añadir `bw` (mínimo entre cordón traccionado y fibra neutra) |
| `core/armado.js`, `ui/formato.js::serieDiametros`, `ui/campos.js` (`campoNum`, `selector`, `segmentado`, `tabla`, `grupo`, `par`) | entrada de cercos, series de Ø (Ctrl+K), formato |
| `ui/vistas/anclaje.js` y `flexion.js` | patrón de pantalla de tres columnas, «Comprobar/Dimensionar», tabla por diámetros |
| `core/vigas.js::analizarViga` | opcional: enlazar V(x) y M(x) más adelante |
| `core/flexion.js::dimensionar` o `curvaMRd` | para MEd con ρl y z reales (opcional) |
| `ui/grafica.js`, `ui/dibujoSeccion.js` | dibujo de sección y cercos |
| Patrón de normas con pantallas distintas (`durabilidad.js`, `durabilidadEC2.js`, `durabilidadEHE08.js`) | alternativa (pregunta 1) |

### 5.3 Datos de entrada [propuesta]
Pantalla de tres columnas (datos | dibujo | resultados), según la guía de estilo del proyecto:

**Izquierda (datos):**
1. Sección (solo lectura, de Secciones): Rec viga, T, Rec pilar. `M+`/`M−` como en Flexión (define qué armadura es la traccionada).
2. Materiales: hormigón (HA-xx), acero longitudinal y **acero de cercos** (por defecto el mismo).
3. Esfuerzos: `V_Ed` (kN), `N_Ed` (kN, compresión +), `M_Ed` (kN·m; opcional salvo EC-2 2023 con av, ν(εx) y EHE-08 con θe general). Casilla «comprobación a un canto útil del apoyo» (solo informativa).
4. Armadura longitudinal traccionada: `A_sl` (de la sección) y `ρl` editable, con aviso si se limita a 0,02 (hoy es silencioso).
5. Armadura transversal: Ø, ramas (2, 3, 4, …), s, α (45°-90°); «sin armadura de cortante».
6. Ángulo: `cotθ` (deslizador por norma) y botón «cotθ óptimo»; 2023: `D_lower` y clase de ductilidad.
7. Pestaña **Dimensionamiento** (pide `V_Ed`, propone Ø × s como en el 3.1).

**Centro:** dibujo de la sección con cercos y esquema de celosía (bielas a θ, cercos a α, brazo z).

**Derecha (resultados):** un cartel grande «V_Rd = … kN · aprovechamiento V_Ed/V_Rd = …» (con el modo que manda: biela o armadura o hormigón) y desplegables: Biela (Vu1, VRd,max), Armadura (Vsu, Vcu, β, θe), Mínimas y separaciones, Armadura longitudinal (ΔT, decalaje), Notas y referencias.

### 5.4 Salidas y avisos (de las normas)
Avisos que debe dar: V_Ed > Vu1 (no cumple, hay que cambiar sección), cuantía < mínima, s > s_max, st,trans > límite, fyd > 400 (EHE-08), fck > 60 sin armadura, ρl > 0,02 limitado, cotθ fuera de rango, `σcp > 0,2fcd` (EC-2), 2023 `d > 500` en viga isostática sin armadura mínima, `Nvd` que obliga a más armadura longitudinal.

---

## 6. Alcance, rasante, torsión (qué entra y cuándo)

### 6.1 Entra en este módulo (fases 1-4)
Viga rectangular y T (y pilar rectangular con axil) con y sin armadura, comprobación y dimensionamiento, mínimas, separaciones, armadura longitudinal adicional (decalaje).

### 6.2 Rasante alas-alma (nuevo respecto al 3.1) — fase 5
- EHE-08 44.2.3.5 (l.10517-10620): `S = ΔFd/(ar·…)`; `Su1 = 0,5·f1cd·h0·d`-tipo biela (alas en tracción `f1cd = 0,40fcd`); `Su2 = Ap·fyp,d`. Fórmulas **ilegibles**, verificar.
- EC-2 2004 6.2.4 (l.4130-4172): `vEd = ΔFd/(hf·Δx)`, `Asf/sf ≥ vEd·hf/(fyd·cotθf)`, `vEd ≤ ν·fcd·senθf·cosθf`; AN: `1 ≤ cotθf ≤ 2` (comprimida) y `1 ≤ cotθf ≤ 1,25` (traccionada); `k = 0,4` (AN 6.2.4(6)).
- EC-2 2023 8.2.5 (l.5232-5298): cotθf hasta 3,0 en alas comprimidas; mínimo (8.66).
Propuesta: dentro de la pantalla de Cortante para sección T, en una pestaña/plegable «Alas».

### 6.3 Rasante en juntas entre hormigones (sustituye a TT5; es otro módulo del menú «Rasante en juntas…») — fase 6
La EHE-08 art. 47 (l.11459-11675) **no es la fórmula del 3.1/TT5**:
- Sin armadura: `τr,u = β(1,30 − 0,30·fck/25)·fct,d` con un tope superior que el texto no deja leer, β = 0,2 / 0,4 / 0,8 (superficie baja / alta / cola de milano) (47.2.1). *Verificar.*
- Con armadura: dos estados por `2,5·β(1,30−0,30fck/25)fct,d` y `μ` de la Tabla 47.2.2.2 (0,6/0,9 y 0,3/0,6); `Ast/(s·p) ≥ 0,001`; `fyα,d ≤ 400`; 45° ≤ α ≤ 135° (47.2.2.1-47.2.2.2). *Verificar.*
- EC-2 2004 6.2.5 (l.4172-4233): `vRdi = c·fctd + μ·σn + ρ·fyd(μ·senα + cosα) ≤ 0,5·ν·fcd`; c, μ por rugosidad (muy lisa 0,025-0,10 / 0,5; lisa 0,20 / 0,6; rugosa 0,40 / 0,7; dentada 0,50 / 0,9).
- EC-2 2023 8.2.6 (l.5299-5456): Tabla 8.2 (cv1, μv, cv2, kv, kdowel), `τRdi = cv1·√fck/γc + μv·σn + ρi·fyd(μv·senα+cosα) ≤ 0,30fcd + ρi·fyd·cosα` (8.76), y (8.77) sin anclaje completo; paso de armadura por «escalones» de 2d.
Conclusión: TT5 hay que rehacerlo por norma, no portar.

### 6.4 Torsión y cortante + torsión (módulo «Torsión», TT2) — fase 7
- EHE-08 art. 45 (l.10671-11052): `Tu1, Tu2, Tu3` como el 3.1; **interacción torsión + otros esfuerzos** en 45.3 (l.10936-11050): método general (σcd ≤ α·f1cd, armaduras longitudinales de torsión y flexión por separado y sumadas) y métodos simplificados (45.3.2); θ **único** para cortante y torsión.
- EC-2 2004 6.3 (l.4234-4340): `TRd,max`, `Asl`, interacción **`TEd/TRd,max + VEd/VRd,max ≤ 1`** (6.29) y sección maciza solo con mínimas si `TEd/TRd,c + VEd/VRd,c ≤ 1` (6.31).
- EC-2 2023 8.3 (l.5457-5600): `τt,Rd` (8.82-8.84); interacción lineal `Σ SEd/SRd ≤ 1` (8.86); con ν de Anexo G.
Propuesta: en la pantalla de Cortante, cuando el usuario introduce un `T_Ed`, las comprobaciones se hacen conjuntas con la interacción de cada norma; hasta entonces TT2 se reconstruye como módulo propio con el mismo θ. **Pregunta 9.**

### 6.5 Fuera de alcance (por ahora)
Pretensado (Vpd, σ'cd por pretensado, αl), forjados (viguetas, losas alveolares, celosías), sección circular (EHE-08: d = 0,8h; ×0,85 cercos; EC-2 2023: bw/Dh y z de sección inscrita), punzonamiento (TT3, módulo aparte), cortante con bielas y tirantes (art. 40/24).

---

## 7. Orden de implementación y pruebas

| Fase | Contenido | Pruebas |
|---|---|---|
| 0 | Acuerdos §9; `datosViga` con `bw`, `ρl`, `Asl` | — |
| 1 | **EHE-08**: Vu1, Vcu, Vsu, β/θe simplificado, mínimos, st, ΔT; comprobar y dimensionar; tabla Ø×s | (a) puerto del 3.1 (`tests/ref31/tt1.js`) para N = 0 y fck ≤ 50: Vu1, Vsu, β idénticos; Vcu difiere solo por el mínimo. (b) 5-6 casos ejecutados por José Luis en `EHE.exe` (pedirlos; ver pregunta 14) |
| 2 | **EC-2 2004 + AN**: sin armadura, VRd,s, VRd,max (ν1, αcw), ρw,min AN, sl, Ftd, β = av/2d | (a) caso cruzado EHE-08 `cotθ = 2` = EC-2; (b) ejemplo de la §3; (c) comparar con el ejemplo de `comparativa-ehe98-ec2-2004-2023.md` §4 (viga 30×50, 162/98/197 kN) |
| 3 | **EC-2 2023** simplificado: τRd,c con ddg y γV, τRdc,min, kvp, av, τRd,sy, ν = 0,5, ρw,min, Tabla 12.1, NVd | Ejemplo de la §3 (82,3 kN sin armadura; 98/148/197 kN con armadura); tabla del §4 del documento de comparación (losa d=170: 133 kN; viga 30×d50 ρ=1 %: 77 kN; viga 40×d100: 164 kN) |
| 4 | Refinamientos: EHE-08 θe general (εx), EC-2 2023 ν(εx) y `cotθ < 1`, carga cerca de apoyos, bw variable | Casos de la norma / de libros; coherencia con el método simplificado |
| 5 | Rasante alas-alma (T) | Ejemplos de la norma / libros |
| 6 | Rasante en juntas (módulo propio) | Casos por tablas de las normas |
| 7 | Torsión + interacción | Casos de TT2 del 3.1 (N = 0, θ = 45°) para EHE-08 |

Los tests siguen el estilo de `tests/anclaje.test.js` (`node --test`, valores con tolerancia).

---

## 8. Convenciones del Prontuario que afectan (de la memoria del proyecto)
- Compresión positiva en toda la app (el 3.1 usaba tracción positiva dentro de `TT1`): hay que convertir los signos del 3.1 al portar K, σ, β.
- Unidades en cabecera de tabla; punto decimal en pantalla; sin scroll de página; un solo cartel grande de resultado.
- Norma por defecto EC-2 2004+AN; EHE-08 y EC-2 2023 con el nombre en rojo (no vigentes); EHE-98 se migra a EHE-08, así que **el 3.1 no es una opción de cálculo, solo una referencia de validación**.
- Código Estructural: solo recubrimientos/durabilidad (decisión 11/10). En cortante no se usa el CE.

---

## 9. Preguntas abiertas para José Luis (recomendación en negrita)

**Respondidas el 14/10: 1 (una pantalla), 2 (tope 400), 3 (MEd opcional), 4 (V lo introduce el usuario), 5 (ρl y Asl de la sección, editables en el módulo).** Pregunta 2b nueva: ¿el tope de 400 MPa también en EC-2 (el EC-2 no lo exige; ver §4)? *Recomiendo no, pero con ν1 = 0,6 solo si σ < 0,8fyk.* Pregunta 16 nueva: ¿en circulares, el 0,85 de EHE-08 va activo por defecto (la norma lo exige) o sigue «sin reducción» como ACI? *Recomiendo activo por defecto solo en EHE-08.*

Las cinco primeras bloquean el arranque.

1. **¿Un programa o tres?** Por dentro hay tres núcleos. Por fuera, **una pantalla «Cortante» cuyos campos y resultados cambian con la norma del proyecto** (comparte columnas, cartel y tabla de cercos; como Anclaje), o **tres pantallas** distintas como Durabilidad (más código, mensajes más claros por norma). *Recomiendo una pantalla.*
2. **fywd ≤ 400 MPa en EHE-08** (el 3.1 lo aplicaba): *recomiendo aplicarlo en EHE-08 (con aviso y casilla) y no en EC-2*; en EC-2 con σ < 0,8·fyk se usa ν1 = 0,6 y, si no, ν1 = 0,6(1−fck/250). ¿Estás de acuerdo?
3. **¿Se introduce MEd?** Lo exigen: EC-2 2023 para `av` (cortante cerca del apoyo) y ν(εx); EHE-08 para θe general; EC-2 para ΔFtd/decalaje. *Recomiendo `M_Ed` opcional: sin él se usa el método simplificado y se avisa de lo que no se comprueba.*
4. **Cortante de cálculo**: ¿lo escribe el usuario ya reducido a un canto útil del apoyo, o se enlaza con el módulo de Vigas (V(x), M(x))? *Recomiendo que lo escriba; enlace más adelante.*
5. **Dónde sale ρl y Asl**: de la sección (armadura traccionada según M+/M−, como Flexión), editable. *Recomiendo así, con aviso si ρl > 0,02.*
6. **Acero de cercos**: ¿selector propio (puede ser B 400 S o B 500 S distinto del longitudinal)? *Recomiendo sí, por defecto el mismo.*
7. **Secciones**: ¿Rec viga, T y Rec pilar como el 3.1? (en pilar, ρl = 0 es dudoso; *recomiendo ρl editable*). Circular en fase posterior.
8. **Ángulo**: ¿deslizador en grados como el 3.1 o en cotθ? *Recomiendo cotθ con el ángulo mostrado al lado y botón «cotθ óptimo»*, con rangos propios de cada norma.
9. **Torsión y rasante**: *alas-alma dentro de Cortante (fase 5); rasante en juntas y torsión como módulos propios después, con cada norma, y la interacción cortante+torsión en la pantalla de Cortante.* ¿Vale el orden?
10. **EC-2 2023**: datos por defecto: `D_lower = 20 mm` (ddg = 36), clase de ductilidad B, `γV = 1,4`. ¿Los dejamos así? ¿Quieres desde el principio el método refinado ν(εx) o solo el simplificado (ν = 0,5)? *Recomiendo simplificado primero.*
11. **EHE-08, σ'cd con armadura comprimida** (`Nd − A's·fyd`): ¿pedimos A's o suponemos 0? *Recomiendo tomar la armadura comprimida de la sección en pilares y dejar 0 en vigas.*
12. **Mínimo de Vcu** (EHE-08): lo tomo como obligatorio (la norma lo exige); el 3.1 no lo tenía, así que habrá ~10 % de diferencia con el 3.1 en algunos casos. ¿Lo aceptas como diferencia documentada?
13. **Tabla de dimensionamiento**: ¿sigue siendo Ø6/8/10/12 × s = 10…30 cm con 2 o 4 ramas? Con las normas nuevas `s_max` llega a 600 mm. *Recomiendo series de Ø del proyecto (Ctrl+K) y s en múltiplos de 25 mm hasta el máximo, ramas 2/3/4 según ancho.*
14. **Validación con `EHE.exe`**: ¿puedes ejecutar 5-6 casos en el 3.1 y pasarme capturas (Vu1, Vcu, Vsu, Vu2, Astrans)? Propongo: (1) viga 30×50, HA-30, ρ = 1 %, 2R Ø8/20, θ = 45°; (2) igual con θ = 30°; (3) igual con θ = 63°; (4) sin armadura, ρ = 0,5 %; (5) con axil Nd = 300 kN de compresión; (6) con σy = 1 MPa.
15. **Fichero de ayuda y documentación**: ¿dónde vive la explicación por norma (como `flexion-decisiones.md`)? *Propongo `analisis/cortante-decisiones.md` al cerrar el plan.*

---

## 10. Lo que no se ha hecho en este estudio
- No se ejecutó `EHE.exe`; los números del 3.1 son los de mi emulación de las fórmulas de `TT1.pas`.
- No hay PDF de la EHE-08 en el proyecto (solo el texto extraído): las fórmulas ilegibles de §4.4 hay que cotejarlas con el BOE antes de codificar.
- No se ha leído la guía del CE ni el Anejo 19 para cortante (decisión de 11/10: el CE no se usa fuera de recubrimientos); si José Luis quiere ver cómo se hace en el CE, es un estudio aparte.
- No se ha estudiado `TT3` (punzonamiento), que merece su propio hilo.
