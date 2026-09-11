# Plan — RFC 025, tanda 1: el modelo de planes de cuotas y el disponible real

*   **Rama:** `docs/rfc-025-cuotas-de-tarjeta` — **ya existe y es la rama activa.** No cambiar de rama.
*   **Habilitado por:** [RFC 025](../proposals/025-card-installment-plans.md), `APPROVED` el 2026-09-11.
*   **Alcance:** §3, §4, §5 y §6 del RFC. **Backend completo, sin interfaz.**
*   **Tandas:** ésta es **la primera de dos**. La segunda —la ficha de cuotas en `/cards` y su bandeja de imputación— **no** es alcance de este plan.

> [!IMPORTANT]
> **Este plan sí lleva migración de base de datos:** una tabla nueva. Es `pnpm db:generate` seguido de
> `pnpm db:migrate`, **nunca** SQL escrito a mano ni edición de una migración ya generada.

> [!WARNING]
> **La feature `subscriptions` no se toca.** Ni un archivo, ni una firma, ni un test. Está cerrada y
> verde, y el RFC 025 §3.3 explica por qué generalizar `pendientesDe()` obligaría a re-verificarla
> entera. Si en algún paso parece que hay que editar algo bajo `src/features/subscriptions/`, **pará y
> reportá**: el paso se entendió mal.

---

## Lo que NO es alcance de esta tanda

| No se toca | Por qué |
| :--- | :--- |
| `CardVisual.tsx`, `CardsContainer.tsx`, `CardFormModal.tsx` | Es la tanda 2. **Siguen funcionando igual que hoy** |
| Los tres diccionarios | No hay texto de interfaz en esta tanda |
| `src/features/subscriptions/` entero | Ver el aviso de arriba |
| `ciclo.ts` y `calcularPeriodos()` | Se **usan**, no se modifican |
| La suma multidivisa de `deudaTotal` (`CardVisual.tsx:34`) | Defecto anterior, anotado en `TECHNICAL_DEBT.md` §9 y en el §10 del RFC. **No se arregla acá**, y por eso el término nuevo se entrega por divisa |
| El pago del resumen de la tarjeta | Ya existe como transferencia. El RFC §5D |
| Intereses por financiación y devengamiento | RFC 007 §5, depende de los crons de la Fase 3 |
| El barril `src/shared/db/schema.ts` | Ya hace `export * from "@/features/cards/schema.db"`, y la tabla nueva vive en ese archivo |

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo el 2026-09-11. **Reusar, no reescribir.**

| Ya existe | Dónde | Qué hace hoy |
| :--- | :--- | :--- |
| Proyección de la ocurrencia `n` | `ocurrenciaN()` , `subscriptions/services/recurrenceService.ts:81` | Recibe **primitivas** (`Date \| string`, frecuencia, intervalo, `n`) y devuelve fecha civil `YYYY-MM-DD`. Ancla en el día nominal y recorta fin de mes |
| Ventana de propuesta | `ventanaAbierta()` , `recurrenceService.ts:130` | Para mensual, abre el día 1 del mes de la cuota |
| Puntero inicial | `calcularPunteroInicial()` , `recurrenceService.ts:206` | **Verificado:** si ninguna ventana abrió todavía, devuelve el puntero un intervalo **antes** del inicio, así que una primera cuota futura queda pendiente |
| Hoy civil en la zona del perfil | `obtenerHoyCivil()` , `recurrenceService.ts:65` | `YYYY-MM-DD` en la zona IANA del usuario |
| Ciclo de cierre y vencimiento | `calcularPeriodos()` , `cards/utils/ciclo.ts:191` | Cierre anterior, cierre actual y vencimiento, con zonas IANA y bisiestos |
| Partición facturado / en curso | `cardCycleService.ts` | Dos consultas por cuenta en paralelo contra `ledgerRepository.sumEntriesByAccountInRange` |
| Deuda positiva de un pasivo | `deudaDe()` , `ciclo.ts:23` | `(balance === 0) ? 0 : -balance` |
| Categoría → hoja | `categoryRepository.resolveToLeaf()` | RFC 022 §5 |
| Hoja → cuenta en una divisa | `categoryRepository.findOrCreateAccountForCurrency()` | Crea la contrapartida por divisa si falta |
| Alta de cuenta de tarjeta por divisa | `cardsRepository.addCardAccount()` , `cardsRepository.ts:180` | Inserta la fila del puente |
| Código contable correlativo | `getNextCode( "liability" , todasLasCuentas )` , `accountCodes.ts:16` | Usado en `cardsActions.ts:139` |
| **Molde de la acción de confirmación** | `subscriptions/actions/resolveSubscriptionAction.ts` | Guarda de idempotencia → relectura `FOR UPDATE` → asiento → avance de puntero, **todo en una transacción ACID** |
| Bloqueo pesimista | `subscriptionRepository.findByIdForUpdate()` | El equivalente hay que escribirlo para planes |
| Factoría de tests | `subscriptions/testing/subscriptionFactory.ts` , `makeSubscription()` | El molde de la factoría nueva. **`cards` no tiene carpeta `testing/`: se crea** |
| Envoltura de resultado | `Result` , `ok()` , `fail()` , `shared/lib/result.ts` | Toda acción devuelve `Result` |

