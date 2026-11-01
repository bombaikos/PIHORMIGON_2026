# ELS ▸ Flechas: plan y decisiones

Estado: **plan aprobado por Pepiño el 01/11/2026; sin código todavía.** Fuente: `flechas.pas`, `flechas.dfm` y `flechas.dcu` del Prontuario 3.1 (módulo «D1. Estado límite de deformación en vigas»).

## Qué hacía el 3.1 (EHE-98, art. 50)
- **Datos:** sección del proyecto (Ib, If, IfisNeg, Ec, fck), ρ y ρ' en ‰ (editables), luz L, 6 casos de vinculación (biapoyada, empotrada-apoyada, apoyada-empotrada, biempotrada, dos voladizos), tres instantes t1 < t2 < t3 (días) y por cada uno cargas puntuales, momentos, uniformes y trapezoidales. 51 puntos a lo largo de la viga.
- **Método (Branson, rigidez única por viga):**
  1. Ma = momento en centro de vano (en el empotramiento para voladizos), acumulado: Ma1, Ma1+Ma2, Ma1+Ma2+Ma3.
  2. Ie = k·Ib + (1−k)·If, k = (Mf/Ma)³, tope Ib; Mf = fct,fl·Wb con fct,fl = 0,37·fck^(2/3) (MPa); Wb de la fibra traccionada (cara negativa en voladizos).
  3. EIj = Ec·Iej (Ec constante).
  4. Flechas instantáneas por superposición: δi(q1) con EI1; δi(q2) = δ(q1+q2, EI2) − δi(q1); δi(q3) con EI3; δi(*) = incremento por degradar la rigidez de EI2 a EI3 en las cargas q1+q2 (δ(q1+q2, EI3) − δ(q1+q2, EI2)).
  5. Diferidas: λ = ξ/(1+50ρ') con ρ' en tanto por uno; ξ interpolado en 14 d: 0,5; 28 d: 0,7; 90 d: 1,0; 180 d: 1,2; 360 d: 1,4; 1800 d: 2. χ(t0,tf) = ξ(tf) − ξ(t0). δd(q1) = δi(q1)·λ(t1→t3); δd(q2+*) = (δi(q2)+δi(*))·λ(t2→t3).
  6. Total = instantáneas + diferidas. Activa = total − δi(q1)·(1+λ(t1→t2)).
- **Resultados:** deformada con componentes, máximos total y activa con posición y L/δ, Ib, If, Ie1–Ie3, tabla por abscisa (copiable).
- **Canto mínimo:** pestaña aparte, tabla 50.2.2.1 (ver más abajo).
- **Limitaciones del 3.1:** Ie única (centro de vano), sin retracción, ξ fijo sin humedad/espesor, sin tension stiffening, sin límite admisible.

## Decisiones (Pepiño, 01/11/2026)
1. **EHE-08:** se hace lo que había en el 3.1 (Branson, tres hitos, sin retracción).
2. **EC-2 2004+AN y EC-2 2023:** el mismo esquema más la **flecha por retracción**. Rec viga y Rec T: se pregunta la **armadura como dato de cálculo** (el dato del módulo, no la de la sección). Genéricas: la armadura definida en la sección.
3. **Historia de cargas:** tres hitos (t1, t2, t3), como en el 3.1. «Muy ingenieril».
4. **Canto mínimo:** pestaña aparte (cálculo simplificado), **una pestaña por norma**. EHE-08, EC-2 2004+AN y EC-2 2023 son tres cálculos distintos.
5. **Fuera de alcance:** forjados de viguetas y de losas alveolares (h_mín = δ1·δ2·L/C, tabla 50.2.2.1.b). Rec viga y Rec T son lo que cubre el módulo; las losas sin vigas sobre apoyos aislados no entran de momento.
6. **Tension stiffening:** el módulo de Estado tensional no lo trata; corresponde a Flechas (EC-2 7.4.3, ζ). Por verificar contra el texto antes de programar.

## Canto mínimo por norma (por verificar fórmula a fórmula al programar)
- **EHE-08, art. 50.2.2.1 (pág. 248, `ehe-08/texto.txt` l.12099–12250):** tabla 50.2.2.1.a (ρ = 1,5 % / 0,5 %): biapoyada 14/20; continua un extremo 18/26; continua ambos extremos 20/30; voladizo 6/8. Extremo continuo si su momento ≥ 85 % del de empotramiento perfecto. T con ala/alma > 3: ×0,8. Expresiones generales con fck, ρ0 = √fck·10⁻³, ρ, ρ' y factor 310/σs (310/σs ≈ 500/fyk · As,nec/As,real; verificar). Valores de tabla para fck = 30.
- **Discrepancia con el 3.1:** el 3.1 interpolaba entre 4 ‰ y 12 ‰; la norma da 5 ‰ y 15 ‰. Se corrige en el módulo nuevo. El 3.1 no aplicaba el 0,8 de las T.
- **EC-2 2004+AN, 7.4.2 (`ec2-2004-an/texto.txt` l.5704):** ecuaciones (7.16.a/b), K por sistema (Tabla 7.4N: 1,0 / 1,3 / 1,5 / 0,4), ρ0 = √fck·10⁻³, factor 310/σs (7.17), alas ×0,8 (b/bw > 3), 7/l y 8,5/l con tabiques frágiles. K en el AN: l.9544.
- **EC-2 2023, 9.3.2 (`ec2-2023/texto.txt` l.6794):** tabla 9.3 con ωr = As,req/(bw·d)·fyd/fcd (0,1/0,2/0,3) y proporción sobrecarga/carga total (30/45/60 %), l/250; ×250/a para otro límite; extrapolación a otras vinculaciones por raíz cúbica del cociente de flechas elásticas. 9.3.3 (cálculo simplificado con sección bruta): fuera por ahora.

## Decisiones adicionales (Pepiño, 01/11/2026)
7. **EHE-08, inercia de referencia:** ponderación 25-50-25 (art. 50.2.2.2): vano extremo con un solo apoyo continuo Ie = 0,75·Iec + 0,25·Iee; vano interior Ie = 0,50·Iec + 0,25·Iee,izq + 0,25·Iee,der; biapoyada, centro de vano; voladizo, arranque.
8. **EC-2 (2004+AN y 2023):** se estudia la integración de curvaturas a lo largo de la viga (ζ por sección), con pocos puntos (del orden de 10 a 51). Coste de cálculo previsto: despreciable (ms). Por confirmar al programar.

## Pendiente de decidir
- Flecha por retracción: método exacto (EC-2 7.4.3(6), curvatura por retracción con S y I de sección fisurada y sin fisurar, ζ) y datos (humedad, espesor, cemento, εcs); ver `core/reologia.js`.
- Qué hace Branson en las normas nuevas con tres hitos y retracción (se aplica ζ en vez de Branson o se mantiene Branson).
- Número de puntos de integración en EC-2 (10, 21 o 51 como el 3.1).
- Límites admisibles (L/250, L/400): ¿solo calcula o compara?
