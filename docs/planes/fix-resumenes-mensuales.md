# Plan — Que los resúmenes mensuales salgan del libro y no de `Math.random()`

**Rama:** `fix/resumenes-mensuales` · **Escrito:** 2026-09-21 · **Abre deuda nueva:** sí (paso 7)

No hay RFC y no hace falta: no agrega un dominio ni cambia el modelo. Corrige un **defecto de datos**
sobre tablas que ya existen. El contrato que gobierna es el **§4 de [`.agents/AGENTS.md`](../../.agents/AGENTS.md)**
(estilo) y el **§8** (lo que el proyecto cobra caro: centavos, `organizationId`, Debe = Haber).

**Decisión del usuario (2026-09-21), y es la que ordena todo el plan:** `balanceSnapshot` significa
**liquidez — la suma de las cuentas de tipo `asset`**. No patrimonio neto. Cierra parcialmente el §9
del [RFC 024](../proposals/024-instruments-and-entity-navigation.md), que es texto `APPROVED` y **no
se edita**: la discrepancia se advierte, no se corrige ahí.

---

## 0. El defecto: tres síntomas, una causa

**La causa:** *nadie escribió nunca la derivación de un resumen mensual a partir del libro.* No es que
falte el disparador; falta el cálculo. `monthlySummaryRepository` tiene `create()` y **ninguna acción
lo llama** — sólo se lee (`accountingActions.ts:575` y `:607`).

Los tres síntomas, verificados:

1.  **En producción la tabla nunca se llena.** El único `insert` vive en `seed.ts:447`.
2.  **En la demo, los números son ficción.** El seed **no** los deriva de las transacciones que él
    mismo carga: los inventa con `Math.random()` (`seed.ts:437-443`). El gráfico de tendencia no tiene
    relación con el libro sembrado.
3.  **El gráfico mezcla dos magnitudes.** `calcularSparklineBalance` (`dashboardMetrics.ts:94`) dibuja
    los puntos históricos con `balanceSnapshot` —que el seed llena con **patrimonio neto**— y después
    empuja el punto del mes actual con `calcularBalanceTotal( accounts )`, que suma **sólo cuentas de
    activo**. Patrimonio para el pasado, activos para el presente, en el mismo trazo.

Y un cuarto, que es el que el usuario ve primero: **navegar a un mes pasado muestra todo en cero**
(`page.tsx:149`, la rama «Mes pasado sin registros»), porque no hay fila.

---

## 1. Radio de impacto

| Archivo | Qué hay que hacer |
| :--- | :--- |
| `src/features/accounting/services/monthlySummaryService.ts` | **Nuevo.** La derivación y el relleno. Es el único lugar donde se define qué significa cada columna |
| `src/features/accounting/repositories/monthlySummaryRepository.ts` | Un `upsert` nuevo. Hoy tiene `create`, `findRecent`, `findEarliestMonthKey` y `clear` (`:26`, `:42`, `:117`, `:139`) |
| `src/features/accounting/actions/accountingActions.ts` | Una acción nueva que dispara el relleno. **No se tocan** `getMonthlySummariesAction` (`:558`) ni `getEarliestMonthKeyAction` (`:598`) |
| `src/app/[lang]/(main)/page.tsx` | Una llamada al relleno antes de leer. **Ninguna otra línea** |
| `src/shared/db/seed.ts` | Reemplazar el bloque `:428-459` por una llamada a la derivación real |
| `src/features/accounting/services/monthlySummaryService.test.ts` | **Nuevo.** Los casos del paso 6 |
| `docs/TECHNICAL_DEBT.md` | Una viñeta nueva (paso 7), que **no** es esta corrección |
| `docs/trabajo-en-vuelo.md` | Rama y próximo paso, **en el mismo commit** |

**Quién lee estas columnas, barrido y no supuesto** (`grep -rn "balanceSnapshot\|totalRevenue\|totalExpense\|assetsSnapshot\|liabilitiesSnapshot" src/`):

