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
    *   **Pasivos / Patrimonio / Ingresos:** Aumentan por el Crédito (Haber), disminuyen por el Débito (Debe).
5.  **Cálculo de Patrimonio Neto (Net Worth):**
    $$\text{Patrimonio Neto} = \text{Activos} - \text{Pasivos}$$

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
*   [`outboxEvents`](../src/features/accounting/schema.db.ts#L94-L104):
    *   `organizationId`: Tenancy del evento.
    *   `eventType`: Identificador del evento de dominio (ej. `TRANSACTION_CREATED`).
    *   `payload`: Datos del evento en `jsonb`.
    *   `status`: Máquina de estados (`PENDING` $\rightarrow$ `SENT` / `FAILED`).
    *   `attempts`: Contador de reintentos con backoff.

### Garantía ACID
El evento outbox **se persiste dentro de la misma transacción de base de datos** (`tx`) que registra el asiento contable en `ledgerEntries`:
*   Si la base de datos comitea, tanto el libro contable como el evento outbox quedan guardados atómicamente.
*   Si la transacción hace rollback, no queda ningún evento huérfano.
*   Un despachador desacoplado (Worker / Cron) procesa los eventos `PENDING` con entrega al menos una vez (*at-least-once delivery*).

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
