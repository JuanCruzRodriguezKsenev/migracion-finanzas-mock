# RFC 022: Clasificación Unificada — la categoría es la cuenta contable

*   **ID de la Propuesta:** 022
*   **Título:** Unificación del árbol de categorías con el plan de cuentas, imputación real del gasto y catálogo inicial
*   **Estado:** `APPROVED` (2026-09-09) — aprobado por el usuario. Habilita código contra este texto.
*   **Fecha de Creación:** 2026-09-09
*   **Fecha de Aprobación:** 2026-09-09
*   **Autor:** `tanda` (sesión de diseño del 2026-09-09)
*   **Origen:** §3 de `~/Boveda/Archivo/migracion-finanzas-mock/Diseños/Rediseño de clasificación y propuestas.md`, donde se tomaron las decisiones con su fundamento.

> [!IMPORTANT]
> **Este RFC se escribió contrastando el esquema real archivo por archivo**, no de memoria. La
> Sección 0 lista lo verificado, incluidos **dos defectos que este RFC descubre y corrige** y que no
> estaban anotados en ningún lado. Es el mismo procedimiento que atrapó los errores de los RFC 007,
> 008, 010 y 015, todos escritos antes del core contable.

---

## 0. Contraste contra el código real (2026-09-09)

Todo verificado contra los archivos citados. Ninguna línea de este RFC asume una tabla, columna o
función que no exista hoy.

| Lo que hay | Dónde | Consecuencia para este RFC |
| :--- | :--- | :--- |
| `categories` con `parentId` (`uuid`, **sin `references()`**), `name`, `icon`, `color`, `organizationId` | [`accounting/schema.db.ts:16-24`](../../src/features/accounting/schema.db.ts) | El árbol existe pero **la auto-referencia no está declarada como FK**: nada impide un `parentId` colgando de la nada. Se corrige en §3 |
| `accounts` con `code` único por organización (`accounts_org_code_unique`), `type`, `currency`, `balance`, `entityId` | [`accounting/schema.db.ts:41-57`](../../src/features/accounting/schema.db.ts) | La unicidad de `code` es la que obliga al sufijo de divisa. Se respeta |
| `categoryRepository` tiene **sólo `findAll` y `create`** | [`categoryRepository.ts`](../../src/features/accounting/repositories/categoryRepository.ts) | No hay update, ni delete, ni búsqueda por padre. Hay que ampliarlo |
| **Ningún Server Action expone `create`** | Sólo existe `getCategoriesAction` ([`transactionsActions.ts:44`](../../src/features/transactions/actions/transactionsActions.ts)) | El usuario no puede crear categorías. §6 |
| `getNextCode` genera prefijo fijo + correlativo de 2 dígitos | [`accountCodes.ts`](../../src/features/accounting/utils/accountCodes.ts) | **No sabe anidar y topea en 99.** No sirve para un árbol. Se reescribe en §4 |
| `ledgerTransactions.categoryId` con `onDelete: "set null"` | [`accounting/schema.db.ts:64`](../../src/features/accounting/schema.db.ts) | Borrar una categoría **desclasifica silenciosamente** su historial. Refuerza la decisión de archivar en vez de borrar |
| `ledgerEntries.accountId` con `onDelete: "restrict"` | [`accounting/schema.db.ts:88`](../../src/features/accounting/schema.db.ts) | Al unificar, esta protección pasa a cubrir las categorías: una con movimientos ya no se puede borrar |
| El saldo está **materializado** en `accounts.balance`, actualizado dentro de la transacción ACID | [`accountingService.ts:112-129`](../../src/features/accounting/services/accountingService.ts) | El total por categoría **no hay que calcularlo sumando asientos**: ya está en la fila. Ver §7 |
| `subscriptions.category` es un `varchar(30)` con 7 valores fijos y default `'other'` | [`subscriptions/schema.db.ts:48`](../../src/features/subscriptions/schema.db.ts), validado en [`subscriptions.schema.ts:20`](../../src/features/subscriptions/schemas/subscriptions.schema.ts) | Migra al árbol único. §8 |
| El seed crea **6 categorías** (2 raíces + 4 hojas) y **8 cuentas** | [`seed.ts:145-210`](../../src/shared/db/seed.ts) y `:240-400` | Cuatro de esas categorías tienen cuenta gemela exacta. §9 |
| Última migración aplicada: `0022_familiar_richard_fisk.sql` | `drizzle/migrations/` | La de este RFC sería la **0023** |

