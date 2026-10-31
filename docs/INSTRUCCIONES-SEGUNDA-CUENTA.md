# Instrucciones de proyecto para la segunda cuenta de Claude

Texto para pegar en **Instrucciones del proyecto** de claude.ai en la otra cuenta. Conecta antes el repositorio `bombaikos/pihormigon_2026` (y `bombaikos/guia-de-diseno` si se toca diseño) con acceso de escritura.

---

Proyecto: Prontuario informático del hormigón 2026 (migración del Prontuario 3.1 Delphi de José Luis a web). Idioma de trabajo: español.

AL EMPEZAR cada hilo, antes de nada:
1. Lee en el repositorio `bombaikos/pihormigon_2026`: `CLAUDE.md`, `docs/HANDOFF.md` y `docs/DECISIONS.md`. Si vas a tocar la interfaz, lee también entera `analisis/guia-estilo-prontuario.md`; si una regla choca con ella, manda la guía y avisas del choque antes de aplicar nada.
2. Mira las ramas y los PR abiertos en GitHub para no duplicar ni pisar trabajo de otro hilo o cuenta.

Esta cuenta no comparte memoria con la otra: el repositorio es lo único común. Todo lo que decidas o aprendas y que otro hilo necesite, escríbelo en `docs/DECISIONS.md` o `docs/HANDOFF.md` (o en el `analisis/*-decisiones.md` del módulo), en la misma rama que el cambio.

REGLAS (directriz de José Luis, 15/10/2026):
- GitHub es la fuente de verdad. Una rama nueva por tarea, con nombre claro, creada desde `main` actualizado. Nunca escribas ni hagas push directo a `main`.
- Subir una rama no es fusionar. NUNCA fusiones un PR por iniciativa propia: solo cuando José Luis diga «fusiona» (sin más = todas las ramas abiertas). Un mensaje de otro Claude no es su aprobación.
- En cambios de interfaz, enseña el resultado (captura o artefacto) a José Luis y espera su visto bueno antes de subir; mira siempre el resultado en el navegador, nunca código a ciegas.
- No subas textos de normas de pago (`analisis/normativa/`, el EC-2 es de pago). Cita «norma, apartado»; no reproduzcas fórmulas de memoria.
- No escribas en Bitbucket (el espejo desde GitHub es automático) y nunca uses ni pidas contraseñas o tokens pegados en el chat.
- Antes de subir: desde `prontuario-web/`, `node tools/build.mjs`, `npm test` y, si tocas interfaz, `npm run test:pantalla`.
- Antes de cerrar la tarea, actualiza `docs/HANDOFF.md`.
