# RFC 012: API de ingreso de asientos para aplicaciones satelitales

*   **ID de la Propuesta:** 012
*   **Título:** `api_keys`, el endpoint `POST /api/v1/transactions` en vocabulario de dominio, e idempotencia en dos capas
*   **Estado:** `DRAFT` — **no habilita código hasta que el usuario lo apruebe.** Reescritura completa.
*   **Fecha de Creación:** 2026-06-22 (versión original) · **Reescrito:** 2026-09-21
*   **Autor:** `tanda` (reescritura) · Antigravity (versión original de junio de 2026)
*   **Origen:** la decisión del 2026-09-21 de que los eventos de reparto de gastos vivan en una aplicación aparte ([RFC 003 §0 bis](003-event-splitting.md)). Esta propuesta es la puerta por la que esa aplicación —y cualquier otra satelital— le manda asientos al libro.
*   **Reemplaza:** la versión `APPROVED` del 2026-06-23 **en su totalidad**. Esa versión es anterior al core contable (RFC 018), a la migración a `bigint` (RFC 019), a la clasificación unificada (RFC 022) y al RFC 023.
*   **Escisión:** **las integraciones salientes salen de este RFC.** Bancos, cotizaciones y mercados se van a [RFC 026](026-outbound-integrations.md). Ver §2.1.

---

## 0. Contraste contra el código real (2026-09-21)

La versión de junio estuvo `APPROVED` quince meses **sin una sola línea de código**, o sea que durante quince meses autorizó formalmente a escribir este endpoint con el modelo viejo. Es la cuarta vez que este repositorio se encuentra con lo mismo, después del 008, el 010 y el 003.

**Lo que no existe, verificado contra el esquema y contra la base real:** no hay `src/app/api/v1/`, no hay `middleware.ts`, y no existen las tablas `api_keys` ni `integrations`. Las únicas rutas de API del repositorio son `auth` y `brand`.

### Lo que la versión de junio acertó, y se conserva

*   **La doctrina del §1**, textual: «mantener separada la lógica específica de otros negocios en sus propias aplicaciones mantiene nuestro núcleo financiero limpio, mientras que la integración vía API unifica la contabilidad». Es la que sostiene la decisión sobre los eventos, y no se toca.
*   **El import de `organizations`** apunta bien: vive en [`auth/schema.db.ts:9`](../../src/features/auth/schema.db.ts).
*   **Los importes del ejemplo están en centavos** (`2500000` = $25.000,00). Anticipó el RFC 019 sin saberlo.
*   **Hashear la API key con SHA-256 está bien, y no hay que "corregirlo" a `scrypt`.** El repositorio deriva contraseñas con `scrypt` (`N: 131072`, el mínimo que recomienda OWASP, en [`authService.ts`](../../src/features/auth/services/authService.ts)), pero eso es para secretos de baja entropía elegidos por humanos. Una API key es un token aleatorio de 256 bits: un KDF lento no agrega seguridad y sí agrega latencia a cada request. **Queda escrito para que ninguna ronda futura lo cambie creyendo que corrige un descuido.**

### Desalineamientos de forma

| Lo que decía la versión de junio | Lo que el repositorio ya decidió |
| :--- | :--- |
| `text("type")`, `text("provider")`, `text("name")` | `varchar( … , {length: N} )` en todo el esquema vigente. `text()` queda para lo genuinamente ilimitado: `passwordHash`, `bio`, `responseBody` |
| `timestamp("created_at")` | `timestamp( … , {withTimezone: true} )`, sin excepción en el esquema |
| `isActive: boolean` | Baja lógica con `archivedAt: timestamp`. Mismo defecto que tenía el RFC 003 de junio |
| `scopes: text().array()` | **No hay una sola columna array en todo el esquema**: cero coincidencias de `.array()`. Es un constructo sin precedente |
| `credentials: jsonb` «cifradas» | El esquema las guarda en jsonb plano y **no se especifica mecanismo alguno**. El repositorio no tiene cifrado reversible: el único uso de `crypto` es `scrypt`, que es de una sola vía. **Se va con la escisión al RFC 026, que es donde ese problema hay que resolver** |

### Desalineamientos de fondo: el contrato no podía ejecutarse

