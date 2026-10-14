# Módulo Materiales: decisiones y estado (11/10/2026)

Menú: Materiales → «Crear y editar» (`vistas/materiales.js`) y «Propiedades reológicas» (`vistas/reologicas.js`).
Normas: EHE-08, EC-2 2004 + AN (por defecto, vigente) y EC-2 2023. Los textos están en `analisis/normativa/`.

## Crear y editar
- Esquema de Secciones (guía § 14): dos desplegables (Hormigón, Acero), tarjetón, borrador con «Guardar cambios» y «Borrar»; no se borra un material que usa una sección.
- Hormigón: fck, αcc (EHE-08 y EC-2 2004; 0,85–1), γC, árido (coeficiente de Ecm) y cemento S/N/R; en EC-2 2023 ktc y kE en lugar de αcc y árido.
- Acero: fyk, γS; en EC-2 2004 y 2023 clase de ductilidad A/B/C y rama horizontal o inclinada; en EC-2 2004 εud = 0,9·εuk o εuk con garantía, siempre ≤ 10 ‰.
- Propiedades con cuenta desplegable y artículo: fcm, fcd, fct,m, fct,k,0.05 (y 0.95 si la norma lo define; la EHE-08 no), fct,d, Ecm, Ec,tg y diagrama.
- Pestaña «Edad»: βcc(t), fcm(t), fct,m(t), Ecm(t) (EHE-08 31.3, EC-2 2004 3.1.2/3.1.3, EC-2 2023 B.3-B.4).
- Diagrama σ-ε de cálculo y característico con la gráfica común.

## Propiedades reológicas (`core/reologia.js`)
- EHE-08 y EC-2 2004 comparten el modelo del anexo B de la EN 1992-1-1:2004 (el EC-2 corrige t0 por el cemento, la EHE-08 no). EC-2 2023 tiene su anexo B propio.
- Validado contra tablas: EHE-08 39.7.c/d y 39.8.a/b, EC-2 2004 tablas 3.2 y 3.3, EC-2 2023 tablas 5.2 y 5.3 (`tests/reologia.test.js`).
- EC-2 2023: sin valor a «tiempo infinito»; se toma a 50 años. Fluencia no lineal: EC-2 2004 (3.7) y EC-2 2023 (B.19); la EHE-08 solo avisa.
- Curvas en log10 t porque la gráfica común solo tiene ejes lineales.

## Pendiente / fuera de este módulo
- Prontuario 3.1 (`C:\PORTABILIDAD\...\Version 3.1`): no se pudo consultar (dispositivo no conectado). Falta contrastar sus pantallas de Materiales.
- `proyecto.js` (`materialesSeccion`) y `secciones.js` deben pasar la ficha completa (`opcionesHormigon/opcionesAcero`) para que αcc, árido, ktc/kE, ductilidad y rama de Materiales lleguen a los cálculos de Secciones.
- `tools/encaje.mjs` falla a 1366×657 en «Secciones · en T» (datos +29 px): es de Secciones.

## Tipificados y tipo de diagrama (11/10, Pepiño)
- HA-25, 30, 35, 40, 45 y 50 son tipificados: su fck lo fija el nombre (campo bloqueado; si se renombra una ficha a uno de esos nombres, fck pasa a ese valor). `fckTipificado()` en core/materiales.js; `materialDeFicha` lo aplica siempre.
- Tipo de diagrama de compresión (`ficha.diag`): `PR` parábola-rectángulo (por defecto, el de los tipificados, coeficiente 1,00: αcc = 1 y, en EC-2 2023, ktc = 1), `EC2` curva de la norma (Sargin, UNE-EN 1992-1-1 3.1.5 (3.14); EC-2 2023 5.1.6(3) (5.6)-(5.10)) con fcm por defecto (también fck o fcd) y sin γ ni α, y `puntos` (ε ‰, σ MPa, compresión en positivo, ε crecientes).
- La EHE-08 no da curva propia para análisis no lineal: con ella se usa la de la UNE-EN 1992-1-1 y así se indica.
- En ELU el hormigón no resiste a tracción en ningún tipo (interpretación de «fc=0»: fct = 0; pendiente de confirmar).

## Diagramas: característicos, γ y tracción (11/10, Pepiño)
- Los diagramas de Materiales son característicos (sin γ). El de cálculo se obtiene aplicando γ al característico: en ELU γ_C (1,5 con EHE-08/EC-2 de referencia, el de la ficha) y en los demás cálculos (momento-curvatura) γ = 1, que debe quedar indicado donde se use (en M-κ ya va con `caracteristico()`).
- Parábola-rectángulo: sin resistencia a tracción (fct = 0). Sargin: lleva su ley, pero los cálculos en ELU toman siempre fct = 0.
- Pendiente: sitio de la documentación (propuesta: este archivo y, más adelante, el módulo Ayuda).

## Estándar, nombres y Sargin con tracción (11/10, Pepiño)
- HA-25…HA-50 y HA-30_EC2 vienen en todo proyecto nuevo (y se añaden a los guardados si faltan), con B500S y B400S. Los tipificados solo admiten cambiar αcc (ktc en EC-2 2023); cambiar otra cosa da un error y no deja guardar: hay que usar otro nombre.
- Con diagrama EC-2 (Sargin) el nombre debe terminar en _EC2 y al revés.
- Sargin se dibuja con su ley (fcm, pico, εc1, εcu1), tracción elástica con Ecm hasta fctm y caída casi vertical (el EC-2 no da rama de ablandamiento), y a trazos el diagrama de cálculo (Sargin con fcd y sin tracción). `materialDeFicha(f, norma, { tracc: true })` da la tracción; por defecto (ELU) siempre es cero.

## Aceros tipificados, k y edad (11/10, Pepiño)
- B 400 S, B 400 SD, B 500 S y B 500 SD vienen en todo proyecto nuevo, escritos como en la UNE 36065 / EHE-08 34.2 / CE (con espacios; el EC-2 no nombra los aceros). No admiten ningún cambio salvo el nombre (campos bloqueados). Los de nombre antiguo sin espacios (B500S…) se renombran al cargar y las secciones que los usan siguen a su acero. SD = clase de ductilidad C; S = clase B.
- Rama inclinada: se pregunta k = (ft/fy)k, por defecto el mínimo de la clase (EC-2 2004 tabla C.1; EC-2 2023 tabla 5.5) y hasta 1,35; el valor real lo garantiza el fabricante.
- En la tabla de edad, la fila de 28 días va en gris.
