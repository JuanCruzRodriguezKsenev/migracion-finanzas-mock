# Plan — RFC 008, tanda 2: la interfaz de `/loans`

* **RFC habilitante:** [`008-loans-and-installments.md`](../proposals/008-loans-and-installments.md),
  `APPROVED` el 2026-09-11. Esta tanda ejecuta su **§6** completo.
* **Rama:** `feat/rfc-008-loans`, **ya creada y en uso**. La tanda 1 está commiteada en `58ce3c0`.
  **No cambiar de rama.**
* **Punto de partida:** `58ce3c0`. **Línea base de la suite: 65 archivos de test, 467 tests,
  0 ESLint, 0 TS, build verde.**
* **Alcance:** la pantalla `/loans` entera (métricas, tabla con tabs, bandeja de liquidación, modal
  de alta), su navegación, su i18n en los tres diccionarios, las tres piezas de backend que la
  pantalla necesita y que la tanda 1 no dejó, y la familia **Préstamos** en el detalle de entidad de
  `/accounts`.
* **Lo que NO entra:** el neto por contacto en `/contacts` (§9 del RFC, tanda propia), edición de un
  préstamo ya creado (sólo alta y baja lógica), refinanciación, amortización distinta de la francesa,
  y cualquier cambio al esquema o a las migraciones. **Ninguna columna nueva, ninguna migración.**

---

## 1. Las decisiones ya están cerradas. No se reabren

Las tres primeras las tomó el usuario en la ronda de planificación del 2026-09-11; la cuarta venía
cerrada desde la tanda 1.

| # | Decisión | Qué implica |
| :--- | :--- | :--- |
| 1 | **La pantalla es una tabla con tabs por dirección** | `MetricsSection` arriba (hero de progreso + métricas), `Tabs` con **Todos / Pedidos / Dados**, y `DataTable` debajo. **No** es una grilla de tarjetas al estilo `/cards` |
| 2 | **La liquidación vive en una bandeja global arriba de la tabla** | Mismo patrón que `/cards` y `/subscriptions`: la sección no se dibuja si no hay cuotas exigibles. Cada ítem abre el modal de liquidación con selector de cuenta. **La fila de la tabla NO lleva botón de pago**: su única acción es dar de baja |
| 3 | **La familia «Préstamos» de `/accounts` entra en esta tanda** | Se dibuja en el modal de detalle de entidad, y las cuentas espejo de préstamo se excluyen de la lista de cuentas — el mismo filtro que ya existe para tarjetas |
| 4 | **`/loans` va en la sección «Finanzas» del `Navbar`, inmediatamente después de `/cards`** | Decidido en el plan de la tanda 1. Con `dict.sidebar.loans` en los tres diccionarios, no en español directo |

---

## 2. Lo que ya existe y NO hay que construir

Verificado archivo por archivo el 2026-09-11. **Reusar, no reescribir.** Recomendar un reuso sin
abrir el archivo ya introdujo un bug en este repositorio.

### 2.1 El backend de la tanda 1 — ya está y se consume tal cual

| Ya existe | Dónde | Qué hace hoy, exactamente |
| :--- | :--- | :--- |
| `pendientesDeLoan()` | [`loanScheduleService.ts:23`](../../src/features/loans/services/loanScheduleService.ts) | `( loan: Loan , hoyCivil: string ) => PendienteCuota[]`. Devuelve **sólo las cuotas con ventana abierta y posteriores a `resolvedThrough`**, en orden cronológico, tope 24. Devuelve `[]` si el préstamo está archivado |
| `cronogramaFrances()` | [`amortizacion.ts:103`](../../src/features/loans/services/amortizacion.ts) | `( principal , interestRateAnnual , totalInstallments , frequency , intervalCount ) => CuotaFrancesaRow[]`, con `{n , cuota , interes , capital , saldoRestante}` en centavos |
| `cuotaFrancesa()` | [`amortizacion.ts:68`](../../src/features/loans/services/amortizacion.ts) | Mismos argumentos, devuelve el importe de la cuota en centavos. **Es puro y no tiene `server-only`: un componente cliente lo importa directo** (verificado: no hay un solo `server-only` en `src/features/loans/`) |
| `createLoanAction()` | [`loansActions.ts:59`](../../src/features/loans/actions/loansActions.ts) | `( params: CreateLoanInput ) => Result< Loan , string >`. Crea la fila, la cuenta espejo con `getNextCode()`, el vínculo en `loan_accounts` y el asiento de alta (§5A/§5B con `disbursementAccountId`, §5C contra Patrimonio sin él) |
| `payLoanInstallmentAction()` | [`loansActions.ts:234`](../../src/features/loans/actions/loansActions.ts) | `( params: PayLoanInstallmentInput ) => Result< {loan , transactionId} , string >`. Bloqueo pesimista, guarda de orden dentro de la transacción, y **rechaza toda cuota que no sea la más antigua pendiente** |
| `loansRepository.findAccountsByLoanId()` | [`loansRepository.ts:194`](../../src/features/loans/repositories/loansRepository.ts) | `( loanId , organizationId , tx? ) => LoanAccountWithAccount[]`. Une `loan_accounts` con `accounts` filtrando por organización |
| `loansRepository.archive()` | [`loansRepository.ts:151`](../../src/features/loans/repositories/loansRepository.ts) | `( id , organizationId , tx? ) => Loan \| null`. Baja lógica: setea `archivedAt`. **Ya existe: la acción sólo lo envuelve** |
| `LoanWithAccounts` | [`types.ts:45`](../../src/features/loans/types.ts) | `interface LoanWithAccounts extends Loan { entity?: FinancialEntity \| null ; contact?: Contact \| null ; accounts: LoanAccountWithAccount[] }`. **Ya está declarado y todavía no lo usa nadie. Es exactamente el tipo que devuelve el método nuevo del paso 1: no declarar otro** |
| `PendienteCuota` | [`types.ts:31`](../../src/features/loans/types.ts) | `{loanId , n , fechaCuota , cuota , interes , capital , saldoRestante , loan}`. **`n` es 1-indexed** y `fechaCuota` es civil `YYYY-MM-DD` |
| `CreateLoanInput` | [`loans.schema.ts:52`](../../src/features/loans/schemas/loans.schema.ts) | Es `z.input`, **no `z.infer`**: los campos con `.default()` (`currency`, `interestRateAnnual`, `totalInstallments`, `frequency`, `intervalCount`) son **opcionales** para quien llama. `startDate` es `z.coerce.date()`; `firstInstallmentDate` es **string `YYYY-MM-DD`** |
| `PayLoanInstallmentInput` | [`loans.schema.ts:64`](../../src/features/loans/schemas/loans.schema.ts) | `{loanId , paymentAccountId , installmentNumber , hoyCivil?}`. **El esquema es `.strict()`: una clave de más lo rechaza** |