### Los dos defectos que este contraste descubrió

**D1 — `obtenerCuentaPorMoneda` puede devolver el Patrimonio Neto como cuenta de posición de cambio.**
La función busca `allAccounts.find( a => (a.type === type) && (a.currency === currency) )`
([`transactionsActions.ts:80`](../../src/features/transactions/actions/transactionsActions.ts)) y
**descarta el `codigoBase` que recibe**. Se la llama cuatro veces, y dos son con `type: "equity"`
para resolver la posición de cambio de una transacción de divisas (`:217` y `:226`). En una base con
el seed real existe `3.1.01.01 Patrimonio Neto Inicial` (`equity`, `ARS`), así que **un cambio
ARS→USD desde el formulario asienta contra el Patrimonio Neto en vez de contra `3.3.01-ARS`**, que es
lo que manda [`patterns.md`](../patterns.md) §1.

*Por qué está en verde:* [`accountingService.test.ts:652-657`](../../src/features/accounting/services/accountingService.test.ts)
crea `3.3.01-ARS` y `3.3.01-USD` a mano y llama al servicio directamente. **La función nunca se
ejercita en un test.**

**D2 — `categories.parentId` no es una clave foránea.** Está declarado
`parentId: uuid( "parent_id" )` a secas, con un comentario que dice "Auto-referencia para árbol
jerárquico" pero sin `.references()`. Hoy nada impide una categoría huérfana ni un ciclo.

---

## 1. Contexto y Objetivos

### El problema, en una frase

**La aplicación no puede responder de dónde viene cada cosa**, que es su razón de ser, y falla por
dos vías a la vez:

1.  **La categoría que el usuario elige no llega a la contabilidad.**
    `createTransactionFromFormAction` resuelve la cuenta de gasto con
    `obtenerCuentaPorMoneda({ codigoBase: "5.1.01.99", nombreBase: "Gastos Generales" })`
    ([`transactionsActions.ts:150`](../../src/features/transactions/actions/transactionsActions.ts))
    **sin mirar `data.categoryId`**, que sólo se guarda como etiqueta en la cabecera. Y por el
    defecto D1, el `codigoBase` ni siquiera se usa: la función devuelve la primera cuenta de gasto
    que exista en esa moneda, de modo que **todos los gastos del formulario se imputan a
    `5.1.01.01 Gastos de Supermercado`**, cualquiera sea la categoría elegida.
2.  **Nadie agrupa por categoría.** Búsqueda en todo `src/`: `categoryId` se guarda, se pasa, se
    actualiza y se copia al reversar. **Cero agrupaciones.** No hay un desglose, ni un gráfico, ni
    un total. Las estadísticas de `dashboardMetrics.ts` agrupan por *tipo de cuenta contable*.

### La duplicación de fondo

Las dos tablas contienen **el mismo concepto escrito dos veces**, sin ningún vínculo:

```
CATEGORÍAS (árbol, parentId)         PLAN DE CUENTAS (accounts)
────────────────────────────         ──────────────────────────────
Gastos                               5   (expense)
 ├─ Supermercado y Alimentos    ↔    5.1.01.01  Gastos de Supermercado
 ├─ Servicios del Hogar         ↔    5.1.01.02  Gastos de Servicios
 └─ Alquiler y Expensas         ↔    5.1.01.03  Gastos de Alquiler

Ingresos                             4   (revenue)
 └─ Sueldos y Honorarios        ↔    4.1.01.01  Ingresos por Sueldos
```

Correspondencia uno a uno, exacta. **Ninguno de los tres repositorios de la migración resolvió
esto**, así que no hay implementación de referencia que copiar: FinanzasMock guarda texto suelto sin
jerarquía, FinanceApp-WSL lo mete en un `metadata` JSON con fallback `"Otros"`, y este repositorio
tiene tabla propia con árbol pero sin vínculo contable y sin forma de crear una.

### Objetivos