---

## Paso 1 — La tabla

**Dónde:** al final de `src/features/cards/schema.db.ts`, después de `cardAccounts`.

El esquema literal está en el **§4 del RFC** y se copia de ahí sin cambios. Los imports que hay que
agregar al archivo: `bigint`, `date` y `categories` (desde `@/features/accounting/schema.db`) —
**`integer`, `varchar`, `timestamp`, `uuid` e `index` ya están importados**, verificar antes de
duplicar.

**Contrastar antes de escribir:** la tabla `cardAccounts` inmediatamente arriba, para copiar el
espaciado de delimitadores y la alineación por columnas de `.agents/AGENTS.md` §4.

Después:

```bash
pnpm db:generate
pnpm db:migrate
```

**No editar el SQL generado.** Si `db:generate` no produce nada, es que el archivo no se guardó o la
tabla no quedó exportada: pará y reportá.

---

## Paso 2 — `limpiarBase()`

**Archivo:** `src/shared/db/testCleanup.ts`.

`card_installment_plans` tiene FK contra `cards` (paso 8 actual) y contra `categories` (paso 15
actual). Va **antes de las dos**: entra como **paso 7**, junto a `card_accounts`, y **la numeración de
los comentarios de los pasos siguientes se corre en uno**.

```ts
    // 7. card_installment_plans → cascade a cards, set null a categories; antes que cards
    await tx.delete( cardInstallmentPlans ) ;
```

**Por qué importa:** `patterns.md` §11. Una tabla con FK que no se limpia rompe suites de **otras**
features de forma intermitente, según el orden en que Vitest decida correr los archivos. El defecto no
aparece en la suite que la introdujo.

**No recalcular el orden topológico del resto**: está resuelto en el archivo.

---

## Paso 3 — Tipos

**Archivo:** `src/features/cards/types.ts`.

1.  `CardInstallmentPlan` e `InsertCardInstallmentPlan` con `$inferSelect` / `$inferInsert`, igual que `Card` y `CardAccount`.
2.  `PendienteCuota`: `{ planId: string ; numeroCuota: number ; fechaCuota: string ; plan: CardInstallmentPlan }`. Es el equivalente de `PendienteRecurrencia` y **vive acá, no en `subscriptions`**.
3.  **`CicloTarjeta` suma un campo:**

```ts
  cuotasFuturas: Record< string , number > ; // divisa → centavos no imputados
```

> [!WARNING]
> **Radio de impacto de ese campo.** `CicloTarjeta` se construye en **un solo lugar**
> (`cardCycleService.ts:62-68`, verificado) y se consume en `CardVisual.tsx` a través de `card.ciclo`.
> Al ser **requerido**, `tsc --noEmit` va a marcar todo objeto literal de `CicloTarjeta` que no lo
> traiga, **incluidos los de `cardCycleService.test.ts`**. Eso es lo esperado: arreglarlos es parte de
> este paso, no un imprevisto. **Es un mapa por divisa y no un número** porque `deudaTotal` ya suma
> divisas distintas en un escalar (`TECHNICAL_DEBT.md` §9) y este plan no repite ese error.

