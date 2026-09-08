# Plan — Tarjetas de crédito y débito como cuentas de pasivo (RFC 007, primera tajada)

*   **Fase:** 2 — El lado de los pasivos
*   **RFC:** [`007-cards-management.md`](../proposals/007-cards-management.md) · `APPROVED` (2026-06-23)
*   **Rama:** `feat/tarjetas`, sale de `master` en `e4d8cb3`
*   **Estado del plan:** **listo para ejecutar.** Contrastado contra el esquema real, y la enmienda que necesitaba el RFC quedó aprobada por el usuario el 2026-09-08.

---

## Qué se construye y por qué

La tarjeta es el instrumento que origina la mayoría del gasto de una persona real, y hoy el sistema
no la modela: en el plan de cuentas hay una fila suelta —`2.1.01.01 Tarjeta Visa Galicia`, tipo
`liability`, saldo `-2500000`— que es una cuenta de pasivo como cualquier otra. No tiene límite, no
tiene día de cierre, no tiene vencimiento, y nada distingue lo ya facturado de lo que se está
gastando ahora. Esa distinción es exactamente lo que la gente mira cuando abre una app de finanzas.

Además, la Fase 2 entera cuelga de acá: una compra en cuotas (RFC 008) es estructuralmente un pasivo
que se devenga **contra una tarjeta**, y el débito automático de una suscripción (RFC 004) necesita
saber contra qué tarjeta debita.

## Lo que el RFC 007 dice y la base contradice

El RFC se escribió el 22 de junio de 2026, **antes del core contable**. Es la misma cosecha que el
015, que llegó proponiendo columnas que ya no existían. Contrastado archivo por archivo:

| RFC 007 dice | La realidad hoy | Qué implica |
| :--- | :--- | :--- |
| `import { accounts } from "../../features/accounts/schema.db"` | `accounts` vive en [`src/features/accounting/schema.db.ts`](../../src/features/accounting/schema.db.ts). No existe `features/accounts/` | Ruta de import inválida |
| `creditLimit`, `monthlyMaintenanceFee`, `annualRenewalFee` en `integer` | El **RFC 019** ya migró toda columna monetaria a `bigint` (migración `0018`) | Tres columnas nacerían violando el cimiento de la Fase 0 |
| §7A propone **añadir** `currency` a `ledger_entries` | La columna **ya existe** (`varchar(10)`, default `'ARS'`), y el snippet del RFC la declara `bigint` en `mode: "bigint"` cuando el repo usa `mode: "number"` | §7A está construido; copiar su snippet rompería el modo |
| §7B calcula el saldo dual con `SUM(debit-credit) … GROUP BY currency` sobre **un** `cardAccountId` | [`accountingService.ts`](../../src/features/accounting/services/accountingService.ts) impone que **la moneda de un asiento la manda la cuenta** y rechaza cualquier asiento en otra divisa | Ese `GROUP BY` sólo puede devolver **una** fila. El saldo dual ARS/USD es imposible con una sola cuenta |

La cuarta es la que decide el diseño de esta ronda, así que va con su cita:

> `if( monedaAsiento !== account.currency ){ throw new Error( ... "Para mover valor entre monedas usá una transacción de cambio." ) }`

Una cuenta tiene **una** divisa. Por eso el cambio de divisas se registra contra cuentas de posición
`3.3.01-<MONEDA>` y las contrapartidas de gasto se crean por divisa (`5.1.01.99-<MONEDA>`). Una
tarjeta con saldo dual no es una cuenta: **son dos**, una por moneda, colgando de la misma tarjeta.

## Enmiendas al RFC, ya aprobadas

**Escritas y aprobadas por el usuario el 2026-09-08.** El texto vigente de §2, §7A y §7B es el
enmendado; las versiones de junio quedan como registro y no se copian. Fueron cuatro:

