# RFC 003: División de gastos por eventos

*   **ID de la Propuesta:** 003
*   **Título:** El evento como calculadora de reparto, el recupero como único asiento, y la categorización en el libro de cada parte
*   **Estado:** `SUPERSEDED` (2026-09-21) — **no habilita código y no se va a implementar en esta aplicación.** Ver §0 bis.
*   **Fecha de Creación:** 2026-06-22 (versión original) · **Reescrito:** 2026-09-12
*   **Autor:** `tanda` (reescritura) · Antigravity (versión original de junio de 2026)
*   **Origen:** §9 de `~/Boveda/Archivo/migracion-finanzas-mock/Diseños/Rediseño de clasificación y propuestas.md`, que pedía enmendarlo porque «confirma sin categorizar». El contraste encontró que el desalineamiento no se agotaba ahí.
*   **Reemplaza:** la versión `APPROVED` del 2026-06-23 **en su totalidad**. Esa versión es anterior al core contable (RFC 018), a la migración a `bigint` (RFC 019), a la clasificación unificada (RFC 022) y al RFC 008, que modela las deudas con personas.

---

## 0 bis. Por qué este RFC no se implementa acá (decisión del usuario, 2026-09-21)

**Los eventos no son un dominio contable, y se van a una aplicación aparte.** Esta propuesta queda
`SUPERSEDED`: nada de lo que describe se construye dentro de la aplicación de finanzas.

### El razonamiento

1.  **Un evento tiene dominio propio** —participantes, exclusiones por tipo de gasto, simplificación
    de deudas— que no es contabilidad. Meterlo acá obligaba a cinco tablas en el libro mayor para
    sostener una calculadora de reparto.
2.  **Lo que el libro necesita de un evento es un solo asiento:** el recupero, cuando entra la plata
    (§5). Eso ya tiene camino: [RFC 012](012-integrations-and-api-keys.md), cuyo §1 establece la
    doctrina textual de que «mantener separada la lógica específica de otros negocios en sus propias
    aplicaciones mantiene nuestro núcleo financiero limpio, mientras que la integración vía API
    unifica la contabilidad». Su ejemplo es una app de pastelería; un repartidor de gastos es el
    mismo patrón.
3.  **Lo que el usuario quería y acá era imposible, afuera deja de serlo.** El §9 declaraba fuera de
    alcance la participación de otras personas con cuenta en la aplicación, porque **el aislamiento
    multi-tenant prohíbe que dos organizaciones se vean entre sí**. En una aplicación propia, el
    evento es un objeto compartido entre usuarios por diseño, y cada participante manda el asiento a
    *su* libro por la API. El problema no se resuelve solo: **deja de chocar contra una invariante
    del núcleo**, que es lo que lo hacía irresoluble.

### Lo que esta aplicación construye en consecuencia: nada

**Cero tablas nuevas.** El recupero de un evento externo entra por
`POST /api/v1/transactions` (RFC 012 §3) como cualquier otro asiento de partida doble: Debe la cuenta
de destino, Haber la hoja de `4.1.05 Reintegros y devoluciones`. La cuenta de destino la elige el
usuario, como en la bandeja de liquidación de `/loans`.

> **Dependencia, y está sin construir.** El RFC 012 figura `APPROVED` desde el 2026-06-23 y **no
> tiene una sola línea de código**: no existen `src/app/api/v1/`, ni la tabla `api_keys`, ni
> `integrations` —verificado contra el esquema y contra la base real el 2026-09-21—. Además es
> anterior al core contable (RFC 018), a `bigint` (RFC 019) y a la clasificación unificada (RFC 022),
> que cambió cómo se resuelve una cuenta a su hoja: su §3 asienta contra `4.1.01.01` como si fuera
> hoja. **Necesita el mismo contraste que recibieron el 008, el 010 y este mismo RFC antes de que
> nadie escriba ese endpoint.**

### Lo que se conserva, y es el motivo de no borrar este archivo

