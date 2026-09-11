# Plan — RFC 024, tanda 1: el directorio por entidad y el cierre de la puerta de atrás

*   **Rama:** `docs/rfc-024-navegacion-por-entidad` — **ya existe y es la rama activa.** No cambiar de rama.
*   **Habilitado por:** [RFC 024](../proposals/024-instruments-and-entity-navigation.md), `APPROVED` el 2026-09-10.
*   **Alcance:** §3, §4, §5.2 puntos 1 y 2, y §6.1 del RFC.
*   **Tandas:** ésta es **la primera de dos**. La segunda —mudar el plan de cuentas a `/settings`— **no** es alcance de este plan.

> [!IMPORTANT]
> Este plan **no lleva migración de base de datos**. `financial_entities` ya existe y las tres tablas
> que se cruzan ya tienen su columna de entidad. Si en algún punto parece hacer falta un
> `pnpm db:generate`, **es señal de que el paso se entendió mal**: pará y reportá.

---

## Lo que NO es alcance de esta tanda

| No se toca | Por qué |
| :--- | :--- |
| La tab «Plan contable» de `/accounts` | Es la tanda 2. **Sigue funcionando igual que hoy** |
| `/settings` y `CategoriesSettingsContainer` | Tanda 2 |
| Quitar el Patrimonio Neto de `/accounts` | Por decisión del usuario **se queda**, sólo se le corrige el signo. Se mudará cuando exista la página de estadísticas |
| `/cards` y `CardsContainer` | La vista transversal de tarjetas ya está y no cambia |
| El motor contable, el plan de cuentas, `category_accounts` | El RFC es capa de lectura y presentación |
| `monthly_summaries` y la sparkline | Su convención de signo es un cabo abierto del §9 del RFC |
| Crear `/debts` o `/wealth` | No existen y no se crean acá |

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo el 2026-09-10. **Reusar, no reescribir.**

| Ya existe | Dónde | Qué hace hoy |
| :--- | :--- | :--- |
| Agrupación por entidad | `AccountsContainer.tsx` , `const groupedWallets` | `reduce` que agrupa por `val.entity?.name`, con `"Otros"` como clave de las cuentas sin entidad. **Funciona** |
| Modal de detalle de entidad | `AccountsContainer.tsx` , estado `selectedEntity` | Modal que lista las cuentas de la entidad y ofrece «+ Agregar Cuenta a \<entidad\>» |
| Alta con entidad preseleccionada | `AccountsContainer.tsx` , estado `preselectedEntityId` | Abre `CreateAccountForm` con `defaultEntityId` ya cargado |
| Lectura de tarjetas con sus cuentas | `cardsActions.ts` , `getCardsAction()` | Devuelve `Result<CardWithAccountsAndEntity[]>`. Cada tarjeta trae `entity`, y `accounts: CardAccountWithAccount[]`, donde cada elemento tiene `account: Account` |
| Carga concurrente de la página | `cards/page.tsx` | `Promise.all` con `getDictionary`, `getCardsAction`, `getAccountsAction` y `getFinancialEntitiesAction`. **Es el patrón a copiar** |
| Presentación de una tarjeta | `CardVisual.tsx` | Dibuja marca, últimos cuatro y deuda |
| Negación del saldo de un pasivo | `cards/utils/ciclo.ts` , `deudaDe( cuenta )` | `return( (cuenta.balance === 0) ? 0 : -cuenta.balance )`. Devuelve deuda **positiva** y evita el `-0` |
| Logo de la entidad | `InstitutionLogo` , campo `brandDomain` | Ya importado y usado en `AccountsContainer` |

---

## Paso 1 — Corregir el signo del Patrimonio Neto

**El defecto.** En `AccountsContainer.tsx`, el bloque que arranca con el comentario `// Calcular métricas`:

```ts
const totalLiabs = walletAccounts.filter( ( a ) => a.type === "liability" ).reduce( ( sum , a ) => (sum + a.balance) , 0 ) ;
const netWorth   = ( totalAssets - totalLiabs ) ;
```

El motor guarda los pasivos **negados** (`patterns.md` §8: una sola fórmula para activos, gastos y
pasivos). `totalLiabs` ya es negativo, y restarlo **suma la deuda**. Con el seed —tarjeta en
`-2.500.000`— el patrimonio se infla en 5.000.000.

**Contrastar contra:** `patterns.md` §1 punto 5, que dice textualmente que la identidad
`Activos − Pasivos` *«no se aplica directamente sobre la columna `balance`»* y que **la fórmula sobre
los saldos del repositorio es una suma**.

**Qué hacer.** `netWorth` pasa a ser la **suma** de los saldos, no la resta. Dejá un comentario de una
línea que diga por qué es una suma y remita a `patterns.md` §8, o el próximo lector lo "arregla" al
revés.

