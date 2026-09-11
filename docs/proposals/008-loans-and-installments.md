# RFC 008: Préstamos y deudas con terceros

*   **ID de la Propuesta:** 008
*   **Título:** `loans` como instrumento bidireccional, su reflejo en el libro por divisa, y `/loans` como vista transversal
*   **Estado:** `APPROVED` (2026-09-11 — aprobado por el usuario. Habilita código contra este texto) — **reescritura completa.**
*   **Fecha de Creación:** 2026-06-22 (versión original) · **Reescrito:** 2026-09-11
*   **Autor:** `tanda` (reescritura) · Antigravity (versión original de junio de 2026)
*   **Origen:** §7 de [`docs/diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md), que dejó pedida esta reescritura, y §9 del [RFC 024](024-instruments-and-entity-navigation.md), que la nombra como bloqueante de `/loans`.
*   **Reemplaza:** la versión `APPROVED` del 2026-06-23 **en su totalidad**. Esa versión es anterior al core contable (RFC 018), a la migración a `bigint` (RFC 019) y al circuito de recurrencias (RFC 023).
*   **Escisión:** las **compras en cuotas con tarjeta** salen de este RFC y pasan al [**RFC 025**](025-card-installment-plans.md), escrito el mismo día. Pertenecen a `/cards`, no a `/loans`: una compra en 12 cuotas se paga con la tarjeta, entra en su ciclo de cierre y su deuda ya vive en la cuenta de pasivo de esa tarjeta. El nombre del archivo conserva `-and-installments` para no romper los dos enlaces existentes ([`ROADMAP.md:17`](../ROADMAP.md) y [`trabajo-en-vuelo.md:61`](../trabajo-en-vuelo.md)); el título del RFC es el que manda.

---

## 0. Contraste contra el código real (2026-09-11)

**La versión de junio no se corrige: se descarta.** Está desalineada en seis puntos verificados, no sólo en el tipo de las columnas monetarias. Esta tabla existe para que la reescritura no repita ninguno:

| Lo que decía la versión de junio | Lo que el repositorio ya decidió |
| :--- | :--- |
| `import { cards } from "../../features/accounts/schema.db"` | `cards` vive en [`src/features/cards/schema.db.ts`](../../src/features/cards/schema.db.ts). La feature `accounts` **nunca existió**: el directorio es `accounting` |
| `loans.remainingBalance` como capital adeudado | [`patterns.md`](../patterns.md) §7: el instrumento **no guarda dinero**. El saldo vive materializado en `accounts.balance` y se vincula por divisa mediante una tabla puente. El RFC 024 §4 lo extiende textualmente a «**todo instrumento que venga**» |
| «Un motor en segundo plano que registre el cobro de cuotas de manera automática» | [`patterns.md`](../patterns.md) §10 (RFC 023) revocó ese enfoque: las ocurrencias se proyectan en memoria con funciones puras y el puntero `resolved_through` es la guarda de idempotencia. **Sin cron, sin filas de pendientes** |
| Siete columnas monetarias en `integer` | `bigint` con `{mode: "number"}` desde el RFC 019 |
| §3B escribía los asientos con signos: `Pasivo -> -$800`, `Activo -> -$1.200` | Las columnas de [`ledgerEntries`](../../src/features/accounting/schema.db.ts) son `debit` y `credit`, **siempre positivas**. La notación con signos invita a implementar la partida doble al revés |
| §4: `SUM(loans.remainingBalance)` filtrando sólo por `contactId` | **Viola la regla dura de aislamiento multi-tenant** (`.agents/AGENTS.md` §8.3): toda consulta filtra por `organizationId`. Era código de ejemplo dentro de un RFC `APPROVED` |

**Por qué importa que estuviera `APPROVED`:** la regla dura del repositorio es «código sólo contra RFC `APPROVED`». Mientras ese texto tuvo ese sello, autorizaba formalmente a implementar el esquema equivocado. La trampa ya se cobró el RFC 006 y el RFC 015.

---

## 1. Contexto y objetivos

Un préstamo es plata que cambió de manos con obligación de devolverse. La dirección no cambia la naturaleza del instrumento, sólo de qué lado del libro cae:

*   **Pedido** (`borrowed`): un banco o una persona te dio plata. Es un **pasivo**.
*   **Dado** (`lent`): vos le diste plata a alguien. Es un **activo** — una cuenta por cobrar.

### Objetivos

1.  **Modelar `loans` como instrumento bidireccional**, con su reflejo contable por divisa, siguiendo el patrón que el RFC 007 estableció para tarjetas.
2.  **No duplicar el saldo.** El capital adeudado se lee del libro, no de una columna propia.
3.  **Separar amortización de interés.** Pagar una cuota reduce el pasivo por la parte de capital y registra un gasto por la parte de interés.
4.  **Proyectar el cronograma de cuotas sin cron**, reusando el motor de recurrencias del RFC 023.
5.  **Fijar `/loans`** como la vista transversal del instrumento, en el eje «por qué tipo de cosa es» del RFC 024 §2.

### No objetivos

*   **El neto por contacto en la ficha de `/contacts`.** Es el destino natural de las deudas con personas —y lo que la versión de junio prometía en su §4— pero construirlo toca la feature `contacts`, que hoy **no muestra un solo importe**: verificado, no hay ninguna referencia a saldo, deuda o balance en sus cinco componentes. Va en su propia tanda. Ver §9.
*   **Las compras en cuotas con tarjeta.** [RFC 025](025-card-installment-plans.md), ver el encabezado.
*   **Refinanciación, mora, punitorios y cambio de tasa a mitad de vida.** Un préstamo con condiciones renegociadas se da de baja y se da de alta uno nuevo.
*   **Sistemas de amortización distintos del francés.** Ver §9.

---

## 2. La ruta se llama `/loans`, no `/debts`

El RFC 024 §2 nombró `/debts` a esta vista transversal. **Este RFC la renombra a `/loans`, y la razón no es estética: `/debts` describe la mitad del instrumento.**

El precedente está en el propio repositorio y es exacto. **`/cards` cubre `credit` y `debit`**, que contablemente son opuestos —la tarjeta de crédito crea una cuenta de pasivo, la de débito espeja una cuenta de activo y no emite ningún asiento ([`patterns.md`](../patterns.md) §7.4)— y nadie las partió en dos rutas. Un préstamo dado y uno recibido tienen exactamente esa relación.

**El eje 2 del RFC 024 agrupa por tipo de instrumento, no por clase contable.** La prueba es que una tarjeta de crédito es un pasivo y no está en `/debts`: está en `/cards`. Si el criterio fuera la clase contable existiría una sola ruta `/pasivos` con las tarjetas adentro, y no existe.

**Corolario, que este RFC deja anotado para no reabrirlo:** por el mismo motivo **no se crea una ruta `/activos`**. «Activos» es el techo de la jerarquía contable, no un tipo de cosa; una ruta así mezclaría un departamento, un plazo fijo y la caja de ahorro del Galicia por la única razón de que los tres suman, y se solaparía con `/accounts`, donde la mayoría de los activos ya vive como cuenta. Ese fue exactamente el modelo de `assets` de FinanceApp-WSL —una tabla plana `REAL_ESTATE | STOCKS | CASH | CRYPTO | OTHER`, con el efectivo registrado a la vez ahí y en `bank_accounts`— y es el que este repositorio abandonó al adoptar partida doble. **La pregunta «cuánto tengo en total» se contesta en la página de estadísticas**, adonde el RFC 024 §6.2 mandó el Patrimonio Neto.

### Efecto sobre el RFC 024, que está `APPROVED`

Se aplica el mismo procedimiento con que el RFC 023 caducó una parte del RFC 004 ([`004-subscriptions-management.md:123`](004-subscriptions-management.md), «§4 — `needs_review: true` en el libro mayor. **Revocada.**»): **no se abre una enmienda aparte**; el documento viejo recibe su nota en el lugar exacto.

Las cinco menciones a corregir en [`024-instruments-and-entity-navigation.md`](024-instruments-and-entity-navigation.md) son las líneas **62, 79, 85, 291 y 297**. Fuera del RFC 024, el rename toca [`ARCHITECTURE.md:81`](../../ARCHITECTURE.md) y [`trabajo-en-vuelo.md:61`](../trabajo-en-vuelo.md).

**No se tocan** [`docs/planes/024-tanda-1-directorio-por-entidad.md:25`](../planes/024-tanda-1-directorio-por-entidad.md) ni nada bajo [`docs/registro/`](../registro/): son registro histórico de trabajo ya ejecutado y deben seguir diciendo lo que decían cuando se ejecutaron. Las tres menciones en [`docs/diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md) (líneas 296, 322 y 446) son de la misma naturaleza: acta de una sesión de diseño. **Tampoco se editan.**