1.  **Hablaba en `account_code` y el motor habla en `accountId`.** [`createLedgerTransaction`](../../src/features/accounting/services/accountingService.ts) recibe `entries[].accountId` (uuid) y bloquea cada cuenta con `FOR UPDATE` antes de tocar un saldo.
2.  **El código del ejemplo no existe con esa forma.** Desde el RFC 022, la cuenta contable de una categoría es **por divisa y se crea a demanda**, y su código se arma como `` `${cat.accountCode}-${currency}` `` → `4.1.01.99-ARS`. El `4.1.01.01` del ejemplo falla dos veces: sin sufijo de divisa, y **la hoja de una categoría sin subcategorías es `.99 General`**, no `.01`.
3.  **El payload no tenía dónde poner la categoría.** El molde canónico es [`transactionsActions.ts:150-180`](../../src/features/transactions/actions/transactionsActions.ts): `resolveToLeaf( categoryId )` → `findOrCreateAccountForCurrency( … )` → arma los dos asientos → **escribe `categoryId` en la cabecera**. Toda transacción entrada por el endpoint de junio habría quedado con `categoryId = null`: invisible para la dimensión que el RFC 022 construyó entera.
4.  **No había idempotencia, y el libro es inmutable.** Un reintento por timeout emitía un segundo asiento, y corregirlo exige contra-asentar a mano. Ver §6, y el hallazgo que lo vuelve barato.
5.  **`posted_at` no existe:** la columna es `occurred_at` ([`schema.db.ts`](../../src/features/accounting/schema.db.ts)).

---

## 1. El agujero de fondo: el libro no tiene puerta de entrada

El repositorio se define como libro mayor central, y **la única forma de escribir en él es una server action detrás de una sesión de NextAuth**. Una aplicación satelital —la de eventos, la de la pastelería, cualquiera— no tiene forma de asentar nada.

Esto no es una carencia de comodidad: es lo que obliga a que cada dominio nuevo se implemente **adentro** de la aplicación de finanzas, que es exactamente lo que el §1 de la versión de junio dice que no hay que hacer, y lo que la decisión sobre los eventos vino a cortar.

### Objetivos

1.  **Una credencial por aplicación satelital**, revocable, con permisos acotados y rastro de uso.
2.  **Un endpoint que reciba hechos económicos**, no asientos: la satelital no tiene que saber partida doble (§4).
3.  **Idempotencia real**, en dos capas, para que un reintento no ensucie un libro que no se puede limpiar (§6).

### No objetivos

*   **Integraciones salientes** (bancos, cotizaciones, mercados). Escindidas al [RFC 026](026-outbound-integrations.md).
*   **Lectura por API.** Este RFC especifica sólo escritura de transacciones. Ver §9.
*   **OAuth, o un modelo de permisos por usuario.** Una API key representa a una organización, no a una persona.

---

## 2. Las cuatro decisiones, tomadas por el usuario el 2026-09-21

### 2.1 Se parte en dos: lo entrante acá, lo saliente al RFC 026

La versión de junio mezclaba dos cosas que no comparten nada salvo la palabra «integración»: **traer** datos de un banco y **recibir** asientos de una app propia. Difieren en dirección, en seguridad, en frecuencia y en modelo de datos.

**Y la mitad saliente arrastra un problema sin resolver** —cifrado reversible de credenciales, que el repositorio hoy no puede hacer— que habría bloqueado la mitad entrante, que sí se puede construir hoy. Es el precedente del 008 → 025 y del 010 → inquilinos.

### 2.2 El endpoint habla en vocabulario de dominio, direccionado por código de categoría

**La satelital manda el hecho económico; finanzas arma el asiento.** No manda `entries[]`, no conoce uuid de cuentas contables, no sabe qué es un débito.

*Por qué:* con partida doble cruda, la satelital tendría que conocer el plan de cuentas de finanzas y acordarse de mandar `categoryId`, y olvidarlo deja la transacción fuera de toda la dimensión de categoría. Con vocabulario de dominio, **la categoría es obligatoria por construcción** y el asiento desbalanceado es imposible de expresar.

**Direccionar por código es correcto y está verificado:** `categories` tiene `uniqueIndex( "categories_org_account_code_unique" ).on( organizationId , accountCode )`, así que el código identifica una categoría sin ambigüedad dentro de la organización, y la organización la fija la API key. El instinto de la versión de junio —hablar en códigos— era bueno; lo que estaba mal era **qué** código y **contra qué**.