1.  **§2 — Rutas de import**: `accounts` y `organizations` se importan de `@/features/accounting/schema.db` y `@/features/auth/schema.db`.
2.  **§2 — Tipos monetarios**: `creditLimit`, `monthlyMaintenanceFee` y `annualRenewalFee` pasan a `bigint( ... , {mode: "number"} )`. Las tasas (`interestRateFinancing`, `interestRatePenalty`) **se quedan en `integer`**: son puntos básicos ×100, no dinero, igual que `year` y `month`.
3.  **§7A — Ya construido**: la sección se marca como implementada; su snippet se corrige a `mode: "number"` o se borra para que nadie lo copie.
4.  **§7B — Saldo dual**: se reescribe contra el motor real. Una tarjeta con saldo en dos monedas tiene **una cuenta de pasivo por moneda**; el saldo dual se obtiene recorriendo las cuentas de la tarjeta, no agrupando los asientos de una sola.

El contraste completo quedó asentado en la **Sección 0** del propio RFC, con la cita del motor que
hace irrealizable el §7B original.

---

## Radio de impacto

**Feature nueva** `src/features/cards/`, con la forma canónica que ya tiene `contacts/`
(`schema.db.ts` · `types.ts` · `schemas/` · `repositories/` · `actions/` · `components/` · `utils/`).

**Se toca fuera de la feature, y sólo esto:**

*   `src/features/accounting/repositories/ledgerRepository.ts` — un método nuevo de agregación. Hoy no hay ninguno que sume asientos de una cuenta acotados por fecha, y el ciclo de tarjeta no es otra cosa.
*   `src/shared/db/seed.ts` — la fila `2.1.01.01` queda huérfana si no se le crea su tarjeta.
*   `src/app/[lang]/(main)/cards/` — ruta nueva.
*   `docs/patterns.md`, `docs/TECHNICAL_DEBT.md`, `docs/trabajo-en-vuelo.md`.

**No se toca:** `accountingService.ts`. El motor de partida doble no necesita nada nuevo para esto, y
tocarlo sería la forma más cara de equivocarse.

## Reusos: qué hacen hoy las piezas que este plan toca

*   **`getNextCode( type , cuentas )`** ([`accountCodes.ts:16`](../../src/features/accounting/utils/accountCodes.ts)) — genera el código contable siguiente por tipo. `liability` mapea al prefijo `2.1.01.`. Ya devuelve `2.1.01.02` con el plan sembrado actual.
*   **`createAccountForEntityAction`** ([`accountingActions.ts:190`](../../src/features/accounting/actions/accountingActions.ts)) — el precedente exacto de "crear cuenta + asiento de apertura": localiza patrimonio **antes** de crear nada, crea la cuenta en cero, y recién después emite el asiento. Se copia esa secuencia, no se inventa otra.
*   **`contacts` + `contact_payment_methods`** — el precedente de una feature con dos tablas donde la segunda cuelga de la primera y referencia a `accounting` con `onDelete: "restrict"`. `cards` + `card_accounts` es la misma forma.
*   **`InstitutionLogo`** con `brandDomain` — resuelve el logotipo de la entidad sin heurística de strings. La tarjeta lo reusa; no se escribe una segunda resolución de marca.
*   **`formatCurrency( amount , currencyCode , locale )`** ([`currencyFormatter.ts`](../../src/shared/lib/currencyFormatter.ts)) — el locale sale de `profile.numberFormat`, que desde la ronda anterior es un BCP 47 real. Se resuelve una vez por componente con respaldo a `"es-AR"`.
*   **`useProfileContext()`** — lanza fuera de su proveedor. Todo componente de tarjetas que lo use tiene que colgar de `ProfileProvider`, que ya envuelve el árbol en [`layout.tsx:106`](../../src/app/[lang]/layout.tsx).
*   **`CardsClient.tsx`** de FinanzasMock (605 líneas) — la referencia visual: `glassOverlay`, chip, logo de red, barra de progreso del límite. Se porta la **forma**, no el código: aquel modelo tiene `currentBalance` como columna, y acá el saldo sale del libro.

---

## Pasos

### Paso 1 — Esquema: dos tablas, no una

Crear `src/features/cards/schema.db.ts`.

