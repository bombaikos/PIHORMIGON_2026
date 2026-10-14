# Módulo Secciones: decisiones tomadas

Resumen de lo decidido por José Luis en el hilo «Revisión código Turbo Pascal» (8 y 9 de octubre de 2026). Manda sobre esto `analisis/guia-estilo-prontuario.md`; aquí solo va lo propio de Secciones.

## Código
- Núcleo: `src/core/geometria.js` (modelo único: contorno con huecos + grupos de armadura), `propiedades.js` (bruta, homogeneizada, fisurada, Mfis), `armado.js` (lectura de `5D20+2D16`, cuentas), `seccion.js` (motor seccional, compartido con Flexión).
- Interfaz: `src/ui/vistas/secciones.js`, `dibujoSeccion.js`, `rejilla.js`. Durabilidad en `src/norma/ehe98/durabilidad.js` y `src/norma/ec2-2023/durabilidad.js`.
- La app vive en `prontuario-web/`; `dist/prontuario.html` se copia a `Version 3.1\Web 2026` en el PC de José Luis y `dist/artifact.html` se publica en https://claude.ai/artifact/HW5N7JUG7tZjMd4ekmf4pi (republicar siempre en ese mismo enlace).
- Por defecto no se tocan la opción EHE-98 ni la lógica de Flexión salvo que Secciones lo exija.

## Unidades
- Escuadrías, recubrimientos y d en **mm** (decidido en tarjeta el 8/10: mm, no m). Armaduras en mm². Nunca cm. El motor sigue en m internamente.

## Gestión de secciones (como el Prontuario 3.1)
- Arriba, segmentado con los cuatro tipos (rectangular, T, circular, genérica) con el número de secciones de cada uno.
- Debajo: selector de sección (con «+ Nueva sección»), nombre y los datos.
- **Guardar cambios** y **Borrar sección** van **abajo del todo**, como culminación, con la nota de estado justo encima.
- Lo editado no toca el proyecto hasta guardar. Cambiar el nombre crea una sección nueva. Si el nombre ya existe se avisa y se pide confirmación para sustituir. Cambiar de sección con cambios pendientes pide confirmación.
- **Borrar no pide confirmación** (Ctrl+Z la recupera).
- No hay botón Duplicar.

## Entrada de datos: lo más simple posible
- Pestañas (10/10): **Sección** (materiales, geometría, armadura y N_k de fisuración; a la derecha, propiedades bruta/homogeneizada, sección fisurada y armadura en una sola tarjeta) y **Diagramas M-κ** (axil constante, M+ y M− con diagramas de cálculo, My y Mu; gráfica común `src/ui/grafica.js`).
- **Durabilidad es un módulo aparte** (10/10): en el menú, Secciones se despliega en «Crear y editar» y «Durabilidad». Las condiciones son del proyecto (`p.durabilidad`), no de cada sección; la pantalla muestra las tablas de la norma con lo que manda marcado y comprueba el recubrimiento real de todas las secciones.
- Cuantías geométricas (10/10): en vigas (Rec viga y T) ρ_inf (M+) y ρ_sup (M−) por separado; en pilares, circulares y genéricas, ρ total. Referidas a A_c.
- Dos tipos rectangulares (decidido el 10/10, como «rectangular área» y «rectangular redondos» del 3.1; lo que cambia es la entrada de datos):
  - **Rec viga** (`forma: 'rectangular'`): caras superior e inferior, por área o por barras, como hasta ahora. Es la única que usa Flexión.
  - **Rec pilar** (`forma: 'pilar'`): barras en horizontal (por cara superior e inferior) y en vertical (por cara lateral), contando las esquinas en las dos; un solo diámetro y una sola d. Grupo `{tipo:'perimetral', nx, ny, fi, d}`.
- Rec viga y T: solo dos filas de armadura, superior (As2, d2) arriba e inferior (As1, d1).
- Una capa por defecto. **Nunca se pregunta por una segunda capa**: la única forma es la notación `5D20+2D16` (la más superficial primero), con capas separadas **50 mm** (parámetro único del proyecto, «Separación entre capas» en Proyecto).
- Cada capa: un solo diámetro, mínimo dos barras, simétricas respecto al eje vertical (una en cada extremo y el resto equidistantes).
- Circular: una sola capa en anillo (`8D16` y su d).
- Genérica: **por caras**, como el 3.1. Criterio de barras (12/10): cada cara manda en su vértice de salida (lleva una barra en él) y reparte sus n barras equidistantes hacia el siguiente vértice sin ponerlo; esa barra es de la cara siguiente de la lista. Vale n = 1. Una rejilla con x (mm), y (mm) y la armadura de la cara que sale de cada vértice; d común a todas las caras; barras sobre la paralela interior a d; en esquinas compartidas, una barra con el mayor diámetro. Hueco en una segunda rejilla, plegada.
- Sin párrafos de ayuda bajo la armadura; el eco dice p. ej. «5ø20 + 2ø16 (2 capas) = 1973 mm²».

