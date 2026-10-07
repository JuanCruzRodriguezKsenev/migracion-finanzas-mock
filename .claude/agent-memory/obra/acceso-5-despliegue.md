---
name: acceso-5-despliegue
description: Plan 08 §2 (pooler de Neon, DEPLOY.md): vitest no incluye src/shared/db, tests van en shared/lib; plan sin desvíos de fondo.
metadata:
  type: project
---

Plan 08 §2 salió limpio salvo un hueco: el plan ubicaba `connectionOptions.test.ts` en `src/shared/db/`, pero `vitest.config.ts` sólo incluye `shared/lib`, `shared/services`, `shared/ui` y `features`.

**Why:** "No test files found" al correr el test; precedente: `src/shared/lib/bootstrap.test.ts` testea código de `shared/db`.

**How to apply:** tests de código de `src/shared/db/` van a `src/shared/lib/` con import `@/shared/db/...`. `tanda` debería especificar esa ruta en planes nuevos. Las líneas de `.env.example` de Google ya existían (el plan decía "si falta"). Pasos 3-7 del plan son [USUARIO]; la batería tardó ~6 min (verificador asíncrono, esperar con Monitor).
