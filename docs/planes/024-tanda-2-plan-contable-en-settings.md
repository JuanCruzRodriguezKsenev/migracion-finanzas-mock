# Plan — RFC 024, tanda 2: el plan de cuentas se muda a `/settings` como auditoría

*   **Rama:** `docs/rfc-024-navegacion-por-entidad` — **ya existe y es la rama activa.** No cambiar de rama.
*   **Habilitado por:** [RFC 024](../proposals/024-instruments-and-entity-navigation.md), `APPROVED` el 2026-09-10.
*   **Alcance:** §5.2 puntos 3 y 4, y §7 del RFC. Con esto **el RFC 024 queda cerrado entero**.
*   **Tandas:** ésta es **la segunda de dos**. La primera ([`024-tanda-1-directorio-por-entidad.md`](024-tanda-1-directorio-por-entidad.md)) ya está ejecutada y verificada en verde.

> [!IMPORTANT]
> Este plan **no lleva migración de base de datos** ni toca el motor contable. Es capa de lectura y
> presentación. Si en algún punto parece hacer falta un `pnpm db:generate`, **es señal de que el paso
> se entendió mal**: pará y reportá.

---

## Decisiones ya tomadas por el usuario — no se rediscuten

| Decisión | Qué implica |
| :--- | :--- |
| La pestaña muestra **el plan de cuentas completo**, los cinco tipos | No sólo las nominales que hoy están en `/accounts`. Auditar un saldo de banco o de tarjeta exige ver `asset` y `liability` |
| Se presenta como **tabla de auditoría**, no como grilla de tarjetas | Columnas: código · nombre · tipo · divisa · saldo. Con buscador. Reusa `DataTable` |
| El shell de `/settings` vive en una **feature nueva `src/features/settings/`** | Perfil, Preferencias y Seguridad no son contabilidad; el dueño de la navegación no puede ser `accounting` |
| La tab activa es **estado local** (`useState`), no query param | No hay ni un `searchParams` para tabs en el repo; `/accounts` y `/settings` ya usan estado local. No se inventa un patrón nuevo en esta tanda |
| Las labels de las tabs de `/settings` **se localizan** | Hoy están hardcodeadas en español (`SETTINGS_TABS`) en un repo trilingüe, y esta tanda agrega una cuarta. Se mudan las cinco al diccionario |

---

## Lo que NO es alcance de esta tanda

| No se toca | Por qué |
| :--- | :--- |
| El Patrimonio Neto de `/accounts` | Por decisión del usuario **se queda** hasta que exista la página de estadísticas. Su signo ya se corrigió en la tanda 1 |
| `MetricsSection`, las tres métricas y las sparklines de `/accounts` | Mismo motivo. La convención de signo de `monthly_summaries` es cabo abierto del §9 del RFC |
| El resto del texto hardcodeado en español de `CategoriesSettingsContainer` | «Buscar categoría o subcategoría…», «Ver archivadas» y los modales siguen igual. Localizarlos es deuda aparte; acá se localizan **sólo las labels de las tabs** |
| Activar las tabs Perfil / Preferencias / Seguridad | Siguen `disabled` con su badge. Sólo cambia de dónde sale su texto |
| El motor contable, `category_accounts`, el signo almacenado | El RFC es capa de lectura |
| `/cards` , `CardsContainer` , `CardVisual` | Fuera del RFC 024 tanda 2 |
| Ordenamiento por columna o paginación en la tabla | `DataTable` no los tiene y 71 filas no los necesitan. **No agregarlos** |

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo el 2026-09-10. **Reusar, no reescribir.**

