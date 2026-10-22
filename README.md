# Prontuario informático del hormigón 2026

- `prontuario-web/`: aplicación (JS, esbuild). `node tools/build.mjs` genera `dist/`; tests con `node --test tests/*.test.js`.
- `analisis/`: guías, decisiones y planes de cálculo.

Los textos de las normas (analisis/normativa) no se publican.

Página publicada: el flujo `.github/workflows/publicar-pagina.yml` construye la aplicación y la publica en GitHub Pages (requiere Settings > Pages > Source: GitHub Actions). Bitbucket solo muestra el código y este README.
