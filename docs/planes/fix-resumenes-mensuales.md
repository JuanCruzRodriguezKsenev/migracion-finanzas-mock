# Plan — Que los resúmenes mensuales salgan del libro y no de `Math.random()`

**Rama:** `fix/resumenes-mensuales` · **Escrito:** 2026-09-21 · **§6 reescrito:** 2026-09-21 · **Abre deuda nueva:** sí (paso 6)

> **Los pasos 1, 2 y 3 ya están hechos** (`b09eb96`): el servicio, el `upsert` y el disparo desde el
> dashboard. **Lo que queda es del §6 en adelante.** El §6 se reescribió entero porque la versión
> anterior descansaba sobre una premisa falsa —que el seed tenía historia— y ahí fue donde la
> ejecución se detuvo. El estado vive en [`trabajo-en-vuelo.md`](../trabajo-en-vuelo.md), no acá.

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
| `src/shared/db/seed.ts` | **Cuatro correcciones, §6:** arreglar la limpieza (hoy el seed **no corre**), fechar por `occurredAt`, generar doce meses de historia real y derivar los resúmenes |
| `src/features/accounting/services/monthlySummaryService.test.ts` | **Nuevo.** Los casos del paso 5 (§7) |
| `docs/TECHNICAL_DEBT.md` | Una viñeta nueva (paso 6, §8), que **no** es esta corrección |
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
como deuda en el paso 6 (§8).

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
| Tocar el `const { db } = await import( "./client" )` de `seed.ts:37` | Herencia. `client.ts` carga su propio `dotenv` en su `:15` y `accountingService` ya lo arrastra estáticamente desde `seed.ts:17`. Cambiarlo no es de esta tanda |
| Sembrar préstamos, contactos o planes de cuotas | La limpieza del §6.1 los borra y **no los repone**. Un seed restablece el estado de demo; inventar datos de préstamos no está pedido |
| Fijar `diferenciaAjuste` en una constante | Ver §6.4. Era la suma de los `Math.random()`: sin la ficción no tiene referente, y una constante es inventar de nuevo con otra cara |

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

## 6. Paso 4 — El seed: cuatro correcciones, en este orden

> **Esta sección se reescribió el 2026-09-21, después de que la ejecución se detuviera acá.** La
> versión anterior decía «llamar a la derivación después de sembrar todas las transacciones
> históricas». **Era una premisa falsa: no hay transacciones históricas.** El seed siembra el aporte
> inicial (`:411-427`) y después el bucle de `:479` cubre **sólo el mes en curso**; los once meses previos
> eran exclusivamente los `Math.random()` de `:437-443`. Derivar del libro sobre eso deja once meses
> en cero, que es justo el síntoma que abrió esta ronda.
>
> **Decisión del usuario (2026-09-21):** el seed genera **doce meses de historia real**, con el
> generador diario que ya existe. Es el mejor demo y a la vez el menor código: el cuerpo del bucle no
> se toca, se cambia su envoltorio.

Las cuatro correcciones son independientes entre sí pero el orden importa: sin la 6.1 el seed no
corre, y sin la 6.2 la derivación no ve nada.

### 6.1 — La limpieza, primero, porque hoy el seed está roto

`pnpm db:seed` **falla hoy**, antes de llegar a cualquier cosa de este plan. Salida real del
2026-09-21:

```
code: '23503',
detail: 'Key (id)=(e0634e1b-30ed-4f95-925a-b818c49a04b5) is still referenced from table "loan_accounts".'
constraint_name: 'loan_accounts_account_id_accounts_id_fk'
```

La limpieza de `:43-53` quedó atrás de las features que se agregaron después. **Las seis tablas que
faltan, verificadas contra las claves foráneas de la base real** (`information_schema`), no supuestas:

| Tabla | Referencia a | Tiene que borrarse antes de |
| :--- | :--- | :--- |
| `cardInstallmentPlans` | `cards`, `categories`, `organizations` | `cards` y `categories` |
| `contactPaymentMethods` | `contacts`, `financial_entities` | `contacts` y `financialEntities` |
| `loanAccounts` | `accounts`, `loans` | `accounts` y `loans` |
| `loans` | `contacts`, `financial_entities`, `organizations` | `contacts` y `financialEntities` |
| `contacts` | `organizations` | — |
| `outboxEvents` | `organizations` | — (no bloquea, pero **nunca se borró**: 195 filas acumuladas, y una por transacción de acá en más) |

