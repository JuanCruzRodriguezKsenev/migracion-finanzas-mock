---
name: trampas-del-repo
description: Trampas de FinanzIA que ya costaron una ronda — verificación, migraciones, RFCs viejos, signo de pasivos, código muerto. Leer antes de planificar.
metadata:
  type: project
---

# Trampas del repo

Cada una costó una ronda. Ver también [[entorno-postgres-caido]] y [[verificacion-no-tocar-el-arbol]].

## Verificación

*   **`pnpm lint` NO era lo que corre la compuerta** (`eslint` a secas, verde con warnings), contra
    `pnpm exec eslint . --max-warnings 0` de `compuerta.yml:66`. El 2026-09-10 se reportó «lint 0» con
    75 warnings que tumbaban CI. **En vuelo el plan que alinea el script**; hasta que se ejecute y se
    confirme, corré el comando de la compuerta.
*   **`pnpm build` no tipa los tests.** Build verde + tests verdes convivieron con 7 errores de
    `tsc --noEmit` (fixtures de `Account` sin las columnas nuevas). Es lo que rompe la compuerta.
*   **Sacar código de muchos archivos deja imports huérfanos invisibles.** Pasar a `limpiarBase()`
    dejó 75 símbolos sin usar en 18 tests: `tsc --noEmit` **no** los marca y `eslint --fix` **no** los
    arregla (`no-unused-vars` no es autofixable).

## Modelado y migraciones

*   **Agregar una columna rompe fixtures de tests de otras features.** `cbu_cvu` y `alias` en
    `accounts` rompieron `accountCodes.test.ts`, `dashboardMetrics.test.ts` y `derivarTipo.test.ts`.
    Listar siempre quién construye el tipo antes de tocarlo.
*   **La limpieza entre suites es `limpiarBase()`** (`src/shared/db/testCleanup.ts`), orden topológico
    en transacción única, consumida por las 18 suites. **Toda tabla nueva con FK va agregada ahí**, en
    su lugar del orden. El grafo que importa son las siete FK `restrict`; **no lo recalcules, está en
    el archivo**. Ojo con `categories.parentId`, `restrict` contra sí misma: hojas primero.
*   **Los pasivos se guardan en negativo y `/accounts` no lo respeta:** `AccountsContainer.tsx:87-88`
    hace `totalAssets - totalLiabs` sobre un total ya negativo — **suma la deuda al patrimonio**. Y
    `monthly_summaries.liabilitiesSnapshot` usa el signo opuesto. `TECHNICAL_DEBT.md` §6.

## Documentos y RFCs

*   **Los RFCs viejos (junio 2026) traen esquemas anteriores al core contable.** Ya pasó con el 006,
    el 015, el **008** (`integer` para dinero + `remainingBalance` que duplica `accounts.balance`) y
    el **010** (siete columnas monetarias en `integer`). Contrastar contra `src/features/*/schema.db.ts`.
*   **Antes de decir "esto no tiene RFC", mirar `docs/proposals/`.** Afirmé que patrimonio no tenía
    propuesta: el **RFC 010 existe y está `APPROVED` desde junio**. Son 21 RFCs con nombres en inglés
    — "patrimonio" se busca como `wealth`.
*   **`revalidatePath` va contra la estructura de archivos, no contra la URL.** La doc de Next 16 lo
    ejemplifica con el grupo adentro. El patrón literal con `[lang]` es el correcto: no resolver el
    locale ni mandar `/es/cards`.

## Código que existe pero no hace lo que dicen los docs

*   **`CircuitBreaker` (`shared/lib/circuitBreaker.ts`) no está cableado en ningún lado**: sólo lo
    importa su propio test. La "protección de Brandfetch" que dicen los docs no existe.
*   **La búsqueda de marcas está duplicada en tres componentes** que pegan directo a
    `api.brandfetch.io` desde el navegador (`CreateFinancialEntityForm`, `AddSubscriptionModal`,
    `InstitutionLogo`). `/api/brand` sólo sirve metadata, no búsqueda.
*   **`InstitutionLogo` tiene 4 consumidores y sólo 3 recibieron `brandDomain`**: falta
    `TransactionsTable.tsx:188-192`. Degrada a búsqueda por nombre, no rompe. Es el archivo que el
    plan no nombró.
*   **`createAccountForEntityAction` fija `currency: "ARS"` en duro** (`accountingActions.ts`), en un
    motor que valida Debe = Haber por divisa. `createFinancialEntityAction` ya es alta pura
    (`2ebc37e`): la cuenta se crea aparte y ante saldo inicial > 0 emite asiento contra Patrimonio
    (`3.1.01.01`, fallback al primer `type === "equity"`).
