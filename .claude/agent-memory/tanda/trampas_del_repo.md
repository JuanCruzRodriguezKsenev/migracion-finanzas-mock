---
name: trampas-del-repo
description: Trampas de FinanzIA que ya costaron una ronda — verificación, migraciones, RFCs viejos, signo de pasivos, código muerto. Leer antes de planificar.
metadata:
  type: project
---

# Trampas del repo

Cada una costó una ronda. Ver también [[entorno-postgres-caido]] y [[verificacion-no-tocar-el-arbol]].

## Verificación

*   **`pnpm lint` ya está alineado** a `eslint . --max-warnings 0`, idéntico a `compuerta.yml:66`
    (era `eslint` a secas y salía verde con 75 warnings que tumbaban CI, 2026-09-10). **Si algún día
    vuelven a divergir, la compuerta manda**: corré su comando, no el script.
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
*   **Los pasivos se guardan en negativo.** La deuda exigible es `-balance`, con `deudaDe()`; nunca
    el signo a mano. El defecto de `AccountsContainer` **ya está corregido** (`51f1a50`, tanda 1 del
    RFC 024): hoy `netWorth = totalAssets + totalLiabs` con el comentario que remite a `patterns.md`
    §8 para que no lo "arreglen" al revés. Verificado 2026-09-11. **Lo que sigue abierto es que
    `monthly_summaries.liabilitiesSnapshot` usa el signo opuesto** (`TECHNICAL_DEBT.md` §6).
*   **La sparkline de balance del dashboard grafica dos magnitudes distintas en la misma línea.**
    `calcularSparklineBalance()` (`dashboardMetrics.ts:94-120`) arma el histórico con
    `monthly_summaries.balanceSnapshot` —que el seed calcula con pasivos en **positivo**— y le pega
    como último punto `calcularBalanceTotal()`, que filtra **sólo `type === "asset"`**. Vive en
    `app/[lang]/(main)/page.tsx:145-148`, no en `/accounts`: el §9 del RFC 024 lo trata como tema de
    la futura pantalla de estadísticas, pero el consumidor está **vivo en el home**. Verificado
    2026-09-11.

## Documentos y RFCs

*   **Los RFC 008 y 010 están `APPROVED`, no en borrador** (ambos `2026-06-23`). Como la regla dura
    es «código sólo contra `APPROVED`», hoy autorizan formalmente a implementar el esquema
    equivocado. Reescribirlos/enmendarlos es lo que desarma la trampa. La enmienda al RFC 004 que
    pedía el §7 del diseño **ya está hecha** (`004-subscriptions-management.md:123`, revocada por el
    RFC 023): quedan tres propuestas, no cuatro. Verificado 2026-09-11.
*   **Un RFC `APPROVED` también puede prometer algo que no existe.** El **RFC 007** (reaprobado el
    2026-09-08) calcula el disponible de la tarjeta restando `installmentPlans`
    (`007-cards-management.md:319`), una tabla que no está en el esquema ni en ningún otro RFC. Y su
    fórmula del §321 resta `facturado + enCurso` en vez de la deuda total, así que **sobrestima el
    disponible**; el código de `CardVisual.tsx:40` ya se había apartado de ella, para mejor. Verificado
    2026-09-11. **Antes de implementar una fórmula de un RFC aprobado, mirá qué hace el código.**
*   **Los RFCs viejos (junio 2026) traen esquemas anteriores al core contable.** Ya pasó con el 006,
    el 015, el **008** (`integer` para dinero + `remainingBalance` que duplica `accounts.balance`) y
    el **010** (siete columnas monetarias en `integer`). Contrastar contra `src/features/*/schema.db.ts`.
*   **Antes de decir "esto no tiene RFC", mirar `docs/proposals/`.** Afirmé que patrimonio no tenía
    propuesta: el **RFC 010 existe y está `APPROVED` desde junio**. Son 21 RFCs con nombres en inglés
    — "patrimonio" se busca como `wealth`.
*   **`revalidatePath` va contra la estructura de archivos, no contra la URL.** La doc de Next 16 lo
    ejemplifica con el grupo adentro. El patrón literal con `[lang]` es el correcto: no resolver el
    locale ni mandar `/es/cards`.

*   **`CardVisual` suma pesos con dólares.** `CardVisual.tsx:34` acumula `deudaDe()` de **todas** las
    filas de `card_accounts` —una por divisa— en un solo número y lo rotula con
    `card.accounts[0].currency`. El `disponible` (`:40`) y la barra de consumo (`:42`) heredan el
    error. Es el mismo defecto que la sparkline: dos magnitudes en el mismo número. Arreglarlo pide
    decidir antes qué divisa tiene `cards.creditLimit`, que hoy no declara ninguna. Verificado
    2026-09-11, en `TECHNICAL_DEBT.md` §9.

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

## Fechas: dos trampas que ya se pagaron (2026-09-11)

*   **Cadena vacía como centinela de fecha = `RangeError` en el render.** La tanda 1 del RFC 025 dejó
    `calcularCicloDeTarjeta()` devolviendo `cierreAnterior/cierreActual/vencimiento` como `""` cuando
    la tarjeta de crédito no tiene `closingDay` (`cardCycleService.ts:52-59`), con el tipo declarando
    `string`. Nadie queda obligado a mirar: `CardVisual.tsx:104` pregunta por el objeto, entra igual,
    y `new Date( "" )` → `Intl.DateTimeFormat.format()` **lanza `RangeError: Invalid time value` y
    tumba el componente cliente.** La regla: un campo que puede faltar se declara `string | null`, y
    el arreglo se hace en el tipo para que `tsc --noEmit` señale a cada consumidor — no con una guarda
    en el consumidor, que es lo que el hallazgo proponía.
*   **`new Date( "2026-09-20" )` es medianoche UTC, o sea el día 19 en Buenos Aires.** Todo lo que
    salga de un `<input type="date">` y vaya a una función que descompone por zona IANA
    (`descomponerFechaEnZona`, `proponerPrimeraCuota`) tiene que construirse como
    `new Date( Date.UTC( y , m-1 , d , 12 , 0 , 0 ) )`. Es el mediodía que ya usa
    `formatearFechaCivil()` en `PendingOccurrencesInbox.tsx:45`, y por la misma razón. Sin eso, una
    compra hecha **exactamente** el día de cierre propone el mes equivocado.

## Cosas que son puras aunque vivan en `services/`

`installmentService.ts`, `recurrenceService.ts` y `ciclo.ts` **no tienen `server-only`** y no importan
`db`: un componente cliente los importa directo. Ya hay precedente —`PendingOccurrencesInbox.tsx`
importa `PendienteRecurrencia` de `recurrenceService`—, así que no hace falta inventar una server
action para llamar a una función de cálculo. **Verificarlo con `grep -n "server-only"` antes de
suponerlo en cualquier dirección.**
