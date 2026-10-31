# Estado del proyecto (traspaso entre hilos y cuentas)

Actualizado: 31/10/2026. **Actualiza este archivo al cerrar cada tarea.** El estado vivo está en GitHub: `bombaikos/pihormigon_2026`, pestañas Pull requests y Branches.

## Fusionado en `main` (hasta el PR 30)
- Proyecto, Materiales (Crear y editar; Propiedades reológicas con dos pestañas: Historia deformacional y Coeficiente de fluencia) — PR 25, 28, 30 y reologicas-disposicion (gráficos 3:2 en la columna central, tablas con «Copiar tabla» a la derecha, eje de φ fijo).
- Secciones (Rec viga, Rec pilar, T, circular, genérica; Durabilidad por norma; Diagramas M-κ; importación DXF) y selector de sección unificado — PR 27.
- Análisis: Vigas de un vano — PR 18.
- ELU: Flexión simple, Flexión compuesta recta (N-M) — PR 7, 8. Cortante (EHE-08, EC-2 2004+AN, EC-2 2023) — PR 22, 26. Punzonamiento — PR 19, 21. Anclaje y solapo. Rasante en juntas — PR 9, 20.
- Fuego (EHE-08 Anejo 6; CE Anejo 20 para EC-2).
- Diseño: barra de 52 px, campos blancos, [mm], pantalla completa, banderas de idioma — PR 13, 16, 17, 23, 24. Portada BETA con fecha automática. Página en GitHub Pages — PR 12.
- Guía común (`bombaikos/guia-de-diseno`) reestructurada — PR 10 y 12 de ese repo.

## En rama / PR abierto (esperando «fusiona» de José Luis)
- **PR 29** `claude/project-thread-nzo10p`: Flexión simple con cápsula Comprobación|Dimensionamiento|Diagrama, rotura admitida y cuantías por cara. CI verde. Pendiente de visto bueno.
- Este PR de documentación (`claude/project-thread-na7g56`).

## A medias / pendiente conocido
- **Cápsula de modo** (Comprobación | Dimensionamiento | Diagrama): José Luis la extenderá a todos los módulos.
- **Durabilidad**: tablas propias de EHE-08 y EC-2 2004 (hoy cmin,dur manual en parte).
- **Fuego**: revisar tablas contra el BOE y ampliar.
- **Verificación contra el BOE** de fórmulas ilegibles (EHE-08 art. 46 punzonamiento; hipótesis de rasante EHE-08): ver `analisis/formulas-por-verificar.md`.
- **Pendiente de diseño** (guía común): Bielas y Ejecución en gris con motivo (hoy ocultas), menú Ayuda con F1, comprobar rejillas >4 filas/columnas con copiar/pegar y detección de títulos.
- **Módulos del menú sin construir**: Flexión compuesta esviada, Torsión, Inestabilidad de soportes, ELS (flechas y fisuración), Bielas y tirantes, Ejecución y control, Ayuda.
- **Secciones**: cerrar el módulo y pasar a otros; resto de cambios que José Luis pida respecto al 3.1. Contrastar con el Prontuario 3.1 (carpeta de fuentes en el equipo de José Luis).
- **Rasante / Anclaje**: ayuda del módulo; CSV de casos EHE.exe; confinamiento (α3-α5), grupos de barras y mallas en anclaje.
- **Ramas antiguas** ya fusionadas siguen en GitHub (diseno-*, punzonamiento-*, rasante-*…); se pueden borrar cuando José Luis lo diga.

## Cómo retomar
1. Lee `CLAUDE.md` y `docs/DECISIONS.md`; si tocas interfaz, la guía entera.
2. `git fetch` y mira ramas/PR abiertos para no pisar a nadie.
3. Crea tu rama desde `main` actualizado, trabaja, `node tools/build.mjs` + `npm test` (+ `npm run test:pantalla` si tocas interfaz) desde `prontuario-web/`.
4. Enseña el resultado a José Luis, sube la rama, abre PR. **No fusiones sin su «fusiona».**
5. Actualiza este archivo y `docs/DECISIONS.md`.
