# Teoría del motor seccional (calcomun.pas, Prontuario 3.1) y cómo ampliarlo

Documento de estudio del 13/10/2026. Sin cambios en el código de la app. Todo lo que dice «el 3.1» sale de los fuentes Delphi de `Version 3.1` (calcomun, Marin, marinvar, comun_TN, TN3, TN6, Unit4, pih_lee, pih_manipuleo, PIH_TIPOS), leídos línea a línea. Las normas se citan desde `analisis/normativa/`.

**Cómo distinguir el origen de cada afirmación**
- **[3.1]** viene del código original y está comprobado en él (se indica la unidad y la rutina).
- **[JS]** es lo que hace hoy el motor web (`src/core/seccion.js`, `momentoCurvatura.js`).
- **[P]** es propuesta mía, no existe en el 3.1. Las comprobadas con un prototipo numérico lo dicen.
- **[?]** es una interpretación o algo que no he podido confirmar.

---

## 1. Qué es calcomun y qué usa

`calcomun` es el núcleo: dada una sección (varias «partes» con material), un plano de deformaciones y un ángulo del plano, integra tensiones y devuelve N, My y Mz. Sobre eso construye el equilibrio y la rotura. Lo usan flexión simple (TN1), compuesta (TN3), esviada (TN6), el diagrama de interacción (`comun_TN`), M-κ, axil-elongación y fisurada (Unit4).

Cadena de llamadas [3.1]:

```
Marin.momento_de_area      integral exacta de x^m y^n sobre un polígono (Marín)
  └ calcula_Ne / calcula_My / calcula_Mz     N, My, Mz para un plano (κ, xm, α)
      └ determina_xmax_xmin                  intervalo de xm que no rompe ninguna parte
          ├ determina_xm                     xm que da el axil N (κ dada)
          └ curvu                            κ última para un N (y xm de rotura)
              ├ M_de_N, M_de_curv            momento último / momento para κ dada
              ├ Axil_Ultimo                  N último para un M dado
              ├ Plano_de_deformaciones       (κ, xm) para un par (N, M) no de rotura
              └ calcula_axiles_extremos      N de tracción y compresión máximas
```

Unidades: kN, m, kN/m² (el HA-25 lleva E = 27 264 042 kN/m² y σ = −14 166,7 kN/m² = −14,17 MPa). Las rutinas de la interfaz convierten a MPa y mm.

## 2. Convenios e hipótesis [3.1]

1. **Ejes.** `y` crece hacia abajo (profundidad). La sección se define con el origen arriba: `y_sup` de la primera parte y trapecios hacia abajo. `x` es horizontal, simétrico respecto al eje en los tipos paramétricos.
2. **Plano de deformaciones.** Para flexión recta: `ε(y) = κ·(y − xm) + ε0`. `xm` es la profundidad de la fibra de deformación nula (con `ε0 = 0`). `κ > 0` comprime lo que está por encima de `xm`, es decir, la cara superior. Para flexión esviada el plano se expresa en una sección girada un ángulo `α` (§6.5): el eje neutro queda horizontal en el sistema girado.
3. **Signos.** Tracción positiva, compresión negativa, tanto en σ como en ε y en N. Un `Mu` positivo comprime la cara superior. La interfaz cambia el signo de N al mostrar (compresión positiva, como en el resto del Prontuario).
4. **Momentos.** `My` de calcomun se toma respecto al eje horizontal de profundidad `xm`. El momento «de verdad» se refiere al c.d.g. homogeneizado: `M = My + N·(xm − yg)`, con `yg` de `calcula_yg` (áreas ponderadas por `E_i/E_1`, siendo `E_1` el módulo de la parte 1). Demostración en §4.3.
5. **Compatibilidad total.** Adherencia perfecta: la armadura tiene la deformación de la fibra de hormigón que la rodea (EHE-08 42.1.2 c)). No hay deslizamiento.
6. **Planeidad.** Las secciones planas siguen planas (Bernoulli), con independencia del tipo de rotura.
7. **Hormigón.** Se integra el diagrama completo del `.mat`, con la tracción que traiga la ficha (en los HA tipificados, cero: `2 1 / 0 0 / 0 0.0005`). No hay tension-stiffening salvo la casilla de Unit4 (§6.4).
8. **No se descuenta el hormigón que ocupa la armadura.** La parte de hormigón se integra entera y la armadura se suma aparte. [3.1, comprobado en `calcula_Ne`; igual en el motor JS]. En compresión el error por barra es `A_s·|σc|`. Es práctica corriente despreciarlo; si algún día se quiere afinar, se resta `σc(ε)·A_s` a cada barra comprimida. [P]
9. **Sin tamaño de elemento.** No hay segundo orden ni efecto de deslizamiento: eso es de otros módulos (Pandeo, Fisuración).

