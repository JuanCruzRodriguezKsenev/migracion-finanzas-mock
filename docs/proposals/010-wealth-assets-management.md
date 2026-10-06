# RFC 010: Patrimonio físico

*   **ID de la Propuesta:** 010
*   **Título:** `wealth_assets` como instrumento patrimonial, su cuenta de activo en el libro, y el revalúo contra reserva de patrimonio
*   **Estado:** `DRAFT` — **no habilita código hasta que el usuario lo apruebe.** Reescritura completa.
*   **Fecha de Creación:** 2026-06-22 (versión original) · **Reescrito:** 2026-09-12
*   **Autor:** `tanda` (reescritura) · Antigravity (versión original de junio de 2026)
*   **Origen:** decisión 3 del §4 de `~/Boveda/Archivo/migracion-finanzas-mock/Diseños/Rediseño de clasificación y propuestas.md`, que dejó pedido este contraste y anotó que «no hay que escribirle propuesta nueva, hay que contrastarlo».
*   **Reemplaza:** la versión `APPROVED` del 2026-06-23 **en su totalidad**. Esa versión es anterior al core contable (RFC 018), a la migración a `bigint` (RFC 019), al circuito de recurrencias (RFC 023) y a la doctrina de instrumentos del RFC 024.
*   **Escisión:** **inquilinos e incidencias salen de este RFC.** Ver §8.

---

## 0. Contraste contra el código real (2026-09-12)

**La versión de junio no se corrige: se descarta.** El contraste empezó buscando el tipo de las columnas monetarias y encontró dos agujeros estructurales debajo. Esta tabla existe para que la reescritura no repita ninguno.

| Lo que decía la versión de junio | Lo que el repositorio ya decidió |
| :--- | :--- |
| `import { contacts } from "./schema"` | `contacts` vive en [`src/features/contacts/schema.db.ts:19`](../../src/features/contacts/schema.db.ts). No existe ningún `./schema`: el esquema es por feature |
| **Cuatro** columnas monetarias en `integer`: `purchase_price`, `value`, `rent_amount` y `cost` | `bigint` con `{mode: "number"}` desde el RFC 019. **Dos de las cuatro se van con la escisión** (§8), así que al núcleo le tocan `purchase_price` y `value` |
| `square_meters` y `year`, también en `integer` | **Correcto y se conserva:** no son dinero. Mismo criterio que `interval_count` y `attempts` |
| **Importaba `doublePrecision`** en la línea 28 | Punto flotante para dinero es regla dura violada. **No llegaba a usarlo**, que es peor que usarlo: queda como invitación dentro de un texto que estuvo `APPROVED` quince meses |
| `text("name")`, `text("type")`, `text("status")` | `varchar( ... , {length: N} )` en todo el esquema vigente. Comparar con [`loans/schema.db.ts:26-32`](../../src/features/loans/schema.db.ts) |
| `isActive: boolean` | Baja lógica con `archivedAt: timestamp` ([`loans/schema.db.ts:50`](../../src/features/loans/schema.db.ts)) |
| `organizationId` **sólo en la tabla padre** | Regla dura de aislamiento multi-tenant (`.agents/AGENTS.md` §8.3) |
| §3 escribía los asientos con signos: `Haber: Tu Cuenta Bancaria (Activo) -> -$40.000` | Las columnas de [`ledgerEntries`](../../src/features/accounting/schema.db.ts) son `debit` y `credit`, **siempre positivas** (`:111-112`). La notación con signos invita a implementar la partida doble al revés |
| «Esta transacción se vincula al ID del activo en `wealth_assets`» | **`ledgerTransactions` no tiene ninguna columna de instrumento** (`:82-102`). El vínculo entre un movimiento y su instrumento **es la cuenta contable** |
| El activo nunca entraba al libro | Ver §1. Es el agujero de fondo, y el que obliga a reescribir en vez de enmendar |

