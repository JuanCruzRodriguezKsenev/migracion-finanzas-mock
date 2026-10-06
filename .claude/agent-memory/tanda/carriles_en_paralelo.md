---
name: carriles-en-paralelo
description: cómo se corren varios obra a la vez (worktree + base propia por carril) y qué planes son independientes de verdad
metadata:
  type: project
---

Un `obra` por carril, cada uno en su `git worktree` (obra exige árbol limpio y no cambia de rama). Base de tests = `<nombre de DATABASE_URL>_test` (cambio en `vitest.config.ts` y `vitest.setup.ts`, commit 4e0fc1b); cada worktree lleva su `.env.local` (ignorado por git, hay que copiarlo) con otra base `finanzas_db_<carril>` y otro puerto.

**Why:** pedido del usuario 2026-10-06, «es eterno» ir plan por plan.

**How to apply:** dependencias reales: acceso (05→08) independiente; 09→10 independiente de acceso; 11 y 13 exigen el 10 (13 usa `claveDeMes`; el encabezado de 13 dice «sale de feat/presupuestos-pagina» pero su precondición dura es sólo el 10). Migraciones chocan entre carriles (0032 repetido): al integrar el segundo, rebasear, borrar su migración+snapshot, restaurar journal y `pnpm db:generate`. Integrar de a uno, fast-forward. Detalle en `Estado.md` § Carriles.