## 3. Cómo se describe una sección y un material [3.1]

### 3.1 Material (`ecuacion_constitutiva`, fichero `.mat`)

Dos poligonales σ-ε, una para compresión y otra para tracción, con puntos `(σ, ε)` desde `(0,0)` hacia fuera. Más:
- `n_tramos_comp` y `n_tramos_tracc`: número de **puntos** (los tramos son uno menos; el nombre engaña).
- `rotura_comp`, `rotura_trac`: en el fichero va un código 0/1 tras el número de puntos; **0 significa que existe rotura** y 1 que no. La rotura se produce en la deformación del **último punto** de la poligonal. Es el mecanismo que fija los dominios de deformación.
- `E`, `fk`, `cansancio` (el α·0,85 o 1,0), `gamma`.

Ejemplos (`tests/fixtures/PRUEBA/Materiales/`):
- **Hormigón**: compresión de 12 puntos de una parábola-rectángulo (`ε` de 0 a −0,0035, rotura), tracción `2 1` (no rompe, σ=0 hasta 0,0005).
- **Acero**: bilineal, comp. `3 0` (rompe en −0,010) y trac. `3 0` (rompe en +0,010). El escalón horizontal va hasta ±10 ‰, así que la **ductilidad del acero es un dato del material**, no del programa.
- **«ficticio»**: material de un punto auxiliar que impone ε ≥ −0,002. Con él se pone el **pivote C** del dominio 5 (compresión simple), sin código especial.

Consecuencia importante: el motor no sabe qué es un «dominio 2, 3, 4 o 5». Los dominios salen de las deformaciones de rotura de cada material y del punto ficticio. Cualquier diagrama σ-ε razonable (EC-2, EHE, por puntos del usuario) funciona sin tocar el motor. [JS]: igual, con `limites(mat)`.

### 3.2 Sección (`seccion` con `secs[1..n]`, fichero `.sec`)

Cada parte tiene un `tipo_sec`:
- `T`: pila de trapecios (rectangular, T). La armadura de Rec1 y T se mete como **franjas finas** (un trapecio de 4 mm de alto con el área de la armadura y su `y_sup`).
- `P`: círculos de armadura (Rec2, Cir, Gen), con diámetro `fi` y lista de centros. Cada barra se trata como un punto con área `π·fi²/4`.
- `X`: polígono libre (contorno genérico). `C`: círculo generado como polígono. `A`: corona. `H`: hueco. El tratamiento del hueco no lo he seguido hasta el final (`RellenarHueco`/`MaterialHueco` en `Graba_Sec_Generica`). [?]
- `f`: «fictitious», una barra de 1 mm de diámetro con material `ficticio` en el punto del pivote C. `Restablecer_pivotito` la recoloca a 3/7 del canto (`ymin + 3/7·(ymax−ymin)`) cada vez que se gira la sección. El propio código lo comenta («esto puede ser fatal»). En [JS] queda como `epsC2` con 3h/7 fijo.
- Cada parte guarda además `eps0, curv0` («predeformaciones», dos reales en el fichero, siempre 0 en las secciones de prueba). **Son el gancho para pretensado y secciones evolutivas** (§8).

Una sección es una lista de partes; el material de cada una se resuelve a un índice en la lista `ecuaciones`.

## 4. La integración: Marín + tramos [3.1]

### 4.1 Momentos de área de un polígono (Marín)

`momento_de_area(tipo, fi, n, x, y, m, n)` devuelve `∫ x^m · y^n dA` para el polígono dado (cerrado: `x[n+1] = x[1]`):

```
I(m,n) = − 1 / [ C(m+n, n) · (m+n+1) · (m+n+2) ] ·
         Σ_aristas  w_i · Σ_{j=0..m}  x_i^(m−j) · x_{i+1}^j · Σ_{k=0..n}  C(j+k, j) · C(m+n−j−k, n−k) · y_i^(n−k) · y_{i+1}^k
w_i = x_i · y_{i+1} − x_{i+1} · y_i
```

Es el teorema de Green aplicado a monomios, exacto para cualquier polígono (cóncavo también). El signo menos y el sentido de recorrido de los `.sec` (el que da `coordenadas`) hacen que el área salga positiva. **Lo he replicado en Python y da exactamente A, S_y, I_x e I_y de un rectángulo** (`0,15 = 0,3·0,5`; `0,0375`; `0,0125`; `0,001125`).

Para una barra (`P` o `f`) la «integral» es `A_barra · x^m · y^n` evaluada en el centro, y una barra marcada con `y = −1000` se considera fuera de la banda (§4.4).

### 4.2 Ley a tramos lineales → integral cerrada