**Lo que NO hay que hacer:** no toques `totalAssets` ni `totalLiabs` por separado si se muestran como
métricas propias — sólo la combinación está mal. Y **no cambies el signo almacenado** en ningún lado.

**Cuidado con el vecino que está bien.** En el mismo archivo, dentro del `map` sobre
`Object.entries( groupedWallets )`, está `const netBalance = list.reduce( ( sum , a ) => sum + a.balance , 0 )`.
**Eso está correcto y no se toca**: suma todos los instrumentos de la entidad con su signo, que es
justamente la fórmula buena. La sesión de diseño lo había marcado como sospechoso y el contraste
mostró que no lo es.

---

## Paso 2 — Cerrar la puerta de atrás de `CreateAccountForm`

**El defecto.** Desde el RFC 022 hay dos puertas para crear una cuenta de gasto: la pantalla de
Categorías —que crea la categoría **y** su cuenta por divisa— y este formulario, que crea una fila
suelta en `accounts`. La segunda deja **cuentas huérfanas del árbol**: no se ven en `/settings`, no se
pueden elegir al cargar una transacción, y sí figuran en el plan de cuentas.

### 2.1 El esquema es donde se cierra

En `accounting/schemas/accounting.schema.ts`, `createAccountSchema` declara hoy:

```ts
type: z.enum( [ "asset" , "liability" , "equity" , "revenue" , "expense" ] , { error: "..." } ) ,
```

**Restringilo a `[ "asset" , "liability" ]`** y actualizá el mensaje de error para que nombre sólo
esos dos.

**Por qué en el esquema y no sólo en el `<select>`:** una Server Action es un endpoint público.
Esconder una opción en el formulario no impide que llegue el valor. Es el mismo criterio con el que
`updateProfileAction` pasó a validar en modo `.strict()` después de que se pudiera cambiar el plan de
suscripción desde el cliente.

### 2.2 Radio de impacto — verificado, y es chico

| Quién toca esto | Efecto |
| :--- | :--- |
| `createAccountAction` (`accountingActions.ts`) | Único consumidor de `createAccountSchema`. Su `safeParse` empieza a rechazar los tres tipos nominales. **No hay que cambiar su cuerpo** |
| `CreateAccountForm.tsx` | **Único llamador** de `createAccountAction` en todo el repositorio |
| Alta de categorías (RFC 022) | **No se ve afectada.** Crea sus cuentas con `insert( accounts )` directo en `categoryRepository.ts`, sin pasar por el esquema ni por la acción. **Verificado** |
| `accountRepository.ts` | También inserta directo. Sin efecto |
| Seed | Inserta directo. Sin efecto |

### 2.3 El formulario

En `CreateAccountForm.tsx`:

*   Quitá del `<select>` de tipo las tres `<option>` de `equity`, `revenue` y `expense`. Quedan Activo
    y Pasivo.
*   **Simplificá la lógica condicional que quedó muerta.** Hoy el archivo tiene, en tres lugares,
    comprobaciones del estilo `( type === "equity" ) || ( type === "revenue" ) || ( type === "expense" )`:
    en el efecto que resetea la entidad al cambiar de tipo, en el `disabled` del selector de entidad,
    y en el texto de su `<option>` vacía. Con sólo dos tipos posibles, **la entidad pasa a ser
    siempre requerida** y esas ramas dejan de tener sentido. Eliminalas en vez de dejarlas
    inalcanzables.
*   Revisá si `prevType` / `setPrevType` siguen haciendo falta después de esa simplificación. Si
    quedan sin uso, sacalos.

### 2.4 Los tests de este paso

*   **`accounting.schema.test.ts`** ya cubre `createAccountSchema`: un caso con `type: "asset"` que
    debe seguir pasando, y uno con `type: "invalido"` que ya falla. **Agregá un caso nuevo** que
    verifique que `type: "expense"` ahora es **rechazado**, y que el mensaje de error nombra los tipos
    admitidos.
*   **`accountingActions.test.ts` no se rompe.** Su test de `createAccountForEntityAction` inserta la
    cuenta `equity` con `db.insert( accounts )` directo, no por la acción. **Verificado.** No lo
    toques.

---

## Paso 3 — El directorio por entidad muestra cada instrumento como lo que es

**El síntoma.** En `AccountsContainer.tsx`, la línea que arma `walletAccounts` mete `asset` **y**
`liability` en la misma colección, y esa colección es la que después se agrupa por entidad. Por eso
la tarjeta Visa aparece como `2.1.01.01` con saldo negativo al lado de la Caja de Ahorro.

### 3.1 La página pasa a cargar también las tarjetas

En `src/app/[lang]/(main)/accounts/page.tsx`, sumá `getCardsAction()` al `Promise.all` que ya trae
cuentas, resúmenes y entidades, y pasá el resultado al contenedor como prop nueva.