**Verificado: `/debts` no existe en el código.** El rename es puramente documental. Las coincidencias de «deudas» en `src/` son texto de comentarios en la feature `notifications` y en `seed.ts`, ajenas a esta ruta.

---

## 3. El modelo

### 3.1 Dos tablas, como en tarjetas

Se repite el patrón `cards` → `card_accounts` que [`patterns.md`](../patterns.md) §7.1 fija y que el RFC 024 §4 manda repetir:

*   **`loans`** — los datos del préstamo: quién, cuánto se prestó originalmente, a qué tasa, en cuántas cuotas, desde cuándo. **Cero dinero acumulado.**
*   **`loan_accounts`** — el vínculo con la cuenta del libro, **una fila por divisa**, con unicidad `(loanId, currency)`.

La cuenta espejo se crea según la dirección:

| `direction` | Tipo de cuenta | Código | Signo del `balance` | Cómo se muestra |
| :--- | :--- | :--- | :--- | :--- |
| `borrowed` | `liability` | `2.1.01.NN` | **Negativo** | `deudaDe( cuenta )` |
| `lent` | `asset` | `1.1.01.NN` | **Positivo** | `cuenta.balance` directo |

Los códigos los genera [`getNextCode()`](../../src/features/accounting/utils/accountCodes.ts) (`accountCodes.ts:16`), que ya acepta ambos tipos.