### 2.2 Los componentes compartidos — con su contrato real

| Ya existe | Dónde | El contrato, verificado |
| :--- | :--- | :--- |
| `DataTable` | [`DataTable.tsx`](../../src/shared/ui/display/DataTable/DataTable.tsx) | `{columns , data , loading? , loadingRows? , emptyMessage? , onRowClick? , keyExtractor? , className? , footer?}`. Columna: `{key , header , align? , render?( row , index )}`. **No tiene ordenamiento ni paginación** — no se los pide este plan |
| `Tabs` | [`Tabs.tsx:39`](../../src/shared/ui/display/Tabs/Tabs.tsx) | `{tabs: {key , label , disabled? , badge?}[] , activeTab , onChange , className?}`. **Renderiza `role="tab"`, no `button`**: en un test se busca con `getByRole( "tab" , {name: /…/} )` |
| `MetricsSection` | [`MetricsSection.tsx:142`](../../src/shared/ui/layout/MetricsSection/MetricsSection.tsx) | `{hero? , heroComponent? , isLoading? , skeletonCount? , allowVisibilityToggle? , children}`. `hero` es `{label , value? , valueLabel? , secondValue? , secondValueLabel? , progressBar? , progressLabel? , trend?}` |
| `MetricCard` | [`MetricCard.tsx`](../../src/shared/ui/MetricCard/MetricCard.tsx) | `{title , value , count? , icon? , isDanger? , iconBg? , iconColor? , variant? , isSensitive? , progressBar? , progressLabel? , …}` |
| `Modal` | [`Modal.tsx:126`](../../src/shared/ui/feedback/Modal/Modal.tsx) | `{isOpen , onClose , title , subtitle? , children , footer? , size?: "small"\|"medium"\|"large"\|"xlarge"}`. **Retorna `null` al cerrar**, así que un formulario montado *adentro* se limpia solo |
| `FormInput` | [`FormInput.tsx`](../../src/shared/ui/forms/Form/FormInput.tsx) | Expone **`helperText`**, no `helper`. Más `label?` , `error?: string` , `containerStyle?` |
| `FormSelect` | [`FormSelect.tsx`](../../src/shared/ui/forms/Form/FormSelect.tsx) | Mismas props que `FormInput` más los `<option>` como `children` |
| `FormError` | [`FormError.tsx`](../../src/shared/ui/forms/Form/FormError.tsx) | Exige **`error: string`** (obligatorio, no `message`). Devuelve `null` si está vacío y monta `role="alert"` |
| `Button` | [`Button.tsx`](../../src/shared/ui/display/Button/Button.tsx) | **No tiene `size`.** Props: `variant` (`primary\|secondary\|outline\|danger`), `isLoading`, `icon`, `loadingLabel` |
| `EmptyState` | [`EmptyState.tsx:15`](../../src/shared/ui/feedback/EmptyState/EmptyState.tsx) | `{title , description? , icon? , action? , className?}` |
| `InstitutionLogo` | [`InstitutionLogo.tsx:17`](../../src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx) | `{institution: string , logoUrl? , brandDomain? , className? , size?}`. Consumo modelo: [`ContactsTable.tsx:102-106`](../../src/features/contacts/components/ContactsTable.tsx) |
| `PageHeader` | [`PageHeader.tsx`](../../src/shared/ui/layout/PageHeader/PageHeader.tsx) | Consumo modelo: [`CardsContainer.tsx:93-104`](../../src/features/cards/components/CardsContainer.tsx), con `showMonthSelector={false}` |
| `formatCurrency` | [`currencyFormatter.ts:46`](../../src/shared/lib/currencyFormatter.ts) | `( amount: number , currencyCode: string , locale: string )`. **Tres argumentos.** No confundir con `formatCents( cents )`, que toma uno solo y tiene el locale fijo |
| `deudaDe()` | [`ciclo.ts:23`](../../src/features/cards/utils/ciclo.ts) | `( cuenta: {balance: number} ) => number`, devuelve `-balance`. **Sólo en la rama `borrowed`** |
| La barra de progreso | [`InstallmentPlansModal.tsx:187-191`](../../src/features/cards/components/InstallmentPlansModal.tsx) + [`.module.css:122-134`](../../src/features/cards/components/InstallmentPlansModal.module.css) | `div.progressTrack > div.progressBar` con `style={ { width: `${pct}%` } }`. **No existe ningún `ProgressBar` compartido**: se copia este patrón, no se crea un componente nuevo |
| `getContactsAction()` | [`contactsActions.ts:42`](../../src/features/contacts/actions/contactsActions.ts) | `( options? ) => Result< ContactWithPaymentMethods[] , string >` |
| `getFinancialEntitiesAction()` / `getAccountsAction()` | [`accountingActions.ts:45`](../../src/features/accounting/actions/accountingActions.ts) | `getAccountsAction()` devuelve `Result< Account[] , string >` |
| `useProfileContext()` | `@/features/profile/context/ProfileContext` | Da `profile.numberFormat`; consumo modelo en [`CardsContainer.tsx:55-56`](../../src/features/cards/components/CardsContainer.tsx) |

### 2.3 Los moldes que hay que copiar, no reinventar

*   **La acción de lectura enriquecida:** [`getCardsAction()`](../../src/features/cards/actions/cardsActions.ts) (`cardsActions.ts:211`) — sesión, `organizationId`, repositorio, zona horaria del perfil, servicio de agregación, `Result`.
*   **El repositorio enriquecido:** [`cardsRepository.findAll()`](../../src/features/cards/repositories/cardsRepository.ts) (`cardsRepository.ts:39-99`) — `leftJoin` de la entidad, segunda consulta con `inArray` para la tabla puente, ensamblado en memoria. **Dos consultas, no N+1.**
*   **El servicio de agregación:** [`calcularCiclosDeTarjetas()`](../../src/features/cards/services/cardCycleService.ts) (`cardCycleService.ts:116`).
*   **El contador de cuotas ya imputadas:** [`cuotasImputadasDe()`](../../src/features/cards/services/installmentService.ts) (`installmentService.ts:46`) — recorre las ocurrencias y corta en la primera posterior al puntero. **El equivalente para préstamos se escribe en la feature `loans`; no se generaliza esta firma ni se toca `cards`.**
*   **El contenedor:** [`CardsContainer.tsx`](../../src/features/cards/components/CardsContainer.tsx) — server-driven, `router.refresh()` dentro de la transición después de `res.success`, `confirm()` nativo para la baja.
*   **La bandeja:** [`PendingInstallmentsInbox.tsx`](../../src/features/cards/components/PendingInstallmentsInbox.tsx) — incluida `formatearFechaCivil()` (`:39-49`), que construye el `Date` **a mediodía UTC**.
*   **El modal de alta:** [`CardFormModal.tsx`](../../src/features/cards/components/CardFormModal.tsx) — conversión a centavos en el borde (`Math.round( Number( x ) * 100 )`).

