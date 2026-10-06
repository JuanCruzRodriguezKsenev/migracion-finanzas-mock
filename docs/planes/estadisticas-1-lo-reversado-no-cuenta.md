# Plan — Estadísticas 1/2: lo reversado deja de contar en el dashboard

**Rama:** `fix/reversados-en-flujos` · **Escrito:** 2026-10-06 · **Abre deuda nueva:** sí (paso 5)
**Spec:** [`../specs/estadisticas/spec.md`](../specs/estadisticas/spec.md) — implementa **RN-6** y **RN-20**; cubre **AC-2** y **AC-4** (la mitad del dashboard).
**RFC:** no hace falta. Corrige un **defecto de datos** sobre código y tablas que ya existen y no cambia el modelo. [RFC 027](../proposals/027-statistics-page.md) (la página) es el plan 2 y **no** se necesita para éste.
**Serie:** **1 este** → 2 `estadisticas-2-pagina` (exige el RFC 027 en `APPROVED`).
**Precondición:** el plan `fix-resumenes-mensuales` está ejecutado y verificado (este plan edita el servicio que ése crea). **Independiente** de la serie de acceso: se puede ejecutar antes, entre o después.

---

## 0. El defecto (verificado, por lectura del código; no lo reproduje antes de escribir el plan)

Un asiento reversado deja **dos** asientos: el original y su contra-asiento, con débito y crédito intercambiados
(`accountingService.ts`, creación de `reversalTx` con `reversesTransactionId: original.id`). Tres lugares suman **un solo lado** de las cuentas de resultado:

| Dónde | Qué suma | Qué pasa con un gasto reversado |
| :--- | :--- | :--- |
| `calcularGastosMes` — `dashboardMetrics.ts:72` | `e.debit` de cuentas `expense` | El gasto original suma; la reversa **acredita** la cuenta y se ignora. **El gasto sigue contando** |
| `calcularIngresosMes` — `dashboardMetrics.ts:50` | `e.credit` de cuentas `revenue` | Igual, al revés: **el ingreso reversado sigue contando** |
| `derivarResumenDeMes` — `monthlySummaryService.ts:43-44` | `credit` de `revenue` y `debit` de `expense` por SQL | Alimenta `monthly_summaries`, y de ahí los sparklines del dashboard: el mismo error, **en el pasado** |

**La corrección es excluir el par, no netearlo** (RN-6): un asiento con `reversed_at` no nulo y su reversa
(`reverses_transaction_id` no nulo) no cuentan en ningún flujo. Excluir es lo que la spec decidió; netear daría un mes con gasto
negativo cuando se reversa algo de un mes anterior.

