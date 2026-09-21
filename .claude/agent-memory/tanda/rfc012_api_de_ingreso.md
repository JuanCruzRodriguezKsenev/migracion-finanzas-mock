---
name: rfc012-api-de-ingreso
description: Contraste y reescritura del RFC 012 el 2026-09-21 — la API de ingreso de asientos, sus cuatro decisiones, y la maquinaria de idempotencia que ya existe y nadie usa.
metadata:
  type: project
---

# RFC 012, contrastado y reescrito el 2026-09-21 — en `DRAFT`

`docs/proposals/012-integrations-and-api-keys.md`. Es la puerta por la que una app satelital —la de
eventos, ver [[decision-eventos-app-aparte]]— le manda asientos al libro. **Ningún agente lo aprueba.**

## El hallazgo que más vale de toda la ronda

**`idempotency_keys` y `executeIdempotent< T >( key , callback )` ya están implementados y no los usa
nadie.** `accounting/schema.db.ts:120` y `shared/services/idempotencyService.ts:27`: reclamo de clave,
`responseBody` cacheado, TTL de 5 minutos para claves huérfanas en `PROCESSING`. **Cero consumidores
fuera de su propio archivo.** Es maquinaria construida para el endpoint del 012, que nunca existió.

**Su defecto, y por qué se arregla ahora:** `key` es `primaryKey()` **global, sin `organizationId`**.
Dos organizaciones con la clave `"evento-42"` colisionan. Cambiar la clave primaria hoy es una
migración sin datos; mañana, con el libro apoyado encima, no.

**Antes de ofrecer «creamos una tabla de X», grepear si X ya existe.** Ofrecí crearla en un
`AskUserQuestion` y ya estaba escrita: el usuario eligió con información mía incompleta y hubo que
volver atrás. Ver [[ciclo-de-trabajo]].

## Las cuatro decisiones del usuario

1.  **Partir el RFC.** Lo entrante queda en el 012; lo saliente —bancos, cotizaciones, mercados— se
    escinde al **RFC 026** (`docs/proposals/026-outbound-integrations.md`, `DRAFT`). *Por qué:* lo
    saliente arrastra un bloqueante real —**el repo no puede cifrar credenciales**, el único uso de
    `crypto` es `scrypt`, de una sola vía— que habría bloqueado la mitad que sí se puede construir.
2.  **El endpoint habla en vocabulario de dominio, por código de categoría**, no en partida doble
    cruda. *Por qué:* con `entries[]` la satelital tiene que conocer el plan de cuentas y acordarse de
    mandar `categoryId`, y olvidarlo deja la transacción fuera de la dimensión del RFC 022.
    **Verificado:** `categories_org_account_code_unique` sobre `(organizationId, accountCode)` hace que
    el código identifique la categoría sin ambigüedad.
3.  **Idempotencia en dos capas:** `executeIdempotent` protege el request; `external_id` único por
    organización en `ledger_transactions` protege el asiento **y deja linaje** —de qué registro externo
    vino—, que la tabla de claves no puede dar porque se borra si la operación falla.
4.  **`idempotency_keys` gana `organizationId`.**

## Lo que el contraste dejó verificado y sirve para cualquier ronda

*   **`createLedgerTransaction` es la única puerta al libro, a propósito.** Su comentario lo declara:
    la regla de divisa se valida ahí «para que ninguna vía de entrada —acción, seed, script o
    importador futuro— pueda saltearlo». Ningún handler escribe en `ledger_*` directo.
*   **El molde canónico de alta es `transactionsActions.ts:150-180`:** `resolveToLeaf( categoryId )` →
    `findOrCreateAccountForCurrency( … )` → dos patas → `categoryId` en la cabecera.
*   **La cuenta de una categoría es por divisa y su código es `` `${cat.accountCode}-${currency}` ``**
    → `4.1.01.99-ARS`. Un código sin sufijo de divisa no identifica una cuenta.
*   **SHA-256 para API keys es correcto y está escrito en el §0 para que nadie lo "corrija" a
    `scrypt`:** un token aleatorio de alta entropía no necesita KDF lento.
*   **No hay `middleware.ts` ni una sola columna array** en todo el esquema (cero `.array()`).
*   **`uniqueIndex` sobre columna anulable es lo que se quiere** para `external_id`: Postgres no
    considera iguales dos `null`, así que los asientos nacidos en la UI conviven sin chocar.