| Columna | Quién la lee hoy |
| :--- | :--- |
| `balanceSnapshot` | `page.tsx:116,121` y `dashboardMetrics.ts:110` |
| `totalRevenue` / `totalExpense` | `page.tsx:113-114,125,129,133` y `dashboardMetrics.ts:172,202,232` |
| `assetsSnapshot` / `liabilitiesSnapshot` | **Nadie.** Cero lecturas en todo `src/` |

Que nadie lea las dos últimas es lo que permite llenarlas sin cerrar la convención de signo (§2.4).

**No se toca `calcularSparklineBalance`, y hay motivo.** Con la decisión del usuario, el histórico y
el punto vivo pasan a medir **lo mismo** —suma de cuentas `asset`—, así que la función queda
coherente sin cambiarle una línea. **El arreglo del síntoma 3 es la definición, no el código.**

---

## 2. Las decisiones, y de dónde sale cada una

### 2.1 La derivación sale del libro, nunca de `accounts.balance` histórico

`accounts.balance` es el saldo **de hoy**. Para el cierre de un mes pasado hay que sumar los asientos
hasta esa fecha: `Σ(debit − credit)` sobre `ledger_entries`, uniendo con `ledger_transactions` por
`occurredAt <= fin de mes`, filtrando por tipo de cuenta.

*Por qué es correcto:* `createLedgerTransaction` es **la única puerta al libro** y su propio comentario
lo declara —la regla se valida ahí «para que ninguna vía de entrada —acción, seed, script o importador
futuro— pueda saltearlo»—. Todo movimiento de saldo tiene su asiento, así que el libro reconstruye
cualquier fecha.

*Y es lo que hace correcta la reversión:* un contra-asiento es una transacción más, con su fecha, así
que recalcular desde el libro lo refleja solo. Una acumulación incremental, no.

### 2.2 Se recalcula, no se acumula

El relleno **recomputa** cada mes faltante desde cero. No suma deltas sobre el mes anterior.

*Por qué:* el repositorio permite cargar una transacción con `occurredAt` en el pasado —es un campo
del formulario, no la fecha del sistema—. Con acumulación incremental, una transacción retroactiva
deja mal el mes que tocó **y todos los siguientes**, sin que nada lo detecte. Recalcular es idempotente
por definición.

### 2.3 El relleno es un `upsert` y cubre sólo meses **cerrados**

El mes en curso **no** se persiste: el dashboard ya lo calcula en vivo (`page.tsx:136-148`) y una fila
del mes actual quedaría vieja con la siguiente transacción del día.

### 2.4 `assetsSnapshot` y `liabilitiesSnapshot` se llenan con el signo del motor

`accounts.balance` guarda los pasivos en **negativo** (`schema.db.ts`: «Negativo para pasivos o
sobregiros»). El resumen guarda exactamente eso, sin invertir nada.

*Por qué no se decide acá la convención de presentación:* el §9 del RFC 024 la deja abierta para la
propuesta de estadísticas, **nadie lee estas dos columnas hoy**, y el seed las llenaba al revés que el
motor —que es justo la contradicción que este plan viene a borrar—. **Guardar lo que el motor dice y
decidir la presentación cuando exista la pantalla** no adelanta ninguna decisión.

### 2.5 La suma cruza divisas, igual que hoy, y eso va a deuda

`calcularBalanceTotal` suma todas las cuentas `asset` **sin mirar `currency`**: una cuenta en USD se
suma a una en ARS como si fueran la misma unidad. **La derivación repite ese criterio a propósito**,
porque el objetivo del plan es que el histórico y el punto vivo midan lo mismo. Arreglarlo es una
decisión de producto —¿se convierte, se muestra una serie por divisa, se elige una principal?— y va
como deuda en el paso 7.

### Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Un cron, o portar QStash | La infraestructura de `FinanceApp-WSL` no está portada y este arreglo no la necesita: el relleno corre cuando se lee el dashboard |
| Acumulación incremental, o escribir el resumen dentro de `createLedgerTransaction` | Ver §2.2. Una transacción retroactiva rompe la cadena en silencio, y acoplaría el alta de una transacción a una tabla de reportes |
| Tocar `calcularSparklineBalance`, `calcularSparklineIngresos`, `calcularSparklineGastos` o `calcularSparklineAhorro` | Con la definición nueva quedan coherentes solas. Ver §1 |
| Tocar `getMonthlySummariesAction` o `getEarliestMonthKeyAction` | Leen bien. Lo que fallaba era que no había filas |
| Invertir el signo de los pasivos, o tocar el §9 del RFC 024 | Ver §2.4. El RFC está `APPROVED` y no se edita |
| Borrar `monthlySummaryRepository.create()` | Lo usa el seed. El `upsert` se agrega al lado |
| Arreglar la suma multi-divisa | Ver §2.5. Es deuda declarada, no parte de esto |

---

## 3. Paso 1 — El servicio de derivación

Archivo nuevo: `src/features/accounting/services/monthlySummaryService.ts`.

```ts
/**
 * Deriva el resumen de un mes cerrado a partir del libro mayor.
 *
 * No lee `accounts.balance`: ese es el saldo de hoy. Reconstruye el cierre del mes sumando los
 * asientos cuya transacción ocurrió hasta el último instante de ese mes.
 */
export async function derivarResumenDeMes(
  organizationId: string ,
  year:           number ,
  month:          number ,   // 0-indexed, igual que Date.getMonth() y que la columna
  tx:             DBOrTx = db
): Promise< InsertMonthlySummary >
```

**Lo que calcula, columna por columna:**

| Columna | Cómo |
| :--- | :--- |
| `totalRevenue` | `Σ credit` de los asientos del **mes**, sobre cuentas `type === "revenue"` |
| `totalExpense` | `Σ debit` de los asientos del **mes**, sobre cuentas `type === "expense"` |
| `balanceSnapshot` | `Σ(debit − credit)` **acumulado hasta el cierre**, sobre cuentas `type === "asset"` |
| `assetsSnapshot` | Idéntico a `balanceSnapshot`. Se duplica a propósito: hoy son lo mismo y el día que `balanceSnapshot` cambie de definición, la columna de activos ya existe |
| `liabilitiesSnapshot` | `Σ(debit − credit)` acumulado hasta el cierre, sobre cuentas `type === "liability"`. **Queda negativo**, como el motor (§2.4) |

**Los dos criterios que no se pueden confundir, y son la fuente de todo error en esta clase de código:**

*   **`totalRevenue` y `totalExpense` son del mes**: `occurredAt >= primer instante` y `<= último`.
*   **Los tres `*Snapshot` son acumulados**: `occurredAt <= último instante del mes`, sin piso.

**El último instante se calcula así, y no de otra forma:** `new Date( year , month + 1 , 0 , 23 , 59 , 59 , 999 )`.
Es el molde que el propio seed ya usa en `:457`. `month + 1` con día `0` da el último día del mes sin
tabla de días ni bisiestos.

**Aislamiento:** toda consulta filtra por `organizationId` — regla dura del §8.3.

Y la función de relleno, en el mismo archivo:

```ts
/**
 * Rellena los resúmenes de todos los meses cerrados que falten, desde el primer asiento
 * de la organización hasta el mes anterior al actual.
 */
export async function rellenarResumenesFaltantes(
  organizationId: string ,
  referenceDate:  Date = new Date()
): Promise< Result< number , string > >
```

*   Busca el `occurredAt` más antiguo de la organización. **Si no hay transacciones, devuelve `ok(0)`
    sin escribir nada** — una organización nueva no tiene historia que resumir.
*   Recorre de ese mes hasta el **anterior** al de `referenceDate`, excluido el mes en curso (§2.3).
*   Para cada mes sin fila, deriva y hace `upsert`.
*   Devuelve cuántos escribió. **El tipo es `Result`**, como todo el repositorio (`shared/lib/result.ts`).

