# EHE-98, EC-2 de 2004 (con el Anejo Nacional español) y EC-2 de 2023

Comparación orientada al prontuario: qué cambia en cada módulo al pasar de EHE-98 (la base del
Prontuario 3.1) a cada versión del Eurocódigo 2.

**Fuentes**
- **EC2-2004 + AN**: UNE-EN 1992-1-1:2013, versión corregida de marzo de 2020. Es la EN 1992-1-1:2004 + AC:2010 e incluye el **Anejo Nacional español** (Comisión Permanente del Hormigón, 2015). Texto en `/mnt/project-files/uploads/hearth/20a48f6d-9986-4997-85f4-cc698687c49e`. Donde el AN cambia el valor recomendado por CEN se indican los dos.
- **EC2-2023**: EN 1992-1-1:2023, sin Anejo Nacional. Análisis detallado en [ec2-2023-revision.md](ec2-2023-revision.md).
- **EHE-98**: no tengo el texto de la instrucción. Las fórmulas de cortante, punzonamiento, fisuración y cuantías salen del **código del Prontuario 3.1** (`TT1.pas`, `TT3.pas`, `fisuracion.pas`, `varios.pas`, leídos en la carpeta del dispositivo) y de su port (`src/core/flexion.js`). Lo marcado "(memoria)" no está comprobado contra el texto de la EHE-98.

Unidades: MPa, mm, kN. Ejemplos con HA-25 / C25/30, B500S, γC = 1,5 y γS = 1,15.

---

## 0. Resumen

| Tema | EHE-98 → EC2-2004 + AN | EC2-2004 → EC2-2023 |
|---|---|---|
| fcd | 0,85 (en el diagrama) → αcc = 1,00 (AN; de 0,85 a 1 si la carga permanente supera el 80 %) | αcc pasa a ηcc·ktc; ktc = 0,85 salvo cargas tardías |
| Diagrama σ-ε del hormigón | Igual hasta C50. Hasta C90 cambian εc2, εcu2 y n | Vuelve a ser fijo (2 ‰ / 3,5 ‰ / n = 2) para todas las clases |
| εud del acero | 10 ‰ → 0,9·εuk, **pero ≤ 10 ‰ por el AN** | εuk/γS, o rama horizontal sin límite |
| Ecm | 8500·fcm^(1/3) → 22·(fcm/10)^0,3 GPa (un 15 % mayor) | 9500·fcm^(1/3) (un 3 % menor que en 2004) |
| Cortante sin armadura | **Misma fórmula** (0,18/γc = 0,12), con k ≤ 2 y νmin | Fórmula nueva en tensiones con ddg y γV = 1,4; sin factor de tamaño k |
| Cortante con armadura | Vcu + Vsu → **solo armadura** (celosía de θ variable) y fywd sin tope de 400 | Igual concepto, cotθ hasta 2,5–3,0 y ν = 0,5 |
| Punzonamiento | Misma u1 a 2d y misma fórmula base | Perímetro a 0,5·dv, kpb y ddg; cambia todo el procedimiento |
| Mínima a flexión | Geométrica + mecánica → mecánica W·fctm,fl/(z·fyd) por el AN | MR,min(fyk) ≥ Mcr(fctm), sin mínima geométrica |
| Fisuración | wk = 1,7·sm·εsm → sr,max·(εsm − εcm) | kw·k1/r·sr,m,cal·(εsm − εcm), en la superficie |

**Conclusión práctica.** Con su Anejo Nacional, el EC2-2004 está muy cerca de la EHE-98: el cortante sin armadura, el punzonamiento sin armadura, las cuantías de pilares y el límite de 10 ‰ coinciden casi literalmente. Los cambios de fondo los trae la 2023, sobre todo en cortante y punzonamiento, como decías.

Inferido y no comprobado: el Código Estructural (RD 470/2021), que es la norma vigente hoy en España, sigue el esquema del EC2-2004 con decisiones nacionales parecidas a este AN. Si interesa como cuarta columna, habría que subir su texto.

---

## 1. Materiales

