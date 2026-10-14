# Verificación de las tablas de fuego (módulo Fuego) contra UNE-EN 1992-1-2:2011

Fuente: `normativa/ec2-fuego/texto.txt` (EN 1992-1-2:2004+AC:2008, capítulo 5) y A1:2021. Código revisado (solo lectura): `prontuario-web/src/norma/fuego.js` (rama EC-2/CE). La rama EHE-08 (Anejo 6) se contrastó con `normativa/ehe-08/texto.txt`.

## Resultado: las tablas del CE transcritas coinciden con la EN 1992-1-2
Comprobadas celda a celda con el texto de la norma:
| Código | Tabla EN 1992-1-2 | Línea de texto.txt | Resultado |
|---|---|---:|---|
| `cePilar` (A20.5.2a) | 5.2a, Método A | 1921 | coincide (R30-R240, μfi 0,2/0,5/0,7 y una cara; marca ** = mín. 8 barras) |
| muros no portantes (EHE `eheMuroNoPort`, 60…175) | 5.3 | 2145 | coincide (60, 80, 100, 120, 150, 175) |
| `ceMuroPort` (A20.5.4) | 5.4 | 2175 | coincide; * = manda el recubrimiento geométrico |
| `ceVigaSimple` (A20.5.5) | 5.5 | 2391 | coincide (opciones y alma WA/WB/WC) |
| `ceVigaCont` (A20.5.6) | 5.6 | 2471 | coincide |
| `ceLosa` (A20.5.8) | 5.8 | 2588 | coincide (h, a uni, a bi ≤1,5, a bi 1,5-2) |
Árido calizo: la EN permite −10 % de la dimensión mínima en vigas y losas (5.1(2), l.1661) y del espesor en muros no portantes (5.4.1(2), l.2142); no da reducción de a. Coincide con lo que hace el código para el CE.

## Observaciones
1. **Notación**: la EN usa μfi (nivel de carga en fuego, 2.4.2); el CE y el código usan ηfi. Con tablas son el mismo parámetro (la EN, 5.3.2(3), permite ηfi en lugar de μfi como simplificación del lado de la seguridad). No cambia números.
2. **Cita**: ahora que se dispone de la UNE-EN 1992-1-2, el módulo puede citar «UNE-EN 1992-1-2, 5.x, Tabla 5.y» para EC-2 (la numeración del CE, Anejo 20, es la misma con prefijo A20). Con el EC-2 2023, que remite a prEN 1992-1-2 (no disponible), se mantiene el aviso.
3. **asd = a + 10 mm** en vigas con una sola capa en las barras de esquina cuando b < columna 3 (5.5) / 4 (5.6), y condiciones de 5.6.3(5)-(6) (tabla 5.7, doble T continua): están fuera del código actual; el código lo recoge solo como nota.
4. **Fuera de la primera versión y disponible ahora**: Método B de pilares (Tabla 5.2b, l.2023), ecuación (5.7) para valores intermedios (l.1993 aprox.), losas planas 5.9, nervadas 5.10-5.11, Anexo B (isoterma 500 °C) y el nuevo **Anexo C de A1:2021** (esbeltez máxima de pilares con tablas por nfi, ω y eN; fck ≤ 50 MPa). Si José Luis lo pide, el Anexo C permite comprobar pilares esbeltos, no solo la dimensión mínima.
5. **Alta resistencia**: la EN 5.3.2/5.2 limita las tablas a hormigón normal; para fck > 50 MPa ver 6.2 (spalling, 4.5) antes de aplicar.

## Rama EHE-08 (Anejo 6, texto.txt l.23177-23345)
Coinciden `ehePilar` (A.6.5.2), `eheMuroNoPort` (A.6.5.3.1), `eheMuroPort` (A.6.5.3.2), `eheViga` (A.6.5.5.2, con los anchos de alma 80, 100, 100, 120, 140, 160) y `eheLosa` (A.6.5.6). Nota: en A.6.5.2 los valores R30 (150) y R60 (200) llevan (**): la dimensión mínima debe cumplir además el art. 54; y para más de R90 con armadura >2 % hay que distribuirla en todas las caras.

## Pendiente
Ninguno en las tablas ya incluidas.
