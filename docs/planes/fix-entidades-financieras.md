# Plan — Corrección del alta de entidades financieras

**Rama que lo consume:** `fix/entidades-financieras` (sale de `chore/gobernanza-reglas-neutrales`).
**Decisiones tomadas por el usuario el 2026-09-07.** El plan no contiene preguntas abiertas.

---

## 1. El problema

`createFinancialEntityAction` ([`src/features/accounting/actions/accountingActions.ts:129-206`](../../src/features/accounting/actions/accountingActions.ts#L129))
no es un alta de entidad pura. Dentro de una sola `db.transaction` hace dos cosas:

1.  Inserta en `financial_entities` — **correcto**, la tabla ya tiene `organizationId`, así que la
    entidad nace genérica de la organización.
2.  Crea además una cuenta `Cuenta Principal <nombre>` de tipo `asset` en el plan de cuentas de la
    organización, con código correlativo de `getNextCode( "asset" , ... )` — **esto sobra**.

Como [`PaymentMethodsPanel.tsx:415`](../../src/features/contacts/components/PaymentMethodsPanel.tsx#L415)
reutiliza `CreateFinancialEntityForm` sin ninguna variante, dar de alta una entidad para el método de
cobro de un contacto **crea una cuenta de activo propia del usuario en un banco donde no opera**.

Tres defectos derivados, todos verificados en el código:

*   **Violación de partida doble.** El formulario expone *Saldo Inicial de la Cuenta por Defecto*
    ([`CreateFinancialEntityForm.tsx:366-376`](../../src/features/accounting/components/CreateFinancialEntityForm.tsx#L366)),
    campo `required`, también en el flujo de contactos. `accountRepository.create`
    ([`accountRepository.ts:87-93`](../../src/features/accounting/repositories/accountRepository.ts#L87))
    es un `insert` pelado sin asiento de contrapartida: un saldo inicial mayor a cero **incorpora un
    activo sin partida doble**, contra la regla dura nº 1 de [`.agents/AGENTS.md`](../../.agents/AGENTS.md) §8.
*   **La columna `logo` hace dos trabajos.** `handleSelectSuggestion` guarda el dominio de marca en
    `logo` ([`CreateFinancialEntityForm.tsx:206`](../../src/features/accounting/components/CreateFinancialEntityForm.tsx#L206)),
    pero el `FormSelect` "Icono / Logo de Respaldo" (línea 380) **está fuera del guard
    `{!isBrandFromApi && ...}`** que sí protege al campo de color contiguo, y su `onChange` hace
    `setLogo( ... )` **pisando el dominio en silencio**.
*   **Limpieza bloqueada.** `accounts.entityId` declara `onDelete: "restrict"`
    ([`schema.db.ts:49`](../../src/features/accounting/schema.db.ts#L49)): las entidades afectadas no
    se pueden borrar sin eliminar antes la cuenta espuria.

Registrado en [`../TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) § Abierto.

---

## 2. Radio de impacto

**Toda esta sección es de lectura obligatoria antes de escribir la primera línea.** El paso 3 agrega
una columna a `financial_entities`, y en este repositorio agregar una columna a una tabla rompe
fixtures de features que el plan no nombra: `cbu_cvu` y `alias` en `accounts` rompieron tres suites
ajenas en la ronda anterior.

### Quién construye o lee el tipo `FinancialEntity`

`FinancialEntity` es `InferSelectModel< typeof financialEntities >`
([`types.ts:15`](../../src/features/accounting/types.ts#L15)): **agregar `brandDomain` cambia el tipo y
todo objeto literal tipado como `FinancialEntity` deja de compilar**. Los cuatro fixtures que
construyen entidades con `logo:` y hay que completar:

| Archivo | Línea |
| :--- | :--- |
| `src/features/accounting/actions/accountingActions.test.ts` | 30 |
| `src/features/contacts/repositories/contactsRepository.test.ts` | 56 |
| `src/features/contacts/components/ContactsTable.test.tsx` | 40 |
| `src/features/contacts/actions/contactsActions.test.ts` | 74 |

### Quién consume entidades financieras

Archivos que mencionan `financialEntit` / `FinancialEntity`, verificados con `grep -rln`:

*   **Accounting:** `schema.db.ts`, `types.ts`, `accountingActions.ts`, `accounting.schema.ts`,
    `financialEntityRepository.ts`, `accountRepository.ts`, `AccountsContainer.tsx`,
    `CreateAccountForm.tsx`, `CreateFinancialEntityForm.tsx`.
*   **Contacts:** `schema.db.ts`, `types.ts`, `contactsActions.ts`, `contacts.schema.ts`,
    `contactsRepository.ts`, `ContactsContainer.tsx`, `ContactsTable.tsx`, `PaymentMethodsPanel.tsx`.
*   **Transactions:** `TransactionsContainer.tsx`, `TransactionsTable.tsx`.
*   **Rutas:** `accounts/page.tsx`, `contacts/page.tsx`, `transactions/page.tsx`.
*   **Otros:** `src/shared/db/seed.ts` (crea entidades con `logo: "bank"` línea 217 y `logo: "cash"`
    línea 227).

`contact_payment_methods.financialEntityId` ([`contacts/schema.db.ts:39`](../../src/features/contacts/schema.db.ts#L39))
también es `onDelete: "restrict"`.

### Reusos explicados — qué hace hoy cada pieza que el plan manda usar

*   **`createLedgerTransaction( params )`**
    ([`accountingService.ts:29`](../../src/features/accounting/services/accountingService.ts#L29)) —
    **abre su propia `db.transaction` internamente (línea 45) y NO acepta un `tx` externo.** No se
    puede llamar desde adentro de otra transacción Drizzle. Valida Debe = Haber **por divisa** y
    actualiza el saldo de cada cuenta afectada (líneas 114-122), así que **la cuenta debe nacer en 0 y
    el asiento le pone el saldo**; sumar el balance en el `insert` *y* emitir el asiento duplicaría el
    importe.
*   **`accountRepository.create( data , tx )`** (línea 87) — `insert` puro. No emite asientos ni
    valida nada. Es correcto usarlo sólo para crear la cuenta en 0.
*   **`accountRepository.findAll( organizationId , tx )`** (línea 102) — devuelve todas las cuentas de
    la organización con su entidad. `createFinancialEntityAction` **ya la llama hoy** (línea 170) para
    alimentar `getNextCode`. Reusar **esa misma lista** para localizar la cuenta de patrimonio, sin
    agregar una consulta nueva: `accountRepository` **no tiene** un método `findByCode`.
*   **`getNextCode( "asset" , todasLasCuentas )`** — genera el código correlativo libre del rubro.
*   **Cuenta de patrimonio:** `3.1.01.01` — "Patrimonio Neto Inicial", `type: "equity"`, creada por
    [`seed.ts:277-286`](../../src/shared/db/seed.ts#L277). **Puede no existir en una organización que
    no venga del seed**: ver el paso 2.3.
*   **`InstitutionLogo`**
    ([`InstitutionLogo.tsx:29-65`](../../src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx#L29)) —
    hoy desambigua **olfateando strings**: si `propLogoUrl` empieza con `http` lo usa directo, si
    `includes( "." )` lo trata como dominio de Brandfetch, y si no, cae al camino de búsqueda por
    nombre de institución. Esa heurística es la que el paso 3 vuelve innecesaria.

### Contraste obligatorio contra lo que ya existe

*   **`ledger_transactions` ya separa marca de dominio:** `merchantName` / `merchantDomain`
    ([`schema.db.ts:65-66`](../../src/features/accounting/schema.db.ts#L65)). El paso 3 aplica **ese
    mismo patrón** a `financial_entities`, que hoy es la única tabla que no lo sigue. Contrastar el
    nombre y el largo de la columna nueva contra esas dos líneas antes de escribir la migración.
*   **`docs/patterns.md:134-138`** describe el consumo de logotipos de fuentes externas. Releerlo antes
    de tocar `InstitutionLogo` y, si el patrón cambia, actualizarlo en el mismo commit.
*   El campo se llama `logoKey` en suscripciones (`seed.ts:553-560`, con URLs completas). **No
    unificar** eso en esta ronda: queda fuera de alcance.

---

## 3. Los pasos

### Paso 1 — Partir la acción en dos

En [`accountingActions.ts`](../../src/features/accounting/actions/accountingActions.ts):

1.1. **`createFinancialEntityAction`** queda como alta **pura**: valida sesión y Zod, inserta en
`financial_entities` y devuelve la entidad. Se le **quitan** los pasos 2 y 3 actuales (líneas 168-190:
`findAll`, `getNextCode` y `accountRepository.create`) y el parámetro `balance`. Ya no necesita
`db.transaction`: es un solo insert.

1.2. **Nueva `createAccountForEntityAction( params: { entityId: string ; balance?: number } )`**, con
TSDoc, que:

*   valida sesión y `organizationId`, y valida `params` con un esquema Zod nuevo;
*   verifica con `financialEntityRepository.findById( entityId , organizationId )` que la entidad
    **pertenezca a la organización** — sin esto se puede colgar una cuenta de la entidad de otro
    inquilino, que es la regla dura nº 3 de §8;
*   llama a `accountRepository.findAll( organizationId )` **una sola vez** y usa esa lista para
    `getNextCode( "asset" , ... )` **y** para localizar la cuenta de patrimonio del paso 2.3;
*   crea la cuenta con `balance: 0` **siempre** (ver paso 2), `currency: "ARS"`, `entityId`,
    `name: \`Cuenta Principal ${entidad.name}\`` ;
*   si `balance` es mayor a 0, emite el asiento de apertura del paso 2.

1.3. En [`accounting.schema.ts:71-76`](../../src/features/accounting/schemas/accounting.schema.ts#L71),
**sacar `balance` de `createFinancialEntitySchema`** y crear `createAccountForEntitySchema` con
`entityId: z.string().uuid()` y el `balance` en centavos enteros no negativos, con los mismos mensajes
que hoy.

### Paso 2 — El asiento de apertura

2.1. `createAccountForEntityAction` crea la cuenta en 0 y **cierra esa transacción**. Recién después
llama a `createLedgerTransaction`, **porque abre su propia `db.transaction` y no acepta un `tx`**
(ver Reusos). No intentar anidarlas.

2.2. El asiento, sólo si `balance > 0`:

```
description: `Apertura ${nombreDeLaCuenta}`
entries: [
  { accountId: cuentaCreada.id  , debit: balance , credit: 0       } ,
  { accountId: ctaPatrimonio.id , debit: 0       , credit: balance }
]
```

El servicio actualiza los saldos de ambas cuentas, así que **la cuenta creada en 0 queda con
`balance` y no hay que tocar `updateBalance` a mano**.

2.3. **Si no existe la cuenta de patrimonio**, buscada por `code === "3.1.01.01"` sobre la lista ya
traída (con respaldo: la primera de `type === "equity"`), la acción **devuelve `fail`** con un mensaje
explícito y **no crea la cuenta**. Nunca crear el activo sin poder asentar la contrapartida.

2.4. **Consistencia ante fallo:** si el asiento falla después de crear la cuenta, la cuenta queda en 0
— un estado consistente, no un activo fantasma. Devolver `fail` con el error del servicio, mencionando
que la cuenta quedó creada con saldo cero.

### Paso 3 — Partir la columna `logo`

3.1. En [`accounting/schema.db.ts:29-36`](../../src/features/accounting/schema.db.ts#L29), agregar a
`financialEntities`:

```
brandDomain:    varchar( "brand_domain" , {length: 100} ) ,
```

Nullable, alineada en columnas con las vecinas, con comentario al margen igual que `logo` y `color`.
`logo` **queda sólo como ícono de respaldo** (`bank` | `wallet` | `cash` | `credit-card`): actualizar
su comentario, que hoy dice "Identificador de logo o icono".

3.2. `pnpm db:generate` → migración `0020_*.sql` (la última es `0019_tidy_piledriver.sql`), y
**agregarle a mano el backfill**, porque `db:generate` no lo escribe:

```sql
UPDATE financial_entities
SET brand_domain = logo , logo = 'bank'
WHERE logo LIKE '%.%' ;
```

Los valores actuales con punto son dominios; los que no lo tienen (`bank`, `cash` del seed) ya son
íconos y no se tocan.

3.3. En `createFinancialEntitySchema` agregar `brandDomain: z.string().max( 100 ).optional().nullable()`,
y propagarlo en la acción del paso 1.1.

3.4. En [`CreateFinancialEntityForm.tsx`](../../src/features/accounting/components/CreateFinancialEntityForm.tsx):

*   estado nuevo `brandDomain`; `handleSelectSuggestion` (línea 206) pasa a hacer
    `setBrandDomain( sugg.domain )` y **deja de escribir en `logo`**;
*   el banner de marca vinculada (línea 315) muestra `brandDomain`, no `logo`;
*   **envolver el `FormSelect` de ícono (línea 380) en `{!isBrandFromApi && ( ... )}`**, igual que el
    campo de color contiguo, y enviar los dos campos por separado a la acción.

3.5. En [`InstitutionLogo.tsx`](../../src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx),
`resolveDirectLogo` deja de deducir por `includes( "." )` **cuando el llamador ya pasa el dominio
explícito**. Los llamadores que hoy pasan `logo` pasan `brandDomain`. **Conservar la heurística como
respaldo** para filas viejas y para los llamadores que sólo tienen un nombre de institución.

3.6. `seed.ts` (líneas 217 y 227): las entidades del seed mantienen `logo: "bank"` / `"cash"` y suman
`brandDomain: null`, o el dominio real si corresponde.

### Paso 4 — El flujo de contactos deja de crear cuentas propias

4.1. `CreateFinancialEntityForm` recibe una prop nueva de variante — `withOwnAccount?: boolean`, por
defecto `true` — con su TSDoc:

*   **`true`** (`/accounts`, [`AccountsContainer.tsx:307`](../../src/features/accounting/components/AccountsContainer.tsx#L307)):
    muestra el campo de saldo inicial y, tras crear la entidad, llama a `createAccountForEntityAction`.
    **La UI no cambia: sigue siendo un solo submit.**
*   **`false`** ([`PaymentMethodsPanel.tsx:415`](../../src/features/contacts/components/PaymentMethodsPanel.tsx#L415)):
    **oculta el campo de saldo inicial** — hoy es `required`, así que hay que sacarlo del formulario,
    no sólo esconderlo — y llama únicamente a `createFinancialEntityAction`.

4.2. `PaymentMethodsPanel` pasa `withOwnAccount={false}`. `AccountsContainer` no se modifica salvo que
haga falta el valor explícito.

### Paso 5 — Diagnóstico de los datos ya creados

**No borrar nada.** Agregar al final de este documento, o al informe de ejecución, la salida de:

```sql
SELECT e.name AS entidad , a.code , a.name AS cuenta , a.balance ,
       count( le.id ) AS movimientos
FROM accounts a
JOIN financial_entities e ON e.id = a.entity_id
LEFT JOIN ledger_entries le ON le.account_id = a.id
WHERE a.name LIKE 'Cuenta Principal %'
GROUP BY e.name , a.code , a.name , a.balance
HAVING count( le.id ) = 0 ;
```

Ejecutar con:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "<consulta>"
```

El usuario decide qué se borra. **La limpieza no es parte de esta ronda.**

### Paso 6 — Tests

6.1. Completar los cuatro fixtures de la tabla del radio de impacto con `brandDomain`.

6.2. Tests nuevos, siguiendo el estilo de
[`accountingActions.test.ts`](../../src/features/accounting/actions/accountingActions.test.ts):

*   `createFinancialEntityAction` **no crea ninguna cuenta** (el caso que motiva todo el plan);
*   `createAccountForEntityAction` con `balance > 0` emite el asiento y deja la cuenta con ese saldo;
*   con `balance` 0 o ausente **no emite ningún asiento**;
*   sin cuenta de patrimonio devuelve `fail` y **no crea la cuenta**;
*   con una `entityId` de otra organización devuelve `fail`.

6.3. Actualizar `accounting.schema.test.ts` si valida `balance` dentro de
`createFinancialEntitySchema`.

### Paso 7 — Documentación, en el mismo commit

*   [`docs/trabajo-en-vuelo.md`](../trabajo-en-vuelo.md): rama y próximo paso.
*   [`docs/TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md): mover la entrada de § Abierto a § Resuelto, sin
    borrar la descripción.
*   [`docs/patterns.md`](../patterns.md): si `InstitutionLogo` cambia de contrato, registrar el patrón
    marca/dominio remitiendo al precedente `merchantName` / `merchantDomain`.

---

## 4. Fuera de alcance

*   Borrar cuentas espurias (paso 5 sólo diagnostica).
*   Unificar `logoKey` de suscripciones con `brandDomain`.
*   La duplicación de búsqueda de marcas en tres componentes que van directo a `api.brandfetch.io`
    (`CreateFinancialEntityForm:138`, `AddSubscriptionModal:356`, `InstitutionLogo:92`).
*   Cablear `CircuitBreaker`, que hoy sólo lo importa su propio test.
*   Partir la UI de `/accounts` en dos pasos: **decidido que se mantiene el combo actual**.

---

## 5. Verificación

Los cuatro, siempre los cuatro, y el typecheck como comando propio. Requiere el contenedor
`postgres-dev` vivo en podman: sin él la suite muere en el setup con `ECONNREFUSED`, y eso es entorno
caído, no suite roja.

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**`pnpm build` no es typecheck:** `next build` no tipa los archivos de test, y el paso 6 los toca. El
`tsc --noEmit` separado no es opcional.

Además, contrastar el esquema contra la base real después de migrar:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d financial_entities"
```

**El reporte pega la salida cruda de los cuatro comandos, no la describe.** Se espera partir de 39
suites y 298 tests en verde, 0 advertencias de ESLint y 0 errores de `tsc`.
