# Código Estructural y guías DGC: equivalencias con EC-2 y criterios de recubrimiento y durabilidad

Fuentes: CE art. 27, 43, 44, 49.5 (`normativa/ce-hormigon/texto.txt`); CE Anejo 19 (`normativa/ce-anejos/texto.txt`, l.19645+); UNE-EN 1992-1-1:2013 + AN (`normativa/ec2-2004-an/texto.txt`); guías DGC (mayo 2022, abril 2022) y GuiaCE (oct. 2025). Las ecuaciones del Anejo 19 no salen en el texto extraído: se leyeron en la imagen de las páginas del BOE (PDF 06_ANEJOS págs. 341, 381-382, 401-402).
Uso: el CE como **criterio**, no como cuarta norma (José Luis, 11/10).

## 1. Conclusión principal para el módulo Durabilidad
La guía DGC de especificaciones (§2.4.8) concluye, a partir de la de recubrimientos, que **aun proyectando con EC-2 los recubrimientos deben calcularse con los arts. 43 y 44 del CE** (la disposición adicional 2.ª del RD 470/2021 hace obligatorios del CE materiales, durabilidad, ejecución, control y mantenimiento). El método EC-2 + AN (clases estructurales S1-S6) es una alternativa que da valores iguales o algo menores (la guía DGC: el CE es «en general más conservador»; diferencias ≤5 mm en X0/XC, y de 5 a 15 mm en XD1 con cementos CEM II/B-S, B-P).
**Propuesta**: el módulo Durabilidad calcula por defecto con las tablas del CE (44.x) y, si la norma activa es EC-2, muestra además el valor del método AN (S1-S6) como contraste. Para EHE-08 se mantiene su art. 37.

## 2. Datos que necesita Durabilidad (condiciones del proyecto)
Clases de exposición (por elemento; combinación XC+XD…, XF, XA, XM), vida útil 50/100 años, tipo de hormigón (masa/armado/pretensado), tipo de cemento (CEM I; «adecuado» o no según CE Anejo 6; adiciones), fck, nivel de control de ejecución (Δcdev), diámetro de barra, tamaño máximo del árido, hormigonado contra el terreno, si hay armadura postesa, acero inoxidable o protección adicional.

## 3. Cálculo del recubrimiento (CE)
cnom = cmin + Δcdev (CE 43.4.1). **Δcdev**: 0 prefabricados con control intenso; 5 in situ con control intenso; 10 otros casos (Tabla 43.4.1). (EC-2 AN: Δcdev = 10 mm, reducible; Tabla AN en 4.4.1.3.)
cmin = el mayor de: durabilidad (44.2.1.1.a/b, 44.3, 44.4, 44.5) y adherencia/colocación (44.2.1.1: ≥ Ø de la barra principal y ≥ 0,8·Dmax, o 1,25·Dmax si hay dificultad de paso; barras dobladas ≥ 2Ø; contra el terreno 70 mm salvo hormigón de limpieza; si c > 50 mm considerar malla de reparto Ø≤12 al 5‰).

**Tabla 44.2.1.1.a** (X0, XC; cmin mm, vida 50 / 100 años) — texto.txt l.3407:
| Clase | Cemento | fck | 50 | 100 |
|---|---|---|---:|---:|
| X0 | cualquiera | ≥25 | 15 | 25 |
| XC1-XC3 | CEM I | 25-40 | 15 | 25 |
| | CEM I | ≥40 | 10 | 20 |
| | otros / con adiciones | 25-40 | 20 | 30 |
| | otros / con adiciones | ≥40 | 15 | 25 |
| XC4 | CEM I | 25-40 | 20 | 30 |
| | CEM I | ≥40 | 15 | 25 |
| | otros / con adiciones | 25-40 | 25 | 35 |
| | otros / con adiciones | ≥40 | 20 | 30 |

