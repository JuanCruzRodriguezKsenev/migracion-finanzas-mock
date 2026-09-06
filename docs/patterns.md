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
2.  **Invariante de balance cero:** Para cualquier transacción en `ledgerTransactions`, la suma de todos los débitos debe ser exactamente igual a la suma de todos los créditos:
    $$\sum \text{debit} = \sum \text{credit}$$
3.  **No negatividad en líneas:** Las columnas `debit` y `credit` son enteros $\ge 0$. La dirección del saldo se determina por el tipo de cuenta:
    *   **Activos / Gastos:** Aumentan por el Débito (Debe), disminuyen por el Crédito (Haber).
    *   **Pasivos / Patrimonio / Ingresos:** Aumentan por el Crédito (Haber), disminuyen por el Débito (Debe).
4.  **Cálculo de Patrimonio Neto (Net Worth):**
    $$\text{Patrimonio Neto} = \text{Activos} - \text{Pasivos}$$

### Implementación
*   Servicio central: [`accountingService.ts`](../src/features/accounting/services/accountingService.ts).
*   Validación de balance en runtime: [`accountingService.ts`](../src/features/accounting/services/accountingService.ts) rechaza la transacción si $\sum \text{debit} \neq \sum \text{credit}$ antes de persistir.

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
