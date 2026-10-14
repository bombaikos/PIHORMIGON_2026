# Anclaje y solape (módulo nuevo, familia ELU) — estudio normativo y plan

Estado (12/10/2026): estudio hecho, núcleo de cálculo en borrador y validado contra la guía DGC; **sin pantalla ni commit todavía**. Pendiente de las respuestas de José Luis (sección 7).

Código: `prontuario-web/src/norma/anclaje.js` (`anclaje()`, `solape()`) y `tests/anclaje.test.js` (10 pruebas con valores de las tablas de la guía DGC, todas pasan). Texto de la guía DGC copiado en `analisis/normativa/guia-dgc-anclaje-solape/texto.txt`.

## 1. Fuentes por norma (apartado y línea de `texto.txt`)

| Tema | EHE-08 | EC-2 2004 + AN | EC-2 2023 | CE |
|---|---|---|---|---|
| Posición / adherencia | 69.5.1.1 (l.15856) | 8.4.2 y fig. 8.2 (l.6003) | 11.4.2(4), fig. 11.4 (l.7325) | 49.5.1.1 (ce-hormigon l.4167) |
| Longitud básica | 69.5.1.2 (l.15907): vía viga `lb = m·φ² ≥ fyk/20·φ` (pos. I), `1,4·m·φ² ≥ fyk/14·φ` (pos. II); vía corrugas `lb = φ·fyd/(4·τbd)`, `τbd = 2,25·η1·η2·fctd` | 8.4.3 (8.3), 8.4.2 (8.2) (l.6003-6045) | 11.4.2(3), fórmula (11.3), Tabla 11.1 NDP (l.7340-7400) | 49.5.1.2 (l.4206): vía viga, igual que EHE-08 |
| Longitud neta | `lb,neta = lb·β·As/As,real` (β: Tabla 69.5.1.2.b; o β = α1…α5, Tabla 69.5.1.2.c, l.16040-16090); mínimo: máx(10φ; 150 mm; lb/3 en tracción, 2lb/3 en compresión) | 8.4.4 (8.4)-(8.7) (l.6046): `lbd = α1α2α3α4α5·lb,rqd ≥ lb,min = máx(0,3 lb,rqd; 10φ; 100)` (compr.: 0,6) | (11.3) ya incluye σsd, cd y fck; ≥ 10φ. Patilla/gancho: −15φ (11.4.4(1), l.7481); U: −20φ | 49.5.1.2 (l.4206) |
| Solape | 69.5.2.2 (l.16220): `ls = α·lb,neta`, α por % solapado (20, 25, 33, 50, >50) y distancia a entre empalmes (≤10φ, >10φ); compresión α = 1. φ > 32 mm: solo con estudio especial | 8.7.3 (8.10), (8.11), Tabla 8.3 (l.6229): `l0 = α1α2α3α5α6·lb,rqd ≥ máx(0,3 α6 lb,rqd; 15φ; 200)`, `α6 = √(ρ1/25)` entre 1 y 1,5 | 11.5.2(2), Tabla 11.3 (l.7707, 7746): `lsd = kls·lbd ≥ 15φ`, **kls = 1,2 (NDP, sin AN español)**. El % de barras solapadas ya no cambia la longitud | 49.5.2.2 (l.4388): idéntico a EHE-08 |
| Armadura transversal en el solape | 69.5.2.2: sección ≥ la de la mayor barra solapada | 8.7.4 (l.6251): solo si φ ≥ 20 o % ≥ 25; ΣAst ≥ As | 11.5.2(1) y (10): igual (φ < 20 o % < 25 no exige) | — |
| Otras reglas | 100 %-50 %: no limita en el articulado | 8.7.2(4): 100 % en una capa, 50 % en varias | 11.5.2(4)-(5): 100 % fuera de rótulas plásticas; en rótulas, ≤ 35 % (lineales) / 50 % (planos) o longitud con 1,2·σsd | — |

Anejo Nacional español (EC-2 2004): no cambia nada del cap. 8 salvo 8.2(2), 8.3(2) (mandriles, Tabla AN/10), 8.6(2) (recomendado) y 8.8(1) (φlarge = 32). αct = 1,00 (AN 3.1.6(2)P, l.9718), γc = 1,5, fyk ≤ 500 (AN 3.2.2(3)P). La Tabla 8.2 y el resto de 8.4/8.7 valen tal cual.

El acero solo entra por **fyk** (400 o 500) y γs = 1,15. B 500 S y B 500 SD dan lo mismo (m es igual para S y SD en la Tabla 69.5.1.2.a; en EC-2 no interviene la ductilidad).

## 2. ¿Hace falta el CE? (valoración)