## Pantalla
- Tres columnas a toda la altura sin scroll de página (datos | dibujo | resultados), comprobado a 1536 × 730 y 1366 × 657 con `npm run test:pantalla`.
- Dibujo justificado arriba, leyenda encima; textos del dibujo a 12 px y rótulos a 10 px fijos en pantalla.
- Rejillas hechas a mano, aspecto y teclado de Excel, copiar con el decimal del sistema (guía §12).
- Unidades en la cabecera de las columnas (o de la fila en tablas de etiqueta y valor), no en cada celda (hecho el 10/10).
- Jerarquía visual de la guía § 14 aplicada el 10/10 (versión 17 del artefacto): desplegables por tipo y pestañas en una sola fila encima de las columnas; grupos Sección (nombre, hormigón, acero), Geometría y Armadura y fisuración; cajas de valor de 130 px alineadas a la derecha.
- Tarjetón de la sección activa (guía § 14.8) encabezando la columna de datos: tipo, nombre a 28 px y resumen «300 × 500 mm · HA-25 · 5D16 / 2D12» (armado inferior / superior), que se actualiza al tocar un dato. Para que quepa, el eco del armado bajo cada caja solo aparece si hay error (ya está en la tabla de Armadura).
- Sin líneas intercaladas bajo las cajas (10/10 noche): el área del armado va en gris en la misma fila («226 mm²», en pilar «8ø16 = 1608 mm²» en la fila del diámetro); la línea de debajo solo aparece para errores.
- El área del armado va dentro de la caja, a la derecha, como las unidades («2D12   226 mm²»; en pilar, en la caja del diámetro). M_fis e I_fis llevan explicación plegada con la expresión, los valores y el artículo (EHE-98 art. 39.1 para f_ct,m) (11/10).
- Si el armado se da en área («200»), dentro de la caja solo va la unidad «mm²» en gris; el número del área solo se añade cuando se da con redondos («2D16   402 mm²») (11/10).
- Los campos de armado se alinean a la derecha, como los números (11/10).
- Diagrama M-κ: rama sin fisurar para M+ y M− (misma pendiente Ec·Ih), cada una en su color y con su Mfis marcado. Todas las gráficas llevan debajo el selector Gráfico/Tabla, como el 3.1; en Tabla, «Copiar» pega en Excel (11/10).
- Diagrama M-κ con los diagramas característicos (sin γ ni α: fck y fyk; My cuando la primera barra llega a fyk/Es), como el Prontuario 3.1. Confirmado por José Luis el 11/10.
- Menú Secciones (11/10): «Crear y editar», «Durabilidad» y «Diagramas», en ese orden. Crear y editar ya no tiene pestañas; Diagramas comparte la sección activa (mismos desplegables por tipo arriba).
- M_fis con f_ctm,fl (EHE-08 art. 50.2.2.2) se cambia aparte, cuando la app pase a las tres normas (EHE-08, EC-2 2004+AN, EC-2 2023). Decidido por José Luis el 11/10.