La lista completa queda así, y este orden es el que satisface todas las dependencias de arriba:

```ts
    await db.delete( cardInstallmentPlans  ) ;
    await db.delete( categoryAccounts      ) ;
    await db.delete( cardAccounts          ) ;
    await db.delete( cards                 ) ;
    await db.delete( subscriptions         ) ;
    await db.delete( contactPaymentMethods ) ;
    await db.delete( loanAccounts          ) ;
    await db.delete( loans                 ) ;
    await db.delete( contacts              ) ;
    await db.delete( ledgerEntries         ) ;
    await db.delete( ledgerTransactions    ) ;
    await db.delete( outboxEvents          ) ;
    await db.delete( monthlySummaries      ) ;
    await db.delete( accounts              ) ;
    await db.delete( financialEntities     ) ;
    await db.delete( categories            ) ;
    await db.delete( profiles              ) ;
```

**Los imports que hay que agregar**, respetando la alineación por columnas del §4:

*   `cardInstallmentPlans` — a la línea que ya trae `cards , cardAccounts` (`:21`).
*   `outboxEvents` — a la línea que ya trae `categories , accounts , …` (`:15`).
*   `contacts , contactPaymentMethods` de `@/features/contacts/schema.db` — **bloque nuevo**.
*   `loans , loanAccounts` de `@/features/loans/schema.db` — **bloque nuevo**.

> **`idempotencyKeys` y `loginAttempts` no se tocan.** Ninguna tiene clave foránea contra lo que el
> seed borra, y no son datos de demo.

> **El seed pasa a borrar préstamos y contactos.** Es lo correcto —un seed restablece el estado de
> demo— y no los vuelve a sembrar. No inventar datos de préstamos para compensar: no está pedido.

### 6.2 — `registrarTransaccion` fecha por `occurredAt`, no por `createdAt`

**Esto es un defecto propio, más viejo que este plan, y explica algo que no se había mirado:**
`createLedgerTransaction` **ya acepta `occurredAt`** (`accountingService.ts:34` lo desestructura,
`:55` lo escribe; el tipo lo declara en `types.ts:51`). El helper del seed nunca se lo pasó: sólo
retoca `createdAt` con dos `UPDATE` posteriores (`:397-406`).

Y **todo el repo filtra y ordena por `occurredAt`**, no por `createdAt`: `ledgerRepository.ts:240`,
`:250`, `:306`, `:320`, `:384`. `ledgerTransactions.createdAt` **no lo lee nadie** — el único
consumidor es el *fallback* `tx.occurredAt || tx.createdAt` de `dashboardMetrics.ts:60,82`, que con
`occurredAt` siempre presente nunca se usa. Verificado contra la base viva:

```
 txs |       min_occ        |        max_occ         |     min_created      |      max_created
  26 | 2026-09-10 04:38:35  | 2026-09-12 12:00:00    | 2025-10-01 11:00:00  | 2026-09-12 04:25:39
```

Doce meses de fechas en `created_at` y **todos los `occurred_at` apilados en el instante del seed**.
`/transactions` viene mostrando el historial sembrado con fecha de hoy.

El helper queda así, y **los dos `UPDATE` se borran enteros**:

```ts
    // Helper para registrar una transacción contable con su fecha de ocurrencia
    async function registrarTransaccion( params: Parameters< typeof createLedgerTransaction >[0] , fecha: Date ) {
      const result = await createLedgerTransaction( { ...params , occurredAt: fecha } ) ;
      if( !result.success ) {
        throw( new Error( `Error al registrar transacción contable: ${result.error}` ) ) ;
      }

      return( result.value ) ;
    }
```

> **Al borrar los dos `UPDATE`, el import de `eq` queda huérfano** — era su único uso en el archivo
> (`:401` y `:406`, comprobado con `grep -n "eq(" src/shared/db/seed.ts`). Hay que **quitar
> `import { eq } from "drizzle-orm"`** o `pnpm exec eslint . --max-warnings 0` sale en rojo. Los
> imports de `ledgerTransactions` y `ledgerEntries` **se quedan**: los sigue usando la limpieza.

### 6.3 — Doce meses de historia, con el generador que ya existe

