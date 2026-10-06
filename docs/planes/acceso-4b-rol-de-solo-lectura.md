# Plan — Acceso 4b/5: el rol de sólo lectura se cumple en el servidor y se refleja en la interfaz

**Rama:** `feat/acceso-4b-solo-lectura` (sale de la punta de `feat/acceso-4-miembros-y-selector`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — implementa **RN-21** a **RN-27** (sección «Sólo lectura»). Cubre **AC-18**, **AC-19**, **AC-20**, **AC-21**, **AC-22** y **AC-23**.
**Serie:** 0 → 1 → 2 → 3 → 4 `acceso-4-miembros-y-selector` → **4b este** → 5 `acceso-5-despliegue-vercel-neon`.

No hay RFC y no hace falta: es el rol que la spec ya fija. **Precondición dura:** el plan 4 está mergeado y verificado
(el rol `viewer` ya existe en `memberships` e `invitations`, se puede invitar con él y el layout ya lee el rol de cada
membresía). **Este plan es transversal: toca 9 archivos de acciones y 8 suites, y una docena de componentes.**
Es mecánico, pero **cualquier acción de escritura que se escape es un agujero**, y por eso el plan trae un test que
falla si aparece una acción sin clasificar.

---

## 0. Por qué es un plan propio (verificado)

- Hay **49 funciones exportadas** de archivos `"use server"` en 10 `actions/*.ts`, y **cada una resuelve la sesión por
  su cuenta** con `getServerSession( authOptions )`. **Ninguna mira el rol.** Hoy un `viewer` sería un `member` completo.
- El rol de la sesión (`session.user.role`) llega del JWT y se refresca cada ≤ 5 minutos (`REVALIDACION_MS`). La spec
  (RN-24) pide que **la decisión de escribir salga de la base**, no del token.
- **Hallazgo previo, no de la spec:** `obtenerCuentaPorMoneda` (`transactionsActions.ts:70`) es una función
  **exportada desde un archivo `"use server"`**. Next.js trata toda exportación de ese archivo como una acción de
  servidor potencialmente invocable, y ésta **recibe `organizationId` y `allAccounts` por parámetro y crea cuentas**
  (`accountRepository.create`), sin mirar la sesión. No es una acción, es un servicio que quedó mal ubicado.
  *No probé que se pueda invocar desde afuera; no hace falta probarlo para sacarla de ahí.* Se resuelve en el Paso 1.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/auth/services/authorizationService.ts` | **Nuevo.** La guarda: `obtenerSesionDeEscritura()` |
| `src/shared/lib/actionPolicy.ts` | **Nuevo.** El registro: cada exportación de cada archivo de acciones, clasificada |
| `src/features/transactions/services/accountResolver.ts` | **Nuevo.** Recibe `obtenerCuentaPorMoneda`, que sale de `transactionsActions.ts` |
| Los **9** `actions/*.ts` con escrituras (§3, tabla) | **31 funciones** pasan a la guarda |
| Las **8** `actions/*.test.ts` | Dejan de mockear sólo `getServerSession`: necesitan una membresía real (§Paso 4) |
| `src/shared/providers/PermissionsProvider.tsx` | **Nuevo**, cliente: `usePuedeEscribir()` |
| `src/shared/ui/layout/AppShell/AppShell.tsx` · `(main)/layout.tsx` | El layout pasa `puedeEscribir`; el `AppShell` lo provee |
| Componentes con acciones de escritura | Ocultan sus botones (§Paso 5, lista y método) |
| `src/features/organizations/components/OrganizationSwitcher.tsx` | Muestra «Sólo lectura» junto al nombre |
| `src/dictionaries/es.json` · `en.json` · `br.json` | Claves nuevas |
| `src/features/auth/constants.ts` | `ERROR_SIN_PERMISO_DE_ESCRITURA` |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y deuda |

**Quién más importa `obtenerCuentaPorMoneda`:** `transactionsActions.ts:209` y `:218` (dentro del mismo archivo) y
`transactionsActions.test.ts:17,192`. Nadie más (`grep -rn obtenerCuentaPorMoneda src/`).

---

## 2. Los dos contratos

### La guarda — `obtenerSesionDeEscritura()`

Devuelve `Result< { userId: string ; organizationId: string } , string >`. En este orden, sin reordenar:
1. `getServerSession( authOptions )`. Sin sesión o sin `organizationId` → `fail( "No autorizado." )`.
2. **`membershipRepository.findMembership( session.user.id , session.user.organizationId )`** — el rol sale de la
   **base** (RN-24). **Sin membresía** → `fail( "Tu sesión ya no es válida. Volvé a iniciar sesión." )`.
3. Rol `viewer` → `fail( ERROR_SIN_PERMISO_DE_ESCRITURA )` («No tenés permiso para modificar esta organización»).
4. Rol `owner` o `member` → `ok( { userId , organizationId } )`.

**La guarda va PRIMERA en cada acción de escritura, antes de la validación con Zod.** Si la validación va antes, un
`viewer` que manda basura recibe «datos inválidos» en vez de «sin permiso», y el test del Paso 4 no puede forzar el
camino con argumentos vacíos.

Una **segunda función hermana**, `obtenerSesionDeLectura()`, no se agrega: las lecturas siguen con
`getServerSession` como hoy (los 54 sitios no se tocan).

### El registro — `actionPolicy.ts`

```ts
export const POLITICA_DE_ACCIONES = {
  "accounting/actions/accountingActions" : { createAccountAction: "escritura" , getAccountsAction: "lectura" , … } ,
  …
} as const
```
Cada exportación de cada archivo `"use server"` aparece **una vez**, como `"lectura"`, `"escritura"` o `"exenta"`. Es el
inventario del §3 hecho código. **Fail-closed:** una acción nueva sin clasificar rompe el test del Paso 4.

---

## 3. El inventario (verificado contra las exportaciones, 2026-10-06)

Total: **49** exportaciones = **31 escritura + 15 lectura + 2 exentas + 1 que no es acción** (`obtenerCuentaPorMoneda`).

| Archivo | Escritura (guarda) | Lectura | Exenta |
| :--- | :--- | :--- | :--- |
| `accounting/actions/accountingActions.ts` | `createAccountAction` `createFinancialEntityAction` `createAccountForEntityAction` `createLedgerTransactionAction` `deleteLedgerTransactionAction` `updateLedgerTransactionMetadataAction` `reverseLedgerTransactionAction` (7) | `getAccountsAction` `getFinancialEntitiesAction` `getTransactionsAction` `getTransactionsPageAction` `getMonthlySummariesAction` `getEarliestMonthKeyAction` (6) | `rellenarResumenesMensualesAction` — **RN-25**: dato derivado que dispara el dashboard |
| `accounting/actions/categoryActions.ts` | `createCategoryAction` `updateCategoryAction` `archiveCategoryAction` `unarchiveCategoryAction` (4) | `getCategoryTreeAction` `getCategoryMovementsCountAction` (2) | — |
| `cards/actions/cardsActions.ts` | `createCardAction` `archiveCardAction` (2) | `getCardsAction` (1) | — |
| `cards/actions/installmentPlansActions.ts` | `createInstallmentPlanAction` `resolveInstallmentAction` `archiveInstallmentPlanAction` (3) | `getInstallmentPlansAction` (1) | — |
| `contacts/actions/contactsActions.ts` | `createContactAction` `updateContactAction` `archiveContactAction` `unarchiveContactAction` `addPaymentMethodAction` `deletePaymentMethodAction` `setDefaultPaymentMethodAction` (7) | `getContactsAction` `getContactByIdAction` (2) | — |
| `loans/actions/loansActions.ts` | `createLoanAction` `payLoanInstallmentAction` `archiveLoanAction` (3) | `getLoansAction` (1) | — |
| `profile/actions/profileActions.ts` | — | — | `updateProfileAction` — **RN-22**: es su propio perfil, no la organización |
| `subscriptions/actions/subscriptionsActions.ts` | `createSubscriptionAction` `updateSubscriptionAction` `deleteSubscriptionAction` (3) | `getSubscriptionsAction` (1) | — |
| `subscriptions/actions/resolveSubscriptionAction.ts` | `resolveSubscriptionAction` (1) | — | — |
| `transactions/actions/transactionsActions.ts` | `createTransactionFromFormAction` (1) | `getCategoriesAction` (1) | — |

**No están en la tabla, y a propósito:** las acciones del plan 4 (`crearOrganizacionAction` es del usuario, no de una
organización; las de miembros ya exigen `owner`, que **implica** poder escribir y no se les agrega esta guarda).
**El cambio de organización activa** no es una acción: lo hace el callback `jwt`.

---

## 4. Pasos

### Paso 1 — Sacar `obtenerCuentaPorMoneda` del archivo de acciones

Mover la función **tal cual** (cuerpo, JSDoc incluido) a `transactions/services/accountResolver.ts` y que
`transactionsActions.ts` la importe. `transactionsActions.test.ts` pasa a importarla de ahí. **Cero cambios de
comportamiento**; el único efecto es que deja de ser una exportación de `"use server"`.

### Paso 2 — La guarda y el registro

`authorizationService.ts` y `actionPolicy.ts` según el §2. La constante `ERROR_SIN_PERMISO_DE_ESCRITURA` en
`auth/constants.ts`, junto a `ERROR_DEMASIADOS_INTENTOS` (el mismo patrón de constante con el texto).

### Paso 3 — Las 31 acciones

En cada una de la columna «Escritura»:
1. Reemplazar el bloque `getServerSession` + comprobación de `organizationId` por la llamada a la guarda; si falla,
   `return( resultado )` tal cual (ya es un `Result`).
2. De ahí en más usar `userId` y `organizationId` que devuelve la guarda; **no** volver a leer la sesión.
3. **Nada más cambia.** Ni validaciones, ni mensajes, ni el orden del resto. Es un cambio mecánico: si el ejecutor ve
   algo para mejorar en una acción, **lo anota como hallazgo y no lo toca**.

Las «Lectura» y las «Exenta» **no se tocan.**

### Paso 4 — Tests

**El test que cierra el agujero** (`actionPolicy.test.ts`), en dos mitades:

1. **Completitud.** Para cada archivo del registro: `import * as modulo from …` y comparar las funciones exportadas
   con las claves del registro. **Sobra o falta una → rojo**, con el nombre en el mensaje. Es lo que hace
   *fail-closed*: la próxima acción de escritura que alguien agregue sin clasificar rompe el build de la compuerta.
   Un archivo `"use server"` nuevo que no esté en el registro también tiene que romper: listar
   `src/features/*/actions/*.ts` (sin `.test`) y exigir que cada uno esté.
2. **Efecto.** `it.each` sobre las 31 de «escritura»: con `getServerSession` mockeado para devolver una sesión de
   un **`viewer` real** (usuario y membresía en la base), invocar cada acción **con argumentos vacíos** y esperar
   `fail( ERROR_SIN_PERMISO_DE_ESCRITURA )`. Después, comprobar que **ninguna tabla cambió** (conteo de
   `ledger_transactions`, `accounts`, `categories`, `contacts`, `cards`, `loans`, `subscriptions` igual que antes).
   **AC-19.**

**`authorizationService.test.ts`:**
- `owner` y `member` → `ok`; `viewer` → `fail` con el texto exacto; sin membresía → `fail` de sesión inválida;
  sin sesión → `fail`.
- **AC-20:** token con `role: "member"` y membresía en la base `viewer` → rechazada. (El token miente, la base manda.)
- Un usuario `viewer` en una organización y `owner` en otra: con sesión activa en la primera se rechaza y con la
  segunda se acepta (**AC-21**, mitad servidor).

**Las 8 suites de acciones existentes.** Hoy mockean `getServerSession` con un usuario y una organización y siguen
funcionando porque nadie consulta la base. Con la guarda **necesitan una membresía real**: usar
`crearUsuarioConMembresia` (plan 2, `testFixtures.ts`) con rol `member`. Es edición mecánica de los `beforeEach`.
**Tests que prueban una organización «huérfana»** (`accountingActions.test.ts:36,60`, que esperan el mensaje amigable
del `23503`): con la guarda, una organización inexistente ya no tiene membresía y **se rechaza antes**. Reescribirlos
para esperar el mensaje de sesión inválida **y dejar la rama del `23503` intacta como red de seguridad ante una
carrera** (organización borrada entre la guarda y el insert). Reportarlo como hallazgo: esa rama queda sin test.

**Componentes:** con `puedeEscribir = false` en el provider, `AccountsContainer`, `TransactionsContainer`,
`SubscriptionsContainer` (con su bandeja de recurrencias) y `CategoriesSettingsContainer` **no renderizan ningún botón
de alta, edición, reversa, archivado ni confirmación**. Con `true`, los de hoy. (Siguiendo
`testing_de_componentes_cliente`: provider real y diccionario real.)

### Paso 5 — La interfaz

**Provider:** `PermissionsProvider` con `puedeEscribir: boolean`, y `usePuedeEscribir()`. **Por omisión `false`**
(fail-closed también acá: un componente fuera del provider no muestra acciones). El layout `(main)` lo calcula del
**rol de la organización activa que ya leyó** del plan 4 (`organizaciones.find( activa ).rol !== "viewer"`) y se lo
pasa al `AppShell`, que lo provee. **No agrega consultas.**

**Qué ocultar y cómo encontrarlo** (la lista tiene que salir de un barrido, no de la memoria):
```bash
grep -rln "Action\b\|Action\"\|Modal\|Form" src/features/*/components/*.tsx | grep -v '\.test\.'
grep -rn "actions=" "src/app/[lang]/(main)" --include='page.tsx'
```
Las áreas que ya se sabe que tienen escritura: `/accounts` (alta de cuenta y de entidad), `/cards` (alta, archivo,
planes de cuotas y la bandeja `PendingInstallmentsInbox`), `/loans` (alta, pago y `PendingLoanSettlementsInbox`),
`/contacts` (alta, edición, archivo, métodos de pago), `/subscriptions` (alta, edición, borrado y
`PendingOccurrencesInbox`), `/transactions` (alta, edición de metadatos, reversa, borrado) y `/settings` (categorías).
Además, **los botones que las páginas pasan al `PageHeader` por `actions`**.
**Se OCULTAN, no se deshabilitan** (RN-22). Una bandeja de recurrencias para un `viewer` muestra lo propuesto como lista,
sin «Confirmar» ni «Descartar».

**Selector:** `OrganizationSwitcher` muestra «Sólo lectura» junto al nombre de la organización cuando el rol de esa
organización es `viewer` (RN-27), tanto en el botón como en la lista.

**i18n:** los tres diccionarios, a la vez: `organizations.readOnlyBadge`, y el texto del error si se quiere mostrar en
la interfaz. **Estilo** (`.agents/AGENTS.md` §4): CSS Modules con tokens, **sin movimiento ni cambio de dimensiones
en `:hover`**.

---

## 5. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -rn "getServerSession" src/features/*/actions/*.ts | grep -v '\.test\.' | wc -l   # anotar ANTES y DESPUÉS
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "obtenerCuentaPorMoneda" src --include='*.ts' --include='*.tsx'   # sólo accountResolver, transactionsActions (import) y los tests
git diff --stat
```

**Checklist manual** (con dos cuentas de Google, una `owner` y la otra invitada como `viewer`):
1. El `owner` invita a la segunda con rol «Sólo lectura» (plan 4).
2. La segunda entra y **recorre todas las rutas**: dashboard, `/accounts`, `/transactions`, `/cards`, `/loans`,
   `/contacts`, `/subscriptions`, `/settings`. **En ninguna hay un botón de alta, edición, reversa, archivado ni
   confirmación** (AC-18). Anotar ruta por ruta.
3. En `/settings` no hay pestaña Miembros (AC-22).
4. El dashboard carga aunque falten resúmenes (AC-23).
5. El selector dice «Sólo lectura» junto al nombre (RN-27).
6. Desde la consola del navegador, invocar una acción de escritura con la sesión del `viewer`: responde «No tenés
   permiso para modificar esta organización» (AC-19). *(Si no se sabe cómo, alcanza con el test del Paso 4; reportarlo.)*
7. El `owner` crea otra organización «Estudio» y ve **todas** las acciones en ella; el `viewer` de «Casa» sigue sin
   verlas en «Casa» (AC-21).

---

## 6. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Cambiar de rol a un miembro | RN-26: se quita y se reinvita |
| Deshabilitar botones en vez de ocultarlos | RN-22 |
| Cachear el rol | RN-24: se lee de la base en cada escritura, y es una consulta |
| Una guarda para las lecturas | Un `viewer` lee todo |
| Tocar las acciones de miembros del plan 4, `updateProfileAction` ni `rellenarResumenesMensualesAction` | Exentas (§3) |
| Arreglar nada «de paso» en las 31 acciones | Hallazgo, no cambio |

## 7. Reportá

Los **hallazgos** en lista aparte. Ya se sabe que van **dos**: **(a)** la rama del `23503` quedó sin test (Paso 4);
**(b)** cualquier botón de escritura que el barrido del Paso 5 encuentre y la lista de áreas no nombraba. Y el
**resultado del checklist ruta por ruta**.
