# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `fix/entidades-financieras` (sale de `chore/gobernanza-reglas-neutrales`). Ejecutó [`planes/fix-entidades-financieras.md`](planes/fix-entidades-financieras.md): partir el alta de entidades, asiento de apertura contra `3.1.01.01`, columna `brand_domain` y variante del formulario para el flujo de contactos.

**Ramas pendientes de merge, en este orden:** `feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`. Cada una es ancestro de la siguiente, y `master` todavía no recibió ninguna.

**Estado:** 🟢 **Corrección del alta de entidades financieras completada integralmente. `createFinancialEntityAction` desacoplada como alta pura a nivel organización sin creación de cuentas espurias. Nueva `createAccountForEntityAction` que garantiza partida doble emitiendo asiento contable contra Patrimonio Neto (`3.1.01.01`) ante saldos iniciales mayores a cero. Columna `brand_domain` (`varchar(100)`) añadida con migración `0020_soft_fixer.sql` y backfill de dominios históricos aplicado. `CreateFinancialEntityForm` adaptado con prop `withOwnAccount?: boolean` (`withOwnAccount={false}` en `PaymentMethodsPanel`) y protección de selector de iconos. `InstitutionLogo` refactorizado con soporte directo de `brandDomain`. Fixtures actualizados y suite de tests completa con 5 nuevas pruebas contables y multi-tenant.**

**Próximo paso de desarrollo:**
Mergear las tres ramas a master en el orden establecido (`feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`), resolver la limpieza de la entidad de diagnóstico `kk` si el usuario lo decide, y retomar la **Fase 1** con la aprobación y desarrollo del **RFC 015 — perfil, preferencias y consolidación multimoneda** (único RFC en `DRAFT`).

> **Corrección de rumbo (2026-09-07):** este documento venía proponiendo Tarjetas o Metas como próximo
> módulo, en contra del artifact. Metas en la primera fase es justamente el error que el artifact
> documenta del `ROADMAP.md` viejo.

**Pendiente de la gobernanza:** evaluar `model: sonnet` en `verificador`; y revisar la duplicación
entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.

**Estreno de `obra` (2026-09-07):** frenó como se esperaba. Ante el árbol sucio y sin permiso para
cambiar de rama, devolvió un informe de factibilidad en vez de improvisar. El protocolo de arranque
funciona; la preparación del entorno (commit de la planificación y creación de la rama) es trabajo
previo de `tanda`, no suyo.

---

## Estado al 2026-09-07

### Plan de punta a punta — FinanzIA