La clave es que cada tramo del diagrama σ-ε es una recta: `σ = a1 + a2·ε`. Con `ε = κt·y` en coordenadas locales (origen en el punto de deformación nula; `κt = κ + curv0`), cada tramo de ε se corresponde con una **banda horizontal** `ymin ≤ y ≤ ymax` de la sección, con `y = ε/κt` en los extremos.

Para el tramo `j` de la poligonal de compresión, con puntos `(σ_{j−1}, ε_{j−1})` y `(σ_j, ε_j)`:

```
a2 = (σ_{j−1} − σ_j) / (ε_{j−1} − ε_j)       a1 = σ_{j−1} − a2 · ε_{j−1}
banda:   y ∈ [ ε_j/κt , ε_{j−1}/κt ]  si κt > 0   (se invierte si κt < 0)
Se recorta el polígono a la banda  →  A, S = ∫y dA, I = ∫y² dA, Sx = ∫x dA, P = ∫xy dA  (Marín)
N_banda  = a1·A + a2·κt·S
My_banda = a1·S + a2·κt·I   +  N_banda·(xpm − xm)        ← traslado al eje de profundidad xm
Mz_banda = a1·Sx + a2·κt·P
```

Se suma sobre todas las bandas de compresión y de tracción de todas las partes. Fuera del último punto la tensión es cero (es lo que hace `sigma` en [JS]).

Es una integración **exacta** (sin discretizar), y de ahí la insensibilidad del 3.1 al número de puntos del diagrama. El precio es el recorte.

### 4.3 Por qué `M = My + N·(xm − yg)`

El momento de las tensiones respecto a un eje de profundidad `a` es `∫σ (y − a) dA`. Entre dos ejes: `∫σ(y−yg)dA = ∫σ(y−xm)dA + (xm−yg)·∫σ dA`. Con `∫σ(y−xm)dA = My` y `∫σ dA = N`, sale la fórmula. La rutina interna usa `xpm` (el origen local de la parte, que difiere de `xm` cuando `eps0 ≠ 0`), de ahí el término `Nparte·(xpm − xm)` de `calcula_My`.

### 4.4 Barras y recorte [3.1]

- Las barras se filtran por banda: se marcan fuera (`y = −1000`) las que caen por encima de `ymax` o por debajo o en `ymin`. Una barra justo en el borde entre dos bandas se cuenta en una sola.
- Para polígonos, `coordenadas_marin` recorta con una pasada de «insertar intersecciones» y otra de «proyectar los vértices que quedan fuera sobre la recta», repetidas varias veces (hay bloques copiados «30 06 2000» y «de nuevo todo»). Los vértices proyectados dejan aristas de longitud nula o a lo largo de la recta de corte, que no aportan a la integral. Funciona, pero depende de un orden de recorrido concreto, de tolerancias (1e-5) y de matrices de tamaño fijo (`n_vertmax = 150`).
- **[P]** En una reimplementación el recorte limpio es Sutherland-Hodgman contra dos semiplanos horizontales. Es corto, robusto y sin hacks. En [JS] no hace falta porque la sección se descompone en trapecios horizontales exactos (`trapecios()`), con la integral de cada subtramo por Gauss-Legendre de 3 puntos (exacta, el integrando es cuadrático) cortada en los quiebros de la ley σ-ε.

### 4.5 Coste

Cada evaluación de N recorre todas las partes × todas las bandas, y por banda **gira y traslada** una copia de los vértices. `curvu` hace hasta 200 pasos de bisección y 200 de falsa posición con dos evaluaciones por paso; un diagrama de interacción de 20 puntos son miles de evaluaciones. Es perfectamente asumible hoy, pero explica el recorte en bloques.

## 5. Equilibrio y rotura [3.1]

### 5.1 Qué es `xm` y por qué hay un intervalo admisible

Para una curvatura `κ`, cada posición de la fibra neutra `xm` da un plano. N crece en tracción cuando `xm` baja (la zona traccionada crece) y decrece cuando `xm` sube. **N(xm) es monótona en `κ` fija**, y es lo que permite resolver con un método de bracketing.

`determina_xmax_xmin(κ, α, …)` calcula el intervalo `[xmin, xmax]` de posiciones de la fibra neutra compatible con **todas** las deformaciones de rotura de **todas** las partes:
- `xmax`: la fibra extrema comprimida de la «parte que rompe» llega a su `ε_comp` último: `xmax = y_sup_parte − ε_u,comp/κ` (se añaden los términos de `eps0/curv0`). Se comprueba que ninguna otra parte supere su rotura en compresión con ese `xmax`; si alguna lo hace, se pasa a la siguiente parte como «la que rompe».
- `xmin`: lo mismo con la fibra extrema traccionada: `xmin = y_inf_parte − ε_u,trac/κ`.
- Si el material no tiene rotura en ese sentido se usa ±1e20 (infinito), y las demás partes imponen el límite.
- En flexión esviada divide por `cos α` para pasar de profundidad en el sistema girado a `xm` en vertical. Por eso `cos α = 0` da error (y TN6 gira la sección 90° para β en 45–135 y 225–315, §6.5).
- Si `xmin` y `xmax` quedan al revés, no hay plano admisible para esa κ.

