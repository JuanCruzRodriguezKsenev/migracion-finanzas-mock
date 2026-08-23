# RFC 020: Worker Consumidor del Patrón Outbox

*   **ID de la Propuesta:** 020
*   **Título:** Dispatcher de Eventos Outbox — Consumo, Reintentos y Purga
*   **Estado:** `DRAFT` (Borrador - 2026-07-08)
*   **Fecha de Creación:** 2026-07-08
*   **Autor:** Claude (AI Coding Assistant) — a partir de auditoría de código

---

## 1. Contexto y Problema

El esquema define la tabla `outbox_events` ([schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/schema.db.ts):94-103) para implementar el patrón *Transactional Outbox*: garantizar que los eventos de negocio (`TRANSACTION_CREATED`, `TRANSACTION_DELETED`) se registren atómicamente junto con la transacción contable que los origina, para luego propagarlos de forma confiable (webhooks, notificaciones, sincronización externa).

`accountingService.ts` ya **escribe** en esta tabla dentro de la misma transacción ACID de creación/eliminación de asientos (líneas 109 y 180). Sin embargo, **no existe ningún proceso que lea y procese estos eventos**. El resultado actual:

*   La tabla crece indefinidamente sin límite (cada transacción contable inserta una fila que nunca se marca `SENT` ni se purga).
*   Las columnas `status`, `attempts` y `processed_at` del esquema están definidas pero jamás se actualizan.
*   No hay ninguna integración externa (webhook, cola, etc.) que reciba estos eventos — el patrón está a medio implementar.

Este RFC decide si se completa la infraestructura (worker consumidor) o se remueve, evitando dejar código muerto/incompleto en producción.

---

## 2. Decisión Propuesta

**Completar el patrón** con un worker de polling, dado que:
1. El *write path* ya existe y está probado (forma parte del mismo `db.transaction()` que persiste los asientos — ver `accountingService.ts`).
2. Revertir el *write path* implicaría modificar el core contable ya estable, arriesgando la garantía transaccional actual.
3. El patrón Outbox es la base necesaria para features futuras ya proyectadas en otros RFCs de este mismo directorio (ej. sincronización con integraciones externas).

---

## 3. Propuesta de Diseño

### A. Ubicación

`src/features/accounting/services/outboxDispatcher.ts`, invocado por un script `src/shared/db/dispatchOutbox.ts` ejecutable vía `pnpm tsx` (análogo a `seed.ts`), o por un cron/endpoint dedicado según la plataforma de despliegue elegida (fuera del alcance de este RFC).

### B. Algoritmo de Consumo

```typescript
async function dispatchPendingEvents( batchSize: number = 50 ): Promise< void > {
  await db.transaction( async ( tx ) => {
    // SKIP LOCKED evita que múltiples instancias del dispatcher compitan por el mismo evento
    const pending = await tx
      .select()
      .from( outboxEvents )
      .where( eq( outboxEvents.status , "PENDING" ) )
      .orderBy( outboxEvents.createdAt )
      .limit( batchSize )
      .for( "update" , { skipLocked: true } ) ;

    for( const event of pending ) {
      try {
        await handleEvent( event ) ; // despacha según event.eventType
        await tx.update( outboxEvents )
          .set( { status: "SENT" , processedAt: new Date() } )
          .where( eq( outboxEvents.id , event.id ) ) ;
      } catch( error ) {
        const attempts = event.attempts + 1 ;
        await tx.update( outboxEvents )
          .set( {
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING" ,
            attempts ,
          } )
          .where( eq( outboxEvents.id , event.id ) ) ;
      }
    }
  } ) ;
}
```

### C. Reintentos y Purga

*   `MAX_ATTEMPTS` (ej. 5) antes de marcar `FAILED` definitivamente — un evento `FAILED` requiere intervención manual o reproceso explícito.
*   Job de limpieza periódico: eliminar eventos `SENT` con `processed_at` mayor a N días (ej. 30), para no acumular historial indefinido.

### D. Alcance de `handleEvent`

Este RFC **no define** los destinos concretos de los eventos (webhooks externos, colas, etc.) — eso corresponde a un RFC de integración posterior (ver referencia a RFC 012 de integraciones y API keys). Aquí solo se especifica el mecanismo de consumo, marcado de estado y reintentos.

---

## 4. Impacto

*   **Código de aplicación:** nuevo archivo de servicio, sin tocar `accountingService.ts` (el *write path* ya es correcto).
*   **Operación:** requiere decidir el mecanismo de disparo periódico (cron externo, endpoint invocado por un scheduler, etc.) — decisión de infraestructura fuera del alcance de este RFC.
*   **Datos existentes:** los eventos `PENDING` ya acumulados en la tabla serán procesados en el primer ciclo del dispatcher.

---

## 5. Plan de Testing

`src/features/accounting/services/outboxDispatcher.test.ts`:
1. Evento `PENDING` se marca `SENT` tras despacho exitoso.
2. Evento cuyo `handleEvent` lanza error incrementa `attempts` y permanece `PENDING` (si no alcanzó `MAX_ATTEMPTS`).
3. Evento que agota `MAX_ATTEMPTS` se marca `FAILED`.
4. Dos ejecuciones concurrentes del dispatcher no procesan el mismo evento dos veces (verificar `SKIP LOCKED`).

---

## 6. Alternativas Consideradas

*   **Eliminar el *write path* del outbox:** rechazado — perdería la garantía transaccional ya lograda entre asiento contable y evento de negocio, que es exactamente el problema que el patrón Outbox resuelve.
*   **Cola externa (ej. Redis, SQS) en vez de polling sobre Postgres:** más escalable a largo plazo, pero agrega una dependencia de infraestructura nueva; se descarta por ahora dado el volumen actual del proyecto. Puede reconsiderarse en un RFC futuro si el volumen de eventos lo justifica.
