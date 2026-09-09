# Plan — Clasificación unificada: la categoría es la cuenta contable (RFC 022, primera tajada)

*   **RFC:** [`../proposals/022-unified-classification.md`](../proposals/022-unified-classification.md) — `APPROVED` el 2026-09-09.
*   **Rama:** `feat/clasificacion-unificada`
*   **Línea base:** `master` en `c980d93`. La última batería verificada de forma independiente dio
    **348 tests, lint 0, `tsc --noEmit` 0, build verde** (cierre de tarjetas, 2026-09-08); desde
    entonces sólo hay commits de documentación. **Si algo sale en rojo antes de tocar nada, es
    entorno, no herencia** — ver la nota de Postgres al final.

---

## Qué se construye y por qué

Hoy la aplicación **no puede responder de dónde viene cada cosa**, y falla por dos vías a la vez:

1.  La categoría que el usuario elige **no llega a la contabilidad**:
    `createTransactionFromFormAction` resuelve la cuenta de gasto con un código fijo, sin mirar
    `data.categoryId`.
2.  Y ni siquiera ese código fijo se respeta: `obtenerCuentaPorMoneda` **descarta el `codigoBase`**,
    así que **todos los gastos del formulario caen en `5.1.01.01 Gastos de Supermercado`**.

Esta tanda cierra el circuito: una categoría **es** una cuenta contable de resultado, el gasto se
imputa a la cuenta de la categoría elegida, y el usuario arranca con un catálogo con el que puede
categorizar desde el primer día.

De paso corrige un defecto contable vivo que el contraste del RFC destapó (**D1**): como
`obtenerCuentaPorMoneda` busca sólo por `(type, currency)` y dos de sus cuatro llamadas son con
`type: "equity"` para resolver la posición de cambio, **un cambio ARS→USD desde el formulario asienta
contra `3.1.01.01 Patrimonio Neto` en vez de contra `3.3.01-ARS`**.

---

## Alcance de esta tanda

**Entra:** esquema y migración, catálogo inicial, generador de códigos del árbol, repositorio y
Server Actions, imputación real, corrección de D1, y los tests de todo eso.

**No entra** (segunda tanda): la pantalla de gestión de categorías —el RFC **no la especifica**, y
diseñarla sobre la marcha es donde aparecen los defectos— y la migración de
`subscriptions.category`, que arrastra archivos de otra feature.

---

## Radio de impacto

Esto es lo que el plan nombra explícito porque **es donde aparecen los defectos**: los archivos que
un plan no nombra son los que salen rotos.

### A. Agregar columnas `NOT NULL` a `categories` rompe un test de otra feature

`ledgerRepository.test.ts:68-75` inserta una categoría **con sólo `organizationId` y `name`**:

```typescript
const [ cat ] = await db
  .insert( categories )
  .values( {
    organizationId: orgId ,
    name:           "Supermercado" ,
  } )
  .returning() ;
```

Con `type` y `accountCode` obligatorias, **ese insert deja de compilar** (`tsc --noEmit`) y falla en
runtime. Hay que actualizarlo. Es el mismo patrón que rompió `accountCodes.test.ts`,
`dashboardMetrics.test.ts` y `derivarTipo.test.ts` cuando se agregaron `cbu_cvu` y `alias` a
`accounts`.

### B. La tabla nueva rompe el orden de limpieza de NUEVE archivos

`category_accounts` referencia `categories` y `accounts`, **las dos con `onDelete: "restrict"`**. Todo
`beforeEach` que hace `db.delete( accounts )` va a fallar con violación de FK si antes no borra
`category_accounts`.

Los diez lugares que limpian `accounts`, verificados uno por uno:

```
src/features/accounting/actions/accountingActions.test.ts
src/features/accounting/repositories/ledgerRepository.test.ts
src/features/accounting/repositories/monthlySummaryRepository.test.ts
src/features/accounting/services/accountingService.test.ts
src/features/cards/actions/cardsActions.test.ts
src/features/cards/repositories/cardsRepository.test.ts
src/features/cards/services/cardCycleService.test.ts
src/features/subscriptions/repositories/subscriptionRepository.test.ts
src/features/transactions/actions/transactionsActions.test.ts
src/shared/db/seed.ts            ← :49, el mismo problema fuera de los tests
```

**En todos, `db.delete( categoryAccounts )` va antes que `categories` y que `accounts`.**

### C. `obtenerCuentaPorMoneda` tiene cuatro llamadas y las cuatro cambian

Todas en `src/features/transactions/actions/transactionsActions.ts`:

| Línea | Tipo | Para qué | Estado hoy |
| :--- | :--- | :--- | :--- |
| `:150` | `expense` | cuenta de gasto | Devuelve la primera cuenta de gasto de esa moneda |
| `:175` | `revenue` | cuenta de ingreso | Ídem con ingresos |
| `:217` | `equity` | posición de cambio, origen | **Devuelve Patrimonio Neto (D1)** |
| `:226` | `equity` | posición de cambio, destino | Ídem |