1.  Fusionar los dos árboles en uno solo, sin perder un solo movimiento del libro.
2.  Que el gasto se impute a la cuenta de la categoría elegida.
3.  Que el usuario pueda crear, renombrar y archivar sus categorías.
4.  Dar un catálogo inicial con el que se pueda categorizar desde el primer día.
5.  Corregir D1, que es un defecto contable vivo.

### Lo que este RFC **no** cubre

*   La página de estadísticas y sus gráficos. Este RFC deja la dimensión agrupable; **quién la
    dibuja es otro RFC** (Fase 7 de la hoja de ruta).
*   Los presupuestos por categoría (Fase 3).
*   La conversión a moneda base para totalizar categorías multidivisa: es el §4 del RFC 015 y está
    bloqueado hasta la Fase 4. **Con una sola divisa este RFC funciona completo desde el día uno.**
*   La bandeja de transacciones propuestas, que es su RFC hermano.

---

## 2. Decisión central

**Una categoría es una cuenta contable de resultado.** No dos filas vinculadas: la misma cosa, vista
con dos vocabularios. El usuario ve *Supermercado*; la contabilidad ve `5.1.01.01`; **el usuario
nunca ve el número.**

De ahí se siguen cinco reglas.

### R1 — Sólo gastos e ingresos son categorías

Las raíces `Gastos` e `Ingresos` **son los tipos contables** (`expense` y `revenue`), no categorías
editables. La Caja de Ahorro, la cuenta de una tarjeta y el Patrimonio Neto son cuentas y **no** son
categorías: contestan *de dónde salió la plata*, no *qué fue ese gasto*. Son dos preguntas distintas,
y el mock ya las separaba con `category` y `paymentMethod` como campos independientes.

### R2 — Dos niveles: categoría y subcategoría

Colgando del tipo. Cubre los casos reales, mantiene un solo nivel de sangría en cada selector, y da
una respuesta obvia a *¿por qué nivel agrupa un reporte?*: por el de arriba.

### R3 — Los padres agrupan; sólo las hojas reciben movimientos

Cuando el usuario elige *Supermercado* sin detallar, se imputa a una hoja **`General`** que el
sistema crea sola la primera vez. Al crear la primera subcategoría real, **lo ya imputado al padre se
mueve a esa hoja**.

*Por qué:* sin esta regla, un padre queda con saldo propio **más** hijas, y cada reporte tendría que
acordarse de sumar las dos cosas. Es el tipo de detalle que se olvida en la consulta número once y
produce doble conteo.

### R4 — No se borra: se archiva

Deja de ofrecerse en los selectores y desaparece de los menús; los movimientos viejos conservan su
categoría y los reportes históricos siguen siendo correctos. Se puede desarchivar.

*Fundamento, ya en el esquema:* `ledgerEntries.accountId` tiene `onDelete: "restrict"` justamente
para que no se borre una cuenta con movimientos. Al unificar, esa protección pasa a valer para las
categorías, y archivar es lo único compatible con un libro inmutable. El contraste refuerza la
decisión: `ledgerTransactions.categoryId` tiene `onDelete: "set null"`, así que **hoy borrar una
categoría desclasifica su historial en silencio** — exactamente lo que no puede pasar.

### R5 — Una categoría agrupa una cuenta por divisa

El usuario ve *Supermercado*; por debajo hay `5.1.01.01-ARS` y `5.1.01.01-USD`, que nacen solas la
primera vez que se gasta en esa moneda.

*Por qué hace falta:* una cuenta contable tiene una sola divisa y el motor valida Debe = Haber por
divisa (`accountingService.ts:106`). Sin esto, el usuario vería *Supermercado* y *Supermercado (USD)*
como dos categorías y el donut partiría en dos el mismo concepto — que es literalmente lo que pasa
hoy con `Gastos Generales (USD)`.

**El patrón ya está construido y probado en este repositorio:** es el mismo `cards` → `card_accounts`
del RFC 007, una fila por divisa sobre un motor de una moneda por cuenta.

---

## 3. Esquema de base de datos

### A. `categories` — se convierte en la cara visible de la cuenta

