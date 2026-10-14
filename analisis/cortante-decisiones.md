# Módulo Cortante: decisiones y estado (fase 1, EHE-08)

Estado (14/10/2026): fase 1 construida y **sin commit** (a la espera de José Luis). Parte de `analisis/cortante-plan.md`. Solo está migrada la EHE-08; con EC-2 2004+AN o EC-2 2023 la pantalla avisa y ofrece pasar el proyecto a EHE-08 (fases 2 y 3 del plan).

## Qué hay
- Núcleo: `prontuario-web/src/norma/cortante/ehe08.js` (MPa, mm, kN; compresión positiva). `comprobar`, `dimensionar`, `cotOptimo`.
- Datos de sección: `datosCortante()` en `src/io/proyecto.js` (rectangular, T, pilar, circular).
- Pantalla: `src/ui/vistas/cortante.js`, dibujo `src/ui/dibujoCortante.js`, textos `src/i18n/cortante.es.js` y `.en.js`; entrada en ELU → Cortante.
- Pruebas: `tests/cortante.test.js` (18) y puerto del TT1 del 3.1 en `tests/ref31/tt1.js`. `npm test` completo: 132 en verde. `npm run test:pantalla`: encaja a 1536×730 y 1366×657 (8 pantallas nuevas en `tools/encaje.mjs`).
- Casos para contrastar con EHE.exe: `analisis/cortante/casos-ehe31-app.csv` (resultados del módulo para los 10 casos de `casos-ehe31.csv`, mismas columnas), generado con `node tools/casosCortante.mjs`.

## Decisiones de José Luis (14/10) aplicadas
Una pantalla que cambia con la norma · tope fyd 400 MPa solo en EHE-08 · M_Ed opcional · V_Ed lo escribe el usuario · ρl y A_sl de la sección, editables en el módulo, ρl topado a 20 ‰ (con aviso) · acero de cercos propio · viga rectangular, T, pilar y circular (A_sl = 0 por defecto en pilar y circular) · mínimo de V_cu de la EHE-08 aceptado · circular con d = D/2 + (D/2 − r)·0,707 · tabla de cercos Ø8–Ø20 (serie del proyecto, Ctrl+K) con s ≤ 300 mm de 50 en 50 · cercos circulares × 0,85 activo por defecto.

## Defaults que he elegido (cambiables)
- **Circular: b₀ = 2·√((d/2)² − (d/4)²) = 0,866·d** (fórmula de José Luis, 14/10: cuerda a d/4 del centro); editable en «Datos de cálculo».
- **V_Ed inicial 120 kN**, cotθ inicial 1, cercos ø8 2 ramas a 200 mm.
- **Ramas en la tabla de dimensionamiento**: 2 si b₀ < 500 mm, 4 si no (regla del 3.1); circular, 2.
- **Pilar rectangular**: el cortante va paralelo al lado h (b₀ = b, d = h − r) o al b, a elegir; d = lado − recubrimiento mecánico del grupo perimetral.
- **σ'cd con armadura comprimida (pilares y circular)**: A's = toda la armadura de la sección, editable. Solo descuenta con axil de compresión y no baja de 0 (con N < A's·fyd no se puede suponer toda la armadura a fyd; sin esta cota, un pilar con N = 0 salía con «tracción»). Con tracción (N < 0) no descuenta nada.
- **z = 0,9 d** siempre; con compresiones grandes la EHE-08 recomienda un cálculo preciso (aviso en Aclaraciones).
- **θe**: método simplificado (con σ_y opcional, compresión +). El método general (ε_x) pide M_Ed y queda para la fase 4; por eso M_Ed **no aparece** todavía en la pantalla.
- **cotθ óptimo**: en comprobación, el que da mayor Vu = mín(Vu1, Vu2); en dimensionamiento, el que pide menos armadura entre los que cumplen Vu1 (rejilla de 0,01).
- **Veredicto** en comprobación: «No cumple» si V_Ed > Vu; «Revisar detalles» si cumple pero la armadura es menor que la mínima o la separación pasa de la permitida; si no, «Cumple». A diferencia del 3.1, la separación excesiva **no rebaja Vu**: avisa.

## Diferencias con el Prontuario 3.1 (a documentar en el módulo Ayuda)
1. Mínimo de V_cu (sin β): con poca cuantía da ≈ 10 % más (caso 1: 176,2 kN en vez de ≈ 167 kN).
2. K por tramos del axil con la compresión positiva (el 3.1 usaba 5/3·(1 + σ/fcd) con tracción positiva).
3. σ'cd neto de la armadura comprimida; ξ ≤ 2; fcv ≤ 60 MPa sin cercos y hasta 100 con cercos.
4. Armadura mínima f_ct,m/7,5·b₀ (en el 3.1, 0,02·fcd·b₀) y separaciones de 44.2.3.4.1 (600/450/300 mm con 0,75/0,60/0,30·d·(1 + cotα)).
5. Cercos circulares × 0,85.
6. Se calcula ΔT y el decalaje s_d de la ley de momentos (el 3.1 no).

## Puntos de la EHE-08 verificados por José Luis (14/10)
- σ'cd ≤ 0,30·fcd ≤ 12 MPa (44.2.3.2.1.2): correcto.
- El mínimo de V_cu **no lleva β**: V_cu = máx[fórmula general·β ; mínimo]. (Antes lo multiplicaba por β; ahora con cotθ ≠ θe el hormigón sigue aportando el mínimo, p. ej. caso 1 con cotθ 2: 85,7 kN.)
- **ΔT = V_rd·cotθ − (V_su/2)(cotθ + cotα)** (44.2.3.4.2); decalaje s_d = z·ΔT/V_rd (con V_su = 0, θ = 45°: s_d = z).
- z = 0,9·d en todos los casos.
- Tope de 400 MPa: comentario al 40.2 (deformación del tirante limitada a 2 ‰, σ_s = 400 MPa).
- cotθe del método simplificado: coincide con la ecuación que pegó (entre 0,5 y 2,0).
- Circular: b₀ = 2·√((d/2)² − (d/4)²) = 0,866·d.

## Pendiente (fases del plan)
EC-2 2004+AN (fase 2) y EC-2 2023 (fase 3) con la misma pantalla; método general de θe y M_Ed (fase 4); cálculo de z con compresiones grandes; ancho efectivo y d de la circular que fije José Luis; resultados de EHE.exe para los 10 casos (comparar con `casos-ehe31-app.csv`); enlace con Vigas (V(x)); ayuda del módulo.