---

## Paso 4 — Validación Zod

**Archivo:** `src/features/cards/schemas/cards.schema.ts`, junto a los esquemas que ya están.

`createInstallmentPlanSchema`:

*   `cardId`, `description` (3-255), `merchantName` opcional (≤150), `categoryId` opcional/nullable.
*   `installmentAmount`: entero positivo, **en centavos**. Rechazar decimales con `.int()`.
*   `totalInstallments`: entero `>= 1`.
*   `currency`: string ≤10, default `"ARS"`.
*   `purchasedAt`: `z.coerce.date()`.
*   `firstInstallmentDate`: string con el patrón `^\d{4}-\d{2}-\d{2}$`. **No `z.coerce.date()`**: es fecha civil y convertirla a `Date` es exactamente lo que el §4.1 del RFC prohíbe.

**Contrastar contra:** `transactions.schema.ts`, que es el esquema de formulario más parecido, para
copiar el estilo de mensajes en español y el uso de `.refine()`.

**Sin `CHECK` en la base:** las invariantes se validan acá (RFC §4.1).

---

## Paso 5 — El servicio de cuotas

**Archivo nuevo:** `src/features/cards/services/installmentService.ts`. **Funciones puras**, sin base
de datos, igual que `recurrenceService.ts`.

```ts
export function ocurrenciaDeCuota( plan , n ): string
```
Envuelve `ocurrenciaN( plan.firstInstallmentDate , "monthly" , 1 , n )`. **Se le pasan `"monthly"` y
`1` literales**: el RFC §4.1 explica por qué no son columnas.

```ts
export function cuotasImputadasDe( plan ): number
```
Cuenta cuántas ocurrencias son `<= plan.resolvedThrough`, proyectando con `ocurrenciaDeCuota` desde
`n = 0`. Si `resolvedThrough` es `null`, devuelve `0`. **El bucle corta en `totalInstallments`**: la
serie termina, y ése es el tope natural. Sin `MAX_BUSQUEDA` de 2000 como en `pendientesDe()`.

```ts
export function pendientesDeCuotas( plan , hoyCivil ): PendienteCuota[]
```
El equivalente de `pendientesDe()` **escrito acá**, con tres diferencias que hay que respetar:

1.  Devuelve `[]` si `plan.archivedAt` no es nulo. **No lee `status`**: un plan no tiene esa columna, y ése es el motivo por el que `pendientesDe()` no se reusa.
2.  **Corta en `totalInstallments`.** Una suscripción es infinita; un plan de 12 cuotas no propone una decimotercera.
3.  Salta las ocurrencias `<= resolvedThrough` y corta en la primera cuya ventana no abrió (`ventanaAbierta`), porque la serie es monótona creciente — **igual que el original**.

```ts
export function cuotasFuturasDe( plan ): number
```
`plan.installmentAmount * ( plan.totalInstallments - cuotasImputadasDe( plan ) )`. Nunca negativo.

```ts
export function cuotasFuturasPorDivisa( planes ): Record< string , number >
```
Agrupa por `plan.currency`. **Es lo que consume `CicloTarjeta`.**

```ts
export function proponerPrimeraCuota( closingDay , dueDay , purchasedAt , zonaHoraria ): string
```
Usa `calcularPeriodos()` (`ciclo.ts:191`): si `purchasedAt` es posterior al `cierreActual` que
devuelve, la primera cuota cae en el mes siguiente; si no, en el vigente. Devuelve fecha civil. **Es
sólo una propuesta por defecto para el alta** (RFC §3.2): el usuario puede ponerla donde quiera, y las
promociones con período de gracia no se deducen de ninguna fecha de cierre. Si la tarjeta no tiene
`closingDay`, devolver la fecha civil de `purchasedAt`.

---

## Paso 6 — Repositorio

**Archivo nuevo:** `src/features/cards/repositories/installmentPlansRepository.ts`.

**Contrastar contra `cardsRepository.ts`** para el estilo, el tipo `DBOrTx` y la firma de los métodos.

