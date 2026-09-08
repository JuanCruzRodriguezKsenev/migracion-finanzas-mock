# Memoria de `tanda` — FinanzIA

Lo aprendido en rondas anteriores. Consultar antes de investigar de cero; actualizar al cerrar cada ronda.

## Trampas del repo

*   **`pnpm build` no tipa los tests.** Build verde + tests verdes convivieron con 7 errores de
    `tsc --noEmit` (fixtures de `Account` sin las columnas nuevas). Es lo que rompe la compuerta CI.
*   **Agregar una columna a una tabla rompe fixtures de tests de otras features.** `cbu_cvu` y `alias`
    en `accounts` rompieron `accountCodes.test.ts`, `dashboardMetrics.test.ts` y `derivarTipo.test.ts`.
    Siempre listar quién construye el tipo antes de tocarlo.
*   **Los RFCs viejos (junio 2026) traen esquemas anteriores al core contable.** El RFC 006 redefinía
    `accounts` con `balance: integer` y sin `entityId`. Antes de implementar un RFC viejo, contrastar
    su esquema contra `src/features/*/schema.db.ts`.
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

*   **Cotizaciones (RFC 015, registrado en `DRAFT`):** los cierres mensuales persisten su cotización en
    una tabla `exchange_rates`; los saldos vivos usan cotización del día cacheada. Escala fija
    `RATE_SCALE = 1_000_000`, `rateDate` como `date`, sin columna de organización. Las **transacciones
    de cambio no almacenan cotización**: se deduce del cociente (`patterns.md:38`).
*   **Nada de `kind` en `financial_entities`.** La especie (banco/billetera/tarjeta) es del instrumento,
    no de la institución: una marca emite varios. Ya vive en `contact_payment_methods.type`.

## Cómo consultarle al usuario

*   **El mapa completo primero, la decisión después.** No pongas un `AskUserQuestion` arriba de la
    mesa hasta que el usuario tenga claro qué hay hoy y dónde está el hueco. El 2026-09-07 `forja` le
    disparó una consulta con cuatro opciones antes de explicar el ciclo completo y lo cortó en seco
    (*"para para y entonces a `verificador` cuando lo uso?"*): le faltaba una pieza y no podía elegir
    sobre un mapa incompleto. Contestada esa pregunta, decidió todo en un mensaje.
    El orden es *qué hay → cómo funciona → dónde está el hueco → recién ahí, qué hacemos*.
*   **Cuando corta con "pará", no reinsistas con la pregunta:** contestá lo que preguntó y recién
    después volvé.

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

## Estado

*   Rama `fix/entidades-financieras`, **plan ejecutado y verificado de forma independiente el
    2026-09-07**: 39 archivos de test, 305 tests, lint 0, `tsc --noEmit` 0 errores, build verde.
    Los cuatro corridos por `verificador`, con el typecheck como comando propio.
*   **`verificador` ya corre en `model: sonnet`**, declarado en `~/.claude/agents/verificador.md`.
    El pendiente de evaluarlo está cerrado; `trabajo-en-vuelo.md` todavía lo lista como abierto.
*   Pendiente propio: revisar duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.
*   **Tres ramas encadenadas pendientes de merge a master, en este orden**:
    `feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`.
    `master` no recibió ninguna.
*   **La Fase 1 NO está cerrada.** Falta el **RFC 015 (perfil, preferencias y consolidación
    multimoneda)**, único RFC en `DRAFT` de los 21 y único bloqueo formal. No hay una sola línea de
    consolidación en `src/`.
*   **Tarjetas (007) es Fase 2 y Metas (011) es Fase 3.** Metas en fase temprana es justo el error que
    el artifact le señala al `ROADMAP.md` viejo.
*   **El artifact está sincronizado al 2026-09-07** (18 ítems pendientes, 5 de 17 rutas, Fase 0
    completa). Los números de tests quedaron en 298 y hoy son 305. Releerlo con `action: "read"`
    antes de volver a editarlo.