- **CE art. 49.5 = vía «ensayo de la viga» de la EHE-08 69.5** (misma `m`, `β`, `α`, mínimos 10φ / 150 mm / lb/3). Si el acero está certificado así (CE 34.2) y se proyecta con EC-2, el CE exige 49.5 y no el EC-2 (49.5, l.4156-4165).
- **CE Anejo 19, 8.4-8.9 = EC-2 2004** (vía «geometría de corrugas»), según la guía DGC (§1.1 y §4): «coincide con pequeños matices». Sus ecuaciones son imagen del BOE (págs. 98407-98414), el texto extraído coincide en estructura con el EC-2.
- **Guía DGC de anclaje y solape (abril 2022)**: para carreteras del Estado se calcula con EC-2 cap. 8 **y además** con el Anejo 19; la OC 1/2019 lo exige y la guía recomienda que el cuadro de especificaciones fije «adherencia por geometría de corrugas (UNE-EN ISO 15630-1)». Compara CE 49.5 con EC-2: **49.5 da más** con fck ≥ 55 MPa y con φ32 en cualquier fck; da menos con fck < 55 y φ ≤ 25 (Tablas 23-26; conclusiones §4). En solapes, 49.5 da más con fck > 35 MPa.
- **Propuesta**:
  1. En **EHE-08** el módulo ofrece las dos vías (viga / corrugas) y rotula la de la viga «EHE-08 69.5 = CE 49.5».
  2. En **EC-2 2004 + AN**, línea de **contraste «CE 49.5»** (plegada) con el valor de la vía de la viga y aviso en rojo cuando es mayor que el del EC-2 (fck ≥ 55, φ32, etc.). No es una cuarta norma: es la indicación que da la guía DGC.
  3. En **EC-2 2023** no hay equivalente del CE (el Anejo 19 sigue al EC-2 de 2004): no se muestra contraste.
  Esto respeta la decisión del 11/10 («CE solo como indicación, citando las guías DGC») y la amplía a este módulo, que es donde el CE tiene método propio.

## 3. Formulación implementada (resumen)

- EHE-08 vía viga: `m` por fck (25…≥50) y familia de acero (B 400 / B 500); `lbI = máx(m φ²; fyk/20 φ)`, `lbII = máx(1,4 m φ²; fyk/14 φ)`; `lb,neta = máx(lb·β·r; 10φ; 150; lb/3)`; β = 0,7 solo en patilla, gancho o U con recubrimiento perpendicular > 3φ.
- EHE-08 vía corrugas y EC-2 2004: `fbd = 2,25·η1·η2·fctk,0,05/γc` (fctk,0,05 limitado a fck 60), `lb = φ/4·σsd/fbd`, `σsd = r·fyd`, α1 y α2 (cd). Patilla: `lb,eq = α1·lb,rqd` (8.4.4(2), como la guía DGC).
- EC-2 2023: (11.3) con klb = 50, nσ = 3/2 (valores recomendados), kcp = 1 / 1,2; reproduce la Tabla 11.1 (prueba). Patilla/gancho: −15φ.
- `r` = As,req/As,real ≈ σsd/fyd, entre 0 y 1.
- **No incluido todavía**: confinamiento (α3, α4, α5 = 1; conservador), grupos de barras (EHE 69.5.1.3 / EC-2 11.4.3), mallas, soldadura, mecánicos, efectos dinámicos (+10φ en EHE-08/CE 49.5.1.1), barras de gran diámetro (EC-2 8.8), posiciones del solape en rótulas (EC-2 2023).

## 4. Pruebas realizadas

**Validación**: el núcleo reproduce, dentro de ±1 mm, las tablas de la guía DGC (fyk = 500, γc = 1,5, σsd = fyd): Tabla 1 (lb,rqd), 8-9 (lbd recta), 10 y 14 (patilla), 17-18 (solape EC-2), 23-24 (lb CE), 30-32 (lb,neta CE), 49 y 51 (solape CE); y la Tabla 11.1 del EC-2 2023.

**Sensibilidad** (HA-40, B 500 SD, φ 20, tracción, barra recta; EHE-08 vía viga / EC-2 2004 / EC-2 2023):

| Variable | Efecto | ¿Dónde va? |
|---|---|---|
| Posición II frente a I | ×1,43 / ×1,43 / ×1,20 (500→714; 524→748; 731→878) | **Columnas de la tabla** (lo pidió José Luis) |
| % solapado 25 → 100 % | EHE (a > 10φ): 550→700 (+27 %); EC-2 2004: 524→786 (+50 %); EC-2 2023: **sin efecto** | **Columnas de la tabla de solape** (25, 33, 50, 100 %; en EC-2 2023 una sola columna con aviso) |
| Distancia a entre empalmes (≤10φ / >10φ) | EHE-08/CE: 50 % → α 1,8 frente a 1,3 (+38 %); EC-2: no existe | **Dato fijo**, solo con EHE-08 |
| As,req/As,real (r) 100 → 60 % | EHE y EC-2 2004: ×0,60 (hasta el mínimo); EC-2 2023: ×0,47 (potencia 3/2) | **Dato fijo** (por defecto 100 %). No va en tabla: es una escala y en EC-2 2023 no es lineal |
| Recubrimiento cd 25 → 70 mm | EC-2 2004: 568→413 (−27 %); EC-2 2023: 865→517 (−40 %); EHE vía viga: nada | **Dato fijo** (EC-2 y EHE vía corrugas); vacío = no se reduce |
| Forma: recta / patilla-gancho-U | EHE y EC-2 2004: ×0,7 si cd > 3φ; EC-2 2023: −15φ (731→431) | **Columnas** (recta, patilla/gancho/U) |
| Tracción / compresión | EHE: igual lb, mínimo 2/3 lb; EC-2 2004: α2 = 1 y mínimo 0,6 lb | **Dato fijo** (selector); en compresión no hay patilla |
| Vía de adherencia (solo EHE-08) | φ12: 300 frente a 252; φ20: 500 frente a 524; φ32: 1126 frente a 931 | **Dato fijo** (selector «Ensayo de la viga / Geometría de corrugas») |
| fck (hormigón) y acero | claros | **Dato fijo**, de los materiales del proyecto |