**El §4, el algoritmo de reparto, es herencia para la aplicación nueva.** Balance neto por
participante, exclusiones por `splitTag`, simplificación iterativa de deudas y el reparto del resto
de a un centavo están especificados y son correctos: se mantuvieron casi literales de la versión de
junio porque el problema nunca fue cómo repartía. **Quien escriba la app de eventos arranca de acá y
no lo vuelve a derivar.** Lo mismo vale para el §3 como modelo de datos y para el §6, la regla de que
cada parte categoriza en su propio libro, que sigue siendo verdad y ahora se cumple sola: el evento
nunca escribe en el libro de otra organización porque ya no escribe en ningún libro.

**Lo que queda obsoleto de este texto** es su §3.2 (radio de impacto sobre `schema.ts` y
`testCleanup.ts` de esta aplicación), su §7 (verificación acá) y la fila de `/contacts` de ese mismo
§3.2 — ver la decisión de abajo.

### Decisión relacionada del mismo día: `/contacts` no muestra importes

**`/contacts` es la libreta de contactos y nada más.** No lleva saldos, deudas ni netos: eso vive en
las pantallas que son sobre plata. Esto cancela el ítem «el neto por contacto» que este RFC anotaba
en su §9 y en su §3.2, y que el **§9 del [RFC 008](008-loans-and-installments.md) también deja
abierto**. Aquel RFC está `APPROVED` y **no se edita**: la discrepancia queda advertida acá y en
`trabajo-en-vuelo.md` (`~/Boveda/Proyectos/migracion-finanzas-mock/Estado.md`). Nada que deshacer en código —`/contacts` hoy no
muestra un solo importe, verificado en sus cinco componentes—: lo que cancela es trabajo futuro.

---

## 0. Contraste contra el código real (2026-09-12)

| Lo que decía la versión de junio | Lo que el repositorio ya decidió |
| :--- | :--- |
| `import { users } from "../../features/profile/schema.db"` | `users` vive en [`src/features/auth/schema.db.ts:20`](../../src/features/auth/schema.db.ts). En `profile` está `profiles`, que es otra tabla |
| Dos columnas monetarias en `integer` | `bigint` con `{mode: "number"}` desde el RFC 019 |
| `text(...)` en todas las columnas de texto | `varchar( ... , {length: N} )` en todo el esquema vigente |
| `isActive: boolean` | Baja lógica con `archivedAt: timestamp` |
| **Ninguna de las cuatro tablas tenía `organizationId`** | Regla dura de aislamiento multi-tenant (`.agents/AGENTS.md` §8.3). El RFC 008 de junio tenía el mismo defecto en una consulta; acá está en todo el esquema |
| Los participantes se modelaban contra `users` | Las personas con las que tenés relación económica son **`contacts`** ([`contacts/schema.db.ts:19`](../../src/features/contacts/schema.db.ts)). Un participante de un asado es un contacto, no una cuenta de la aplicación |
| `category: 'meat' \| 'alcohol' \| 'general'` en el gasto | **Colisión de vocabulario.** Desde el RFC 022, «categoría» en este repositorio significa **cuenta contable**. Acá se llama `splitTag` |
| §4: «La deuda contable se elimina (se archiva)» | **El libro es inmutable.** `ledgerTransactions:90-93` lo dice en el propio esquema: una transacción equivocada no se borra, **se contra-asienta** |
| `excludesMeat` y `excludesAlcohol` como columnas booleanas | Dos exclusiones fijas: cualquier tercera (sin gluten, vegano, sin lactosa) pedía una migración. Ver §3 |
| El evento no tocaba el libro en ningún momento | Ver §1 |

---

## 1. El agujero de fondo: plata repartida fuera del libro

La versión de junio calculaba deudas entre participantes, las guardaba en `event_debts` y las resolvía cambiando un `status` a `'confirmed'`. **Ese dinero nunca entraba a la contabilidad.** Pagabas ARS 50.000 de carne, te devolvían 37.500, y tu libro seguía diciendo que gastaste 50.000.

