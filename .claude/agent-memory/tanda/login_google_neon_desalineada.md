---
name: login-google-neon-desalineada
description: 2026-10-09 — el login con Google en producción falla porque Neon está en 0037 y el código pide 0042; plan 28 actualizado, pendiente de obra
metadata:
  type: project
---

- Síntoma: `finanzia-blond.vercel.app/es/auth/signin?error=column organizations.personal_owner_user_id does not exist`. Causa: Neon sin `0038`–`0042`. Se arregla con el plan 28 (actualizado el 2026-10-09 a 43 migraciones).
- **Cómo diagnosticar sin permisos:** la URL del login trae el error textual. El MCP de Vercel da 403 en este scope; sirve `pnpm dlx vercel@62.0.0 --scope juancruzrodriguezksenevs-projects logs --project finanzia --json`. `finanzia.vercel.app` es OTRO proyecto; el de producción es `finanzia-blond.vercel.app`. Traer `DATABASE_URL` de producción con `env pull` lo deniega el harness.
- Preparación para `obra`: el WIP de `marcas-identidad` (planes 39/40) quedó en `git stash` (2 entradas) y `.playwright-cli/` movido a `/tmp/claude-1000/playwright-cli-salida`. **`marcas-identidad` lleva ~10 commits que `master` no tiene** (planes 33–38). Al volver: `git switch marcas-identidad && git stash pop` (dos veces).
- **Why:** `git switch` falla con la memoria de tanda modificada porque difiere entre ramas; hubo que stashear todo.

- **Cierre 2026-10-09:** `obra` ejecutó el plan 28: Neon en 43 migraciones, región `gru1`, `docs/DEPLOY.md` §7, push `cdf1ecc` desplegado (`Ready`). Batería 1362/1362, lint 0, tsc 0, build ok. Falta lo del usuario (§8: Google Console, entrar con Google, M-1..M-5, `pg_dump`). `master` local lleva 1 commit de memoria sin pushear (pushearlo despliega).
- Hallazgos para planes futuros: no hay `psql` en el host (usar `podman exec -i postgres-dev psql "$@"`); `neon branches create` siempre con `--no-secrets`.
