# Plan — RFC 008, tanda 1: el modelo de préstamos y sus asientos

* **RFC habilitante:** [`008-loans-and-installments.md`](../proposals/008-loans-and-installments.md),
  `APPROVED` el 2026-09-11. **Este plan no se aparta de su §4:** el esquema se copia literal.
* **Rama:** `feat/rfc-008-loans`, **ya creada** por `tanda` sobre `master` consolidado. No cambiar de
  rama.
* **Punto de partida:** `master` con el RFC 025 cerrado. **Línea base de la suite: 61 archivos de
  test, 443 tests, 0 ESLint, 0 TS, build verde.**
* **Alcance:** el backend completo de `/loans`. Esquema, migración, repositorio, amortización
  francesa, cronograma proyectado, y las dos acciones (alta y pago/cobro de cuota) con sus tests.
* **Lo que NO entra en esta tanda:** ninguna pantalla, ningún componente, ninguna clave de
  diccionario, ninguna entrada de `Navbar`. Todo eso es la tanda 2, que todavía no está escrita.
  **No crear `src/app/[lang]/(main)/loans/`.**

---

## 1. Las dos decisiones que ya están cerradas

No se reabren y no hay que consultarlas.

### 1.1 La categoría de intereses sale fija por código

El §5D necesita una cuenta de gasto para el interés y el §5E una de ingreso, pero **el esquema
aprobado de `loans` no tiene ninguna columna de categoría**, y este plan no se la agrega. Decidido
por el usuario el 2026-09-11:

| `direction` | Categoría | Código | Cómo se obtiene |
| :--- | :--- | :--- | :--- |
| `borrowed` | Intereses (gasto) | `5.1.11.02` | Hoja **ya existente** en el catálogo inicial |
| `lent` | Intereses y rendimientos (ingreso) | `4.1.04` | Es **padre**: `resolveToLeaf()` devuelve su hoja `General` |

**Por qué el de ingresos cae en `General`:** `4.1.04` tiene dos hojas en el catálogo —*Plazo fijo* y
*Cuenta remunerada* ([`initialCatalog.ts:211-219`](../../src/features/accounting/constants/initialCatalog.ts))—
y **ninguna sirve** para el interés de un préstamo otorgado. Pasar el padre a `resolveToLeaf()` es
exactamente el comportamiento que el RFC 022 definió para ese caso.

**El respaldo, que hay que implementar:** si la organización no tiene la categoría del código
buscado, se cae a `categoryRepository.findOrCreateTypeGeneralLeaf( type , organizationId , tx )`
([`categoryRepository.ts:166`](../../src/features/accounting/repositories/categoryRepository.ts)).
**No lanzar ni abortar el asiento por una categoría faltante:** el catálogo inicial sólo lo aplica
`src/shared/db/seed.ts`, así que una organización creada por fuera del seed puede no tenerlo.

**No inventar cuentas `5.1.01.NN` a mano.** La categoría *es* la cuenta de resultado (RFC 022), y la
cuenta por divisa la resuelve `findOrCreateAccountForCurrency()`.

### 1.2 Lo que decide la tanda 2, anotado acá para que no se pierda

El §9 del RFC delegaba al plan **dónde entra `/loans` en la navegación**. Resuelto: sección
**«Finanzas»** del `Navbar`, **inmediatamente después de `/cards`**, para que los tres instrumentos
—`accounts`, `cards`, `loans`— queden juntos antes de suscripciones y contactos. Con **`dict.loans`
en los tres diccionarios**, no en español directo como el `<span>Tarjetas</span>` de
[`Navbar.tsx:123`](../../src/shared/ui/layout/Navbar/Navbar.tsx), que es deuda abierta (§8).
**Esto no se toca en esta tanda.**

---

## 2. Lo que ya existe y NO hay que construir

Verificado archivo por archivo el 2026-09-11. **Reusar, no reescribir, y no generalizar firmas.**

