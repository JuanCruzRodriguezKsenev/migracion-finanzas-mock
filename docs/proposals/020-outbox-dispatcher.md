# RFC 020: Worker Consumidor del Patrón Outbox

*   **ID de la Propuesta:** 020
*   **Título:** Dispatcher de Eventos Outbox — Consumo Desacoplado, Reintentos, Recuperación y Purga
*   **Estado:** `APPROVED` (Aprobado - 2026-09-07)
*   **Fecha de Creación:** 2026-07-08 (Enmendado: 2026-09-07)
*   **Autor:** Claude & Antigravity (AI Coding Assistants)

---

## 1. Contexto y Problema

El esquema define la tabla `outbox_events` ([`src/features/accounting/schema.db.ts:106-116`](../src/features/accounting/schema.db.ts)) para implementar el patrón *Transactional Outbox*: garantizar que los eventos de negocio se registren atómicamente junto con las mutaciones contables que los originan, para luego propagarlos de forma confiable hacia el exterior (webhooks, notificaciones, sincronización externa).

Actualmente, el núcleo contable (`accountingService.ts`) ya **escribe** en esta tabla dentro de las transacciones ACID de negocio, emitiendo 4 tipos de eventos de dominio:
1. `TRANSACTION_CREATED` (al asentar un asiento de diario contable).
2. `TRANSACTION_DELETED` (al eliminar un movimiento contable).
3. `TRANSACTION_METADATA_UPDATED` (al editar descripción, categoría o comercio).
4. `TRANSACTION_REVERSED` (al emitir una reversión contable espejo).

Sin embargo, **no existe ningún proceso que lea y procese estos eventos**. Como consecuencia:
*   La tabla crece indefinidamente sin límite (cada movimiento financiero inserta una fila que nunca se marca `SENT` ni se purga).
*   Las columnas `status`, `attempts` y `processed_at` jamás se actualizan.
*   La tabla carece de un índice sobre `status`, lo que causaría sequential scans degradantes a medida que la tabla acumule registros.
*   El patrón se encuentra a medio implementar.

Este RFC define la arquitectura del despachador desacoplado, los mecanismos de tolerancia a fallos y la purga histórica para completar la infraestructura sin comprometer el rendimiento de la base de datos.

---

## 2. Decisión Propuesta

**Completar el patrón** mediante un despachador en tres fases independientes (reclamar $\rightarrow$ despachar $\rightarrow$ asentar), dado que:
1. El *write path* ya existe y es transaccionalmente seguro.
2. Revertir el *write path* destruiría la capacidad de emitir eventos confiables hacia integraciones futuras (RFC 012).
3. Desacoplar el I/O de red de la transacción de base de datos protege los pools de conexiones y previene bloqueos prolongados de filas.

---

## 3. Propuesta de Diseño y Arquitectura

### A. Desacoplamiento de I/O de Red (Ciclo en 3 Pasos)

El algoritmo inicial que envolvía el lote completo y las llamadas de red dentro de un único bloque transaccional largo (`db.transaction`) es rechazado: un webhook lento o caído retendría bloqueos `FOR UPDATE` sobre múltiples filas y agotaría el pool de conexiones de Postgres. Si la transacción abortaba, se perdían además los contadores de intentos (`attempts`).

Se adopta un **modelo de ejecución en 3 pasos**:

1. **Paso 1: Reclamo atómico en transacción corta:**
   * Abre una micro-transacción de base de datos.
   * Selecciona un lote de hasta `batchSize` eventos con `status = 'PENDING'` usando `SELECT ... FOR UPDATE SKIP LOCKED` (garantizando concurrencia segura sin colisiones entre múltiples instancias del worker).
   * Actualiza inmediatamente el estado de las filas seleccionadas a `PROCESSING` con la marca de tiempo de inicio.
   * Cierra la transacción de base de datos de inmediato, liberando las conexiones.

2. **Paso 2: Despacho asíncrono fuera de transacción de DB:**
   * Itera sobre el lote reclamado ejecutando los handlers de evento en memoria / red (I/O externo).
   * Si un handler falla o excede un timeout, se captura el error de forma aislada sin afectar a los demás eventos del lote.

3. **Paso 3: Asentamiento final en micro-transacción corta:**
   * Para eventos exitosos: actualiza `status = 'SENT'`, `processedAt = now()`.
   * Para eventos fallidos: incrementa `attempts = attempts + 1`. Si `attempts >= MAX_ATTEMPTS` (5), pasa a `status = 'FAILED'`; de lo contrario, retorna a `status = 'PENDING'` para reintento en el siguiente ciclo.

### B. Máquina de Estados y Recuperación de Huérfanos

