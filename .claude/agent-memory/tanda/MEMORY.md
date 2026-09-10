# Memoria de `tanda` — FinanzIA

Lo aprendido en rondas anteriores. Consultar antes de investigar de cero; actualizar al cerrar cada ronda.

## Trampas del repo

*   [Postgres caído se disfraza de bug](entorno_postgres_caido.md) — `AggregateError` + 401 en login, o suite roja, suele ser `postgres-dev` apagado. Chequearlo primero.
*   **`pnpm build` no tipa los tests.** Build verde + tests verdes convivieron con 7 errores de
    `tsc --noEmit` (fixtures de `Account` sin las columnas nuevas). Es lo que rompe la compuerta CI.
*   **Agregar una columna a una tabla rompe fixtures de tests de otras features.** `cbu_cvu` y `alias`
    en `accounts` rompieron `accountCodes.test.ts`, `dashboardMetrics.test.ts` y `derivarTipo.test.ts`.
    Siempre listar quién construye el tipo antes de tocarlo.
*   **Los RFCs viejos (junio 2026) traen esquemas anteriores al core contable.** Ya pasó con el 006,
    el 015, el **008** (`integer` para dinero + un `remainingBalance` que duplica `accounts.balance`)
    y el **010** (siete columnas monetarias en `integer`). Antes de implementar un RFC viejo,
    contrastar su esquema contra `src/features/*/schema.db.ts`.
*   **Antes de decir "esto no tiene RFC", mirar `docs/proposals/`.** El 2026-09-09 afirmé que
    patrimonio (propiedades, autos) no tenía propuesta: **el RFC 010 existe, está `APPROVED` desde
    junio** y cubre inmuebles, vehículos, valuaciones, inquilinos e incidencias. Son 21 RFCs y los
    nombres de archivo están en inglés, así que "patrimonio" se busca como `wealth`.
*   **`createFinancialEntityAction` ya es alta pura** (corregido en `2ebc37e`, rama
    `fix/entidades-financieras`). La cuenta se crea aparte con `createAccountForEntityAction`, que
    ante saldo inicial > 0 emite asiento contra Patrimonio (`3.1.01.01`, con fallback al primer
    `type === "equity"`) y **verifica que esa cuenta exista antes de crear nada**. El formulario tomó
    una prop `withOwnAccount` (default `true`); `PaymentMethodsPanel` la pasa en `false`.
*   **La cuenta que crea `createAccountForEntityAction` fija `currency: "ARS"` hardcodeado**
    (`accountingActions.ts`), en un proyecto que ya valida Debe = Haber por divisa. Una entidad que
    opera en otra moneda igual recibe cuenta en pesos.
*   **`financial_entities` ya tiene `brand_domain`** (`varchar(100)`, migración `0020_soft_fixer.sql`,
    con backfill de los dominios que vivían en `logo`). `logo` queda como nombre de ícono de respaldo,
    y el `FormSelect` de ícono está envuelto en `{!isBrandFromApi}` para no pisar el dominio.
    **`InstitutionLogo` tiene 4 consumidores y sólo 3 recibieron la prop `brandDomain` nueva**:
    `AccountsContainer:254`, `PaymentMethodsPanel:211` y `ContactsTable:104` sí;
    `TransactionsTable.tsx:188-192` **no** — sigue pasando `logoUrl={entity?.logo}`, que ahora recibe
    un nombre de ícono y ya no resuelve la marca directo. Degrada a búsqueda por nombre, no rompe.
    Es el archivo que el plan no nombró: exactamente el patrón de defecto de este repo.
*   **Los pasivos se guardan en negativo, y `/accounts` no respeta esa convención.**
    `accountingService.ts:117` trata `liability` igual que `asset` (aumenta con el Debe), así que un
    consumo de tarjeta deja la cuenta en negativo; `accountingActions.ts:99` y `CardVisual.tsx:34`
    lo respetan. **`AccountsContainer.tsx:87-88` hace `totalAssets - totalLiabs` sobre un total ya
    negativo y suma la deuda al patrimonio.** Y `monthly_summaries.liabilitiesSnapshot` usa el signo
    **opuesto** (positivo), así que el número y su sparkline no hablan el mismo idioma. En
    `TECHNICAL_DEBT.md` §6.
