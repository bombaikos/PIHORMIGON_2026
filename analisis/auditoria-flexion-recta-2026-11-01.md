# Auditoría de Flexión compuesta recta (1/11/2026)

Alcance: motor N-M (`src/core/interaccion.js`), dimensionamiento, excentricidad y armaduras mínima/máxima, y diseño de la pantalla en los tres modos. Tests nuevos en `tests/interaccionAuditoria.test.js`.

## Qué se comprobó y salió bien
- Equilibrio independiente: cada punto del contorno, integrado por fibras con otro código, da el mismo N y M (±0,2 %).
- Agotamiento: en cada punto alguna fibra está en su límite (pivote A, B o C) y ninguna lo supera.
- El contorno es convexo; γ es homogéneo (γ de k·(N, M) = γ/k); Q queda sobre la recta de excentricidad constante.
- Compresión pura y tracción pura coinciden con la suma de áreas.
- Excentricidad mínima: EHE-08 42.2.1 máx{h/20; 2 cm}; EC-2 (2004 y 2023) máx{h/30; 20 mm}.
- Diseño: sin scroll de página ni errores de consola a 1536×730, 1366×657, 1100×600 y 1920×1080 en los tres modos; textos SVG ≥ 9 px reales; unidades entre corchetes; kN y kN·m sin decimales; γ con dos.

## Fallos encontrados y corregidos
1. **Armadura mínima de pilar con EHE-08 (42.3.3)**: se usaba f_yd (434,8 MPa con B 500 S) y la norma dice f_yc,d = f_yd ≤ 400 MPa. La mínima salía un 8 % corta. Corregido en `cuantiaMinima.js` (afecta también a Secciones); la explicación de Secciones ya dice f_yc,d.
2. **Sin máximo de armadura**: Dimensionar podía pedir 35 692 mm² en una sección de 400×400 y decir «Sección válida». Nuevo `cuantiaMaxima` (EHE-08 42.3.3: A·f_yc,d ≤ A_c·f_cd; EC-2 2004 9.5.2(3): 0,04·A_c); aviso y veredicto «Aumentar la sección».
3. **N fuera de capacidad sin explicación**: con N > N_Rd o N < N_Rd,t salía γ = 0,00 y «No cumple» sin motivo (el texto existía en i18n pero no se usaba). Ahora avisa con el límite.

## Observaciones sin cambiar (decisión de José Luis)
- El motor integra el **hormigón bruto**, sin descontar los huecos de las barras (como calcomun): sobreestima N_Rd en A_s·f_cd (≈ 0,8 % en el ejemplo). El comentario de EHE-08 42.3.3 habla de «área neta». Habría que decidir si se descuenta.
- Con M < 0 se calcula con |M| (armadura simétrica) y la pantalla muestra M_Ed positivo.
- EC-2 2023: no se localizó un máximo de armadura equivalente en el texto (tabla 12.3): sin aviso. El 0,04·A_c de EC-2 2004 es el valor recomendado; falta confirmar el del Anejo Nacional (ver `formulas-por-verificar.md`).
