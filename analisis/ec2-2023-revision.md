# EN 1992-1-1:2023 frente a la opción EC-2 del prontuario web

Fuente: EN 1992-1-1:2023 (E), noviembre 2023, texto extraído del PDF subido por José Luis
(`/mnt/project-files/uploads/hearth/5a8c0d40-c35d-44e8-a529-7932ff16f596`). Los números de
artículo, fórmula y tabla son los de la norma. Donde el valor sale de una figura (que no se
extrae como texto) se indica "comprobar en el PDF".

La norma aún no está vigente en España y no hay Anejo Nacional publicado: todos los valores
marcados NDP son los recomendados por CEN y pueden cambiar.

Código revisado: `prontuario-web/src/norma/normas.js` (objeto `EC2_2023`),
`src/core/materiales.js`, `src/core/flexion.js`. No se ha tocado ningún archivo de código.

---

## 1. Resumen de la revisión de coeficientes

| Parámetro en el código | Valor actual | Norma 2023 | Veredicto |
|---|---|---|---|
| γC, γS | 1,50 / 1,15 | Tabla 4.3 (NDP): 1,50 / 1,15 persistente; 1,15 / 1,00 accidental; nuevo γV = 1,40 para cortante/punzonamiento sin armadura | Correcto. Falta γV (necesario para cortante) |
| ηcc | (40/fck)^(1/3) ≤ 1 | Fórmula (5.4) con fck,ref = 40 MPa (NDP) | Correcto |
| ktc | 1,0 fijo | 5.1.6(1) NOTA: 1,00 solo si tref ≤ 28 d (CN/CR) y la carga de cálculo no llega antes de 3 meses; **0,85 en los demás casos** | **Incompleto.** Debe ser seleccionable; 0,85 es el valor seguro por defecto |
| Ecm | 9500·(fck+8)^(1/3) | Fórmula (5.1): Ecm = kE·fcm^(1/3), kE = 9500 para áridos cuarcíticos (5 000–13 000 según árido; NDP) | Correcto. Conviene dejar kE editable |
| fcm | fck + 8 | Tabla 5.1 | Correcto |
| fctm | 0,30·fck^(2/3) | Tabla 5.1: 0,3·fck^(2/3) si fck ≤ 50; **1,1·fck^(1/3) si fck > 50** | Correcto hasta C50/60 |
| fctk;0,05 / fctk;0,95 | 0,7 / 1,3·fctm | Tabla 5.1 | Correcto |
| fctm,fl | null | Fórmula (9.30): max{(1,6 − h/1000)·fctm; fctm}, h en mm; solo para flechas (9.1(3), 9.3.4(4)) | Falta, pero depende de h; no es una propiedad del material |
| εc2, εcu | 2 ‰ / 3,5 ‰ | 8.1.2(1), fórmula (8.4): εc2 = 0,002 y εcu = 0,0035 **para todas las clases**, exponente 2 | Correcto (y vale también para fck > 50) |
| εud | 45 ‰ con rama horizontal | 5.2.4(2): (a) rama inclinada con εud ≤ εuk/γS y tensión máx. k·fyk/γS; (b) **rama horizontal sin límite de deformación** | **Mezcla las dos opciones.** 45 ‰ es el 0,9·εuk de la EN 1992-1-1:2004 |
| Es | 200 000 | 5.2.4(3) | Correcto |
| fckMax | 50 | Tabla 5.1 llega a C100/115 | Limitación del código, no de la norma. Se puede subir a 100 cambiando solo fctm |

## 2. Materiales (cláusula 5)