| Ya existe | Dónde | Qué hace **hoy** |
| :--- | :--- | :--- |
| Tabla genérica | `src/shared/ui/display/DataTable/DataTable.tsx` | `DataTable< T extends object >` con `columns: { key , header , align? , render?( row , i ) }[]`, `data`, `emptyMessage`, `keyExtractor`, `loading` con `Skeleton`, `onRowClick` y `footer`. **No tiene ordenamiento ni paginación.** La consumen `ContactsTable.tsx` y `TransactionsTable.tsx` — mirá una de las dos antes de escribir las columnas |
| Buscador | `src/shared/ui/forms/SearchInput/SearchInput.tsx` | `{ value , onChange( val ) , placeholder? , ariaLabel? , onClear? }`. Es **controlado**: el filtrado lo hace el consumidor. Ya lo usa `CategoriesSettingsContainer` en su `.toolbar` |
| Tabs | `src/shared/ui/display/Tabs/Tabs.tsx` | `{ tabs: { key , label , disabled? , badge? }[] , activeTab , onChange( key ) }`. Ignora el click si `disabled` |
| Encabezado | `src/shared/ui/layout/PageHeader/PageHeader` | Exige `dict` y `lang`. Lo monta hoy `CategoriesSettingsContainer` con `showMonthSelector={false}` |
| Lectura de cuentas | `accountingActions.ts` , `getAccountsAction()` | `Result< Account[] , string >`. Por debajo `accountRepository.findAll()` hace `leftJoin` con `financial_entities` y **ya devuelve `.orderBy( accounts.code )`**. El orden de la tabla sale de ahí: **no reordenar en el cliente** |
| Formato de dinero | `accounting/utils/dashboardMetrics.ts` , `formatCents( cents )` | Un solo argumento, locale fijo `es-AR`, prefijo `$` y `-$` para negativos. **No** recibe `lang` |
| Negación de pasivos | `cards/utils/ciclo.ts` , `deudaDe()` | **NO se usa en esta tanda.** La auditoría muestra el saldo **crudo** del libro, negativo incluido: es el libro mayor, no la vista de operación |
| Contexto de privacidad | `MetricsVisibilityContext` | Provisto en `app/[lang]/(main)/layout.tsx`, así que `/settings` lo tiene. **Ver paso 3: el panel no lo consulta**, y ahí está el porqué |
| Detección de tests | `vitest.config.ts` , `include` | Ya cubre `src/features/**/*.test.tsx`. La feature nueva queda incluida sin tocar config |

---

## Paso 1 — Crear la feature `settings` con el shell de la pantalla

**Archivos nuevos:**

*   `src/features/settings/components/SettingsContainer.tsx`
*   `src/features/settings/components/SettingsContainer.module.css`

**Qué hace.** Es un componente cliente (`"use client"`) que pasa a ser dueño de lo que hoy tiene
`CategoriesSettingsContainer` en sus líneas de `PageHeader` y `Tabs`:

```
props: { initialTree: CategoryTreeNode[] , accounts: Account[] , dict , lang }

<div className={styles.container}>
  <PageHeader  title / subtitle de dict.settingsPage , showMonthSelector={false} , dict , lang />
  <Tabs tabs={SETTINGS_TABS} activeTab={activeTab} onChange={…} />
  { activeTab === "categories"
      ? <CategoriesSettingsContainer initialTree={initialTree} />
      : <LedgerAuditPanel accounts={accounts} dict={dict} /> }
</div>
```

*   Estado: `const [ activeTab , setActiveTab ] = useState< "categories" | "ledger" >( "categories" ) ;`
*   `SETTINGS_TABS` **se muda acá** desde `CategoriesSettingsContainer` y pasa a construirse con el
    diccionario (paso 6), con la tab nueva `ledger` **segunda**, después de `categories`:

    | key | label | estado |
    | :--- | :--- | :--- |
    | `categories` | `dict.settingsPage.tabCategories` | activa |
    | `ledger` | `dict.settingsPage.tabLedger` | **nueva**, habilitada |
    | `profile` | `dict.settingsPage.tabProfile` | `disabled` + `badge: dict.settingsPage.tabBadgeSoon` |
    | `preferences` | `dict.settingsPage.tabPreferences` | idem |
    | `security` | `dict.settingsPage.tabSecurity` | idem |

**El CSS.** `.container` es una copia literal del `.container` de
`CategoriesSettingsContainer.module.css` (flex column, `gap: clamp(1rem, 0.8rem + 1vw, 1.75rem)`,
`width: 100%`). **No lo borres del CSS de categorías**: ese componente conserva su propio wrapper
porque sigue teniendo toolbar y grilla que separar.

**Lo que NO hay que hacer:** no crear `schema.db.ts`, `actions/`, `repositories/` ni `types.ts` en la
feature nueva. `settings` es hoy sólo un shell de presentación; una carpeta vacía de más es ruido.

---

## Paso 2 — Despojar a `CategoriesSettingsContainer` de lo que ya no le toca

**Archivo:** `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx`