### D. El barril de esquemas

`src/shared/db/schema.ts` es el que lee Drizzle Kit para generar migraciones. `categoryAccounts` sale
gratis porque `export * from "@/features/accounting/schema.db"` ya está — **pero sólo si la tabla se
declara en ese archivo.** Si se crea un `schema.db.ts` nuevo, hay que agregar el export o la
migración sale vacía y nadie se entera hasta que falle en runtime.

### E. Lo que este plan NO toca, y conviene no tocar

*   **`getNextCode`** (`accounting/utils/accountCodes.ts`) tiene dos consumidores vivos:
    `cardsActions.ts:139` (`"liability"`) y `accountingActions.ts:95`. **Los dos funcionan.** La
    función nueva va aparte; la vieja se queda como está.
*   **`ledger_transactions`** no cambia. Ni una columna.
*   **La UI de transacciones** no cambia: el selector de categorías del `TransactionFormModal` ya
    manda `categoryId`; lo que faltaba era que el backend lo usara.

---

## Reusos: qué hacen hoy las piezas que este plan toca

Nombrarlos evita el error de "reusar X" sin abrir X.

*   **`cards` → `card_accounts`** (`features/cards/schema.db.ts`) es el molde literal de
    `category_accounts`: `cardId` + `accountId` + `currency`, con
    `uniqueIndex( cardId , currency )`. **Copiar la forma, cambiar el `onDelete`**: `card_accounts`
    usa `cascade` en `cardId` porque una tarjeta se da de baja; una categoría **nunca se borra**, así
    que va `restrict` en los dos extremos.
*   **`accountRepository`** (`accounting/repositories/`) expone `findById`, `findByIdForUpdate`,
    `updateBalance`, `create` y `findAll`. **No tiene `findByCode`**: si hace falta buscar por código
    hay que agregarlo, no asumirlo.
*   **`categoryRepository`** tiene **sólo `findAll` y `create`**. Todo lo demás se agrega.
*   **`obtenerCuentaPorMoneda`** ya arma el código con sufijo de divisa
    (`code: \`${codigoBase}-${currency}\``) y ya crea la cuenta si no existe. **Lo único roto es su
    búsqueda.** No hay que reescribirla entera.
*   **`createLedgerTransaction`** (`accountingService.ts`) exige `organizationId` explícito en la
    cabecera y **valida Debe = Haber por divisa**; rechaza con excepción un asiento cuya moneda no
    sea la de su cuenta. El saldo se actualiza materializado, con bloqueo de fila, dentro de la
    transacción ACID.
*   **El contrato de `Result`** (`@/shared/lib/result`): el éxito trae **`value`**, no `data`
    (`{ success: true, value: T }`).
*   **`sumEntriesByAccountInRange`** ya existe en `ledgerRepository` para el desglose por período.
    **Todo el acceso al libro está encapsulado ahí**: cero consultas sueltas en acciones o
    componentes, y esta tanda mantiene la regla.

---

## Pasos

### Paso 1 — Esquema

En `src/features/accounting/schema.db.ts` (**no** en un archivo nuevo, ver radio D).

**`categories` suma cuatro columnas y una FK real:**

*   `type: varchar(20).notNull()` — sólo `'expense' | 'revenue'`.
*   `accountCode: varchar(50).notNull()` — el prefijo, sin sufijo de moneda. Ej: `'5.1.03.01'`.
*   `archivedAt: timestamp({withTimezone: true})` — baja lógica, como `cards.archivedAt`.
*   `isSystemLeaf: boolean().default(false).notNull()` — marca la hoja `General`.
*   `parentId` pasa de `uuid("parent_id")` suelto a
    `.references( (): AnyPgColumn => categories.id , {onDelete: "restrict"} )`.

> **`AnyPgColumn` es obligatorio** en la auto-referencia, importado de `drizzle-orm/pg-core`. Sin esa
> anotación TypeScript no puede inferir el tipo de una tabla que se referencia a sí misma y
> `tsc --noEmit` falla. **El build no lo atrapa; la compuerta CI sí.**

Índices: `uniqueIndex( organizationId , accountCode )` y `index( organizationId , parentId )`.

**`categoryAccounts` nueva**, con la forma de `card_accounts` y `restrict` en los dos extremos.

### Paso 2 — Migración 0023

`pnpm db:generate`. Revisar el SQL generado **antes** de aplicarlo, y editarlo a mano para el orden
correcto, que Drizzle no puede inferir:

1.  Agregar `type` y `account_code` **nullable**.
2.  Ejecutar el backfill del Paso 3 dentro de la misma migración.
3.  Recién entonces `ALTER COLUMN ... SET NOT NULL`.