**Nota sobre el conteo, que estaba mal en todas partes:** tres documentos decían que este RFC tenía **siete** columnas monetarias en `integer` — el [RFC 024 §9](024-instruments-and-entity-navigation.md) (`:297`), la sesión de diseño (`:301` y `:448`) y el doc de estado. **Son cuatro.** El número se propagó de documento en documento sin que nadie lo contara contra el archivo, que es la versión pequeña del mismo problema que este RFC corrige: escribir una afirmación sobre el código sin abrir el código. **El RFC 024 no se corrige: es texto `APPROVED` y no se edita** — la discrepancia queda advertida acá, que es el mismo tratamiento que el plan del RFC 008 le dio a los pasos corridos de su §4.2. La sesión de diseño y el doc de estado sí se corrigen al cerrar esta ronda.

**Por qué importa que estuviera `APPROVED`:** la regla dura del repositorio es «código sólo contra RFC `APPROVED`». Mientras ese texto tuvo ese sello, autorizaba formalmente a implementar el esquema equivocado. La trampa ya se cobró el RFC 006 y el RFC 015, y el §0 del RFC 008 la documentó por tercera vez. **Esta reescritura baja el sello a `DRAFT` deliberadamente:** un texto en `DRAFT` no autoriza nada, que es mejor que un texto aprobado que autoriza lo incorrecto.

---

## 1. El agujero de fondo: un departamento que no existe para el patrimonio

La versión de junio modelaba el activo físico como un **registro paralelo**. Guardaba su precio de compra y su historial de valuaciones en tablas propias, y conectaba con la contabilidad sólo a través de los movimientos de alquiler y mantenimiento.

**Consecuencia:** un departamento de USD 100.000 no aparecía en el patrimonio neto. `AccountsContainer.tsx:97-98` calcula el patrimonio sumando `accounts.balance` por tipo, y ese departamento no tiene cuenta. La página de patrimonio habría mostrado un número y el libro otro, para siempre.

Es la misma clase de error que el `remainingBalance` del RFC 008 de junio: **dinero modelado fuera del libro**. El repositorio ya lo rechazó tres veces —tarjetas (RFC 007), préstamos (RFC 008) y cuotas (RFC 025)— y el RFC 024 §4 lo dejó escrito como doctrina general: *«el patrón `cards` → `card_accounts` del RFC 007 es el que se repite para todo instrumento que venga: el instrumento en su tabla, su reflejo en el libro»*.

**Un activo físico es un instrumento. Entra al libro.**

### Objetivos

1.  **El activo existe en el libro** como cuenta de tipo `asset`, de modo que el patrimonio neto lo incluya sin que ninguna pantalla tenga que sumarlo aparte.
2.  **Historial de valuaciones** que mueva el patrimonio, con la revalorización asentada **contra una reserva de patrimonio** y no contra resultados (§4C).
3.  **Soporte multimedia**: referencias a imágenes del activo.

### No objetivos

*   **Inquilinos y contratos de alquiler.** Escindidos: ver §8.
*   **Bitácora de incidencias y mantenimiento.** Escindida: ver §8.
*   **Cálculo de rentabilidad (cap rate).** Necesita las dos anteriores para tener numerador. Se va con ellas.
*   **Depreciación y amortización de activos.** Fuera de alcance; ver §8.

---

## 2. El modelo

### 2.1 El vínculo con el libro es una columna, no una tabla puente

**Éste es el único punto donde este RFC se aparta del RFC 024 §4, y se aparta a propósito.**

`card_accounts` y `loan_accounts` existen porque una tarjeta acumula deuda **en ARS y USD a la vez**, sobre un motor que exige una única divisa por cuenta contable. Un activo físico no tiene esa propiedad: tiene un valor, en una divisa.

Y si un mismo departamento tuviera dos cuentas espejo, **entraría dos veces en el patrimonio neto**. Con una tabla puente esa prohibición viviría sólo en un párrafo y en una validación de la acción: el índice `unique (assetId, currency)` de los otros dos instrumentos **no** impide la segunda fila, porque dos divisas distintas lo satisfacen.

**Decisión (usuario, 2026-09-12):** `wealth_assets.accountId` es una columna `uuid` con FK a `accounts`, cardinalidad 1:1. El doble conteo queda imposible por construcción en vez de prohibido por documentación. En un sistema cuyo valor central es la corrección contable, eso vale más que la simetría con los otros dos instrumentos.

