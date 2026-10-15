# Procedimiento de publicación (directriz de José Luis, 15/10/2026)

GitHub (`bombaikos/pihormigon_2026`) es la fuente de verdad. Bitbucket es solo una copia automática.

1. **Una rama nueva por tarea.** Cada hilo trabaja en su propia rama de GitHub; nunca se escribe en `main` directamente.
2. **Antes de subir, enseñar el resultado** (artefacto o captura) y esperar el visto bueno de José Luis.
3. **Nada va a `main` sin su «fusiona».** Si dice «fusiona» sin más, se fusionan con PR todas las ramas abiertas.
4. **El espejo a Bitbucket es automático:** al entrar algo en `main`, el flujo `.github/workflows/espejo-bitbucket.yml` lo copia con el secreto `BITBUCKET_TOKEN`. Los hilos no escriben en Bitbucket (solo lectura) ni usan contraseñas o tokens pegados en el chat.
5. **Los textos de las normas (`analisis/normativa/`) no se suben** (el EC-2 es de pago).

Detalle del espejo: `analisis/espejo-bitbucket.md`. Idioma de trabajo: español.