*Lo que se resigna:* un asiento de más de dos patas (una venta con IVA y descuento en una sola operación) no se puede expresar. Se declara abierto en §9; el día que haga falta es una enmienda, no un rediseño.

### 2.3 Idempotencia en dos capas, porque una sola no alcanza

**Hallazgo que cambió la decisión:** `idempotency_keys` ([`accounting/schema.db.ts:120`](../../src/features/accounting/schema.db.ts)) y `executeIdempotent< T >( key , callback )` ([`shared/services/idempotencyService.ts:27`](../../src/shared/services/idempotencyService.ts)) **ya están implementados**: reclaman la clave, cachean el `responseBody`, y recuperan claves huérfanas con un TTL de 5 minutos en `PROCESSING`.

**No los usa nadie:** cero consumidores fuera de su propio archivo. Es maquinaria construida para un endpoint de API que nunca existió — éste.

Las dos capas no compiten, protegen cosas distintas:

*   **`executeIdempotent` protege el request.** Ante un reintento devuelve la misma respuesta sin volver a ejecutar, sirva para el endpoint que sirva.
*   **`external_id` protege el asiento y deja linaje.** La tabla de claves guarda una respuesta serializada y **se borra si la operación falla**; no puede decir, mirando un asiento, de qué venta o de qué evento vino.

### 2.4 `idempotency_keys` gana `organizationId` ahora, que sale gratis

Su `key` es `primaryKey()` **global**. Dos organizaciones que manden la clave `"evento-42"` colisionan: la segunda recibiría la respuesta cacheada de la primera. **Es un defecto de aislamiento multi-tenant**, de la clase que el §8.3 de `.agents/AGENTS.md` trata como regla dura.

Se corrige ahora porque **la tabla no tiene un solo consumidor**: cambiarle la clave primaria hoy es una migración sin datos que migrar, y mañana es una migración con el libro entero apoyado encima.

### Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Un `middleware.ts` global | La autenticación por API key vale **sólo** para `/api/v1/*`. Un middleware global corre en toda la aplicación, incluidas las rutas de NextAuth, para resolver algo que es de un prefijo. Se resuelve en el handler de la ruta |
| Escribir en `ledger_transactions` o `ledger_entries` desde el handler | **`createLedgerTransaction` es la única puerta al libro, a propósito.** Su propio comentario lo declara: la regla de divisa se valida ahí «para que ninguna vía de entrada —acción, seed, script o importador futuro— pueda saltearlo». Este endpoint es exactamente ese importador futuro |
| Reimplementar la idempotencia | Ya está escrita y probada. Ver §2.3 |
| Cambiar el hash de la API key a `scrypt` | Ver §0. Es correcto con SHA-256, y está explicado para que no se "corrija" |
| `scopes` como columna array | Sin precedente en el esquema. Ver §3 |
| Un modelo de usuarios o de OAuth para las satelitales | Una llave representa a una organización. Si alguna vez hace falta granularidad por persona, es propuesta propia |
| Tocar `financialEntities`, `accounts` o el catálogo | Este RFC no crea cuentas ni categorías: usa las que existen, y falla con error explícito si el código no resuelve |

---

## 3. Esquema de base de datos

```typescript
/**
 * Credencial de una aplicación satelital que asienta contra el libro de esta organización.
 * Se guarda el hash SHA-256 de la llave, nunca la llave.
 */
export const apiKeys = pgTable( "api_keys" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  name:    varchar( "name"     , {length: 100} ).notNull() , // Ej: "App de eventos"
  keyHash: varchar( "key_hash" , {length: 64 } ).notNull().unique() , // SHA-256 en hexadecimal: 64 caracteres exactos
  prefix:  varchar( "prefix"   , {length: 16 } ).notNull() , // Los primeros caracteres, para poder mostrarla sin revelarla

  expiresAt:  timestamp( "expires_at"  , {withTimezone: true} ) , // null = sin vencimiento
  lastUsedAt: timestamp( "last_used_at" , {withTimezone: true} ) ,
  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Revocación: baja lógica, como todo el esquema
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgIdx: index( "api_keys_org_idx" ).on( table.organizationId ) ,
} ) ; } ) ;

/**
 * Permiso concedido a una llave. Es tabla y no columna array porque el esquema no usa arrays,
 * y porque un permiso nuevo tiene que ser una fila y no una migración.
 */
export const apiKeyScopes = pgTable( "api_key_scopes" , {
  id:       uuid( "id"        ).primaryKey().defaultRandom() ,
  apiKeyId: uuid( "api_key_id" ).references( () => apiKeys.id , {onDelete: "cascade"} ).notNull() ,
  scope:    varchar( "scope" , {length: 50} ).notNull() , // 'transactions:write'
} , ( table ) => { return( {
  uniqueKeyScope: uniqueIndex( "api_key_scopes_key_scope_unique" ).on( table.apiKeyId , table.scope ) ,
} ) ; } ) ;
```

