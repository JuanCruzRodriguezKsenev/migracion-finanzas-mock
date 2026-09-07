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
*   **`createFinancialEntityAction` crea la entidad Y una cuenta propia** (`Cuenta Principal <nombre>`,
    tipo `asset`, `accountingActions.ts:158-190`). No es un "crear entidad" puro. Como
    `PaymentMethodsPanel.tsx:415` reusa `CreateFinancialEntityForm` sin variante, dar de alta una
    entidad para el método de cobro de un contacto **crea una cuenta de activo del usuario en un banco
    donde no opera**. Peor: el form expone "Saldo Inicial" también ahí, y `accountRepository.create`
    (`:87`) es un insert pelado sin asiento — un saldo > 0 **viola Debe = Haber**. `entityId` tiene
    `onDelete: "restrict"`, así que limpiar exige borrar antes la cuenta espuria.
    Documentado en `TECHNICAL_DEBT.md` § Abierto desde 2026-09-07.
*   **`financial_entities.logo` hace dos trabajos**: guarda un dominio de marca o un nombre de ícono, y
    `InstitutionLogo` los desambigua olfateando strings. En el formulario de entidad, el `FormSelect`
    de ícono no tiene el guard `!isBrandFromApi` y **pisa el dominio en silencio**.
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
*   Aislamiento multi-tenant en tablas hijas: `contact_payment_methods` cuelga de `contact_id`, así que
    la DAL **joinea contra `contacts`** para filtrar por organización. Ver `contactsRepository.ts`.

## Decisiones tomadas

*   **Cotizaciones (RFC 015, registrado en `DRAFT`):** los cierres mensuales persisten su cotización en
    una tabla `exchange_rates`; los saldos vivos usan cotización del día cacheada. Escala fija
    `RATE_SCALE = 1_000_000`, `rateDate` como `date`, sin columna de organización. Las **transacciones
    de cambio no almacenan cotización**: se deduce del cociente (`patterns.md:38`).
*   **Nada de `kind` en `financial_entities`.** La especie (banco/billetera/tarjeta) es del instrumento,
    no de la institución: una marca emite varios. Ya vive en `contact_payment_methods.type`.

## Cómo arranca `obra`

*   **`obra` exige árbol limpio y tiene prohibido cambiar de rama.** La preparación del entorno es
    trabajo de `tanda`, **antes** de pasarle el plan: commitear la ronda de planificación, crear la
    rama de la ronda (`git checkout -b`) y dejar `trabajo-en-vuelo.md` ya sincronizado y commiteado.
    Si se le pasa el plan con el árbol sucio, devuelve un informe de factibilidad y no toca nada
    — verificado el 2026-09-07, funciona como se esperaba.

## Estado

*   Rama `fix/entidades-financieras`, limpia, sale de `chore/gobernanza-reglas-neutrales`.
    **`obra` está ejecutando `docs/planes/fix-entidades-financieras.md`.**
*   **Tres ramas encadenadas pendientes de merge a master, en este orden**:
    `feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`.
    `master` no recibió ninguna. 298 tests al empezar la ronda.
*   **La Fase 1 NO está cerrada.** RFC 006 entregado; falta el **RFC 015 (perfil, preferencias y
    consolidación multimoneda)**, único RFC en `DRAFT` de los 21 y único bloqueo formal. Verificado
    archivo por archivo, no de memoria. No hay una sola línea de consolidación en `src/`
    (`grep exchange_rate|baseCurrency|consolidat` → cero).
*   **Tarjetas (007) es Fase 2 y Metas (011) es Fase 3.** `trabajo-en-vuelo.md` proponía cualquiera de
    las dos como próximo módulo, contra el artifact; corregido el 2026-09-07. Metas en fase temprana
    es justo el error que el artifact le señala al `ROADMAP.md` viejo.
*   **El artifact ya está sincronizado** (2026-09-07): 18 ítems pendientes, 5 de 17 rutas, 298 tests,
    RFC 015 como único DRAFT, Fase 0 completa y estado por fase. Tiene vocabulario de estado nuevo
    (`.ph-status`, filas `.done` con ✓). Releerlo con `action: "read"` antes de volver a editarlo.
*   Pendientes propios: evaluar `model: sonnet` en `verificador`; revisar duplicación entre
    `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.
