# Plan — RFC 025, tanda 2: las cuotas en la interfaz de `/cards`

*   **RFC:** [`025-card-installment-plans.md`](../proposals/025-card-installment-plans.md), `APPROVED` el 2026-09-11. **Habilita código contra ese texto.**
*   **Rama:** `docs/rfc-025-cuotas-de-tarjeta`. **No cambiar de rama.**
*   **Parte de:** `6be0341` (tanda 1), verificado de forma independiente el 2026-09-11: **429 tests en 58 archivos, 0 errores y 0 warnings de ESLint, 0 errores de TS, build exitoso.**
*   **Antes de escribir el primer archivo:** [`.agents/AGENTS.md`](../../.agents/AGENTS.md) §4 (estilo) y §8 (lo que el proyecto cobra caro).

La tanda 1 dejó el backend entero y **cero interfaz**: hoy un plan de cuotas se puede crear, imputar
y archivar por server action, pero no hay una sola pantalla que lo muestre. Esta tanda cierra el §7
del RFC.

---

## Las dos decisiones que el usuario cerró el 2026-09-11

Están tomadas. **No se reabren durante la ejecución.**

1.  **La bandeja de cuotas pendientes es global y vive arriba de la grilla**, con todas las cuotas de
    todas las tarjetas, cada ítem rotulado con su tarjeta. Copia el molde de
    [`PendingOccurrencesInbox`](../../src/features/subscriptions/components/PendingOccurrencesInbox.tsx).
    **La ficha de cada tarjeta muestra el dato, no la acción.**
2.  **Los planes de una tarjeta se leen en un modal de detalle**, que abre el botón «Ver planes» del
    plástico, y el alta de una compra en cuotas vive **dentro** de ese modal. El `cardId` sale del
    contexto: **no hay selector de tarjeta en ningún formulario**, y por eso nunca puede elegirse una
    de débito —que `createInstallmentPlanAction` rechaza (`installmentPlansActions.ts:115`)— ni falta
    el `closingDay` que `proponerPrimeraCuota()` necesita.

```
/cards
┌──────────────────────────────────────────────┐
│ 3 cuotas esperando confirmación              │   ← PendingInstallmentsInbox (paso 8)
│ Heladera Samsung · Visa Galicia · 3 de 12    │     global, sólo si hay pendientes
│ $10.000 · 10 oct       [Confirmar] [Otro $]  │
└──────────────────────────────────────────────┘
┌─ plástico ─┐  ┌─ plástico ─┐
│ VISA ••••  │  │ AMEX ••••  │                     ← CardVisual (paso 5)
└────────────┘  └────────────┘
  Facturado      Facturado
  En curso       En curso
  Cuotas fut.    Cuotas fut.                       ← la fila nueva
  [Ver planes]   [Ver planes]                      → InstallmentPlansModal (paso 6)
                                                      → InstallmentPlanFormModal (paso 7)
```

---

## Lo que NO es alcance de esta tanda

| No se toca | Por qué |
| :--- | :--- |
| `src/features/subscriptions/` entero | Es el **molde a copiar**, no a modificar. Está cerrado y verde |
| `installmentService.ts` , `installmentPlansRepository.ts` , `installmentPlansActions.ts` (cuerpos) | La tanda 1 los dejó completos y testeados. **Lo único que se mueve de ahí es la declaración del tipo `CardInstallmentPlanWithDetails`** (paso 1) |
| La suma multidivisa de `deudaTotal` (`CardVisual.tsx:34`) | Deuda abierta `TECHNICAL_DEBT.md` §9 y RFC 025 §10. **Esta tanda no la arregla y tampoco la empeora**: ver el paso 5, que resta cuotas futuras **sólo de la divisa principal** |
| `cards.creditLimit` y su falta de divisa declarada | Mismo cabo. Decidirlo es del RFC 007 |
| El pago del resumen | RFC 025 §5D: ya existe como transferencia |
| `CardFormModal.tsx` (alta de tarjeta) | No cambia. Se **lee** como molde de formulario en `cards` |
| Editar un plan existente | El RFC sólo especifica alta, imputación y baja. `installmentPlansRepository.update()` existe y queda sin consumidor de UI a propósito |
| `ciclo.ts` , `recurrenceService.ts` | Se **usan**, no se modifican |

---

## Lo que ya existe y NO hay que construir

**Recomendación contrastada abriendo cada archivo el 2026-09-11.** Si algo de esta tabla no coincide
con el árbol, **parar y reportar**, no improvisar.