Es la misma clase de error que el `remainingBalance` del RFC 008 de junio y que el registro paralelo del RFC 010: **dinero modelado fuera del libro**.

### Lo que sí acertaba y se conserva

El algoritmo. El cálculo de balance neto por participante, las exclusiones por tipo de gasto y la simplificación de deudas para minimizar transferencias (§4) son correctos y se mantienen casi literales. **El problema nunca fue cómo repartía, sino que repartía en un libro paralelo.**

### Objetivos

1.  **El evento es una calculadora de reparto,** no un segundo libro. Su salida es quién le debe cuánto a quién.
2.  **El único asiento que emite es el recupero, al cobrar** (§5).
3.  **Cada parte categoriza en su propio libro.** Se comparte el hecho, no la categorización (§6).

### No objetivos

*   **La liquidación entre usuarios distintos de la aplicación.** Ver §9: es el supuesto que la versión de junio daba por resuelto y no lo está.
*   **Cobrar dentro de la aplicación.** El dinero se mueve por fuera; acá se registra que se movió.

---

## 2. El modelo: dónde toca el libro

**Decisión (usuario, 2026-09-12): sólo al cobrar.**

El gasto de los ARS 50.000 **ya entró al libro por el camino normal** cuando pagaste la carne — con tarjeta, por transferencia o en efectivo. El evento no lo duplica ni lo corrige: lo reparte. Recién cuando Carlos te transfiere sus ARS 12.500 se emite un asiento, y es un **recupero** (§5).

Tu gasto neto queda en 12.500 sin que ninguna pantalla tenga que restar nada.

**El costo, declarado:** entre el asado y el cobro, tu libro muestra 50.000 de gasto propio cuando 37.500 no lo son. Es real y se acepta a cambio de no acoplar el evento a `ledgerTransactions` — la alternativa exigía saber **qué transacción del libro era la carne**, y por lo tanto que el gasto estuviera cargado antes de crear el evento.

**Por qué no se apoya en el RFC 008:** `event_debts` y `loans` con `direction: 'lent'` modelan lo mismo —un contacto que te debe— y reusar el 008 habría traído gratis su bandeja de liquidación. Lo descarta un detalle de implementación, no de teoría: `loansActions.ts:141` crea **una cuenta contable `1.1.01.NN` por préstamo**. Diez asados con cuatro amigos son cuarenta cuentas en el plan. Reusarlo exigiría agrupar por contacto, que es diseño que ninguno de los dos RFC tiene hoy.

---

## 3. Esquema de base de datos

