---
name: reclamos-pago-44
description: Plan 44 «Ya pagué» desde aviso y confirmación del acreedor, actionPolicy fail-closed, advisory lock vs índice parcial y for("update")
metadata:
  type: reference
---

# Lecciones del Plan 44 — «Ya pagué» desde el aviso, con confirmación del acreedor

- **Gobernanza de Server Actions con `actionPolicy.ts`:** Toda exportación de cualquier archivo bajo `src/features/*/actions/*.ts` debe estar registrada en `POLITICA_DE_ACCIONES` (`src/shared/lib/actionPolicy.ts`). La suite `actionPolicy.test.ts` es fail-closed: carga dinámicamente con `import.meta.glob` todos los archivos de acciones y falla si hay acciones no catalogadas. Si las acciones de un archivo no usan `obtenerSesionDeEscritura()` porque obtienen la organización de la fila de DB del aviso o reclamo y revalidan el rol directamente en la transacción (RN-40), deben registrarse como `{ exenta: "motivo..." }`. Tanda debe incluir `actionPolicy.ts` en el radio de impacto de todo plan que cree un archivo de acciones.
- **Limpieza de imports tras extracciones:** Al extraer lógica compartida (`saldoCon` y `registrarPagoEnTx` hacia `pagosService.ts`), se debe revisar y limpiar inmediatamente los imports huérfanos (`DBOrTx` en `saldosActions.ts`), para no disparar warnings en `pnpm exec eslint . --max-warnings 0`.
- **Restricción única parcial vs Advisory Lock:** La prueba simultánea de `reclamarPagoAction` (AC-38) se sostiene atómicamente a nivel de base de datos gracias al índice único parcial `payment_claims_pending_unique` (`WHERE status = 'pending'`) y a `.onConflictDoNothing()`. El advisory lock `bloquearPar` previene carreras a nivel de lógica de aplicación, pero la restricción de motor garantiza que ninguna condición de carrera viole la invariante de a lo sumo un reclamo pendiente.
- **Bloqueo a nivel de fila `for("update")` para evitar doble resolución:** En `confirmarReclamoAction`, `rechazarReclamoAction` y `cancelarReclamoAction`, tomar la fila del reclamo con `.for( "update" )` es vital para la idempotencia concurrente: si dos toques simultáneos de «Confirmar» ocurren, la segunda transacción espera a que la primera termine y lee inmediatamente el nuevo estado `status === 'confirmed'`, respondiendo «El pago ya fue resuelto.» en lugar de intentar un segundo registro de pago contra un saldo ya en 0.