| Ya existe | Dónde | Qué hace hoy |
| :--- | :--- | :--- |
| Cuotas futuras por divisa de una tarjeta | `CicloTarjeta.cuotasFuturas` , ya poblado por `cardCycleService.ts:47` | `Record< string , number >` divisa → centavos no imputados. **Ya viaja al cliente** |
| Cuotas imputadas y pendientes de un plan | `cuotasImputadasDe()` , `pendientesDeCuotas()` , `installmentService.ts` | Proyección pura con tope en `totalInstallments` |
| Propuesta de la primera cuota | `proponerPrimeraCuota( closingDay , dueDay , purchasedAt , zona )` , `installmentService.ts:147` | Devuelve `YYYY-MM-DD`. **Es una función pura sin `server-only`: el modal cliente la importa directo** (verificado: `installmentService.ts` sólo importa `recurrenceService`, `ciclo.ts` y `../types`, todos puros) |
| Alta, imputación, baja y consulta de planes | `createInstallmentPlanAction` , `resolveInstallmentAction` , `archiveInstallmentPlanAction` , `getInstallmentPlansAction` | Las cuatro devuelven `Result` y ya hacen `revalidatePath( "/[lang]/(main)/cards" , "page" )` |
| Molde literal de la bandeja | `PendingOccurrencesInbox.tsx` (454 líneas) + su `.module.css` (174) | Estado local `useState< Pendiente[] >( initialPending )`, `useTransition`, filtrado del ítem resuelto al confirmar, modales de monto alternativo y de descarte. **Retorna `null` si no hay pendientes** (`:81`) |
| Fecha civil → texto legible | `formatearFechaCivil()` , `PendingOccurrencesInbox.tsx:43` | Parte el `YYYY-MM-DD` y construye `Date.UTC( y , m-1 , d , 12 )`. **Copiar esta función, no `formatearDia()` de `CardVisual.tsx:218`**, que recibe ISO con hora |
| Modal, inputs, select, error y botón | `Modal` (`isOpen`/`onClose`/`title`/`subtitle`/`children`/`footer`/`size`) , `FormInput` , `FormSelect` , `FormError` , `Button` | `shared/ui/`. Ya usados por `CardFormModal.tsx` y por la bandeja de suscripciones |
| Árbol de categorías para el select | `getCategoryTreeAction()` , `accounting/actions/categoryActions.ts:238` | Lo carga hoy `/transactions/page.tsx:50`; el `<optgroup>` padre → hojas está en `TransactionFormModal.tsx:406-421` |
| Conversión a centavos en el borde | `Math.round( Number( x ) * 100 )` , `CardFormModal.tsx:77-83` | El patrón exacto del proyecto |
| Zona horaria del usuario en el cliente | `useProfileContext().profile.timezone` | `ProfileData` es `InferSelectModel< typeof profiles >`: trae `timezone` y `numberFormat` |
| Formato de moneda | `formatCurrency( centavos , divisa , locale )` , `shared/lib/currencyFormatter` | Ya usado en `CardVisual.tsx` |
| Envoltura de resultado | `Result` , `ok()` , `fail()` | `res.success ? res.value : res.error` — **`value`, no `data`** |

---

## Paso 1 — Tipos: cerrar la mentira de las fechas vacías

`src/features/cards/types.ts`.

**Éste es el hallazgo que trajo `obra` de la tanda 1, y es un defecto vivo, no sólo un
condicionante.** Desde `6be0341`, `calcularCicloDeTarjeta()` devuelve para una tarjeta de crédito sin
`closingDay` un objeto con `cierreAnterior: ""`, `cierreActual: ""` y `vencimiento: ""`
(`cardCycleService.ts:52-59`). El tipo los declara `string`, así que **el compilador no obliga a
nadie a mirar**: `CardVisual.tsx:104` pregunta `card.ciclo ?`, ahora evalúa verdadero, entra al
bloque y llega a `formatearDia( "" , locale )` → `new Date( "" )` es `Invalid Date` →
**`Intl.DateTimeFormat.format()` lanza `RangeError: Invalid time value` y tumba el render del
componente cliente.**

Una cadena vacía como centinela es exactamente lo que no se arregla con una guarda en el consumidor:
se arregla en el tipo, para que `tsc --noEmit` señale a cada consumidor.

1.  En `CicloTarjeta`, las tres fechas pasan a `string | null`, con el comentario de por qué:

    ```typescript
    export interface CicloTarjeta {
      cierreAnterior: string | null ; // null: la tarjeta no tiene día de cierre declarado
      cierreActual:   string | null ;
      vencimiento:    string | null ;
      facturado:      number ;
      enCurso:        number ;
      cuotasFuturas:  Record< string , number > ;
    }
    ```

2.  **Mudar `CardInstallmentPlanWithDetails` desde `installmentPlansActions.ts:71` a `types.ts`**, tal
    cual está, junto a `PendienteCuota` que ya vive ahí. Motivo: lo van a importar tres componentes
    cliente, y hoy está declarado en un archivo `"use server"`.
    `installmentPlansActions.ts` pasa a importarlo de `../types` (su bloque de import de tipos ya
    existe, líneas 38-41) y **deja de exportarlo**.

3.  `CardWithAccountsAndEntity` gana el campo, con el mismo estilo opcional que `ciclo`:

    ```typescript
    planes?: CardInstallmentPlanWithDetails[] | null ;
    ```

**Radio de impacto de este paso — quién más construye o lee estos tipos.** Verificado con
`grep -rn "cierreActual\|cierreAnterior\|\.vencimiento"`: los consumidores son **exactamente cuatro**
y todos están en esta tanda.

| Archivo | Qué le pasa |
| :--- | :--- |
| `cardCycleService.ts:53-55` | Paso 2: devuelve `null` en vez de `""` |
| `cardCycleService.test.ts:137` | Paso 2: `expect( ciclo?.cierreActual ).toBe( "" )` pasa a `.toBeNull()` |
| `CardVisual.tsx:104,110,122` | Paso 5: la guarda pasa a mirar la fecha, no el objeto |
| `installmentPlansActions.ts:71,358,373` | Este paso: importa el tipo en vez de declararlo |