```typescript
/**
 * Un evento con gastos a repartir entre participantes.
 */
export const events = pgTable( "events" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  name:      varchar( "name" , {length: 150} ).notNull() , // Ej: "Asado Viernes"
  eventDate: date( "event_date" ).notNull() ,              // Fecha civil YYYY-MM-DD
  currency:  varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) ,
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgDateIdx: index( "events_org_date_idx" ).on( table.organizationId , table.eventDate ) ,
} ) ; } ) ;

/**
 * Participante de un evento. Es un contacto, o un invitado suelto sin ficha.
 */
export const eventParticipants = pgTable( "event_participants" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  eventId:        uuid( "event_id"        ).references( () => events.id        , {onDelete: "cascade"} ).notNull() ,

  // Exactamente uno de los dos. Un contacto tiene ficha y neto acumulable; un invitado suelto, no
  contactId: uuid( "contact_id" ).references( () => contacts.id , {onDelete: "restrict"} ) ,
  guestName: varchar( "guest_name" , {length: 100} ) ,

  // El organizador es un participante más, y es el que pagó casi siempre
  isOrganizer: boolean( "is_organizer" ).default( false ).notNull() ,

  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  eventIdx: index( "event_participants_event_idx" ).on( table.eventId ) ,
} ) ; } ) ;

/**
 * Exclusión de un participante sobre un tipo de gasto. Tabla en vez de columnas booleanas:
 * una restricción nueva no debe costar una migración.
 */
export const eventExclusions = pgTable( "event_exclusions" , {
  id:            uuid( "id"             ).primaryKey().defaultRandom() ,
  participantId: uuid( "participant_id" ).references( () => eventParticipants.id , {onDelete: "cascade"} ).notNull() ,
  splitTag:      varchar( "split_tag" , {length: 40} ).notNull() , // Ej: "meat", "alcohol", "gluten"
} , ( table ) => { return( {
  uniqueParticipantTag: uniqueIndex( "event_exclusions_participant_tag_unique" ).on( table.participantId , table.splitTag ) ,
} ) ; } ) ;

/**
 * Gasto del evento. NO emite asiento: el gasto ya entró al libro por su camino normal (§2).
 */
export const eventExpenses = pgTable( "event_expenses" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id       , {onDelete: "cascade"} ).notNull() ,
  eventId:        uuid( "event_id"        ).references( () => events.id              , {onDelete: "cascade"} ).notNull() ,
  paidBy:         uuid( "paid_by"         ).references( () => eventParticipants.id   , {onDelete: "restrict"} ).notNull() ,

  description: varchar( "description" , {length: 255} ).notNull() ,
  amount:      bigint( "amount" , {mode: "number"} ).notNull() , // Centavos
  splitTag:    varchar( "split_tag" , {length: 40} ).default( "general" ).notNull() ,

  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  eventIdx: index( "event_expenses_event_idx" ).on( table.eventId ) ,
} ) ; } ) ;

/**
 * Deuda consolidada entre dos participantes, salida del algoritmo de simplificación (§4).
 * Nunca se borra: se resuelve emitiendo el asiento de recupero y guardando su id.
 */
export const eventDebts = pgTable( "event_debts" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id     , {onDelete: "cascade"} ).notNull() ,
  eventId:        uuid( "event_id"        ).references( () => events.id            , {onDelete: "cascade"} ).notNull() ,
  debtorId:       uuid( "debtor_id"       ).references( () => eventParticipants.id , {onDelete: "restrict"} ).notNull() ,
  creditorId:     uuid( "creditor_id"     ).references( () => eventParticipants.id , {onDelete: "restrict"} ).notNull() ,

  amount: bigint( "amount" , {mode: "number"} ).notNull() , // Centavos
  status: varchar( "status" , {length: 20} ).default( "pending" ).notNull() , // 'pending' | 'sent' | 'confirmed'

  // El asiento de recupero que saldó esta deuda. La guarda de idempotencia: si está, ya se cobró
  settledTransactionId: uuid( "settled_transaction_id" ).references( () => ledgerTransactions.id , {onDelete: "restrict"} ) ,
  settledAt:            timestamp( "settled_at" , {withTimezone: true} ) ,

  updatedAt: timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  eventStatusIdx: index( "event_debts_event_status_idx" ).on( table.eventId , table.status ) ,
} ) ; } ) ;
```

### 3.1 Decisiones de esquema y su fundamento

*   **`organizationId` en las cuatro tablas principales.** `eventExclusions` es la excepción deliberada: cuelga de `eventParticipants` con `cascade` y nunca se consulta sin su participante, igual que `card_accounts` y `loan_accounts`, que tampoco lo llevan.
*   **`contactId` o `guestName`, exactamente uno.** Validación en el esquema Zod, como la contraparte de `loans` (`entityId` / `contactId`, §4.1 del RFC 008). Un participante con ficha acumula neto en `/contacts`; un invitado suelto, no.
*   **`splitTag`, no `category`.** Desde el RFC 022 «categoría» significa cuenta contable, y este campo no lo es.
*   **`eventExclusions` es tabla, no columnas.** La versión de junio hardcodeaba `excludesMeat` y `excludesAlcohol`; la tercera restricción costaba una migración. Con tabla, agregar «sin gluten» es una fila.
*   **`settledTransactionId` reemplaza al borrado.** Es la guarda de idempotencia —si está, la deuda ya se cobró— y el rastro auditable hacia el asiento. Mismo rol que `resolvedThrough` en el RFC 023, y `onDelete: "restrict"` porque el libro es inmutable.