| Ya existe | Dónde | Qué hace hoy, exactamente |
| :--- | :--- | :--- |
| `ocurrenciaN()` | [`recurrenceService.ts:81`](../../src/features/subscriptions/services/recurrenceService.ts) | `( startDate: Date \| string , frequency: SubscriptionFrequency , intervalCount: number , n: number ) => string` civil `YYYY-MM-DD`. **Genérica: recibe primitivas.** `n = 0` devuelve la fecha ancla recortada al mes. **Se usa tal cual** |
| `calcularPunteroInicial()` | [`recurrenceService.ts:206`](../../src/features/subscriptions/services/recurrenceService.ts) | Si ninguna ocurrencia abrió ventana, devuelve el puntero **un intervalo antes** del inicio de la serie. Es lo que hace funcionar el período de gracia. **Se usa tal cual** |
| `deudaDe()` | [`ciclo.ts:23`](../../src/features/cards/utils/ciclo.ts) | `( cuenta: { balance: number } ) => number`, devuelve `-balance` (y `0` si es `0`). **Sólo en la rama `borrowed`** |
| `getNextCode()` | [`accountCodes.ts:16`](../../src/features/accounting/utils/accountCodes.ts) | `( type , existingAccounts ) => string`. Prefijos `1.1.01.` para `asset` y `2.1.01.` para `liability`, correlativo de dos dígitos |
| `resolveToLeaf()` | [`categoryRepository.ts:208`](../../src/features/accounting/repositories/categoryRepository.ts) | `( categoryId , type , organizationId , tx )`. Si la categoría tiene hijas reales devuelve su hoja `General`; si no existe cae a la hoja `General` del tipo |
| `findOrCreateAccountForCurrency()` | [`categoryRepository.ts:240`](../../src/features/accounting/repositories/categoryRepository.ts) | `( categoryId , currency , tx )`. Busca el vínculo en `category_accounts` y si falta crea la cuenta `<accountCode>-<MONEDA>` y el vínculo |
| `findOrCreateTypeGeneralLeaf()` | [`categoryRepository.ts:166`](../../src/features/accounting/repositories/categoryRepository.ts) | Hoja `General` del tipo. Es el respaldo del §1.1 |
| `createLedgerTransaction()` | [`accountingService.ts`](../../src/features/accounting/services/accountingService.ts) | `( { organizationId , categoryId , description , occurredAt , entries } , tx )`. **Cada `entry` lleva su `currency`**, valida Debe = Haber **por divisa** dentro de la transacción, y **acepta N patas**: las tres de §5D entran sin cambios. Devuelve `Result` |
| Molde de acción con puntero + asiento ACID | [`resolveSubscriptionAction.ts:136-245`](../../src/features/subscriptions/actions/resolveSubscriptionAction.ts) | **Es el molde literal de la acción de pago.** Ver §5 de este plan |
| Molde de alta instrumento + cuenta + asiento | [`cardsActions.ts:104-200`](../../src/features/cards/actions/cardsActions.ts) | **Es el molde literal de la acción de alta.** Incluye la resolución de Patrimonio Neto de §5C y el manejo de `23505`/`23503` |
| Bloqueo de fila | [`subscriptionRepository.ts:68`](../../src/features/subscriptions/repositories/subscriptionRepository.ts) | `.for( "update" )` al final del `select`, con `and( eq(id) , eq(organizationId) )`. Copiar el idioma |
| `Result` , `ok()` , `fail()` | [`result.ts`](../../src/shared/lib/result.ts) | El acierto viaja en `.value`. Toda acción devuelve `Result` |

**`pendientesDe()` NO se reusa** ([`recurrenceService.ts:153`](../../src/features/subscriptions/services/recurrenceService.ts)):
está tipada contra `Subscription` concreto y su primera línea es `if( suscripcion.status !== "active" )`,
columna que `loans` no tiene. **Se escribe el equivalente en la feature nueva y no se toca
`subscriptions`,** que está cerrada y verde. Sí se copian sus dos topes: `MAX_PENDIENTES = 24` y
`MAX_BUSQUEDA = 2000`.

**No existe ninguna amortización en el repo.** `grep -rni 'amortiz\|frances' src/` no devuelve nada:
el paso 5 escribe la primera.

---

## 3. Pasos

Anclas textuales, no números de línea: el número envejece dentro de la misma ronda.

### Paso 1 — `src/features/loans/schema.db.ts`

Copiar **literal** el bloque del §4 del RFC: `loans` y `loanAccounts`. Sin agregar ni quitar
columnas, y con el estilo de alineación por columnas de
[`cards/schema.db.ts`](../../src/features/cards/schema.db.ts).

Los imports que necesita, con su origen exacto:

* `pgTable , uuid , varchar , integer , bigint , timestamp , date , index , uniqueIndex` de `drizzle-orm/pg-core`
* `accounts , financialEntities` de `@/features/accounting/schema.db`
* `contacts` de `@/features/contacts/schema.db`
* `organizations` de `@/features/auth/schema.db`

