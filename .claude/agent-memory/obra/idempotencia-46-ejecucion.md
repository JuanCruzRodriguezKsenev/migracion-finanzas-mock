---
name: idempotencia-46-ejecucion
description: Plan 46 idempotencia ejecutado: envoltorio por script, tests de formulario que rompen por segundo argumento, sin cobertura previa del submit de TransactionFormModal
metadata:
  type: execution-lessons
---

Plan 46 ejecutado sin bloqueos tras cumplirse precondiciones (ver [[idempotencia-46-precondiciones]]).

- El plan fue preciso; sólo hubo que ajustar 6 tests de formularios con `toHaveBeenCalledWith( datos )` -> `( datos , expect.any( String ) )` (Contribute, Caja x3, Saldos). El plan lo anticipaba.
- Envolver el `try` de cada acción en `conIdempotencia` se hizo con un script Python (re-indentar desde `  try {` hasta el `}` final); funcionó a la primera en 6 acciones.
- `fail` de `result.ts` tiene un solo parámetro genérico: en tests tipar la función, no `fail<A,B>`.
- `TransactionFormModal.test.tsx` no cubría el submit; la mutación 5 exigió escribir tests (llenar Monto, Descripción, "Cuenta de pago"; botón "Guardar Transacción").
- Verificador tardó ~7 min (suite completa + build).