---

## 4. Paso 2 — El `upsert` del repositorio

En `monthlySummaryRepository`, al lado de `create` (`:26`):

```ts
  async upsert( data: InsertMonthlySummary , tx: DBOrTx = db ): Promise< MonthlySummary > {
```

Con `onConflictDoUpdate` sobre el índice que ya existe:
`uniqueIndex( "monthly_summaries_org_year_month_unique" ).on( organizationId , year , month )`.

Actualiza las cinco columnas monetarias y **no** toca `createdAt`. **No hay migración**: el índice ya
está en la base.

---

## 5. Paso 3 — La acción y el disparo

En `accountingActions.ts`, siguiendo el molde de las que ya están (sesión → `organizationId` →
`try/catch` → `Result`, `:558-591`):

```ts
export async function rellenarResumenesMensualesAction(): Promise< Result< number , string > >
```

En `page.tsx`, **antes** de leer los resúmenes:

```ts
  await rellenarResumenesMensualesAction() ;
```

**Su fallo no puede romper el dashboard.** La acción ya devuelve `Result`, así que basta con no
consultarlo: si el relleno falla, el `logger.error` queda y la página sigue con lo que haya. Un
dashboard en blanco por un resumen que no se pudo escribir es peor que un dashboard sin tendencia.

---

## 6. Paso 4 — El seed deja de inventar

Reemplazar el bloque `seed.ts:428-459` —el `for` con los dos `Math.random()` y el `insert`
directo— por una llamada a `rellenarResumenesFaltantes( org.id )`, **después** de sembrar todas las
transacciones históricas y las del mes en curso.

**Lo que se borra con él:** `saldoAcumulado`, `pasivosMes`, `activosMes` y el comentario «Invariante
contable: Activos = Patrimonio Neto + Pasivos», que describía la convención vieja.

**Cuidado con el orden:** hoy el bloque de resúmenes corre **antes** del ajuste de saldos de `:466` y
de las transacciones diarias de `:477`. Derivar del libro exige que el libro esté completo, así que la
llamada va **al final**, después de ambas. Si se deja donde está, los resúmenes salen incompletos y
los tests del paso 6 no lo detectan, porque no usan el seed.

---

## 7. Paso 5 — Los tests

Archivo nuevo, `monthlySummaryService.test.ts`, con Postgres vivo, siguiendo el molde de
`accountingService.test.ts` (`limpiarBase()` en `beforeEach`, organización de prueba, asientos por
`createLedgerTransaction`).

| Caso | Qué afirma |
| :--- | :--- |
| `deriva ingresos y gastos del mes, y no de otro` | Dos transacciones en meses distintos: cada resumen ve sólo la suya |
| `el saldo es acumulado, no del mes` | Un mes con ingreso y el siguiente sin movimientos: el `balanceSnapshot` del segundo **conserva** el saldo del primero, y sus `totalRevenue`/`totalExpense` son 0 |
| `el último día del mes entra` | Una transacción a las 23:59 del último día cae **dentro** de ese mes, no del siguiente. Cubre el `23 , 59 , 59 , 999` |
| `una transacción retroactiva cambia el mes que toca` | Relleno, alta con `occurredAt` viejo, relleno de nuevo: la fila se **actualiza**. Es la prueba de que recalcula y no acumula (§2.2) |
| `un contra-asiento revierte el resumen` | `reverseLedgerTransaction` sobre una transacción de un mes cerrado, y el resumen recalculado vuelve al valor previo |
| `los pasivos quedan negativos` | Con una cuenta `liability`, `liabilitiesSnapshot` es negativo — la convención del motor (§2.4) |
| `no escribe el mes en curso` | Tras el relleno no existe fila para el mes de `referenceDate` |
| `es idempotente` | Dos rellenos seguidos: la cantidad de filas no cambia y los valores tampoco |
| `organización sin transacciones` | Devuelve `ok(0)` y no escribe ninguna fila |
| `aislamiento multi-tenant` | Las transacciones de otra organización no entran en el resumen |