**El costo, declarado:** el filtro de cuentas espejo de `AccountsContainer` necesita un tercer camino además de los de tarjetas y préstamos. Está en el radio de impacto (§3.2).

### 2.2 El activo no guarda su valor actual

`wealth_assets` guarda `purchasePrice`, que es **dato histórico inmutable**, igual que `loans.principalAmount`. El valor vigente **no se guarda en el activo**: es el `balance` de su cuenta contable, que empieza en el precio de compra y se mueve con cada revalúo asentado.

`wealth_asset_valuations` es el **historial**, no la fuente de verdad del valor: existe para graficar la tendencia y para dejar rastro de quién dijo qué y cuándo. La fuente de verdad es el libro. Una columna `currentValue` paralela se desincronizaría en cuanto hubiera un revalúo corregido o un contra-asiento — que es exactamente lo que le pasó al `remainingBalance` del 008 de junio.

### 2.3 El código de cuenta sale de `getNextCode`, sin tocarlo

**Decisión (usuario, 2026-09-12):** la cuenta del activo nace con `getNextCode( "asset" , todasLasCuentas )`, que hoy emite `1.1.01.NN` ([`accountCodes.ts:16-25`](../../src/features/accounting/utils/accountCodes.ts)). Es exactamente lo que hacen los dos instrumentos que ya existen (`cardsActions.ts:139`, `loansActions.ts:141`), y un préstamo **dado** —que es un activo— ya vive en ese cajón.

Contablemente un inmueble es activo **no** corriente y debería nacer en `1.2.xx`. **El repositorio no distingue corriente de no corriente para nadie todavía**, así que usar `1.1.01.NN` mantiene la regla vigente en vez de abrir una excepción. Ningún cálculo se ve afectado: el patrimonio neto suma por tipo y signo, nunca por código. El costo es de presentación —la pestaña Plan contable de `/settings` muestra el departamento al lado de la caja de ahorro— y **se anota como deuda**, no se resuelve acá: hacerlo obligaría a decidir en la misma tanda si un préstamo a cinco años también se muda, tocando `accountCodes.ts`, sus dos llamadas de `accountingActions.ts:95` y `:229`, su test, y los préstamos recién consolidados.

---

## 3. Esquema de base de datos

```typescript
/**
 * Esquema de la tabla para Patrimonio físico (inmuebles, vehículos y otros activos no financieros).
 * El valor vigente NO vive acá: es el balance de la cuenta contable vinculada (§2.2).
 */
export const wealthAssets = pgTable( "wealth_assets" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  name: varchar( "name" , {length: 150} ).notNull() , // Ej: "Departamento Palermo"
  type: varchar( "type" , {length: 20 } ).notNull() , // 'real_estate' | 'vehicle' | 'other'

  // La cuenta de activo del libro. 1:1, NO tabla puente (§2.1)
  accountId: uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,

  // Precio de compra en centavos. Dato histórico inmutable, NO es el valor actual
  purchasePrice: bigint( "purchase_price" , {mode: "number"} ).notNull() ,
  currency:      varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,
  acquiredAt:    date( "acquired_at" ) , // Fecha civil de adquisición YYYY-MM-DD

  // Detalles de inmueble
  address:      varchar( "address" , {length: 255} ) ,
  squareMeters: integer( "square_meters" ) , // NO es dinero: integer es correcto

  // Detalles de vehículo
  brand:        varchar( "brand"         , {length: 80} ) ,
  model:        varchar( "model"         , {length: 80} ) ,
  year:         integer( "year" ) ,          // NO es dinero
  licensePlate: varchar( "license_plate" , {length: 20} ) ,

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgTypeIdx:      index( "wealth_assets_org_type_idx" ).on( table.organizationId , table.type ) ,
  uniqueAccountId: uniqueIndex( "wealth_assets_account_unique" ).on( table.accountId ) ,
} ) ; } ) ;

/**
 * Historial de valuaciones. Rastro y línea de tendencia, NO fuente de verdad del valor (§2.2).
 * Cada fila corresponde a un asiento de revalúo ya emitido.
 */
export const wealthAssetValuations = pgTable( "wealth_asset_valuations" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  assetId:        uuid( "asset_id"        ).references( () => wealthAssets.id  , {onDelete: "cascade"} ).notNull() ,

  value:         bigint( "value" , {mode: "number"} ).notNull() , // Valuación en centavos
  currency:      varchar( "currency" , {length: 10} ).notNull() ,
  valuationDate: date( "valuation_date" ).notNull() , // Fecha civil YYYY-MM-DD
  source:        varchar( "source" , {length: 150} ) , // Ej: "Tasación Zonaprop", "Estimación propia"

  // El asiento que esta valuación emitió. Null sólo en la valuación de apertura
  transactionId: uuid( "transaction_id" ).references( () => ledgerTransactions.id , {onDelete: "restrict"} ) ,

  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  assetDateIdx: index( "wealth_valuations_asset_date_idx" ).on( table.assetId , table.valuationDate ) ,
} ) ; } ) ;

/**
 * Imágenes asociadas a un activo.
 */
export const wealthAssetImages = pgTable( "wealth_asset_images" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  assetId:        uuid( "asset_id"        ).references( () => wealthAssets.id  , {onDelete: "cascade"} ).notNull() ,

  imageUrl:    varchar( "image_url"   , {length: 500} ).notNull() ,
  description: varchar( "description" , {length: 150} ) ,
  createdAt:   timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;
```

