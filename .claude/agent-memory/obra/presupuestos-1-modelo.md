---
name: presupuestos-1-modelo
description: Lecciones del plan 11 (presupuestos modelo y cálculo): escape de regex en drizzle sql, índice parcial, plan sin desvíos.
metadata:
  type: project
---

Plan 11 salió sin desvíos del plan; 48 tests nuevos, batería verde (609 tests, 81 suites).

- `sql\`...\`` de drizzle consume `\d`: el CHECK quedó `'^d{4}...'`. Usar `[0-9]`. **Why:** el SQL generado lo delata; verificar siempre el `.sql`. **How to apply:** cualquier CHECK con regex.
- drizzle-kit sí emite el `WHERE` de `uniqueIndex().where()`.
- Plan nombraba "mock del repositorio" para atomicidad: `create` llama `this.upsertLimit` y se espía con `vi.spyOn`.
- El plan no cerraba: padre sin hojas (se suma su propio gasto), `revalidatePath` sin ruta, defaults opcionales de `getBudgetsAction`. Área donde el plan fue algo corto: forma de `divisas` y firma de fixtures de test.
- Fixtures de integración van en `features/<x>/testing/` (convención de loans).
- Worktrees por carril: cada uno con su `.env.local` y base propia; migración 0032 choca entre carriles.