---

## 3. Las trampas que este plan nombra por adelantado

Cada una ya costó una ronda en este repositorio.

1.  **El signo se ramifica por `direction`, siempre.** `deudaDe()` sirve para `borrowed` y **no** para
    `lent`: una cuenta por cobrar es un activo y su `balance` ya es positivo. **Nunca escribir el
    signo a mano en ninguna de las dos ramas** (RFC 008 §3.2).
2.  **No sumar divisas distintas en un solo número.** Es el defecto vivo de `CardVisual`
    ([`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) §9) y de la sparkline del dashboard. Cómo lo evita
    este plan: en el paso 7, las métricas agregadas se calculan **sobre una sola divisa**, la
    dominante, y la pantalla la rotula.
3.  **`new Date( "2026-09-20" )` es medianoche UTC, o sea el día 19 en Buenos Aires.** Todo valor que
    salga de un `<input type="date">` y se convierta a `Date` se construye como
    `new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) )`. Aplica al `startDate` del paso 8.
    `firstInstallmentDate` **no** se convierte: viaja como string `YYYY-MM-DD`, que es lo que pide el
    esquema.
4.  **Una cuota que no es la más antigua pendiente hace fallar la acción.** La guarda está dentro de
    la transacción (`loansActions.ts:98-100`). Por eso la bandeja del paso 9 muestra **una sola fila
    por préstamo**: su cuota más antigua. Listar tres vencidas y dejar tocar la tercera es un error
    garantizado en la cara del usuario.
5.  **Un campo que puede faltar se declara `| null` en el tipo, no se parchea en el consumidor.** Un
    préstamo sin fila en `loan_accounts` para su divisa (alta a medias) no tiene saldo legible: el
    tipo del paso 2 declara `saldoPendiente: number | null` para que `tsc --noEmit` obligue a cada
    consumidor a decidir qué muestra. Fue exactamente el defecto de la cadena vacía como centinela de
    fecha en la tanda 1 del RFC 025.
6.  **`dict` es la unión de los tres JSON.** Una clave agregada sólo a `es.json` **no compila**:
    `tsc --noEmit` la rechaza porque no existe en los otros dos miembros de la unión. Los
    diccionarios son **`es`, `en` y `br`** — no hay `pt.json`.
7.  **`pnpm build` no tipa los archivos de test.** El typecheck va como comando propio.

---

## 4. Los pasos

### Paso 1 — `loansRepository.findAllWithRelations()`

**Archivo:** `src/features/loans/repositories/loansRepository.ts` (**aditivo**).

Se agrega un método; **`findAll()` no se toca**, porque lo consumen
[`loansRepository.test.ts:60`](../../src/features/loans/repositories/loansRepository.test.ts) y `:126`
y cambiar su tipo de retorno rompería esa suite sin necesidad.

```
async findAllWithRelations( organizationId: string , tx: DBOrTx = db ): Promise< LoanWithAccounts[] >
```

*   **Dos consultas, copiando `cardsRepository.findAll()`:** la primera trae `loans` con
    `leftJoin( financialEntities )` y `leftJoin( contacts )`, filtrando
    `eq( loans.organizationId , organizationId )` **e** `isNull( loans.archivedAt )`, ordenado por
    `desc( loans.createdAt )`. La segunda trae `loan_accounts` con `innerJoin( accounts )` usando
    `inArray( loanAccounts.loanId , loanIds )` **y** `eq( accounts.organizationId , organizationId )`.
    Ensamblar en memoria. **Si no hay filas, retornar `[]` antes de la segunda consulta.**
*   `entity` y `contact` se normalizan con el mismo truco que `cardsRepository.findAll():94` —
    `r.entity?.id ? r.entity : null`— porque un `leftJoin` sin match devuelve un objeto de nulos.
*   Los imports de `financialEntities` y `contacts` se suman a los bloques existentes respetando el
    orden por longitud del §4 de [`.agents/AGENTS.md`](../../.agents/AGENTS.md).

**Test:** en `loansRepository.test.ts`, dos casos — un préstamo con `entityId` devuelve `entity`
cargado y `contact` en `null`; y un préstamo de **otra organización no aparece** (aislamiento).

### Paso 2 — `loanSummaryService.ts`, el servicio de resumen

**Archivos nuevos:** `src/features/loans/services/loanSummaryService.ts` y su `.test.ts`.

Es **puro y sin `server-only`**, como el resto de `src/features/loans/services/`.

**2.1 Tipo nuevo en `src/features/loans/types.ts`** (aditivo, debajo de `LoanWithAccounts`):

```
export interface LoanConResumen extends LoanWithAccounts {
  saldoPendiente: number | null ;   // Centavos SIEMPRE positivos. null si falta la cuenta espejo de su divisa
  cuotasPagadas:  number ;          // Derivadas del puntero resolvedThrough
  progreso:       number | null ;   // 0..100 entero. null cuando saldoPendiente es null
  pendientes:     PendienteCuota[] ;// Las exigibles hoy, de la más antigua a la más nueva
}
```

**2.2 `cuotasPagadasDe( loan: Loan ): number`** — copia exacta de la forma de
[`cuotasImputadasDe()`](../../src/features/cards/services/installmentService.ts) (`installmentService.ts:46`):
`0` si `resolvedThrough` es `null`; si no, recorre `n` de `0` a `totalInstallments - 1` llamando a
`ocurrenciaN( loan.firstInstallmentDate , frequency , intervalCount , n )` y cuenta mientras
`fecha <= resolvedThrough`, **cortando con `break` en la primera posterior** (la serie es monótona).

**2.3 `resumirLoan( loan: LoanWithAccounts , hoyCivil: string ): LoanConResumen`**

*   **`saldoPendiente`:** se busca `loan.accounts.find( ( la ) => la.currency === loan.currency )`.
    Si no hay ninguna → `null`. Si hay → **`borrowed`: `deudaDe( la.account )`; `lent`:
    `la.account.balance`**. Nunca un signo escrito a mano.
*   **`progreso`:** `null` si `saldoPendiente` es `null`; si no,
    `Math.min( 100 , Math.max( 0 , Math.round( ( ( principalAmount - saldoPendiente ) / principalAmount ) * 100 ) ) )`.
    El acotado no es cosmético: con intereses capitalizados o un asiento manual, el saldo puede
    exceder el capital original y dar un porcentaje negativo.
*   **`cuotasPagadas`:** `cuotasPagadasDe( loan )`.
*   **`pendientes`:** `pendientesDeLoan( loan , hoyCivil )` tal cual.

**2.4 `resumirLoans( loans: LoanWithAccounts[] , hoyCivil: string ): LoanConResumen[]`** — `map` del
anterior. No es asíncrono: no toca la base.

**Tests (`loanSummaryService.test.ts`, entorno `node`, sin base):** construir los fixtures a mano.
1.  `borrowed` con cuenta espejo en `-660000` → `saldoPendiente === 660000` (positivo).
2.  `lent` con cuenta espejo en `+50000` → `saldoPendiente === 50000`. **Este es el caso que atrapa
    el uso indebido de `deudaDe()`.**
3.  Préstamo cuya única fila de `loan_accounts` es de otra divisa → `saldoPendiente` y `progreso` en
    `null`.
4.  `cuotasPagadasDe` con `resolvedThrough` nulo → `0`; con el puntero en la tercera ocurrencia → `3`.
5.  `progreso` acotado: saldo mayor que el capital original → `0`, no negativo.

> **Fixtures:** un `Account` completo lleva **`cbuCvu` y `alias`** (el tipo es
> `InferSelectModel< typeof accounts >`), y un `Loan` lleva **todas** las columnas del esquema,
> incluidas las anulables (`entityId`, `contactId`, `resolvedThrough`, `archivedAt`). Omitir una
> compila en vitest y **rompe `tsc --noEmit`**, que es lo que corre la compuerta. Reusar
> [`loanFactory.ts`](../../src/features/loans/testing/loanFactory.ts) donde encaje.

### Paso 3 — `getLoansAction()` y `archiveLoanAction()`

**Archivo:** `src/features/loans/actions/loansActions.ts` (**aditivo, al final**).

**3.1 `getLoansAction(): Promise< Result< LoanConResumen[] , string > >`** — molde literal de
`getCardsAction()` (`cardsActions.ts:211-234`):
sesión → `organizationId` o `fail( "No autorizado." )` → `loansRepository.findAllWithRelations()` →
zona horaria del perfil (`profileRepository.findByUserId`, respaldo
`"America/Argentina/Buenos_Aires"` — el patrón ya está en este mismo archivo, `loansActions.ts:78-80`)
→ `hoyCivil = obtenerHoyCivil( timeZone )` → `resumirLoans()` → `ok()`. `catch` con `logger.error` y
mensaje genérico.

**3.2 `archiveLoanAction( id: string ): Promise< Result< Loan , string > >`** — molde literal de
`archiveCardAction()` (`cardsActions.ts:241-259`): sesión, `loansRepository.archive()`, `fail`
si devuelve `null`, `revalidatePath( "/[lang]/(main)/loans" , "page" )` y `ok()`.

> **`revalidatePath` va contra la estructura de archivos, no contra la URL.** El literal con `[lang]`
> y el grupo `(main)` adentro es el correcto, y es el que ya usan las dos acciones existentes
> (`loansActions.ts:207` y `:394`). No resolver el locale ni escribir `/es/loans`.

**Tests:** en `loansActions.test.ts`, dos casos que reusan la infraestructura de la suite —
`getLoansAction` devuelve el préstamo con `saldoPendiente` positivo tras el alta con desembolso, y
`archiveLoanAction` lo saca del listado.

### Paso 4 — Las claves de diccionario, en **los tres** archivos

**Archivos:** `src/dictionaries/es.json`, `en.json`, `br.json`. **Las mismas claves en los tres, o
`tsc --noEmit` rompe** (trampa §3.6).

**4.1 En `sidebar`, dos claves:**

| Clave | es | en | br |
| :--- | :--- | :--- | :--- |
| `loans` | `Préstamos` | `Loans` | `Empréstimos` |
| `cards` | `Tarjetas` | `Cards` | `Cartões` |

`cards` **no existe hoy en ningún diccionario**, y `BottomNav.tsx:77` ya la lee con respaldo
(`dict.cards || "Tarjetas"`). Agregarla cierra la deuda §8 en los dos lugares de una vez.

**4.2 En `accountsPage`, una clave:** `sectionLoans` → `Préstamos` / `Loans` / `Empréstimos`.
Va al lado de `sectionCards` y `sectionAccounts`, que ya existen en los tres.

**4.3 Una clave nueva de primer nivel, `loansPage`,** con la misma forma que `cardsPage`. El texto en
español es el que manda; `en` y `br` se traducen. Claves mínimas, y **toda cadena que el paso 7, 8 o 9
pinte tiene que salir de acá**:

*   Cabecera: `title`, `subtitle`, `newLoan`.
*   Tabs: `tabAll`, `tabBorrowed`, `tabLent`.
*   Métricas: `metricsCurrencyNote` (el rótulo del paso 7.2), `heroLabel`, `heroSuffix`,
    `totalOwed`, `totalReceivable`, `nextDue`, `noNextDue`.
*   Tabla: `columnLoan`, `columnCounterparty`, `columnBalance`, `columnProgress`,
    `columnInstallments`, `columnNextDue`, `columnActions`, `badgeBorrowed`, `badgeLent`,
    `installmentsSeparator` (`de` / `of` / `de`), `archive`, `archiveConfirm`, `noCounterparty`,
    `balanceUnavailable` (el guion largo del caso `null`).
*   Vacío: `emptyTitle`, `emptyDescription`, `emptyAction`.
*   Bandeja (`loansPage.settlement`, objeto anidado como `cardsPage.installments`): `inboxTitle`,
    `inboxSubtitle`, `settle`, `moreOverdue`, `modalTitle`, `capital`, `interest`, `total`,
    `payFrom`, `collectInto`, `noAccountForCurrency`, `confirmPayment`, `confirmCollection`, `cancel`.
*   Alta (`loansPage.form`): `directionLabel`, `directionBorrowed`, `directionLent`,
    `counterpartyLabel`, `counterpartyEntity`, `counterpartyContact`, `nameLabel`,
    `principalLabel`, `currencyLabel`, `rateLabel`, `rateHelper`, `installmentsLabel`,
    `frequencyLabel`, `frequencyMonthly`, `frequencyWeekly`, `frequencyQuarterly`,
    `frequencyYearly`, `startDateLabel`, `firstInstallmentLabel`, `firstInstallmentHelper`,
    `disbursementLabel`, `disbursementNone`, `disbursementHelper`, `estimatedInstallment`,
    `submit`, `cancel`.

### Paso 5 — `IconLoan` y la entrada de navegación

**5.1 `src/shared/ui/display/Icons/Icons.tsx`** — un icono nuevo, con el mismo `IconWrapper` que
todos los demás (nada de `viewBox` ni `stroke` propios):

```
export function IconLoan( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
    </IconWrapper>
  ) ;
}
```

Es un billete, y se distingue de `IconCreditCard` (`Icons.tsx:185`), que es un rectángulo con la
franja horizontal.

**5.2 `src/shared/ui/layout/Navbar/Navbar.tsx`** — tres cambios en el mismo archivo:

*   En `NavbarProps.dict`, agregar `loans?: string ;` y `cards?: string ;` (opcionales, como
    `transactions?` y `contacts?`).
*   `const isLoansActive = ( pathname === `/${lang}/loans` ) ;` junto a las demás banderas (`:56-63`).
*   El `<li>` de `/loans` **inmediatamente después del de `/cards`** (`:120-125`), con `IconLoan` y
    `{dict.loans || "Préstamos"}`.
*   **De paso, la deuda §8:** el `<span>Tarjetas</span>` de `:123` pasa a
    `{dict.cards || "Tarjetas"}`.

**5.3 `BottomNav` no se toca.** Sus seis lugares están ocupados y el drawer ya da acceso a `/loans`.
La clave `sidebar.cards` que agrega el paso 4 hace que su respaldo de `:77` deje de actuar, que es
todo lo que le corresponde a esta tanda.

### Paso 6 — La ruta

**Archivos nuevos:** `src/app/[lang]/(main)/loans/page.tsx` y `page.module.css`.

Server Component fino, **molde literal de [`cards/page.tsx`](../../src/app/[lang]/(main)/cards/page.tsx)**:
`params: Promise< {lang: string} >`, un solo `Promise.all` con
`getDictionary( lang )`, `getLoansAction()`, `getAccountsAction()`, `getFinancialEntitiesAction()` y
`getContactsAction()`; cada `Result` se desenvuelve con `res.success ? res.value : []`; el `<div
className={styles.container}>` envuelve a `<LoansContainer … />`.

**Las cuotas pendientes se aplanan en la página, no en el contenedor** —igual que `cards/page.tsx:40-41`—:
`loans.flatMap( ( l ) => l.pendientes )` ordenado por `fechaCuota` ascendente con `localeCompare`.

`page.module.css` copia `cards/page.module.css`. **No crear `loading.tsx`:** `/cards` tampoco lo tiene
y el grupo `(main)` ya provee uno.

### Paso 7 — `LoansContainer`

**Archivos nuevos:** `src/features/loans/components/LoansContainer.tsx` y `Loans.module.css`.
`"use client"`. Server-driven: **todo llega por props y se invalida con `router.refresh()`**; el único
estado propio son los booleanos de modal y el tab activo.

**7.1 Props:**

```
interface LoansContainerProps {
  initialLoans:      LoanConResumen[] ;
  initialPending:    PendienteCuota[] ;
  accounts:          Account[] ;
  financialEntities: FinancialEntity[] ;
  contacts:          Contact[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  lang?:             string ;
}
```

`locale` sale de `useProfileContext()` (`profile.numberFormat || "es-AR"`), como `CardsContainer:55-56`.

**7.2 Métricas — y la regla que impide repetir el defecto de `CardVisual`:**

*   Se determina la **divisa dominante**: la que más préstamos activos tiene
    (desempate por la primera en aparecer). **Todos los agregados se calculan usando únicamente los
    préstamos de esa divisa.** Ningún total suma dos divisas.
*   Si hay préstamos en otras divisas, debajo de las métricas va una línea con
    `loansPage.metricsCurrencyNote`, que **nombra la divisa de los totales y cuántos préstamos
    quedaron fuera**. Si hay una sola divisa, esa línea no se dibuja.
*   `heroComponent` no se usa: se usa **`hero`**, con `label: heroLabel`,
    `value: `${pctGlobal}%``, `progressBar` con el mismo `div.progressTrack > div.progressBar` del
    §2.2, y `progressLabel` con el saldo total formateado.
    `pctGlobal = Σ( principalAmount - saldoPendiente ) / Σ principalAmount` sobre los préstamos de la
    divisa dominante **que tengan `saldoPendiente !== null`**, acotado a `0..100`. Si el denominador
    es `0`, el hero muestra `0%`.
*   Tres `MetricCard` como `children`: **total que debo** (suma de `saldoPendiente` de los
    `borrowed`), **total que me deben** (ídem `lent`), y **próximo vencimiento** (la `fechaCuota` más
    antigua de `initialPending`, o `noNextDue`). Los dos importes con `formatCurrency( … , divisa ,
    locale )` e `isSensitive`.

**7.3 Tabs:** el `Tabs` compartido con `[ {key: "all"} , {key: "borrowed"} , {key: "lent"} ]`, cada
`label` con su conteo entre paréntesis (`${dict.loansPage.tabAll} (${n})`), y `activeTab` en `useState`.
El filtrado es `initialLoans.filter( ( l ) => (activeTab === "all") || (l.direction === activeTab) )`.

**7.4 Tabla:** un `DataTable< LoanConResumen >` con `keyExtractor={ ( l ) => l.id }`,
`emptyMessage` y estas columnas, en este orden:

| `key` | `header` | `align` | `render` |
| :--- | :--- | :--- | :--- |
| `name` | `columnLoan` | left | Nombre en negrita más un badge con `badgeBorrowed` / `badgeLent` según `direction` |
| `counterparty` | `columnCounterparty` | left | Si `entity`: `<InstitutionLogo institution={entity.name} brandDomain={entity.brandDomain} size={14} />` más el nombre. Si `contact`: sólo `contact.name`. Si ninguno: `noCounterparty` |
| `balance` | `columnBalance` | right | `saldoPendiente === null ? balanceUnavailable : formatCurrency( saldoPendiente , l.currency , locale )`. **La divisa es la del préstamo, fila por fila** |
| `progress` | `columnProgress` | left | La barra del §2.2 más el `%`. Con `progreso === null`, sólo `balanceUnavailable` |
| `installments` | `columnInstallments` | center | `${cuotasPagadas} ${installmentsSeparator} ${totalInstallments}` |
| `nextDue` | `columnNextDue` | left | `pendientes[0]` formateada con `formatearFechaCivil()`, o `—` |
| `actions` | `columnActions` | right | Un botón de baja que pide `confirm( dict.loansPage.archiveConfirm )` y, si acepta, llama `archiveLoanAction( l.id )` dentro de `startTransition`, con `router.refresh()` sobre `res.success` |

**`formatearFechaCivil()` se copia de [`PendingInstallmentsInbox.tsx:39-49`](../../src/features/cards/components/PendingInstallmentsInbox.tsx)**
—mediodía UTC—. La usan el contenedor **y** la bandeja del paso 9, así que **vive en un solo lugar**:
se exporta desde `PendingLoanSettlementsInbox.tsx` y el contenedor la importa. **No duplicarla.**

**7.5 Vacío:** con `initialLoans.length === 0`, en lugar de la tabla va un `EmptyState` con
`IconLoan`, los textos `empty*` y un botón que abre el modal de alta. Las métricas y los tabs **no se
dibujan** en ese caso.

**7.6 CSS:** `Loans.module.css`, tokens de `globals.css`, sin px fijos estructurales y **sin
movimiento ni cambio de dimensiones en `:hover`** (`.agents/AGENTS.md` §4). El único `style` inline
admitido es el `width` de la barra de progreso, que es un valor calculado en runtime.

### Paso 8 — `LoanFormModal`, el alta

**Archivo nuevo:** `src/features/loans/components/LoanFormModal.tsx` (usa `Loans.module.css`, como
`CardFormModal` usa `Cards.module.css`).

Montado condicionalmente desde el contenedor (`{ isModalOpen ? <LoanFormModal … /> : null }`), que es
lo que garantiza que el formulario arranque limpio: el estado vive **dentro** del componente que el
`<Modal>` desmonta.

**Campos**, todos con `FormInput` / `FormSelect` y `label` del diccionario:

1.  **Dirección** — `FormSelect` con `borrowed` / `lent`. Cambia los rótulos de la cuenta de
    desembolso (`payFrom` vs `collectInto` no aplica acá; acá es «Se depositó en» vs «Salió de»),
    pero **no** cambia ningún campo de lugar.
2.  **Contraparte** — un `FormSelect` de tipo (`entidad` | `contacto`) y, según él, un segundo
    `FormSelect` poblado con `financialEntities` o con `contacts`. **Exactamente uno de `entityId` /
    `contactId` viaja con valor; el otro va `null`.** La invariante ya la valida Zod
    (`loans.schema.ts:38-49`), pero el formulario no debe poder violarla.
3.  **Nombre** — texto, obligatorio, máximo 150.
4.  **Capital** — `type="number"`, `step="0.01"`, **convertido en el borde**:
    `Math.round( Number( x ) * 100 )`.
5.  **Divisa** — `FormSelect` con `ARS` / `USD` / `EUR`, por defecto `ARS`.
6.  **TNA** — `type="number"`, opcional, **también `Math.round( Number( x ) * 100 )`**: la columna son
    puntos básicos por cien (85.5 % → `8550`), igual que `interestRateFinancing` en
    `CardFormModal:80`. `rateHelper` explica que `0` significa sin interés.
7.  **Cuotas** — entero ≥ 1, por defecto `12`.
8.  **Frecuencia** — `FormSelect` con `monthly` / `weekly` / `quarterly` / `yearly` (los valores de
    `LOAN_FREQUENCIES`, `loans.schema.ts:18`, **menos `custom`**, que necesitaría exponer
    `intervalCount` y no aporta hoy). `intervalCount` **no** se pide: se deja en su default.
9.  **Fecha de desembolso** — `<input type="date">`. Al enviar se convierte con
    **`new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) )`** (trampa §3.3).
10. **Primera cuota** — `<input type="date">`, **viaja como string `YYYY-MM-DD` sin convertir**. Se
    inicializa igual que la fecha de desembolso y **se sigue sincronizando con ella mientras el
    usuario no la edite a mano** (una bandera `primeraCuotaTocada` en `useState`). Es lo que el RFC
    §4.1 pide: «en el alta se propone por defecto la fecha de desembolso y el usuario la corrige».
    `firstInstallmentHelper` nombra el período de gracia.
11. **Cuenta de desembolso** — `FormSelect` con las cuentas `type === "asset"` **cuya `currency`
    coincida con la divisa elegida**, más una opción vacía rotulada `disbursementNone`. La opción
    vacía manda `disbursementAccountId: null`, que es el caso §5C (préstamo preexistente, asiento
    contra Patrimonio Neto); `disbursementHelper` lo dice con todas las letras. La acción ya rechaza
    la divisa cruzada (`loansActions.ts:100-103`), pero filtrar evita el viaje.

**Cuota estimada:** debajo del formulario, `estimatedInstallment` con
`cuotaFrancesa( capitalEnCentavos , tnaEnPuntos , cuotas , frecuencia , 1 )` formateado. **Se importa
directo de `../services/amortizacion`**: es puro, no tiene `server-only` y no toca `db`. Se recalcula
en render; no hace falta `useMemo` ni un `useEffect`.

**Envío:** `startTransition`, `createLoanAction( payload )`, y sobre `res.success` → `onSuccess()` (el
contenedor cierra el modal y llama `router.refresh()`). Sobre error, `<FormError error={…} />`.
**El payload no lleva claves de más**: `createLoanSchema` es `.strict()`.

### Paso 9 — `PendingLoanSettlementsInbox`, la bandeja

**Archivos nuevos:** `src/features/loans/components/PendingLoanSettlementsInbox.tsx` y su
`.module.css`. Molde estructural: `PendingInstallmentsInbox` de cards.

*   **Props:** `{ initialPending: PendienteCuota[] , dict , locale? }`. El `loan` viaja **dentro** de
    cada `PendienteCuota` (`types.ts:39`), así que no hace falta pasar la lista de préstamos. Sí hace
    falta `accounts: Account[]` para el selector del modal.
*   **Retorna `null` si no hay pendientes.** La sección no se dibuja vacía.
*   **Una fila por préstamo, la cuota más antigua** (trampa §3.4). Se agrupa `initialPending` por
    `loanId` y se toma el primer elemento de cada grupo — la lista ya viene ordenada por fecha desde
    la página. Si un préstamo tiene más de una pendiente, la fila agrega `moreOverdue` con el
    excedente (`+2 vencidas más`). **Nunca se ofrece liquidar más que la primera.**
*   Cada fila muestra: nombre del préstamo, `cuota n de total`, fecha civil formateada, importe total
    con `formatCurrency( item.cuota , item.loan.currency , locale )`, y el desglose
    `capital` / `interest` cuando `item.interes > 0`.
*   **Modal de liquidación, dentro de este mismo archivo** (igual que el modal de «otro importe» de
    cards vive dentro de su bandeja):
    *   Título `modalTitle`, el desglose capital / interés / total, y un `FormSelect` con las cuentas
        `type === "asset"` **y `currency === item.loan.currency`**. Rótulo `payFrom` para `borrowed`,
        `collectInto` para `lent`.
    *   **Si no hay ninguna cuenta con esa divisa:** se muestra `noAccountForCurrency` y el botón de
        confirmar queda `disabled`. La acción rechazaría la operación igual (`loansActions.ts:108-110`),
        pero con un mensaje que llega tarde.
    *   Confirmar llama
        `payLoanInstallmentAction( {loanId , paymentAccountId , installmentNumber: item.n} )` dentro
        de `startTransition`. **No se manda `hoyCivil`**: la acción lo resuelve con la zona horaria
        del perfil, que es la fuente correcta.
    *   Sobre `res.success` se saca la fila del estado local y se cierra el modal; sobre error, se
        pinta con `<FormError>`. El estado local sigue el mismo patrón que
        `PendingInstallmentsInbox:60` (`useState( initialPending )` filtrado tras el éxito).

### Paso 10 — La familia «Préstamos» en `/accounts`

**Archivos:** `src/app/[lang]/(main)/accounts/page.tsx`,
`src/features/accounting/components/AccountsContainer.tsx` y su `.module.css`.

*   **`accounts/page.tsx`:** sumar `getLoansAction()` al `Promise.all` existente (`:26-31`) y pasar
    `loans={loans}` al contenedor.
*   **`AccountsContainer.tsx`:**
    *   Nueva prop `loans: LoanConResumen[]` en `AccountsContainerProps` (`:42-48`). El import va en
        un bloque `// Feature: Loans` propio, respetando el orden por longitud.
    *   **Junto a `cardAccountIds` (`:81-83`), un `loanAccountIds`** con el mismo `flatMap` sobre
        `loans`. **Y el filtro de `entityAccounts` (`:324-326`) pasa a excluir los dos conjuntos.**
        Sin esto, la cuenta espejo del préstamo se sigue mostrando como cuenta contable cruda al lado
        de su propio instrumento, que es lo que el RFC 024 §4 prohíbe.
    *   Dentro del `(() => { … })()` del modal de detalle, un `entityLoans` armado con el mismo
        criterio que `entityCards` (`:321-323`): por `entityId` de la entidad seleccionada, y los de
        `entityId` nulo cuando la agrupación es `"Otros"`.
    *   La condición de `EmptyState` (`:328`) pasa a contemplar las tres familias.
    *   **Una sección nueva `{ entityLoans.length > 0 ? … : null }`**, con el mismo
        `div.modalSection > h4.modalSectionTitle` y el título `accountsPageDict.sectionLoans`.
        Cada préstamo se dibuja con el `Card` compartido: nombre, badge de dirección, y el saldo
        formateado con `formatCurrency( saldoPendiente , loan.currency , lang )` —**nunca
        `deudaDe()` sobre la cuenta cruda, y nunca un signo a mano**: `saldoPendiente` ya viene
        resuelto y positivo del paso 2. Con `saldoPendiente === null`, un guion.
    *   Reusar las clases CSS que ya existen en `AccountsContainer.module.css`
        (`modalSection`, `modalSectionTitle`, `detailedCardsGrid`, `accountCardDetailed`); agregar sólo
        lo que falte para el badge.