*   **Las 14 suites de test limpian la base a mano, cada una con su propia lista de `db.delete()`.**
    Ninguna limpia al salir, así que el último test de cada archivo deja filas para el siguiente.
    Agregar un `DELETE` de una tabla padre sin sus hijas hace explotar a la suite que corra después,
    y parece intermitente porque vitest ordena por la duración de la corrida anterior. Ya produjo un
    defecto (`TECHNICAL_DEBT.md` §7). **Todo plan que agregue una tabla con FK tiene que nombrar qué
    suites la limpian.**
*   **La deuda de limpieza entre suites crece sola: de 14 a 18 suites en una tanda.** Toda tabla
    nueva con FK suma otra lista escrita a ojo. El grafo que importa son las siete FK `restrict`
    (`accounts→financial_entities`, `ledger_entries→accounts`, `category_accounts→categories|accounts`,
    `cards→financial_entities`, `card_accounts→accounts`, `contact_payment_methods→financial_entities`);
    las `cascade` y `set null` se resuelven solas. Hoy no explota **sólo porque cinco suites tienen
    `afterAll` que limpia al salir** — es contención por accidente. El orden topológico completo está
    escrito en `docs/planes/cabos-rfc023-y-limpieza-de-tests.md` §Paso 3: no lo recalcules.
*   **`categories.parentId` es una FK contra sí misma con `restrict`.** Un `DELETE` sin `WHERE` sobre
    toda la tabla evalúa la restricción fila por fila y puede intentar borrar un padre antes que su
    hija. Se borra hojas primero (`isNotNull(parentId)`) y después el resto.
*   **`CircuitBreaker` (`shared/lib/circuitBreaker.ts`) no está cableado en ningún lado**: sólo lo
    importa su propio test. La "protección de Brandfetch" que dicen los docs no existe.
*   **La búsqueda de marcas está duplicada en tres componentes** que van directo del navegador a
    `api.brandfetch.io`: `CreateFinancialEntityForm:138`, `AddSubscriptionModal:356`,
    `InstitutionLogo:92`. `/api/brand` (servidor, autenticado) sólo sirve metadata, no búsqueda.

## Patrones que ya existen y conviene reusar

*   `ledger_transactions` separa `merchant_name` de `merchant_domain`. Es el patrón correcto para
    marca + dominio; `financial_entities` es la única tabla que no lo sigue.
*   `shared/ui/` tiene `DataTable`, `SearchInput`, `Modal`, `Form`, `Autocomplete`, `InstitutionLogo`,
    `EmptyState`, `Tabs`, `Toolbar`. Casi ningún módulo nuevo necesita primitivas propias.
*   **Contrato del `Result` de `@/shared/lib/result`: el éxito trae `value`, no `data`**
    (`{ success: true, value: T }`). Nombrarlo en el plan ahorra un tropiezo por ronda.
*   **`createLedgerTransaction` exige `organizationId` explícito** en la cabecera: `ledger_transactions`
    tiene la FK de aislamiento no anulable. No lo deduce de la sesión quien lo llama.
*   **`accountRepository.findByIdForUpdate( id , orgId , tx )`** (`accountRepository.ts:51`) es el molde
    del `SELECT ... FOR UPDATE` del repo: `.for( "update" )`, `tx` obligatorio. Lo consume
    `accountingService.ts:67`. Cuando una guarda de concurrencia haga falta, se copia esto — no se
    inventa un mecanismo nuevo ni se agrega `idempotencyKeys` encima.
*   **`setupFiles` de vitest corre una vez por archivo de test** (`vitest.setup.dom.ts`), y
    `globalSetup` una sola vez para toda la suite (`src/shared/db/vitest.setup.ts`, crea la base y
    migra). Lo que tenga que pasar por archivo va en `setupFiles`.
*   Aislamiento multi-tenant en tablas hijas: `contact_payment_methods` cuelga de `contact_id`, así que
    la DAL **joinea contra `contacts`** para filtrar por organización. Ver `contactsRepository.ts`.

## Decisiones tomadas

*   [Rediseño de clasificación y propuestas](decisiones_modelo_clasificacion.md) — sesión **cerrada**: categoría = cuenta contable, propuestas fuera del libro, navegación por instrumento. Faltan las propuestas.
*   [RFC 022 — clasificación unificada, ya implementado](rfc022_clasificacion_unificada.md) — hoja `General` (.99), resolución padre→hoja, cascada de archivado, y los cabos que dejó.
*   [Cómo levantar los repos hermanos](repos_hermanos_como_levantarlos.md) — FinanzasMock está atado a Neon: sin base, con bypass de login. Y qué hay adentro de cada uno.
*   **`/accounts` es el directorio por entidad** (decidido 2026-09-09): se entra por Galicia y se ven
    sus cuentas, sus tarjetas y sus préstamos. `/cards`, `/debts` y patrimonio (propiedades, autos)
    van aparte; el Patrimonio Neto se muda a la página de estadísticas, junto con las categorías.