**Tabla 44.2.1.1.b** (cloruros; cmin mm; columnas XS1 / XS2 / XS3 / XD1 / XD2 / XD3; columnas confirmadas con la Tabla 15 de la guía DGC de recubrimientos) — l.3455:
| Elemento y cemento | Vida | XS1 | XS2 | XS3 | XD1 | XD2 | XD3 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Armado: CEM III/A, III/B, IV, II/B-V, II/A-D, microsílice >6 % o cenizas >20 % | 50 | 25 | 30 | 45 | 35 | 35 | 35 |
| | 100 | 30 | 35 | 50 | 40 | 40 | 40 |
| Armado: CEM II/B-S, B-P | 50 | 30 | 35 | 65 | 40 | 40 | 40 |
| | 100 | 35 | 40 | 70 | 45 | 45 | 45 |
| Armado: resto de cementos (art. 28) | 50 | 40 | 45 | * | * | * | * |
| | 100 | 65 | * | * | * | * | * |
| Pretensado: CEM II/A-D o CEM I + humo de sílice >6 % | 50 | 30 | 35 | 50 | 40 | 40 | 40 |
| | 100 | 35 | 40 | 65 | 45 | 45 | 45 |
| Pretensado: resto | 50 | 45 | 55 | * | * | * | * |
| | 100 | * | * | * | * | * | * |
(*) estudio específico. Método AN, Tabla AN/3 (cmin,dur, mm; S1…S6) para contraste: XD1 y XS1 = 30, 35, 40, 40, 50, 60; XS2 = 30, 35, 35, 35, 45, 60; XD2, XD3 y XS3 = estudio específico (la guía DGC, Tabla 3). X0, XC1, XC2, XC3, XC4: S1 10,10,10,10,15; S2 10,10,10,10,20; S3 15,15,15,15,20; S4 15,15,20,20,25; S5 20,20,25,25,30; S6 25,25,30,30,35. Clase estructural de partida S4 a 50 años (AN/2: 100 años sube 2 clases; fck≥40 baja 1 en XC; cemento adecuado baja 1-4), Δcdur,γ de AN/4 (−5 en XD1/XS1 armado con cemento adecuado, +5 en XS3 pretensado), acero inoxidable AN/5 (−25 / −5), protección adicional AN/6.
Los valores del CE se entienden asociados al cumplimiento de la dosificación mínima de 43.2.1 y equivalen, según la guía DGC, a cmin,dur + Δcdur,γ de EC-2.
Otros: XF (44.3, l.3552), XA (44.4, l.3596), XM sobreespesor (44.5, l.3628), postesas (44.2.1.2, l.3533).

## 4. Dosificación y resistencia por clase (CE 43.2.1)
Tabla 43.2.1.a (a/c máx., cemento mín. kg/m³) y 43.2.1.b (fck mín. esperada) en `texto.txt` l.2985-3030, por tipo masa/armado/pretensado. Ejemplos armado: X0 0,60 / 250 / 25; XC1-2 0,60 / 275 / 25; XC3-4 0,55 / 300 / 30; XS1 0,50 / 300 / 30; XS3 0,45 / 350 / 35; XD1-3 0,50 / 325 / 30; XA3 0,45 / 350 / 35. Con varias clases: el criterio más exigente por parámetro. Con adiciones, C→C+K·F y a/c→a/(C+K·F) (K ≤0,2 / 0,4 cenizas, ≤2 humo de sílice). fck de proyecto ≥25 MPa en armado (33.4).
Contraste: UNE-EN 206 Anexo F y AN/13 (clase recomendada, p. ej. XC1-3 C25/30; XC4 C30/37; XS3 C35/45): la guía DGC espec. §2.4.2.1 los reúne.

## 5. Fisuración (wmax)
CE Tabla 27.2 (l.231) = AN Tabla AN/9 (UNE texto.txt l.10283): armado, combinación cuasipermanente: X0, XC1: 0,4; XC2-XC4, XF1, XF3: 0,3; XS, XD, XF2, XF4, XA1: 0,2 (pretensado frecuente: descompresión); XS3, XA2, XA3 en pretensado: descompresión / 0,1 (ver tabla). El EC-2 2023 usa 0,3 mm·ksurf (ver `ec2-2023-revision.md`).

