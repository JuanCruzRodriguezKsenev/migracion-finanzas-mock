# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `master` (Saneamiento integral completado; terreno limpio para Transacciones).

**Estado:** 🟢 **Pipeline de CI inaugurado y verificado en verde en GitHub Actions (`calidad` exitosa en 2m5s). Cero errores y cero warnings en ESLint con `--max-warnings 0` en compuerta. Contrato `SparklinePoint[]` obligatorio en los 7 gráficos de la aplicación. Datos inventados eliminados en `/accounts`. Accesibilidad e internacionalización de `MonthSelector` completadas con `useId()` y traducciones de año.**

**Próximo paso de desarrollo:**
Construcción del módulo de Transacciones / Libro Diario (`/transactions`), conectando la UI con `accountingService.ts`, `ledgerRepository.ts` y el modelo de partida doble (`ledgerTransactions`, `ledgerEntries`).

---

## Estado al 2026-09-06

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