### 2.1 Hormigón
- Clases C12/15 a C100/115 (Tabla 5.1). Edad de referencia tref = 28 d, o entre 28 y 91 d si el proyecto lo especifica (5.1.3(2)).
- Resistencia de cálculo (5.3): **fcd = ηcc·ktc·fck/γC**. Ya no existe αcc como tal; su papel lo hacen ktc (cargas mantenidas) y ηcc (fragilidad de hormigones de alta resistencia).
- Resistencia a tracción de cálculo (5.5): fctd = ktt·fctk;0,05/γC, con ktt = 0,80 en el caso "normal" y 0,70 en los demás (mismas condiciones que ktc).
- Diagrama para análisis no lineal (5.6)–(5.10): Sargin con εc1 = 0,7·fcm^(1/3) ≤ 2,8 ‰, εcu1 = 2,8 + 14(1 − fcm/108)^4 ≤ 3,5 ‰, k = 1,05·Ecm·εc1/fcm. No lo necesita el módulo de flexión ELU.
- Coeficiente de Poisson 0,2 (sin fisurar) / 0 (fisurado). Peso 25 kN/m³ armado. αc,th = 10·10⁻⁶ /°C.
- Fluencia φ(50 años, t0): Tabla 5.2 (para fck = 35, corregir por (35/fck)^A). Retracción: Tabla 5.3 (NDP). Métodos completos en el Anejo B.

**fcd comparado (γC = 1,5), MPa:**

| fck | ηcc | EC2-2023 ktc = 1 | EC2-2023 ktc = 0,85 | EHE-98 (α = 0,85) |
|---|---|---|---|---|
| 25 | 1,000 | 16,67 | 14,17 | 14,17 |
| 30 | 1,000 | 20,00 | 17,00 | 17,00 |
| 40 | 1,000 | 26,67 | 22,67 | 22,67 |
| 50 | 0,928 | 30,94 | 26,30 | 28,33 |
| 70 | 0,830 | 38,73 | 32,92 | (fuera de EHE-98) |
| 100 | 0,737 | 49,12 | 41,75 | (fuera de EHE-98) |

Consecuencia práctica: con ktc = 1 el prontuario da hasta fck = 40 un fcd un 18 % mayor que el de EHE-98; con ktc = 0,85 da exactamente el mismo. Por eso ktc no debería ir fijo a 1.

### 2.2 Acero
- Clases resistentes B400 a B700 (Tabla 5.4); clases de ductilidad A, B, C (Tabla 5.5): k = (ft/fy)k = 1,05 / 1,08 / 1,15–1,35 y εuk = 2,5 / 5,0 / 7,5 %.
- fyd = fyk/γS (5.11).
- Diagrama de cálculo (5.2.4(2), Figura 5.2):
  - (a) rama inclinada hasta εud ≤ εuk/γS: **A 21,7 ‰, B 43,5 ‰, C 65,2 ‰**, con tensión final k·fyk/γS;
  - (b) rama horizontal **sin límite de deformación**.
- Lo que hace hoy el código (rama horizontal con tope 45 ‰) es conservador respecto a (b) y queda del lado inseguro respecto a (a) para un acero B (45 > 43,5 ‰). Propuesta:
  1. pedir la clase de ductilidad del acero (además la necesitan 7.3.2, 8.2.3(4), 12.2(3) y 12.2(4));
  2. por defecto, rama horizontal con εud = εuk/γS de la clase. Así se mantiene el dominio 2 de pivotes del prontuario y queda del lado seguro de las dos opciones;
  3. como opción, la rama inclinada (a).