### 3.2 Radio de impacto

| Archivo | Qué hay que hacer |
| :--- | :--- |
| [`src/shared/db/schema.ts`](../../src/shared/db/schema.ts) | Re-exportar las cinco tablas |
| [`src/shared/db/testCleanup.ts`](../../src/shared/db/testCleanup.ts) | `limpiarBase()`: `event_debts` y `event_expenses` **antes** de `event_participants`; `event_exclusions` antes también; `event_participants` antes de `events` y de `contacts`; y todo antes de `ledger_transactions` (FK `restrict` desde `event_debts`). **Los comentarios numeran del 1 al 19: insertar cinco tablas renumera todos los siguientes.** Anclas textuales, no números |
| [`initialCatalog.ts`](../../src/features/accounting/constants/initialCatalog.ts) | **Nada.** `4.1.05 Reintegros y devoluciones` ya existe (`:220`) |
| `/contacts` | El neto por contacto que el §9 del RFC 008 dejó abierto pasa a tener una segunda fuente. Ver §9 |

---

## 4. Algoritmo de reparto

Se conserva de la versión de junio, que lo tenía bien.

1.  **Costo por participante.** Cada gasto se divide entre los participantes **elegibles**: los que no tienen una fila en `eventExclusions` con el `splitTag` de ese gasto. Un gasto con `splitTag = "general"` se divide entre todos.
2.  **Balance neto** de cada participante: `total pagado − total consumido`. Positivo es acreedor; negativo, deudor.
3.  **Simplificación.** Se emparejan iterativamente el deudor máximo con el acreedor máximo por el menor de los dos importes, hasta que todos los balances quedan en cero. Minimiza la cantidad de transferencias.
4.  El resultado se escribe en `event_debts` con `status = 'pending'`.

**Invariante aritmética:** la suma de los balances netos es exactamente cero, y la suma de las deudas generadas es exactamente la suma de los balances negativos. **Todo en centavos enteros**, con el resto de la división repartido de a un centavo entre los primeros participantes: dividir 10.000 entre 3 da 3.334 / 3.333 / 3.333, nunca tres veces 3.333,33. Tiene caso de prueba propio (§8.2).

---

## 5. El asiento: el recupero

Sólo se emite uno, y sólo al confirmar el cobro. Carlos te transfiere sus ARS 12.500 a la caja de ahorro:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| `1.1.01.01 Caja de Ahorro` (asset, ARS) | 1250000 | 0 |
| Cuenta de `4.1.05 Reintegros y devoluciones` (revenue, ARS) | 0 | 1250000 |

*   **`4.1.05` ya existe en el catálogo inicial** (`initialCatalog.ts:220`) y **no tiene subcategorías**, así que la cuenta se resuelve por `resolveToLeaf()`, que cae en su hoja `General` (`.99`) — el mismo camino que el RFC 008 usa para `4.1.04` en los intereses de un préstamo dado. **Respaldo obligatorio:** `findOrCreateTypeGeneralLeaf( type )`, porque el catálogo inicial **sólo lo aplica `seed.ts`** y una organización creada por fuera puede no tenerlo.
*   **La cuenta de destino la elige el usuario** al confirmar, como en la bandeja de liquidación de `/loans`: la acción exige un `paymentAccountId` explícito.
*   **El asiento y el cambio de `status` van en la misma transacción ACID**, con `settledTransactionId` escrito en la misma operación. Una deuda `confirmed` sin `settledTransactionId` es un defecto.
*   **Rechazar un pago no borra nada:** vuelve `status` a `'pending'`. Si ya había asiento —no debería, pero si un defecto lo produjo— se **contra-asienta** con el circuito de reversión que `ledgerTransactions` ya tiene (`reversesTransactionId` / `reversedAt`). Nunca se borra.