```typescript
export const categories = pgTable( "categories" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  // Auto-referencia real. Hoy es un uuid suelto: nada impide una categoría huérfana (defecto D2).
  parentId:       uuid( "parent_id" ).references( (): AnyPgColumn => categories.id , {onDelete: "restrict"} ) ,

  name:           varchar( "name"  , {length: 100} ).notNull() ,
  icon:           varchar( "icon"  , {length: 50 } ) ,
  color:          varchar( "color" , {length: 7  } ) ,

  // NUEVO — el tipo contable al que pertenece. Sólo 'expense' | 'revenue' (R1).
  type:           varchar( "type" , {length: 20} ).notNull() ,

  // NUEVO — el prefijo del código contable de sus cuentas por divisa. Ej: '5.1.01.01'.
  // Sin sufijo de moneda: ese lo agrega cada cuenta. Único por organización.
  accountCode:    varchar( "account_code" , {length: 50} ).notNull() ,

  // NUEVO — baja lógica (R4). Mismo patrón que `cards.archivedAt` del RFC 007.
  archivedAt:     timestamp( "archived_at" , {withTimezone: true} ) ,

  // NUEVO — marca la hoja `General` que el sistema crea sola bajo un padre (R3).
  isSystemLeaf:   boolean( "is_system_leaf" ).default( false ).notNull() ,

  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueOrgCode:  uniqueIndex( "categories_org_account_code_unique" ).on( table.organizationId , table.accountCode ) ,
  orgParentIdx:   index( "categories_org_parent_idx" ).on( table.organizationId , table.parentId ) ,
} ) ; } ) ;
```

> **`AnyPgColumn` es obligatorio** en la auto-referencia: sin esa anotación, TypeScript no puede
> inferir el tipo de una tabla que se referencia a sí misma y `pnpm exec tsc --noEmit` falla. Es el
> tipo de detalle que el build no atrapa y la compuerta CI sí.

### B. `category_accounts` — el vínculo por divisa

Copia literal de la forma de `card_accounts`
([`cards/schema.db.ts`](../../src/features/cards/schema.db.ts)), que ya está en producción:

```typescript
export const categoryAccounts = pgTable( "category_accounts" , {
  id:         uuid( "id"          ).primaryKey().defaultRandom() ,
  categoryId: uuid( "category_id" ).references( () => categories.id , {onDelete: "restrict"} ).notNull() ,
  accountId:  uuid( "account_id"  ).references( () => accounts.id   , {onDelete: "restrict"} ).notNull() ,
  currency:   varchar( "currency" , {length: 10} ).notNull() ,
  createdAt:  timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueCategoryCurrency: uniqueIndex( "category_accounts_category_currency_unique" ).on( table.categoryId , table.currency ) ,
} ) ; } ) ;
```

> **`onDelete: "restrict"` en `categoryId`**, a diferencia del `cascade` de `card_accounts`: una
> tarjeta se puede dar de baja y sus cuentas quedan; una categoría **no se borra nunca** (R4), así
> que la protección va en los dos extremos.

### C. Lo que **no** cambia

*   **`ledger_transactions.categoryId` se queda como está**, incluido su `onDelete: "set null"`.
    Sigue siendo la etiqueta de la cabecera, y ahora además coincide con la cuenta imputada. No se
    toca la tabla más caliente del sistema por un cambio que no lo exige.
*   **`accounts` no cambia.** Las cuentas de categoría son cuentas normales; el vínculo lo lleva
    `category_accounts`.

---

## 4. Codificación del árbol: `getNextCode` se reescribe

### Por qué el actual no sirve

[`accountCodes.ts`](../../src/features/accounting/utils/accountCodes.ts) arma un prefijo fijo por
tipo (`expense → "5.1.01."`) y le pega un correlativo de dos dígitos. Tiene **dos límites que este
RFC choca de frente**:

1.  **No sabe anidar.** Todo cuelga del mismo `5.1.01.`, así que no puede expresar
    *padre → subcategoría*.
2.  **Topea en 99.** `String( maxSuffix + 1 ).padStart( 2 , "0" )` con `maxSuffix = 99` devuelve
    `"100"`, que rompe el formato de ancho fijo del plan.

### La codificación propuesta