### 3.1 Decisiones de esquema y su fundamento

*   **`organizationId` en las tres tablas**, no sólo en el padre. Regla dura de aislamiento multi-tenant: toda consulta filtra por `organizationId` sin tener que pasar por un `join` al padre.
*   **`uniqueIndex` sobre `accountId`**: una cuenta contable pertenece a un solo activo. Es la mitad de la garantía del §2.1; la otra mitad es que la columna sea `notNull`.
*   **`squareMeters` y `year` siguen en `integer`** y está bien: **no son dinero.** Es el mismo criterio que la ficha de proyecto aplica a `interval_count` y `attempts`.
*   **`valuationDate` y `acquiredAt` son `date` civil**, no `timestamp`. Una tasación ocurre un día, no en un instante con zona horaria. Mismo criterio que `firstInstallmentDate` en `loans`.
*   **`transactionId` en la valuación** es lo que hace auditable el revalúo: permite ir de la fila al asiento que movió el patrimonio. `onDelete: "restrict"` porque el libro es inmutable.

### 3.2 Radio de impacto

Lo que este esquema obliga a tocar fuera de la feature. **Lo que un plan no nombra es donde aparecen los defectos:**

| Archivo | Qué hay que hacer |
| :--- | :--- |
| [`src/shared/db/schema.ts`](../../src/shared/db/schema.ts) | Re-exportar las tres tablas nuevas |
| [`src/shared/db/testCleanup.ts`](../../src/shared/db/testCleanup.ts) | `limpiarBase()`: insertar `wealth_asset_images` y `wealth_asset_valuations` **antes** de `wealth_assets`, y `wealth_assets` **antes** de `accounts` (FK `restrict`) y de `ledger_transactions` (FK `restrict` desde la valuación). Hoy `loan_accounts` es el paso 10 y `loans` el 11. **Los comentarios numeran del 1 al 19: insertar tres tablas renumera todos los siguientes.** Usar anclas textuales, no números |
| [`AccountsContainer.tsx:87-92`](../../src/features/accounting/components/AccountsContainer.tsx) | Un tercer conjunto `wealthAccountIds` junto a `cardAccountIds` y `loanAccountIds` |
| `AccountsContainer.tsx:338-339` | El filtro de cuentas de la entidad excluye hoy `cardAccountIds` y `loanAccountIds`. Sumar el tercero, o la cuenta `1.1.01.NN` del departamento se ve como cuenta contable cruda |
| `AccountsContainer.tsx:74` y `:97` | **Verificar y no romper:** `walletAccounts` filtra `asset`/`liability` y `totalAssets` los suma. La cuenta del activo **debe** seguir contando para el patrimonio neto aunque se excluya de la lista visible. Son dos filtros distintos y es el lugar donde es fácil equivocarse |
| [`initialCatalog.ts`](../../src/features/accounting/constants/initialCatalog.ts) | **Nada.** La reserva de revalúo es una cuenta de `accounts`, no una categoría (§4C) |

---

## 4. Flujos contables

