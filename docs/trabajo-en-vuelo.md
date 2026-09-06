# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `fix/dashboard-correctitud` (abierta sobre `master` el 2026-09-06).

**En curso:** Tanda A — Correctitud del dashboard (cerrando cambios y verificando tests).
1. `src/features/accounting/repositories/monthlySummaryRepository.ts`: Eliminado cacheo permanente de `null` en `summaryCache` (A5).
2. `src/shared/ui/display/RechartsSparkline/Sparkline.tsx`: Puntos con `SparklinePoint` `{ value, monthKey }`, formateo de meses con Intl (`formatMonthKeyLabel`), privacidad respetada con `MetricsVisibilityContext` (`••••••` sin leak en tooltip, S2), cálculo preciso sin falsos porcentajes (`calcularCambioPorcentual`, S3).
3. `src/features/accounting/utils/dashboardMetrics.ts`: Emisión cronológica de `SparklinePoint[]` con claves "YYYY-MM" explícitas, eliminación de rellenos de ceros ficticios (S1), cálculo de tendencias sincronizado sin 0.0% inventado (S3).
4. `src/app/[lang]/(main)/layout.tsx` + `AppShell.tsx` + `Header.tsx`: Resolución en servidor de `currentMonthKey` para evitar desincronizaciones de reloj entre cliente y servidor (M1/A4).
5. `src/shared/ui/layout/MetricsSection/MetricsSection.tsx` + `page.tsx`: Tipado con `SparklinePoint[]` y eliminación de centinelas `[0, 0]`.

**Próximo paso inmediato:**
Verificar paso de vitest y tsc, commitear en `fix/dashboard-correctitud`, mergear a `master` con fast-forward, e iniciar **Tanda B — Visual del dashboard** en la rama `fix/dashboard-visual`.

---

## Estado al 2026-09-06

### Plan de punta a punta — FinanzIA

| Tanda | Rama | Estado | Foco principal |
| :--- | :--- | :---: | :--- |
| **Tanda 0** | `docs/gobernanza-base` | 🟢 **Cerrada** | `docs/trabajo-en-vuelo.md` y §8 en `.agents/AGENTS.md` (commit `36b0019`) |
| **Tanda A** | `fix/dashboard-correctitud` | 🟢 **Completada** | S1 ({value, monthKey}[]), S2 (ojito), S3 (pct 0.0%), M1 (hoy en server), A5 (summaryCache) |
| **Tanda B** | `fix/dashboard-visual` | ⚪ Pendiente | S4 (overflow hero), S5 (cursor tema claro), S6 (formatCents), M7 (px fijos), S8 (flash) |
| **Tanda C** | `fix/dashboard-i18n-a11y` | ⚪ Pendiente | S7/M5 (i18n es/en/br), M5b (Intl labels), M6 (dialog a11y), M4 (todayKey), M8 (clases) |
| **Tanda D** | `feat/month-selector-limites`| ⚪ Pendiente | M2 (ocultar donde no se consume), M3 (minKey primer mes con datos) |
| **Tanda E** | `fix/lint-set-state-in-effect`| ⚪ Pendiente | 4 errores ESLint: NotificationsContext, InstitutionLogo, CreateFinancialEntityForm |
| **Tanda F** | `feat/env-validado` | ⚪ Pendiente | `env.ts` con Zod (lazy `obtenerEnv`), eliminar fallback silencioso de `client.ts:15` |
| **Tanda G** | `ci/compuerta` | ⚪ Pendiente | `.github/workflows/compuerta.yml` con service postgres + `packageManager: pnpm@11.3.0` |
| **Tanda H** | `docs/canonicos` | ⚪ Pendiente | `patterns.md`, `TECHNICAL_DEBT.md`, `ROADMAP.md`, `docs/adr/` desde la próxima decisión |

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
