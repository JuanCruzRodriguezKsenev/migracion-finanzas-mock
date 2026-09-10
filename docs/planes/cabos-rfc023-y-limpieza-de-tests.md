# Plan — Cerrar los cabos del RFC 023 y la deuda de limpieza entre suites

**Rama:** `fix/cabos-rfc023-y-limpieza-de-tests`, encadenada sobre `feat/bandeja-recurrencias`.
**Origen:** los tres hallazgos que dejó la ejecución del RFC 023, más dos defectos detectados al
revisar el código entrante.

El estado vive en `docs/trabajo-en-vuelo.md`, no acá.

---

## Qué se construye y por qué

Cuatro cosas, en este orden. Las dos primeras son código de producción con defecto real; las dos
últimas son la infraestructura de tests que los tres hallazgos del informe señalan a la vez.

| # | Qué | Por qué ahora |
| :--- | :--- | :--- |
| 1 | La guarda del puntero pasa a evaluarse **dentro** de la transacción, con bloqueo de fila | Hoy se evalúa antes de abrir la transacción: dos confirmaciones concurrentes pasan las dos |
| 2 | Backfill de `resolved_through` para frecuencias no mensuales | El fallback de la migración 0025 manda `weekly`/`quarterly`/`custom` a `start_date - 1 mes` |
| 3 | `limpiarBase()` único, en orden topológico, para las 18 suites | La deuda §7, que pasó de 14 a 18 suites en una sola tanda |
| 4 | Un factory de `Subscription` y el mock de `next/cache` en el setup | Dos factories duplicados y 8 literales a mano; tres suites repitiendo el mismo mock |

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo en la ronda de planificación. **Nada de esto se reescribe.**

| Qué | Dónde | Qué hace hoy |
| :--- | :--- | :--- |
| `accountRepository.findByIdForUpdate` | `accounting/repositories/accountRepository.ts:51` | `select().from(accounts).where(id + organizationId).for("update")`. Es **el molde exacto** del Paso 1 |
| Su consumidor | `accounting/services/accountingService.ts:67` | Bloquea todas las cuentas antes de tocar un saldo. El comentario explica por qué |
| `subscriptionRepository.findById` | `subscriptions/repositories/subscriptionRepository.ts:45` | Ya acepta `tx: DBOrTx = db` como tercer parámetro. **No hay que agregarle el parámetro, ya está** |
| `subscriptionRepository.update` | ídem `:85` | Acepta `tx` como cuarto parámetro |
| `pendientesDe( sub , hoyCivil )` | `subscriptions/services/recurrenceService.ts:153` | Función **pura** sobre el registro. Tope de 24 pendientes y 2000 iteraciones de búsqueda. Se le puede pasar la fila releída sin ningún cambio |
| `makeSub` | `subscriptions/services/recurrenceService.test.ts:15` | Factory con `Partial<Subscription>` y los 18 campos por defecto |
| `makeSubscription` | `subscriptions/utils/calculations.test.ts:9` | El mismo factory, escrito otra vez |
| `globalSetup` | `src/shared/db/vitest.setup.ts` | Crea `finanzas_db_test` y corre las migraciones. **Corre una vez para toda la suite**: no sirve para limpiar entre archivos |
| `setupFiles` | `src/shared/lib/vitest.setup.dom.ts` | Sólo los matchers de jest-dom. Corre **una vez por archivo de test**, que es lo que el Paso 4 necesita |
| Barrel de esquema | `src/shared/db/schema.ts` | Existe. Comprobar qué reexporta antes de usarlo en el Paso 3 |

---

## Radio de impacto

### A. El Paso 1 toca la ruta que acaba de entrar, y tiene un solo consumidor

`resolveSubscriptionAction` se llama desde **un** lugar: `PendingOccurrencesInbox.tsx`. No hay otro
productor. El cambio es interno a la acción y no altera su firma ni su `Result`, así que la bandeja
no se toca.

Sí cambia el **mensaje de error** en el caso de carrera perdida. Los tests que afirman sobre el texto
de fallo están en `resolveSubscriptionAction.test.ts:276-303` (el caso "no es la más antigua"): ese
camino sigue fallando **antes** de la transacción, así que su mensaje no cambia. El mensaje nuevo es
sólo para el caso en que la fila cambió entre la lectura y el bloqueo.

### B. El Paso 3 toca 18 archivos y ninguno de producción

