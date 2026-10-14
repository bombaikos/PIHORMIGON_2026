# Espejo GitHub → Bitbucket

El flujo `.github/workflows/espejo-bitbucket.yml` copia main y todas las ramas de GitHub a https://bitbucket.org/ines_dev/pih_2026 en cada push. Solo funciona con un token de Bitbucket guardado como secreto en GitHub.

## 1. Crear el token en Bitbucket
1. Entrar en el repositorio `ines_dev/pih_2026` → **Repository settings** → **Access tokens** → **Create repository access token**.
2. Nombre: `espejo-github`. Permisos: **Repository: Write** (nada más).
3. Copiar el token (solo se muestra una vez).

Si no aparece «Access tokens» o no deja crearlo, hace falta un administrador del repositorio o del workspace `ines_dev`. Pedirle: «un repository access token con permiso Write para pih_2026». Alternativa si prefiere un app password: Personal settings → App passwords, permiso Repositories: Write; entonces hay que guardar también el secreto `BITBUCKET_USER` con su nombre de usuario de Bitbucket.

## 2. Guardarlo en GitHub
1. https://github.com/bombaikos/pihormigon_2026 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Nombre: `BITBUCKET_TOKEN`. Valor: el token. Guardar.
3. Fusionar la rama con el flujo en main (solo cuando usted lo diga) y probar en **Actions** → *Espejo a Bitbucket* → **Run workflow**.

No pegue el token en el chat.

## Si no se puede crear token
- Seguir trabajando solo con GitHub (ramas por hilo, fusión cuando usted lo pida) y subir a Bitbucket a mano como hasta ahora.
- O pedir al administrador de Bitbucket una importación periódica desde GitHub (Bitbucket permite importar, y algunos planes sincronizar, un repositorio de GitHub público o con credenciales).