*   **`AccountsContainer` no tiene suite propia** (verificado: no hay `AccountsContainer.test.tsx`),
    así que este paso no rompe ningún test existente.

### Paso 11 — Tests de componentes

**Archivos nuevos:** `src/features/loans/components/LoansContainer.test.tsx` y
`PendingLoanSettlementsInbox.test.tsx`. Los dos con `// @vitest-environment jsdom` en la primera
línea. `vitest.config.ts` ya incluye `src/features/**/*.test.tsx`: **no se toca la configuración**.

Reglas que estas dos suites tienen que respetar, y que ya costaron rondas:

*   **El diccionario se carga de verdad:** `await getDictionary( "es" )` en un `beforeAll`.
    `getDictionary` no tiene `server-only`. **Nunca inventar un diccionario de respaldo.** De paso,
    verifica que las claves del paso 4 existan.
*   **`vi.hoisted` para el doble de `next/navigation`**, y **nunca `export const x = vi.hoisted(…)`**
    en la misma sentencia: corta con `SyntaxError` y **tumba las 65 suites a la vez**. La forma es
    `const routerMock = vi.hoisted( () => ( {…} ) ) ;` y después `export { routerMock } ;`. El doble
    de `useRouter` devuelve **un objeto estable**, o `refresh()` no se puede asertar.
