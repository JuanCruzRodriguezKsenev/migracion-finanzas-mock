# Patrones Arquitectónicos de FinanzIA

Este documento describe los cuatro patrones centrales de diseño implementados en el núcleo contable y la infraestructura de FinanzIA, con referencias explícitas al código fuente y a las tablas relacionales.

---

## 1. Partida Doble Real (Double-Entry Bookkeeping)

FinanzIA implementa un libro mayor contable balanceado en el que cada movimiento financiero impacta al menos en dos cuentas de manera complementaria.

### Tablas involucradas
*   [`accounts`](../src/features/accounting/schema.db.ts#L41-L54): Cuentas del plan contable (`asset`, `liability`, `equity`, `revenue`, `expense`).
*   [`ledgerTransactions`](../src/features/accounting/schema.db.ts#L58-L67): Cabecera de la transacción contable (asiento).
*   [`ledgerEntries`](../src/features/accounting/schema.db.ts#L71-L80): Líneas o apuntes individuales (`debit` y `credit`).

### Reglas e Invariantes
1.  **Montos en centavos enteros (`integer`):** No se utiliza punto flotante (`float`/`double`) para cálculos monetarios. Todo monto `M` se almacena como `M * 100` centavos.
2.  **Invariante de balance cero, por moneda:** Para cualquier transacción en `ledgerTransactions`, y **para cada divisa por separado**, la suma de los débitos debe ser exactamente igual a la suma de los créditos:
    $$\forall c \in \text{monedas}: \sum \text{debit}_c = \sum \text{credit}_c$$
    Validar el total sin distinguir divisa daba por balanceada una transacción de 100.000 centavos de peso contra 100.000 de dólar. Cada moneda es un libro propio.
3.  **La moneda de un asiento la define su cuenta.** `ledger_entries.currency` no puede diferir de `accounts.currency`; el motor rechaza el asiento antes de tocar ningún saldo. Un saldo es un entero sin unidad, así que aceptar otra divisa no falla: sólo miente.
4.  **No negatividad en líneas:** Las columnas `debit` y `credit` son enteros $\ge 0$. La dirección del saldo se determina por el tipo de cuenta:
    *   **Activos / Gastos:** Aumentan por el Débito (Debe), disminuyen por el Crédito (Haber).
    *   **Patrimonio / Ingresos:** Aumentan por el Crédito (Haber), disminuyen por el Débito (Debe).
    *   **Pasivos:** ⚠️ **el motor los trata igual que a los activos** (`balance + debit - credit`), así que un pasivo con deuda guarda **saldo negativo**. Esto se aparta de la convención contable clásica, en la que un pasivo tiene saldo acreedor positivo. **Antes de leer, escribir o sumar un `balance` de tipo `liability`, leer el §8.**
5.  **Cálculo de Patrimonio Neto (Net Worth):**
    $$\text{Patrimonio Neto} = \text{Activos} - \text{Pasivos}$$
    La identidad es correcta en abstracto, **pero no se aplica directamente sobre la columna `balance`**: como los pasivos ya están negados, restarlos suma la deuda. La fórmula sobre los saldos del repositorio es una suma. Ver §8.

### Cambio de divisas
Un cambio de moneda **no es un asiento que cruza divisas** —eso no existe en partida doble—. Se registra como una única transacción con cuatro asientos en dos libros, cada uno cerrando en cero contra su **cuenta de posición de cambio** (`3.3.01-<MONEDA>`, tipo `equity`):

| Libro | Cuenta | Debe | Haber |
|---|---|---|---|
| ARS | Caja ARS | | 100.000,00 |
| ARS | Posición de cambio (ARS) | 100.000,00 | |
| USD | Caja USD | 100,00 | |
| USD | Posición de cambio (USD) | | 100,00 |

El par de cuentas de posición refleja la posición tomada. **La cotización no se guarda**: es el cociente entre los dos importes, y un campo aparte podría contradecir a los asientos. Son de tipo `equity` para no distorsionar la liquidez, que suma sólo cuentas `asset`.

**Regla**: para mover valor entre monedas se usa una transacción de cambio. Una transferencia exige que ambas cuentas compartan divisa, y el motor rechaza cualquier otra vía.

### Reversión
El libro diario es inmutable: una transacción equivocada no se edita ni se borra, se contra-asienta. `reverseLedgerTransaction` bloquea la fila original (`SELECT ... FOR UPDATE`), rechaza la operación si `reversed_at` ya está seteado, y deja el vínculo en los dos sentidos (`reversed_at` en la original, `reverses_transaction_id` en el espejo).

**Regla**: sin el bloqueo y la marca, dos reversiones simultáneas devolvían el importe dos veces a las cuentas — dinero creado de la nada.

### Implementación
*   Servicio central: [`accountingService.ts`](../src/features/accounting/services/accountingService.ts).
*   Validación de balance en runtime: ocurre **dentro** de la transacción ACID, después de resolver la moneda de cada cuenta; antes no se sabe en qué divisa está cada asiento.
*   Traducción de formulario a asientos (incluido el cambio): [`transactionsActions.ts`](../src/features/transactions/actions/transactionsActions.ts).

---

## 2. Transactional Outbox Pattern

Para garantizar consistencia eventual con servicios externos (webhooks, notificaciones, sincronizaciones bancarias) sin requerir transacciones distribuidas (2PC), FinanzIA utiliza el patrón Outbox.

### Tabla involucrada
*   [`outboxEvents`](../src/features/accounting/schema.db.ts#L106-L117):
    *   `organizationId`: Tenancy del evento.
    *   `eventType`: Identificador del evento de dominio (`TRANSACTION_CREATED`, `TRANSACTION_DELETED`, `TRANSACTION_METADATA_UPDATED`, `TRANSACTION_REVERSED`).
    *   `payload`: Datos del evento en `jsonb`.
    *   `status`: Máquina de estados (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `SENT` / `FAILED`).
    *   `attempts`: Contador de reintentos con límite en `MAX_ATTEMPTS = 5`.
    *   `processedAt`: Marca temporal de procesamiento/reclamo.
    *   Índice: `outbox_status_created_idx` sobre `(status, created_at)` para optimizar el polling sin sequential scans.

### Garantía ACID y Despacho en 3 Pasos
El evento outbox **se persiste dentro de la misma transacción de base de datos** (`tx`) que registra el asiento contable en `ledgerEntries`:
*   Si la base de datos comitea, tanto el libro contable como el evento outbox quedan guardados atómicamente.
*   Si la transacción hace rollback, no queda ningún evento huérfano.

Para procesar los eventos sin retener bloqueos de base de datos durante operaciones lentas de red, el despachador ([`outboxDispatcher.ts`](../src/features/accounting/services/outboxDispatcher.ts)) implementa un **ciclo en tres pasos**:
1.  **Paso 1 (Reclamo atómico):** En una micro-transacción rápida, selecciona eventos con `status = 'PENDING'` usando `SELECT ... FOR UPDATE SKIP LOCKED` y los actualiza de inmediato a `status = 'PROCESSING'` con marca de tiempo `processedAt`. La transacción de DB se cierra al instante, liberando conexiones y bloqueos.
2.  **Paso 2 (Despacho desacoplado):** Fuera de la transacción de base de datos, ejecuta de forma asíncrona los handlers registrados en el `EventHandlerRegistry`. Si una llamada de red falla o se demora, no afecta al resto del sistema.
3.  **Paso 3 (Asentamiento final):** En una micro-transacción, los eventos exitosos pasan a `status = 'SENT'`. Los fallidos incrementan su contador `attempts`; si superan `MAX_ATTEMPTS (5)`, pasan a `status = 'FAILED'`; de lo contrario, retornan a `status = 'PENDING'` para reintento posterior.

### Recuperación de Huérfanos y Purga Histórica
*   **Recuperación (`recoverStaleProcessing`):** Si el worker colapsa durante el despacho, cualquier evento congelado en `PROCESSING` por más de 5 minutos (`PROCESSING_TTL_MS`) es retornado a `PENDING` automáticamente al inicio del ciclo.
*   **Purga periódica (`purgeOldSentEvents`):** Elimina registros `SENT` con más de 30 días de antigüedad para mantener acotado el tamaño de la tabla.
*   **Ejecución manual CLI:** Disponible mediante el comando `pnpm db:outbox` ([`src/shared/db/dispatchOutbox.ts`](../src/shared/db/dispatchOutbox.ts)).

---

## 3. Control de Idempotencia (Idempotency Key)

Las operaciones de mutación contable (creación de asientos y cobros) requieren protección contra peticiones duplicadas originadas por reintentos de red, doble clic en la interfaz o fallas de transporte.

### Tabla involucrada
*   [`idempotencyKeys`](../src/features/accounting/schema.db.ts#L84-L90):
    *   `key`: Identificador provisto por el cliente o generado (UUID v4 / hash).
    *   `status`: `PROCESSING` | `COMPLETED`.
    *   `responseBody`: Respuesta serializada en JSON de la ejecución original.
    *   `createdAt`: Timestamp para control de TTL (Time-To-Live).

### Protocolo de Ejecución
El servicio [`idempotencyService.ts`](../src/shared/services/idempotencyService.ts) orquesta el flujo:
1.  **Claim atómico:** Intenta registrar la clave con estado `PROCESSING`.
2.  **Detección de duplicados concurrentes:** Si la clave ya existe en `PROCESSING` dentro del período de vigencia (TTL), responde inmediatamente con `409 Conflict`.
3.  **Reclamación de claves vencidas:** Si la clave quedó en `PROCESSING` más allá del TTL (proceso caído a mitad de camino), se reclama limpiando el bloqueo para reintento.
4.  **Replay transparente:** Si la clave ya está en estado `COMPLETED`, deserializa `responseBody` y la retorna inmediatamente sin reejecutar la lógica de negocio.
5.  **Liberación ante fallos:** Si la lógica de negocio arroja una excepción, la clave se elimina para permitir reintentos limpios posteriores.

---

## 4. Circuit Breaker (Disyuntor de Red)

Para proteger la disponibilidad del sistema frente a degradaciones o caídas en servicios de terceros (como la Brandfetch API para logotipos de instituciones), se implementa un Disyuntor en [`circuitBreaker.ts`](../src/shared/lib/circuitBreaker.ts).

### Estados del Circuito
```
        [Éxito]
          ┌──┐
          ▼  │
     ┌───────────┐  Fallos >= Umbral   ┌──────────┐
     │  CLOSED   │ ──────────────────> │   OPEN   │
     └───────────┘                     └──────────┘
           ▲                                 │
           │ Éxito                           │ Cooldown cumplido
           │                                 ▼
     ┌───────────┐   Fallo en sondeo   ┌──────────┐
     │ HALF_OPEN │ ──────────────────> │   OPEN   │
     └───────────┘                     └──────────┘
```

*   **`CLOSED`:** Tráfico normal. Si las fallas consecutivas alcanzan `failureThreshold`, el circuito se abre.
*   **`OPEN`:** Rechazo inmediato (*fail-fast*) de peticiones sin realizar llamadas de red, devolviendo el fallback local. Permanece en este estado durante `resetTimeoutMs`.
*   **`HALF_OPEN`:** Al vencer el timeout, permite un número limitado de peticiones de prueba (`probeRequests`). Si responden exitosamente, vuelve a `CLOSED`; si fallan, retorna a `OPEN`.

---

## 5. Gestión de Activos y Logos de Marcas Externas (External Brand Assets)

Para la representación visual de entidades financieras, pasarelas de pago y proveedores de suscripciones, FinanzIA consume logotipos de fuentes externas dinámicas (como Brandfetch API, dominios ingresados por el usuario o CDNs de terceros).

### Rationale: `<img>` nativo vs `next/image`
El componente `<Image />` de Next.js está optimizado para recursos estáticos o de orígenes restringidos cuyo conjunto de dominios y dimensiones se conoce en tiempo de compilación (`remotePatterns` en `next.config.js`). En nuestro caso:
1. **Dominios arbitrarios e impredecibles:** Los logotipos pueden provenir de cualquier TLD o subdominio según la entidad financiera ingresada por el usuario o indexada por Brandfetch.
2. **Dimensiones intrínsecas variables:** Los iconos de marcas remotas no cuentan con una relación de aspecto o resolución fija previa.
3. **Mecanismo de degradación elegante (*graceful fallback*):** Se requiere interceptar de forma inmediata el evento nativo `onError` del elemento HTML para conmutar el estado del componente hacia un SVG temático local o las iniciales del servicio, sin depender del servidor de optimización de Next.js.

### Convención en Código
Cada utilización de `<img>` para activos dinámicos externos debe incluir una justificación explícita de lint en línea:
```tsx
{/* eslint-disable-next-line @next/next/no-img-element -- Logo de marca dinámico externo con fallback onError */}
<img src={logoUrl} alt={name} onError={() => setHasError(true)} />
```
Los archivos que implementan este patrón son:
*   [`InstitutionLogo.tsx`](../src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx)
*   [`SubscriptionIcon.tsx`](../src/features/subscriptions/components/SubscriptionIcon.tsx)
*   [`AddSubscriptionModal.tsx`](../src/features/subscriptions/components/AddSubscriptionModal.tsx)
*   [`CreateFinancialEntityForm.tsx`](../src/features/accounting/components/CreateFinancialEntityForm.tsx)

### Separación de Marca y Dominio Web (`brandDomain`)
Siguiendo el precedente establecido en `ledger_transactions` (`merchantName` / `merchantDomain`), las entidades que consumen logotipos externos separan explícitamente el nombre visible del dominio web:
*   `financial_entities` almacena `name` (nombre de la institución), `brand_domain` (dominio web para Brandfetch) y `logo` (icono local de respaldo: `bank`, `wallet`, `cash`, `credit-card`).
*   [`InstitutionLogo`](../src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx) recibe la propiedad opcional `brandDomain` para resolver sincrónicamente la CDN de Brandfetch sin depender de inspección heurística de cadenas (`includes( "." )`), manteniendo la deducción heurística únicamente como fallback de compatibilidad para registros previos.

---

## 6. Preferencias Canónicas y Derivación en el Borde (Canonical Preferences & Edge Labeling)

Para evitar que cadenas de presentación de la interfaz (como `'Peso argentino (ARS)'`, `'(GMT-03:00) Buenos Aires'` o `'1.234,56'`) se filtren a la base de datos o impidan la integración con APIs estándar de internacionalización como `Intl`, FinanzIA separa estrictamente el almacenamiento canónico del dato de su representación visual:

### Reglas e Invariantes
1.  **La base de datos almacena únicamente códigos canónicos normalizados:**
    *   `currency`: Códigos ISO 4217 (`'ARS'`, `'USD'`).
    *   `timezone`: Identificadores de zona horaria IANA (`'America/Argentina/Buenos_Aires'`).
    *   `number_format`: Etiquetas de locale BCP 47 (`'es-AR'`, `'en-US'`).
    *   `weekly_start`: Identificadores de día canónicos (`'monday'`, `'sunday'`).
    *   `default_view`: Slugs de ruta normalizados (`'dashboard'`, `'transactions'`).
2.  **La derivación a etiquetas en español ocurre en el borde de interfaz:**
    *   El módulo [`preferences.ts`](../src/features/profile/preferences.ts) centraliza el catálogo de opciones y la función pura `etiquetaDe( grupo , code )`.
    *   Si un valor no está catalogado o es desconocido, el sistema recurre al propio código o a un respaldo seguro (`"es-AR"`) sin lanzar excepciones.
3.  **Validación estricta en mutaciones:**
    *   [`profile.schema.ts`](../src/features/profile/schemas/profile.schema.ts) valida mediante `z.enum()` sobre los códigos canónicos con modo estricto (`.strict()`), impidiendo que peticiones cliente reintroduzcan etiquetas de presentación.
    *   Excluye campos de suscripción comercial (`planName`, `planBilling`, `planNextCharge`) para proteger la integridad comercial del SaaS.

---

## 7. Tarjetas como Cuentas de Pasivo (Cards as Liability Accounts)

Para modelar instrumentos de crédito y débito sin desvirtuar la partida doble ni violar la regla de una única moneda por cuenta contable (RFC 007):

### Reglas e Invariantes
1.  **Separación entre plástico y libro contable (`cards` y `card_accounts`):**
    *   `cards` almacena exclusivamente los metadatos del plástico físico (red, últimos 4 dígitos, fechas de expiración, días de cierre/pago y límites). No almacena dinero ni saldo acumulado.
    *   `card_accounts` vincula el plástico a sus respectivas cuentas contables de pasivo (`type = "liability"`), una fila por divisa. Esto permite saldos duales (ej: pesos ARS y dólares USD) sobre un motor donde cada cuenta tiene una única divisa.
2.  **La deuda de la tarjeta es el saldo contable negado:**
    *   El motor aplica a los pasivos la misma regla que a los activos: `balance + debit - credit` (§8). Los consumos acreditan la cuenta, así que la restan.
    *   Los consumos acreditan la cuenta de la tarjeta, por lo que su balance contable en la base de datos es **negativo** (ej: `-2500000`).
    *   La deuda exigible es `-balance` (ej: `+$25.000,00`). La conversión se realiza centralizadamente en `deudaDe( cuenta )` ([`src/features/cards/utils/ciclo.ts`](../src/features/cards/utils/ciclo.ts)).
3.  **El ciclo de facturación es una función pura sobre fechas contables (`occurred_at`) en la zona horaria del usuario:**
    *   El ciclo divide consumos en dos baldes: **Saldo Facturado** (`occurredAt ∈ (cierreAnterior, cierreActual]`) y **Saldo en Curso** (`occurredAt > cierreActual`).
    *   Se calcula usando identificadores IANA (`Intl.DateTimeFormat`) y `profile.timezone`. Los cierres se evalúan a las 23:59:59.999 en la zona local del usuario para evitar que consumos nocturnos caigan al día siguiente por desfase UTC.
    *   Si `dueDay < closingDay`, el vencimiento cae en el mes siguiente al cierre; si `dueDay >= closingDay`, en el mismo mes. Días no existentes (ej: 31 en febrero) se recortan al último día real del mes respetando años bisiestos.
4.  **Asiento de apertura invertido en crédito:**
    *   Si una tarjeta de crédito nace con deuda preexistente, emite un asiento: **Debe Patrimonio Neto / Haber Tarjeta de Crédito**. Esto reduce el patrimonio por el monto de la deuda preexistente.
    *   Una tarjeta de débito es un espejo puro de una cuenta de activo (`linkedAccountId`) y no crea cuentas de pasivo ni emite ningún asiento contable.

---

## 8. Convención de Signo de los Saldos (Balance Sign Convention)

**Este patrón documenta lo que el motor hace hoy, no lo que la teoría contable prescribe.** Se escribió el 2026-09-09 después de encontrar un defecto que no fue un descuido: fue seguir la documentación, que se contradecía a sí misma entre el §1 y el §7.

### La regla vigente

`accountingService.ts` aplica **una sola fórmula a tres tipos** — activos, gastos **y pasivos**:

```
asset | expense | liability   →   balance + debit - credit
equity | revenue              →   balance - debit + credit
```

**Consecuencia:** una cuenta de pasivo con deuda tiene `balance` **negativo**. Un consumo de tarjeta (Debe Gasto / Haber Tarjeta) resta del saldo de la tarjeta.

### Reglas e Invariantes

1.  **La deuda de un pasivo es `-balance`.** Nunca `balance`. La conversión está centralizada en `deudaDe( cuenta )` (`cards/utils/ciclo.ts`); **usarla en vez de escribir el signo a mano.**
2.  **Un pasivo se da de alta en negativo.** `accountingActions.ts` invierte el signo cuando el alta manual recibe un saldo positivo para un `type === "liability"`. Un pasivo con `balance` positivo es un pasivo pagado de más, no una deuda.
3.  **Sumar saldos de tipos mezclados es una suma, nunca una resta.** Con los pasivos ya negados, `activos + pasivos` da el neto correcto. **`activos - pasivos` suma la deuda al patrimonio**: fue literalmente el defecto de `AccountsContainer.tsx`, corregido el 2026-09-10 en la tanda 1 del RFC 024 (`~/Boveda/Proyectos/migracion-finanzas-mock/Deuda.md` §6).
4.  **`monthly_summaries` usa la convención opuesta.** Sus columnas `liabilities_snapshot` y `assets_snapshot` guardan los pasivos en **positivo**, con la identidad clásica $A = PN + P$ (ver `seed.ts`). **Una pantalla que mezcle `accounts.balance` con `monthly_summaries` está mezclando dos convenciones**, y hoy hay una que lo hace: el número de Patrimonio Neto de `/accounts` sale de `accounts` y su sparkline de `monthly_summaries`. Deuda abierta: unificar.

### Por qué está anotado como deuda y no corregido acá

Cambiar el motor para que los pasivos sean acreedores positivos es una decisión de arquitectura con migración de datos detrás: toca el servicio, el alta manual, `deudaDe()`, la vista de tarjetas y todos los saldos ya persistidos. **Mientras no se tome esa decisión, la regla de este §8 es la verdad operante y hay que programar contra ella.**

---

## 9. Clasificación Unificada: La Categoría es la Cuenta Contable (RFC 022)

En FinanzIA, las categorías de gasto e ingreso no son meras etiquetas informativas ni desgloses paralelos en metadata de la transacción: **la categoría es la cuenta contable de resultado** (`expense` o `revenue`).

### Tablas involucradas
*   [`categories`](../src/features/accounting/schema.db.ts): Entidad de clasificación en árbol (`id`, `name`, `type`, `parentId`, `accountCode`, `archivedAt`, `isSystemLeaf`).
*   [`categoryAccounts`](../src/features/accounting/schema.db.ts): Tabla puente relacional que asocia una categoría con su cuenta contable por divisa (`categoryId`, `accountId`, `currency`), con restricción de unicidad `(categoryId, currency)`.
*   [`accounts`](../src/features/accounting/schema.db.ts): Cuenta contable de resultado (`type = "expense"` o `"revenue"`).

### Comparación con Patrones Hermanos
*   **Contraste con Tarjetas (§7):** Así como `cards` modela el plástico físico y se vincula a cuentas de pasivo multidivisa mediante `card_accounts`, `categories` modela la entidad conceptual del árbol y se vincula a sus cuentas de resultado por divisa mediante `category_accounts`. En ambos patrones, la cuenta contable en `accounts` tiene una única moneda y el balance vive materializado en `accounts.balance`.
*   **Contraste con Signo de Saldos (§8):** Las cuentas de gasto (`expense`) aumentan por el Débito (`balance + debit - credit`) conservando saldo positivo, mientras que los ingresos (`revenue`) aumentan por el Crédito (`balance - debit + credit`). No sufren la inversión de signo de los pasivos documentada en §8.

### Reglas e Invariantes (R1 a R5)

1.  **R1 (Solo las hojas reciben movimientos):**
    Un nodo padre (`parentId = null` con hijos) no puede recibir asientos contables directamente. Si una transacción imputa a un padre (o si viene sin categoría), la imputación se redirige a la hoja `General` del padre o a la hoja `General` raíz del tipo (`5.1.01.99` o `4.1.01.99`).
2.  **R2 (Cuentas por divisa bajo demanda):**
    La moneda del asiento contable la impone siempre la cuenta de origen (ej: caja, banco, tarjeta). Cuando se imputa un movimiento sobre una categoría en una moneda no asociada previamente, el repositorio resuelve o crea la cuenta contable correspondiente para esa divisa (`findOrCreateAccountForCurrency`) y registra el nexo en `category_accounts` sin duplicar la categoría en el árbol.
3.  **R3 (Mudanza automática al ramificar):**
    Si una categoría hoja acumula movimientos contables y posteriormente el usuario decide crearle una primera subcategoría hija, los asientos históricos y el saldo acumulado en su cuenta contable se transfieren atómicamente a su nueva hija `General` (`.99`). De esta forma, el padre queda limpio para actuar exclusivamente como agrupador, respetando la invariante R1.
4.  **R4 (Inmutabilidad y protección de borrado):**
    Las categorías no admiten borrado físico (`DELETE` restringido por clave foránea). Se gestionan mediante archivado lógico (`archived_at`). Una categoría archivada queda excluida de los selectores para nuevas transacciones, pero preserva intacto su historial contable y su saldo acumulado. Asimismo, `type` y `accountCode` son estrictamente inmutables tras su creación.
5.  **R5 (Soporte Multidivisa):**
    Una categoría puede operar en múltiples monedas (ej: ARS y USD). Cada moneda opera como un libro contable independiente conforme a la invariante de balance cero por divisa (§1.2), manteniendo cuentas separadas en `accounts` con sus respectivos saldos en centavos.

### Jerarquía y Codificación (`categoryCodes.ts`)
*   **Árbol de dos niveles:** Raíz (`5.1.NN` para gastos, `4.1.NN` para ingresos) y Subcategorías (`<códigoPadre>.NN`).
*   **Correlativos de ancho fijo:** `NN` va de `01` a `98` formateado con `padStart(2, "0")`. Al alcanzar 98 hermanos, el generador lanza una excepción explícita impidiendo desbordes hacia tres dígitos.
*   **Reserva estricta del `.99`:** El sufijo `.99` está reservado en cada nivel para las hojas del sistema `General` (`isSystemLeaf = true`), impidiendo que categorías creadas por usuarios colisionen con las cuentas de absorción del sistema.

---

## 10. Transacciones Propuestas y Puntero de Idempotencia (RFC 023)

En FinanzIA, los compromisos y cobros periódicos recurrentes (como las suscripciones) no emiten transacciones tentativas ni ensucian el libro mayor con marcas provisionales. **Lo propuesto vive fuera del libro diario; el asiento nace únicamente cuando el usuario lo confirma, y el puntero `resolved_through` actúa como la guarda de idempotencia y secuencia.**

### Tablas involucradas
*   [`subscriptions`](../src/features/subscriptions/schema.db.ts): Entidad del compromiso recurrente (`startDate`, `frequency`, `intervalCount`, `amount`, `currency`, `accountId`, `categoryId`, `resolvedThrough`).
*   [`ledgerTransactions`](../src/features/accounting/schema.db.ts): Asiento contable emitido al confirmar.
*   [`ledgerEntries`](../src/features/accounting/schema.db.ts): Débito en la cuenta de categoría de gasto y Crédito en la cuenta de pago.

### Principios e Invariantes del Circuito

1.  **Lo propuesto no entra al libro diario:**
    Se revoca el concepto de asientos con `needs_review: true`. El libro mayor es inmutable y sólo registra hechos económicos afirmados. La serie de cobros se proyecta en memoria mediante funciones matemáticas puras (`recurrenceService.ts`) a partir de `startDate` y `frequency`, anclando siempre en el día nominal de inicio para evitar la degradación de fin de mes.
2.  **Un solo campo en vez de una tabla de pendientes:**
    Los cobros pendientes se derivan al consultar la suscripción comparando las ocurrencias proyectadas con la columna `resolved_through` (tipo `date` civil `YYYY-MM-DD`). Toda ocurrencia cuya fecha de cobro sea menor o igual al puntero ya fue resuelta. No se materializan filas temporales de pendientes, eliminando la necesidad de procesos en segundo plano o crons de generación.
3.  **El puntero es la guarda de idempotencia y orden:**
    Al resolver una ocurrencia propuesta (`resolveSubscriptionAction.ts`), la acción exige que la fecha enviada sea **la más antigua pendiente** de esa suscripción. Si dos sesiones intentan confirmar el mismo período, la primera avanza el puntero y la segunda falla inmediatamente sin escribir ningún movimiento contable, garantizando idempotencia estricta sin consumir tablas adicionales de claves.
4.  **Atomicidad ACID estricta:**
    La emisión del asiento contable de partida doble, el avance del puntero `resolved_through` y el recálculo derivado de `next_payment_date` ocurren dentro de la misma transacción de base de datos. Si el puntero avanzó, el asiento contable existe; si algo falla, no se escribe nada.
5.  **Fecha civil y fecha de ocurrencia:**
    El asiento contable se emite con `occurredAt` fijado en la fecha nominal de la ocurrencia (no la fecha en que el usuario hace clic), preservando la exactitud de los cierres mensuales históricos. La evaluación de fechas se realiza siempre en la zona horaria del perfil del usuario en formato civil `YYYY-MM-DD` sin desfases de medianoche.
6.  **Concordancia de divisas:**
    La divisa de la suscripción y de la cuenta de pago deben coincidir estrictamente. El motor rechaza resolver la ocurrencia si las divisas difieren, impidiendo asientos desbalanceados o conversiones implícitas sin cotización real.

---

## 11. Limpieza Unificada de Base de Datos en Orden Topológico (Test Database Cleanup)

En FinanzIA, todas las suites de integración comparten la misma base de datos `finanzas_db_test`. La limpieza de tablas entre casos de prueba no debe definirse de forma aislada o manual en cada archivo de test, sino a través de una función centralizada que respete el grafo relacional estricto.

### Problema y Causa Raíz
Cuando cada suite mantiene su propia lista de `db.delete(...)`:
*   **Listas incompletas:** Nuevas tablas con claves foráneas `restrict` agregadas por una feature rompen silenciosamente los tests de otras features que no las incluyen en sus listas.
*   **Falta de limpieza de salida:** Si una suite no limpia al finalizar (`afterAll`), deja filas huérfanas para el siguiente archivo. Dado que Vitest reordena los archivos de prueba según su duración en la ejecución previa, los fallos aparecen de forma intermitente y no determinista según el orden de la corrida.
*   **Colisión simultánea vs. residuo secuencial:** `fileParallelism: false` en `vitest.config.ts` previene la contención y colisión simultánea de lecturas y escrituras concurrentes entre archivos; sin embargo, no previene el residuo secuencial entre suites. La limpieza determinista entre archivos es responsabilidad de `limpiarBase()`.

### Reglas e Invariantes

1.  **Función única y compartida (`src/shared/db/testCleanup.ts`):**
    Toda suite de integración consume exclusivamente `limpiarBase()`. Queda prohibido escribir bloques locales de `db.delete(...)` sin condiciones específicas en archivos de test.
2.  **Transaccionalidad atómica:**
    Los 18 borrados se ejecutan dentro de un único bloque transaccional `db.transaction( async ( tx ) => { ... } )`. Si cualquier eliminación es rechazada, toda la base vuelve a su estado previo sin dejar residuos parciales.
3.  **Orden topológico estricto por FK `restrict`:**
    Las tablas se vacían en orden inverso a sus dependencias obligatorias (`restrict`), de mayor dependencia a menor:
    1. `login_attempts` (sin FK)
    2. `idempotency_keys` (sin FK)
    3. `outbox_events`
    4. `monthly_summaries`
    5. `ledger_entries` (restrict a `accounts`; antes que `ledger_transactions`)
    6. `ledger_transactions`
    7. `card_accounts` (restrict a `accounts`; antes que `cards`)
    8. `cards` (restrict a `financial_entities` y `accounts`)
    9. `contact_payment_methods` (restrict a `financial_entities` y `contacts`)
    10. `contacts`
    11. `subscriptions` (antes que `accounts` y `categories`)
    12. `category_accounts` (restrict a `categories` y `accounts`)
    13. `accounts` (restrict a `financial_entities`)
    14. `financial_entities`
    15. `categories` (autorreferencia `restrict`)
    16. `profiles` (antes que `users`)
    17. `users`
    18. `organizations`
4.  **Resolución de autorreferencias en dos pasos (`categories`):**
    Al tener `parentId` con referencia `restrict` a la propia tabla `categories`, un `DELETE` plano sobre la tabla puede evaluar un padre antes que sus hijas y fallar. Se eliminan primero las hojas (`where( isNotNull( categories.parentId ) )`) y posteriormente los nodos raíz.
5.  **Limpieza de entrada y salida:**
    Las suites que interactúan con la base de datos ejecutan `await limpiarBase()` al inicio de cada caso (`beforeEach`) y garantizan un cierre limpio al finalizar el archivo (`afterAll( limpiarBase )`).

---

## 12. Montaje de Tests de Componentes Cliente (Client Component Test Harness)

Mientras que el [§11](#11-limpieza-unificada-de-base-de-datos-en-orden-topológico-test-database-cleanup) gobierna las suites de **integración** que interactúan contra PostgreSQL (`finanzas_db_test`) en entorno Node, esta sección gobierna las pruebas unitarias y de integración visual de **componentes cliente** ejecutadas sobre `jsdom` (`// @vitest-environment jsdom`).

Para evitar falsos positivos y componentes que fallan en producción por falta de traducciones o contextos faltantes, los tests de UI siguen cinco reglas estrictas de montaje:

### Reglas e Invariantes

1.  **El diccionario nunca es opcional:**
    Un componente cliente que renderiza texto traducible recibe `dict` como prop **obligatoria** (y `lang` correspondiente). Está prohibido definir diccionarios de respaldo embebidos (`FALLBACK_DICT`) en los componentes y prohibido el casteo `as unknown as` sobre la forma del diccionario: relajar la prop o falsear el tipo apaga la única verificación de que las claves existen con la misma estructura en `es.json`, `en.json` y `br.json`.
2.  **El test usa el diccionario real:**
    En lugar de armar diccionarios dummy o parciales, la suite carga el diccionario canónico real con `dict = await getDictionary( "es" )` dentro de un bloque `beforeAll`. De este modo, la ejecución de la prueba valida de forma pasiva que las claves accedidas por la interfaz existen en el archivo de localización.
3.  **Se mockea el framework, no el código del proyecto:**
    El archivo de configuración global `src/shared/lib/vitest.setup.mocks.ts` sólo puede mockear módulos de infraestructura o framework que en `jsdom` no existen (`next/cache`, `next/navigation`). Los contextos, hooks o stores propios del proyecto (como `NotificationsContext` o `NotificationsProvider`) deben montarse reales en el árbol de componentes. Si un caso de prueba extremo requiriera forzar un estado puntual de un contexto propio, el mock debe declararse **local al archivo de test**, jamás en el setup global, para no anular en silencio la suite propia de dicha feature.
4.  **Los dobles de framework son estables y aseverables:**
    Los dobles de Next.js provistos por el setup global se declaran mediante `vi.hoisted` y se exportan (ej: `routerMock` exportado desde `vitest.setup.mocks.ts`). Notar la restricción sintáctica: `export const x = vi.hoisted( ... )` **no compila** — el transformador de vitest corta con `SyntaxError: Cannot export hoisted variable`. La forma que funciona es declarar y exportar por separado:
    ```ts
    const routerMock = vi.hoisted( () => ( { push: vi.fn() , /* ... */ } ) ) ;

    export { routerMock } ;
    ```
    Esto garantiza que no se instancien objetos nuevos por cada invocación del hook, permitiendo a los tests espiar y aseverar sobre métodos como `routerMock.refresh()` o `routerMock.push()`. La suite que requiera aseverar sobre estos dobles es responsable de limpiar su estado en su propio `beforeEach`.
5.  **El Storage no está garantizado:**
    Todo acceso a `localStorage` desde código propio pasa por `readStorage`/`writeStorage` de `@/shared/lib/safeStorage`. Nunca `localStorage.getItem` directo, ni siquiera detrás de `typeof window !== "undefined"`: esa guardia cubre SSR pero no cubre ni al navegador con Storage bloqueado (donde **leer la propiedad** lanza `SecurityError`) ni a jsdom bajo Node, donde el accessor nativo devuelve `undefined`. Corolario explícito: **el harness de tests no debe polyfillear `localStorage`** — si un componente no monta en jsdom por Storage, el defecto está en el componente.

    **Única excepción, y es permanente:** el script de bloqueo anti-flash del `<head>` en [`src/app/[lang]/layout.tsx`](../src/app/[lang]/layout.tsx) lee `localStorage.getItem('theme')` directo. Es una cadena de JavaScript crudo inyectada por `dangerouslySetInnerHTML`, fuera del grafo de módulos: no puede importar el helper, y tiene que correr **antes** de que hidrate React o el tema parpadea. Cumple la regla por otra vía — su propio `try { … } catch (e) {}` envolvente, que es lo que la regla exige. **No migrarlo a `readStorage`**; si se toca, el `try/catch` se conserva y la clave debe seguir siendo la misma que escribe [`ProfileContext.tsx`](../src/features/profile/context/ProfileContext.tsx) (`"theme"`).

### Ejemplo de Referencia
La suite de [`CategoriesSettingsContainer.test.tsx`](../src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx) implementa este patrón íntegro: carga `getDictionary( "es" )` en `beforeAll`, envuelve el render con el `<NotificationsProvider>` real (que gracias a `safeStorage` monta de forma tolerante sin requerir dobles ni polyfills de storage en el harness) y delega en el `routerMock` hoisted del harness global.