### 3.2 La trampa de signo que este RFC nombra explícitamente

**`deudaDe()` sirve para `borrowed` y NO sirve para `lent`.**

[`deudaDe()`](../../src/features/cards/utils/ciclo.ts) (`ciclo.ts:23`) devuelve `-balance` porque el motor niega los pasivos ([`patterns.md`](../patterns.md) §8). Una cuenta por cobrar es un **activo**: su `balance` ya es positivo, y pasarla por `deudaDe()` la mostraría en negativo.

**Regla para la implementación:** toda pantalla que muestre el importe de un préstamo ramifica por `direction`. Nunca se escribe el signo a mano en ninguna de las dos ramas: para `borrowed` se usa `deudaDe()`, para `lent` se usa el balance tal cual.

### 3.3 El saldo pendiente no se guarda en ningún lado

La versión de junio tenía `remainingBalance`. **Se elimina, y no se reemplaza por nada.**

El capital adeudado es el saldo de la cuenta espejo, que el motor mantiene en cada asiento dentro de la transacción ACID ([`accountingService.ts:117`](../../src/features/accounting/services/accountingService.ts)). Una columna paralela sería un segundo lugar donde vive el mismo número, y los dos se desincronizan en cuanto un asiento se emita fuera del alta del préstamo —un pago anticipado, un contra-asiento de reversión— que es exactamente lo que el libro diario permite hacer.

`principalAmount` **sí** se conserva: no es el saldo, es el dato histórico de cuánto se prestó originalmente. Es inmutable y no se recalcula.

### 3.4 El cronograma se proyecta, no se materializa

Ninguna tabla de cuotas. Se reusa el circuito del RFC 023 ([`patterns.md`](../patterns.md) §10):