`cardsRepository.test.ts` nombra variables locales `cierreAnterior`/`cierreActual` (`:101-102`) que
**no tienen nada que ver** con este tipo: son `Date` de un fixture. No se tocan.

---

## Paso 2 — `cardCycleService.ts`: `null` explícito

Dos cambios, ningún otro:

1.  En la guarda de `!card.closingDay` (`:51-60`), las tres fechas pasan de `""` a `null`. El
    comentario de `:49-50` **se conserva**: explica por qué el objeto igual se devuelve, que es lo
    correcto y lo que hace que las cuotas futuras no se pierdan del disponible.
2.  En `cardCycleService.test.ts:137`, la aserción pasa a `toBeNull()`. **Agregar en ese mismo
    `describe` una aserción hermana** de que `cuotasFuturas` sí viene poblado en ese caso, que es
    justamente la razón de ser de la rama.

---

## Paso 3 — `getCardsAction`: adjuntar los planes sin una consulta más

`src/features/cards/actions/cardsActions.ts:211-234` y
`src/features/cards/services/cardCycleService.ts:105-119`.

**`calcularCiclosDeTarjetas()` ya trae todos los planes activos de la organización en una sola
consulta** (`findActiveByOrganization`, `:110`) y los filtra por tarjeta (`:113`). Hoy usa ese lote
sólo para el escalar de cuotas futuras y lo tira. La UI necesita los planes enriquecidos, y pedirlos
de nuevo con `getInstallmentPlansAction()` por tarjeta sería la cascada N+1 que el RFC 007 §8D
prohíbe.

*   `calcularCiclosDeTarjetas()` adjunta también `planes`, mapeando cada plan del lote que ya tiene
    en memoria con `cuotasImputadasDe( plan )` y `pendientesDeCuotas( plan , hoyCivil )` —las mismas
    dos funciones que usa `getInstallmentPlansAction`, `installmentPlansActions.ts:371-375`.
*   Para eso necesita el `hoyCivil` de la zona del usuario. **`getCardsAction` ya resolvió la zona**
    (`cardsActions.ts:225`) y se la pasa como parámetro `zonaHoraria`: el servicio deriva
    `obtenerHoyCivil( zonaHoraria )` adentro, sin tocar la firma pública.
*   Las tarjetas de débito quedan con `planes: []`.
*   **`getInstallmentPlansAction` no se borra:** queda como API puntual de una tarjeta. Nadie de esta
    tanda la llama.

Agregar en `cardCycleService.test.ts` un caso de que `planes` llega con `cuotasImputadas` y
`pendientes` ya calculados y que una tarjeta de débito devuelve `ciclo: null`.

---

## Paso 4 — Los tres diccionarios, **antes** de escribir los componentes

`src/dictionaries/es.json` , `en.json` , `br.json`.

**El RFC lo pide explícito en su §4.2** y la deuda `TECHNICAL_DEBT.md` §3 lo dice con todas las
letras: «si se ejecuta el RFC 025, sus rótulos nuevos van a los tres diccionarios desde el principio
en vez de engrosar esta lista».

**Contraste obligatorio antes de escribir la primera clave:** `cardsPage` hoy tiene **sólo `title` y
`subtitle`** en los tres archivos — verificado. Y **los diccionarios de este proyecto no interpolan**:
no hay ni un `{count}` ni un `{date}` en `src/dictionaries/`. Las frases se componen en el JSX con
fragmentos, como hace `subscriptionsPage.activeServices` («servicios activos», usado como
`{n} {dict...}`). **Ninguna clave nueva lleva marcadores de sustitución.**

Esta tanda **localiza `CardVisual` entero**, no sólo sus rótulos nuevos: el archivo se reescribe en
el paso 5 de todos modos, y dejar la mitad en español directo es lo que convirtió la deuda §3 en dos
entradas. Claves, bajo `cardsPage`:

| Clave | `es` | `en` | `br` |
| :--- | :--- | :--- | :--- |
| `typeCredit` | Crédito | Credit | Crédito |
| `typeDebit` | Débito | Debit | Débito |
| `holder` | Titular | Cardholder | Titular |
| `expiresShort` | Vence | Expires | Vence |
| `billedBalance` | Saldo facturado | Billed balance | Saldo faturado |
| `dueOnPrefix` | Vence el | Due on | Vence em |
| `currentBalance` | Saldo en curso | Current balance | Saldo em curso |
| `sinceClosingPrefix` | Desde el cierre del | Since the closing on | Desde o fechamento de |
| `totalDebt` | Deuda total | Total debt | Dívida total |
| `futureInstallments` | Cuotas futuras | Future installments | Parcelas futuras |
| `installmentsPendingSuffix` | cuotas pendientes | installments left | parcelas pendentes |
| `available` | Disponible | Available | Disponível |
| `limit` | Límite | Limit | Limite |
| `maintenance` | Mantenimiento | Maintenance | Manutenção |
| `renewal` | Renovación | Renewal | Renovação |
| `closingDayPrefix` | Cierre: día | Closing: day | Fechamento: dia |
| `dueDayPrefix` | Vence: día | Due: day | Vence: dia |
| `accountBalance` | Saldo en cuenta | Account balance | Saldo em conta |
| `linkedAccountFallback` | Cuenta vinculada | Linked account | Conta vinculada |
| `archiveCard` | Dar de baja | Deactivate | Dar baixa |
| `archiveCardConfirm` | ¿Estás seguro de que querés dar de baja esta tarjeta? | Are you sure you want to deactivate this card? | Tem certeza de que deseja dar baixa neste cartão? |
| `newCard` | Nueva tarjeta | New card | Novo cartão |
| `tabAll` | Todas | All | Todos |
| `tabCredit` | Crédito | Credit | Crédito |
| `tabDebit` | Débito | Debit | Débito |
| `emptyTitle` | No hay tarjetas registradas | No cards yet | Nenhum cartão registrado |
| `emptyDescription` | Agregá tu primera tarjeta de crédito o débito para organizar tus instrumentos de pago. | Add your first credit or debit card to organize your payment instruments. | Adicione seu primeiro cartão de crédito ou débito para organizar seus meios de pagamento. |
| `emptyAction` | Agregar tarjeta | Add card | Adicionar cartão |
| `viewPlans` | Ver planes | View plans | Ver planos |