*   **Las server actions se mockean con `vi.mock` del módulo de acciones**, no la base.
*   **`Tabs` expone `role="tab"`**, no `button`.
*   El setup global (`vitest.setup.mocks.ts`) **sólo** mockea `next/cache` y `next/navigation`: el
    resto del código propio se monta real, incluido `ProfileContext`. Si el contenedor necesita
    `ProfileProvider`, se monta el provider real.

**`LoansContainer.test.tsx`:**
1.  Con dos préstamos, la tabla pinta las dos filas y el saldo del `borrowed` sale **positivo**.
2.  Tocar el tab `Dados` deja sólo el `lent` (`getByRole( "tab" , {name: /dados/i} )`).
3.  Con `initialLoans: []`, se pinta el `EmptyState` y **no** hay tabla ni métricas.
4.  Un préstamo con `saldoPendiente: null` pinta `balanceUnavailable` y no rompe el render.

**`PendingLoanSettlementsInbox.test.tsx`:**
1.  Sin pendientes → el componente no renderiza nada.
2.  Con tres pendientes de un mismo préstamo, **hay una sola fila** y aparece `moreOverdue`.
3.  Abrir el modal y confirmar llama a `payLoanInstallmentAction` con `installmentNumber` igual al
    `n` de **la cuota más antigua** y con el `paymentAccountId` elegido.
