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
    La deuda pasó a `TECHNICAL_DEBT.md` § Resuelto. Queda viva sólo la basura de datos: entidad `kk`
    con su `Cuenta Principal kk` (`1.1.01.03`, 3 centavos, 0 movimientos) en la base local; borrarla
    exige sacar antes la cuenta, por el `onDelete: "restrict"` de `entityId`.
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
*   Aislamiento multi-tenant en tablas hijas: `contact_payment_methods` cuelga de `contact_id`, así que
    la DAL **joinea contra `contacts`** para filtrar por organización. Ver `contactsRepository.ts`.

## Decisiones tomadas

*   [Rediseño de clasificación y propuestas](decisiones_modelo_clasificacion.md) — sesión **cerrada**: categoría = cuenta contable, propuestas fuera del libro, navegación por instrumento. Faltan las propuestas.
*   [RFC 022 — clasificación unificada, ya implementado](rfc022_clasificacion_unificada.md) — hoja `General` (.99), resolución padre→hoja, cascada de archivado, y los cabos que dejó.
*   [Cómo levantar los repos hermanos](repos_hermanos_como_levantarlos.md) — FinanzasMock está atado a Neon: sin base, con bypass de login. Y qué hay adentro de cada uno.
*   **`/accounts` es el directorio por entidad** (decidido 2026-09-09): se entra por Galicia y se ven
    sus cuentas, sus tarjetas y sus préstamos. `/cards`, `/debts` y patrimonio (propiedades, autos)
    van aparte; el Patrimonio Neto se muda a la página de estadísticas, junto con las categorías.

*   **Cotizaciones (RFC 015, registrado en `DRAFT`):** los cierres mensuales persisten su cotización en
    una tabla `exchange_rates`; los saldos vivos usan cotización del día cacheada. Escala fija
    `RATE_SCALE = 1_000_000`, `rateDate` como `date`, sin columna de organización. Las **transacciones
    de cambio no almacenan cotización**: se deduce del cociente (`patterns.md:38`).
*   **Nada de `kind` en `financial_entities`.** La especie (banco/billetera/tarjeta) es del instrumento,
    no de la institución: una marca emite varios. Ya vive en `contact_payment_methods.type`.

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

*   **RFC 022 implementado en dos tajadas y verificado el 2026-09-09.** Rama
    `feat/gestion-categorias` en `a71d439`, árbol limpio, **51 archivos de test, 375 tests, lint 0,
    `tsc --noEmit` 0, build verde**, esquema real contrastado contra la base. Sin consolidar todavía:
    `master` está en `2d7ac63` y es ancestro, así que el merge es fast-forward de 4 commits.
    Detalle y cabos sueltos en [[rfc022-clasificacion-unificada]].
*   **Ramas vivas:** `feat/tarjetas` (ya contenida en `master`, se puede borrar) y
    `feat/clasificacion-unificada` (ancestro de `feat/gestion-categorias`, se borra con la
    consolidación).
*   **La sesión de diseño de septiembre está agotada en su parte de clasificación**: el §3 y el §4
    bajaron al RFC 022 y ya son código. Sigue sin propuesta lo demás del §7 de
    `docs/diseno/rediseno-clasificacion-y-propuestas.md`. Ver [[decisiones-modelo-clasificacion]].
*   **Enmienda al RFC 015 (2026-09-09): no hay ruta `/profile`.** El perfil pasa a ser otra pestaña de
    `/settings`, que ya existe con sus pestañas Perfil, Preferencias y Seguridad deshabilitadas.
*   **El inventario de `trabajo-en-vuelo.md` estaba incompleto**: decía 17 dominios y listaba 12.
    Faltaban `/reportes` (la página de estadísticas), `/patrimonio`, `/configuracion` y
    `/mejorar-plan`. Corregido el 2026-09-09.
*   **Convención asentada:** los segmentos de ruta van en inglés (`ARCHITECTURE.md` §4). Existía de
    hecho y no estaba escrita; el artifact y el inventario prometían los nombres en español del mock.
*   **El artifact de la hoja de ruta quedó desactualizado** desde el merge de tarjetas: dice 321 tests
    (hoy 375), da tarjetas por pendiente en la Fase 2 y en el grafo, dice `/tarjetas` donde el repo
    tiene `/cards`, no conoce `/settings` ni el RFC 022, y se contradice solo en el total de ítems
    (18 / 23 / 24).