Y un objeto anidado `cardsPage.installments`:

| Clave | `es` | `en` | `br` |
| :--- | :--- | :--- | :--- |
| `modalTitlePrefix` | Cuotas de | Installments of | Parcelas de |
| `futureTotalLabel` | Cuotas futuras | Future installments | Parcelas futuras |
| `progressSeparator` | de | of | de |
| `nextInstallmentPrefix` | próxima | next | próxima |
| `noPlansTitle` | Sin compras en cuotas | No installment purchases | Sem compras parceladas |
| `noPlansDescription` | Las compras que financies con esta tarjeta van a aparecer acá, con su avance y su próxima cuota. | Purchases financed with this card will show up here, with their progress and next installment. | As compras financiadas com este cartão aparecerão aqui, com seu progresso e a próxima parcela. |
| `newPlan` | Nueva compra en cuotas | New installment purchase | Nova compra parcelada |
| `archivePlan` | Dar de baja | Deactivate | Dar baixa |
| `archivePlanConfirm` | Al dar de baja el plan dejás de ver sus cuotas futuras. Las cuotas ya imputadas quedan en el libro. ¿Confirmás? | Deactivating the plan hides its future installments. Installments already posted stay in the ledger. Confirm? | Ao dar baixa no plano, você deixa de ver as parcelas futuras. As parcelas já lançadas permanecem no livro. Confirma? |
| `formTitle` | Nueva compra en cuotas | New installment purchase | Nova compra parcelada |
| `descriptionLabel` | Qué compraste | What you bought | O que você comprou |
| `descriptionPlaceholder` | Ej: Heladera Samsung | E.g. Samsung fridge | Ex: Geladeira Samsung |
| `merchantLabel` | Comercio | Merchant | Loja |
| `merchantPlaceholder` | Ej: Frávega | E.g. Best Buy | Ex: Casas Bahia |
| `categoryLabel` | Categoría | Category | Categoria |
| `categoryNone` | Sin categoría | No category | Sem categoria |
| `currencyLabel` | Divisa | Currency | Moeda |
| `installmentAmountLabel` | Importe de cada cuota | Amount per installment | Valor de cada parcela |
| `installmentAmountHelper` | Lo que el resumen factura cada mes, tal como figura en el ticket. | What the statement bills each month, exactly as printed on the receipt. | O que a fatura cobra por mês, exatamente como está no comprovante. |
| `totalInstallmentsLabel` | Cantidad de cuotas | Number of installments | Quantidade de parcelas |
| `purchasedAtLabel` | Fecha de compra | Purchase date | Data da compra |
| `firstInstallmentLabel` | Primera cuota | First installment | Primeira parcela |
| `firstInstallmentHelper` | La proponemos según el cierre de la tarjeta. Si la promoción tiene meses de gracia, corregila. | We propose it from the card's closing day. If the promo has grace months, change it. | Propomos com base no fechamento do cartão. Se a promoção tiver carência, ajuste. |
| `totalPurchasePrefix` | Total de la compra | Purchase total | Total da compra |
| `cancel` | Cancelar | Cancel | Cancelar |
| `save` | Registrar compra | Save purchase | Registrar compra |
| `inboxTitlePrefix` | Cuotas esperando confirmación | Installments awaiting confirmation | Parcelas aguardando confirmação |
| `inboxSubtitle` | Confirmá la cuota cuando entre al resumen de la tarjeta. No mueve plata de ninguna cuenta. | Confirm each installment when it hits the card statement. No money moves from any account. | Confirme a parcela quando ela entrar na fatura do cartão. Não movimenta dinheiro de nenhuma conta. |
| `confirm` | Confirmar | Confirm | Confirmar |
| `confirmOther` | Otro importe | Other amount | Outro valor |
| `otherAmountTitle` | Confirmar con otro importe | Confirm with another amount | Confirmar com outro valor |
| `otherAmountLabel` | Importe real de esta cuota | Actual amount of this installment | Valor real desta parcela |
| `skip` | Descartar | Skip | Descartar |
| `skipConfirm` | Descartar la cuota avanza el plan sin registrar ningún asiento. ¿Confirmás? | Skipping advances the plan without posting any entry. Confirm? | Descartar avança o plano sem lançar nenhum registro. Confirma? |