**Los tipos no son negociables y son los que la compuerta mira:** `principal_amount` es `bigint`
(centavos); `interest_rate_annual`, `total_installments` e `interval_count` son `integer` **porque no
son dinero**; `first_installment_date` y `resolved_through` son `date` civil; todo `timestamp` lleva
`{withTimezone: true}`.

### Paso 2 — exportar el esquema en el barrel

En [`src/shared/db/schema.ts`](../../src/shared/db/schema.ts) agregar
`export * from "@/features/loans/schema.db" ;`. **Va inmediatamente después de la línea de `cards`**:
el archivo ordena los exports por largo de nombre descendente y `loans` empata con `cards`.

Sin este paso `pnpm db:generate` no ve las tablas y `limpiarBase()` no las puede importar.

### Paso 3 — migración

```bash
pnpm db:generate     # debería emitir drizzle/migrations/0028_*.sql
pnpm db:migrate
```

**Contrastar contra la base real, no contra el snapshot:**

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d loans"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d loan_accounts"
```

`principal_amount` debe figurar como `bigint`; `interest_rate_annual`, `total_installments` e
`interval_count` como `integer`. **Pegar las dos salidas en el informe.**

### Paso 4 — `limpiarBase()`: dos tablas y una renumeración

En [`src/shared/db/testCleanup.ts`](../../src/shared/db/testCleanup.ts):

1. Agregar `loans , loanAccounts` al `import { ... } from "./schema"`.
2. Insertar los dos borrados **inmediatamente después del bloque de `cards`** (el que hoy es
   `// 9. cards`) y **antes** de `contactPaymentMethods`:

```typescript
    // 10. loan_accounts → restrict a accounts; antes que accounts y que loans
    await tx.delete( loanAccounts ) ;

    // 11. loans → restrict a financial_entities y contacts
    await tx.delete( loans ) ;
```

3. **Renumerar los comentarios siguientes.** Los pasos que hoy son `10..19` pasan a `12..21`:
   `contact_payment_methods` 10→12, `contacts` 11→13, `subscriptions` 12→14, `category_accounts`
   13→15, `accounts` 14→16, `financial_entities` 15→17, `categories` 16→18, `profiles` 17→19,
   `users` 18→20, `organizations` 19→21.

> **El §4.2 del RFC tiene los números viejos y no hay que hacerle caso:** dice `card_accounts`=7,
> `contacts`=10, `accounts`=13 y `financial_entities`=14, porque se escribió antes de que la tanda 1
> del RFC 025 insertara `cardInstallmentPlans` y corriera todo uno. **El orden topológico que el RFC
> describe es correcto; sólo los números están corridos.** No editar el RFC: es texto aprobado.

**Por qué importa:** una tabla con FK que falta en `limpiarBase()` rompe suites de **otras** features
de forma intermitente, según el orden en que Vitest elija los archivos.

### Paso 5 — `src/features/loans/services/amortizacion.ts`

Funciones **puras**, sin base de datos, sin `Date` fuera de lo que ya hacen las utilidades civiles.

**Sistema francés:** cuota constante, interés del período sobre el saldo vivo, capital por diferencia.

* Tasa periódica: `interestRateAnnual` viene en **puntos básicos por cien** (85,5 % = `8550`), así que
  la anual decimal es `interestRateAnnual / 10000`. La periódica se obtiene dividiendo por los
  períodos del año según `frequency`: `monthly` 12, `weekly` 52, `quarterly` 4, `yearly` 1. Para
  `custom`, tratar como `monthly` dividido por `intervalCount`.
* `cuotaFrancesa( principal , interestRateAnnual , totalInstallments , frequency , intervalCount ): number`
  devuelve **centavos enteros**.
* `cronogramaFrances( ... ): { n , cuota , interes , capital , saldoRestante }[]` devuelve las
  `totalInstallments` filas, todas en centavos enteros.

**Las tres invariantes que hay que sostener con test, porque son las que se rompen solas:**

1. **`sum( capital ) === principal` exactamente.** Redondear cada cuota deja un resto de centavos:
   **la última cuota absorbe la diferencia**. Sin esto el préstamo nunca llega a saldo cero y la
   cuenta espejo queda con centavos colgados para siempre.