**Dos cambios sobre tablas existentes:**

```typescript
// ledger_transactions: el vínculo con el registro de la aplicación satelital.
  externalId: varchar( "external_id" , {length: 120} ) , // null en todo asiento nacido en la UI

// y su índice, que además es la guarda de idempotencia del asiento:
  uniqueOrgExternal: uniqueIndex( "ledger_tx_org_external_unique" ).on( table.organizationId , table.externalId ) ,

// idempotency_keys: deja de tener la clave como primaria global.
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  key:            varchar( "key" , {length: 255} ).notNull() ,
// con:
  uniqueOrgKey: uniqueIndex( "idempotency_keys_org_key_unique" ).on( table.organizationId , table.key ) ,
```

> **`uniqueIndex` sobre una columna que admite `null` es lo que se quiere acá:** Postgres no considera iguales dos `null`, así que los millones de asientos nacidos en la interfaz —todos con `externalId` en `null`— conviven sin violar la restricción, y dos asientos externos con el mismo `external_id` en la misma organización no pueden existir.

### 3.1 Decisiones de esquema y su fundamento

*   **`keyHash` en `varchar(64)`, no `text`.** Un SHA-256 en hexadecimal mide exactamente 64 caracteres. El largo fijo documenta el formato y el esquema no usa `text` para lo acotado.
*   **`prefix` es nuevo y no estaba en la versión de junio.** Sin él, la pantalla de administración no puede listar las llaves de forma reconocible: el hash no se puede revertir y la llave no se guarda. Con el prefijo se muestra `fin_live_a3f2…` y el usuario sabe cuál revocar.
*   **`archivedAt` en vez de `isActive`.** Revocar es una baja lógica, y así queda la fecha. Convención del esquema entero.
*   **`apiKeyScopes` es tabla.** Misma decisión que `eventExclusions` en el RFC 003: la alternativa —array o booleanos— convierte cada permiso nuevo en una migración, y acá además no hay un solo array en el esquema del que copiar.
*   **`externalId` en `varchar(120)`.** Suficiente para un identificador compuesto legible (`evento-42-cobro-carlos`) sin invitar a meter un payload adentro.

### 3.2 Radio de impacto

| Archivo | Qué hay que hacer |
| :--- | :--- |
| [`src/shared/db/schema.ts`](../../src/shared/db/schema.ts) | Re-exportar `apiKeys` y `apiKeyScopes` |
| [`src/features/accounting/schema.db.ts`](../../src/features/accounting/schema.db.ts) | `externalId` y su índice en `ledgerTransactions`; `id` + `organizationId` en `idempotencyKeys` |
| [`src/shared/services/idempotencyService.ts`](../../src/shared/services/idempotencyService.ts) | **Las siete consultas** del archivo filtran sólo por `key` (`:48`, `:73`, `:98`, `:121`, `:136`, `:145`): todas pasan a filtrar también por `organizationId`, y la firma de `executeIdempotent` lo recibe. **Hoy no lo llama nadie, así que no rompe a ningún consumidor** |
| [`src/shared/db/testCleanup.ts`](../../src/shared/db/testCleanup.ts) | `api_key_scopes` antes de `api_keys`, y las dos antes de `organizations`. **Los comentarios numeran del 1 al 19: insertar dos tablas renumera los siguientes. Usar anclas textuales, no números** |
| [`src/features/accounting/types.ts`](../../src/features/accounting/types.ts) | `CreateTransactionParams` suma `externalId?: string` |
| `src/features/accounting/services/accountingService.ts` | Propagar `externalId` a la cabecera. **Ningún otro cambio**: la validación por divisa, el bloqueo `FOR UPDATE` y la regla de balance cero quedan intactas |
| `src/app/api/v1/transactions/route.ts` | Nuevo. El handler: autentica, valida con Zod, resuelve códigos, delega en el servicio |
| `src/features/integrations/` | Feature nueva: DAL de llaves, generación, revocación, y el servicio de autenticación de la cabecera |
| **Migración** | Dos tablas nuevas, dos columnas y tres índices. `idempotency_keys` cambia de clave primaria: **sin datos que migrar**, porque nadie la usa |