*   **`ocurrenciaN( firstInstallmentDate , frequency , intervalCount , n )`** ([`recurrenceService.ts:81`](../../src/features/subscriptions/services/recurrenceService.ts)) proyecta la fecha civil de la cuota número `n`. **Es genérica: recibe primitivas, no una `Subscription`.** Se reusa tal cual, sin tocarla.
*   **El cronograma ancla en `firstInstallmentDate`, no en `startDate`** (§3.5). Pasarle la fecha de desembolso corre todas las cuotas al día equivocado del mes.
*   **`resolvedThrough`** (tipo `date` civil `YYYY-MM-DD`) es la guarda de idempotencia y de orden: al confirmar un pago, la acción exige que sea **la cuota pendiente más antigua**. Dos sesiones simultáneas: la primera avanza el puntero, la segunda falla sin escribir nada.

**Lo que NO se reusa, y por qué:** [`pendientesDe()`](../../src/features/subscriptions/services/recurrenceService.ts) (`recurrenceService.ts:153`) está tipada contra `Subscription` concreto y lee `suscripcion.status !== "active"`. Un préstamo no tiene esa columna. **La ejecución escribe el equivalente para préstamos en su propia feature; no generaliza la firma de `pendientesDe()` ni toca la feature `subscriptions`.** Generalizarla obligaría a re-verificar la bandeja de recurrencias, que ya está cerrada y verde.

### 3.5 Cuándo se desembolsa y cuándo empieza a pagarse son dos fechas distintas

Un préstamo desembolsado el 15 de septiembre puede tener su primera cuota el 10 de noviembre: períodos de gracia, promociones de «empezá a pagar en marzo», o simplemente el calendario de la entidad. **Son dos hechos independientes y el esquema los guarda por separado:**

*   **`startDate`** (`timestamp`): cuándo el dinero cambió de manos. Es la fecha del asiento de alta (§5A y §5B) y no se usa para proyectar nada.
*   **`firstInstallmentDate`** (`date` civil): cuándo vence la primera cuota. **Es el ancla del cronograma**, el único argumento de fecha que recibe `ocurrenciaN()`.

Confundirlas tiene una consecuencia concreta y silenciosa: `ocurrenciaN()` ancla en el **día nominal** de la fecha que recibe ([`recurrenceService.ts:72`](../../src/features/subscriptions/services/recurrenceService.ts), «ancla siempre en el día nominal de startDate»), así que un préstamo desembolsado el 15 y con cuotas que vencen el 10 proyectaría las doce cuotas al día 15 de cada mes.

**El caso de la primera cuota futura ya está resuelto en el motor, verificado:** `calcularPunteroInicial()` ([`recurrenceService.ts:206`](../../src/features/subscriptions/services/recurrenceService.ts)), cuando ninguna ocurrencia tiene la ventana abierta todavía, devuelve el puntero ubicado **un intervalo antes** del inicio de la serie; `pendientesDe()` filtra por `fecha <= resolved`, de modo que la primera cuota queda pendiente y ninguna anterior se inventa. **Se reusa tal cual: la ejecución no la modifica.**

**Por qué hay puntero y no una columna `installmentsPaid`:** son lo mismo sólo mientras nada se salga del carril. El puntero es una fecha civil, así que sobrevive a un pago adelantado y a una cuota saltada; un contador no. Y [`ledger_transactions`](../../src/features/accounting/schema.db.ts) **no tiene ninguna columna que vincule un asiento con su instrumento de origen** —sólo `categoryId` y `reversesTransactionId`, verificado— así que el puntero es hoy el único mecanismo disponible para saber qué cuotas ya se emitieron.

---

## 4. Esquema de base de datos

Feature nueva: `src/features/loans/`.