1.  **Borrar el bloque `SETTINGS_TABS`** (la constante entre la interfaz de props y la función del
    componente). Se fue al shell.
2.  **Borrar del `return` el `<PageHeader …/>` y el `<Tabs …/>`** — son los dos primeros hijos de
    `<div className={styles.container}>`. El `div` y todo lo que sigue (`{/* Barra de herramientas superior */}`
    en adelante) **se quedan**.
3.  **Borrar los imports que quedan huérfanos:** `PageHeader` y `Tabs`. Si `getDictionary` sólo se
    importaba para tipar la prop `dict`, se va también.

**Radio de impacto de la firma — esto es lo que rompe si se omite.** `dict` y `lang` entran a este
componente **sólo** para alimentar el `PageHeader`: sus únicos usos son `dict.settingsPage.title`,
`dict.settingsPage.subtitle` y `lang={lang}`, los tres dentro del bloque que se borra. Entonces:

*   Sacar `dict` y `lang` de `CategoriesSettingsContainerProps`.
*   Sacar `dict` y `lang` del destructuring de parámetros. **Si quedan, `eslint --max-warnings 0`
    corta** — el repo ya perdió una ronda por 75 warnings de símbolos sin usar que `tsc` no marca.
*   La interfaz queda con una sola prop: `initialTree: CategoryTreeNode[]`.

**El test que hay que tocar, y exactamente cómo.**
`src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx`:

*   `renderContainer` monta hoy
    `<NotificationsProvider><CategoriesSettingsContainer initialTree={tree} dict={dict} lang="es" /></NotificationsProvider>`.
    Quitar `dict` y `lang` del JSX.
*   Con eso, la variable `dict`, su `let`, el `beforeAll` que hace `await getDictionary( "es" )` y el
    import de `getDictionary` quedan sin usar: **borrarlos**.
*   `NotificationsProvider` ya **no** es necesario (lo pedía el `PageHeader`), pero **dejalo**: es
    inofensivo y quitarlo no aporta. Si lo quitás, quitá también su import.
*   **Los tres `it(...)` no cambian**: ninguno assertea sobre el header ni sobre las tabs. Si alguno
    se pone rojo, **no relajes el componente**: parate y reportá.

---

## Paso 3 — El panel de auditoría

**Archivos nuevos:**

*   `src/features/accounting/components/LedgerAudit/LedgerAuditPanel.tsx`
*   `src/features/accounting/components/LedgerAudit/LedgerAuditPanel.module.css`

Va en `accounting` —no en `settings`— porque el plan de cuentas **es** contabilidad; lo que vive en
`settings` es únicamente la navegación.

**Props:** `{ accounts: Account[] , dict: Awaited< ReturnType< typeof getDictionary > > }`.
No recibe `lang`: `formatCents` no lo usa y acá no se formatean fechas.

**Estructura:**

```
"use client" ;

const [ query , setQuery ] = useState( "" ) ;

filtrado: sobre `accounts` , case-insensitive , contra `code` Y contra `name`
          (el orden por código ya viene del repositorio: no reordenar)

<div className={styles.container}>
  <div className={styles.toolbar}>
    <div className={styles.searchBox}>
      <SearchInput value={query} onChange={setQuery} placeholder={…} />
    </div>
  </div>

  <DataTable
    columns={…}
    data={filtradas}
    keyExtractor={ ( a ) => a.id }
    emptyMessage={dict.settingsPage.ledgerEmpty}
  />
</div>
```

**Las cinco columnas, con su contenido exacto:**

| `key` | `header` | `align` | `render` |
| :--- | :--- | :--- | :--- |
| `code` | `dict.settingsPage.colCode` | left | `a.code` dentro de un `<span className={styles.code}>` (tipografía monoespaciada por token) |
| `name` | `dict.settingsPage.colName` | left | `a.name` |
| `type` | `dict.settingsPage.colType` | left | la etiqueta del tipo, resuelta con un mapa `Record< string , string >` armado desde `dict.settingsPage` (`typeAsset`, `typeLiability`, `typeEquity`, `typeRevenue`, `typeExpense`); si el tipo no está en el mapa, se muestra `a.type` crudo |
| `currency` | `dict.settingsPage.colCurrency` | left | **`a.currency`** |
| `balance` | `dict.settingsPage.colBalance` | right | `formatCents( a.balance )`, con `className={styles.negative}` cuando `a.balance < 0` |

