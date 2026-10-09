---
name: seed-31-cuentas-propias
description: Plan 31 seed con cuentas propias por usuario en sus espacios Personales: ayudante sembrarCuentaPropia, orden estricto de scripts y verificación contra Postgres
metadata:
  type: project
---

Plan 31 ejecutado completo hasta la batería en la rama `seed-cuentas-propias` (commit `0bb3858`). Sin consultas ni desvíos: plan limpio y acotado.

**Qué se aprendió y funcionó directo**
- El ayudante `sembrarCuentaPropia( db , datos )` en `src/shared/db/seedCuentasPropias.ts` abstrajo de forma limpia la búsqueda/creación de entidad del Personal, la búsqueda de cuenta por titular y nombre, y la limpieza/asignación de `account_shares`.
- Recibir `DBOrTx` permitió usarlo tanto con la conexión directa `db` en `seedReparto.ts` como dentro de la transacción `tx` de aprovisionamiento en `seed.ts:137`.
- El orden `db:seed` antes de `db:seed:reparto` es crítico porque `seed.ts` borra todas las cuentas de todas las organizaciones al inicio; quedó explícitamente logueado en la consola al cierre de ambos scripts.

**Verificación**
- Reconstrucción de la base dev (`DROP SCHEMA CASCADE`, `db:migrate`, `db:seed`, `db:seed:reparto`) más segunda corrida de `seedReparto` verificó idempotencia limpia.
- La consulta SQL confirmó exactamente 5 cuentas propias con sus respectivos estados de compartición (1 de Juan compartida con `reparto-demo`, las demás 4 privadas en sus respectivos espacios personales).