*   **Cotizaciones (RFC 015, `DRAFT`):** `exchange_rates` para los cierres, cotización del día cacheada
    para los saldos vivos, `RATE_SCALE = 1_000_000`, y las transacciones de cambio **no** guardan
    cotización: se deduce del cociente (`patterns.md:38`).
*   **Nada de `kind` en `financial_entities`.** La especie (banco/billetera/tarjeta) es del instrumento,
    no de la institución: una marca emite varios. Ya vive en `contact_payment_methods.type`.

## Cómo verificar

*   [Mientras corre `verificador`, el árbol no se toca](verificacion_no_tocar_el_arbol.md) — `pgrep` no prueba que terminó; sólo su notificación. Y cómo diagnosticar una suite "intermitente".

## Cómo consultarle al usuario

*   [Una pregunta por vez en diseño](feedback_una_pregunta_por_vez.md) — decisiones de arquitectura: una sola, con el impacto analizado antes.
*   **El mapa completo primero, la decisión después.** No pongas un `AskUserQuestion` arriba de la
    mesa hasta que el usuario tenga claro qué hay hoy y dónde está el hueco. El 2026-09-07 `forja` le
    disparó una consulta con cuatro opciones antes de explicar el ciclo completo y lo cortó en seco
    (*"para para y entonces a `verificador` cuando lo uso?"*): le faltaba una pieza y no podía elegir
    sobre un mapa incompleto. Contestada esa pregunta, decidió todo en un mensaje.
    El orden es *qué hay → cómo funciona → dónde está el hueco → recién ahí, qué hacemos*.
*   **Cuando corta con "pará", no reinsistas con la pregunta:** contestá lo que preguntó y recién
    después volvé.

## Preferencias de usuario (feature `profile`)

*   **`profiles` es una tabla aparte de `users`** y ya tiene todas las preferencias (`currency`,
    `timezone`, `theme`, `numberFormat`, `weeklyStart`, `dateFormat`, `roundAmounts`, …). Cuelga de
    `users.id`, sin `organizationId`: aislamiento transitivo, igual que `contact_payment_methods`.
*   **Guarda etiquetas de UI en español, no códigos**: `'Peso argentino (ARS)'`, `'(GMT-03:00) Buenos
    Aires'`, `'1.234,56'`, `'Lunes'`. Por eso **ninguna preferencia afecta a nada**: las 8 llamadas a
    `formatCurrency` pasan `"es-AR"` en duro porque `'1.234,56'` no es un locale que `Intl` resuelva.
*   **`formatCurrency( amount , currencyCode , locale )`** (`shared/lib/currencyFormatter.ts`) ya tiene
    la firma correcta y cachea decimales por divisa. **No hay que reescribirlo, sólo pasarle el
    locale.** Convive con `formatCents` (`accounting/utils/dashboardMetrics.ts`), más viejo y sin
    divisa ni locale, que `.agents/AGENTS.md` §8.2 todavía nombra como el canónico. Deuda anotada.
*   **`updateProfileAction` no valida nada**: recibe `Partial<ProfileData>` y lo pasa entero al
    repositorio. Como `profiles` incluye `planName`/`planBilling`/`planNextCharge`, un cliente puede
    mandar `{planName: "Premium"}` y cambiarse el plan comercial. La feature no tiene ni un test.
*   **No existe la ruta `/perfil`.** Los únicos productores del dato son el `default` del esquema,
    `seed.ts` (**dos** bloques, ~107 y ~127) y `DEFAULT_PROFILE` en `app/[lang]/layout.tsx`.
*   `SummaryBar.tsx` **no lleva `"use client"`**: es cliente por transitividad, porque lo importa
    `SubscriptionDashboard`. Recibe todo por props y debe seguir así.

## Cómo se cierra una rama en este repo

*   **La historia es estrictamente lineal: cero merge commits.** La convención es fast-forward, y las
    ramas se encadenan una sobre otra en vez de salir todas de `master`. Verificar con
    `git log --merges --oneline` (vacío) antes de proponer cualquier `--no-ff`.
