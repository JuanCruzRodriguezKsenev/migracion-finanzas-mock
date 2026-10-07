---
name: metas-1-modelo
description: Plan 13 Metas 1 (modelo, cálculo, operaciones atómicas) en worktree propio; qué el plan no cubría y qué salió sin fricción
metadata:
  type: project
---

Plan 13 se ejecutó en el worktree `migracion-finanzas-mock-metas` (rama `feat/metas-modelo`, base `master` cd86ad0), con `.env.local` y base propios; el encabezado del plan hablaba de `feat/presupuestos-pagina`, que no existía.

**Dónde el plan se quedó corto / hubo que decidir:**
- `ProgressBar`/presupuestos no existen: irrelevante para el plan 1, sólo afecta al 14.
- Paso 6 (rol solo lectura, plan 07 inexistente): omitido; las 7 acciones quedan sin clasificar para `actionPolicy` (el 4b las va a encontrar).
- Paso 7 (inventario de módulos): el plan manda editar un doc de la bóveda, pero las reglas de `obra` prohíben escribir en la bóveda salvo Estado e informe: se dejó como hallazgo para `tanda`.
- Plan dice «grep de goalMovements update|delete vacío», pero `testCleanup.ts` hace `tx.delete( goalMovements )` legítimamente: el test de inmutabilidad lo exceptúa por archivo.
- `revalidatePath` en este repo usa `"/[lang]/(main)/<ruta>"`, no `"/[lang]/<ruta>"`.
- En tests de acciones con sesión mockeada, `user.id` tiene que ser UUID válido (el perfil se busca por `userId` uuid).

**Why:** `tanda` usa esto para decidir cuánto detalle poner. **How to apply:** en planes de features nuevas, dar por hecho que el plan no menciona las rutas de `revalidatePath` ni la excepción de `testCleanup` en greps de inmutabilidad.

Sin fricción: esquema con `check()` de drizzle genera SQL correcto; el test de carrera (20 iteraciones) y de interbloqueo pasaron a la primera con el orden meta -> cuenta.