**Cambiar el `default` de una columna no reescribe lo ya guardado**: el `UPDATE` va escrito a mano.
Es lo mismo que hizo la migración `0021` con las preferencias del perfil.

### Paso 3 — Fusionar las cuatro gemelas (backfill)

Las cuatro categorías del seed tienen cuenta gemela exacta. **Se adoptan, no se recrean**: sus saldos
y sus asientos quedan intactos.

| Categoría (por `name`) | Cuenta existente (por `code`) | `type` |
| :--- | :--- | :--- |
| Sueldos y Honorarios | `4.1.01.01` | `revenue` |
| Supermercado y Alimentos | `5.1.01.01` | `expense` |
| Servicios del Hogar | `5.1.01.02` | `expense` |
| Alquiler y Expensas | `5.1.01.03` | `expense` |

Para cada una: setear `type` y `account_code` con el código de su gemela, e insertar la fila de
`category_accounts` apuntando a la cuenta **que ya existe**, con su `currency`.

Después, las raíces `Ingresos` y `Gastos` **se eliminan** de `categories` (RFC R1: las raíces son los
tipos contables), **previo** `parentId = NULL` en sus hijas.

> **Nada de esto emite asientos.** Una cuenta de resultado nace en cero; no hay saldo de apertura que
> justificar. Si en algún momento el plan parece pedir un asiento acá, está mal leído.

### Paso 4 — `5.1.01.99 Gastos Generales` pasa a ser la hoja `General`

Las cuentas que `obtenerCuentaPorMoneda` haya creado —`5.1.01.99` / `4.1.01.99`, donde hoy está
imputado casi todo— se adoptan como la hoja `General` de su tipo, con `isSystemLeaf = true`.

**No se reclasifica el pasado.** Los gastos que cayeron mal por D1 se quedan donde están: corregirlos
sería emitir contra-asientos masivos sobre un libro inmutable a partir de una etiqueta que nunca fue
autoritativa. La discrepancia es histórica y está aceptada en el §13 del RFC.

### Paso 5 — `getNextCategoryCode`, archivo nuevo

`src/features/accounting/utils/categoryCodes.ts`. **No tocar `accountCodes.ts`** (radio E).

Firma: `getNextCategoryCode( { type , parentCode , siblings } )`.

*   Padres: `<raíz>.1.<NN>` — `5` para `expense`, `4` para `revenue`.
*   Hojas: `<código del padre>.<NN>`.
*   `NN` de `01` a `98`, con `padStart(2,"0")`.
*   **El `99` queda reservado** en cada nivel para la hoja `General`.
*   Al llegar a 98 hermanos, **fallar con mensaje explícito**. Nada de generar `"100"` y romper el
    ancho fijo, que es el bug que tiene hoy `getNextCode`.

### Paso 6 — Catálogo inicial en el seed

Las 18 categorías con sus subcategorías del §10 del RFC, cada una con su cuenta en `ARS`, `balance: 0`,
y su fila en `category_accounts`. **El catálogo se siembra por organización**, no es global.

Reordenar la limpieza de `seed.ts:49`: `categoryAccounts` antes que `categories` y `accounts`.

### Paso 7 — Repositorio y acciones

`categoryRepository` suma `findById`, `findChildren`, `findTree`, `update`, `archive`, `unarchive`, y
`findOrCreateAccountForCurrency( categoryId , currency )` — que es la pieza que usa el Paso 8.

Server Actions nuevas en `accounting/actions/`, **todas con `organizationId` de la sesión y validación
Zod**: `createCategoryAction`, `updateCategoryAction`, `archiveCategoryAction`,
`unarchiveCategoryAction`, `getCategoryTreeAction`.

Reglas que ninguna acción puede violar: no se crean categorías de tipo `asset`/`liability`/`equity`;
`accountCode` y `type` son **inmutables**; no existe borrado.

`getCategoriesAction` (en `transactions/actions/`) **se queda**: la usa el filtro de la tabla de
transacciones.

### Paso 8 — Imputación real, y la corrección de D1

**8a. Arreglar `obtenerCuentaPorMoneda`** (`transactionsActions.ts:80`). Su búsqueda pasa de

```typescript
allAccounts.find( ( a ) => (a.type === type) && (a.currency === currency) )
```

a buscar por **código exacto** — `` `${codigoBase}-${currency}` `` — con el tipo como verificación.
Esto arregla las cuatro llamadas de una: los gastos dejan de caer todos en la misma cuenta y la
posición de cambio deja de resolver contra Patrimonio Neto.

**8b. Imputar por categoría** en la rama `expense` de `createTransactionFromFormAction`:

1.  `categoryId` vacío → hoja `General` del tipo.
2.  Apunta a un padre → su hoja `General` (crearla si no existe).
3.  Apunta a una hoja → esa hoja.
4.  Resolver la cuenta con `findOrCreateAccountForCurrency( hoja , currency )`.
5.  Imputar el débito ahí.

Idéntico para `income` con `revenue`. **La moneda la sigue definiendo la cuenta de origen**, nunca el
formulario: eso ya está resuelto y no se toca.

### Paso 9 — Tests

**Primero los dos que rompe el esquema** (radio A y B), o toda la suite queda roja y no se distingue
lo nuevo de lo colateral:

*   `ledgerRepository.test.ts:68-75`: el insert de categoría necesita `type` y `accountCode`.
*   Los diez lugares del radio B: `db.delete( categoryAccounts )` primero.

**Después los nuevos:**

1.  `getNextCategoryCode`: anidamiento, reserva del `99`, y el fallo explícito a los 98 hermanos.
2.  **D1, el que prueba que el defecto era real:** con una cuenta `3.1.01.01 Patrimonio Neto`
    (`equity`, `ARS`) presente, pedir `codigoBase: "3.3.01"` **devuelve `3.3.01-ARS`, no el
    patrimonio**. Escribirlo **antes** del arreglo y verlo fallar.
3.  Imputación: gasto con categoría *Supermercado* deja el débito en su cuenta; sin categoría, en la
    hoja `General`.
4.  R3: crear la primera subcategoría bajo un padre con movimientos mueve lo imputado a la hoja.
5.  R4: archivar una categoría con movimientos funciona; borrarla es imposible.
6.  R5: gastar en USD sobre una categoría que sólo tenía cuenta ARS crea la segunda cuenta y su
    vínculo, **sin duplicar la categoría**.

> **`obtenerCuentaPorMoneda` no tiene un solo test hoy.** Los de cambio de divisas
> (`accountingService.test.ts:652-657`) crean `3.3.01-ARS` y `3.3.01-USD` a mano y llaman al servicio
> directo, **salteando la función**. Por eso el defecto está en verde. El arreglo **no puede apoyarse
> en la suite existente**: hay que escribirle tests propios al Server Action.

### Paso 10 — Documentación, en el mismo commit

*   **`docs/patterns.md`**: patrón nuevo con la unificación —el árbol, la codificación, la regla de
    hojas y el vínculo por divisa—. **Contrastar contra el §7 (tarjetas)**, que es el patrón hermano,
    y contra el §8 (signo de los saldos), para no repetir ni contradecir.
*   **`docs/TECHNICAL_DEBT.md`**: mover a § Resuelto los cuatro defectos del §4 que esta tanda cierra
    (la categoría sin efecto contable, el `codigoBase` descartado, nadie agrupa, el usuario no puede
    crear categorías) y el de D1 del §5. **Dejar abiertos** los que no se tocan: `getNextCode` sigue
    topeando en 99 para el plan de cuentas general, y `accounts` sigue sin jerarquía real.
*   **`docs/trabajo-en-vuelo.md`**: **en el mismo commit que avanza el trabajo.** Un doc de estado
    que se actualiza después es un doc de estado que miente.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**El reporte pega la salida, no la describe.** Hacen falta los números exactos: cuántos archivos de
test, cuántos tests, cuántos errores de TS.

> **`pnpm build` no es typecheck.** `next build` sólo tipa los archivos de su grafo y **los tests no
> entran**; vitest tampoco tipa. Build verde + tests verdes ya convivieron con `tsc --noEmit` roto,
> que es lo que corre la compuerta CI (`.github/workflows/compuerta.yml:62`).

> **Entorno:** `pnpm test` necesita el contenedor `postgres-dev` vivo en podman. Sin él la suite muere
> en el setup con `ECONNREFUSED` o `AggregateError`: **eso es entorno caído, no suite roja.**
> `podman ps` para confirmar antes de diagnosticar nada.

Además de los cuatro, antes de dar por cerrado:

```bash
pnpm db:migrate    # la 0023 aplica limpia
pnpm db:seed       # el catálogo completo se siembra sin violar FKs
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d categories"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d category_accounts"
```

---

## Lo que NO entra en esta ronda

*   **La pantalla de gestión de categorías.** El RFC no la especifica. Segunda tanda.
*   **`subscriptions.category` → `categoryId`.** Arrastra el `z.enum` de siete valores, el modal de
    alta y tests de otra feature. Segunda tanda.
*   **Los gráficos y el desglose por categoría.** Esta tanda deja la dimensión agrupable; quién la
    dibuja es el RFC de estadísticas, en la Fase 7.
*   **La totalización multidivisa.** Sumar `-ARS` con `-USD` necesita la conversión a moneda base del
    RFC 015 §4, bloqueada hasta la Fase 4. Hasta entonces el total va **por divisa**.
*   **Reclasificar el pasado.** Decidido en el §13 del RFC: no se toca.