2. **`cuota === capital + interes`** en cada fila.
3. **Con `interestRateAnnual = 0`, `interes === 0` en todas las filas y `cuota === principal / n`**
   con el mismo ajuste del resto en la última. Es el caso de la mayoría de los préstamos entre
   personas, y el que produce el asiento de **dos patas** en vez de tres.

**Nada de punto flotante en el resultado.** Se puede calcular en `number` intermedio, pero cada valor
devuelto es entero: `Math.round()` antes de salir.

### Paso 6 — `src/features/loans/services/loanScheduleService.ts`

El equivalente de `pendientesDe()` para préstamos, **en esta feature**.

* `pendientesDeLoan( loan , hoyCivil: string ): PendienteCuota[]`.
* Proyecta con `ocurrenciaN( loan.firstInstallmentDate , loan.frequency , loan.intervalCount , n )`.
  **El ancla es `firstInstallmentDate`, nunca `startDate`:** `ocurrenciaN()` ancla en el día nominal
  de lo que recibe, así que pasarle la fecha de desembolso corre todas las cuotas al día equivocado
  del mes, en silencio.
* Salta las ocurrencias con `fecha <= loan.resolvedThrough` y **no propone más allá de
  `totalInstallments`**: un préstamo de 12 cuotas nunca ofrece la 13.ª. (Ésta es la diferencia real
  con una suscripción, que es indefinida.)
* Filtra por `archivedAt` nulo. **No hay columna `status`.**
* Topes copiados del original: `MAX_PENDIENTES = 24`, `MAX_BUSQUEDA = 2000`.
* Cada pendiente lleva su número de cuota `n` y su desglose capital/interés tomado de
  `cronogramaFrances()`, para que la acción de pago no recalcule con criterio distinto al de la
  pantalla.

### Paso 7 — `src/features/loans/repositories/loansRepository.ts`

Molde: [`installmentPlansRepository.ts`](../../src/features/cards/repositories/installmentPlansRepository.ts).

**Toda consulta filtra por `organizationId`.** Es regla dura (`.agents/AGENTS.md` §8.3) y el §0 del
RFC señala que la versión de junio la violaba en un ejemplo de código.

Métodos: `findAll( organizationId , tx )` (excluye archivados), `findById( id , organizationId , tx )`,
`findByIdForUpdate( id , organizationId , tx )` con `.for( "update" )`, `create( data , tx )`,
`update( id , organizationId , data , tx )`, `archive( id , organizationId , tx )`,
`addLoanAccount( { loanId , accountId , currency } , tx )` y
`findAccountsByLoanId( loanId , organizationId , tx )`.

Todos con `tx: DBOrTx = db` como último parámetro, para que la acción los llame dentro de su
transacción.

### Paso 8 — `src/features/loans/schemas/loans.schema.ts`

Zod v4, molde [`cards/schemas/cards.schema.ts`](../../src/features/cards/schemas/cards.schema.ts).

**Acá vive la invariante de contraparte**, que el RFC decidió **no** poner como `CHECK` en la base:
`entityId` **XOR** `contactId`, exactamente uno no nulo. Con `.refine()` y mensaje propio. Un alta con
los dos, o con ninguno, se rechaza antes de tocar la base.

También: `direction` en `['borrowed','lent']`, `principalAmount` entero positivo en centavos,
`interestRateAnnual` entero `>= 0`, `totalInstallments` entero `>= 1`, `currency` de 3 letras,
`firstInstallmentDate` como cadena `YYYY-MM-DD`.

### Paso 9 — `src/features/loans/actions/loansActions.ts`

#### `createLoanAction`

Molde literal: [`cardsActions.ts:104-200`](../../src/features/cards/actions/cardsActions.ts).

1. Sesión y `organizationId`; `fail()` si no hay.
2. Validar con el esquema del paso 8.
3. Crear la fila en `loans`.
4. Crear la cuenta espejo con `getNextCode( direction === "borrowed" ? "liability" : "asset" , todasLasCuentas )`,
   nombre `Préstamo <name>`, `balance: 0`, la divisa del préstamo y `entityId` si lo hay.