## 6. Equivalencias y discrepancias CE (Anejo 19) vs EC-2 2004 + AN
El Anejo 19 sigue la estructura del EC-2 2004 con textos propios. Verificado (imágenes del BOE vs `ec2-2004-an/texto.txt`):
| Aspecto | CE Anejo 19 | EC-2 2004 + AN |
|---|---|---|
| Cortante sin armadura, νmin (6.2.2) | **0,035·k^(3/2)·√fck** (6.3), CRd,c=0,18/γc, k1=0,15, ρl≤0,02, σcp<0,2fcd | **0,075/γc·k^(3/2)·√fck**, fck≤60 (AN 6.2.2(1), l.10095); recomendado CEN 0,035 |
| Punzonamiento, νmin / k1 | (6.4.4) ver img. 6.4.4 | νmin=0,075/γc…; k1=0,1 (AN 6.4.4(1), l.10172) |
| Punzonamiento, vRd,max (6.4.5(3)) | **0,4·ν·fcd** (pág. BOE 98380) | **0,5·ν·fcd** (AN 6.4.5(3), l.10182) |
| Diagrama del acero (3.2.7) | εud=0,9εuk, **sin tope de 10 ‰**; o rama horizontal sin límite (pág. BOE 98319) | εud=0,9εuk **y ≤10 ‰**; εud=εuk si garantía (AN l.9728-9731) |
| Biela / cotθ | (comprobar 6.2.3) | 0,5≤cotθ≤2,0 (AN) |
| Cálculo del recubrimiento | arts. 43-44 CE (tablas), Anejo 19 4.4.1.2 remite a 44.2.1, 44.3-44.5 | cmin,dur por clase estructural S1-S6 (AN/2-AN/6); Δcdev=10 |
| Anclaje y solape | Anejo 19 8.4-8.9 ≈ EC-2 cap. 8 **o** CE 49.5 (según certificación de adherencia, ver §7) | EC-2 cap. 8 |
Consecuencia para el prontuario: con la opción EC-2 2004+AN no cambia nada en cortante ni punzonamiento; el CE es **más conservador en νmin de punzonamiento/cortante (0,035 frente a 0,075/γc)** solo si se usa el criterio CE. Decidido (§9): el CE solo se usa en recubrimientos y durabilidad.

## 7. Anclaje y solape (guía DGC abril 2022)
Dos vías (CE 49.5): si la adherencia se certifica por ensayo de la viga (UNE-EN 10080 Anejo C / UNE 36740) se aplica CE 49.5 (lb,I = m·Ø² ≥ fyk/20·Ø, lb,II = 1,4·m·Ø² ≥ fyk/14·Ø, m de Tabla 49.5.1.2.a; β, α en Tablas 49.5.1.2.b y 49.5.2.2); si se certifica por geometría de corrugas, se aplican Anejo 19 8.4-8.9, idéntico en valores al EC-2. Diferencias CE 49.5 vs EC-2: lb mayor con fck ≥ 55 MPa o Ø32; menor con fck <55; en solapes el CE da más con fck bajo y separación <10Ø y con fck >35.

## 8. Qué usaría el prontuario
1. Durabilidad: tablas 43.2.1.a/b, 44.2.1.1.a/b, 43.4.1 y 27.2 como datos (con la mini-tabla de contraste AN/3).
2. Comprobación del recubrimiento real de las secciones frente a cnom y ≥Ø, ≥0,8 Dmax (44.2.1.1).
3. Anclaje/solape: EC-2 cap. 8 (el CE 49.5 solo como aviso).