```
5            tipo contable          (expense)
5.1.01       categoría padre        Alimentación
5.1.01.01    subcategoría (hoja)    Supermercado
5.1.01.99    hoja `General`         la que recibe cuando no se detalla
```

Reglas:

*   **Los padres ocupan `<tipo>.1.<NN>`**, con `NN` de 01 a 98 asignado correlativamente.
*   **Las hojas ocupan `<código del padre>.<NN>`**, también de 01 a 98.
*   **El `99` queda reservado en cada nivel para la hoja `General`.** Es la que R3 crea sola.
*   **La divisa es un sufijo de la cuenta, no del código de categoría:** `5.1.01.01-USD`. Ya es lo
    que hace `obtenerCuentaPorMoneda` (`code: \`${codigoBase}-${currency}\``) y lo que permite el
    índice único `(organization_id, code)`.
*   **Al llegar a 98 ocupados en un nivel, la acción falla con un mensaje claro** en vez de generar
    un código inválido. 98 subcategorías bajo un mismo padre es un problema de modelado del usuario,
    no un caso a resolver ensanchando el formato.

`getNextCode( type , existingAccounts )` pasa a
`getNextCategoryCode( { type , parentCode , siblings } )`. **La firma vieja tiene un consumidor
además del formulario:** `createCardAction` la llama con `"liability"`
([`cardsActions.ts:139`](../../src/features/cards/actions/cardsActions.ts)) y
`createAccountAction` con el tipo que venga
([`accountingActions.ts:95`](../../src/features/accounting/actions/accountingActions.ts)). **Las dos
siguen usando la función actual sin cambios**: la nueva es aparte, para el árbol de categorías. No se
toca lo que ya funciona.

---

## 5. Imputación: que la categoría llegue al asiento

Es el objetivo 2, y el cambio más chico de todo el RFC.

En `createTransactionFromFormAction`, la rama `expense` deja de llamar a `obtenerCuentaPorMoneda` con
un código fijo y pasa a resolver **la cuenta de la categoría elegida, en la moneda de la cuenta de
origen**:

```
1. Si `data.categoryId` viene vacío  → hoja `General` del tipo (5.1.99.99).
2. Si apunta a un padre              → su hoja `General` (R3).
3. Si apunta a una hoja              → esa hoja.
4. Buscar en `category_accounts` la fila (categoryId, currency).
   Si no existe, crear la cuenta `<accountCode>-<currency>` y su vínculo.
5. Imputar el débito a esa cuenta.
```

Idéntico para `income` con `revenue`.

### La corrección de D1, en el mismo cambio

`obtenerCuentaPorMoneda` **deja de ignorar el `codigoBase`**. Su búsqueda pasa de
`(type, currency)` a `(code === \`${codigoBase}-${currency}\`)`, con el tipo como verificación.

Esto arregla los dos síntomas de una vez: los gastos dejan de caer todos en la misma cuenta, y **la
posición de cambio deja de resolver contra el Patrimonio Neto**. Cubrir esta función con tests es
parte del alcance: hoy no tiene ninguno.

> **Radio de impacto de tocar esta función.** Se la llama en cuatro lugares, todos en
> [`transactionsActions.ts`](../../src/features/transactions/actions/transactionsActions.ts):
> `:150` (gasto), `:175` (ingreso), `:217` y `:226` (posición de cambio, origen y destino). **Las
> cuatro llamadas cambian de comportamiento** con esta corrección, y las dos de posición de cambio
> son las que hoy están mal. Los tests de cambio de divisas de
> `accountingService.test.ts` **no la ejercitan** —crean las cuentas a mano—, así que **el arreglo
> no puede apoyarse en la suite existente**: hay que escribirle tests propios al Server Action.

---

## 6. El usuario puede, por fin, crear categorías

`categoryRepository` tiene hoy `findAll` y `create`, y **ningún Server Action expone la creación**.
Se amplía el repositorio (`findById`, `findChildren`, `update`, `archive`, `unarchive`) y se agregan
las acciones, todas con `organizationId` de la sesión y validación Zod:

| Acción | Qué hace | Reglas que aplica |
| :--- | :--- | :--- |
| `createCategoryAction` | Alta de padre o subcategoría | Asigna `accountCode` (§4). Si nace bajo un padre que tenía movimientos, dispara la mudanza de R3 |
| `updateCategoryAction` | Renombrar, ícono, color | **`accountCode` y `type` son inmutables.** Renombrar la categoría renombra sus cuentas |
| `archiveCategoryAction` | Baja lógica (R4) | Archiva en cascada las hojas del padre |
| `unarchiveCategoryAction` | La devuelve a los selectores | — |
| `getCategoryTreeAction` | El árbol armado, sin archivadas por defecto | Reemplaza a `getCategoriesAction`, que sigue existiendo para el filtro de transacciones |

**Lo que ninguna acción permite:** crear una categoría de tipo `asset`, `liability` o `equity` (R1),
mover una categoría de padre (cambiaría su código contable con movimientos ya imputados), ni borrar.

---

## 7. Agrupar: el total por categoría ya está calculado

El contraste dejó claro algo que evita trabajo: **el saldo está materializado**.
`accountingService.ts:129` actualiza `accounts.balance` dentro de la transacción ACID con bloqueo de
fila. Entonces el total de una categoría **no se calcula sumando `ledger_entries`**: es la suma de
los `balance` de sus filas en `category_accounts`.

Para el desglose por período —lo que necesita el donut de un mes— ya existe
`sumEntriesByAccountInRange` en `ledgerRepository`, que es uno de sus siete métodos de lectura. **No
hay que escribir SQL suelto**: todo el acceso al libro está encapsulado ahí (50 referencias en el
repositorio, cero consultas sueltas en acciones o componentes), y este RFC mantiene esa regla.

> **La totalización multidivisa queda fuera de alcance.** Sumar `5.1.01.01-ARS` con
> `5.1.01.01-USD` exige la conversión a moneda base del RFC 015 §4, bloqueada hasta la Fase 4. Hasta
> entonces, el total por categoría se muestra **por divisa**, no consolidado. Con una sola moneda
> —el caso de la enorme mayoría— la funcionalidad está completa.

---

## 8. Las suscripciones usan el árbol único

`subscriptions.category` (`varchar(30)`, default `'other'`) desaparece y se reemplaza por
`categoryId` apuntando a `categories`. Sus siete valores pasan a ser categorías del catálogo inicial,
bajo *Suscripciones y Servicios Digitales*:

| Valor hoy | Categoría del catálogo |
| :--- | :--- |
| `design` | Diseño |
| `productivity` | Productividad |
| `entertainment` | Entretenimiento |
| `fitness` | Salud y Fitness |
| `security` | Seguridad |
| `storage` | Almacenamiento |
| `other` | *(sin equivalente: cae en la hoja `General`)* |

**Radio de impacto — dónde se toca `subscriptions.category`:**
[`schema.db.ts:48`](../../src/features/subscriptions/schema.db.ts) ·
[`subscriptions.schema.ts:20`](../../src/features/subscriptions/schemas/subscriptions.schema.ts)
(el `z.enum` de siete valores) · `subscriptions.schema.test.ts:14,49` (un test afirma que `"gaming"`
es inválido, y hay que reescribirlo) · el selector del modal de alta · y el tipo de la feature.
**El treemap y la tarjeta de suscripción no lo consumen**: hoy el campo no alimenta ninguna vista.

---

## 9. Migración de lo existente

Una sola migración, la **0023**, más un script de datos. **No se pierde ni se reasigna ningún
movimiento del libro.**

### Paso 1 — Esquema

Columnas nuevas en `categories` (`type`, `account_code`, `archived_at`, `is_system_leaf`), la FK real
de `parent_id`, y la tabla `category_accounts`.

`type` y `account_code` nacen `NOT NULL`, así que la migración las agrega **nullable**, corre el
backfill del paso 2 y recién después las marca `NOT NULL`. Es el mismo procedimiento que usó la
migración `0021` con las preferencias: **cambiar el `default` de una columna no reescribe lo ya
guardado**, el `UPDATE` va escrito a mano dentro de la migración.

### Paso 2 — Fusionar las cuatro gemelas

Las cuatro categorías del seed tienen cuenta gemela exacta. Se unen así:

| Categoría | Cuenta existente | Queda |
| :--- | :--- | :--- |
| Sueldos y Honorarios | `4.1.01.01 Ingresos por Sueldos` | `type='revenue'`, `account_code='4.1.01.01'`, fila en `category_accounts` con la cuenta que ya existe |
| Supermercado y Alimentos | `5.1.01.01 Gastos de Supermercado` | ídem, `expense` |
| Servicios del Hogar | `5.1.01.02 Gastos de Servicios` | ídem |
| Alquiler y Expensas | `5.1.01.03 Gastos de Alquiler` | ídem |

**Las cuentas no se crean ni se renumeran: se adoptan.** Sus saldos y sus asientos quedan intactos, y
las transacciones que hoy apuntan por separado a la categoría y a la cuenta pasan a apuntar a las dos
mitades de la misma cosa.

Las raíces `Ingresos` y `Gastos` **dejan de ser filas de `categories`**: pasan a ser los tipos
contables (R1). Sus dos filas se eliminan después de reapuntar `parentId` de las hojas.

### Paso 3 — El resto del catálogo

Las categorías del §10 que no existan se crean con su cuenta, con `balance = 0`. **Ninguna emite
asiento**: una cuenta de resultado nace en cero por definición, no hay saldo de apertura que
justificar.

### Paso 4 — `Gastos Generales`

Las cuentas `5.1.01.99 Gastos Generales` / `4.1.01.99 Ingresos Varios` que `obtenerCuentaPorMoneda`
haya creado —y donde hoy está imputado casi todo— se adoptan como **la hoja `General`** de su tipo.
Lo ya gastado queda donde está, correctamente clasificado como *sin detallar*, y el usuario puede
recategorizarlo transacción por transacción desde `/transactions`.

> **Lo que este paso no hace: reclasificar retroactivamente.** Los gastos viejos que cayeron en
> `5.1.01.01 Gastos de Supermercado` por el defecto D1 **se quedan ahí**, aunque su `categoryId`
> diga otra cosa. Corregirlos automáticamente significaría emitir contra-asientos masivos sobre un
> libro inmutable, a partir de una etiqueta que nunca fue autoritativa. **La discrepancia es
> histórica y honesta; se corrige a mano o no se corrige.**

---

## 10. Catálogo inicial

**Decidido por el usuario el 2026-09-09:** catálogo estándar completo, para que se pueda categorizar
desde el primer día sin inventar nada. Lo que no se usa se archiva.

### Gastos (`expense`, raíz `5`)

| Código | Categoría | Subcategorías |
| :--- | :--- | :--- |
| `5.1.01` | **Vivienda** | Alquiler · Expensas · Impuestos y tasas · Mantenimiento |
| `5.1.02` | **Servicios del hogar** | Luz · Gas · Agua · Internet y teléfono |
| `5.1.03` | **Alimentación** | Supermercado · Verdulería y carnicería · Restaurantes y delivery |
| `5.1.04` | **Transporte** | Combustible · Transporte público · Seguro y patente · Mantenimiento |
| `5.1.05` | **Salud** | Obra social y prepaga · Farmacia · Consultas y estudios |
| `5.1.06` | **Educación** | Cuotas · Cursos y capacitación · Materiales |
| `5.1.07` | **Entretenimiento** | Salidas · Viajes · Hobbies |
| `5.1.08` | **Compras** | Indumentaria · Hogar · Tecnología · Regalos |
| `5.1.09` | **Suscripciones y servicios digitales** | Entretenimiento · Productividad · Diseño · Salud y fitness · Seguridad · Almacenamiento |
| `5.1.10` | **Impuestos y tributos** | Monotributo · Ingresos brutos · Bienes personales |
| `5.1.11` | **Comisiones y gastos financieros** | Comisiones bancarias · Intereses · Mantenimiento de cuenta |
| `5.1.12` | **Otros gastos** | — |

### Ingresos (`revenue`, raíz `4`)

| Código | Categoría | Subcategorías |
| :--- | :--- | :--- |
| `4.1.01` | **Trabajo en relación de dependencia** | Sueldo · Aguinaldo · Bonos |
| `4.1.02` | **Trabajo independiente** | Honorarios · Facturación a clientes |
| `4.1.03` | **Rentas** | Alquileres · Dividendos |
| `4.1.04` | **Intereses y rendimientos** | Plazo fijo · Cuenta remunerada |
| `4.1.05` | **Reintegros y devoluciones** | — |
| `4.1.06` | **Otros ingresos** | — |