| Tanda | Rama | Estado | Foco principal |
| :--- | :--- | :---: | :--- |
| **Tanda 0** | `docs/gobernanza-base` | 🟢 **Cerrada** | `docs/trabajo-en-vuelo.md` y §8 en `.agents/AGENTS.md` (commit `36b0019`) |
| **Tanda A** | `fix/dashboard-correctitud` | 🟢 **Cerrada** | S1 ({value, monthKey}[]), S2 (ojito), S3 (pct 0.0%), M1 (hoy en server), A5 (summaryCache) (commit `2661f8e`) |
| **Tanda B** | `fix/dashboard-visual` | 🟢 **Cerrada** | S4 (overflow hero), S5 (cursor tema claro), S6 (formatCents), M7 (px fijos), S8 (flash) (commit `b41b0b3`) |
| **Tanda C** | `fix/dashboard-i18n-a11y` | 🟢 **Cerrada** | S7/M5 (i18n es/en/br), M5b (Intl labels), M6 (dialog a11y), M4 (todayKey), M8 (clases) (commit `12a9c5c`) |
| **Tanda D** | `feat/month-selector-limites`| 🟢 **Cerrada** | M2 (ocultar en accounts/subscriptions), M3 (minKey primer mes con datos) (commit `6e7bbe8`) |
| **Tanda E** | `fix/lint-set-state-in-effect`| 🟢 **Cerrada** | 4 errores ESLint resueltos (NotificationsContext, InstitutionLogo, CreateFinancialEntityForm) (commit `4cdb0ad`) |
| **Tanda F** | `feat/env-validado` | 🟢 **Cerrada** | `env.ts` con Zod (lazy `obtenerEnv`), eliminar fallback silencioso de `client.ts:15` (commit `70b147d`) |
| **Tanda G** | `ci/compuerta` | 🟢 **Cerrada** | `.github/workflows/compuerta.yml` con service postgres + `packageManager: pnpm@11.3.0` (commit `a190447`) |
| **Tanda H** | `docs/canonicos` | 🟢 **Completada** | `patterns.md`, `TECHNICAL_DEBT.md`, `ROADMAP.md`, `docs/adr/`, `docs/registro/` |
| **Hotfix RSC** | `master` | 🟢 **Cerrada** | Separación isomórfica de `sparklineUtils.ts` (evita límite Server/Client Component en `calcularCambioPorcentual`) |
| **Regla UI/UX** | `master` | 🟢 **Cerrada** | Prohibición formal de movimientos y escalas en `:hover` (anti-CLS y anti-flicker); saneamiento en 7 archivos CSS |
| **Saneamiento Previo** | `master` | 🟢 **Cerrada** | S1 definitivo (`SparklinePoint[]` obligatorio, eliminación prop `data`), saneamiento `/accounts`, 23 warnings ESLint a 0 + `--max-warnings 0`, a11y `MonthSelector` (`useId`, sin `aria-modal`), CI verde en remoto. |
| **Tanda I** | `feat/transactions-management` | 🟢 **Completada** | Módulo de transacciones contables `/transactions`, `occurred_at` con backfill (`0014_real_komodo.sql`), paginación cursor `(occurred_at, id)`, búsqueda/filtros, reversión ACID, primitivas `DataTable` y `SearchInput`, modals de alta y detalle. |
| **Tanda J** | `feat/transactions-management` | 🟢 **Completada** | Soporte multimoneda (validación Debe=Haber por divisa), cambio de divisas (4 asientos / 2 libros contra `3.3.01-<MONEDA>`), reversión irrepetible con bloqueo `SELECT FOR UPDATE`, columnas `reversed_at` y `reverses_transaction_id` (migración `0015_icy_blizzard.sql`), selector de columnas visibles y badges de marcas. |
| **Tanda K** | `feat/transactions-management` | 🟢 **Completada** | Despachador Outbox (RFC 020): consumo desacoplado en 3 pasos con `SKIP LOCKED`, recuperación de `PROCESSING` huérfanos, purga histórica, script CLI `pnpm db:outbox` e índice `outbox_status_created_idx` (migración `0016_eminent_roxanne_simpson.sql`). |
| **Fase 0 (A1)** | `feat/transactions-management` | 🟢 **Completada** | Endurecimiento outbox dispatcher: incremento de intentos y transición a FAILED en huérfanos, protección de asentamiento tardío. |
| **Fase 0 (A2)** | `feat/transactions-management` | 🟢 **Completada** | Índice único `monthly_summaries_org_year_month_unique` (migración `0017_free_iron_monger.sql`). |
| **Fase 0 (A3)** | `feat/transactions-management` | 🟢 **Completada** | Regularización RFC 018 a APPROVED con estado de implementación del core contable (migraciones 0012–0016). |
| **Fase 0 (A4)** | `feat/transactions-management` | 🟢 **Completada** | RFC 019 y migración de 9 columnas monetarias a bigint (modo number, migración `0018_slimy_wiccan.sql`). |
| **Bloque B** | `feat/contacts-management` | 🟢 **Completada** | Agenda de contactos y métodos de cobro en `/contacts` (RFC 006, migración `0019_tidy_piledriver.sql`, validadores CBU/Alias/CUIT, DAL transitivo multi-tenant, 42 tests nuevos de contactos, 298 tests totales). |
| **Fix Entidades** | `fix/entidades-financieras` | 🟢 **Completada** | Alta pura de entidades, asiento de apertura contable `3.1.01.01`, columna `brand_domain` (`0020_soft_fixer.sql`), prop `withOwnAccount` en formulario para contactos (5 tests nuevos). |

---

### Inventario de migración de módulos (Fuentes de referencia)

#### 1. Módulos pendientes de portar desde `FinanzasMock` (Catálogo UI de 17 dominios)
* **Tarjetas (`/tarjetas`)** — RFC 007 (`007-cards-management.md`): componente visual de tarjeta física (chip, emisor, número enmascarado), vinculado a cuentas de pasivo.
* **Metas de ahorro (`/metas`)** — RFC 011 (`011-goals-and-reserves.md`): barras de progreso, cálculo de fecha objetivo y asignación de fondos.
* **Presupuestos (`/presupuestos`):** Donut ring, barras de progreso y límites de gasto asociados al árbol de `categories`.
* **Inversiones (`/inversiones`)** — RFC 014 (`014-investments-management.md`): portafolio, cotizaciones y gráficos con Recharts.
* **Deudas y préstamos (`/deudas`)** — RFC 008 (`008-loans-and-installments.md`): cronograma de amortización y cuotas.
* **Facturación (`/facturacion`)** — RFC 013 (`013-billing-and-invoicing.md`): emisión y preview de comprobantes.
* **Integraciones y API Keys (`/integraciones`)** — RFC 012 (`012-integrations-and-api-keys.md`).

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