**Dos trampas de este paso, las dos verificadas en el código:**

1.  **La divisa no se hardcodea.** El listado que se está mudando pinta hoy `<span>ARS</span>`
    **literal** (`AccountsContainer.tsx`, dentro del bloque de `groupedLedger`, el `span` con
    `styles.accountType`), cuando `accounts.currency` existe desde siempre y el RFC 022 crea **una
    cuenta por divisa** (`5.1.01.01-ARS` y `5.1.01.01-USD` son dos filas distintas). Mudar el literal
    convertiría una pantalla de auditoría en una que miente. Ésta es la corrección, no un extra.
2.  **El panel NO consulta `useMetricsVisibility()`.** El listado de origen sí lo hace, pero el
    interruptor que lo revierte vive en `MetricsSection`, que está en `/accounts` y **no** en
    `/settings`: si el usuario dejó los saldos ocultos, en la pestaña de auditoría vería una columna
    en blanco sin ninguna forma de recuperarla. Los saldos se muestran siempre. Dejá el comentario de
    una línea que lo explique, o el próximo lector "arregla" la omisión.

**El CSS.** `.container` (flex column con el mismo `gap` que el shell), `.toolbar` y `.searchBox` son
equivalentes a los de `CategoriesSettingsContainer.module.css` — copiá esos bloques, no los inventes.
Sumá `.code` (usa el token de fuente monoespaciada si existe en `globals.css`; **verificalo antes**, y
si no existe usá el token de tamaño `--fs-sm` y nada más) y `.negative` con `color: var(--color-danger)`,
que es el token que ya usa `.redText` en `AccountsContainer.module.css`. Sin píxeles fijos
estructurales y sin nada que se mueva en `:hover`.

**Cuentas archivadas:** `accounts` no tiene columna de archivado —el archivado vive en `categories`—,
así que la cuenta de una categoría archivada **aparece** en la tabla. Es correcto para una pantalla de
auditoría: el saldo sigue en el libro. No agregues filtros por archivado.

---

## Paso 4 — La página `/settings` carga las cuentas y delega en el shell

**Archivo:** `src/app/[lang]/(main)/settings/page.tsx`

*   Agregar `getAccountsAction()` al `Promise.all` que ya existe, junto a `getDictionary( lang )` y
    `getCategoryTreeAction()`. **El patrón a copiar es el de `accounts/page.tsx`**, que ya resuelve
    cuatro acciones concurrentes y desempaqueta cada `Result` con `res.success ? res.value : []`.
*   Reemplazar `<CategoriesSettingsContainer …/>` por `<SettingsContainer initialTree={…} accounts={…} dict={dict} lang={lang} />`.
*   Actualizar el import y el comentario `@file` del encabezado, que hoy dice que la página «delega en
    el contenedor» de categorías.
*   `page.module.css` **no se toca**.

La consulta de cuentas se hace aunque la tab activa sea Categorías. Son 71 filas de una tabla ya
indexada por organización: no vale la pena diferirla ni convertir el panel en un Server Component.

---

## Paso 5 — `/accounts` pierde la tab y queda siendo una sola cosa

**Archivo:** `src/features/accounting/components/AccountsContainer.tsx`

Borrar, en este orden:

1.  El estado `activeTab` (`useState< "wallets" | "ledger" >`).
2.  `const ledgerAccounts = …` (el `filter` de `equity | revenue | expense`).
3.  `const groupedLedger = …` (el `reduce` que agrupa por tipo).
4.  `const tabsConfig = …`.
5.  El `<div className={styles.tabsRow}>` con su `<Tabs …/>` adentro.
6.  En `<div className={styles.gridContent}>`: el ternario `activeTab === "wallets" ? ( … ) : ( … )`
    **se colapsa**. Queda sólo la rama de wallets, con su propio `Object.keys( groupedWallets ).length === 0`
    y su `EmptyState`. **La rama del ledger se borra entera.**
7.  El import de `Tabs`, que queda huérfano.

**Lo que NO hay que tocar en este archivo:**

*   `walletAccounts`, `groupedWallets`, `cardAccountIds` y el modal de detalle de entidad: son la
    tanda 1, están verificados.