### 5.2 `determina_xm(N, yg, κ, α)`: equilibrio para κ conocida

Con `[xmin, xmax]` y los axiles `Nmin = N(xmin) − N`, `Nmax = N(xmax) − N`, si no hay cambio de signo da error («Error en determina xm»). Si lo hay, resuelve `N(xm) = N` por falsa posición de Illinois (cuando un extremo no se mueve se divide su valor por 2). Tolerancia: 1e-10 en xm o 0,001 kN en N. Devuelve xm.

### 5.3 `curvu(N, α, signo)`: curvatura última

Es la mayor `κ` para la que aún hay un plano admisible con ese axil. Dicho de otro modo: `[Nmin, Nmax]` (los axiles en los extremos del intervalo) contiene al N pedido mientras `κ ≤ κu`; a partir de `κu` ya no. Hasta ese momento no se ha agotado ningún material; en `κu`, uno de los dos extremos de `xm` está exactamente en rotura.

Algoritmo [3.1]:
1. Intervalo inicial `κ ∈ [1e-6·signo, 1·signo]` m⁻¹. Si en la `κ` más pequeña no hay cambio de signo (`Nmin·Nmax > 0`), se salta a la bisección «a prueba de bombas».
2. Bisección hasta encontrar un `κ` no admisible (`Nmin·Nmax ≥ 0`) y fijar el intervalo (`rangoOK`).
3. Falsa posición de Illinois sobre `F(κ) = Nmin·Nmax` hasta `|Nmin|` o `|Nmax| < 1e-4` kN, o `|Δκ| < 1e-6`. En `κu` un extremo coincide con N y `F = 0`.
4. `κu = trunc(κ·1e7)·1e-7 + signo·1e-9` (se trunca a 1e-7 m⁻¹ y se retrocede un poco para no estar en el filo). `xm` es el extremo con menor |N − Nobj|.
5. Fallback `CurvuAPruebaDeBombas`: bisección pura a 1e-12 sobre `[signo·3, signo·1e-11]`.

Con esto el **momento último** es `Mu = My(κu, xm) + N·(xm − yg)` (`M_de_N`). Una sola función cubre flexión simple (N=0), compuesta (cualquier N) y, con `α ≠ 0`, esviada.

[JS] `estadoUltimo` hace lo mismo: el intervalo es de `εsup` (no de `xm`), se bisecta κ hasta el último factible y luego se resuelve `εsup` por bisección. Es equivalente.

### 5.4 Axiles extremos

`calcula_axiles_extremos(sec, ec, εpico)`: N de compresión pura = `N` en un plano con deformación uniforme `−εpico` (en ‰, por defecto 2 ‰), construido con `κ` minúscula y `xm = 1000·d` para no dividir por cero. N de tracción pura igual con `+9,9 ‰` (justo debajo de la rotura del acero). Las N que acepta la sección son las que están entre ellas.

### 5.5 `Axil_Ultimo(M)`: axil último para un momento

Falsa posición de Illinois en N, entre 0 y la tracción máxima (tracción) o entre la compresión máxima y 0 (compresión), de `F(N) = M_de_N(N) − Md`. Supone que M(N) es monótona en cada semirrama, cosa que no es cierta en compresión (sube hasta el punto balanceado y luego baja), pero sí cuando `Md ≤ M(0)`. Si `Md` cae entre `M(0)` y el balanceado, este método puede no converger. [?]

### 5.6 `Plano_de_deformaciones(N, M)`: plano de servicio

Para un par no de rotura. Busca `κ` en `[1e-9, 0,95·κu(N)]` tal que `M_de_curv(N, κ) = M`, con Illinois sobre `κ`; para cada `κ` hace `determina_xm` y `calcula_My`. Si `F1·F2 = 0` devuelve `κ = 1e-9`. La anotación «no de rotura» es literal: topa en 0,95·κu.

## 6. Los diagramas que ya tiene el 3.1

### 6.1 Interacción N-M (`DiagramaDeInteraccion`, comun_TN)
`N` equiespaciado entre `Ntrac` y `Ncomp` (de `calcula_axiles_extremos`); para cada uno, `curvu → calcula_My → M = My + N(xm − yg)`. Hace además la misma barrida con solo el hormigón (armadura de diámetro ≈ 0) para dibujar la envolvente del hormigón. Los dos puntos extremos se fuerzan a `M = 0` («una trampita»).