Estas son las 18 suites que hoy abren con su propia lista de `db.delete(...)`. **Las 18 se
convierten, ninguna queda a medias** — una sola que conserve su lista propia reintroduce la
divergencia que estamos borrando:

```
src/features/accounting/actions/accountingActions.test.ts
src/features/accounting/actions/categoryActions.test.ts
src/features/accounting/repositories/ledgerRepository.test.ts
src/features/accounting/repositories/monthlySummaryRepository.test.ts
src/features/accounting/services/accountingService.test.ts
src/features/accounting/services/outboxDispatcher.test.ts
src/features/auth/repositories/userRepository.test.ts
src/features/auth/services/loginAttemptService.test.ts
src/features/cards/actions/cardsActions.test.ts
src/features/cards/repositories/cardsRepository.test.ts
src/features/cards/services/cardCycleService.test.ts
src/features/contacts/actions/contactsActions.test.ts
src/features/contacts/repositories/contactsRepository.test.ts
src/features/subscriptions/actions/resolveSubscriptionAction.test.ts
src/features/subscriptions/repositories/subscriptionRepository.test.ts
src/features/transactions/actions/transactionsActions.test.ts
src/shared/lib/auth.test.ts
src/shared/services/idempotencyService.test.ts
```

**No todas limpian igual hoy:** unas lo hacen en `beforeEach`, otras además en `afterEach` o
`afterAll`, y unas pocas en una función suelta llamada desde varios lugares. Da igual dónde esté: se
reemplaza **el bloque de `db.delete(...)` completo** por `await limpiarBase()`, en el mismo gancho
donde estaba, y **se agrega `afterAll( limpiarBase )` en las que no tengan limpieza de salida**.

**Ojo con los `db.delete` con `.where(...)`, que NO se tocan.** Son borrados dirigidos de un caso de
prueba, no limpieza de suite: `categoryActions.test.ts:199`, `accountingService.test.ts:278-279`,
`userRepository.test.ts:103` y `:115`. Si se los reemplaza por `limpiarBase()` se rompe el caso.

### C. El Paso 4 toca `vitest.config.ts`

`setupFiles` es hoy un array de un elemento. Agregar un segundo archivo es la única línea de config
que cambia. **No tocar `fileParallelism: false`** ni su comentario en este paso — el comentario es
engañoso (el problema nunca fue el paralelismo) y su corrección va en el Paso 5, con el texto exacto.

### D. Los tres consumidores del factory

`recurrenceService.test.ts:15` y `calculations.test.ts:9` **borran** su factory local y pasan a
importar el compartido. `resolveSubscriptionAction.test.ts:350-358` reemplaza sus **ocho literales de
~20 campos** por ocho llamadas al factory con los campos que de verdad varían (`id`, `name`,
`amount`, `frequency`, `resolvedThrough`).

---

## Pasos

### Paso 1 — La guarda del puntero, dentro de la transacción

**El defecto:** `resolveSubscriptionAction.ts` lee la suscripción en la línea 87 y evalúa la guarda
en la 97-100, pero la transacción recién abre en la 137. Entre esas dos cosas no hay nada que impida
que otra petición haga lo mismo. Las dos pasan la guarda, las dos crean asiento, y el puntero termina
donde lo dejó la última: **dos asientos para la misma ocurrencia**.

Esto **no fue un desvío de la ejecución**: el plan anterior dijo textualmente que «el puntero *es* la
guarda, no hace falta `idempotencyKeys`». Sigue siendo cierto — lo que falta es que el puntero se lea
bajo bloqueo.

**Qué hacer:**

1.  Agregar `subscriptionRepository.findByIdForUpdate( id , organizationId , tx )`, **copiando la
    forma de `accountRepository.findByIdForUpdate` (`accountRepository.ts:51`)**: mismo `select /
    from / where(id + organizationId)` y `.for( "update" )` al final, `tx` **obligatorio** (sin
    default), y el mismo comentario de por qué existe.
2.  En `resolveSubscriptionAction`, **dentro** del `db.transaction`, como primera operación:
    releer la suscripción con ese método y **volver a evaluar la guarda** sobre la fila releída —
    `pendientesDe( subFresca , hoyCivil )` y comparar contra `params.occurrenceDate`.
3.  Si ya no es la más antigua pendiente, `throw` para forzar el rollback, con un mensaje propio:
    `"Otra confirmación resolvió esta ocurrencia mientras se procesaba."`