## 3. ELU de flexión (8.1)
- Hipótesis (8.1.1(2)): secciones planas, adherencia perfecta, sin tracción en el hormigón, tensiones del hormigón según 8.1.2 y del acero según 5.2. Coincide con lo que hace el motor (`seccion.js`).
- Límites: εcu = 3,5 ‰ (8.1.1(3)), εud en el acero (8.1.1(4)), distribuciones límite de la Figura 8.1 (pivotes; comprobar en el PDF la posición del pivote de compresión centrada, que en la versión 2004 era εc2 = 2 ‰).
- Diagrama parábola-rectángulo (8.4) con εc2 = 2 ‰ y εcu = 3,5 ‰ **para todas las resistencias**. Aquí cambia respecto a la versión 2004, que variaba εc2, εcu2 y n para fck > 50. El efecto de los hormigones de alta resistencia lo recoge ahora ηcc en fcd.
- Bloque rectangular alternativo (8.1.2(2), Figura 8.2d): los parámetros solo vienen en la figura (comprobar en el PDF: se espera 0,8x con tensión fcd).
- **Excentricidad mínima** (8.1.1(5)): MEd,min = NEd·max{h/30; 20 mm} en piezas comprimidas. Es lo mismo que la EHE-98.
- Flexión esviada simplificada (8.2) con exponente aN (Fórmula 8.2, NRd,0 = Ac·fcd + As·fyd).
- Losas con momento torsor (8.1.3): mRd ≥ mEd ± |mEdxy| si |mEdxy| ≤ 0,07·d²·fcd.
- El momento límite que usa `dimensionar` (`momentoLimite`, εcu arriba y εy en la armadura) es un criterio de proyecto heredado de EHE. La norma 2023 no impone una profundidad máxima de fibra neutra en flexión simple; solo limita xu/d cuando se redistribuyen momentos (7.3.2(3), Fórmula 7.16, δM ≥ 0,7 con acero B/C y ≥ 0,8 con acero A). Se puede conservar, pero en la interfaz debe presentarse como criterio y no como requisito normativo.

## 4. Armaduras mínimas
Hoy el código aplica con EC-2 las cuantías de EHE-98 (`cuantiasMinMax`), y la interfaz ya lo avisa. Lo que pide la 2023:

**Armadura mínima longitudinal (12.2(2), Tablas 12.1 y 12.2 para vigas y losas):**
- Flexión con o sin axil (si NEd,min < 0,5·Ac·fcd): **MR,min(NEd,min) ≥ Mcr(NEd,min)** (12.1). MR,min se calcula con la armadura a **fyk** (no fyd) y Mcr con **fctm** sobre la sección bruta, en elástico lineal. Sustituye a la fórmula 0,26·fctm/fyk·bt·d de 2004. Para el motor es fácil, porque es un cálculo de sección con el acero a fyk.
- Tracción pura: As,min = Ac·fctm/fyk (12.2).
- Alternativa (12.2(3)) en isostáticas donde MEd < Mcr: MRd,min ≥ kdc·MEd, con kdc = 1,3 / 1,1 / 1,0 para acero A / B / C. Esta alternativa no exige más que (12.1).
- Piezas comprimidas: (2)–(4) pueden ignorarse (12.2(5)).
- **No hay cuantía máxima** en vigas (la 2004 tenía 0,04·Ac). El tope "capacidad mecánica del acero = la del hormigón" del prontuario es solo un criterio del programa.

**Pilares (Tabla 12.3, NDP):** As,min = max{0,1·NEd/fyd; 0,002·Ac}; barra longitudinal Ø ≥ 12 mm; al menos una por esquina, separación ≤ 400 mm (6 barras en circulares); cercos Ø ≥ 0,25·Øl,max; separación de cercos 20·Øl,max ≤ min{h; b; 300 mm}, reducida a 0,6 veces en extremos y solapes. Tampoco hay cuantía máxima.

**Losas (Tabla 12.2):** As,min según 12.2(2); armadura secundaria ≥ 0,2·As,req; armadura inferior en apoyos ≥ 0,25·As,req,span.

**Muros (Tabla 12.4):** 0,25·Ac·fctm/fyk en cada cara si trabajan en su plano (8.5 o Anejo G); el resto de casos, en la tabla.

**Cortante mínimo (12.2(4)):** ρw,min = 0,08·√fck/fyk, reducible un 10 % (acero B) o un 20 % (acero C).

