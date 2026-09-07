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

## Estado

*   Rama `chore/gobernanza-reglas-neutrales` (sale de `feat/contacts-management`, no de master), limpia,
    **15 commits por delante de `master`**. Arrastra Tandas I/J/K, Fase 0, Bloque B y la gobernanza.
    `master` sigue sin recibir nada. 298 tests.
*   **Dos ramas pendientes de merge a master, en orden**: primero `feat/contacts-management`, después
    `chore/gobernanza-reglas-neutrales` (la segunda es descendiente de la primera).
*   Fase 1 del artifact: RFC 006 cerrado; **RFC 015 (perfil, preferencias y consolidación) es el único
    RFC en `DRAFT`** — falta que Juan Cruz lo apruebe antes de tocar código.
*   Próximo módulo del roadmap: Tarjetas `/cards` (RFC 007) o Metas `/goals` (RFC 011).
*   **Plan de corrección de entidades ESCRITO** en `docs/planes/fix-entidades-financieras.md`
    (2026-09-07), listo para `obra`. Decisiones del usuario: asiento de apertura contra `3.1.01.01`,
    diagnóstico SQL sin borrar datos, `brand_domain` como columna nueva, y `/accounts` mantiene el
    combo de un solo submit.
*   **El `kk` que esta memoria mencionaba no existe**: `grep -rn "\bkk\b" src/ docs/` da cero.
    Verificado el 2026-09-07; era una nota errónea.
*   Otros pendientes propios: estrenar `obra`; evaluar `model: sonnet` en `verificador`; revisar
    duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.
*   El artifact de la hoja de ruta trae datos viejos en el encabezado (rama `feat/transactions-management`,
    253 tests, RFC 019 en DRAFT, RFC 015 pintado APPROVED). Corregir cuando se lo edite.