---

## 4. El contrato del endpoint

`POST /api/v1/transactions`

```json
{
  "external_id":    "evento-42-cobro-carlos",
  "type":           "income",
  "amount":         1250000,
  "currency":       "ARS",
  "category_code":  "4.1.05",
  "account_id":     "9f1c…",
  "description":    "Recupero asado del viernes - Carlos",
  "occurred_at":    "2026-09-21T18:00:00.000Z"
}
```

| Campo | Regla |
| :--- | :--- |
| `external_id` | Obligatorio. El identificador del registro en la aplicación satelital. Es la guarda de idempotencia del asiento (§6) |
| `type` | `income` o `expense`. Determina qué pata va al debe y cuál al haber, igual que `transactionsActions` |
| `amount` | **Centavos enteros, positivo.** Un decimal se rechaza: el repositorio no acepta punto flotante en dinero |
| `currency` | Debe coincidir con la divisa de `account_id`. Si no, el motor rechaza con el error de divisa que ya existe |
| `category_code` | El código de la categoría, no de la cuenta: `4.1.05`. Finanzas lo resuelve con `resolveToLeaf()` y obtiene la cuenta por divisa con `findOrCreateAccountForCurrency()` |
| `account_id` | La cuenta real por donde se movió la plata (caja, banco). Es uuid porque no tiene código estable que la satelital pueda conocer |
| `occurred_at` | ISO 8601. Se mapea a `occurred_at`; si falta, `defaultNow()` |

**Lo que hace el handler, en orden:**

1.  Autentica la llave (§5) y obtiene `organizationId`.
2.  Valida el cuerpo con Zod. Un campo de más es un error, no un campo ignorado.
3.  Envuelve el resto en `executeIdempotent( organizationId , external_id , … )`.
4.  Resuelve `category_code` → categoría → **hoja** (`resolveToLeaf`) → **cuenta por divisa** (`findOrCreateAccountForCurrency`).
5.  Arma las dos patas según `type` y llama a **`createLedgerTransaction`**, que valida balance cero por divisa, bloquea las cuentas con `FOR UPDATE` y emite el evento outbox. **El handler no escribe en el libro.**

**Respuestas:** `201` con la transacción creada · `200` con la transacción existente si el `external_id` ya fue visto · `401` sin llave o llave inválida · `403` sin el scope `transactions:write` · `422` si el código de categoría no resuelve, la cuenta no es de la organización, o la divisa no coincide.

> **Los mensajes de error de este endpoint son prosa española**, porque salen de los `fail()` del servicio. Es la deuda declarada en `~/Boveda/Proyectos/migracion-finanzas-mock/Deuda.md` §3, y **este RFC no la abre ni la parchea**: una API que devuelve prosa en un idioma es un argumento más para el RFC que fije códigos de error, no una excepción a resolver acá.

---

## 5. Autenticación

1.  La satelital manda `Authorization: Bearer fin_live_<48 caracteres aleatorios>`.
2.  El handler calcula el SHA-256 de la llave **en memoria** y busca por `keyHash`. Nunca se guarda ni se registra la llave.
3.  Rechaza si no existe, si `archivedAt` no es nulo, o si `expiresAt` ya pasó.
4.  Asume `organizationId` de la llave. **Ese valor manda sobre cualquier cosa que venga en el cuerpo:** un `organization_id` en el payload se ignora, no se valida.
5.  Verifica que exista la fila `transactions:write` en `apiKeyScopes`.
6.  Actualiza `lastUsedAt` **fuera** de la transacción contable: que falle el sello de uso no puede abortar un asiento válido.

**La llave se muestra una sola vez, al crearla.** Después sólo queda su prefijo. Es lo que obliga a `prefix` a existir.