### 6.2 Momento-curvatura (`Unit4`, hoja de curvatura)
Para cada `Nk` calcula `κu`, reparte `κ` entre 0 y `0,99·κu` (con el primer punto en `κu/1000`), y para cada `κ` hace `determina_xm → calcula_My → M`. También tensiones y deformaciones extremas del hormigón y del acero, y `EI` secante y tangente. [JS] `curvaMomentoCurvatura`, con la misma idea.

### 6.3 Fisurada (`Ifis`, `Mfis`) [?]
`Mfis = (fctm − N/Ah)·Ixh/(ymax − ymin − ygh)`, con propiedades homogeneizadas. `Ifis` se obtiene de la sección real con `κ = κu/20`: `Ixfis = M(κ)/(κ·E)`. Existe un material «lineal» (`eclineal`) para otros cálculos. No lo he seguido más allá.

### 6.4 Axil-elongación a M constante (`Axil_elongacion`)
Es lo más cercano a un **diagrama N-ε** que ya existe: para cada `Mk` y para N de `0,0001·Nu` a `0,95·Nu`, `Plano_de_deformaciones(N, Mk)` da `κ` y `xm`, y se define la «elongación» como `1000·κ·(xm₀ − xm)`, es decir, la deformación en ‰ a la profundidad de la fibra neutra del primer punto. [? interpretación: es la deformación del plano de cada punto sobre la fibra que era neutra con N≈0.] De ahí `EA` secante y tangente. Con la casilla «tension stiffening» se cambia la rotura del acero por una deformación arbitraria (0,0001).

### 6.5 Flexión esviada (TN6, `Momentos_Ultimos`)
Para un N fijo y un ángulo β del eje neutro:
1. Si β ∈ (45°, 135°) o (225°, 315°), se gira la sección 90° y β2 = β − 90° (para no tener `cos α` ≈ 0).
2. `curv := curvu(N, β2, …)`, `calcula_My` y `calcula_Mz`.
3. `My = my1·cosβ + mz1·sinβ + N·(xm − yg)` y `Mz = my1·sinβ − mz1·cosβ + N·xg`.

Esta última transformación es correcta (la he deducido: es `∫σ(y−xm)dA + N(xm−yg)` y `−∫σ(x−xg)dA`, con `Mz` con signo cambiado). El resultado es la **curva de interacción (My, Mz) a N constante** barriendo β de 0 a 360°, dibujada con flechas. El diagrama a tres variables (N, My, Mz) es la superficie de rotura completa; el 3.1 solo saca cortes **a N constante**.

## 7. Resumen de limitaciones y rarezas del 3.1 que conviene no heredar

| # | Qué | Efecto | Dónde |
|---|---|---|---|
| 1 | `calcula_deformaciones` tiene una fórmula marcada por el autor como errónea («ojo esto esta mal») para más de un trapecio | Solo afecta a esa utilidad de dibujo | calcomun.pas:96 |
| 2 | La parte con `curv0 ≠ 0` usa distinto signo de `y_sup` en `calcula_Ne` y en `determina_xmax_xmin` [?] | La precurvatura no es fiable. Ninguna sección de prueba la usa | calcomun.pas:654, 1024, 1041 |
| 3 | `eps0`/`curv0` son uniformes o lineales **solo en y** | No sirve para esviada con pretensado ni evolutivas esviadas | PIH_TIPOS |
| 4 | Recorte por hacks repetidos, `n_vertmax = 150`, tolerancias 1e-5 | Fragilidad con secciones complejas | `coordenadas_marin` |
| 5 | Pivote C a 3/7 del canto del rectángulo envolvente, recolocado tras cada giro | Para fck > 50 el punto es `(1 − εc2/εcu2)·h`, no 3/7 [?] | pih_manipuleo.pas:153 |
| 6 | `trunc(κ·1e7)` y +1e-9 | Cuantiza κu (error relativo ~1e-5, irrelevante) | curvu |
| 7 | `Axil_Ultimo` supone M(N) monótona | Puede no converger entre M(0) y el balanceado | calcomun.pas:1268 |
| 8 | Mensajes `ShowMessage` dentro del núcleo | Mezcla cálculo con interfaz | varias |
| 9 | Falla si `cos α = 0`, parche girando 90° | Duplica código en TN6 | determina_xmax_xmin |
| 10 | Sin descuento del hormigón desplazado | Ver §2.8 | calcula_Ne |

## 8. Ampliaciones: marco único

### 8.1 Idea común [P]