```typescript
/**
 * Esquema de la tabla para Préstamos (pedidos y otorgados).
 * Datos del préstamo, cero dinero acumulado: el saldo vive en la cuenta espejo.
 */
export const loans = pgTable( "loans" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  name:      varchar( "name"      , {length: 150} ).notNull() , // Ej: "Préstamo Personal Galicia"
  direction: varchar( "direction" , {length: 20 } ).notNull() , // 'borrowed' | 'lent'

  // La contraparte. Exactamente una de las dos, nunca ambas ni ninguna (§4.1)
  entityId:  uuid( "entity_id"  ).references( () => financialEntities.id , {onDelete: "restrict"} ) ,
  contactId: uuid( "contact_id" ).references( () => contacts.id          , {onDelete: "restrict"} ) ,

  // Capital original en centavos. Dato histórico inmutable, NO es el saldo pendiente
  principalAmount: bigint( "principal_amount" , {mode: "number"} ).notNull() ,
  currency:        varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,

  // Tasa Nominal Anual en puntos básicos x100: 85.5% = 8550. Entero, NO es dinero
  interestRateAnnual: integer( "interest_rate_annual" ).default( 0 ).notNull() ,

  // Cronograma: se proyecta con ocurrenciaN(), no se materializa
  totalInstallments: integer( "total_installments" ).default( 1 ).notNull() ,
  frequency:         varchar( "frequency" , {length: 20} ).default( "monthly" ).notNull() ,
  intervalCount:     integer( "interval_count" ).default( 1 ).notNull() ,

  // Desembolso y primera cuota son dos fechas independientes (§3.5)
  startDate:            timestamp( "start_date" , {withTimezone: true} ).notNull() , // Cuándo cambió de manos el dinero
  firstInstallmentDate: date( "first_installment_date" ).notNull() ,                 // Ancla del cronograma. Civil YYYY-MM-DD
  resolvedThrough:      date( "resolved_through" ) ,                                 // Puntero de última cuota pagada (RFC 023)

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgDirectionIdx: index( "loans_org_direction_idx" ).on( table.organizationId , table.direction ) ,
} ) ; } ) ;

/**
 * Vínculo entre un préstamo y su cuenta del libro mayor: una fila por divisa.
 */
export const loanAccounts = pgTable( "loan_accounts" , {
  id:        uuid( "id"         ).primaryKey().defaultRandom() ,
  loanId:    uuid( "loan_id"    ).references( () => loans.id    , {onDelete: "cascade"}  ).notNull() ,
  accountId: uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,
  currency:  varchar( "currency" , {length: 10} ).notNull() ,
  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueLoanCurrency: uniqueIndex( "loan_accounts_loan_currency_unique" ).on( table.loanId , table.currency ) ,
} ) ; } ) ;
```

### 4.1 Decisiones de esquema y su fundamento

*   **`interest_rate_annual`, no `interest_rate_anual`.** La versión de junio mezclaba español en un nombre de columna inglés. La convención y la unidad se copian de [`cards.interestRateFinancing`](../../src/features/cards/schema.db.ts): puntos básicos por cien, entero. **No es dinero: no lleva `bigint`.** Es la misma familia que `year`, `month` e `interval_count`.
*   **`entityId` y `contactId` conviven, con exactamente uno no nulo.** Un préstamo del Galicia apunta a `financial_entities`; uno de Pedro apunta a `contacts`. La versión de junio resolvía esto con una columna `type: 'bank' | 'peer'` **más** un `contactId`, que es el mismo dato dicho dos veces y permite el estado incoherente `type='bank'` con `contactId` cargado. **La invariante se valida en el servicio con Zod, no con un `CHECK` en la base:** el repositorio no usa constraints de chequeo en ninguna tabla, y este RFC no introduce el primero.
*   **Ambas contrapartes son `restrict`, no `set null`.** La versión de junio usaba `set null` en `contactId`, lo que dejaría préstamos huérfanos sin contraparte. `contacts` y `financial_entities` se dan de baja lógicamente (`archivedAt`), no se borran; `restrict` es coherente con eso y con `cards.entityId`.
*   **`archivedAt`, no `isActive`.** Baja lógica igual que `cards` y `contacts`, y por el mismo motivo que la regla R4 del RFC 022: un préstamo cancelado conserva su historial contable.
*   **`timestamp` siempre con `{withTimezone: true}`.** La versión de junio lo omitía en las cinco columnas de fecha.
*   **`firstInstallmentDate` es `date` civil y `notNull`.** Es `date` por el mismo motivo que `resolvedThrough`: el motor de recurrencias compara fechas **como cadenas** `YYYY-MM-DD`, y `extraerComponentesCiviles()` ([`recurrenceService.ts:38`](../../src/features/subscriptions/services/recurrenceService.ts)) las lee con una expresión regular sin construir ningún `Date` —verificado— así que una columna civil no puede correrse un día por zona horaria. Es `notNull` porque un cronograma sin ancla no se puede proyectar; **en el alta se propone por defecto la fecha de desembolso y el usuario la corrige**, que es el caso del período de gracia.
*   **`resolvedThrough` es `date`, no `timestamp`.** Fecha civil `YYYY-MM-DD`, idéntico a [`subscriptions.resolvedThrough`](../../src/features/subscriptions/schema.db.ts). Mezclar tipos rompería la comparación de cadenas del motor de recurrencias.

