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
    tipo `asset`). No es un "crear entidad" puro. Reusar `CreateFinancialEntityForm` desde contactos
    introdujo un bug por esto.
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

*   Rama `feat/contacts-management`, 3 commits. Fase 0 cerrada (4 commits). 298 tests.
*   Pendiente sin commitear: fixtures de `Account` en 3 archivos de test.
*   Próximo: plan de corrección de entidades (partir la acción, partir `logo`, limpiar `kk`).