| | EHE-98 | EC2-2004 + AN | EC2-2023 |
|---|---|---|---|
| Clases | HA-20 a HA-50 (`fckMax: 50` en el código) | Hasta C90/105 (AN 3.1.2(2)) | C12/15 a C100/115 (Tabla 5.1) |
| γc / γs persistente | 1,5 / 1,15 | 1,5 / 1,15 (Tabla AN/1) | 1,5 / 1,15; γV = 1,4 (Tabla 4.3) |
| γc / γs accidental | — | 1,3 / 1,0 | 1,15 / 1,0 |
| fcd | fck/γc, con α = 0,85 aplicado en el diagrama | αcc·fck/γc (3.15); **αcc = 1,0 (AN)**, de 0,85 a 1 si la permanente es > 80 % | ηcc·ktc·fck/γC (5.3) |
| Resistencia a edad > 28 d | — | kt = 0,85 recomendado (AN: de 0,85 a 1, a criterio del autor) | tref de 28 a 91 d; ktc = 0,85 |
| fctm | 0,30·fck^(2/3) | igual hasta C50; 2,12·ln(1 + fcm/10) por encima | igual hasta C50; 1,1·fck^(1/3) por encima |
| fctm,fl | (el código EHE usa 0,37·fck^(2/3)) | max{(1,6 − h/1000)·fctm; fctm} (3.23) | igual (9.30), solo para flechas |
| Ecm (C25) | 8500·fcm^(1/3) = 27,3 GPa | 22·(fcm/10)^0,3 = 31,5 GPa | 9500·fcm^(1/3) = 30,5 GPa |
| εc2 / εcu / n | 2 ‰ / 3,5 ‰ / 2 | igual ≤ C50; por encima, εc2 = 2 + 0,085(fck − 50)^0,53, εcu2 = 2,6 + 35[(90 − fck)/100]^4, n = 1,4 + 23,4[(90 − fck)/100]^4 (Tabla 3.1) | 2 ‰ / 3,5 ‰ / 2 para **todas** las clases (8.4) |
| Bloque rectangular | 0,8x con 0,85·fcd (memoria) | λ = 0,8 y η = 1 hasta C50, menores por encima (3.19–3.22); −10 % si el ancho decrece hacia la fibra comprimida | Figura 8.2d |
| fyk máx. | B500S | 500 MPa (AN 3.2.2(3)) | B400 a B700 (Tabla 5.4) |
| εud | 10 ‰ (rama horizontal) | (a) inclinada hasta εud, o (b) horizontal sin límite (3.2.7). **AN: εud = 0,9·εuk (o εuk) y en ningún caso más de 10 ‰** | (a) inclinada hasta εuk/γS (A 21,7, B 43,5, C 65,2 ‰), o (b) horizontal sin límite (5.2.4) |
| Excentricidad mínima | h/20 ≥ 2 cm (memoria) | e0 = h/30 ≥ 20 mm (6.1(4)) | h/30 ≥ 20 mm (8.1) |

**fcd de cálculo (MPa)**

| fck | EHE-98 (0,85·fcd) | EC2-2004 AN, αcc = 1 | EC2-2004 AN, αcc = 0,85 | EC2-2023, ktc = 1 | EC2-2023, ktc = 0,85 |
|---|---|---|---|---|---|
| 25 | 14,17 | 16,67 | 14,17 | 16,67 | 14,17 |
| 40 | 22,67 | 26,67 | 22,67 | 26,67 | 22,67 |
| 50 | 28,33 | 33,33 | 28,33 | 30,94 | 26,30 |

**Consecuencia para el motor.** La opción EC2-2004 + AN cabe en el motor actual sin cambios de estructura: εud = 10 ‰ como en la EHE, el mismo diagrama hasta C50 y solo cambian αcc y Ecm. Para clases por encima de C50 hay que generar el diagrama con εc2, εcu2 y n de la Tabla 3.1. El generador de `materiales.js` ya admite `epsC2(fck)` y `epsCu(fck)`, pero tiene el exponente 2 fijo.