> El acceso es siempre `dict.cardsPage?.installments?.confirm || "Confirmar"`, con el respaldo en
> español entre `||`, igual que `CardsContainer.tsx:82`. **Nunca declarar un diccionario de respaldo
> dentro del componente.**

---

## Paso 5 — `CardVisual.tsx`: la fila de cuotas futuras y el disponible real

`src/features/cards/components/CardVisual.tsx` y su `.module.css`.

**Props nuevas:** `dict` (con el tipo `Awaited< ReturnType< typeof getDictionary > >`, igual que
`CardsContainer.tsx:37`) y `onViewPlans?: ( card: CardWithAccountsAndEntity ) => void`.

### 5.1 La guarda del ciclo (el hallazgo de la tanda 1)

La línea 104 pasa de `card.ciclo ?` a preguntar por la fecha, no por el objeto:

```typescript
const tieneCiclo = Boolean( card.ciclo?.cierreActual && card.ciclo?.vencimiento ) ;
```

y el bloque de «Saldo facturado» / «Saldo en curso» se renderiza con `tieneCiclo`. Después del
paso 1, `formatearDia()` sólo recibe `string` no nulo: si `tsc --noEmit` se queja en esa línea, la
guarda está mal puesta.

**Consecuencia que hay que atender en el mismo archivo:** la fila de respaldo de `:174`
(`!card.ciclo && (card.closingDay || card.dueDay)`) quedó inalcanzable para crédito desde `6be0341`,
porque `card.ciclo` ya nunca es nulo en crédito. Pasa a `!tieneCiclo && (...)`, que es lo que esa
fila siempre quiso decir.

### 5.2 Cuotas futuras y disponible

`card.ciclo.cuotasFuturas` es **un mapa divisa → centavos**, no un escalar (RFC §0). El disponible se
compara contra `creditLimit`, que es una columna **sin divisa declarada** (deuda §9). Entonces:

```typescript
const cuotasFuturasPrincipal = ( card.ciclo?.cuotasFuturas?.[monedaPrincipal] ?? 0 ) ;
const disponible             = Math.max( 0 , (limite - deudaTotal - cuotasFuturasPrincipal) ) ;
```

*   **Sólo la divisa principal entra en la resta.** Sumar el mapa entero repetiría el defecto §9 en
    una fila nueva; tomar sólo la principal es coherente con que `deudaTotal` y `limite` ya se
    rotulan en `monedaPrincipal`. **No es el arreglo del §9, y no lo aparenta.**
*   `porcentajeConsumido` (`:42-44`) usa `(deudaTotal + cuotasFuturasPrincipal) / limite`: la barra
    tiene que contar lo mismo que el disponible, o la barra y el número de abajo se contradicen.
*   Las **otras** divisas del mapa con monto mayor a cero se muestran como una línea de badges con
    `formatCurrency( monto , divisa , locale )`, reusando `styles.badgeRow` / `styles.metaBadge`.
    Ninguna entra en la aritmética.

La fila nueva va **debajo de «Saldo en curso» y antes de «Deuda total»**, con la estructura de
`styles.balanceRow` + `styles.balanceStack` que ya existe:

*   Rótulo: `futureInstallments`.
*   Pista: `{cuotasPendientes} {installmentsPendingSuffix}`, donde `cuotasPendientes` se deriva de
    `card.planes` — `sum( totalInstallments − cuotasImputadas )` sobre los planes **de la divisa
    principal**, sin archivados. Si `card.planes` viene vacío o ausente, **la fila entera no se
    renderiza** (no una fila en cero).
*   Valor: `formatCurrency( cuotasFuturasPrincipal , monedaPrincipal , locale )` con
    `styles.balanceValueSoft`.

### 5.3 El botón «Ver planes»

Debajo del bloque financiero, junto a «Dar de baja», sólo si `isCredit && onViewPlans`. Reusa
`styles.archiveButton` como base y agrega una clase hermana en el CSS Module.

**CSS:** las clases nuevas van en `CardVisual.module.css` con tokens de `globals.css`
(`var(--fs-xs)`, `var(--text-muted)`, `var(--radius-sm)`…), sin px estructurales, y **sin ningún
cambio de dimensión, posición ni `font-weight` en `:hover`** (`.agents/AGENTS.md` §4). El archivo ya
respeta esa regla en `.cardContainer:hover` (sólo sombra y color de borde): seguir ese ejemplo.

### 5.4 Localización

Todos los rótulos del archivo pasan a `dict.cardsPage?.<clave> || "<respaldo en español>"`. Incluye
`"Crédito"`/`"Débito"` (`:72`), `"Titular"` (`:90`), `"Vence"` (`:94`), y el `style` inline de
`:183-187`, que aprovecha y se muda a dos clases del CSS Module —hoy viola la prohibición de CSS
inline de §4, y la excepción de valores dinámicos no lo cubre.

---

## Paso 6 — `InstallmentPlansModal.tsx` (detalle por tarjeta)

Archivos nuevos: `src/features/cards/components/InstallmentPlansModal.tsx` y
`InstallmentPlansModal.module.css`.