### 4.2 Radio de impacto del esquema

**Dos tablas nuevas con FK ⇒ las dos van agregadas a [`limpiarBase()`](../../src/shared/db/testCleanup.ts).** No agregarlas rompe suites de otras features de forma intermitente, según el orden en que Vitest decida correr los archivos ([`patterns.md`](../patterns.md) §11).

El orden topológico es estricto y **ya está resuelto en el archivo: no se recalcula**. Las posiciones son:

*   **`loan_accounts`** tiene `restrict` contra `accounts`: va **antes** de `accounts` (paso 13) y antes de `loans`. Su lugar es junto a `card_accounts` (paso 7) / `category_accounts` (paso 12).
*   **`loans`** tiene `restrict` contra `financial_entities` (paso 14) y contra `contacts` (paso 10): va **antes de ambas**, y después de `loan_accounts`.

El esquema nuevo debe además exportarse desde `src/shared/db/schema` para que `limpiarBase()` pueda importarlo, como hacen las demás features.

---

## 5. Flujos contables

Las columnas `debit` y `credit` **siempre llevan importes positivos**. El signo no se escribe: lo produce la fórmula del motor según el tipo de cuenta ([`patterns.md`](../patterns.md) §8).

### A. Alta de un préstamo pedido (`borrowed`) con desembolso

El banco te deposita $10.000 en tu caja de ahorro:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| Caja de ahorro (`asset`) | 1.000.000 | |
| Préstamo Galicia (`liability`) | | 1.000.000 |

El pasivo queda con `balance = -1.000.000`, y `deudaDe()` lo muestra como $10.000 de deuda.

### B. Alta de un préstamo dado (`lent`)

Le prestás $10.000 a Pedro desde tu caja de ahorro. **Es el asiento A al revés:**

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| Préstamo a Pedro (`asset`) | 1.000.000 | |
| Caja de ahorro (`asset`) | | 1.000.000 |

Los dos son activos: uno sube, el otro baja. El patrimonio no cambia, que es lo correcto — cambió la forma del activo, no su magnitud.

### C. Alta de un préstamo preexistente, sin desembolso

Un préstamo que ya venía de antes y se está cargando ahora en el sistema no tuvo movimiento de caja. Se resuelve **igual que la tarjeta con deuda preexistente** ([`patterns.md`](../patterns.md) §7.4), contra Patrimonio Neto:

| `direction` | Debe | Haber |
| :--- | :--- | :--- |
| `borrowed` | Patrimonio Neto | Préstamo (`liability`) |
| `lent` | Préstamo (`asset`) | Patrimonio Neto |

La cuenta de patrimonio se resuelve como ya lo hace [`cardsActions.ts:112`](../../src/features/cards/actions/cardsActions.ts): por código `3.1.01.01`, con respaldo al primer `type === "equity"`, y se falla explícitamente si no hay ninguna.

### D. Pago de una cuota (`borrowed`)

Cuota de $1.200, de los cuales $800 son capital y $400 interés:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| Préstamo Galicia (`liability`) | 80.000 | |
| Intereses financieros (`expense`) | 40.000 | |
| Caja de ahorro (`asset`) | | 120.000 |