**`cards`** — atributos del plástico, cero dinero acumulado:

*   `id`, `organizationId` (→ `organizations`, `cascade`, **`notNull`**), `label` `varchar(100)`, `type` `varchar(20)` (`'credit' | 'debit'`), `network` `varchar(20)` (`'visa' | 'mastercard' | 'amex' | 'other'`).
*   `entityId` → `financial_entities` con `onDelete: "restrict"`, para el logo y el color de la marca. El RFC no lo tiene; sin él la tarjeta no puede pintarse con la identidad del banco, que es la mitad de su §8C.
*   `linkedAccountId` → `accounts` con `onDelete: "set null"`. Para débito es la cuenta que la tarjeta **espeja**; para crédito, la cuenta de la que se debita el pago del resumen.
*   `lastFour` `varchar(4)`, `expiryMonth` / `expiryYear` `integer`.
*   Sólo crédito, todos anulables: `creditLimit` **`bigint` mode number**, `closingDay` / `dueDay` `integer`, `interestRateFinancing` / `interestRatePenalty` `integer` (puntos básicos ×100), `monthlyMaintenanceFee` / `annualRenewalFee` **`bigint` mode number** con default `0`.
*   `archivedAt` (baja lógica, como `contacts`), `createdAt`, `updatedAt`.
*   Índice `cards_org_label_idx` sobre `(organization_id, label)`.

**`card_accounts`** — la tarjeta y su cuenta de pasivo, una fila por divisa:

*   `id`, `cardId` (→ `cards`, `cascade`), `accountId` (→ `accounts`, **`restrict`**: una cuenta con movimientos no se borra), `currency` `varchar(10)`, `createdAt`.
*   **Índice único** sobre `(card_id, currency)`. Es lo que impide dos cuentas en pesos para la misma tarjeta.

**Por qué la tabla intermedia y no una columna `card_id` en `accounts`:** `cards` ya referencia a
`accounts` por `linkedAccountId`; la columna inversa cerraría un ciclo de imports entre los dos
`schema.db.ts`. Y con la tabla intermedia el saldo dual del §7 sale gratis el día que exista, sin
migración. Es la misma dirección de dependencia que `contact_payment_methods`.

**PCI, y no es decorativo:** no hay columna para el PAN ni para el CVV, y no la va a haber. El §3 del
RFC lo prohíbe; el Paso 4 lo hace cumplir en runtime.

Después: `pnpm db:generate` y `pnpm db:migrate`. **Esta migración no necesita backfill**: crea tablas
vacías, no cambia el default de nada existente. (El backfill fue necesario en `0021` porque cambiar
un *default* no reescribe las filas ya guardadas; acá no hay filas.)

### Paso 2 — El saldo sale del libro, y viene con signo

Extender `ledgerRepository` con **un** método:

```
async sumEntriesByAccountInRange( accountId , organizationId , desde , hasta , tx ) : Promise< {debit: number ; credit: number} >
```

*   Joinea `ledger_entries` contra `ledger_transactions` y filtra por `ledgerTransactions.occurredAt`, **no** por `ledgerEntries.createdAt`: la fecha contable del hecho es `occurred_at`, y el 30 de un mes se puede cargar el 3 del siguiente.
*   Filtra por `organizationId` en la cabecera. Sin ese filtro la consulta cruza inquilinos sin que el compilador diga una palabra (`.agents/AGENTS.md` §8.3).
*   Excluye las transacciones reversadas: `reversedAt IS NULL` y `reversesTransactionId IS NULL`. Un consumo reversado no se factura; contar el asiento original y su contra-asiento sumaría cero al saldo pero inflaría el total facturado.

**La trampa del signo, que hay que nombrar acá porque va a morder:** en
[`accountingService.ts`](../../src/features/accounting/services/accountingService.ts), un `liability`
aumenta con el **débito** y disminuye con el **crédito** (`balance + debit - credit`). Un consumo con
tarjeta **acredita** la tarjeta, así que su `balance` se vuelve **negativo** —por eso la fila
sembrada dice `-2500000`—. **La deuda de la tarjeta es `-balance`.** Mostrar `balance` en crudo
pintaría la deuda en negativo, y `Disponible = Límite − saldo` daría un disponible mayor que el
límite. La conversión se hace **una sola vez**, en una función con nombre (`deudaDe( cuenta )`), y
nunca repartida por los componentes.

