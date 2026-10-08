---
name: cuentas-3-interfaz
description: Plan 25 interfaz de cuentas propias/compartidas - rama ocupada, claves de diccionario extra, tipo sin saldo, trampa de git checkout y fish
metadata:
  type: project
---

Plan 25 salió sin consultas al usuario; el plan fue bastante completo. Huecos que hubo que decidir:

- **Rama:** `cuentas-3-interfaz` estaba tomada por el worktree principal; se ejecutó en `feat/cuentas-1-modelo` (mismo commit que master). Mirar `git worktree list` antes de dar por perdida la rama del plan.
- **Textos:** el plan listaba 4 claves; hicieron falta ~20 más (vista, confirmación, botones). Conviene que `tanda` las liste todas.
- **Ids/nombres de organización:** compartir desde el cliente necesita `organizationId` y nombre; el plan no lo decía (se agregó a la action de movimientos).
- **Saldo:** `CuentaReferenciada` (Pick de Account sin balance) y `CuentaDeListado` (balance `number|null`) en `accounting/types.ts`. Totales de `/accounts` solo cuentan las sin `ownerUserId`.
- **Etiqueta en `/accounts`:** la de `listarConEtiqueta` lista todas las orgs donde se comparte (fuga); en el listado se recalcula con solo la org activa.
- **Option nativa:** no admite componentes; etiqueta como texto (`textoDeEtiqueta`).

**Trampas operativas:**
- Hice `git checkout <archivo>` para deshacer una mutación y borró cambios sin commitear del mismo archivo. Para mutar, copiar a scratchpad y restaurar con `cp`, nunca `git checkout`.
- Shell fish: globs sin match fallan (`--include=*.ts`); usar rutas o comillas. `cd` en Bash cambia el cwd persistente: volver siempre a la raíz.
- La base de dev de este worktree es `finanzas_db_cuentas` (ver `.env.local`), no `finanzas_db`.
- Tests de `TransactionsContainer` necesitan `NotificationsProvider`, mocks de `next/navigation` (useRouter) y de `acuerdoActions`.