**Props:** `card: CardWithAccountsAndEntity` , `isOpen` , `onClose` , `categoryTree: CategoryTreeNode[]` ,
`dict` , `locale` , `onChanged: () => void`.

*   `<Modal size="medium" title={`${modalTitlePrefix} ${card.label}`}>`.
*   **Cabecera:** total de cuotas futuras de la divisa principal y cuántas cuotas quedan. El mismo
    par de números del paso 5.2, derivado de `card.planes`.
*   **Una fila por plan activo** (`card.planes`, ya enriquecidos, sin consultar nada):
    descripción y comercio; `{cuotasImputadas} {progressSeparator} {totalInstallments}`;
    `formatCurrency( installmentAmount , plan.currency , locale )`; la fecha de la próxima cuota, que
    es `ocurrenciaDeCuota( plan , plan.cuotasImputadas )` **sólo si `cuotasImputadas < totalInstallments`**
    (importada de `installmentService`, función pura); y una barra de progreso.
    **La barra reusa el patrón de `styles.progressTrack` / `styles.progressBar` de
    `CardVisual.module.css`**, reescrito en el módulo nuevo — los CSS Modules no se comparten entre
    componentes en este repo.
*   **Baja:** botón por plan → `archiveInstallmentPlanAction( plan.id )` dentro de `useTransition`,
    con `confirm( archivePlanConfirm )` antes, igual que `CardsContainer.tsx:63`. Al volver `success`,
    `onChanged()`.
*   **Vacío:** cuando no hay planes, `EmptyState` con `noPlansTitle` / `noPlansDescription`
    (`shared/ui/feedback/EmptyState/EmptyState`, ya usado en `CardsContainer.tsx:119`).
*   **Pie:** botón primario `newPlan`, que abre el modal del paso 7.
*   Errores de la acción: `FormError` con el `res.error` crudo. **Nunca tragar el error en silencio.**

---

## Paso 7 — `InstallmentPlanFormModal.tsx` (alta)

Archivos nuevos: `InstallmentPlanFormModal.tsx` y `InstallmentPlanFormModal.module.css`.

**Props:** `card` , `isOpen` , `onClose` , `categoryTree` , `dict` , `locale` , `onSuccess: () => void`.
**No hay prop de tarjeta opcional ni selector**: la decisión 2 del usuario.

Campos, en este orden: descripción · comercio · categoría · divisa · importe de cada cuota ·
cantidad de cuotas · fecha de compra · primera cuota. Más una línea calculada, no editable, con
`{totalPurchasePrefix}: {formatCurrency( importe × cantidad )}` — el §3.4 del RFC: **el total es
derivado y no se guarda en ninguna columna.**

### 7.1 La trampa de la fecha de compra

`<input type="date">` da `"2026-09-20"`. `new Date( "2026-09-20" )` es medianoche **UTC**, que en
`America/Argentina/Buenos_Aires` es el **19** a las 21:00. `proponerPrimeraCuota()` llama adentro a
`descomponerFechaEnZona( purchasedAt , zona )` (`installmentService.ts:165`) y compararía el día
**19** contra el `closingDay`: **una compra hecha exactamente el día de cierre propondría el mes
equivocado.**

Por eso, el valor del input se convierte **siempre** así, y nunca con `new Date( valor )` pelado:

```typescript
const [ y , m , d ]  = purchasedAtInput.split( "-" ).map( Number ) ;
const purchasedAtUtc = new Date( Date.UTC( y , (m - 1) , d , 12 , 0 , 0 ) ) ;
```

Es el mismo mediodía UTC que usa `formatearFechaCivil()` en `PendingOccurrencesInbox.tsx:45`, y por
la misma razón. Ese `Date` es el que se le pasa a `proponerPrimeraCuota()` y el que viaja como
`purchasedAt` a la acción.

### 7.2 La propuesta de la primera cuota

*   Al montar y **cada vez que cambia la fecha de compra**, recalcular:
    `proponerPrimeraCuota( card.closingDay , card.dueDay , purchasedAtUtc , profile.timezone || "America/Argentina/Buenos_Aires" )`
    y escribir el resultado en el input de primera cuota.
*   **Si el usuario ya editó a mano ese campo, no se pisa.** Un booleano de estado
    (`primeraCuotaEditada`) alcanza. El §3.2 del RFC: «es una propuesta por defecto, nunca una
    imposición».
*   La zona sale de `useProfileContext().profile.timezone`, no de `Intl.DateTimeFormat().resolvedOptions()`.

### 7.3 Envío

```typescript
createInstallmentPlanAction( {
  cardId:               card.id ,
  description:          description.trim() ,
  merchantName:         ( merchantName.trim() || null ) ,
  categoryId:           ( categoryId || null ) ,
  installmentAmount:    Math.round( Number( installmentAmount ) * 100 ) ,
  totalInstallments:    Number( totalInstallments ) ,
  currency ,
  purchasedAt:          purchasedAtUtc ,
  firstInstallmentDate ,
} )
```

*   **Centavos en el borde** (§8.2 de `.agents/AGENTS.md`): `Math.round( Number( x ) * 100 )`, el
    patrón de `CardFormModal.tsx:77`.