4.  Sin cuentas de la divisa del préstamo, el botón de confirmar está `disabled`.

### Paso 12 — Los documentos, en el mismo commit

*   **[`docs/trabajo-en-vuelo.md`](../trabajo-en-vuelo.md):** el estado pasa a «tanda 2 ejecutada»,
    con los números **reales** de la verificación; el punto 1 de «La secuencia que queda» se cierra;
    y del párrafo final se saca la mención al `<span>Tarjetas</span>`, que este plan resuelve.
*   **[`docs/TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) §8:** marcar `[x]` la entrada del `Navbar` que
    rotula `/cards` en español directo, anotando que se cerró en la tanda 2 del RFC 008 y que la
    clave `sidebar.cards` también apaga el respaldo de `BottomNav.tsx:77`. **La otra entrada de §8
    (el hamburguesa inerte del `PageHeader`) no se toca: sigue abierta.**
*   **No se edita el RFC 008**: es texto aprobado. Tampoco `docs/registro/`, `docs/diseno/` ni el plan
    de la tanda 1.

---

## 5. Radio de impacto completo

Los defectos aparecen en los archivos que el plan no nombró. Ésta es la lista entera.

### Archivos nuevos (11)

| Archivo | Paso |
| :--- | :--- |
| `src/features/loans/services/loanSummaryService.ts` | 2 |
| `src/features/loans/services/loanSummaryService.test.ts` | 2 |
| `src/app/[lang]/(main)/loans/page.tsx` | 6 |
| `src/app/[lang]/(main)/loans/page.module.css` | 6 |
| `src/features/loans/components/LoansContainer.tsx` | 7 |
| `src/features/loans/components/Loans.module.css` | 7 |
| `src/features/loans/components/LoanFormModal.tsx` | 8 |
| `src/features/loans/components/PendingLoanSettlementsInbox.tsx` | 9 |
| `src/features/loans/components/PendingLoanSettlementsInbox.module.css` | 9 |
| `src/features/loans/components/LoansContainer.test.tsx` | 11 |
| `src/features/loans/components/PendingLoanSettlementsInbox.test.tsx` | 11 |

### Archivos modificados (12)

| Archivo | Qué cambia | Paso |
| :--- | :--- | :--- |
| `src/features/loans/types.ts` | `LoanConResumen` (aditivo) | 2 |
| `src/features/loans/repositories/loansRepository.ts` | `findAllWithRelations()` (aditivo; **`findAll()` intacto**) | 1 |
| `src/features/loans/repositories/loansRepository.test.ts` | Dos casos nuevos | 1 |
| `src/features/loans/actions/loansActions.ts` | `getLoansAction()` y `archiveLoanAction()` (aditivo) | 3 |
| `src/features/loans/actions/loansActions.test.ts` | Dos casos nuevos | 3 |
| `src/dictionaries/es.json` · `en.json` · `br.json` | `sidebar.loans`, `sidebar.cards`, `accountsPage.sectionLoans`, `loansPage` | 4 |
| `src/shared/ui/display/Icons/Icons.tsx` | `IconLoan` | 5 |
| `src/shared/ui/layout/Navbar/Navbar.tsx` | Entrada `/loans`, `dict.loans`/`dict.cards`, bandera de activo | 5 |
| `src/app/[lang]/(main)/accounts/page.tsx` | `getLoansAction()` en el `Promise.all` y la prop | 10 |
| `src/features/accounting/components/AccountsContainer.tsx` | Prop `loans`, `loanAccountIds`, sección de familia | 10 |
| `src/features/accounting/components/AccountsContainer.module.css` | Sólo lo que falte para el badge | 10 |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y deuda cerrada | 12 |

### Quién más lee lo que este plan toca

*   **`Navbar`** tiene un solo consumidor: [`AppShell.tsx:41-45`](../../src/shared/ui/layout/AppShell/AppShell.tsx),
    que le pasa `dict.sidebar`. Las dos claves nuevas son **opcionales** en `NavbarProps`, así que
    `AppShell` no cambia.
*   **`BottomNav`** también recibe `dict.sidebar` desde `AppShell:55`. Ya declara `cards?: string` y
    lo lee con respaldo: el paso 4 lo **completa** sin tocar el archivo.
*   **`AccountsContainer`** se monta sólo desde `accounts/page.tsx`. La prop `loans` es obligatoria,
    así que los dos archivos cambian juntos o `tsc --noEmit` lo marca.
*   **`Icons.tsx`** es aditivo: ningún consumidor existente cambia.
*   **`loansRepository.findAll()` y las dos acciones de la tanda 1 no se modifican**, así que
    `loansActions.test.ts` (671 líneas) y `loansRepository.test.ts` siguen valiendo tal cual.
*   **Ningún test existente monta un componente que este plan toque.** `AccountsContainer` no tiene
    suite; `Navbar` tampoco; `CardVisual`, `InstallmentPlanFormModal` y `PendingInstallmentsInbox`
    son de `cards` y no se tocan.

**Ningún paso agrega una prop obligatoria a un componente ya testeado.** Es la condición que este
plan se impone para no obligar a nadie a relajar código de producción para salvar un test.

---

## 6. Verificación

Los cuatro, con el typecheck **como comando propio**, con `postgres-dev` vivo:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**Delegar la batería al subagente `verificador`** y **pegar la salida cruda en el informe, no
describirla.**

**Línea base a superar:** 65 archivos, 467 tests, 0 ESLint, 0 TS, build verde.
**Después de esta tanda deben quedar 68 archivos de test** (los dos de componentes más
`loanSummaryService.test.ts`). **El número total de tests se reporta leyendo la salida de `pnpm test`,
no estimándolo**: un total predicho mal convierte una corrida sana en una discrepancia que hay que
investigar.

Contraste manual, con la app levantada (`pnpm dev`):

1.  `/loans` carga, la barra lateral la marca activa y el rótulo de `/cards` sale del diccionario.
2.  Alta de un `borrowed` con desembolso: aparece en la tabla con saldo **positivo** y progreso `0%`.
3.  Alta de un `lent` contra un contacto: aparece con saldo positivo, sin `deudaDe()` de por medio.
4.  Alta sin cuenta de desembolso (§5C): se crea igual y el asiento va contra Patrimonio Neto.
5.  Un préstamo con primera cuota ya vencida aparece en la bandeja; liquidarlo emite el asiento,
    baja el saldo y **sube el contador de cuotas pagadas**.
6.  En `/accounts`, la entidad del préstamo muestra la familia **Préstamos** y **ya no** muestra la
    cuenta `2.1.01.NN` suelta.

---

## 7. Qué reportar al terminar

*   La salida cruda de los cuatro comandos.
*   Los archivos creados y modificados, contra la tabla del §5.
*   **Los hallazgos:** todo lo que se vio y no se hizo porque el plan no lo nombraba. Van al informe,
    no al código. Si un paso no se pudo ejecutar como está escrito, **decir por qué y qué se hizo en
    su lugar** — un hueco del plan es del plan, y atribuirlo bien es lo que mantiene honesto el ciclo.