**Lo que NO se excluye:** los **saldos**. la consulta `snapshots` de `derivarResumenDeMes` y `accounts.balance` incluyen el original
y su reversa, que se anulan entre sí: es lo correcto y **no se toca**. Esta distinción es la tabla de decisión de la spec; un ejecutor
que filtra de más la rompe.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/accounting/utils/dashboardMetrics.ts` | `calcularIngresosMes` y `calcularGastosMes`: descartar transacciones reversadas y reversas |
| `src/features/accounting/services/monthlySummaryService.ts` | La consulta de **flujos** (`monthlyFlows`, `:41-58`): agregar las dos condiciones. **La consulta de `snapshots` queda igual** |
| `src/features/accounting/utils/dashboardMetrics.test.ts` | Casos nuevos (§2) |
| `src/features/accounting/services/monthlySummaryService.test.ts` | Casos nuevos (§2). **Si no existe, el plan `fix-resumenes-mensuales` no terminó: parar** |
| `docs/TECHNICAL_DEBT.md` · `docs/trabajo-en-vuelo.md` | Estado y deuda |

**Quién más calcula flujos, barrido y no supuesto** (`grep -rn "e.debit\|e.credit\|\.debit\b.*expense\|totalRevenue\|totalExpense" src/ | grep -v test`):
las dos funciones del dashboard, `derivarResumenDeMes`, y los `calcularSparkline*` (`dashboardMetrics.ts:157-230`), que **no calculan flujos**: leen `monthly_summaries`
y empujan el punto del mes en curso con lo que le pasan `calcularIngresosMes`/`calcularGastosMes`. **Corrigiendo esas tres no hace falta tocar los sparklines.**
Si el barrido encuentra otro sitio que suma un solo lado del asiento, **se anota como hallazgo y no se toca**.

---

## 2. Pasos

### Paso 1 — `calcularIngresosMes` y `calcularGastosMes`

Las dos reciben `TransactionWithEntries[]`, que es `LedgerTransaction & { entries }` (`ledgerRepository.ts:19`), así que **ya traen** `reversedAt` y `reversesTransactionId`.
En el `.filter` de fecha que ya existe, agregar la exclusión: `tx.reversedAt == null && tx.reversesTransactionId == null`.
**Una sola función auxiliar** (`esAsientoVigente( tx )`, en el mismo archivo, con su JSDoc) usada por las dos; no repetir la condición.
**No** cambiar firmas ni el resto del cálculo.

### Paso 2 — `derivarResumenDeMes`

En `monthlyFlows`, agregar al `where( and( … ) )`: `isNull( ledgerTransactions.reversedAt )` e `isNull( ledgerTransactions.reversesTransactionId )`
(`isNull` de `drizzle-orm`; mirar los imports del archivo). La consulta `snapshots` **no** lleva estas condiciones. Comentario junto a cada una que diga por qué una excluye y la otra no.

### Paso 3 — Tests

**`dashboardMetrics.test.ts`** (el archivo ya arma `TransactionWithEntries`; seguir su estilo):
- Un gasto y su reversa en el mismo mes → `calcularGastosMes` da 0.
- Un ingreso reversado → `calcularIngresosMes` da 0.
- Un gasto **no** reversado junto a uno reversado → cuenta sólo el primero.
- El gasto original **con** `reversedAt` y la reversa **sin** `reversedAt` pero con `reversesTransactionId` → los dos se excluyen (cada condición por separado).

**`monthlySummaryService.test.ts`** (integración, base real):
- **AC-2:** un gasto de $100.000 y su reversa (usar `reverseLedgerTransaction`, no armar los asientos a mano) en un mes cerrado → `totalExpense` de ese mes es 0.
- **La tabla de decisión, fila 5:** gasto de marzo reversado en abril → `totalExpense` de marzo y de abril son 0, **y** `balanceSnapshot` de marzo **incluye** el efecto del gasto (el original está dentro de marzo y la reversa no). Es el test que protege la diferencia entre flujos y saldos.
- Un gasto no reversado del mismo mes sigue contando.

### Paso 4 — Comprobar contra datos reales

Con la base de desarrollo sembrada (`pnpm db:seed`, ya arreglado por el plan 0): crear un gasto desde la interfaz, reversarlo, y mirar que el **gasto del mes** del dashboard no lo cuente. Anotar el número **antes** de reversar y **después**.

Y el efecto sobre los sparklines: abrir el dashboard una vez más (el relleno **recalcula todos** los meses cerrados con `upsert`, `rellenarResumenesFaltantes`) y comprobar que un mes con una reversa en el pasado cambió.

### Paso 5 — Deuda que se abre

En `TECHNICAL_DEBT.md`, dos viñetas **nuevas** (no son parte de la corrección):
1. **`rellenarResumenesFaltantes` recalcula todos los meses en cada apertura del dashboard**: el JSDoc dice «los que falten», pero el bucle (`monthlySummaryService.ts`, `while` desde el primer asiento hasta el mes anterior) hace `upsert` de **cada** mes, dos consultas por mes. Con la historia creciendo, es costo por visita. Es idempotente y **autocorrige** resúmenes viejos, que es lo que hace que este plan surta efecto sin migración.
2. **`monthly_summaries` no tiene divisa** y suma pesos con dólares (`derivarResumenDeMes`). El [RFC 027](../proposals/027-statistics-page.md) la deja de usar para Estadísticas; el dashboard la sigue usando.

---

## 3. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "reversedAt\|reversesTransactionId" src/features/accounting/utils/dashboardMetrics.ts src/features/accounting/services/monthlySummaryService.ts
git diff --stat
```

Pegar la salida cruda. **Criterio de «sólo cambió lo que debía»:** `git diff --stat` toca los dos archivos de código, sus dos suites y los docs; **ningún otro**.

---

## 4. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Netear en vez de excluir | Es lo que la spec descarta (RN-6) |
| Excluir el par de los **saldos** o de `accounts.balance` | Rompería la contabilidad: el original y la reversa se anulan |
| Cambiar los `calcularSparkline*` | Leen resúmenes y los puntos que se les pasan |
| Agregar divisa a `monthly_summaries` o arreglar el signo de los pasivos | RFC 027; otra tanda |
| Optimizar el relleno de resúmenes | Es deuda declarada (paso 5), no esta corrección |

## 5. Reportá

Los **hallazgos** en lista aparte, y los números del Paso 4 (antes y después de reversar).