4.  **Todo lo que sigue dentro de la transacción usa la fila releída, no la de la línea 87.** En
    particular `subscription.amount`, `subscription.currency`, `subscription.categoryId`,
    `subscription.startDate`, `subscription.frequency` e `intervalCount`. Ésta es la parte que se
    olvida: releer y después seguir usando la variable vieja no arregla nada.
5.  La guarda de afuera **se queda donde está**. Es la que da el mensaje bueno al usuario en el caso
    normal; la de adentro es la que cierra la carrera.

**Test:** en `resolveSubscriptionAction.test.ts`, un caso que dispare dos `resolveSubscriptionAction`
sobre la misma ocurrencia con `Promise.all` y afirme que **exactamente una** devuelve `success: true`
y que hay **un solo** `ledger_transactions` para esa suscripción.

### Paso 2 — El backfill que falta

La migración 0025 resuelve `monthly` y `yearly` con su regla propia, y todo lo demás cae en el
fallback `start_date - INTERVAL '1 month'`. Para una `weekly` eso son unas cuatro ocurrencias que
aparecen juntas en la bandeja al abrirla; para una `custom` con intervalo largo, depende del
intervalo. El tope de 24 de `pendientesDe` lo acota, pero no lo corrige.

**Migración nueva** (`pnpm db:generate` no la va a generar sola: es sólo datos, sin cambio de
esquema — crearla a mano con el número que siga y agregarla al `_journal.json`).

**La 0025 no se edita: ya está aplicada.**

La regla, para las filas cuya frecuencia no sea `monthly` ni `yearly`: el puntero va en la **última
ocurrencia estrictamente anterior a la ventana en curso**, que es lo mismo que ya hace
`calcularPunteroInicial` (`recurrenceService.ts:196`) en el alta. **Contrastar el SQL contra esa
función antes de escribirlo**: si el backfill y el alta calculan punteros distintos, la bandeja va a
mostrar cosas distintas según cómo se creó la suscripción.

Si expresar esa regla en SQL para `custom` sale forzado, la alternativa aceptable es acotar el daño:
poner el puntero en la ocurrencia inmediatamente anterior a `CURRENT_DATE` y dejar anotado en
`TECHNICAL_DEBT.md` que las series `custom` previas a la 0025 no recuperan su historia. **Lo que no
es aceptable es dejar el fallback como está.**

### Paso 3 — `limpiarBase()`, en orden topológico

Archivo nuevo: `src/shared/db/testCleanup.ts`. No matchea el `include` de `vitest.config.ts`
(`**/*.test.ts`), así que no se ejecuta como suite.

**El orden es el contenido del paso.** Sale del grafo de FK del esquema; las que importan son las
`restrict`, porque las `cascade` y las `set null` se resuelven solas:

```
 1. login_attempts            (sin FK)
 2. idempotency_keys          (sin FK)
 3. outbox_events
 4. monthly_summaries
 5. ledger_entries            → antes que ledger_transactions y accounts (restrict a accounts)
 6. ledger_transactions
 7. card_accounts             → antes que cards y accounts (restrict a accounts)
 8. cards                     → antes que financial_entities (restrict) y accounts
 9. contact_payment_methods   → antes que contacts y financial_entities (restrict)
10. contacts
11. subscriptions             → antes que accounts y categories
12. category_accounts         → antes que categories y accounts (restrict a las dos)
13. accounts                  → antes que financial_entities (restrict)
14. financial_entities
15. categories                → ver la nota de abajo
16. profiles                  → antes que users
17. users
18. organizations
```

**La nota de `categories`:** tiene `parentId` con `references(() => categories.id, {onDelete:
"restrict"})`, o sea una FK contra sí misma. Un `DELETE` sin `WHERE` sobre toda la tabla evalúa la
restricción fila por fila, así que puede intentar borrar un padre antes que su hija y fallar. Borrar
**primero las hojas y después el resto**:

```ts
await tx.delete( categories ).where( isNotNull( categories.parentId ) ) ;
await tx.delete( categories ) ;
```

Esto sirve para el árbol de dos niveles que el repo usa hoy. Si algún día hay tres, hace falta un
bucle; dejalo anotado en el propio archivo, no lo construyas ahora.

**Forma de la función:**