*   `totalInstallments` es un entero **que no es dinero**: no se multiplica por 100.
*   El `<select>` de divisa ofrece las divisas que la tarjeta ya tiene en `card.accounts` **más**
    `"ARS"` y `"USD"` si faltaran. Elegir una divisa nueva es válido: la acción crea la cuenta de
    pasivo (`installmentPlansActions.ts:117-137`).
*   El `<select>` de categoría: `<optgroup>` por padre y `<option>` por hoja, molde
    `TransactionFormModal.tsx:406-421`. Primera opción `categoryNone` con valor vacío. **La
    resolución a hoja la hace la acción al imputar (RFC 022 §5), no el formulario.**
*   Errores: `res.error` en `FormError`, sin cerrar el modal. En éxito: `onSuccess()`, que cierra y
    hace `router.refresh()` desde el contenedor.

---

## Paso 8 — `PendingInstallmentsInbox.tsx` (la bandeja global)

Archivos nuevos: `PendingInstallmentsInbox.tsx` y `PendingInstallmentsInbox.module.css`.
**Molde: `PendingOccurrencesInbox.tsx`, leído y adaptado, no copiado a ciegas.**

**Props:** `initialPending: PendienteCuota[]` , `cards: CardWithAccountsAndEntity[]` , `dict` , `locale`.

Diferencias con el molde, todas por el §3.5 del RFC — **imputar una cuota no mueve plata**:

| El molde de suscripciones | Esta bandeja |
| :--- | :--- |
| Pide cuenta de pago si la suscripción no tiene (`:106-113`) y tiene modal de selección de cuenta | **No hay cuenta de pago, no hay prop `accounts`, no hay modal de cuenta.** `ResolveInstallmentParams` no tiene `accountId` — verificado en `installmentPlansActions.ts:53-58` |
| Acción de baja de la suscripción dentro de la bandeja | **No.** La baja del plan vive en el modal de planes (paso 6) |
| `item.subscriptionId` + `item.fechaCobro` | `item.planId` + `item.fechaCuota` |

Lo que se conserva del molde, tal cual:

*   **Retorna `null` si no hay pendientes** (`:81`). La bandeja no existe cuando no hay nada que hacer.
*   `useState` con la lista inicial, `useTransition`, y al confirmar con éxito **se filtra el ítem
    resuelto del estado local** en vez de recargar la página.
*   Modal de «otro importe» con `confirm_custom_amount`, y `skip` detrás de un `confirm()`. Los tres
    valores de `ResolveInstallmentActionType` ya existen en la acción.
*   `formatearFechaCivil()` copiada de `:43-54`, porque las fechas de cuota son civiles `YYYY-MM-DD`.

Cada ítem rotula: descripción del plan · **etiqueta de la tarjeta** · `{numeroCuota} de {total}` ·
importe · fecha. La etiqueta sale de `cards.find( ( c ) => c.id === item.plan.cardId )?.label`:
`PendienteCuota` trae el `plan` entero (`types.ts`), y el plan trae `cardId`. **No hace falta ningún
tipo nuevo ni ninguna consulta más.**

El importe del custom amount: `Math.round( Number( x ) * 100 )`, centavos en el borde.

---

## Paso 9 — `CardsContainer.tsx`: cablear y localizar

*   **Props nuevas:** `initialPending: PendienteCuota[]` y `categoryTree: CategoryTreeNode[]`.
*   Renderiza `<PendingInstallmentsInbox>` **entre el `PageHeader` y la fila de tabs**.
*   Estado `plansModalCard: CardWithAccountsAndEntity | null`; `onViewPlans` de cada `CardVisual` lo
    setea; el modal de planes se renderiza cuando no es nulo. Al cerrarse con cambios, `router.refresh()`.
*   Le pasa `dict` a cada `<CardVisual>`.
*   Localiza lo suyo con las claves del paso 4: `newCard` (`:86`), los tres tabs (`:100,107,114`),
    `emptyTitle`/`emptyDescription`/`emptyAction` (`:121-125`) y el `confirm()` de `:63`
    (`archiveCardConfirm`).

---

## Paso 10 — `/cards/page.tsx`

*   Sumar `getCategoryTreeAction()` al `Promise.all` que ya existe (`:26-31`). **Va adentro del mismo
    `Promise.all`**: agregarlo con un `await` aparte crearía la cascada que el comentario de `:25`
    dice que se evitó.
*   Derivar los pendientes de lo que `getCardsAction` ya trajo, **sin consultar de nuevo**:

    ```typescript
    const pendientes = cards.flatMap( ( c ) => ( c.planes || [] ).flatMap( ( p ) => p.pendientes ) ) ;
    pendientes.sort( ( a , b ) => a.fechaCuota.localeCompare( b.fechaCuota ) ) ;
    ```

    Es el mismo orden y la misma forma que `/subscriptions/page.tsx:49-50`.
*   Pasarle `initialPending` y `categoryTree` a `CardsContainer`.

---

## Paso 11 — Tests

Entorno `jsdom` con `// @vitest-environment jsdom` en la **primera línea** del archivo. Lo que el
proyecto ya sabe de estos tests, y que no hay que redescubrir:

*   **El setup global mockea sólo `next/cache` y `next/navigation`.** Todo el código propio se monta
    real (`docs/patterns.md` §12).