**Mínima por fisuración (9.2.2), aparte de la anterior:** para flexión pura As,min,w1 ≥ 0,2·kh·fct,eff·Ac/fyk (9.2), tracción pura 0,5·kh·fct,eff·Ac/fyk (9.3), y flexocompresión con la fórmula (9.4). Ac es el área de la parte considerada (alma o ala) y kh = 0,8 − 0,6·(min{b;h} − 0,3), entre 0,5 y 0,8 (9.5, en metros). Armadura de piel en vigas de canto colgado > 600 mm: As,web = 0,2·fct,eff/fyk·bw·(d − x − 150 mm), con separación ≤ 300 mm (9.7).

## 5. Fisuración (9.2)
El prontuario calcula hoy wk con el método de EHE-98 (`propuestaArmado`: β = 1,7, sm, εsm). Para EC-2 2023 haría falta lo siguiente.

**Límites (Tablas 9.1 y 9.2, NDP):**
- Por durabilidad, en hormigón armado y con combinación cuasipermanente: X0 y XC1 sin límite; XC2–XC4, XD, XS y XF con **wlim,cal = 0,3 mm·ksurf**, donde ksurf = cact/(10 mm + cmin,dur) está entre 1,0 y 1,5.
- Por aspecto: wlim,cal = 0,4 mm (cuasipermanente) y σs ≤ fyk; en combinación característica, σs ≤ 0,8·fyk.
- La abertura se comprueba en la **superficie** de la pieza, no a la altura de la armadura.

**Abertura calculada (9.8):** wk,cal = kw·k1/r·sr,m,cal·(εsm − εcm)
- kw = 1,7 (NDP).
- k1/r = (h − x)/(h − ay − x) (9.9): lleva la abertura de la armadura a la superficie.
- εsm − εcm = [σs − **kt**·fct,eff/ρp,eff·(1 + αe·ρp,eff)]/Es ≥ (1 − kt)·σs/Es (9.11), con **kt = 0,6** para corta duración o fase de formación de fisuras y **kt = 0,4** para larga duración o cargas repetidas con fisuración estabilizada. Este kt es el de rigidización a tracción y no tiene relación con ktc (cuál de los dos era el "kt = 1" de la nota de partida no está claro; ninguno vale 1).
- αe = Es/Ecm; fct,eff = fctm (9.1(3)); ρp,eff = (As + ξ1·Ap)/Ac,eff (9.12).
- hc,eff para una capa (Figura 9.3a): min{ay + 5Ø; 10Ø; 3,5ay; h − x; h/2}; con n capas se suma (n − 1)·sy.
- sr,m,cal = 1,5·c + (kfl·kb/7,2)·Ø/ρp,eff ≤ (1,3/kw)·(h − x) (9.15), con kfl = (h − hc,eff)/h en flexión rectangular (9.16), kb = 0,9 para buena adherencia y 1,2 para mala (9.18), c = recubrimiento libre y Øeq según (9.19) si hay diámetros mezclados.
- Si la tensión en combinación característica no supera fct,eff, la sección se considera sin fisurar y no hace falta calcular wk (9.1(2)). Para el cálculo de tensiones en fisuración puede tomarse Es/Ec,eff = 15 (9.1(5)).

**Método simplificado (Anejo S, informativo):** Ø máximo (S.6) o separación máxima (S.7) en función de wlim,cal, σs y ρp. Sustituye a las tablas de Ø y separación de la versión 2004. Encaja bien con la "propuesta de armado" del prontuario.

Datos que pide al usuario y que el prontuario no tiene hoy: clase de exposición, cmin,dur y recubrimiento real (para ksurf), condición de adherencia, duración de la carga y combinación cuasipermanente (el original la estima como 0,82·Md/1,5).

## 6. Cortante y punzonamiento (cambio principal de la 2023)
Resumen para la comparación posterior con EC-2 2004 y EHE-98.

