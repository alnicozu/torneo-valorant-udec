# Cómo publicar esta página (copia independiente)

Esta es una copia independiente de https://torneo-udec.vercel.app con cambios propios.
NO debe compartir repositorio, proyecto de Vercel ni base de datos con la original.

1. Crear un repositorio nuevo en GitHub (cuenta alnicozu), por ejemplo `torneo-valorant-udec`, y subir esta carpeta tal cual (sin node_modules).
2. En Vercel (equipo "valorant-2026"): Add New → Project → importar ese repositorio → Deploy. Framework: Next.js (se detecta solo).
   - Nombre del proyecto = link: `torneo-valorant-udec` → https://torneo-valorant-udec.vercel.app (si está tomado, usar una variación y anotarla).
3. Vercel → proyecto nuevo → Storage → Create Database → Neon (plan Free) → conectarla al proyecto nuevo.
   - Custom Prefix: `DATABASE` (así crea DATABASE_URL). NO marcar "Create database branch for deployment".
4. Discord (https://discord.com/developers/applications): usar la MISMA app de la página original.
   - OAuth2 → Redirects → agregar (sin borrar el que ya existe): `https://<link-nuevo>/api/auth/callback/discord` → Save.
5. Vercel → proyecto nuevo → Settings → Environment Variables (Production y Preview):
   - DISCORD_CLIENT_ID = el mismo que en el proyecto original `torneo-udec`
   - DISCORD_CLIENT_SECRET = el mismo que en el proyecto original
   - ADMIN_DISCORD_IDS = el mismo que en el proyecto original
   - NEXTAUTH_URL = `https://<link-nuevo>` (sin / al final)
   - NEXTAUTH_SECRET = un texto nuevo al azar de 32+ caracteres (ej: `openssl rand -base64 32`)
6. Deployments → último → ⋯ → Redeploy.
7. Verificar: la página carga sin el aviso "Modo demo", "Entrar con Discord" funciona, y un admin ve "Panel de admin".
8. Abrir inscripciones en Panel de admin → Ajustes (casilla "Inscripciones abiertas").

Nunca copiar los valores secretos en el chat ni en archivos del repositorio.