## 2. ELU de flexión
- Las hipótesis son idénticas en las tres normas: secciones planas, adherencia, sin tracción y diagramas de cálculo.
- **Dominios.** Con EHE-98 y con EC2-2004 + AN el pivote A está en 10 ‰, así que los dominios del prontuario valen tal cual. Con EC2-2023 y rama horizontal no hay pivote A: el agotamiento siempre lo marca εcu, y para conservar los dominios hay que adoptar εud = εuk/γS (ver la revisión de la 2023).
- **Compresión centrada.** Con EHE-98 y con 2004 la deformación media se limita a εc2 (6.1(5)); en la 2023 hay que comprobarlo en la Figura 8.1.
- **Momento límite / x máxima.** Ninguna de las dos versiones del EC-2 lo impone en flexión simple. En la 2004 solo aparece en redistribución (5.5(4): δ ≥ k1 + k2·xu/d; el AN adopta k1 = 0,44 y k2 = 1,25(0,6 + 0,0014/εcu2)) y en la 2023 en 7.3.2. El criterio de `momentoLimite` (acero en εy) es de proyecto, no normativo, en las tres.

## 3. Cuantías mínimas y máximas

### Vigas (armadura de tracción)
| | Expresión | b = 0,30, h = 0,50, d = 0,45 m |
|---|---|---|
| EHE-98 | geométrica (2,8 ‰ B500 / 3,3 ‰ B400 de Ac) y mecánica As·fyd ≥ 0,04·Ac·fcd (W/h en general) | **4,20 cm²** (manda la geométrica) |
| EC2-2004 recomendado | 0,26·fctm/fyk·bt·d ≥ 0,0013·bt·d (9.1N) | 1,80 cm² |
| EC2-2004 **AN** | As,min = W·fctm,fl/(z·fyd), z = 0,8h | 2,03 cm² |
| EC2-2023 | MR,min (acero a fyk) ≥ Mcr (fctm) (12.1) | ≈ 1,5 cm² |
| Máxima | EHE: capacidad mecánica (criterio del programa) · 2004: **0,04·Ac** (AN = recomendado) · 2023: ninguna | |

La cuantía mínima geométrica de la EHE desaparece en las dos versiones del Eurocódigo. Las mínimas mecánicas por fisuración van aparte (§5).

### Pilares
| | Mínima | Máxima |
|---|---|---|
| EHE-98 | As·fyc,d ≥ 0,1·Nd (fyc,d ≤ 400) y 0,004·Ac | As·fyc,d ≤ fcd·Ac |
| EC2-2004 recomendado | max{0,1·NEd/fyd; 0,002·Ac} | 0,04·Ac |
| EC2-2004 **AN** | En cada cara 0,05·NEd/fyc,d (fyc,d ≤ 400 MPa); 0,1·NEd/fyd en compresión simple; además 0,004·Ac; Ø ≥ 12 mm | En cada cara 0,5·fcd·Ac/fyc,d |
| EC2-2023 | max{0,1·NEd/fyd; 0,002·Ac} (Tabla 12.3) | ninguna |

El AN mantiene casi literalmente las cuantías de pilares de la EHE.

### Muros (AN 9.6.2 y 9.6.3)
Vertical: 1,2 ‰ (B400) / 0,9 ‰ (B500) de Ac en la cara traccionada, y mecánica 0,04·Ac·fcd/fyd; 0,3 veces esa cantidad en la cara comprimida; máximo 0,04·Ac. Horizontal: 4 ‰ / 3,2 ‰, reducible a 2 ‰ en ciertos casos. La 2023 usa en su lugar 0,25·Ac·fctm/fyk por cara (Tabla 12.4).

### Cortante mínimo
| | Expresión | C25, B500 |
|---|---|---|
| EHE-98 | Σ Aα·fyα,d/sen α ≥ 0,02·fcd·b0 (`HallarAstransmin`) | ρw ≥ 0,77 ‰ (con fyd = 434,8) |
| EC2-2004 recomendado | 0,08·√fck/fyk | 0,80 ‰ |
| EC2-2004 **AN** | ρw,min = fctm/(7,5·fyk) | 0,68 ‰ |
| EC2-2023 | 0,08·√fck/fyk, −10 % con acero B y −20 % con acero C | 0,72 ‰ (acero B) |

## 4. Cortante (el cambio principal)