Tablas de ejemplo (HA-40, B 500 SD, cd = 35 mm, r = 100 %, a > 10φ), mm:

| φ | EHE-08 viga: I recta / II recta / ls I 50 % | EC-2 2004: I recta / II recta / ls I 50 % | EC-2 2023: I recta / II recta / ls I (todo %) |
|---:|---|---|---|
| 12 | 300 / 429 / 390 | 252 / 360 / 357 | 287 / 344 / 344 |
| 16 | 400 / 571 / 520 | 388 / 554 / 549 | 486 / 583 / 583 |
| 20 | 500 / 714 / 650 | 524 / 748 / 741 | 731 / 878 / 878 |
| 25 | 688 / 963 / 894 | 693 / 990 / 980 | 1101 / 1321 / 1321 |
| 32 | 1126 / 1577 / 1464 | 931 / 1330 / 1316 | 1731 / 2078 / 2078 |

El EC-2 2023 sale bastante más largo que el 2004 y el CE: coincide con su Tabla 11.1 (40-46 φ para fck 40-30 con φ 20) frente a 30-36 φ del lb,rqd del EC-2 2004, pero conviene que José Luis lo vea antes de fiarse.

## 5. Propuesta de pantalla (tres columnas, estilo Durabilidad / Fuego, guía § 14-16)

- **Datos** (arriba a la izquierda, título de cada selector en su propia línea): Hormigón y Acero (del proyecto; «B 500 S», «B 500 SD»), Adherencia certificada (solo EHE-08), Esfuerzo (tracción / compresión), Armadura necesaria / dispuesta (%), Recubrimiento de cálculo cd (mm; EC-2 y EHE vía corrugas), Distancia entre empalmes a (≤10φ / >10φ; solo EHE-08). Chip de norma como siempre (EC-2 2004+AN por defecto, rojo si no vigente).
- **Resultado** (tablas, desplegables chocolate): «Anclaje» (filas φ 6-40; columnas posición I favorable y II desfavorable, cada una con recta y patilla/gancho/U) y «Solape» (filas φ; columnas % solapado 25 / 33 / 50 / 100 %, en posición I y II). Mínimos aplicados señalados. Contraste CE 49.5 plegado cuando la norma es EC-2 2004.
- **Dibujo** (acotado, sin escala): viga con la zona de adherencia deficiente sombreada según la norma (para el canto h), barra con lb acotada, solape con a, 4φ y separación libre.
- **Notas plegadas**: cada resultado con su apartado; armadura transversal en solapes; escalonado de solapes (0,3 l0 en EC-2; lb en EHE-08); φ > 32 sin solape (EHE-08/CE); qué falta (confinamiento, grupos, mallas).

## 6. Hecho / por hacer

Hecho: núcleo `anclaje()`/`solape()` para las tres normas (vía viga y corrugas), 10 pruebas, estudio. Por hacer cuando José Luis responda: contraste CE, pantalla (`src/ui/vistas/anclaje.js`, entrada en `MENU`/`VISTAS` de `app.js`), claves i18n, dibujo, prueba de pantalla en `tools/encaje.mjs`, revisión de valores contra BOE/PDF.

## 7. Preguntas abiertas (con propuesta)

1. **Contraste CE 49.5** dentro de EC-2 2004 (plegado, con aviso si es mayor): propuesta, sí.
2. **cd**: dejarlo vacío por defecto = «no se reduce» (α2 = 1) o precargar el recubrimiento de la sección activa: propuesta, vacío con nota.
3. **Vía de adherencia de la EHE-08**: propuesta, «Ensayo de la viga» por defecto (es la del Prontuario 3.1), con la otra seleccionable.
4. **Compresión con EC-2 2004**: la norma no distingue en α6; se aplica α6 también en compresión (literal, conservador). Alternativa: α6 = 1.
5. **Patilla en EC-2 2004**: `lb,eq = α1·lb,rqd` (simplificado, como la guía DGC) frente a `α1·α2` (fórmula completa, menor). Propuesta: simplificado.
6. **Rango de φ**: 6-40 mm. Con φ > 32 el solape se marca «estudio especial» (EHE-08/CE) o se aplican las reglas de 8.8 (EC-2).