*   **`vi.hoisted` es obligatorio** para el doble de `next/navigation`, y **no se puede exportar en la
    misma sentencia**: `const routerMock = vi.hoisted( ... ) ;` y después `export { routerMock } ;`.
    La forma prohibida tumba las 58 suites con un `SyntaxError`.
*   **El diccionario es real:** `await getDictionary( "es" )` en un `beforeAll`. No tiene
    `server-only`. Así el test también verifica que las claves del paso 4 existan de verdad.
*   **Un fixture de `Account` lleva `cbuCvu` y `alias`** — el tipo es `InferSelectModel`, y omitirlos
    compila en vitest pero rompe `tsc --noEmit`. Lo mismo vale para los fixtures de `Card` y de
    `CardInstallmentPlan`: **la lista de campos la manda el esquema**. Para el plan, usar
    `makeInstallmentPlan()` de `src/features/cards/testing/installmentPlanFactory.ts`, que la tanda 1
    ya escribió.

Tres archivos:

1.  **`PendingInstallmentsInbox.test.tsx`**
    *   Con la lista vacía **no renderiza nada** (`container.firstChild` es `null`).
    *   Con dos pendientes de dos tarjetas, cada fila muestra la etiqueta de **su** tarjeta.
    *   Al confirmar, se llama `resolveInstallmentAction` con `{ planId , occurrenceDate , action: "confirm" }`
        —**sin `accountId`**— y la fila desaparece de la lista.
    *   Si la acción devuelve `fail`, el error se muestra y la fila **no** desaparece.

2.  **`InstallmentPlanFormModal.test.tsx`**
    *   **La trampa del mediodía:** con `closingDay: 20` y fecha de compra `2026-09-20`, el campo de
        primera cuota queda en el mes **vigente**. Con `2026-09-21`, en el siguiente. (Si la
        conversión se hiciera con `new Date( "2026-09-20" )`, el primer caso daría el mes vigente por
        el motivo equivocado y el borde se rompería un día antes: el test que lo distingue es el de
        `2026-09-20` con zona `America/Argentina/Buenos_Aires`.)
    *   Editar a mano la primera cuota y después cambiar la fecha de compra **no pisa** lo editado.
    *   El envío manda `installmentAmount` en **centavos** y `totalInstallments` **sin** multiplicar.
    *   La línea de total muestra importe × cantidad.

3.  **`CardVisual.test.tsx`**
    *   Una tarjeta de crédito **sin `closingDay`** (ciclo con las tres fechas en `null`) **renderiza
        sin lanzar** y no muestra las filas de facturado / en curso. **Es el hallazgo de la tanda 1
        convertido en regresión permanente.**
    *   Con un plan de 12 cuotas de $10.000 y una imputada: la fila de cuotas futuras muestra
        $110.000, la pista dice 11, y el disponible es `límite − deudaTotal − 110.000` (el caso §9.10
        del RFC, ahora en la interfaz).
    *   Un plan en USD sobre una tarjeta cuya divisa principal es ARS **no** entra en el disponible y
        aparece como badge aparte.
    *   Los rótulos salen del diccionario real: montar con `dict` en `en` y comprobar «Future
        installments».

---

## Paso 12 — Documentación, en el mismo commit

*   **`docs/TECHNICAL_DEBT.md` §3:** la entrada «`/cards` no está internacionalizada» **se cierra** —
    tacharla y moverla a `§ Resuelto` con la fecha, nombrando que `CardVisual` y `CardsContainer`
    quedaron localizados en los tres diccionarios. **La entrada §8 del `Navbar` (`<span>Tarjetas</span>`)
    NO se cierra: no se toca en esta tanda.**
*   **`docs/TECHNICAL_DEBT.md` §9:** la entrada de la suma multidivisa **sigue abierta**. Agregarle
    una línea: el disponible ahora resta **sólo** las cuotas futuras de la divisa principal, y la
    barra de consumo cuenta lo mismo.
*   **`docs/trabajo-en-vuelo.md`:** rama, estado y próximo paso. **Se actualiza en el mismo commit que
    avanza el trabajo**, no después.
*   **El RFC 025 no se toca.** Ya está `APPROVED` y esta tanda lo implementa tal cual.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**. `pnpm test` necesita el
contenedor `postgres-dev` vivo: si muere en el setup con `ECONNREFUSED` o `AggregateError`, es
**entorno caído, no suite roja**.

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

> **`pnpm build` no es typecheck:** no tipa los archivos de test, y vitest tampoco. La compuerta corre
> `tsc --noEmit` por separado (`.github/workflows/compuerta.yml:62`). **Build verde y tests verdes ya
> convivieron con `tsc --noEmit` roto en este repo.**

Punto de partida a superar: **429 tests en 58 archivos, 0 ESLint, 0 TS, build exitoso.**

---

## El reporte

Pegar la **salida cruda** de los cuatro comandos, no describirla: número de tests y de archivos de
suite, el conteo de errores de TS, y el resultado del build.

Y aparte, la lista de **hallazgos**: lo que se vio y no se hizo porque este plan no lo nombraba. Esa
lista es la entrada de la próxima ronda. Si algo de «Lo que ya existe y NO hay que construir» no
coincidió con el árbol, **va ahí y en primer lugar.**
