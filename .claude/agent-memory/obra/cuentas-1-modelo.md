---
name: cuentas-1-modelo
description: Plan 23 cuentas personales: choque de códigos con el índice único, fixtures Account rotos por campo nuevo, predicados sin efecto observable, TABLAS_CON_ORGANIZACION fuera de testFixtures
metadata:
  type: project
---

Plan 23 (cuentas personales, `owner_user_id` + `account_shares`) salió completo, un solo commit, batería verde. Dónde el plan se quedó corto:

- **Código contable:** el plan decía `getNextCode("asset", cuentas del dueño)`; choca siempre. Hay que mirar todas las ancladas (`findTodasEnAncla`). Además `createAccountAction`, `createAccountForEntityAction` y `loansActions:141` siguen usando `findAll` y chocan con personales: el usuario eligió dejarlo como hallazgo para `tanda`, no arreglarlo. **Why:** decisión suya al preguntar. **How to apply:** no tocarlo si el plan 24 no lo nombra; si lo nombra, ya está en el informe.
- **Campo nuevo obligatorio en un tipo inferido** rompe `tsc` en tests (12 fixtures `Account`): el plan no los listó. Anticipar con `tsc` apenas cambia el esquema.
- **Predicados sin efecto observable:** una personal es siempre `asset`, así que `cuentaDeLaOrg` en flujos/gasto por hoja/top gastos no se puede discriminar con tests; sólo patrimonio, saldos, divisas, resumen, tarjetas, préstamos y caja.
- `TABLAS_CON_ORGANIZACION` está en `organizationRepository.ts`, no en `testFixtures.ts`; su test compara contra `information_schema`, así que una tabla nueva con `organization_id` lo rompe.
- AC-12 con datos reales: la base del worktree estaba vacía; usé `CREATE DATABASE … TEMPLATE finanzas_db` y apliqué el SQL de la migración sobre la copia (se borra después).
- Shell fish: globs sin comillas (`--include=*.ts`) fallan; ir entre comillas simples.

Relacionado: [[reparto-3-caja-comun]].
