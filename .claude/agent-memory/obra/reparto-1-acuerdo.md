---
name: reparto-1-acuerdo
description: Plan 19 Reparto 1 (acuerdo y reparto de gastos): contradicciones del plan (notifications.transaction_id, S-S), desvíos y trampas
metadata:
  type: project
---

Plan 19 ejecutado completo en `feat/reparto-1-acuerdo` (commits `61bbbd0` backend, `29f74e3` UI). Sin consultas al usuario: no había `AskUserQuestion` en la sesión, así que lo que el plan dejó a medias se resolvió con la opción mínima y se informó.

**Dónde el plan se quedó corto:**
- `agreement_changed` (RN-9e) no cuelga de ningún movimiento, pero `notifications.transaction_id` era `NOT NULL` y el listado hacía `innerJoin` con `ledger_transactions`. Hubo que aflojar la columna en la misma migración `0037`, `leftJoin` en `listarRecientes` y `transactionId` opcional en `notificar`. El plan no lo mencionaba.
- El test S-S del plan («un miembro que entra sin fila de porcentaje → desactualizado») contradice la regla del propio S-S (sin fila = 0 %, suma sigue 10000, no hay desactualización). Implementé la regla y reescribí el test con el caso real (alguien con porcentaje pasa a `viewer`). El checklist manual §4 paso 6 («invitá a un tercero…») tampoco se cumple: quien entra no desactualiza.
- `resolverReparto` necesita tipo y monto antes de insertar la cabecera, pero el servicio sólo conoce las cuentas después; se leyeron las cuentas (sin bloqueo) en un paso previo `resolverRepartoDeLaCarga`.
- `expense_splits.currency` pedía `varchar(3)`; se usó `varchar(10)` como el resto del repo (misma lección que el plan 18).
- `BigInt` literal (`0n`) no compila con el target de tsc: usar `BigInt( 0 )`.
- La vista previa del formulario sólo conoce la cuenta de origen (la de gasto la resuelve el servidor por categoría): la fila 4 (caja común) en la vista previa mira sólo esa cuenta. Avisar al plan 21.

**Trampas:**
- `accounts.isCommonPot` obliga a sumar `isCommonPot: false` en ~20 literales de `Account` de tests (sólo compilador, cero aserciones). Alinear el valor a la columna con regex multilínea.
- Concurrencia de `guardarAcuerdoAction`: `pg_advisory_xact_lock(hashtext(...))` al inicio de la transacción; sin fila previa un `FOR UPDATE` no serializa.
- `limpiarBase` no necesitó las tablas nuevas (cascade por FK), `eliminarCompleta`/`TABLAS_CON_ORGANIZACION`/`crearOrganizacionRica`/`conteosDe` sí.
- El efecto de la vista previa lee la acción desde un ref (`useEffect` sin deps que lo actualiza) para no depender de su referencia: misma lección que el bucle de POST de la campana.

**Why / How to apply:** cuando un plan emite un aviso nuevo, comprobar si el aviso tiene el mismo ancla (movimiento) que los anteriores; y cuando un test del plan contradice la regla escrita, implementar la regla, reescribir el test y decirlo.
