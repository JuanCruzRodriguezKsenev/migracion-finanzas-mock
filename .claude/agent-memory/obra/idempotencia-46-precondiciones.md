---
name: idempotencia-46-precondiciones
description: Plan 46 idempotencia en acciones que crean hechos; precondición estricta de unificación de ramas (marcas-39b y feat/avisos-y-acceso) y detención por contrato
metadata:
  type: execution-lessons
---

# Plan 46: Idempotencia en las siete acciones que crean un hecho nuevo

## Resumen de ejecución
- **Detención temprana:** Al invocar el Plan 46 en el workspace `/home/jcrod/Dev/finanzas/migracion-finanzas-mock`, se verificaron las precondiciones estipuladas en la cabecera del plan.
- **Precondiciones requeridas por el plan:** Rama `idempotencia` creada desde `master` unificado tras integrar `marcas-39b` y `feat/avisos-y-acceso`; presencia de `src/features/splits/services/pagosService.ts` (Plan 44) y `docs/patterns.md` §3 actualizado (Plan 41b).
- **Estado real:** El checkout se encontraba en `marcas-39b`. El archivo `pagosService.ts` no existía en esta rama (vive en `feat/avisos-y-acceso` en su worktree). Ni `marcas-39b` ni `feat/avisos-y-acceso` estaban integradas a `master`.
- **Acción tomada:** De acuerdo con §2 (`obra` no improvisa ni avanza a medias cuando el código no coincide con lo asumido), §2b (registro inmediato de bloqueo en `Informes/` para `tanda`) y §6 (`obra` nunca crea ramas, nunca mergea ni cambia de rama), se detuvo la ejecución sin modificar archivos en el repo, se redactó y commiteó el informe `46 - Idempotencia en las acciones que crean hechos.md` en la bóveda, y se documentó el bloqueo.

## Lecciones aprendidas para futuros planes y para `tanda`

1. **Dependencia cruzada de carriles en paralelo:**
   - Cuando un plan requiere cambios de dos carriles concurrentes (en este caso el refactor de `registrarPagoAction` de `feat/avisos-y-acceso` y la documentación/patrón de `marcas-39b`), `tanda` o el usuario deben ejecutar formalmente el paso de integración y cambio de rama a `idempotencia` antes de pasarle la ejecución a `obra`.
   - `obra` cumple fielmente la precondición declarada en el plan y no intenta una ejecución parcial que dejaría ramas divergentes o deuda oculta.
