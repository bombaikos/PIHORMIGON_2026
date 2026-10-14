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

## Fase 2: EC-2 2004 + AN (14/10) — `src/norma/cortante/ec2-2004.js`
Misma pantalla; la norma del proyecto elige el núcleo (`norma/cortante/index.js`). EC-2 2023 sigue sin migrar (aviso con botones para pasar a EC-2 2004 o a EHE-08).
- **Sin cercos**: V_Rd,c = [0,18/γc·k·(100ρl·fck)^(1/3) + 0,15σcp]·bw·d con mínimo del AN (ν_mín = 0,075/γc·k^(3/2)·fck^(1/2), fck ≤ 60), k ≤ 2, ρl ≤ 0,02, σcp ≤ 0,2 fcd (6.2.2(1), AN).
- **Con cercos**: solo celosía, **sin aporte del hormigón**: V_Rd,s = (A_sw/s)·z·f_ywd·(cotθ+cotα)·senα; V_Rd,máx = α_cw·bw·z·ν1·fcd·(cotθ+cotα)/(1+cot²θ); z = 0,9d; 0,5 ≤ cotθ ≤ 2,0 (AN). Sin tope de 400 MPa en f_ywd (ese tope es solo de la EHE-08).
- **ν1** (AN 6.2.3(3)): 0,6(1 − fck/250); si la tensión de cálculo de los cercos es < 0,8 fyk, 0,6 (fck ≤ 60) o 0,9 − fck/200 ≥ 0,5. Con B 500 S a plena carga (434,8 MPa > 400) vale 0,528 en HA-30; con cortante pequeño los cercos trabajan menos y vale 0,6. La comprobación usa la tensión que pide V_Ed; el dimensionado sube la armadura si hace falta para entrar en 0,6.
- **α_cw = 1** siempre (no pretensado); el axil no lo modifica. *Criterio mío, a confirmar con José Luis*: la nota 3 de 6.2.3(3) define α_cw también con σcp de «la fuerza axil de cálculo» (1 + σcp/fcd hasta 1,25); usar 1 es conservador.
- **Mínima**: ρw,mín = fctm/(7,5·fyk) (AN 9.2.2(5)); en cercos inclinados, el 33 % de la armadura en cercos (AN 9.2.2(4)), solo aviso.
- **Separaciones** s_l,máx como la EHE-08 pero con V_Rd,máx (AN 9.2.2(6)); entre ramas ≤ d y ≤ 500 mm (AN 9.2.2(8)).
- **Armadura longitudinal**: ΔF_td = 0,5·V_Ed·(cotθ − cotα) (6.18) y decalaje a_l = z(cotθ − cotα)/2 (9.2.1.3(2)); sin cercos a_l = d.
- Se ocultan los datos que el EC-2 no usa: σy (θe) y A's, y la reducción ×0,85 de cercos circulares. b_w, d y z se calculan como en la EHE-08 (circular incluida, criterio del Prontuario).
- Contrastado con el plan §3 (viga 30×50 d = 500): V_Rd,c = 91,3 kN; V_Rd,s = 98 / 148 / 197 kN con cotθ 1 / 1,5 / 2; V_Rd,máx = 713 kN (ν1 = 0,528); con cotθ = 2 y f_yd igual coincide con la EHE-08. Tests en `tests/cortante.test.js`.
- No incluido (como en la EHE-08): carga próxima al apoyo (β = a_v/2d, 6.2.3(8)), pretensado, vainas, rasante alas-alma, torsión.

## Pendiente (fases del plan)
EC-2 2023 (fase 3) con la misma pantalla; método general de θe y M_Ed (fase 4); cálculo de z con compresiones grandes; ancho efectivo y d de la circular que fije José Luis; resultados de EHE.exe para los 10 casos (comparar con `casos-ehe31-app.csv`); enlace con Vigas (V(x)); ayuda del módulo.