5. Vincular en `loan_accounts`.
6. Emitir el asiento de alta según el caso:
   * **§5A `borrowed` con desembolso:** Debe cuenta de destino / Haber préstamo (`liability`).
   * **§5B `lent`:** Debe préstamo (`asset`) / Haber cuenta de origen.
   * **§5C preexistente, sin desembolso:** contra **Patrimonio Neto**, resuelto como ya lo hace
     `cardsActions.ts` — por código `3.1.01.01`, con respaldo al primer `type === "equity"`, y
     `fail()` explícito si no hay ninguna. `borrowed`: Debe PN / Haber préstamo. `lent`: Debe
     préstamo / Haber PN.
7. `revalidatePath( "/[lang]/(main)/loans" , "page" )`.
8. `catch` con el manejo de `23505` y `23503` del molde, y el mensaje honesto de estado a medias:
   **las escrituras del alta no comparten transacción**, igual que en tarjetas, y el comentario del
   molde explica por qué el mensaje tiene que decir qué pasó en vez de tragárselo.

#### `payLoanInstallmentAction`

Molde literal: [`resolveSubscriptionAction.ts:136-245`](../../src/features/subscriptions/actions/resolveSubscriptionAction.ts).
**Todo dentro de un solo `db.transaction( async ( tx ) => { ... } )`:**

1. **Releer bajo bloqueo:** `loansRepository.findByIdForUpdate( loanId , organizationId , tx )`.
2. **Guarda de orden e idempotencia dentro de la transacción:** recalcular
   `pendientesDeLoan( freshLoan , hoyCivil )` y exigir que la cuota pedida sea **la más antigua
   pendiente**. Si no coincide, `throw` → rollback. Dos sesiones simultáneas: la primera avanza el
   puntero, la segunda no escribe nada.
3. **Divisa:** si la de la cuenta de pago difiere de la del préstamo, rechazar. **Sin conversión
   implícita**, que es lo que manda el §F3.
4. Desglose capital/interés de `cronogramaFrances()` para esa cuota. **No se ingresa a mano.**
5. Resolver la categoría de intereses según §1.1 y su cuenta por divisa con
   `findOrCreateAccountForCurrency( targetCat.id , currency , tx )`.
6. **`occurredAt` es la fecha nominal de la cuota, no el instante del clic.** Copiar el idioma del
   molde: partir la fecha civil y construir `new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) )`.
7. Emitir el asiento con `createLedgerTransaction( { ... } , tx )`:
   * **`borrowed` (§5D):** Debe préstamo (`liability`) por el **capital**, Debe intereses (`expense`)
     por el **interés**, Haber cuenta de pago por la **cuota**. Tres patas.
   * **`lent` (§5E):** Debe cuenta de cobro por la **cuota**, Haber préstamo (`asset`) por el
     **capital**, Haber intereses (`revenue`) por el **interés**.
   * **Con interés 0, dos patas, no tres con un cero.** Una pata en cero es ruido en el libro.
   * Cada `entry` lleva su `currency`. Los importes **siempre positivos**: el signo lo produce el
     motor según el tipo de cuenta. Escribirlo a mano implementa la partida doble al revés, que es
     uno de los seis desvíos que el §0 del RFC denuncia.
8. **Avanzar `resolvedThrough` a la fecha civil de la cuota en la misma transacción.** Si el puntero
   avanzó, el asiento existe; si algo falla, no se escribe nada.
9. `revalidatePath` y `ok( ... )` afuera; `catch` → `fail()`.

### Paso 10 — `src/features/loans/types.ts` y `src/features/loans/testing/loanFactory.ts`

* `types.ts`: molde [`cards/types.ts`](../../src/features/cards/types.ts). Tipos derivados con
  `InferSelectModel`, el tipo `PendienteCuota` y el préstamo con sus cuentas.
  **La `frequency` se tipa con `SubscriptionFrequency`**, importado de `subscriptions`: es lo que
  `ocurrenciaN()` exige en su firma. Importar el tipo no es modificar esa feature.
* `testing/loanFactory.ts`: molde
  [`installmentPlanFactory.ts`](../../src/features/cards/testing/installmentPlanFactory.ts).
  **Con código contable configurable por parámetro**, como se corrigió `cardCycleService.test.ts`:
  el índice único `accounts_org_code_unique` (`accounting/schema.db.ts:62`) sobre
  `(organizationId, code)` hace colisionar dos préstamos de prueba que traigan el mismo código.

---

## 4. Radio de impacto

Fuera de `src/features/loans/`, esta tanda toca **exactamente dos archivos**:

| Archivo | Qué cambia | Si se omite |
| :--- | :--- | :--- |
| [`src/shared/db/schema.ts`](../../src/shared/db/schema.ts) | Un `export *` | `db:generate` no ve las tablas |
| [`src/shared/db/testCleanup.ts`](../../src/shared/db/testCleanup.ts) | Dos borrados + import + renumeración | Suites de **otras** features rojas de forma intermitente |

**Nada más se modifica.** En particular: **no** se toca `subscriptions` (ni para generalizar
`pendientesDe()`, ni su repositorio, ni sus tests), **no** se toca `cards`, y **no** se agrega el
método de búsqueda por código a `categoryRepository` si se puede resolver filtrando el resultado de
`findAll( organizationId , tx )` por `accountCode`. Si hiciera falta un método nuevo ahí, que sea
**sólo de lectura y puramente aditivo**, y decirlo en el informe.

**Ningún test existente debería cambiar.** La suite base son 61 archivos y 443 tests, y esta tanda
sólo agrega. **Si algún test existente se pone rojo, es señal de que el paso 4 quedó mal o
incompleto** —no de que el test estuviera mal— y la corrección va en `testCleanup.ts`, no en el test.
**No relajar ninguna aserción existente ni mockear nada nuevo de forma global para que pase algo.**

---

## 5. Casos de prueba obligatorios

Los diez del §8 del RFC, **cada uno con test propio y nombrado `§8.N` en el `it(...)`**, como se hizo
con los `§9.N` del RFC 025:

1. **Debe = Haber por divisa** en los cinco asientos de §5, incluido el de tres patas de §5D.
2. **Signo:** un `borrowed` recién dado de alta tiene `balance` negativo y `deudaDe()` positivo; un
   `lent` tiene los dos positivos.
3. **Idempotencia:** confirmar dos veces la misma cuota escribe **un solo** asiento y la segunda falla.
4. **Orden:** confirmar una cuota que no es la más antigua pendiente falla **sin escribir nada**.
5. **Divisa cruzada:** pagar una cuota de un préstamo en USD desde una cuenta en ARS se rechaza.
6. **Contraparte:** un alta con `entityId` **y** `contactId`, y otra con **ninguno**, se rechazan.
7. **Amortización:** con `interestRateAnnual = 0` la cuota es capital puro y el asiento tiene **dos**
   patas, no tres.
8. **Aislamiento:** ninguna consulta del repositorio devuelve filas de otra organización.
9. **Período de gracia:** `startDate` 15/09 y `firstInstallmentDate` 10/11 **no propone ninguna cuota
   hasta el 1/11**, y la primera que propone es la del **10/11** — no la del 15/10 ni la del 15/09.
10. **`limpiarBase()`** deja las dos tablas vacías y no rompe ninguna suite existente.

Más las tres invariantes de amortización del paso 5, que son unitarias y puras.

**Archivos de test nuevos previstos: 4** — `amortizacion.test.ts`, `loanScheduleService.test.ts`,
`loansRepository.test.ts` y `loansActions.test.ts`. Eso lleva la suite de **61 a 65 archivos**.

> **El total de tests del plan es un piso, no un objetivo.** Reportar **la salida real de `pnpm
> test`**, no el número esperado. En una tanda anterior se reportó el número del plan en vez de la
> salida, y la discrepancia la destapó `verificador`.

---

## 6. Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

`pnpm test` necesita el contenedor `postgres-dev` vivo. Un `ECONNREFUSED` en el setup es **entorno
caído, no suite roja**: levantarlo y repetir.

**`pnpm build` no es typecheck:** `next build` no tipa los archivos de test y vitest tampoco. La
compuerta corre `tsc --noEmit` por separado y es el que pondría CI en rojo.

Delegar la batería al subagente `verificador`, y **mientras corre no tocar el árbol de trabajo**.

---

## 7. Qué tiene que traer el informe

1. **La salida real y pegada** de los cuatro comandos, con el total exacto de archivos y de tests.
2. **Las dos salidas de `psql \d`** del paso 3.
3. **El número de la migración** que emitió `db:generate`.
4. **Hallazgos:** lo que se vio y no se hizo porque este plan no lo nombraba. No arreglarlo por
   iniciativa propia si excede el alcance — anotarlo. Esa lista es la entrada de la ronda siguiente.
5. **Si algo del plan resultó inaplicable**, decirlo como tal en vez de improvisar una variante: un
   hueco del plan es defecto del plan, y atribuirlo bien mantiene honesto el ciclo.