**Cortante (8.2):** se formula en tensiones, τEd = VEd/(bw·z) con z = 0,9d (8.18).
- Comprobación omitida si τEd ≤ τRdc,min = (11/γV)·√(fck/fyd · ddg/d) (8.20).
- Sin armadura: τRd,c = (0,66/γV)·(100·ρl·fck·ddg/d)^(1/3) ≥ τRdc,min (8.27). Aparece el parámetro de rugosidad ddg = 16 + Dlower ≤ 40 mm (fck ≤ 60), ya no está el factor k = 1 + √(200/d), y d puede sustituirse por av = √(acs·d/4) con acs = |MEd/VEd| ≥ d (8.29–8.30). El axil entra por kvp (8.31) o por la fórmula alternativa (8.32)–(8.35).
- Con armadura: modelo de bielas de inclinación variable, 1 ≤ cotθ ≤ 2,5 (3,0 con compresión relevante; 2,5 − 0,1·NEd/|VEd| en tracción; un 20 % menos con acero A) (8.41). τRd,sy = ρw·fywd·cotθ (8.42); biela σcd = τEd(cotθ + tanθ) ≤ ν·fcd con ν = 0,5 (8.44, 8.6), o ν de la Fórmula (8.45) según εx.
- Armadura mínima obligatoria en vigas isostáticas con d > 500 mm (8.2.1(2)).

**Punzonamiento (8.4):** basado en la teoría de la fisura crítica.
- Perímetro de control b0,5 a **0,5·dv** de la cara del soporte (antes 2d) (8.4.2(2)); τEd = βe·VEd/(b0,5·dv), con βe = 1,15 / 1,4 / 1,5 para soporte interior / de borde / de esquina (Tabla 8.3) o el valor refinado.
- Sin armadura: τRd,c = (0,6/γV)·kpb·(100·ρl·fck·ddg/dv)^(1/3) ≤ (0,5/γV)·√fck (8.94), con kpb = 3,6·√(1 − b0/b0,5) entre 1 y 2,5 y ρl = √(ρlx·ρly). dv puede sustituirse por apd = √(ap·dv/8), con ap ≈ 0,22·L en losas regulares.
- Con armadura: τRd,cs = ηc·τRd,c + ηs·ρw·fywd (8.104); máximo τRd,max = ηsys·τRd,c, con ηsys = 0,70 + 0,63(b0/dv)^(1/4) para pernos y 0,50 + … para cercos (8.110–8.111); perímetro exterior b0,5,out según (8.112).

## 7. Lista de cambios propuestos para `normas.js` / `materiales.js`
Van al hilo propietario del código a través del coordinador.

1. `ktc` como parámetro del hormigón (1,00 / 0,85) con **0,85 por defecto** y aviso de la condición de 5.1.6(1). Igual para `ktt` (0,80 / 0,70) si se usa fctd.
2. `fctm`: 1,1·fck^(1/3) para fck > 50, y subir `fckMax` a 100. εc2 y εcu no cambian.
3. `kE` editable (9500 por defecto, rango 5 000–13 000).
4. Acero: clase de ductilidad A/B/C; `epsUd` = εuk/γS (21,7 / 43,5 / 65,2 ‰) en lugar de 45 ‰; opción de rama inclinada con k·fyk/γS.
5. `fctfl`: sustituir el null por la función de (fctm, h) de la Fórmula (9.30), solo para flechas.
6. Añadir `gammaV = 1,40` (Tabla 4.3) para cortante y punzonamiento.
7. Rama EC-2 de `cuantiasMinMax`: MR,min(fyk) ≥ Mcr(fctm) (12.1); As,min de pilares max{0,1·NEd/fyd; 0,002·Ac}; quitar la cuantía máxima normativa o rotularla como criterio del programa.
8. Rama EC-2 de la fisuración según 9.2.3 (Fórmulas 9.8–9.19) con los datos del §5, y comprobación de la mínima de 9.2.2.
9. Cambiar el nombre "(preliminar)" a "EN 1992-1-1:2023, valores recomendados CEN (sin Anejo Nacional español)".
