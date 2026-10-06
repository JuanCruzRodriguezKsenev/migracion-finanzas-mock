---
name: resumenes-mensuales-cierre
description: Cierre del plan de resúmenes mensuales, contra-asientos en derivación de flujos y verificación con subagente
metadata:
  type: reference
---

# Cierre del plan de Resúmenes Mensuales (Pasos 4 y 5)

- **Flujos mensuales y contra-asientos de reversión:** La tabla del plan prescribía para `totalRevenue` la suma `Σ credit` y para `totalExpense` la suma `Σ debit`. Sin embargo, al invocar `reverseLedgerTransaction`, los movimientos se invierten generando un débito en la cuenta de ingreso. Para que una reversión contable deje el resumen en cero como exigía el test de §7, los flujos deben calcularse como `(${ledgerEntries.credit} - ${ledgerEntries.debit})` para `revenue` y `(${ledgerEntries.debit} - ${ledgerEntries.credit})` para `expense`.
- **Siembra histórica de 12 meses:** El bucle de 12 meses envolviendo el generador diario en `seed.ts` produjo 571 transacciones contables reales en 17.5 segundos (`real 0m17,529s`), eliminando por completo las variables ficticias (`saldoAcumulado`, `diferenciaAjuste`, `diasMesActual`, `pasivosMes`, `activosMes`) y cuadrando de forma idéntica con la consulta de libro mayor.
- **Narrowing de `Result` en Vitest:** Tras `expect(res.success).toBe(true)`, el compilador de TypeScript (`tsc --noEmit`) no estrecha el tipo discriminado de `Result<T, E>`; se requiere la guarda idiomática `if( !res.success ) return ;` para acceder de forma segura a `res.value`.