## 8 bis. Cemento adecuado (CE Anejo 6, Tabla A6.5, BOE pág. 98112) y vida útil (Anejo 12)
- Cemento por clase: X0 todos los de la aplicación; XC: CEM I, cualquier CEM II (mejor II/A), III/A, IV/A; XS: muy adecuados CEM II/S, II/V (mejor II/B-V), II/P (mejor II/B-P), II/A-D, III, IV (mejor IV/A), V/A, **y además característica MR (agua de mar)**; XD: preferentemente CEM I y CEM II/A, más los de XS; XA: los de XS, con SR/SRC en XA2 y XA3; lixiviación (XA): II/P, II/V, II/A-D, II/S, III, IV, V. Por aplicación (A6.2): pretensado solo CEM I, II/A-D, II/A-V, II/A-P, II/A-M (V-P); armado: todos los comunes salvo II/A-Q, B-Q, A-W, B-W, A-T, B-T, III/C y V/B.
- Anejo 12 (informativo, l.11701): modelos de vida útil = período de iniciación + propagación. Carbonatación: tiempo = (c/K)², K = cenv·cair·a·fck^b (cenv 1,0 protegido de lluvia / 0,5 expuesto / 0,3 y 0,2 enterrado; a,b: portland 1800, −1,7; +28 % ceniza 360, −1,2; +9 % humo de sílice 400, −1,2). Cloruros: Cs 0,25-0,50 según clase, Clim 0,60-0,80 % s/cemento. **Solo vale para reducir recubrimiento si se mejora la dosificación por encima del art. 43.2.1; nunca para bajar los valores de las tablas 44.2.1.1 con la dosificación estricta.** Equivale al método AN.4.2 de la AN (tablas AN/15-AN/20).

## 9. Decisión de José Luis (11/10) y alcance
- **Recubrimientos y durabilidad: CE y Anejo Nacional como indicación, citando las guías DGC** (guía de recubrimientos abril 2022, guía de especificaciones mayo 2022). **Todo lo demás con EC-2** (EC-2 2004+AN o EC-2 2023), no con el CE. Por tanto las diferencias del §6 (νmin, vRd,max, εud) no entran en el código: solo informan.
- Cita sugerida: «CE art. 44.2.1.1 (tablas 44.2.1.1.a y b); según la Guía para la determinación de recubrimientos en estructuras de hormigón, DGC, abril 2022, §3».

## 10. Otros datos leídos de las guías (para Durabilidad y especificación)
- **Designación**: CE T-R/C/TM/A (p. ej. HA-25/B/20/XC2); EN 206 C25/30. Series de fck del CE: 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100. fck mínimo (art. 33.4): 20 en masa, 25 en armado/pretensado. Consistencia (33.5.a): S 0-20, P 30-40, B 50-90, F 100-150, L 160-210 mm de asentamiento.
- **Máx. a/c y cemento mín.** (CE 43.2.1.a): la guía DGC de especificaciones dice que en el cuadro de especificaciones se adopten los del CE (obligatorio), no los de EN 206 F.1. **A comprobar**: la guía imprime X0 armado a/c 0,65 (y masa 0,65) y el texto del BOE extraído (l.2989-2991) da 0,60; verificar en la página 97779 del BOE antes de codificar.
- Contenido máximo de cemento 500 kg/m³ en general (43.2.1); XM: D 10/20/40 mm → 400/375/350 kg/m³ (43.3.5). Cloruros (EN 206, Tabla 15): hormigón armado Cl 0,40; pretensado Cl 0,10 o 0,20.
- **Coeficientes parciales** (AN, Tabla AN/1): γc 1,5 persistente y transitoria / 1,3 accidental; γs 1,15 / 1,0. Reducibles con control reforzado y desviaciones reducidas (AN.4.3, Tabla A.1 de EC-2: Δh, Δb ±5…30 mm; Δc +5…20 mm).
- **Clase de exposición** típica en puentes: tablero y pilas XC4; con sales XC4+XD3+XF4/XF2; costa XS1; cimentación XC2. Las clases del CE (27.1.a) coinciden con EN 206; XA con residuo seco adicional en CE (27.1.b).
- **GuiaCE** (edificación, Ø≤25, sin XA3/XF/XM): armadura mínima de fisuración As,min·σs = 0,4·k·fct,ef·Act (7.2), k 1,0 (h≤300) a 0,65 (h≥800); control sin cálculo directo con tablas 7.1.3.a (diámetro máx.) y 7.1.3.b (separación máx.) con σs = Mk,cp/(As·0,8d) (7.3); losas h≤200 mm sin comprobación. Equivale al EC-2 7.3.2-7.3.3.

## 11. Pendiente
Leer en imagen del BOE los apartados del Anejo 19 3.1.7, 6.2.3, 6.4.4, 7.3 y 9.2 (para completar la tabla del §6) y la pág. 97779 (a/c de X0). No bloquea nada: el CE no se usa fuera de recubrimientos y durabilidad.