*   `create( data , tx )`
*   `findById( id , organizationId , tx )`
*   `findByIdForUpdate( id , organizationId , tx )` — **con `FOR UPDATE`**, copiando `subscriptionRepository.findByIdForUpdate`. Es lo que impide que dos confirmaciones simultáneas imputen la misma cuota.
*   `findByCard( cardId , organizationId , tx )` — sólo los no archivados.
*   `findActiveByOrganization( organizationId , tx )` — para el cálculo de cuotas futuras de todas las tarjetas de una vez, sin cascada de consultas.
*   `update( id , organizationId , data , tx )`
*   `archive( id , organizationId , tx )` — pone `archivedAt`, **no borra**.

**Toda consulta filtra por `organizationId`.** Es regla dura (`.agents/AGENTS.md` §8.3) y el §4 del
RFC 008 registra que la versión vieja de ese documento la violaba dentro de un RFC aprobado.

---

## Paso 7 — Acciones

**Archivo nuevo:** `src/features/cards/actions/installmentPlansActions.ts`.

**Todas** devuelven `Result`, leen `organizationId` de la sesión con `getServerSession` y revalidan
con `revalidatePath( "/[lang]/(main)/cards" , "page" )` — **el patrón literal con `[lang]`, sin
resolver el locale**, como en `resolveSubscriptionAction.ts:243`.

### 7.1 `createInstallmentPlanAction`

1.  Valida con `createInstallmentPlanSchema`.
2.  Verifica que la tarjeta exista, sea de la organización y **sea `type === "credit"`**. Una tarjeta de débito no financia nada: `fail()` con mensaje claro.
3.  Si la tarjeta no tiene `card_accounts` en la divisa del plan, **la crea** con `getNextCode( "liability" , ... )` y `addCardAccount()`, replicando `cardsActions.ts:139-153`.
4.  Calcula `resolvedThrough` inicial con `calcularPunteroInicial( firstInstallmentDate , "monthly" , 1 , hoyCivil )`.
5.  Inserta.

> **No emite ningún asiento.** Es el §5A del RFC y la consecuencia directa de la decisión del §2. Si
> aparece un `createLedgerTransaction` en esta acción, el paso se entendió mal.

### 7.2 `resolveInstallmentAction`

**Copiar la estructura de `resolveSubscriptionAction.ts` paso por paso**, con **una diferencia que no
se puede pasar por alto:**

> [!WARNING]
> **Esta acción NO recibe ni pide `accountId` de pago.** Imputar una cuota no mueve plata de ninguna
> cuenta bancaria: reconoce el gasto y aumenta la deuda de la tarjeta (RFC §3.5). El molde sí pide una
> cuenta de pago, y copiarlo entero es el defecto que este aviso previene.

Parámetros: `{ planId , occurrenceDate , action: "confirm" | "confirm_custom_amount" | "skip" }`.

1.  Guarda de idempotencia **fuera** de la transacción: `pendientesDeCuotas( plan , hoyCivil )[0].fechaCuota` debe ser igual a `occurrenceDate`, o `fail()`.
2.  Dentro de `db.transaction`:
    *   Relectura con `findByIdForUpdate` y **repetición de la guarda** sobre la fila fresca. Sin esto la carrera sigue abierta.
    *   Resolver la cuenta de la tarjeta en `plan.currency` desde `card_accounts`.
    *   `resolveToLeaf( plan.categoryId , "expense" , organizationId , tx )` y `findOrCreateAccountForCurrency( hoja.id , plan.currency , tx )`.
    *   `createLedgerTransaction` con **dos patas**: Debe en la cuenta de gasto, Haber en la cuenta de la tarjeta, las dos en `plan.currency`.
    *   **`occurredAt` = la fecha civil de la ocurrencia**, construida como en el molde: `new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) )`. **No `new Date()`.** Es lo que hace que la cuota caiga en el ciclo correcto de `cardCycleService` y lo que preserva los cierres históricos.
    *   Avanzar `resolvedThrough` a `occurrenceDate`.
    *   `description` del asiento: el `description` del plan más el ordinal, p. ej. `"Heladera Samsung (3/12)"`. `merchantName` del plan pasa al asiento.
3.  `"skip"` avanza el puntero **sin emitir asiento** (la cuota no llegó al resumen).

