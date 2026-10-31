# Prontuario informático del hormigón 2026 — instrucciones para cualquier hilo

Idioma de trabajo: **español**. Usuario final: José Luis (decide y da el visto bueno). Pepiño gestiona el proyecto y las cuentas de Claude.

**Al empezar: lee este archivo, `docs/HANDOFF.md` (estado actual) y `docs/DECISIONS.md` (decisiones vinculantes).** Si vas a tocar la interfaz, lee también entera `analisis/guia-estilo-prontuario.md`; si entra en conflicto con otra regla, manda la guía y se avisa del choque antes de aplicar nada.

## Procedimiento de publicación (directriz de José Luis, 15/10/2026)

GitHub (`bombaikos/pihormigon_2026`) es la fuente de verdad. Bitbucket es solo una copia automática.

1. **Una rama nueva por tarea.** Cada hilo trabaja en su propia rama de GitHub (nombre claro, p. ej. `cortante-estilo`); nunca se escribe en `main` directamente.
2. **Antes de subir, enseñar el resultado** (artefacto o captura) y esperar el visto bueno de José Luis (cambios de interfaz).
3. **Nada va a `main` sin su «fusiona».** Si dice «fusiona» sin más, se fusionan con PR todas las ramas abiertas.
4. **El espejo a Bitbucket es automático:** al entrar algo en `main`, el flujo `.github/workflows/espejo-bitbucket.yml` lo copia con el secreto `BITBUCKET_TOKEN`. Los hilos no escriben en Bitbucket (solo lectura) ni usan contraseñas o tokens pegados en el chat.
5. **Los textos de las normas (`analisis/normativa/`) no se suben** (el EC-2 es de pago).

Detalle del espejo: `analisis/espejo-bitbucket.md`.

## Trabajo desde varias cuentas de Claude

La memoria de proyecto de claude.ai **no se comparte entre cuentas**. Lo único común es este repositorio. Por tanto:
- Todo lo que un hilo decida o aprenda y que otro hilo necesite va a `docs/DECISIONS.md` (decisiones), `docs/HANDOFF.md` (estado) o al `analisis/*-decisiones.md` del módulo, en la misma rama/PR que el cambio.
- Al cerrar una tarea, actualiza `docs/HANDOFF.md` (qué quedó hecho, qué a medias, rama/PR).
- Antes de empezar, mira las ramas y PR abiertos para no duplicar trabajo.

## Stack y comandos

- JavaScript vanilla con módulos ES, sin framework; la app es una SPA que se empaqueta en **un solo HTML** (`dist/prontuario.html`, funciona con doble clic, sin servidor; `dist/artifact.html` es el mismo contenido como fragmento).
- Todo vive en `prontuario-web/` (ejecutar los comandos desde ahí):
  - Instalar: `npm i -D esbuild` (y Playwright solo para el test de pantalla).
  - Build: `node tools/build.mjs` (esbuild; genera `dist/`). **Regenera `dist/` antes de subir** una rama que toque código.
  - Tests: `npm test` (= `node --test tests/*.test.js`, Node ≥ 18).
  - Test de pantalla: `npm run test:pantalla` (abre cada módulo a 1536×730 y 1366×657 y falla si hay scroll de página).
  - Desarrollo con módulos sueltos: `python -m http.server 8000` en `prontuario-web/`.
- El CI de GitHub Pages (`publicar-pagina.yml`) construye y publica la app al entrar en `main`.

## Normas de referencia

Tres normas activas: **EC-2 2004 + Anejo Nacional (por defecto, vigente)**, **EHE-08** y **EC-2 2023** (no vigentes: su nombre sale en rojo). EHE-98 está descartada (los proyectos antiguos migran a EHE-08). El Código Estructural (CE) solo para recubrimientos/durabilidad; en todo lo demás, EC-2. Los textos están en `analisis/normativa/` en el equipo de José Luis, **no en el repositorio**; cita «norma, apartado» y no reproduzcas fórmulas de memoria: si una fórmula no se puede verificar, apúntala en `analisis/formulas-por-verificar.md`.

## Unidades y convenciones de cálculo

- Unidades de interfaz: mm (escuadrías, recubrimientos, diámetros), m (luces), mm² (armaduras), kN y kN·m (sin decimales), MPa (un decimal), deformaciones en ‰. El motor interno trabaja en **kN y m** (como el Delphi original). Nunca cm. (En el sentido N-mm-MPa del EC-2, las fórmulas de `norma/` pueden operar en esas unidades; la conversión se hace en la frontera.)
- **Compresión positiva** en todo el Prontuario; la curva del hormigón va en el primer cuadrante.
- Notación del EC-2 con subíndices reales (MEd, NEd, fck, fcd, γC, εcu…) sea cual sea la norma.
- Punto decimal en pantalla; se acepta coma al escribir.
- Detalle y más reglas: `analisis/guia-estilo-prontuario.md` (vinculante) y `docs/DECISIONS.md`.

## Reglas de código

- Motor de cálculo puro en `src/core/` y `src/norma/`, sin DOM. Los textos van en `src/i18n/*.es.js` y `*.en.js` (nunca textos sueltos en la interfaz).
- Reutiliza los componentes comunes (`src/ui/campos.js`, `rejilla.js`, `grafica.js`, `formato.js`, etc.) antes de crear otros.
- Cada módulo nuevo con su test en `tests/` y su entrada en `tools/encaje.mjs` (test de pantalla).
- Sin dependencias en tiempo de ejecución; fuentes del sistema; nada descargado de internet.