*   `export async function limpiarBase(): Promise<void>` — sin parámetros, borra todo.
*   Un solo `db.transaction` alrededor de los 18 borrados, para que una limpieza a medias no exista.
*   Los `import` de tablas salen de los `schema.db.ts` de cada feature, salvo que
    `src/shared/db/schema.ts` ya los reexporte a todos — **abrilo primero y usalo si alcanza**.
*   Un comentario de encabezado que diga **por qué el orden es ése**, con la palabra `restrict`. El
    próximo que agregue una tabla tiene que entender dónde meterla sin reconstruir el grafo.

Después, la conversión de las 18 suites según el radio B. **Sin dejar ninguna.**

### Paso 4 — El factory y el mock

**Factory:** `src/features/subscriptions/testing/subscriptionFactory.ts`, exportando
`makeSubscription( overrides: Partial<Subscription> ): Subscription`. Copiar los valores por defecto
de `makeSub` (`recurrenceService.test.ts:15`), que es el más completo de los dos y ya tiene
`resolvedThrough: null`. Los tres consumidores del radio D pasan a importarlo, y los dos factories
locales **se borran**.

**Mock:** archivo nuevo `src/shared/lib/vitest.setup.mocks.ts` con el `vi.mock( "next/cache" , ... )`
que hoy repiten `resolveSubscriptionAction.test.ts:37`, `contactsActions.test.ts:36` y
`cardsActions.test.ts:28` — copiar el cuerpo de cualquiera de los tres, son iguales. Agregarlo al
array `setupFiles` de `vitest.config.ts`, **detrás** del de jest-dom. Después, borrar el `vi.mock`
local de las tres suites.

`setupFiles` corre una vez por archivo de test, así que el mock aplica a todos sin que ninguno lo
declare. Verificá que las tres suites que lo tenían siguen en verde: si alguna afirmaba sobre el
espía de `revalidatePath`, el espía ahora vive en el setup y hay que exportarlo desde ahí.

### Paso 5 — Documentación, en el mismo commit

*   **`TECHNICAL_DEBT.md` §7:** pasa a § Resuelto, nombrando `limpiarBase()` y su archivo. Corregir de
    paso el número: el texto dice «14 archivos» y eran 18 al momento de resolverlo.
*   **`vitest.config.ts`:** reemplazar el comentario de `fileParallelism` por el motivo verdadero —
    las suites comparten `finanzas_db_test`, y el problema que esto evita es la colisión **simultánea**,
    no el residuo entre archivos, que es lo que resuelve `limpiarBase()`.
*   **`patterns.md`:** un patrón nuevo para la limpieza en orden topológico. **Contrastarlo antes
    contra el §8 y el Patrón 10**, que son los dos últimos que se escribieron, para no repetir número
    ni contradecir lo que ya dicen.
*   **`trabajo-en-vuelo.md`:** rama, estado y próximo paso, en este mismo commit.
*   Si el Paso 2 termina en la variante acotada, la nota de `custom` va a `TECHNICAL_DEBT.md`
    § Abierto.

---

## Verificación

Los cuatro, y el typecheck como comando propio:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**Y esta ronda tiene una quinta, que es la que de verdad prueba el Paso 3:**

```bash
pnpm test && pnpm test
```

Dos corridas seguidas. Vitest ordena los archivos por la duración de la corrida anterior, así que la
segunda corre en otro orden: si la limpieza quedó incompleta, ahí aparece y no en la primera.
**Las dos tienen que dar el mismo conteo y las dos en verde.** El punto de partida es **53 archivos,
392 tests**, y el Paso 1 agrega al menos uno.

El reporte **pega la salida**, no la describe.

---

## Lo que NO entra

*   **Unificar `formatCents` con `formatCurrency`.** Es otra deuda y otra ronda.
*   **El desvío de `cardsActions.ts`**, que llama `revalidatePath("/cards")` mientras las otras siete
    llamadas del repo usan `"/[lang]/(main)/<ruta>"`. Anotarlo en `TECHNICAL_DEBT.md` § Abierto y
    seguir de largo.
*   **`idempotencyKeys` en la resolución de recurrencias.** El puntero bajo bloqueo alcanza; agregar
    claves de idempotencia encima es un segundo mecanismo para el mismo invariante.
*   **Tocar las suites que no limpian la base.** Son 35 de los 53 archivos y no tienen el problema.
*   **`getNextCode`, el desarchivado en cascada y el signo de los pasivos.** Deuda abierta, sin
    relación con esta ronda.