**Las columnas `debit` y `credit` son siempre positivas.** Ningún asiento de este RFC se escribe con signo.

### A. Alta de un activo preexistente

El departamento ya era tuyo cuando empezaste a usar la aplicación. Por USD 100.000:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| `1.1.01.NN Departamento Palermo` (asset, USD) | 10000000 | 0 |
| `3.1.01.01 Patrimonio Neto Inicial` (equity, USD) | 0 | 10000000 |

Es el **espejo exacto** del asiento de apertura de una tarjeta con deuda preexistente (`patterns.md` §7.4: *Debe Patrimonio Neto / Haber Tarjeta*). Allí el pasivo reduce el patrimonio; acá el activo lo aumenta.

**Reuso obligatorio:** la cuenta de patrimonio se resuelve como ya lo hace [`cardsActions.ts:112`](../../src/features/cards/actions/cardsActions.ts) — busca `code === "3.1.01.01"` **con respaldo `type === "equity"`**, porque `3.1.01.01 Patrimonio Neto Inicial` la crea [`seed.ts:373-378`](../../src/shared/db/seed.ts) y una organización creada por fuera del seed puede no tenerla.

### B. Alta de un activo comprado con dinero de la aplicación

Comprás el auto por ARS 15.000.000 pagando desde tu caja de ahorro:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| `1.1.01.NN Ford Focus` (asset, ARS) | 1500000000 | 0 |
| `1.1.01.01 Caja de Ahorro` (asset, ARS) | 0 | 1500000000 |

**No toca el patrimonio neto, y es correcto que no lo toque:** cambiaste plata por auto. El patrimonio es el mismo; cambió su composición. Es el control que distingue este flujo del A.

### C. Revalúo

El departamento pasa de USD 100.000 a USD 125.000.

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| `1.1.01.NN Departamento Palermo` (asset, USD) | 2500000 | 0 |
| `3.1.01.NN Reserva por revalúo` (equity, USD) | 0 | 2500000 |

**Decisión (usuario, 2026-09-12): el revalúo va contra patrimonio, nunca contra resultados.** Es lo que hace la contabilidad real —el superávit de revaluación va a patrimonio, no a la cuenta de resultados— y acá tiene además una consecuencia concreta: si fuera contra una cuenta de ingreso (`4.x`), esos USD 25.000 aparecerían como **ingreso del mes** en la página de estadísticas, sumados al donut de ingresos y a la tasa de ahorro junto con plata que sí cobraste. Serían USD 25.000 que no entraron a ninguna cuenta distorsionando las cinco métricas de esa pantalla.

**La cuenta de reserva se crea on-demand con `getNextCode( "equity" , ... )`.** Su prefijo de `equity` es `3.1.01.` (`accountCodes.ts:20`), así que el generador la emitirá como `3.1.01.NN`: **este RFC no fija el número**, porque fijarlo contradiría al generador. Se resuelve por nombre con el mismo patrón de respaldo del flujo A.

**Una baja de valuación es el asiento inverso** (Debe Reserva / Haber Activo), con las mismas dos cuentas. La reserva puede quedar deudora si el activo vale menos que su precio de compra; eso es correcto y no requiere cuenta aparte.

### D. Invariantes de emisión

1.  **Debe = Haber por divisa**, dentro de la transacción ACID. Un activo en USD emite sus dos patas en USD.
2.  **El asiento y la fila de `wealth_asset_valuations` se escriben en la misma transacción.** Una valuación sin `transactionId` que no sea la de apertura es un defecto.
3.  **El revalúo asienta la diferencia, no el valor nuevo.** Asentar 12500000 en vez de 2500000 duplica el activo. Es el error más probable de este RFC y por eso tiene caso de prueba propio (§7.4).
4.  **Bloqueo pesimista (`FOR UPDATE`) sobre la cuenta del activo** antes de calcular la diferencia, como en `loansActions.ts`. Dos revalúos simultáneos sin bloqueo producen un patrimonio incorrecto.

---

## 5. Lo que la interfaz muestra

La ruta y su diseño se deciden en el plan de ejecución, no acá. Este RFC fija sólo lo que la pantalla **no** puede hacer:

*   **No suma la última valuación al patrimonio neto.** El patrimonio ya la contiene, porque el revalúo movió la cuenta. Sumarla aparte es doble conteo, y es el error que este modelo existe para evitar.
*   **No muestra la cuenta `1.1.01.NN` como cuenta suelta** en el detalle de entidad de `/accounts` (RFC 024 §4). Se presenta como activo: nombre, tipo, valor vigente y tendencia.
*   **La línea de tendencia sale de `wealth_asset_valuations`**, que es para lo que ese historial existe.

---

## 6. Verificación

La batería completa de la ficha de proyecto, con `postgres-dev` vivo:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

Y el contraste del esquema contra la base real, que es lo que detecta una columna monetaria mal tipada:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d wealth_assets"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d wealth_asset_valuations"
```

`purchase_price` y `value` deben figurar como `bigint`. `square_meters` y `year`, como `integer`.

---

## 7. Casos de prueba que este RFC exige

1.  **Alta preexistente:** el patrimonio neto aumenta exactamente en el precio de compra.
2.  **Alta comprada con dinero propio:** el patrimonio neto **no cambia**; la caja baja y el activo sube.
3.  **Alta sin `3.1.01.01` en la organización:** el respaldo `type === "equity"` resuelve y el asiento se emite igual.
4.  **Revalúo al alza:** se asienta **la diferencia**. El balance del activo queda en el valor nuevo, no en la suma de los dos.
5.  **Revalúo a la baja:** asiento inverso; la reserva puede quedar deudora sin romper Debe = Haber.
6.  **Revalúo en una divisa distinta de la del activo:** rechazado. Una cuenta contable tiene una sola divisa.
7.  **Aislamiento multi-tenant:** un activo de otra organización no se lee ni se revalúa.
8.  **Un `accountId` ya usado por otro activo** viola `wealth_assets_account_unique`.
9.  **Archivar un activo** no borra su cuenta ni sus asientos: el libro es inmutable.

---

## 8. Lo que este RFC deja abierto

*   **Inquilinos y contratos de alquiler.** Escindidos a propuesta propia. **No son una tabla, son una feature:** un contrato tiene cobros periódicos con frecuencia, y eso es el motor de recurrencias del RFC 023 completo —`ocurrenciaN`, puntero `resolvedThrough`, bandeja de propuestas—, el mismo que usan suscripciones, préstamos y cuotas de tarjeta. Modelarlo con un `paymentFrequency` suelto, como hacía la versión de junio, sería una cuarta implementación paralela del mismo circuito. La cuenta de ingreso ya existe: `4.1.03.01 Alquileres` ([`initialCatalog.ts:205`](../../src/features/accounting/constants/initialCatalog.ts)).
*   **Bitácora de incidencias y mantenimiento.** Escindida. Cada incidencia resuelta es un gasto contra la cuenta del activo; la categoría de gasto ya existe (`5.1.01.01 Alquiler` y la familia `5.x`). Es simple, pero sin inquilinos no completa nada: el cap rate necesita el numerador de ingresos.
*   **El cálculo de rentabilidad (cap rate)** que el §4 de la versión de junio especificaba. Se va con las dos anteriores, porque necesita las dos. **Queda declarado acá para que no se pierda**, que es lo que le pasó al RFC 006.
*   **Depreciación y amortización.** Un vehículo pierde valor por uso, no sólo por mercado. Contablemente es un gasto periódico contra una cuenta de amortización acumulada, no un revalúo contra patrimonio. El esquema lo soporta sin cambios pero el circuito no está especificado.
*   **Activo corriente vs. no corriente en el plan de cuentas.** Ver §2.3. **Deuda declarada, no resuelta.**
*   **La convención de signo de `monthly_summaries`** (§9 del RFC 024). Este RFC no la toca, pero un activo físico cambia el patrimonio neto y esa tabla lo fotografía con los pasivos en positivo. Pertenece a la propuesta de estadísticas.
*   **Valuación en una divisa distinta de la de compra.** Un departamento comprado en USD que quieras ver en ARS necesita conversión, y la conversión de divisas no está resuelta en el repositorio. Hoy: la cuenta tiene una divisa y la valuación va en esa misma divisa (§7.6).