El bucle de `:479` se envuelve en un bucle de meses. **El cuerpo no se toca**: las cuatro secciones de
movimientos fijos, los gastos cotidianos y los del fin de semana quedan igual, salvo los guardas que
se indican abajo.

```ts
    // Sembrando transacciones diarias de los últimos doce meses: los cerrados completos,
    // el mes en curso sólo hasta hoy.
    console.log( "Sembrando transacciones diarias de los últimos doce meses..." ) ;

    for( let m = 11 ; m >= 0 ; m-- ) {
      const primerDiaMes  = new Date( ahora.getFullYear() , ahora.getMonth() - m , 1 ) ;
      const anio          = primerDiaMes.getFullYear() ;
      const mes           = primerDiaMes.getMonth() ;
      const ultimoDiaMes  = new Date( anio , mes + 1 , 0 ).getDate() ;
      const diasASembrar  = ( m === 0 ) ? ahora.getDate() : ultimoDiaMes ;

      for( let diaDelMes = 1 ; diaDelMes <= diasASembrar ; diaDelMes++ ) {
        const fechaDia      = new Date( anio , mes , diaDelMes ) ;
        const diaDeLaSemana = fechaDia.getDay() ;

        // ... el cuerpo actual, sin cambios ...
      }
    }
```

**Tres detalles que no se pueden pasar por alto:**

1.  **Los guardas `&& ( diaDelMes <= diasMesActual )` de `:503`, `:517` y `:533` se borran.** Con el
    bucle nuevo, `diaDelMes` nunca excede `diasASembrar`, así que el guarda es redundante — y si se
    deja con la variable vieja `diasMesActual`, deja de compilar. La condición que queda es la del día
    a secas: `if( diaDelMes === 10 )`.
2.  **`const diasMesActual = ahora.getDate()` de `:477` se borra**, y con él el off-by-one que había:
    el bucle viejo arrancaba en `d = diasMesActual`, o sea `new Date( y , m , 0 )`, que es **el último
    día del mes anterior**. Le filtraba una o dos compras al mes que no correspondía.
3.  **`const diaDelMes = fechaDia.getDate()` de `:482` desaparece**: ahora `diaDelMes` es la variable
    del bucle. No dejar las dos.

> **El aporte inicial (`:411-427`) no se mueve:** queda en el día 1 a las 08:00 del mes `-11`, que es
> el mismo mes en que arranca la historia diaria. El orden intramensual no importa —`accounts.balance`
> acumula sin mirar la hora y la derivación filtra por `occurredAt <= fin de mes`—, y el saldo inicial
> del banco ($200.000) cubre de sobra los gastos de los primeros cuatro días, antes del primer sueldo.

**Lo que esto cuesta, para que nadie se asuste con el reloj:** el generador produce ~48 transacciones
por mes, así que el seed pasa de ~50 a **~580 transacciones**, cada una con su bloqueo `FOR UPDATE` y
su fila en `outbox_events`. Estimado: entre 15 y 30 segundos. **Medirlo con `time pnpm db:seed` y
pegar el número** (§9); si se va por encima del minuto, decirlo en el informe en vez de seguir.

**No hay riesgo de saldos negativos**, y está comprobado, no supuesto: el sueldo es de $320.000 a
$380.000 mensuales contra ~$291.000 de gastos (alquiler $85.000, servicios $22.000-28.000, cotidianos
~$99.000, fines de semana ~$82.000). El neto mensual es positivo. Y de todos modos
`createLedgerTransaction` **no valida saldo suficiente** — sólo Debe = Haber por divisa y pertenencia
al inquilino.

### 6.4 — La derivación reemplaza a los `Math.random()`

Se borra el bloque `:428-459` entero: el `for( let m = 11 ; m >= 1 ; m-- )`, los dos `Math.random()`,
el `insert` directo en `monthlySummaries`, las variables `saldoAcumulado`, `pasivosMes` y `activosMes`,
y el comentario «Invariante contable: Activos = Patrimonio Neto + Pasivos», que describía la
convención vieja.

**Y se borra también el ajuste de saldos de `:461-473` entero, con su `fechaFinMayo`.** No es una
decisión abierta: `diferenciaAjuste = ( saldoAcumulado - 19000000 )` es **literalmente la suma de los
`Math.random()`**, un contra-peso para que `accounts.balance` cuadrara con once meses inventados. Sin
la ficción no tiene referente, y fijarlo en una constante sería inventar de nuevo con otra cara. Con
6.3 los saldos salen de transacciones reales y no hay nada que ajustar.

