---
name: patrones-reusables
description: Patrones vigentes de FinanzIA que todo plan debe reusar en vez de reinventar — Result, transacciones, bloqueo, contenedores server-driven, aislamiento multi-tenant, vitest.
metadata:
  type: project
---

# Patrones que ya existen y conviene reusar

**How to apply:** nombrarlos explícito en el plan, con archivo y línea. Lo que el plan nombra sale
sin defectos; recomendar un reuso sin abrir el archivo ya introdujo un bug.

## Contratos del núcleo

*   **El `Result` de `@/shared/lib/result`: el éxito trae `value`, no `data`**
    (`{ success: true, value: T }`). Nombrarlo ahorra un tropiezo por ronda.
*   **`createLedgerTransaction` exige `organizationId` explícito** en la cabecera: la FK de
    aislamiento no es anulable y no se deduce de la sesión.
*   **`accountRepository.findByIdForUpdate( id , orgId , tx )`** (`accountRepository.ts:51`) es el
    molde del `SELECT ... FOR UPDATE`: `.for( "update" )`, `tx` obligatorio; lo consume
    `accountingService.ts:67`. Cuando haga falta una guarda de concurrencia se copia esto — no se
    inventa un mecanismo nuevo ni se agrega `idempotencyKeys` encima. **Y la guarda va DENTRO de la
    transacción**: dejarla afuera fue el defecto que dejó el plan del RFC 023.
*   **Aislamiento multi-tenant en tablas hijas:** `contact_payment_methods` cuelga de `contact_id`, así
    que la DAL **joinea contra `contacts`** para filtrar por organización. Ver `contactsRepository.ts`.
*   `ledger_transactions` separa `merchant_name` de `merchant_domain`: es el patrón correcto para
    marca + dominio. `financial_entities` es la única tabla que no lo seguía (ya tiene `brand_domain`
    desde la migración `0020`; `logo` quedó como ícono de respaldo).

## Componentes

*   **`shared/ui/` ya tiene** `DataTable`, `SearchInput`, `Modal`, `Form`, `Autocomplete`,
    `InstitutionLogo`, `EmptyState`, `Tabs`, `Toolbar`. Casi ningún módulo nuevo necesita primitivas.
*   **Los contenedores son server-driven: renderizan de props e invalidan con `router.refresh()`.**
    `AccountsContainer` sólo guarda booleanos de modal. Los tres únicos `router.refresh()` del repo
    (`CreateAccountForm:88`, `CreateFinancialEntityForm:303`, `SignInForm:106`) van dentro de la
    transición, después del `res.success`. **`CardsContainer` es el único outlier**: fotografía
    `initialCards` en `useState`, y por eso necesitaba `window.location.reload()`.
*   **Cuidado con el estado que el `<Modal>` no desmonta.** `Modal.tsx:126` retorna `null` al cerrar,
    así que un formulario **adentro** se limpia solo (`AccountsContainer:314-332`). Si el estado vive
    en un componente wrapper **por fuera** del `<Modal>` — como los 16 `useState` de `CardFormModal` —
    hay que montar el wrapper condicionalmente o el formulario conserva los datos de la vez anterior.
*   **El diálogo de confirmación es `confirm()` nativo**, convención en cuatro componentes
    (`ContactsContainer:98`, `PaymentMethodsPanel:111`, `TransactionDetailModal:120`,
    `CardsContainer:56`). No es un outlier a corregir de paso.
*   **El estilo CSS ya no hace falta especificarlo en el plan.** `CategoriesSettingsContainer.module.css`:
    468 líneas, 0 colores crudos, 0 px fijos estructurales, 0 `:hover` con movimiento. Sale bien solo.

## Tests

*   **`setupFiles` de vitest corre una vez por archivo** (`vitest.setup.dom.ts`); `globalSetup` una
    sola vez para toda la suite (`src/shared/db/vitest.setup.ts`, crea la base y migra). Lo que tenga
    que pasar por archivo va en `setupFiles`.
*   **No hay infraestructura de test de componentes.** Ninguna feature tiene tests de `.tsx`. No
    inventar una de paso en una tanda que no es sobre eso.