Debe = Haber = 120.000. El pasivo sube hacia cero en 80.000 —la deuda baja— y el interés queda registrado como gasto real del mes.

**La cuenta de intereses es una categoría, no una cuenta suelta.** Por el RFC 022 la categoría *es* la cuenta de resultado: se resuelve con [`findOrCreateAccountForCurrency()`](../../src/features/accounting/repositories/categoryRepository.ts) (`categoryRepository.ts:240`), igual que hacen [`transactionsActions.ts:153`](../../src/features/transactions/actions/transactionsActions.ts) y [`resolveSubscriptionAction.ts:162`](../../src/features/subscriptions/actions/resolveSubscriptionAction.ts). **No se crea una cuenta `5.1.01.NN` a mano**, o queda fuera del árbol de categorías y no aparece en ningún informe de gastos.

### E. Cobro de una cuota (`lent`)

Pedro te devuelve $1.200, de los cuales $800 son capital y $400 interés ganado:

| Cuenta | Debe | Haber |
| :--- | ---: | ---: |
| Caja de ahorro (`asset`) | 120.000 | |
| Préstamo a Pedro (`asset`) | | 80.000 |
| Intereses ganados (`revenue`) | | 40.000 |

El activo por cobrar baja en 80.000 y el interés entra como ingreso.

### F. Invariantes de emisión

1.  **Un solo asiento por cuota, dentro de una transacción ACID**, junto con el avance de `resolvedThrough`. Si el puntero avanzó, el asiento existe; si algo falla, no se escribe nada ([`patterns.md`](../patterns.md) §10.4).
2.  **`occurredAt` es la fecha nominal de la cuota**, no el instante del clic ([`patterns.md`](../patterns.md) §10.5). Si no, los cierres mensuales históricos quedan mal.
3.  **La divisa de la cuenta de pago y la del préstamo deben coincidir**, y el motor rechaza la operación si difieren ([`patterns.md`](../patterns.md) §10.6). Sin cotización real no hay conversión implícita.
4.  **La separación capital/interés se calcula, no se ingresa a mano.** Sistema francés: cuota constante, interés del período sobre el saldo vivo, capital por diferencia. Con `interestRateAnnual = 0` la cuota es capital puro, que es el caso de la mayoría de los préstamos entre personas.

---

## 6. Lo que la interfaz muestra

`/loans` lista los préstamos de las dos direcciones, separados. Dentro de `/accounts`, un préstamo con `entityId` aparece además en la familia **Préstamos** de su entidad, que el RFC 024 §3.2 dejó declarada y vacía a la espera de este RFC.

**Que aparezca en los dos lados no es duplicación**, y la regla ya está escrita: RFC 024 §2, «es la misma fila leída por dos criterios».

**Lo que no hay que construir**, porque ya existe:

| Ya existe | Dónde | Cómo se usa |
| :--- | :--- | :--- |
| Negación de pasivos para mostrar | `deudaDe()` , [`ciclo.ts:23`](../../src/features/cards/utils/ciclo.ts) | Sólo en la rama `borrowed` (§3.2) |
| Proyección de la cuota `n` | `ocurrenciaN()` , [`recurrenceService.ts:81`](../../src/features/subscriptions/services/recurrenceService.ts) | Tal cual, sin modificarla |
| Códigos contables correlativos | `getNextCode()` , [`accountCodes.ts:16`](../../src/features/accounting/utils/accountCodes.ts) | Con `"liability"` o `"asset"` según dirección |
| Cuenta de resultado por divisa | `findOrCreateAccountForCurrency()` , [`categoryRepository.ts:240`](../../src/features/accounting/repositories/categoryRepository.ts) | Para la categoría de intereses |
| Alta de instrumento + cuenta + asiento | [`cardsActions.ts:112-173`](../../src/features/cards/actions/cardsActions.ts) | Es el molde de la acción de alta |
| Resolución de logo de marca | `brandService.ts` , campo `brandDomain` | Para préstamos con `entityId` |
| Envoltura de resultado | `Result` , `ok()` , `fail()` , [`result.ts`](../../src/shared/lib/result.ts) | Toda acción devuelve `Result` |

