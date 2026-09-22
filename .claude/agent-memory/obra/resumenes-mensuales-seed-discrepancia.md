---
name: resumenes-mensuales-seed-discrepancia
description: Hallazgos y discrepancias en el plan fix-resumenes-mensuales respecto al seed y occurredAt
metadata:
  type: reference
---

# Discrepancias en el plan de Resúmenes Mensuales (Paso 4 / seed.ts)

- **Pasos 1-3 ejecutados limpiamente:** Se implementó `derivarResumenDeMes` y `rellenarResumenesFaltantes` en `monthlySummaryService.ts`, el `upsert` con `onConflictDoUpdate` en `monthlySummaryRepository.ts`, la Server Action `rellenarResumenesMensualesAction` en `accountingActions.ts`, y la llamada previa en `page.tsx`.
- **Inconsistencia de variables en `seed.ts`:** El plan indicaba eliminar `seed.ts:428-459` y borrar `saldoAcumulado`, pero al mismo tiempo prescribía mantener el ajuste de saldos de `:466`. En el código real, `:462` calculaba `const diferenciaAjuste = ( saldoAcumulado - 19000000 )`, impidiendo compilar sin `saldoAcumulado`.
- **Desconexión temporal en `registrarTransaccion`:** El helper `registrarTransaccion` de `seed.ts` solo actualizaba `createdAt: fecha` en la base de datos, mientras que `occurredAt` quedaba con el valor por defecto (`now()`). Dado que `derivarResumenDeMes` y `rellenarResumenesFaltantes` filtran estrictamente por `occurredAt`, todas las transacciones históricas sembradas quedaban invisibles a la derivación de meses pasados cerrados.
- **Lección para tanda:** Al planificar modificaciones sobre scripts de siembra o fixtures que dependen de cálculos previos en bloque, verificar las dependencias de variables posteriores en el archivo (`diferenciaAjuste` dependiendo de `saldoAcumulado`) y las columnas temporales que el motor contable realmente consulta (`occurredAt` vs `createdAt`).
