# Inestabilidad de soportes: decisiones y pendientes

Módulo ELU ▸ Inestabilidad de soportes (`prontuario-web/src/ui/vistas/inestabilidad.js`; motor en `src/core/pandeo.js` y `src/norma/inestabilidad.js`; tests en `tests/inestabilidad.test.js`). Rama `inestabilidad-soportes`. Decidido con Pepiño y José Luis el 31/10/2026.

## Alcance decidido
- **Es la Flexión compuesta recta más los datos propios del segundo orden.** Misma sección (Rec pilar o circular, de Secciones), mismo contorno N–M, misma cápsula Comprobación | Dimensionamiento.
- **Diagrama como en el 3.1: el segundo orden es una reducción.** Se dibuja el contorno sin segundo orden (a trazos) y el contorno reducido (continuo): a cada axil se le resta el momento de segundo orden ΔM = M_Ed − M0eq que le corresponde (`contornoReducido`). Un punto (N, M0eq) dentro del contorno reducido equivale a M_Ed ≤ M_Rd. Los saltos del contorno reducido son los de los criterios de la norma (esbeltez límite, fluencia ignorable).
- **Flexión esviada: descartada.** Solo flexión recta (un plano; para el otro plano, una sección girada).
- **Método de segundo orden:** EHE-08 con el método aproximado de 43.5.1 (excentricidad ficticia e_a); EC-2 2004+AN y EC-2 2023 con **curvatura nominal** (5.8.8; O.7). La rigidez nominal queda para otra fase. El método general (λ de 100 a 200 en EHE-08) no se incluye: se avisa.
- **Extremos por rigidez, sin momentos de vigas.** Cada extremo: Empotrado (Ψ = 0), Articulado (Ψ = ∞) o Nudo con el soporte contiguo y hasta dos vigas (b, h, luz). Ψ = Σ(fp·I/L)soportes / Σ(fv·I/L)vigas con inercia bruta; fracciones por defecto 0,70 (pilares) y 0,30 (vigas). Los voladizos no aportan rigidez (luz 0).
- **El usuario dice si el pórtico es intraslacional o traslacional.**
- **Esfuerzos:** N_Ed y los momentos de primer orden en los dos extremos del soporte (M_A y M_B, con signo; mismo signo = curvatura simple). Ninguno baja de N_Ed·e_mín (EHE-08 42.2.1: máx{h/20; 20 mm}; EC-2: máx{h/30; 20 mm}).
- **Fluencia simplificada:** dato φ(∞,t0) (por defecto 2, editable) y proporción de carga permanente (por defecto 0,6). φef = φ(∞,t0)·proporción (EC-2 5.8.4(2); EC-2 2023 7.4.2(3) admite la razón de cargas verticales). Se ignora (φef = 0) cuando φ ≤ 2, λ ≤ 75 y M0Ed/NEd ≤ h (5.8.4(4)). EHE-08 cubre la fluencia con e_a.

## Cómo se calcula
- **Longitud de pandeo:** EHE-08 43.1.1, l0 = α·l con α(Ψ_A, Ψ_B) de las fórmulas de 43.1.1 (intraslacional y traslacional). EC-2: fórmulas (5.15) y (5.16) con k = Ψ/2 (arriostrado) y k = Ψ/6 (traslacional), mínimo 0,1; criterio propio, comprobado contra α de la EHE-08 (los dos dan la misma l0 con diferencias menores del 6 % y el 12 %; ver el test).
- **β, i_s, C:** de la propia armadura de la sección (i_s = radio de giro del grupo de barras; β = (d−d′)²/(4 i_s²)), no de la tabla 43.5.1. C (esbeltez límite): 0,24 / 0,20 / 0,16 según β ≤ 1,25 / ≤ 2,5 / mayor.
- **EC-2 2004:** M_Ed = M0e + N·e2 con e2 = (1/r)·l0²/c, 1/r = Kr·Kφ/r0, r0 = ε_yd/(0,45 d), d = h/2 + i_s, c = 10 (8 con momento constante). M_Ed no baja de M02 ni de N·e_mín.
- **EC-2 2023:** igual, con λlim de O.12 (A·B·C), r0 = 2ε_yd/(d−d′) de O.20, c = 8 arriostrado y 10 traslacional, M0Ed = Cm·M02 (O.14).

## Por verificar contra el texto oficial (hasta entonces el módulo lo avisa en pantalla)
1. **Esbeltez límite de EHE-08 43.1.2 y del AN de EC-2 2004 (5.8.3.1).** La fórmula sale destrozada del PDF. Se ha leído λlim = 35·√(C/ν)·√(1 + 0,24/(e2/h) + 3,4·(e1/e2 − 1)²); comprobarla (y la versión con ω de EHE-08 43.1.2, que no se usa). Contraste: con ν = 0,33, C = 0,24 y e2/h = 0,1 da 55, parecido al criterio recomendado de EC-2 (5.13N), 59.
2. **EC-2 2023, O.10 (longitud eficaz traslacional):** el radicando no se lee; se usa la (5.16) de EC-2 2004. La (O.9) arriostrada sí es legible y coincide con la (5.15).
3. **EC-2 2023, O.13:** solo se usa MEd = máx{M0Ed + M2; M02}; falta la tercera expresión (con ei de 7.2.1.2(5)).
4. **Rigideces de giro de las vigas (k = Ψ/2 y Ψ/6):** criterio propio para pasar de Ψ (EHE-08) a la flexibilidad k (EC-2). Confirmar con José Luis.
5. **Imperfecciones geométricas (EC-2 5.2):** no se suman: la excentricidad mínima N·e_mín cubre la incertidumbre de posición.
6. **Diagrama 3.1:** comparar con el módulo Pandeo (ModuloP1) del Delphi cuando la carpeta de fuentes esté disponible; no se ha leído el código.