**Copiá el patrón de `cards/page.tsx`**, que ya hace exactamente esto con las mismas cuatro llamadas.
Mantené el manejo de `Result`: `( cardsRes.success ? cardsRes.value : [] )`.

**No agregues una llamada en cascada.** Va dentro del `Promise.all` existente, no después.

### 3.2 El contenedor separa las tres familias

Dentro de cada entidad, se presentan por separado:

1.  **Cuentas** — las de `type === "asset"` de esa entidad.
2.  **Tarjetas** — las de `cards` cuyo `entityId` coincide, dibujadas como tarjetas.
3.  **Préstamos** — no existen todavía. **No dibujes la sección**: sin RFC 008 no hay nada que listar.

**La regla que evita contar la deuda dos veces.** Una cuenta `liability` que es el reflejo contable de
una tarjeta **no se muestra como cuenta**, porque ya está representada por su tarjeta. Para saber
cuáles son, armá el conjunto de `account.id` que aparecen en `card.accounts[].account` de las tarjetas
recibidas, y excluí esas cuentas del listado de cuentas de la entidad.

**Una cuenta `liability` que no esté en ese conjunto sí se sigue mostrando como cuenta.** No se ocultan
pasivos: se ocultan los que ya tienen quien los represente. Un préstamo cargado a mano como pasivo
tiene que seguir viéndose.

### 3.3 La deuda se muestra en positivo

Todo lugar nuevo que muestre el saldo de un pasivo **usa `deudaDe()` de `cards/utils/ciclo.ts`**, que
ya resuelve la negación y el caso del cero. No reimplementes `-balance` a mano.

### 3.4 El agrupamiento actual se conserva

`groupedWallets` sigue existiendo y sigue agrupando por `entity?.name` con `"Otros"` como clave de las
huérfanas. **No lo reescribas**: lo que cambia es qué entra en la colección que se agrupa y cómo se
dibuja cada familia adentro, no el mecanismo.

---

## Paso 4 — El modal de detalle de entidad muestra todo lo que se tiene con ella

El modal actual —estado `selectedEntity`— lista sólo cuentas. Pasa a mostrar las mismas familias del
paso 3: cuentas y tarjetas de esa entidad, con la misma regla de exclusión.

**Se mantiene como modal.** El RFC §3.3 lo decidió así de forma explícita: no se crea `/accounts/[id]`.
Si te parece que hace falta una ruta, **no la crees**: anotalo como hallazgo.

Conservá la acción «+ Agregar Cuenta a \<entidad\>» que ya tiene, con su `preselectedEntityId`.

---

## Paso 5 — Textos

Si agregás encabezados de familia («Cuentas», «Tarjetas») o cualquier texto visible, va por
diccionario en **`es.json`, `en.json` y `br.json`**, los tres. No dejes literales sueltos en el JSX.

**Contrastá antes de inventar claves:** `AccountsContainer` ya lee de `dict.accountsPage`, y hay claves
`cardsPage` en los tres diccionarios desde la ronda del `PageHeader`. Reusá lo que exista.

---

## Estilo

Antes de escribir la primera línea, abrí **`.agents/AGENTS.md` §4**, que **no se autocarga**:
espaciado de delimitadores, `return( ... ) ;`, alineación por columnas en los imports, CSS Modules con
tokens, sin px fijos estructurales, y **nada de movimiento ni cambio de dimensiones en `:hover`**.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**. `postgres-dev` tiene que estar
arriba o la suite muere en el setup con `ECONNREFUSED`, que es **entorno caído, no suite roja**.

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
pnpm build
```

**Pegá la salida, no la describas.** Y para los tests, **reportá el número que imprime vitest**, no el
que predice este plan.

**Punto de partida, medido sobre `master` el 2026-09-10:** 54 archivos de test, 399 tests, lint 0/0,
0 errores TS, build verde.

**Al terminar deberían ser 54 archivos y 400 tests**: el paso 2.4 agrega **un `it` dentro de
`accounting.schema.test.ts`, que ya existe**, así que sube el total de tests y no el de archivos. Si
agregás algún archivo de test más, el conteo de archivos sube con él.

Si el número no coincide, **decí el que salió**. La ronda pasada el plan predijo un total mal —sumó
los tests nuevos pero no el archivo que los traía— y se reportó el número del plan en vez del de la
corrida: hubo que investigar una discrepancia que no existía.

---

## Qué reportar al terminar

1.  La salida cruda de los cinco comandos.
2.  Los archivos tocados.
3.  **Hallazgos:** lo que viste y no hiciste porque este plan no lo nombraba. Es entrada de la próxima
    ronda, no ruido. Si algo del plan resultó inexacto contra el código real, **decilo**: el plan se
    escribió contrastando, pero el repo se mueve.