Notas de diseño:

*   **Cada padre recibe además su hoja `General` (`.99`)** al primer movimiento sin detallar (R3).
*   **`Comisiones y gastos financieros` (`5.1.11`) no es decorativa:** es donde caen las comisiones
    de tarjeta que hoy están modeladas en `cards.monthlyMaintenanceFee` y `annualRenewalFee` sin que
    ningún proceso las devengue, y donde caerá el interés de los préstamos del RFC 008 —que separa
    amortización de capital (baja de pasivo) de interés (gasto).
*   El catálogo **se siembra por organización**, no es global: cada una puede archivar y crear las
    suyas desde el día uno.

---

## 11. Plan de verificación

Lo mínimo que tiene que estar en verde antes de dar esto por hecho:

```bash
pnpm test                  # vitest
pnpm lint                  # eslint --max-warnings 0
pnpm exec tsc --noEmit     # SEPARADO. Contar con: | grep -c "error TS"
pnpm build                 # produccion
```

Cobertura nueva exigida:

1.  **`getNextCategoryCode`**: anidamiento correcto, reserva del `99`, y el fallo explícito al
    llegar a 98 hermanos.
2.  **`obtenerCuentaPorMoneda` corregida**: que con `codigoBase: "3.3.01"` y una cuenta
    `3.1.01.01 Patrimonio Neto` presente **devuelva `3.3.01-ARS` y no el patrimonio** (D1). Este test
    falla hoy, y es la prueba de que el defecto era real.
3.  **Imputación**: un gasto con categoría *Supermercado* deja el débito en `5.1.01.03.01-ARS`, y uno
    sin categoría en la hoja `General`.
4.  **R3**: crear la primera subcategoría bajo un padre con movimientos mueve lo imputado a la hoja.
5.  **R4**: archivar una categoría con movimientos funciona; borrarla es imposible.
6.  **R5**: gastar en USD sobre una categoría que sólo tenía cuenta ARS crea la segunda cuenta y su
    vínculo, sin duplicar la categoría.
7.  **Migración 0023**: sobre una copia del seed, las cuatro gemelas quedan fusionadas, con los
    saldos y los asientos idénticos a antes.

> **Trampa conocida:** agregar columnas a `categories` rompe fixtures de tests de otras features. Ya
> pasó con `cbu_cvu` y `alias` en `accounts`, que rompieron `accountCodes.test.ts`,
> `dashboardMetrics.test.ts` y `derivarTipo.test.ts`. Y **`pnpm build` no tipa los archivos de test**:
> el typecheck va como comando propio o la compuerta CI se pone en rojo con el build en verde.

---

## 12. Qué desbloquea

| Módulo | Por qué esperaba a esto |
| :--- | :--- |
| **Suscripciones al libro mayor** (RFC 004) | Necesita saber contra qué cuenta imputar el cargo. Hoy no existe esa cuenta |
| **Presupuestos** (Fase 3) | Presupuestar por categoría exige que la categoría sea una dimensión agrupable |
| **Estadísticas** (Fase 7) | El donut de gastos por categoría es, literalmente, esto |
| **Deudas y préstamos** (RFC 008) | El interés de una cuota es un gasto, y va a `5.1.11` |

---

## 13. Decisiones abiertas

Ninguna que bloquee la implementación. Queda anotado, para cuando toque:

*   **La discrepancia histórica del paso 4.** Los movimientos anteriores a este RFC tienen
    `categoryId` diciendo una cosa y cuenta imputada diciendo otra. Se decidió no reescribirlos.
    Cualquier reporte que mire hacia atrás va a ver ese quiebre, y conviene que la interfaz lo diga
    en vez de disimularlo.
*   **Recategorizar en masa.** `updateTransactionAction` ya permite cambiar el `categoryId` de una
    transacción, pero de a una. Si el quiebre anterior molesta, hace falta una herramienta de
    recategorización por lote, que este RFC no incluye.