---

## 6. Cada parte categoriza en su propio libro

**Ésta es la enmienda que pedía el §9 de la sesión de diseño, y es una regla, no una opción.**

Carlos te devuelve lo de la cena. En **tu** libro eso es un **recupero** (`4.1.05`, §5). En el libro de **Carlos** es una **salida** — probablemente `5.1.xx Restaurantes`, pero eso lo decide él.

**Se comparte el hecho, no la categorización.** El evento registra que Carlos te pagó ARS 12.500 el día tal. Cómo lo clasifica cada parte es asunto de cada libro, y ninguna de las dos clasificaciones se propaga a la otra.

Esto vale aunque algún día los dos usen la aplicación: el hecho es común, la cuenta contable es de cada organización. Un evento **nunca** escribe en el libro de otra organización.

---

## 7. Verificación

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d event_expenses"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d event_debts"
```

`amount` debe figurar como `bigint` en las dos.

---

## 8. Casos de prueba que este RFC exige

1.  **Exclusión por tag:** un gasto `meat` de 40.000 con cuatro participantes, uno de ellos excluido, se divide entre tres.
2.  **Resto en centavos:** 10.000 entre 3 da 3.334 / 3.333 / 3.333. La suma es exactamente el total.
3.  **Simplificación:** cuatro participantes con balances cruzados producen la cantidad mínima de deudas, y la suma de deudas iguala la suma de balances negativos.
4.  **Confirmar un cobro** emite el asiento de recupero, escribe `settledTransactionId` y deja `status = 'confirmed'`, todo en la misma transacción.
5.  **Confirmar dos veces la misma deuda** no emite un segundo asiento: `settledTransactionId` ya está.
6.  **Rechazar** vuelve a `'pending'` y no borra ninguna fila.
7.  **Sin `4.1.05` en la organización:** `findOrCreateTypeGeneralLeaf` resuelve y el asiento se emite igual.
8.  **Aislamiento multi-tenant:** un evento de otra organización no se lee, no se reparte y no se liquida.
9.  **Participante con `contactId` y `guestName` a la vez**, o con ninguno de los dos: rechazado por el esquema Zod.

---

## 9. Lo que este RFC deja abierto

*   **La liquidación entre usuarios distintos de la aplicación.** La versión de junio daba esto por resuelto: su §4 describía al deudor viendo una notificación en **su** dashboard y al acreedor confirmando desde el suyo. **Eso supone que dos organizaciones distintas se ven entre sí, y el modelo multi-tenant no lo permite.** Esta reescritura modela el evento **desde el lado del organizador**: los participantes son contactos suyos, y la confirmación la hace él cuando le entra la plata. Un flujo real entre dos usuarios necesita un modelo de compartición entre organizaciones que el repositorio no tiene, y es propuesta propia.
*   **El neto por contacto en `/contacts`.** El §9 del RFC 008 ya lo dejó abierto para las deudas de préstamo; este RFC le suma una segunda fuente. Cuando se escriba esa propuesta tiene que sumar las dos, o mostrará la mitad del cuadro.
*   **El gasto bruto entre el asado y el cobro.** Ver §2: es el costo aceptado de no acoplar el evento a `ledgerTransactions`. La pantalla del evento puede mostrar el neto proyectado; el libro, mientras tanto, muestra el bruto.
*   **Copiar el alias del acreedor**, que la versión de junio detallaba en su §4. Los datos ya están: `contact_payment_methods`, y `accounts` tiene `cbuCvu` y `alias` (`accounting/schema.db.ts:58-59`). Es diseño de interfaz y se decide en el plan de ejecución.
*   **Eventos en más de una divisa.** Hoy el evento tiene una `currency` y todos sus gastos van en ella. Un asado con compras en dos monedas necesita el reparto por divisa, y el asiento de recupero ya lo exige: Debe = Haber se valida **por divisa**.
