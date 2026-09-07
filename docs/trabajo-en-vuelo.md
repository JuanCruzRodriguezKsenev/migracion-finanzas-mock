# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/transactions-management` (Módulo de Transacciones y Despachador Outbox completados integralmente con pruebas y build de producción exitoso).

**Estado:** 🟢 **Módulo `/transactions` y Despachador Outbox (RFC 020) finalizados. Esquema contable con `occurred_at` (migración `0014_real_komodo.sql`), DAL con paginación por cursor determinístico `(occurred_at, id)`, búsqueda y filtros. Soporte multimoneda con balance Debe=Haber validado por divisa, transacciones de cambio de divisas (4 asientos contra `3.3.01-<MONEDA>`) y reversión contable ACID irrepetible con bloqueo `SELECT FOR UPDATE` (migración `0015_icy_blizzard.sql`). Despachador Outbox (`outboxDispatcher.ts`) con ciclo desacoplado en 3 pasos (`SELECT ... FOR UPDATE SKIP LOCKED` hacia `PROCESSING`, despacho asíncrono sin retención de transacciones DB, y asentamiento a `SENT`/`FAILED`), recuperación automática de huérfanos con incremento de intentos y pase a FAILED, asentamiento idempotente protegido, purga periódica a 30 días (`purgeOldSentEvents`), script CLI `pnpm db:outbox` (`dispatchOutbox.ts`) e índice de polling `outbox_status_created_idx` (migración `0016_eminent_roxanne_simpson.sql`). Índice único en `monthly_summaries` por `(organization_id, year, month)` (migración `0017_free_iron_monger.sql`). Primitivas compartidas accesibles `DataTable` y `SearchInput`. UI reactiva con Server Actions, selector de columnas visibles y badges de marcas. 34 suites de test (255 pruebas) pasando en verde, 0 advertencias ESLint y build exitoso.**

**Próximo paso de desarrollo:**
Completar Fase 0 (A3: regularizar RFC 018; A4: RFC 019 y migración de columnas monetarias a bigint).

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
