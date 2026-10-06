---
name: estadisticas-1-reversados
description: Exclusión de asientos reversados y contra-asientos en flujos vs saldos patrimoniales (RN-6)
metadata:
  type: reference
---

# Exclusión de Reversas en Flujos Mensuales (Plan 09)

- **Distinción entre flujos y saldos (RN-6):** Un asiento reversado genera dos transacciones (`reversedAt != null` en el original y `reversesTransactionId != null` en el contra-asiento). Los flujos (`calcularIngresosMes`, `calcularGastosMes` y `monthlyFlows` en `derivarResumenDeMes`) deben excluir ambos asientos con `isNull(reversedAt) AND isNull(reversesTransactionId)`, nunca netearlos (para evitar saldos de mes negativos al reversar períodos pasados).
- **Invariante en snapshots de balance:** La consulta `snapshots` de `derivarResumenDeMes` no debe aplicar este filtro, ya que la anulación aritmética conserva el principio contable de partida doble en el instante de corte acumulado.
- **Autocorrección vía `rellenarResumenesFaltantes`:** El recálculo de resúmenes de meses cerrados ejecuta `upsert` sobre todos los meses históricos, aplicando retroactivamente la nueva lógica de derivación a los meses previos sin necesidad de script de migración en base de datos.