Los estados de un evento en `outbox_events.status` son:
* `PENDING`: Evento nuevo listo para despacho o pendiente de reintento.
* `PROCESSING`: Evento reclamado temporalmente por un worker activo.
* `SENT`: Evento entregado y procesado exitosamente.
* `FAILED`: Evento que agotó el máximo de reintentos (`attempts >= 5`).

**Barrido de Recuperación de Huérfanos (`recoverStaleProcessing`):**
Si el proceso del worker muere repentinamente (crash del contenedor, SIGKILL, timeout del sistema) mientras ejecutaba el Paso 2, los eventos quedarían colgados indefinidamente en `PROCESSING`.
El despachador ejecutará al inicio de cada ciclo un barrido que busque eventos con `status = 'PROCESSING'` cuya antigüedad supere `PROCESSING_TTL_MS` (ej. 5 minutos), devolviéndolos automáticamente a `PENDING` para su reprocesamiento.

### C. Registro de Manejadores (`EventHandlerRegistry`) y Alcance Actual

Este RFC **no implementa los webhooks de negocio definitivos** (los cuales corresponden al RFC 012 de Integraciones y API Keys).
Para evitar marcar eventos como `SENT` de forma engañosa y a la vez permitir probar el ciclo completo:
* Se implementa un **Registry tipado de Handlers** que asocia cada uno de los 4 tipos de eventos (`TRANSACTION_CREATED`, `TRANSACTION_DELETED`, `TRANSACTION_METADATA_UPDATED`, `TRANSACTION_REVERSED`) con una función despachadora.
* En esta fase, los handlers por defecto ejecutan una operación controlada con registro estructurado mediante `logger.info`, validando la integridad del payload.
* El módulo queda preparado como un punto de extensión desacoplado para que el RFC 012 registre sus listeners HTTP/Webhooks sin tocar el motor de outbox.

### D. Purga Histórica Automática

Para evitar el crecimiento indefinido de la tabla `outbox_events`:
* Se implementa la función `purgeOldSentEvents( retentionDays: number = 30 )`.
* Elimina en lotes las filas con `status = 'SENT'` cuyo `processed_at` sea anterior a los últimos 30 días.

---

## 4. Impacto en Base de Datos y Código

1. **Esquema de Base de Datos (`src/features/accounting/schema.db.ts`):**
   * Actualizar documentación del campo `status` para reflejar `'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED'`.
   * Agregar índice parcial en la definición de la tabla:
     ```typescript
     outboxStatusCreatedIdx: index( "outbox_status_created_idx" )
       .on( table.status , table.createdAt )
       .where( sql`status IN ('PENDING', 'PROCESSING')` )
     ```
     (o índice sobre `status, created_at` optimizado para el filtro del worker).
2. **Migración Drizzle 0016:** Generación y aplicación de la migración para el nuevo índice de performance.
3. **Servicio y Script de Ejecución:**
   * `src/features/accounting/services/outboxDispatcher.ts`: Núcleo de reclamo, despacho, reintentos, recuperación y purga.
   * `src/shared/db/dispatchOutbox.ts`: Punto de entrada CLI manual ejecutable con `pnpm db:outbox`.
   * Script `package.json`: `"db:outbox": "pnpm tsx src/shared/db/dispatchOutbox.ts"`.

---

## 5. Plan de Pruebas Unitarias e Integración

`src/features/accounting/services/outboxDispatcher.test.ts`:
1. **Despacho exitoso:** Evento `PENDING` pasa por `PROCESSING` y finaliza en `SENT` con `processedAt` seteado.
2. **Reintento ante fallos:** Handler que lanza error incrementa `attempts` y vuelve a `PENDING`.
3. **Agotamiento de reintentos:** Al alcanzar `MAX_ATTEMPTS = 5`, el evento se marca como `FAILED`.
4. **Recuperación de huérfanos:** Evento congelado en `PROCESSING` hace más de 5 minutos vuelve a `PENDING`.
5. **Aislamiento concurrente (SKIP LOCKED):** Dos invocaciones paralelas no reclaman los mismos IDs de evento.
6. **Purga histórica:** Eventos `SENT` de más de 30 días son eliminados; eventos recientes se conservan.

---

## 6. Alternativas Descartadas

* **I/O síncrono dentro de la transacción Drizzle:** Descartado por saturación de pools de conexiones y riesgo de bloqueos prolongados.
* **Cola de mensajes externa (RabbitMQ, AWS SQS, Upstash QStash):** Se difiere para fases posteriores cuando el volumen justifique la infraestructura adicional. El polling con `SKIP LOCKED` sobre Postgres es el estándar canónico para este volumen.