Los cuatro casos pedidos se resuelven con **un solo cambio de planteamiento**: separar lo que hace el plano de deformaciones de lo que cada parte lleva «de casa».

```
deformación del material en un punto P de la parte i:
    ε_m(P) = ε_plano(P) + ε0_i(P)
    ε_plano(P) = εr + κy·(y − yr) + κx·(x − xr)          ← 3 incógnitas
    ε0_i(P)    = e_i + gy_i·y + gx_i·x                      ← dato de la parte i
σ(P) = f_material_i( ε_m(P) )    ;   la rotura se mira sobre ε_m
```

El 3.1 ya tiene esto a medias: `eps0, curv0` por parte son `e_i` y `gy_i` (con el defecto de §7 #2), y los límites de rotura se comprueban con el `eps0` incluido. Lo que falta es (a) `gx_i` y la versión esviada, (b) un plano de tres parámetros en lugar de (κ, xm, α), (c) separar claramente «acciones externas» de «estado inicial».

Esto vale tanto para el motor actual de flexión recta como para la futura esviada. **Cada ampliación queda reducida a decidir qué valor tiene `ε0_i` y cómo se calcula.**

### 8.2 Pretensado

**Qué dice la norma (verificado en los textos del proyecto).** EHE-08 42.1.2 c): la deformación total de la armadura activa adherente en agotamiento es la de la fibra en el plano de agotamiento (`ε0`) más la deformación por el pretensado y la deformación de descompresión: `Δεp = εp0 + εcp`, con `εp0` la predeformación de la armadura tras las pérdidas y `εcp` la deformación de descompresión del hormigón a su nivel. EC-2 5.10.1 (2) lo plantea igual como «predeformación y precurvatura»; 5.10.8 da el valor de cálculo del pretensado y, para armaduras no adherentes, un incremento de tensión de ELU `Δσp,ULS` (valor recomendado 100 MPa, a mirar en el AN) que **no** sale de un plano de deformaciones. Los diagramas de cálculo del acero activo son los de EHE-08 38.7 y EC-2 3.3.6 (rama inclinada con `εud`, o rama horizontal).

**Traducción a calcomun [P].**
- Cada tendón es una parte `P` con material «activo» (σ-ε del 3.3.6 con rotura en `εud`) y `e_i = εp0 + εcp(y_i)`.
- `εp0 = σp,∞ / Ep` (pretensado tras pérdidas, dato). `εcp` es la deformación de compresión que tiene el hormigón al nivel del tendón por el pretensado y las cargas permanentes: se obtiene con el propio motor, resolviendo **el plano de servicio** con el estado de la fase (`Plano_de_deformaciones` con N = −P, M = −P·e + Mperm, hormigón con su ley), y leyendo ese plano al nivel de cada tendón. Si se quiere simplificar, `εcp ≈ σc,p/Ec` con la fórmula lineal de la sección bruta.
- En ELU la secuencia es: (1) fijar `εp0`; (2) calcular `εcp` por tendón; (3) rotura y equilibrio con `e_i = εp0 + εcp`. No cambia `curvu`, solo el límite de la parte activa: rompe cuando `ε_plano(P) + e_i = εud`.
- Armadura pasiva y hormigón siguen con `e = 0`.
- **No adherentes y externos**: no hay compatibilidad con el plano. Se tratan como una acción (fuerza y excentricidad) más el incremento `Δσp,ULS`, o con un cálculo de deformación del elemento completo (EC-2 5.10.8 (2)-(3)). Fuera del motor seccional.
- **ELS** (fisuración, descompresión, EI): mismo `ε0_i`, materiales de servicio. La descompresión es la situación `εcp` = 0 en la fibra de cálculo.
- **Longitud de transferencia** en prefabricados pretesos: `εp0(x)` crece con la distancia al extremo. Es un dato por sección.

Dato nuevo en el modelo de sección: una lista de tendones `{x, y, Ap, material, σp∞}`, con `ε0` derivado.

### 8.3 Secciones evolutivas

**Qué hay que modelar.** Partes que entran en distintas fases (viga prefabricada + losa in situ, refuerzo con recrecido, sección compuesta). Cada parte `i` nace sin tensión en la fase `k_i`. Lo que vale en ese momento es el plano de deformaciones `π_{k−1}` de la sección **ya existente**; la parte nueva se deforma desde cero a partir de él.