*   **Consolidar ramas no es sólo mergear.** Se escribe `docs/registro/YYYY-MM-DD-<nombre>.md` con
    fecha de consolidación, rama base, **resultado global** (tests / lint / build) y detalle por tanda
    con su commit; y las secciones cerradas se podan de `trabajo-en-vuelo.md`, que sólo lleva lo vivo.
    Modelo a copiar: `docs/registro/2026-09-06-cierre-tandas-0-a-g.md`.

## Cómo arranca `obra`

*   **`obra` exige árbol limpio y tiene prohibido cambiar de rama.** La preparación del entorno es
    trabajo de `tanda`, **antes** de pasarle el plan: commitear la ronda de planificación, crear la
    rama de la ronda (`git checkout -b`) y dejar `trabajo-en-vuelo.md` ya sincronizado y commiteado.
    Si se le pasa el plan con el árbol sucio, devuelve un informe de factibilidad y no toca nada
    — verificado el 2026-09-07, funciona como se esperaba.

## Ideas aparcadas

*   [Página de proyecciones](idea_pagina_proyecciones.md) — por tendencia sobre recurrencias reales, ajustable por inflación. Sin discutir; idea del 2026-09-09.

## Qué salió bien y conviene repetir

*   **Un hueco del plan vuelve como defecto del código, y hay que decirlo así.** El plan del RFC 023
    decidió que «el puntero *es* la guarda, no hace falta `idempotencyKeys`» y `obra` lo implementó
    tal cual — pero la guarda quedó fuera de la transacción. El defecto es real y **no fue desvío de
    la ejecución**: lo dejó el plan. Reportarlo con esa atribución mantiene honesto el ciclo.

*   **El plan con "Lo que ya existe y NO hay que construir" en tabla funcionó.** El plan de la segunda
    tajada del RFC 022 listó las cinco acciones existentes con archivo y línea, y `obra` no reescribió
    ninguna. Vale la pena la tabla en todo plan que se apoye en trabajo de una tanda anterior.
*   **El estilo CSS ya no hace falta especificarlo.** `CategoriesSettingsContainer.module.css`: 468
    líneas, **0 colores crudos, 0 px fijos estructurales, 0 `:hover` con movimiento o cambio de
    dimensiones**. Dejar de gastar renglones del plan en esto.
*   **Los radios de impacto nombrados salieron limpios.** Los cuatro archivos del radio D se
    actualizaron; el grep posterior no encontró usos residuales de `subscriptions.category`. Lo que
    quedó suelto fue todo *no nombrado*: un tipo muerto, dos imports desde el repositorio y una prop
    sin usar. Sigue valiendo la regla: lo explícito sale bien, lo implícito es donde aparecen.

## Estado

*   **`feat/bandeja-recurrencias` (`dd7388d`) verificada en verde y SIN consolidar** (2026-09-10):
    53 archivos, 392 tests, lint 0, `tsc --noEmit` 0, build verde, **doble corrida con conteo
    idéntico**. Pasa la compuerta de CI. El merge a `master` lo decide el usuario; no lo hagas sola.
*   **Rama viva: `fix/cabos-rfc023-y-limpieza-de-tests`**, encadenada sobre ella, árbol limpio,
    con el plan `docs/planes/cabos-rfc023-y-limpieza-de-tests.md` listo para `obra` (commit `4ead5e2`).
    Cuatro pasos: guarda del puntero bajo bloqueo, backfill de frecuencias no mensuales,
    `limpiarBase()` en las 18 suites, y factory + mock de `next/cache` en `setupFiles`.
*   **RFC 022 consolidado el 2026-09-10**, `master` en `e3af72c`, pusheado (`08704ae`), CI remota en
    verde. Registro en `docs/registro/2026-09-10-cierre-rfc022.md`.
*   **Sobre la mesa después de esta ronda:** suscripciones al libro mayor (RFC 004), las propuestas
    que faltan del §7 del doc de diseño, la página de estadísticas (sin RFC), y el desvío de
    `cardsActions.ts` con `revalidatePath("/cards")` contra las otras siete llamadas del repo.
*   **Enmienda al RFC 015 (2026-09-09): no hay ruta `/profile`.** El perfil es otra pestaña de
    `/settings`.
*   **Convención asentada:** los segmentos de ruta van en inglés (`ARCHITECTURE.md` §4).
*   **El artifact de la hoja de ruta está al día** (2026-09-10, etiqueta *Cierre RFC 022*). **Releerlo
    entero con `action: "read"` antes de editarlo** — son 1211 líneas — y republicarlo con su `url`.
    No refleja todavía el RFC 023.