### Paso 3 — El ciclo, en funciones puras y en la zona horaria del usuario

Crear `src/features/cards/utils/ciclo.ts`, sin dependencias nuevas y sin tocar la base:

```
calcularPeriodos( closingDay , dueDay , hoy , zonaHoraria ) : { cierreAnterior , cierreActual , vencimiento }
```

Cuatro trampas, y las cuatro son test antes que código:

1.  **`closingDay` mayor que los días del mes.** Cierre 31 en febrero no existe. Se recorta al último día del mes (28, 29, 30 o 31 según corresponda), no se desborda al mes siguiente.
2.  **Año bisiesto.** Febrero de 2028 tiene 29. El recorte del punto 1 tiene que consultarlo, no asumir 28.
3.  **`dueDay` menor que `closingDay`.** Cierra el 25 y vence el 5: el vencimiento cae en el **mes siguiente** al cierre. Si `dueDay > closingDay`, cae en el mismo mes.
4.  **La zona horaria.** `occurredAt` es `timestamptz` y el día del mes depende de dónde está parado el usuario: un consumo de las 22:30 en Buenos Aires es del día siguiente en UTC, y con cierre el 25 eso lo empuja al período equivocado. Se resuelve con `Intl.DateTimeFormat` y `profile.timezone`, que desde la ronda anterior **es un identificador IANA real** —antes decía `'(GMT-03:00) Buenos Aires'`, que `Intl` no puede resolver—. Sin dependencias: `Intl` ya está.

Y la partición que el §4 del RFC pide, sobre esos períodos:

*   **Saldo facturado:** asientos con `occurredAt ∈ (cierreAnterior , cierreActual]`.
*   **Saldo en curso:** asientos con `occurredAt > cierreActual`.

Una tarjeta de **débito** no entra acá: no tiene ciclo. Su saldo es el de la cuenta que espeja.

### Paso 4 — Validación estricta, con el CVV cerrado por esquema

Crear `src/features/cards/schemas/cards.schema.ts` con Zod en modo **`.strict()`**, siguiendo el
precedente de [`profile.schema.ts`](../../src/features/profile/schemas/profile.schema.ts):

*   `lastFour`: exactamente 4 dígitos (`/^\d{4}$/`), no "4 caracteres".
*   `expiryMonth` 1–12; `expiryYear` de cuatro dígitos y no vencido.
*   `closingDay` y `dueDay` 1–31, **sólo si `type === "credit"`**: se valida con `superRefine`, porque una tarjeta de débito con día de cierre es un dato incoherente que hoy nadie impediría.
*   `creditLimit` y las comisiones: enteros no negativos, **en centavos**. La conversión desde el formulario ocurre en el borde, nunca dividiendo por 100 dentro de un componente (`.agents/AGENTS.md` §8.2).
*   **El `.strict()` es la defensa PCI.** Un payload con `cvv`, `pan` o `cardNumber` **falla**, no se descarta en silencio. Sin `.strict()`, Zod tira la clave sin avisar y el día que alguien agregue un `...spread` al repositorio, el CVV entra a la base. Es el mismo agujero que el `.strict()` del perfil cerró para `planName`.

### Paso 5 — Alta, y qué asiento emite cada tipo

Crear `src/features/cards/actions/cardsActions.ts`. `createCardAction` se ramifica por tipo:

**Débito** — no crea cuenta ni asiento. La tarjeta es un espejo: `linkedAccountId` apunta a una cuenta
de activo existente, y no se escribe ninguna fila en `card_accounts`.

**Crédito** — crea la cuenta de pasivo, en este orden y por esta razón:

1.  Verificar que la entidad pertenezca a la organización (aislamiento estricto, como hace `createAccountForEntityAction`).
2.  Si viene `deudaInicial > 0`, **localizar la cuenta de patrimonio antes de crear nada**: `3.1.01.01`, o la primera `equity`. Si no está, se falla ahí, sin dejar una tarjeta a medio crear.
3.  `accountRepository.create` con `type: "liability"`, `balance: 0`, código de `getNextCode( "liability" , cuentas )`, `currency` la de la tarjeta.
4.  Insertar la fila de `card_accounts`.
5.  Sólo si `deudaInicial > 0`, el asiento de apertura —y va **al revés** que el de una cuenta de activo: **Debe Patrimonio Neto / Haber Tarjeta**. Una deuda preexistente reduce el patrimonio; el asiento de `createAccountForEntityAction` (Debe cuenta / Haber patrimonio) es el de un activo y copiarlo tal cual dejaría el patrimonio inflado por el monto de la deuda.

**Un límite de crédito no emite ningún asiento.** Es una autorización del banco, no dinero que se
movió. Registrarlo como un asiento sería inventar patrimonio.

### Paso 6 — Ruta y componentes

Ruta `src/app/[lang]/(main)/cards/` —en inglés, como `accounts`, `contacts`, `transactions` y
`subscriptions`; el `/tarjetas` del mock es su nombre en el catálogo viejo, no la ruta de acá—.

*   `CardsContainer.tsx` (cliente, estado y modal) y `CardVisual.tsx` (el plástico).
*   Server Component de la página: `Promise.all` para tarjetas, cuentas y entidades. Tres `await` en fila es el error que el §8D del RFC nombra por su nombre.
*   `CardVisual` recibe **todo por props**, incluido el locale, y no llama al contexto: es la misma decisión que se tomó con `SummaryBar`, que es cliente sólo por transitividad.
*   Barra de progreso del límite: `Disponible = Límite − Deuda total`. Sobre el 80 % pasa a ámbar. **En esta ronda no se restan cuotas futuras**: `installmentPlans` es del RFC 008 y no existe.
*   **Renderizado condicional seguro**: `{card.monthlyMaintenanceFee > 0 ? <Badge/> : null}`. Con `&&` sobre un `0`, React dibuja un `0` suelto en la tarjeta.
*   CSS Modules con tokens, sin px fijos estructurales, y **nada de movimiento ni cambio de dimensiones en `:hover`** (`.agents/AGENTS.md` §4). El `glassmorphism` del mock se porta con `backdrop-filter` y sombra; el `transform: translateY` que traiga, no.
*   Estado vacío con `EmptyState`, que ya existe.

### Paso 7 — Seed

La fila `2.1.01.01 Tarjeta Visa Galicia` queda huérfana: es una cuenta de pasivo sin tarjeta, así que
`/cards` no la mostraría y el saldo de `-2500000` no aparecería en ningún lado. El seed crea su
`cards` y su `card_accounts` apuntando a esa cuenta —sin duplicarla y sin tocar su saldo—, con
`onConflictDoUpdate` en **los dos** bloques, que es donde el seed ya se rompió una vez.

### Paso 8 — Tests

*   `ciclo.test.ts` — las cuatro trampas del Paso 3, una por una: cierre 31 en febrero, 29 de febrero de 2028, `dueDay < closingDay`, y un consumo a las 22:30 de Buenos Aires que en UTC cae al día siguiente.
*   `cards.schema.test.ts` — `lastFour` no numérico rechazado; **`cvv`, `pan` y `cardNumber` rechazados por `.strict()`**, un test por cada uno, que es el que documenta la regla PCI; día de cierre en una tarjeta de débito rechazado.
*   `cardsRepository.test.ts` — aislamiento multi-tenant: una tarjeta de otra organización no se lee.
*   `cardsActions.test.ts` — el asiento de apertura va Debe Patrimonio / Haber Tarjeta, y una tarjeta de débito no emite ninguno.
*   Partición de saldo: consumos a un lado y al otro del cierre caen en el balde correcto, y un consumo reversado no cuenta en ninguno.