### 7.3 `archiveInstallmentPlanAction` y `getInstallmentPlansAction`

Archivado lógico, y lectura que devuelve los planes de una tarjeta con `cuotasImputadasDe` y
`pendientesDeCuotas` ya resueltos.

---

## Paso 8 — El disponible

**Archivo:** `src/features/cards/services/cardCycleService.ts`.

> [!WARNING]
> **La guarda de la línea 34 es la trampa de este paso.** Hoy `calcularCicloDeTarjeta` devuelve `null`
> si la tarjeta no es de crédito **o no tiene `closingDay`**. Pero **un plan de cuotas existe igual sin
> día de cierre**: una tarjeta de crédito sin `closingDay` cargado puede tener planes, y devolver
> `null` los haría desaparecer del disponible sin ningún error visible.

Por eso:

1.  `calcularCiclosDeTarjetas` recibe además los planes activos de la organización (una sola consulta con `findActiveByOrganization`, **no una por tarjeta**: la cascada de consultas es lo que el RFC 007 §8D prohíbe).
2.  `cuotasFuturas` se calcula **antes** de la guarda de la línea 34 y se devuelve **aunque el ciclo sea `null`**. Eso obliga a decidir la forma del retorno: lo más simple es que `calcularCicloDeTarjeta` deje de devolver `null` y devuelva un `CicloTarjeta` con `facturado: 0`, `enCurso: 0` y las fechas vacías cuando no hay ciclo. **Si se elige eso, `CardVisual.tsx:104` (`card.ciclo ? ...`) deja de discriminar y hay que reportarlo**, porque su arreglo es de la tanda 2.
3.  **La tanda 2 es la que resta el término en la interfaz.** Acá sólo se calcula y se expone.

---

## Paso 9 — Tests

**Factoría nueva:** `src/features/cards/testing/installmentPlanFactory.ts` con `makeInstallmentPlan(
overrides )`, copiando `subscriptionFactory.ts`. **La carpeta `testing/` no existe en `cards`: se crea.**

Los doce casos del **§9 del RFC** son obligatorios. Los que más importan y los que se olvidan:

*   **El alta no emite asiento** (§9.2): dar de alta un plan y verificar que `ledger_transactions` no creció.
*   **Primera cuota futura** (§9.6): compra el 20/09 con primera cuota el 10/11 no propone nada hasta el 1/11.
*   **Fin de serie** (§9.5): un plan de 3 cuotas con 3 imputadas no propone una cuarta.
*   **La cuota cae en el ciclo correcto** (§9.8): es el que prueba que `occurredAt` se fijó bien.
*   **Ancla de fin de mes** (§9.7): primera cuota el 31/01 → 28/02 → 31/03, sin degradarse.
*   **Aislamiento multi-tenant** (§9.11).

**Trampa de los tests de este repositorio:** las suites que tocan la base usan `limpiarBase()`. Si el
paso 2 no se hizo, estos tests pasan y **rompen otros**.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

Y el contraste del esquema contra la base real:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d card_installment_plans"
```

**`installment_amount` debe figurar como `bigint`**; `total_installments` como `integer`;
`first_installment_date` y `resolved_through` como `date`, sin zona horaria.

> **`pnpm build` no es typecheck.** `next build` no tipa los archivos de test y vitest tampoco. La
> compuerta corre `tsc --noEmit` por separado (`.github/workflows/compuerta.yml:62`).

> **Si `pnpm test` muere en el setup con `ECONNREFUSED`, es entorno caído, no suite roja:** el
> contenedor `postgres-dev` de podman tiene que estar levantado.

---

## El reporte

**Pegar la salida cruda de los cinco comandos, no describirla.** Números exactos: cuántos tests, en
cuántos archivos, cuántos errores de ESLint, cuántos de TS, y la tabla que devuelve `psql`.

Y aparte, la lista de **hallazgos**: lo que se vio y no se hizo porque este plan no lo nombraba. Esa
lista es la entrada de la próxima ronda. En particular, si el paso 8 obligó a cambiar la forma del
retorno de `calcularCicloDeTarjeta`, **decilo**: condiciona la tanda 2.