### Fórmulas
| | EHE-98 (TT1.pas) | EC2-2004 + AN | EC2-2023 |
|---|---|---|---|
| Sin armadura | Vu2 = [0,12·ξ·(100ρl·fck)^(1/3) − 0,15·σ'cd]·b0·d, ξ = 1 + √(200/d), ρl ≤ 0,02 | VRd,c = [0,18/γc·k·(100ρl·fck)^(1/3) + 0,15·σcp]·bw·d, k ≤ 2, ρl ≤ 0,02 (6.2a). **Mínimo** νmin = 0,075/γc·k^1,5·√fck (AN; CEN: 0,035) | τRd,c = 0,66/γV·(100ρl·fck·ddg/d)^(1/3) ≥ τRdc,min = 11/γV·√(fck/fyd·ddg/d), sobre bw·z con z = 0,9d (8.27, 8.20) |
| Con armadura | Vu2 = Vcu + Vsu, con Vcu = 0,10·ξ·(…)·β·b0·d (β según θ) y Vsu = z·senα·(cotα + cotθ)·Aα·fyα,d, fyα,d ≤ 400 | VRd,s = (Asw/s)·z·fywd·cotθ (6.8), **sin aporte del hormigón** | τRd,sy = ρw·fywd·cotθ (8.42), también sin aporte del hormigón |
| Biela | Vu1 = K·0,60·fcd·b0·d·(cotθ + cotα)/(1 + cot²θ) | VRd,max = αcw·bw·z·ν1·fcd/(cotθ + tanθ), ν1 = 0,6(1 − fck/250) (6.9) | τEd(cotθ + tanθ) ≤ ν·fcd, ν = 0,5 o según εx (8.44, 8.45) |
| Rango de θ | 0,5 ≤ cotθ ≤ 2,0 | **AN: 0,5 ≤ cotθ ≤ 2,0** (CEN: 1 a 2,5) | 1 ≤ cotθ ≤ 2,5 (3,0 con compresión; −20 % con acero A) |
| Separación de cercos | 0,8d / 0,6d ≤ 300 mm / 0,3d ≤ 200 mm según Vd/Vu1 | AN: 0,75d(1 + cotα) ≤ 600 / 0,6d(…) ≤ 450 / 0,3d(…) ≤ 300 mm según VEd/VRd,max | 0,75d(1 + cotα) (Tabla 12.1) |
| Datos nuevos | — | — | Dlower (ddg), γV, acs = M/V, clase de ductilidad |

### Comparación numérica sin armadura (C25, Dmáx = 20 mm, ddg = 36 mm, sin axil, pieza esbelta)
| Pieza | ρl | EHE-98 | EC2-2004 AN | EC2-2023 |
|---|---|---|---|---|
| Losa, d = 170 mm, por m | 0,5 % | 99 kN | 120 kN (manda νmin) | 133 kN (manda τRdc,min) |
| Losa, d = 250 mm, por m | 0,5 % | 132 | 163 | 161 |
| Viga 30 × d 50 | 1 % | 86 | 86 | 77 |
| Viga 30 × d 50 | 2 % | 108 | 108 | 98 |
| Viga 40 × d 100 | 1 % | 203 | 203 | 164 |

Sin armadura transversal, el EC2-2004 + AN da lo mismo que la EHE-98 siempre que no mande el mínimo (0,18/1,5 = 0,12). La 2023 penaliza los cantos grandes (en d = 1 m da un 19 % menos) y favorece las losas delgadas con poca cuantía, por τRdc,min. Si la pieza no es esbelta (acs < 4d), la 2023 sube bastante por av.

### Comparación con armadura (viga 30 × d 50, C25, cercos 2Ø8 a 20 cm = 5,03 cm²/m, ρl = 1 %)
| | Hipótesis | VRd |
|---|---|---|
| EHE-98 | θ = 45°: Vsu = 0,45·5,03·40 = 90,5 kN + Vcu ≈ 72 kN | ≈ 162 kN |
| EC2-2004 AN | cotθ = 1: VRd,s = 0,45·5,03·43,5 = 98 kN | 98 kN |
| EC2-2004 AN | cotθ = 2 (máximo del AN) | 197 kN (biela 486 kN) |
| EC2-2023 | cotθ = 2,5: τ = 1,68 ‰·434,8·2,5 = 1,82 MPa; biela 5,3 ≤ 8,3 MPa | 246 kN |

La diferencia viene sobre todo de la inclinación de la biela y del tope de 400 MPa de la EHE en fyα,d, no de la armadura en sí. El módulo TT1 tiene que admitir la elección de θ con los rangos de cada norma.

## 5. Punzonamiento

| | EHE-98 (TT3.pas) | EC2-2004 + AN | EC2-2023 |
|---|---|---|---|
| Perímetro crítico | u1 a **2d**; interior 2(c1 + c2) + 4πd | u1 a **2d** (6.4.2) | b0,5 a **0,5·dv** (8.4.2) |
| Excentricidad | β = 1,15 / 1,4 / 1,5 (interior / borde / esquina) | β igual con los valores aproximados (Fig. 6.21N) o fórmula (6.39) | βe = 1,15 / 1,4 / 1,5 o refinado 1 + 1,1·eb/bb (Tabla 8.3) |
| Sin armadura | τrd = 0,12·ξ·(100ρl·fck)^(1/3) | vRd,c = 0,18/γc·k·(100ρl·fck)^(1/3) + 0,1σcp ≥ νmin; ρl = √(ρly·ρlz) en el ancho c + 3d a cada lado (6.47) | τRd,c = 0,6/γV·kpb·(100ρl·fck·ddg/dv)^(1/3) ≤ 0,5/γV·√fck; kpb = 3,6·√(1 − b0/b0,5) entre 1 y 2,5; ρl en el ancho bs (8.94) |
| Máximo junto al soporte | Fsd,ef ≤ 0,30·fcd·u0·d | vEd ≤ vRd,max = **0,5·ν·fcd** en u0 (AN) | τRd,max = ηsys·τRd,c, ηsys = 0,70 + 0,63(b0/dv)^(1/4) pernos / 0,50 + … cercos (8.109–8.111) |
| Con armadura | Vcu (0,10·ξ…) + Vsu, bielas a 45° | vRd,cs = 0,75·vRd,c + 1,5(d/sr)·Asw·fywd,ef·senα/(u1·d), fywd,ef = 250 + 0,25d ≤ fywd (6.52) | τRd,cs = ηc·τRd,c + ηs·ρw·fywd ≥ ρw·fywd (8.104) |
| Perímetro exterior | un,ef con 0,12·ξ… | uout,ef = β·VEd/(vRd,c·d); última fila a ≤ **k·d = 2d** dentro (AN; CEN 1,5d) | b0,5,out = b0,5·(dv/dv,out·1/ηc)² (8.112) |
| Datos nuevos | — | — | Dlower, b0, luces (ap ≈ 0,22L), tipo de armadura (pernos o cercos) |

### Comparación sin armadura (pilar interior cuadrado, C25, ddg = 36 mm, β = 1,15)
| Pilar / losa | ρl | EHE-98 | EC2-2004 AN | EC2-2023 (dv) | EC2-2023 (apd con L) |
|---|---|---|---|---|---|
| 30 × 30, d = 200, L = 5 m | 0,8 % | 421 kN | 457 kN | 441 kN | 469 kN |
| 30 × 30, d = 250, L = 6 m | 1,0 % | 627 | 627 | 642 | 688 |
| 40 × 40, d = 300, L = 7 m | 1,0 % | 893 | 893 | 899 | 968 |
| 50 × 50, d = 400, L = 8 m | 1,2 % | 1556 | 1556 | 1512 | 1670 |

Sin armadura, los resultados globales son parecidos (±5 %) aunque el modelo es otro. Las diferencias reales aparecen con armadura de punzonamiento (fórmula y máximo distintos) y en soportes grandes o de borde, donde el perímetro 0,5·dv y el límite de 3·dv por lado (8.4.2(3)) cambian mucho el resultado. El módulo TT3 hay que reescribirlo para la 2023; para 2004 + AN basta cambiar los coeficientes y añadir νmin, fywd,ef y k = 2.

## 6. Fisuración

| | EHE-98 (fisuracion.pas) | EC2-2004 + AN | EC2-2023 |
|---|---|---|---|
| Fórmula | wk = 1,7·sm·εsm | wk = sr,max·(εsm − εcm) (7.8) | wk,cal = kw·k1/r·sr,m,cal·(εsm − εcm), kw = 1,7 (9.8) |
| Separación | sm = 2c + 0,2s + 0,4·k1·Ø·Ac,ef/As, k1 = 0,125 (flexión) / 0,25 (tracción) | sr,max = 3,4c + 0,8·0,425·k2·Ø/ρp,eff, k2 = 0,5 / 1,0; o 1,3(h − x) si las barras están separadas (7.11, 7.14) | sr,m,cal = 1,5c + kfl·kb/7,2·Ø/ρp,eff ≤ 1,3/kw·(h − x) (9.15) |
| Deformación media | εsm = σs/Es·[1 − k2(σsr/σs)²] ≥ 0,4σs/Es, k2 = 1 (corta) / 0,5 (larga) | [σs − kt·fct,eff/ρ(1 + αe·ρ)]/Es ≥ 0,6σs/Es, kt = 0,6 / 0,4 (7.9) | igual que 2004, con mínimo (1 − kt)·σs/Es (9.11) |
| Dónde se mide | a la altura de la armadura | a la altura de la armadura | en la superficie (factor k1/r) |
| Límites (hormigón armado, cuasipermanente) | I 0,4; IIa, IIb, H 0,3; IIIa, IIIb, IV, F 0,2; IIIc, Qb, Qc 0,1 (memoria) | AN Tabla 7.1N: X0, XC1 0,4; XC1 interior, XC2, XC3, XC4, XF1, XF3 0,3; XS1, XS2, XD, XF2, XF4, XA1 0,2; XS3, XA2, XA3 0,1 | X0, XC1 sin límite (0,4 por aspecto); el resto 0,3·ksurf (Tablas 9.1 y 9.2) |
| Mínima por fisuración | — | As,min·σs = kc·k·fct,eff·Act (7.1) | 0,2·kh·fct,eff·Ac/fyk en flexión (9.2) |

El AN es más exigente que la 2023 en ambientes agresivos (XS, XD con 0,2 o 0,1 mm), mientras que la 2023 lo compensa en parte con la medición en superficie y con ksurf. `fisuracion.pas` ya tenía un apartado "EC-2 (ENV 1992)" que se puede reaprovechar para la 2004.

## 7. Qué implica para el prontuario web
1. **Tres normas en `normas.js`**: `EHE-98` (validación), `EC2-2004-AN` (casi todo es cambiar parámetros: αcc = 1, Ecm, εud = 10 ‰, νmin, cotθ de 0,5 a 2, cuantías del AN) y `EC2-2023` (fórmulas nuevas de cortante, punzonamiento y fisuración).
2. **Materiales para EC2-2004 por encima de C50**: el generador del diagrama tiene que aceptar un exponente n variable.
3. **Cortante (TT1)**: con EC2 desaparece Vcu cuando hay armadura; hay que añadir νmin y el rango de θ propio de cada norma. Para la 2023 se piden además Dlower y M/V.
4. **Punzonamiento (TT3)**: con 2004 + AN se mantienen la estructura y la u1 a 2d. Con la 2023 hay que rehacer los perímetros (0,5·dv, b0, límite de 3·dv) y pedir la luz o la distancia ap.
5. **Cuantías (`cuantiasMinMax`)**: tres ramas. EHE: geométrica + mecánica. AN: W·fctm,fl/(0,8h·fyd), 0,04·Ac y los pilares por caras. 2023: Mcr/MR,min sin máximo.
6. **Clases de exposición**: el EC-2 usa X0/XC/XD/XS/XF/XA en lugar de I/II/III/Q. El `.sec` original guarda "ambiente y 7 exposiciones" en nomenclatura EHE, así que el importador necesitará una tabla de equivalencias. El AN avisa de que XC1 solo equivale parcialmente a I y IIa.

## Nota 11/10: Código Estructural (Anejo 19) como criterio
En 6.2.2 el CE tiene νmin = 0,035·k^(3/2)·√fck (CEN) frente a 0,075/γc de la AN; en punzonamiento vRd,max = 0,4·ν·fcd frente a 0,5 de la AN; y el diagrama del acero sin tope de 10 ‰. Verificado en imagen del BOE. Detalle y fuentes en `ce-guias-recubrimientos-durabilidad.md` §6. El prontuario sigue la AN para EC-2 2004.