**Algoritmo [P] (teoría de la deformación total, sin descarga):**
1. Fase 1: resolver el plano `π1` con las partes activas y las acciones `S1`. (`Plano_de_deformaciones`, ya existe.)
2. Al activar las partes de la fase `k`: fijar `ε0_i(P) = −π_{k−1}(P)` para esas partes, que es una función **lineal de la posición**, o sea `e_i`, `gy_i` y, si el plano es esviado, `gx_i`. De ahí que la pareja `(eps0, curv0)` del 3.1 sea la representación correcta, y que la versión esviada necesite el tercer término.
3. Fase `k`: resolver el plano `π_k` con todas las partes activas y las acciones **acumuladas**. Las partes antiguas ven `ε = π_k`, las nuevas `ε = π_k + ε0_i`.
4. Rotura en la fase final: igual que en `curvu`, con los límites sobre `ε_m` de cada parte.

**Qué asume.** Sin descargas ni histéresis: si una fibra ha plastificado o fisurado en una fase y descarga después, el modelo no lo recuerda. En ELU con rotura dúctil el resultado apenas depende de la historia; con rotura por compresión del hormigón, o en servicio, sí. Es una restricción a poner en la ayuda.

**Efectos diferidos [P, fase posterior].** Fluencia y retracción entran como más `ε0_i`: retracción como deformación impuesta (la diferencial entre hormigones de distinta edad es la que carga la junta), fluencia con módulo efectivo `Ec/(1+φ)` o, mejor, edad-ajustado `Ec/(1+χφ)` (Bažant, `χ ≈ 0,8`). El módulo de **Propiedades reológicas** ya calcula φ y retracción: el enlace natural es que cada fase del modelo traiga su φ(t, t0) y εcs(t). La junta entre hormigones (rasante, TT5) queda fuera del motor.

Dato nuevo: asignar a cada parte un número de fase y a cada fase unas acciones (N, M, y opcionalmente el tiempo).

### 8.4 Diagramas N-My con Mx constante

**Qué es.** Un corte de la superficie de rotura `(N, Mx, My)` por el plano `Mx = Mx0`. El 3.1 solo corta a N constante (§6.5).

**Planteamiento.** Un plano de deformaciones es un punto `(εr, κx, κy)` en tres dimensiones. La región de planos admisibles (ninguna fibra pasa su deformación límite) es un poliedro convexo; los planos **de rotura** son su frontera, una superficie de dos parámetros. El mapa frontera → fuerzas es la superficie de rotura. Fijar `N` y `Mx` son dos ecuaciones sobre una superficie de dos parámetros: quedan puntos aislados, normalmente dos (`My+` y `My−`).

**Algoritmo [P] (anidado, reutiliza todo lo que ya existe):**
```
para cada N de la barrida:
    contorno(N): para β en una malla [0, 2π):  (My, Mz)(β) = Momentos_Ultimos(N, β)   ← ya existe en TN6
    Mx(β) tiene un máximo y un mínimo en [0, 2π)
    para Mx0 dado:  buscar dos β con Mx(β) = Mx0 (bisección o regula falsi entre extremos)
    My = My(β*)  →  dos puntos (N, My±)
    si Mx0 > Mx,max(N): no hay solución para ese N, el corte termina ahí
```
Cada evaluación de `Momentos_Ultimos` ya contiene un `curvu`. Coste: `n_N × ~20 × curvu`. No lo he medido en JS; por el número de evaluaciones debería ser del orden de segundos, y no pide nada nuevo salvo el giro de la sección o, mejor, tener el plano en la forma de tres parámetros (§8.1) y no girar nada.

**Comprobación con prototipo (no forma parte de la app).** Sección 30×50 cm, 6D20, HA-25 en parábola-rectángulo, B500S, N = −1500 kN, plano general con malla de fibras, rotura por el intervalo `[xlo, xhi]` como en `determina_xmax_xmin`. Con 72 valores de β el contorno cierra, es simétrico respecto a My y **Mx(β) tiene un único máximo y un único mínimo**, de modo que `Mx = 60 kN·m` corta en exactamente dos puntos. Es lo que hace falta para que el bracketing sea seguro. (Para secciones con huecos o leyes no cóncavas puede haber más cruces; en ese caso se barre con malla fina antes de refinar.)

**Variantes.**
- N-Mx a My constante: simétrico.
- Corte a excentricidad `e = M/N` constante: se resuelve de otra forma (§8.5).
- Superficie completa 3D: malla en (N, β), y los cortes se interpolan sobre ella. Más caro pero sirve para pintar la superficie y para cualquier corte.

### 8.5 Diagramas N-ε

El 3.1 ya tiene uno (§6.4, N-elongación a M constante) con la limitación de parar en `0,95·Nu` (porque `Plano_de_deformaciones` trabaja «no de rotura»). Para generalizarlo hay que decidir tres cosas:

1. **Qué ε** va en el eje: la de la fibra más comprimida, la de la más traccionada, la de la armadura, la media (c.d.g.) o la «elongación» del 3.1. Todas salen del plano.
2. **Qué trayectoria**: `M = M0` (la del 3.1), `e = M/N` constante, `N` constante con `M` creciente (= M-κ), o una carga proporcional cualquiera `(N, M) = λ·(N1, M1)`.
3. **Qué hay en la rama descendente**: con control de fuerza no se puede pasar del máximo de la curva.

**Algoritmo [P].** Control por deformación: se fija `ε_ctrl` en la fibra elegida y se barre entre 0 y la rotura. Para cada valor hay una incógnita (`κ`) y una ecuación de trayectoria (`M − M0 = 0`, o `M − e·N = 0`). Se resuelve por bracketing en `κ` partiendo del punto anterior (continuación). Como `ε_ctrl` es la variable de control, sirve para trayectorias con máximo: la curva sigue después del pico hasta el agotamiento de un material, sin el 0,95 de margen. N y M salen de `calcula_Ne` y `calcula_My`.

En flexión recta esto es una barrida del plano por `(ε_ctrl, κ)`, con un solo nivel de iteración. Con esviada o pretensado la incógnita de `κ` pasa a vector, pero el control sigue siendo una sola deformación.

Se puede añadir **tension-stiffening** a esta curva (es lo que insinúa la casilla del 3.1) como una ley de tracción del hormigón entre fisuras (a tomar de la fisuración y las flechas de cada norma, que no he revisado para esto); lo recomendable es hacerlo como material, no como rama del algoritmo.

## 9. Cómo llegar a ello desde el motor web actual [JS → P]

El motor `src/core/seccion.js` (equivalente a calcomun en flexión recta) cubre §5 y §6.1–6.2. Para llegar a los cuatro casos, por orden de menor a mayor cambio:

| Paso | Cambio en el motor | Qué desbloquea |
|---|---|---|
| 1 | `eps0` (y `curv0`) por parte, sumado a la deformación del material y a los límites de rotura. Solo flexión recta. | Pretensado adherente en ELU y ELS. Evolutivas de una fase. |
| 2 | Calcular `εcp` con el propio motor (plano de servicio por tendón) y la tabla de tendones. | Pretensado completo. |
| 3 | N-ε por control de deformación (§8.5), sin tocar el núcleo. | Diagramas N-ε. |
| 4 | Fases: asignar fase a cada parte, resolver planos en cadena, `ε0` desde el plano anterior. | Evolutivas. |
| 5 | Plano de tres parámetros y trapecios/polígonos con recorte S-H. | Esviada, N-My a Mx constante, pretensado esviado. |
| 6 | Efectos diferidos (φ, εcs por fase). | Evolutivas en servicio. |

Los pasos 1–3 se pueden hacer sobre el motor actual sin esviada.

**Validación.** `EHE.exe` está en la carpeta de la versión 3.1, así que se puede construir una batería de secciones y compararla punto a punto (κu, xm, Mu, N, EI, N-elongación). Un caso fácil para pretensado y evolutivas es comparar contra un cálculo a mano de una viga con un tendón centrado (compresión simple y descompresión) y contra una sección compuesta de dos partes de igual material, que en ELU debe dar lo mismo que la sección monolítica si la rotura es dúctil.

## 10. Decisiones que necesito de José Luis antes de implementar

1. **Pretensado**: ¿solo armadura adherente (pretesa y postesa inyectada), o también no adherente y exterior con `Δσp,ULS`? Recomendación: adherente primero.
2. **Evolutivas**: ¿qué fases hay en el uso real (prefabricado + losa, refuerzo, otras)? ¿Cargas de fase 1 características o de cálculo? Recomendación: características en servicio, de cálculo solo para ELU, como pide la norma de cada caso.
3. **N-ε**: ¿la ε que se quiere ver es la de la fibra extrema, la de la armadura o la media?, ¿qué trayectorias (M constante, e constante, proporcional)? ¿Interesa la rama descendente?
4. **N-My a Mx constante**: ¿hace falta la superficie 3D completa, o basta el corte? Recomendación: corte, y la superficie solo si se pide.
5. **Esviada**: como depende del paso 5, ¿se hace antes o después de pretensado y evolutivas? Recomendación: después.

---
*Fuentes: `Version 3.1\calcomun.pas` (1431 líneas), `Marin.pas`, `marinvar.pas`, `PIH_TIPOS.pas`, `pih_lee.pas`, `pih_manipuleo.pas`, `comun_TN.pas`, `TN3.pas`, `TN6.pas`, `Unit4.pas`; EHE-08 42.1.2 (texto de `ehe-08/texto.txt`, pág. 191); UNE-EN 1992-1-1:2013 apartados 3.3.6 y 5.10 (`ec2-2004-an/`); `prontuario-web/src/core/seccion.js`, `momentoCurvatura.js`, `geometria.js`.*