En su lugar, **al final de todo el sembrado de transacciones** —después del `console.log` de `:592`,
que es lo que cierra el bucle diario—:

```ts
    console.log( "Derivando resúmenes mensuales cerrados a partir del libro..." ) ;
    const resumenes = await rellenarResumenesFaltantes( org.id ) ;
    if( !resumenes.success ) {
      throw( new Error( `Error al derivar los resúmenes mensuales: ${resumenes.error}` ) ) ;
    }
    console.log( `Resúmenes mensuales derivados: ${resumenes.value}` ) ;
```

**El import es estático, como el de `createLedgerTransaction`**, y no hace falta `await import()`:
`@/shared/db/client` carga su propio `dotenv.config()` en su línea 15, y además `accountingService` ya
lo arrastra estáticamente desde `:17`. El `const { db } = await import( "./client" )` de `:37` es
herencia y **no se toca en esta tanda**.

```ts
import { rellenarResumenesFaltantes } from "@/features/accounting/services/monthlySummaryService" ;
```

**El orden es obligatorio:** derivar antes de que el libro esté completo da resúmenes incompletos, y
los tests del paso 5 **no lo detectan** porque no usan el seed.

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
    dos cosas y nada más:

    *   El §9 del RFC 024 **queda parcialmente cerrado**: `balanceSnapshot` ya tiene definición
        (liquidez), y sigue abierta la convención de presentación de los pasivos.
    *   **El seed nunca escribió `occurredAt`** (§6.2), así que hasta esta tanda `/transactions`
        mostró todo el historial sembrado con fecha del día en que se corrió el seed. Se arregló acá;
        queda anotado porque explica cualquier captura o recuerdo anterior que no cierre.

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

### Que el seed corre, y cuánto tarda

Hoy **falla** con `23503 … still referenced from table "loan_accounts"`. Después del §6.1 tiene que
terminar en verde, y hay que **pegar el tiempo**:

```bash
time pnpm db:seed
```

Estimado: 15-30 s con las ~580 transacciones del §6.3. **Si se pasa del minuto, decirlo en el
informe** en vez de seguir como si nada.

### Que el seed dejó de inventar resúmenes

```bash
grep -n "Math.random" src/shared/db/seed.ts
```

Las dos líneas del bloque de resúmenes (`:437`, `:438`) tienen que desaparecer. **El `grep` va a
seguir devolviendo coincidencias legítimas**: los montos variables de sueldo, servicios, pago de
tarjeta y gastos cotidianos del generador diario. Lo que se comprueba es que no quede ninguna dentro
del bloque de resúmenes mensuales, no que la salida sea vacía.

```bash
grep -n "saldoAcumulado\|diferenciaAjuste\|diasMesActual\|pasivosMes\|activosMes" src/shared/db/seed.ts
```

**Salida vacía.** Las cinco variables se van con el §6.3 y el §6.4.

### Que las transacciones quedaron fechadas de verdad

El defecto del §6.2, que es el que hacía invisible toda la historia:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "
  SELECT count(*) AS txs ,
         min(occurred_at)::date AS desde ,
         max(occurred_at)::date AS hasta ,
         count(DISTINCT date_trunc('month', occurred_at)) AS meses
  FROM ledger_transactions ;"
```

`meses` tiene que dar **12** y `desde` caer doce meses atrás. Antes de esta tanda daba **1**, con todo
apilado en el instante del seed. El conteo de `txs` es el que hay que pegar en el informe.

### Que los resúmenes ahora cuadran con el libro

Con la base sembrada (`pnpm db:seed`), los ingresos del último mes cerrado según el resumen y según
los asientos tienen que dar **el mismo número**, y **ninguno de los dos puede ser cero**:

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
*   `pnpm db:seed` termina en verde —hoy falla— y su tiempo está pegado en el informe.
*   `saldoAcumulado`, `diferenciaAjuste`, `diasMesActual`, `pasivosMes` y `activosMes` no existen más.
*   `ledger_transactions` reparte su `occurred_at` en **12 meses distintos**, no en uno.
*   Las dos consultas SQL devuelven el mismo importe, y no es cero.
*   `TECHNICAL_DEBT.md` con la viñeta de la suma multi-divisa.
*   `trabajo-en-vuelo.md` actualizado **en el mismo commit**.