## Diagramas como en el 3.1 (11/10, v32)
- Cinco axiles, por defecto 0, 20, 40, 60 y 80 % de N_u (compresión pura con diagramas característicos); valores en kN editables y casilla de representar. Al tocar uno se fijan en la sección (`s.mk.axiles`); botón para volver a los porcentajes.
- M+ en el primer cuadrante y M− en el tercero, una curva por axil (colores s1–s5).
- Selector en datos entre M-κ y EI/EI_b–M (rigidez secante desde κ = 0 referida a Ec·Ib).
- Dibujo de la sección arriba a la derecha (alto máx. 250 px) y tabla por axil: My, Mu y μ para cada signo.
- Gráficas: vista completa con 10 % de margen por los cuatro bordes (12/10).
- Propiedades: antes de calcular se comprueba |N_k| < 0,95·N_Rd (compresión, materiales de cálculo) o 0,95·A_s·f_yd (tracción); si no, error y sin resultados (12/10, v34).
- Genérica (12/10, v36): el tarjetón solo lleva dimensiones generales y hormigón (sin armaduras). Zona para cargar .dxf (arrastrar o pulsar) con (i): «Arrastra un .dxf con líneas, polilíneas y arcos solo. La sección en capa 0, los huecos en capa 1.» Al cargar se sustituyen contorno y huecos y se borran las armaduras de caras. El hueco queda plegado, con su resumen.
- 12/10, v37: Secciones dibuja siempre la sección entera (sin tramo). Flexión, si b > 2h, muestra un tramo 2:1 con deslizador horizontal. Genérica: lados numerados en el dibujo y en la rejilla (1, 2, 3…) con su longitud L (mm) en una columna de solo lectura. Arcos del DXF: paso angular de 3,75° (círculo de 96 lados), cuerda ≤ 1 m; antes cuerda ≤ 50 mm (cientos de lados en arcos de metros).
- 12/10, v38: en la genérica, la armadura de una cara admite también D16/0.20 (diámetro y separación; ≤ 5 se toma como m). Nº de barras = redondeo de L/separación sobre la paralela interior, sin la del vértice siguiente; aviso (no bloquea) si la separación real se aparta más del 20 % de la pedida.
- 12/10, v39: en Diagramas, nombre, hormigón y acero son de solo lectura y no hay Guardar ni Borrar (ahí no se edita).
- 12/10, v40: proyecto nuevo con una sección de cada tipo, ejemplo_1 (viga), ejemplo_2 (pilar), ejemplo_3 (T), ejemplo_4 (circular), ejemplo_5 (genérica: puente con 7 aligeramientos, de Pruebas.json tal cual: arco abajo). Guardar proyecto pregunta dónde (showSaveFilePicker); si el navegador o el visor no lo permite, descarga el .json.

## Normas del proyecto (11/10)
- Tres normas: EC-2 2004 + AN (id `EC2-2004`, vigente, **por defecto** al abrir un proyecto), EHE-08 y EC-2 2023 (no vigentes: **su nombre va en rojo** en el selector de norma y en el chip de la cabecera). EHE-98 ya no se ofrece; un proyecto guardado con EHE-98 pasa a EHE-08 con aviso en Proyecto (`p.normaMigrada`; α pasa de 0,85 a 1,00). La importación del Prontuario 3.1 entra con la norma por defecto y regenera los materiales a partir de fck/fyk. EHE-98 queda solo como norma heredada para validar contra el 3.1 en los tests.
- Parámetros: γC 1,5 y γS 1,15; αcc = 1 (EHE-08 39.4, AN 3.1.6(1)P); εc2, εcu y n según fck (EHE-08 39.5; EC-2 tabla 3.1); Ecm = 8500·∛fcm (EHE-08) o 22·(fcm/10)^0,3 (EC-2); εud = 10 ‰ (EHE-08 38.4; AN 3.2.7(2)). Los datos de materiales los completa el hilo «Módulo Materiales» (src/norma/materiales/).
- Mfis usa f_ct,m,fl = max{(1,6 − h)·f_ct,m; f_ct,m} en las tres normas (`fctmFlexotraccion`, core/propiedades.js).
- Flexión: cuantía mínima EHE-08 42.3.2 (W·fct,m,fl/(0,8h·fyd)) y tabla 42.3.5; EC-2 2004: AN 9.2.1.1 (mismo criterio, As,máx = 0,04·Ac) y 9.5.2(2) en pilares; wk con 7.3.4 para EC-2 2004, el método del Prontuario para EHE-08 y 9.2.3 para EC-2 2023.
- **Pendiente**: tablas de durabilidad de EHE-08 (art. 8.2 y 37.2.4) y de EC-2 2004 (4.4.1.2 + AN.4.1): hoy cmin,dur lo escribe el usuario en esas dos normas.

## Cuantía mínima mecánica (14/10)
- Se admite la armadura que escriba el usuario; en Propiedades ▸ Armadura se muestra la cuantía mínima mecánica y se compara con la dispuesta (en rojo si no llega). La fila se despliega con la expresión, los valores y el artículo.
- Rec viga y En T se tratan como vigas en flexión simple: A_s,min = W·f_ct,m,fl/(0,8h·f_yd), con W de la sección bruta para la cara traccionada (inferior para M+, superior para M−) (EHE-08 42.3.2; AN 9.2.1.1(1)); en EC-2 2023, 12.2(2) con f_ct,m y f_yk y z ≈ 0,8h (aproximado).
- Rec pilar y Circular se tratan como pilares: máx{0,10·N/f_yd; 4‰·A_c} (EHE-08 42.3.3 y tabla 42.3.5) o máx{0,10·N/f_yd; 2‰·A_c} (EC-2 9.5.2(2); EC-2 2023 tabla 12.3), con N = el N_k introducido (compresión).
- Genérica: aviso de que no se comprueba la cuantía mínima.
- Código: src/core/cuantiaMinima.js.
