---
name: integracion-17-rebase
description: Plan 17 (rebase de acceso/autoría sobre master con Metas): --update-refs mueve las ramas respaldo, journal autofusiona, test de inmutabilidad de goal_movements choca con eliminarCompleta
metadata:
  type: project
---

- `git rebase --update-refs` también rebasa las ramas `respaldo/*` que apuntan a la cadena: los respaldos no sirven. Restaurar con `git branch -f` desde el reflog, o crear tags/respaldos distintos.
- En el commit de autoría `_journal.json` no conflictuó (autofusión con entrada extra); se restauró con `git checkout HEAD -- <journal>` antes de `pnpm db:generate`. El cuadro de conflictos del plan no lo preveía.
- Diccionarios: conflicto de bloque con llaves de cierre compartidas; resolver = HEAD + `    }\n  },\n` + el otro bloque (script python).
- El §2.5 (borrar `goal_movements` en `eliminarCompleta`) rompe el test de inmutabilidad `goalsService.test.ts:405`, que sólo exceptúa `testCleanup.ts`. Parar y consultar: es decisión (excepción en test vs cascade).
- La lista de exclusión del diff §2.7 no cubría lo aportado por Estadísticas a master: verificar archivo a archivo contra `master`.

**Why:** el plan no previó el choque con la guardia de Metas; tanda debe nombrar esos greps de inmutabilidad al tocar tablas append-only.
**How to apply:** al tocar tablas append-only, grepear tests de "inmutabilidad" antes de planificar/ejecutar.