> **El molde de aserción sobre dinero es el entero en centavos**, nunca el formateado: `expect( r.totalRevenue ).toBe( 150000 )`.

---

## 8. Paso 6 — Los documentos

1.  **`docs/TECHNICAL_DEBT.md`, viñeta nueva** en §2 (Persistencia y Modelado):

    > `[ ] **La liquidez suma divisas distintas como si fueran la misma unidad:** `calcularBalanceTotal`
    > (`dashboardMetrics.ts:40`) suma todas las cuentas `asset` sin mirar `currency`, y
    > `derivarResumenDeMes` repite ese criterio a propósito para que el histórico y el punto vivo del
    > gráfico midan lo mismo. Una cuenta en USD se suma a una en ARS. Cerrarlo es una decisión de
    > producto: convertir a una divisa principal, mostrar una serie por divisa, o elegir una. Detectado
    > el 2026-09-21.*

2.  **`docs/trabajo-en-vuelo.md`:** rama y próximo paso, **en el mismo commit** que el código. Anotar
    que el §9 del RFC 024 **queda parcialmente cerrado**: `balanceSnapshot` ya tiene definición
    (liquidez), y sigue abierta la convención de presentación de los pasivos.

> **El RFC 024 no se toca.** Es texto `APPROVED`: la discrepancia se advierte en el doc de estado.

---

## 9. Verificación literal

**Entorno primero.** Sin `postgres-dev` la suite muere en el setup: eso es entorno caído, no suite rota.

```bash
podman ps --filter name=postgres-dev --format "{{.Names}} {{.Status}}"
```

### La batería, los cuatro, en este orden

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

```bash
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
```

### El archivo nuevo, por separado

```bash
pnpm exec vitest run src/features/accounting/services/monthlySummaryService.test.ts
```

Hoy la suite son **490 tests en 68 archivos**. Con los diez casos nuevos deberían quedar **500 en 69**
—el archivo nuevo cuenta también—. **Pegar el número que imprime vitest, no el que dice este plan.**

### Que el seed dejó de inventar

```bash
grep -n "Math.random" src/shared/db/seed.ts
```

Las dos líneas del bloque de resúmenes (`:437`, `:438`) tienen que desaparecer. **El `grep` puede
devolver otras coincidencias legítimas de `Math.random` en el seed**: lo que se comprueba es que no
quede ninguna dentro del bloque de resúmenes mensuales, no que la salida sea vacía.

### Que los resúmenes ahora cuadran con el libro

Con la base sembrada (`pnpm db:seed`), los ingresos del último mes cerrado según el resumen y según
los asientos tienen que dar **el mismo número**:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "
  SELECT year , month , total_revenue , total_expense , balance_snapshot
  FROM monthly_summaries ORDER BY year DESC , month DESC LIMIT 3 ;"
```

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "
  SELECT SUM(e.credit) FROM ledger_entries e
  JOIN ledger_transactions t ON t.id = e.transaction_id
  JOIN accounts a ON a.id = e.account_id
  WHERE a.type = 'revenue'
    AND date_trunc('month', t.occurred_at) = date_trunc('month', now() - interval '1 month') ;"
```

**Los dos números tienen que coincidir.** Es la prueba de que la derivación sale del libro y no de un
generador aleatorio, y es la única verificación de este plan que no se puede hacer con un test.

---

## 10. Criterio de terminado

*   Los cuatro comandos de la batería en verde, con sus números exactos pegados.
*   Los diez casos nuevos verdes; ningún test existente tocado.
*   `Math.random()` fuera del bloque de resúmenes del seed.
*   Las dos consultas SQL devuelven el mismo importe.
*   `TECHNICAL_DEBT.md` con la viñeta de la suma multi-divisa.
*   `trabajo-en-vuelo.md` actualizado **en el mismo commit**.
