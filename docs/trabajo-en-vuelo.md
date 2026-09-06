# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/month-selector-limites` (abierta sobre `master` el 2026-09-06).

**En curso:** Tanda D — Límites y rutas del selector (cerrando cambios y verificando tests).
1. `src/features/accounting/repositories/monthlySummaryRepository.ts`: Implementación de `findEarliestMonthKey(organizationId)` con orden ascendente por año y mes.
2. `src/features/accounting/actions/accountingActions.ts`: Implementación de Server Action `getEarliestMonthKeyAction()`.
3. `src/app/[lang]/(main)/layout.tsx` & `AppShell.tsx`: Consulta paralela en servidor de `minKey` y propagación hacia `Header`.
4. `src/shared/ui/layout/Header/Header.tsx`: Ocultamiento del `MonthSelector` en `/accounts` y `/subscriptions` (`!isAccounts && !isSubscriptions`) (M2) y provisión de `minKey` (M3).
5. `src/shared/ui/display/MonthSelector/MonthSelector.tsx`: Bloqueo de avance retroactivo (`isPrevDisabled` cuando `prevMonthKey < minKey`), restricción de navegación anual (`viewYear <= minYear`), y bloqueo de meses sin datos en la grilla (`currentMonthKey < minKey`).
6. Tests actualizados: `monthlySummaryRepository.test.ts` (retorno de clave más antigua y `undefined` si no hay resúmenes) y `MonthSelector.test.tsx` (deshabilitación de controles y grilla ante `minKey`). Todos los 175 tests pasando.

**Próximo paso inmediato:**
Commitear en `feat/month-selector-limites`, mergear a `master` con fast-forward, e iniciar **Tanda E — Limpieza de ESLint (set-state-in-effect)** en la rama `fix/lint-set-state-in-effect`.

---

## Estado al 2026-09-06

### Plan de punta a punta — FinanzIA

| Tanda | Rama | Estado | Foco principal |
| :--- | :--- | :---: | :--- |
| **Tanda 0** | `docs/gobernanza-base` | 🟢 **Cerrada** | `docs/trabajo-en-vuelo.md` y §8 en `.agents/AGENTS.md` (commit `36b0019`) |
| **Tanda A** | `fix/dashboard-correctitud` | 🟢 **Cerrada** | S1 ({value, monthKey}[]), S2 (ojito), S3 (pct 0.0%), M1 (hoy en server), A5 (summaryCache) (commit `2661f8e`) |
| **Tanda B** | `fix/dashboard-visual` | 🟢 **Cerrada** | S4 (overflow hero), S5 (cursor tema claro), S6 (formatCents), M7 (px fijos), S8 (flash) (commit `b41b0b3`) |
| **Tanda C** | `fix/dashboard-i18n-a11y` | 🟢 **Cerrada** | S7/M5 (i18n es/en/br), M5b (Intl labels), M6 (dialog a11y), M4 (todayKey), M8 (clases) (commit `12a9c5c`) |
| **Tanda D** | `feat/month-selector-limites`| 🟢 **Completada** | M2 (ocultar en accounts/subscriptions), M3 (minKey primer mes con datos) |
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