*   `totalAssets`, `totalLiabs`, `netWorth`, `MetricsSection` y las tres sparklines: **se quedan**.
*   `const netBalance = list.reduce( ( sum , a ) => sum + a.balance , 0 )` dentro del `map` de
    entidades: está **correcto** y ya se auditó dos veces.

**El CSS huérfano — contado, no estimado.** En `AccountsContainer.module.css`, al borrar ese bloque
quedan sin ningún uso exactamente cinco clases: **`.tabsRow`, `.entitySection`, `.entityTitle`,
`.cardsGridPlan` y `.accountBalanceMuted`**. Borralas.
**Y cinco que NO se borran**, porque las sigue usando el modal de detalle de entidad:
`.accountCardDetailed`, `.cardHeader`, `.accountCode`, `.accountType`, `.cardFooterDetailed`.
Verificá con un `grep -n "styles\.<clase>" AccountsContainer.tsx` **después** de editar el `.tsx`, no
antes.

---

## Paso 6 — Los tres diccionarios

**Archivos:** `src/dictionaries/es.json` , `en.json` , `br.json`. **Los tres, con las mismas claves.**

### 6.1 Borrar de `accountsPage`

`tabWallets` , `tabLedger` , `typeEquity` , `typeRevenue` , `typeExpense`.

Verificado: su único consumidor era `AccountsContainer`, y el paso 5 lo deja sin usarlas.
**`typeAsset` y `typeLiability` se quedan** — las usa `CreateAccountForm` en su `<select>` y el modal
de entidad las corta con `.split( " " )[0]`.

### 6.2 Reescribir `settingsPage.subtitle`

Hoy habla sólo de categorías y la pantalla pasa a tener dos cosas:

| | texto |
| :--- | :--- |
| es | `Administrá las categorías contables de tu organización y auditá el plan de cuentas.` |
| en | `Manage your organization's accounting categories and audit the chart of accounts.` |
| br | `Gerencie as categorias contábeis da sua organização e audite o plano de contas.` |

### 6.3 Agregar a `settingsPage`

| clave | es | en | br |
| :--- | :--- | :--- | :--- |
| `tabCategories` | Categorías | Categories | Categorias |
| `tabLedger` | Plan contable | Chart of accounts | Plano de contas |
| `tabProfile` | Perfil | Profile | Perfil |
| `tabPreferences` | Preferencias | Preferences | Preferências |
| `tabSecurity` | Seguridad | Security | Segurança |
| `tabBadgeSoon` | Próximamente | Coming soon | Em breve |
| `colCode` | Código | Code | Código |
| `colName` | Nombre | Name | Nome |
| `colType` | Tipo | Type | Tipo |
| `colCurrency` | Divisa | Currency | Moeda |
| `colBalance` | Saldo | Balance | Saldo |
| `typeAsset` | Activo | Asset | Ativo |
| `typeLiability` | Pasivo | Liability | Passivo |
| `typeEquity` | Patrimonio Neto | Equity | Patrimônio Líquido |
| `typeRevenue` | Ingreso | Revenue | Receita |
| `typeExpense` | Gasto | Expense | Despesa |
| `ledgerSearch` | Buscar por código o nombre de cuenta… | Search by account code or name… | Buscar por código ou nome da conta… |
| `ledgerEmpty` | No hay cuentas que coincidan con la búsqueda. | No accounts match your search. | Nenhuma conta corresponde à busca. |

Los cinco `type*` de acá son **cortos a propósito**: los de `accountsPage` traen paréntesis
(`Activo (Cuentas, Efectivo)`) y por eso el modal los corta con `.split( " " )[0]`. **No repliques ese
truco en la tabla**: la celda usa la clave corta tal cual.

---

## Paso 7 — Cerrar el §7 del RFC: la descripción del asiento de apertura

**Archivo:** `src/features/cards/actions/cardsActions.ts`

Una línea. La descripción del asiento de apertura de una tarjeta con deuda inicial dice hoy
`` `Apertura deuda inicial ${tarjetaCreada.label}` `` y pasa a `` `Apertura ${tarjetaCreada.label}` ``,
que es el patrón neutro que ya usa `createAccountForEntityAction` en `accountingActions.ts`
(`` `Apertura ${cuentaCreada.name}` ``). **Sólo el texto**: no se toca el asiento, ni las cuentas, ni
los importes, ni el `if` de deuda distinta de cero.