---

## 7. Verificación

Los cuatro comandos, con el typecheck separado del build:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

**`pnpm build` no es typecheck:** `next build` no tipa los archivos de test y vitest tampoco. La compuerta corre `tsc --noEmit` por separado.

Contraste del esquema contra la base real, una vez migrado:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d loans"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d loan_accounts"
```

`principal_amount` debe figurar como `bigint`. `interest_rate_annual`, `total_installments` e `interval_count` como `integer`: no son dinero.

---

## 8. Casos de prueba que este RFC exige

1.  **Debe = Haber por divisa** en los cinco asientos de §5, incluido el de tres patas de §5D.
2.  **Signo:** un `borrowed` recién dado de alta tiene `balance` negativo y `deudaDe()` positivo; un `lent` tiene ambos positivos.
3.  **Idempotencia:** confirmar dos veces la misma cuota escribe un solo asiento y falla la segunda.
4.  **Orden:** confirmar una cuota que no es la más antigua pendiente falla sin escribir.
5.  **Divisa cruzada:** pagar una cuota de un préstamo en USD desde una cuenta en ARS se rechaza.
6.  **Contraparte:** un préstamo con `entityId` y `contactId` a la vez, o con ninguno, se rechaza en el alta.
7.  **Amortización:** con `interestRateAnnual = 0`, la cuota es capital puro y el asiento tiene dos patas, no tres.
8.  **Aislamiento:** ninguna consulta del repositorio devuelve filas de otra organización.
9.  **Período de gracia:** un préstamo con `startDate` el 15/09 y `firstInstallmentDate` el 10/11 no propone ninguna cuota hasta el 1/11, y la primera que propone es la del 10/11 — no la del 15/10 ni la del 15/09.
10. **`limpiarBase()`** deja las dos tablas vacías y no rompe ninguna suite existente.

---

## 9. Lo que este RFC deja abierto

*   **El neto por contacto en `/contacts`.** Es el destino de las deudas con personas y lo que la versión de junio prometía sin poder cumplir. Hoy `/contacts` no muestra un solo importe. Necesita su propia propuesta, y depende de esta.
*   **Las compras en cuotas con tarjeta.** Ya escrito y **`APPROVED`** el 2026-09-11: [RFC 025](025-card-installment-plans.md), implementado en sus dos tandas (`6be0341` y `94c02b4`). Comparte con éste el motor de recurrencias del RFC 023, la separación entre la fecha del hecho y el ancla del cronograma, y la decisión de no materializar las cuotas. **Difiere en una cosa, y está declarada en su §2:** un préstamo registra el pasivo completo el día uno y una compra en cuotas no. Financiar la misma heladera de las dos formas da patrimonios netos distintos, y la propuesta de estadísticas es la que tiene que cerrar esa brecha.
*   **Sistemas de amortización distintos del francés** (alemán de cuota decreciente, americano de interés puro con capital al final). El esquema los soporta sin cambios —`totalInstallments` y la tasa alcanzan— pero el cálculo no está especificado acá.
*   **Ajuste por inflación o por UVA.** Un préstamo UVA no tiene capital fijo en pesos. Fuera de alcance; el esquema **no** lo contempla y agregarlo pedirá una columna de unidad de ajuste.
*   **Dónde entra `/loans` en la navegación lateral.** El RFC 024 §9 dejó esa decisión pendiente para cuando la ruta existiera. Ahora existe: se decide en el plan de ejecución, contra [`Navbar.tsx`](../../src/shared/ui/layout/Navbar/Navbar.tsx), donde `/cards` figura en `:121` y `/settings` en `:91`.
*   **La convención de signo de `monthly_summaries`.** No la toca este RFC, pero un préstamo cambia el patrimonio neto y esa tabla lo fotografía con los pasivos en positivo. Pertenece a la propuesta de estadísticas (RFC 024 §9).