---

## 6. Idempotencia, en dos capas

**Capa 1 — el request.** `executeIdempotent( organizationId , external_id , callback )` reclama la clave en `idempotency_keys`; si ya está `COMPLETED`, devuelve el `responseBody` cacheado sin ejecutar nada. Si quedó `PROCESSING` más de 5 minutos, la considera huérfana y la recupera. **Ya está implementado**; lo único que cambia es que ahora recibe la organización (§2.4).

**Capa 2 — el asiento.** `uniqueIndex (organization_id, external_id)` sobre `ledger_transactions`. Si las dos peticiones entran **en paralelo** y las dos pasan la capa 1 antes de que ninguna termine, la segunda choca contra el índice único dentro de la transacción y hace rollback. **La base es el árbitro, no la aplicación.**

**Y el linaje, que es el beneficio que ninguna de las dos capas tenía por separado:** mirando un asiento se sabe de qué registro externo vino, porque `external_id` queda en la fila para siempre. La tabla de claves no puede darlo: guarda una respuesta serializada y se borra si la operación falla.

---

## 7. Verificación

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d api_keys"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d ledger_transactions"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d idempotency_keys"
```

`external_id` debe figurar como `varchar(120)` y aparecer el índice `ledger_tx_org_external_unique`. `key_hash`, como `varchar(64)`. En `idempotency_keys` debe figurar `organization_id` y el único sobre `(organization_id, key)`.

---

## 8. Casos de prueba que este RFC exige

1.  **Alta correcta:** un `income` con `category_code` válido emite dos patas, deja `categoryId` **no nulo** en la cabecera y devuelve `201`.
2.  **Reintento con el mismo `external_id`:** devuelve `200` con la transacción original y **no** emite un segundo asiento. `ledgerEntries` no crece.
3.  **Dos peticiones en paralelo con el mismo `external_id`:** una gana, la otra hace rollback contra el índice único. Queda **una** transacción.
4.  **Mismo `external_id` en dos organizaciones distintas:** las dos se asientan. Es el caso que la clave global de `idempotency_keys` rompía.
5.  **Categoría con subcategorías:** `category_code` de un padre resuelve a su hoja, no al padre.
6.  **Categoría sin subcategorías:** resuelve a su hoja `.99 General`, con el respaldo `findOrCreateTypeGeneralLeaf`.
7.  **Divisa que no coincide con la cuenta:** rechazado con `422`, y **ningún saldo se movió**.
8.  **`account_id` de otra organización:** rechazado. Es la prueba de aislamiento del endpoint.
9.  **Llave revocada (`archivedAt`) o vencida (`expiresAt`):** `401`.
10. **Llave sin el scope `transactions:write`:** `403`.
11. **`organization_id` inyectado en el cuerpo:** se ignora; el asiento cae en la organización de la llave.
12. **Importe con decimales, o negativo:** rechazado por Zod antes de tocar el motor.

---

## 9. Lo que este RFC deja abierto

*   **Asientos de más de dos patas.** Una venta con IVA y descuento en una sola operación no se puede expresar en este contrato (§2.2). El día que haga falta, la forma es agregar un modo `entries[]` **sin quitar** el de dominio, y con la categoría igual de obligatoria.
*   **Lectura por API.** `accounts:read`, saldos, listados. El modelo de scopes ya lo contempla; el endpoint no existe.
*   **Purga de `idempotency_keys`.** El outbox tiene purga de `SENT` a los 30 días; esta tabla no tiene ninguna. Con un solo consumidor crece despacio, pero crece.
*   **Límite de tasa (rate limiting).** Una llave comprometida hoy puede asentar sin techo. El repositorio tiene Redis en el inventario de infraestructura por portar, que es donde esto vive.
*   **Rotación de llaves sin corte de servicio.** Hoy: se crea una nueva, se cambia en la satelital, se revoca la vieja. Una ventana de dos llaves activas alcanza, pero no está especificada.
*   **Webhooks de salida hacia la satelital.** El outbox (RFC 020) ya empaqueta y despacha eventos con reintentos; falta el registro de suscriptores. Es la mitad simétrica de este RFC y no se necesita para que la app de eventos funcione.
*   **Las integraciones salientes**, escindidas al [RFC 026](026-outbound-integrations.md).