**Y se fija con un assert**, porque hoy ningún test mira esa descripción. En
`src/features/cards/actions/cardsActions.test.ts`, dentro del `it` *«crédito con deuda inicial emite
asiento invertido: Debe Patrimonio / Haber Tarjeta»* del `describe` *«Alta de Tarjeta de Crédito y
Asiento de Apertura»*, donde ya se hace `const txRows = await db.select().from( ledgerTransactions ) ;`
y se comprueba `txRows.length`, agregar la comprobación de que
`txRows[0].description` es `"Apertura Visa Galicia Gold"` (el `label` que usa ese mismo test).
**Es un assert dentro de un `it` existente: no suma un test al total.**

---

## Tests: qué se crea y qué tiene que dar

### Archivo nuevo 1 — `src/features/settings/components/SettingsContainer.test.tsx`

`// @vitest-environment jsdom` en la **primera línea**.

*   Montar el shell con un árbol mínimo de una categoría padre con una hija, dos o tres cuentas de
    ejemplo (una `asset` en ARS y una `liability` con saldo negativo), `dict = await getDictionary( "es" )`
    en un `beforeAll` y `lang="es"`, envuelto en `<NotificationsProvider>` — **el `PageHeader` lo
    necesita**.
*   **Mockear `@/features/accounting/actions/categoryActions`** con `vi.mock`, igual que hace hoy
    `CategoriesSettingsContainer.test.tsx` (copiá ese bloque de mocks entero): el panel de categorías
    se monta real y sus server actions no pueden ejecutarse en jsdom.
*   **Dos tests:**
    1.  Arranca en Categorías: se ve el nombre de la categoría del árbol y **no** se ve el código
        contable de ninguna cuenta.
    2.  Click en la tab «Plan contable» (`getByRole( "button" , { name: /Plan contable/i } )`) y
        entonces sí aparece el código de la cuenta de ejemplo en la tabla.

### Archivo nuevo 2 — `src/features/accounting/components/LedgerAudit/LedgerAuditPanel.test.tsx`

`// @vitest-environment jsdom` en la primera línea. Sin mocks: no hay server actions ni contextos
obligatorios (`MetricsVisibilityContext` tiene default y el panel ni lo consulta).

*   Fixture: cuatro o cinco cuentas de los distintos tipos, **al menos una con `currency: "USD"`** y
    **una `liability` con `balance` negativo**.
*   **Tres tests:**
    1.  Renderiza una fila por cuenta y **cada una muestra su propia divisa** — en particular, que la
        cuenta en USD muestra `USD` y no `ARS`. Éste es el test que impide que vuelva el literal.
    2.  El buscador filtra: escribir un fragmento de código deja sólo las filas que lo contienen, y
        escribir un fragmento de nombre hace lo propio.
    3.  El saldo de la cuenta `liability` se muestra **negativo** (`-$…`), o sea el saldo crudo del
        libro, no pasado por `deudaDe()`.

### Totales predichos

El punto de partida verificado de la tanda 1 es **54 archivos de test / 400 tests**. Esta tanda suma
**dos archivos y cinco tests**, y no borra ninguno:

> **56 archivos de test · 405 tests · 0 fallidos.**

Si sale otro número, **reportá el número real y la salida cruda**, no el de este plan.

---

## Verificación — los cuatro, siempre los cuatro

`pnpm test` necesita el contenedor `postgres-dev` vivo. Si la suite muere en el setup con
`ECONNREFUSED` o `AggregateError`, **es entorno caído, no suite roja**: levantá el contenedor y
volvé a correr.

Delegá la batería en el subagente `verificador` y **pegá su salida**, no la describas:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

`pnpm build` **no** tipa los archivos de test: `tsc --noEmit` va igual y por separado, que es lo que
corre la compuerta.

---

## Qué reportar al terminar

1.  La salida cruda de los cuatro comandos, con el total real de suites y tests.
2.  Si algún test existente se puso rojo: **cuál, y por qué**. No lo arregles relajando el componente
    de producción ni volviendo props opcionales — eso ya pasó una vez y silenció dos verificaciones
    reales.
3.  **Hallazgos**: lo que viste y no hiciste porque este plan no lo nombraba. Esa lista es la entrada
    de la próxima ronda.
4.  Sincronizá [`docs/trabajo-en-vuelo.md`](../trabajo-en-vuelo.md) **en el mismo commit** que el
    código, como manda la ficha.
