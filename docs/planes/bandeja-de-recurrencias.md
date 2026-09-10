# Plan — Bandeja de recurrencias y confirmación al libro mayor (RFC 023)

*   **RFC:** [`../proposals/023-proposed-transactions.md`](../proposals/023-proposed-transactions.md) — `APPROVED` (2026-09-10). Su §0 lista lo que se contrastó contra el código real; leerlo antes de empezar.
*   **Enmienda asociada:** el [RFC 004](../proposals/004-subscriptions-management.md) §3 y §4 quedaron **revocados** (su nueva §6). No implementar nada de esas dos secciones.
*   **Decisiones de origen:** §2 de [`../diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md).
*   **Rama:** `feat/bandeja-recurrencias`, encadenada sobre `master`.
*   **Línea base verificada** (subagente `verificador`, 2026-09-10, sobre `master` en `2ae7186`):
    **51 archivos de test, 376 tests, lint 0 errores / 0 warnings, `tsc --noEmit` 0 errores, build
    verde**, con la compuerta CI remota en verde. Si algo sale en rojo antes de tocar nada, es
    entorno: ver la nota al final.

---

## Qué se construye y por qué

Hoy una suscripción es una fila bonita en un treemap: **no toca la contabilidad**. El usuario carga
Netflix y el libro mayor no se entera nunca.

Esta tanda cierra ese circuito, pero **sin meter supuestos en el libro**: la suscripción *pregunta*
una vez por período, y sólo cuando la persona confirma nace el asiento. Es la decisión que el diseño
tomó y que revoca el `needs_review` del RFC 004.

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo. **Si el plan parece pedir que escribas algo de esto de nuevo, está
mal leído.**

| Pieza | Dónde | Qué hace |
| :--- | :--- | :--- |
| `createLedgerTransaction` | `accounting/services/accountingService.ts:29` | Asiento ACID. Exige `organizationId` **explícito**; acepta `categoryId`, `description`, `merchantName`, `merchantDomain`, `occurredAt`, `entries`. Valida Debe = Haber **por divisa, adentro** |
| `findOrCreateGeneralLeaf` | `accounting/repositories/categoryRepository.ts:122` | Hoja `General` (`.99`) de un padre, bajo demanda |
| `findOrCreateAccountForCurrency` | `categoryRepository.ts` | Cuenta contable de una categoría en una divisa |
| `recortarDia` / `diasEnMes` | `cards/utils/ciclo.ts:35,48` | **El patrón correcto de fin de mes.** Recorta el día nominal al último real |
| `descomponerFechaEnZona` | `cards/utils/ciclo.ts` | Fecha civil en una zona IANA |
| `subscriptionRepository` | `subscriptions/repositories/` | CRUD multi-tenant ya hecho |
| `Modal` / `Button` / `FormInput` / `FormSelect` / `EmptyState` | `shared/ui/` | No hace falta ninguna primitiva nueva |

`Result` de `@/shared/lib/result`: **el éxito trae `value`, no `data`**.

---

## Radio de impacto

### A. Agregar la columna rompe dos constructores de `Subscription`, y el build no los ve

`resolved_through` es anulable, así que **la base y los `Insert` no se rompen**. Pero el tipo
`Subscription` gana un campo, y **hay exactamente dos lugares que construyen el objeto completo**:

*   `subscriptions/hooks/useSubscriptions.ts:34-49` — el alta optimista.
*   `subscriptions/utils/calculations.test.ts:12-31` — el fixture de los tests.

Los dos van a fallar en `pnpm exec tsc --noEmit`, **y `pnpm build` no los va a ver**: `next build`
no tipa los archivos de test, y el hook puede pasar si el objeto se ensancha por *spread*. Es
exactamente el patrón que este repositorio ya pagó dos veces. **Actualizá los dos en el mismo paso
que agregás la columna.**

`subscriptionRepository.test.ts:65` construye un *insert*, no un `Subscription`: no debería romper,
pero verificalo.

### B. `addInterval` tiene un solo consumidor de producción, y cambiarlo cambia el alta

`subscriptionsActions.ts:73` lo usa para calcular `nextPaymentDate` al crear. Sus cuatro tests
(`calculations.test.ts:76-96`) prueban día 15, día 1 y junio: **ninguno toca fin de mes**, así que
los cuatro tienen que seguir pasando sin tocarlos. Si alguno se pone en rojo, el arreglo está mal.

### C. `nextPaymentDate` pasa a ser derivado, y el seed hoy miente

Lo escriben `subscriptionsActions.ts:73`, `useSubscriptions.ts:42` y **ocho filas del seed**
(`seed.ts:601-608`), todas con el mismo `proximoCobro`. **NordVPN es `yearly` y arrancó en junio de
2026: su próximo cobro real es junio de 2027, y el seed dice octubre de 2026.** Al derivarlo de la
serie, ese dato se corrige solo — pero el seed hay que ajustarlo para que no siembre una mentira.

### D. La extracción del resolutor toca la ruta caliente de transacciones

`transactionsActions.ts` ~150 y ~188. Es el camino por el que hoy se registran **todas** las
transacciones del producto: si la extracción cambia el comportamiento, se rompe algo que hoy anda.
`transactionsActions.test.ts` es la red — no la toques, tiene que pasar igual.

---

## Pasos

### Paso 1 — Extraer la resolución padre → hoja (requisito, RFC §6.2)

En `categoryRepository`, operación nueva: dado un `categoryId` y una `organizationId`, devuelve **la
categoría hoja donde imputar**.

Copiá la lógica **tal cual está hoy** en `transactionsActions.ts` ~150, sin mejorarla:

1.  Sin `categoryId` → `findOrCreateTypeGeneralLeaf( tipo , organizationId )`.
2.  Con `categoryId` que no existe → lo mismo.
3.  La categoría tiene hijas reales (`!isSystemLeaf`) → `findOrCreateGeneralLeaf( cat.id , ... )`.
4.  Si no tiene hijas reales → la categoría misma.

Recibe el tipo (`"expense"` \| `"revenue"`) para el caso 1 y 2, y **acepta `tx`** como los demás
métodos del repositorio — el Paso 5 la va a llamar **dentro** de una transacción.

Después, `transactionsActions.ts` pasa a llamarla en sus **dos** ramas y se borran los dos bloques.

> **No cambies el comportamiento.** Esto es una extracción, no una mejora. Si ves algo mejorable,
> anotalo como hallazgo.

### Paso 2 — Arreglar `addInterval` (requisito, RFC §6.1)

`subscriptions/utils/calculations.ts:55`. Hoy usa `setMonth`, que desborda: **31 de enero → 3 de
marzo**, saltea febrero y queda clavado en el 3 para siempre.

*   Reusar `recortarDia` y `diasEnMes` de `cards/utils/ciclo.ts`. **Abrilas antes de usarlas**:
    `recortarDia( day , year , month )` devuelve `Math.min( day , diasEnMes(year,month) )`.
*   `weekly` no cambia: sumar días no desborda.
*   Para el resto: calcular año y mes destino, y **recortar el día nominal** al último real de ese mes.

> **El ancla es el día nominal del origen de la serie, no el del último cobro.** Si iterás sobre el
> resultado recortado, una serie del 31 cae a 28 en febrero y **se queda en 28 para siempre**. La
> firma actual recibe una fecha suelta, así que el Paso 3 le va a pasar siempre `startDate` con el
> índice de ocurrencia, no la ocurrencia anterior. Tenelo presente al escribir el Paso 3.

### Paso 3 — El servicio de la serie y los pendientes

`subscriptions/services/recurrenceService.ts` (nuevo). **Funciones puras**, sin base de datos, para
que se puedan probar sin Postgres.

*   `ocurrenciaN( startDate , frequency , intervalCount , n )` — la enésima fecha de cobro, anclada
    en el día nominal de `startDate`.
*   `ventanaAbierta( fechaCobro , frequency , hoyCivil )` — la regla del RFC §3.2: para todo lo
    mensual o mayor, abre el **primer día del mes calendario** de la fecha de cobro; para `weekly`,
    el mismo día.
*   `pendientesDe( suscripcion , hoyCivil )` — las ocurrencias posteriores a `resolvedThrough` con
    ventana abierta, **en orden ascendente**. Devuelve `[]` si la suscripción no está `active`.

**Todo en fechas civiles `YYYY-MM-DD` (string), no `Date`** — es lo que el RFC §2 fija para el
puntero y evita que una medianoche pertenezca a la zona equivocada. `hoyCivil` lo calcula quien
llama, con `descomponerFechaEnZona` y la zona del perfil.

**Tope de seguridad:** `pendientesDe` corta a las 24 ocurrencias. Una suscripción con `startDate`
viejo y puntero mal inicializado no puede colgar la página con un bucle.

### Paso 4 — Migración: el puntero, con su backfill

*   Columna `resolved_through` de tipo `date`, **anulable**, en `subscriptions`.
*   **Es el primer `date` del repositorio** (verificado: ningún `schema.db.ts` lo usa). Agregá el
    import en el esquema y **dejalo en su modo por defecto, que devuelve `string`**. No `{ mode: "date" }`.
*   **Backfill, y es la parte que importa** (RFC §3.4): inicializar cada fila en **la última
    ocurrencia anterior al período en curso**. Con `startDate` como origen aparecerían junio, julio,
    agosto y septiembre de las 8 suscripciones: **32 pendientes por hechos que nadie registró**.
*   Ajustar el seed para que siembre el puntero con el mismo criterio, y para que
    `next_payment_date` deje de mentir en NordVPN (radio C).
*   `createSubscriptionAction` fija el puntero al dar de alta: **una suscripción nueva nace con el
    puntero en el período anterior**, así su primer pendiente es el período en curso.

### Paso 5 — Resolver un pendiente

Server Action nueva, en `subscriptions/actions/`. Recibe `subscriptionId`, la fecha de la ocurrencia,
la acción y —según el caso— el monto real y la cuenta de pago.

**Guarda primero, antes de escribir nada:** la ocurrencia recibida tiene que ser **la más antigua
pendiente** de esa suscripción. Si no lo es, falla sin escribir. Eso cubre dos pestañas confirmando
el mismo período — el puntero **es** la guarda, no hace falta `idempotencyKeys`.

Las cuatro acciones, con su efecto exacto (RFC §4):

| Acción | Asiento | Puntero | `subscriptions` |
| :--- | :--- | :--- | :--- |
| Confirmar | Sí, por `amount` | avanza a esa ocurrencia | — |
| Confirmar con otro monto | Sí, por el monto real | avanza | `amount` **sólo si** el usuario dice que cambió el precio |
| No me lo cobraron | No | avanza | — |
| Dar de baja | No | avanza | `status` → `cancelled` |

El asiento:

*   **Debe:** la cuenta de la categoría, obtenida con el resolutor del Paso 1 más `findOrCreateAccountForCurrency`.
*   **Haber:** la cuenta de pago.
*   `occurredAt` = **la fecha de la ocurrencia**, no hoy. Un cargo de septiembre confirmado en octubre pertenece a septiembre, o el cierre mensual miente.
*   `description` = el nombre de la suscripción.

**Todo en una sola transacción ACID: asiento, puntero y `nextPaymentDate` recalculado.** Si el
puntero avanzó, el asiento existe.

**Divisa:** si `subscription.currency` no coincide con la divisa de la cuenta de pago, **fallar con
mensaje explícito** y no escribir nada (RFC §4.3). No inventar cotización.

**Cuenta de pago:** si `subscription.accountId` está vacío, la acción la exige por parámetro y la
guarda en la suscripción para la próxima.

### Paso 6 — La bandeja

En `/subscriptions`, **arriba del treemap**. Sin ruta nueva.

*   El Server Component de la página resuelve la zona horaria del perfil y se la pasa al servicio
    — **el patrón es `calcularCicloDeTarjeta`, que la recibe en vez de buscarla**.
*   **Si no hay pendientes, no se renderiza nada.** Ni cartel de vacío ni encabezado.
*   Cada pendiente: marca, período, monto esperado y las cuatro acciones.
*   *Confirmar con otro monto* abre un campo y, al aceptar, pregunta **«¿fue sólo este mes o cambió el
    precio?»**. Esa segunda pregunta es la única que puede tocar `subscriptions.amount`.
*   *Dar de baja* pide confirmación: termina la serie.
*   `SummaryBar.tsx` **no lleva `"use client"`** y es cliente por transitividad. Si la bandeja
    cuelga de `SubscriptionDashboard`, respetá esa cadena y seguí pasando todo por props.

### Paso 7 — Tests

1.  **`addInterval`:** 31 de enero → 28 de febrero → **31 de marzo** (el caso que hoy falla). Y que los cuatro tests existentes sigan pasando sin tocarlos.
2.  **`ocurrenciaN`:** ancla en el día nominal a lo largo de un año que cruza febrero.
3.  **`ventanaAbierta`:** mensual abre el día 1 del mes del cargo; `weekly` abre el mismo día.
4.  **`pendientesDe`:** con el puntero en el período anterior devuelve exactamente uno; una suscripción `cancelled` devuelve `[]`; el tope de 24 corta.
5.  **Resolver — confirmar:** nace el asiento con `occurredAt` en la fecha de la ocurrencia, Debe = Haber, y el puntero avanza.
6.  **Resolver — la guarda:** resolver dos veces la misma ocurrencia falla la segunda vez **y no deja un segundo asiento**.
7.  **Resolver — divisa distinta:** falla y **no escribe nada** (ni asiento ni puntero).
8.  **Resolver — no me lo cobraron:** avanza el puntero y **no hay asiento**.
9.  **Backfill:** tras la migración, las 8 sembradas tienen puntero y la bandeja no propone 32 pendientes.

> **Trampa conocida:** los `beforeEach` de las suites limpian la base con listas escritas a mano y
> **ninguna limpia al salir** (`TECHNICAL_DEBT.md` §7). Si tu suite nueva crea asientos, la que corra
> después puede reventar con una violación de FK sobre `accounts`. Limpiá `ledger_entries` y
> `ledger_transactions` **antes** de `accounts`, y corré `pnpm test` **dos veces** antes de cantar victoria.

### Paso 8 — Documentación, en el mismo commit

*   **`docs/trabajo-en-vuelo.md`** — en el mismo commit que el código.
*   **`docs/TECHNICAL_DEBT.md`** — cerrar en §Resuelto los dos requisitos del RFC §6 (`addInterval` y el resolutor duplicado) y **el ítem de suscripciones sin asientos** del §2. Abrir lo que aparezca.
*   **`docs/patterns.md`** — sí corresponde: *lo propuesto vive fuera del libro; el puntero es la guarda de idempotencia*. Contrastalo antes contra lo que ya está escrito ahí.

---

## Verificación

```bash
pnpm test
pnpm test                  # otra vez: ver la trampa del Paso 7
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
pnpm db:migrate
pnpm db:seed
```

**El reporte pega la salida, no la describe.** Números exactos: archivos de test, tests, errores TS.
La línea base es **51 archivos / 376 tests**.

> **`pnpm build` no es typecheck:** no tipa los archivos de test, y el radio A cae justo ahí. El
> `tsc` va aparte y es lo que corre la compuerta CI.

> **Entorno:** `pnpm test` necesita `postgres-dev` vivo en podman. `ECONNREFUSED` o `AggregateError`
> en el setup es **entorno caído, no suite roja**: `podman ps` antes de diagnosticar.

---

## Lo que NO entra

*   **Las otras dos bandejas** —origen externo (IA, API) y terceros (RFC 003)—. No tienen productor y el diseño manda bandejas separadas.
*   **La evidencia** adjunta al asiento: es lo que el propio diseño dejó abierto.
*   **El aviso de pendientes fuera de `/subscriptions`.** Las notificaciones son `DEMO_NOTIFICATIONS` en memoria; cablearlas de verdad es otra ronda.
*   **Cualquier cron o proceso en segundo plano.** Es Fase 3, y el RFC 023 está diseñado para no necesitarlo.
*   **Suscripciones en otra divisa:** fallan al confirmar, a propósito, hasta que exista la consolidación del RFC 015.
*   **Gestión de `status: paused`** desde la interfaz.
*   **El helper de limpieza compartido de los tests** (`TECHNICAL_DEBT.md` §7). Convivís con la trampa, no la arreglás acá.