### Paso 9 — Documentación, en el mismo commit

*   **`docs/patterns.md` §7 — Tarjetas como cuentas de pasivo.** Contrastado antes de escribirlo: las seis secciones actuales (partida doble, outbox, idempotencia, circuit breaker, logos, preferencias canónicas) no dicen nada de tarjetas ni de ciclos, así que esto no duplica ni contradice nada. Lo que asienta: una tarjeta de crédito es una cuenta de pasivo por divisa; su deuda es el saldo negado; el ciclo es una función pura sobre `occurred_at` en la zona del usuario.
*   **`docs/TECHNICAL_DEBT.md` § Abierto** — (a) intereses y comisiones quedan sin devengar hasta que existan los crons de la Fase 3; (b) el disponible no descuenta cuotas futuras hasta el RFC 008.
*   **`.agents/AGENTS.md` §8.1** — **está desactualizado**: dice que la validación es `totalDebit !== totalCredit`, y desde el soporte multimoneda el balance se valida **por divisa** dentro de la transacción. Se corrige el texto. Es la segunda desactualización de §8 (la otra, `formatCents` como canónico, ya está anotada como deuda).
*   **`docs/trabajo-en-vuelo.md`** — rama, estado y próximo paso, en este mismo commit.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**. Pegar la salida, no describirla:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
pnpm build
```

Referencia al abrir la ronda, sobre `e4d8cb3`: **41 archivos, 321 tests, lint 0, `tsc` 0 errores,
build verde.** Los tests nuevos deben subir el total; ninguno de los 321 debe romperse.

`pnpm test` necesita el contenedor `postgres-dev` vivo. Si muere con `ECONNREFUSED` en el setup, es
**entorno caído, no suite roja**.

Y la comprobación de datos del Paso 1, que ninguna suite cubre:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d cards"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "SELECT c.label , a.code , a.type , a.currency , a.balance FROM cards c JOIN card_accounts ca ON ca.card_id = c.id JOIN accounts a ON a.id = ca.account_id ;"
```

Las columnas monetarias tienen que salir en `bigint`. `expiry_month`, `expiry_year`, `closing_day`,
`due_day` y las dos tasas **no** son dinero y siguen en `integer`.

---

## Lo que NO entra en esta ronda

Nombrado para que no se filtre por los bordes:

*   **Intereses por financiación (§5) y comisiones automáticas (§6).** Los dos son devengamiento periódico: alguien tiene que correr el día del cierre. Ese alguien son los crons de la **Fase 3**. Se modelan las columnas —`interestRateFinancing`, `monthlyMaintenanceFee`, `annualRenewalFee`— porque agregarlas después sale caro (regla R1), pero **nada las devenga todavía**, y eso se anota como deuda en vez de simularse.
*   **Cuotas y `installmentPlans`.** Son el RFC 008, la ronda siguiente de esta misma fase. El disponible de esta ronda no las descuenta, y el §8B del RFC 007 las nombra: cuando existan, hay que volver acá a restarlas.
*   **Pago del resumen, y el arbitraje del §7C.** Pagar un saldo en dólares con pesos es una transacción de cambio, que el motor ya sabe hacer contra `3.3.01-<MONEDA>`. Cablear el flujo "pagar resumen" es su propia ronda, con su propia UI.
*   **Saldo dual ARS/USD en la interfaz.** El esquema lo soporta desde el Paso 1 —de eso se trata `card_accounts`— y el alta de esta ronda crea **una** cuenta, en la divisa de la tarjeta. La interfaz recorre las cuentas de la tarjeta, así que el día que haya dos las muestra sin cambiar una línea.
*   **Color de marca extraído de Brandfetch (§8C).** `financial_entities` ya tiene `color` y `brand_domain`, y `/api/brand` ya resuelve logos. La tarjeta usa lo que hay; no se escribe un segundo resolutor de marca.
*   **Suscripciones debitadas a tarjeta (RFC 004).** Necesita que las tarjetas existan. Es posterior, dentro de la misma fase.
