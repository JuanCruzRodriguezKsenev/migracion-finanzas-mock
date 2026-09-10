# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `fix/cabos-rfc023-y-limpieza-de-tests`, encadenada sobre `feat/bandeja-recurrencias`.
**Próximo paso:** consolidar / mergear la rama sobre `feat/bandeja-recurrencias` tras la verificación de la suite completa.

**Estado:** 🟢 **Cierre de cabos del RFC 023 completado y compuerta de CI desbloqueada.**

Se ejecutó [`docs/planes/cierre-cabos-rfc023.md`](planes/cierre-cabos-rfc023.md):
*   **75 warnings huérfanos eliminados (Paso 1):** saneamiento de imports no utilizados en los 18 archivos de test afectados por `limpiarBase()` y la centralización del factory, dejando `pnpm exec eslint . --max-warnings 0` en código de salida 0 sin advertencias.
*   **Normalización de `revalidatePath` (Paso 2):** se actualizaron las tres llamadas en `src/features/cards/actions/cardsActions.ts` a `revalidatePath( "/[lang]/(main)/cards" , "page" )`, alineadas con la estructura física de archivos de ruta de Next.js y cubriendo todos los idiomas.
*   **Deuda técnica actualizada (Paso 3):** ítem §7 resuelto y documentado en `docs/TECHNICAL_DEBT.md`, y registro de dos nuevos ítems de deuda preventiva (§ Abierto: cobertura de métodos en el mock de `next/cache` y retroceso potencial de punteros en la migración 0026).

**Lo que ya estaba verificado de la ronda anterior:**
*   **Guarda bajo bloqueo:** `subscriptionRepository.findByIdForUpdate` consumido en `resolveSubscriptionAction` con guarda releída.
*   **Backfill de frecuencias no mensuales:** migración `0026_backfill_recurrence_pointers.sql` aplicada.
*   **Limpieza topológica compartida:** `limpiarBase()` en las 18 suites de integración con `afterAll( limpiarBase )`.
*   **Factory y mock de setup:** `makeSubscription` y mock de `next/cache`.

---

### Inventario de migración de módulos (Fuentes de referencia)

#### 1. Módulos pendientes de portar desde `FinanzasMock` (Catálogo UI de 17 dominios)

Las rutas van **en inglés** (`ARCHITECTURE.md` §4); entre paréntesis, el nombre que el módulo tiene
en el catálogo del mock, que es donde está la referencia visual.

* **Metas de ahorro (`/goals`, mock: `/metas`)** — RFC 011 (`011-goals-and-reserves.md`): barras de progreso, cálculo de fecha objetivo y asignación de fondos. **Fase 3**, no antes: su saldo libre necesita que los compromisos existan.
* **Presupuestos (`/budgets`, mock: `/presupuestos`):** Donut ring, barras de progreso y límites de gasto asociados al árbol de `categories`. **Sin RFC**: hay que escribirlo antes de tocar código.
* **Inversiones (`/investments`, mock: `/inversiones`)** — RFC 014 (`014-investments-management.md`): portafolio, cotizaciones y gráficos con Recharts.
* **Deudas y préstamos (`/debts`, mock: `/deudas`)** — RFC 008 (`008-loans-and-installments.md`): cronograma de amortización y cuotas.
* **Facturación (`/billing`, mock: `/facturacion`)** — RFC 013 (`013-billing-and-invoicing.md`): emisión y preview de comprobantes.
* **Integraciones y API Keys (`/integrations`, mock: `/integraciones`)** — RFC 012 (`012-integrations-and-api-keys.md`).
* **Perfil (`/profile`, mock: `/perfil`)** — RFC 015, ya aprobado: es la pantalla que le falta a las preferencias canónicas para tener consumidor de producción.

**Cuatro rutas del mock que este inventario no listaba** (detectado el 2026-09-09 al recorrer el
catálogo con el mock levantado; el encabezado decía 17 dominios y sólo se enumeraban 12):

* **Estadísticas / reportes (mock: `/reportes`)** — **Sin RFC.** Es la página donde el §4 del diseño manda el Patrimonio Neto y donde el §3 manda las categorías. En el mock trae cinco métricas (ahorro neto, ingresos, gastos, tasa de ahorro, transacciones), gráfico combinado de ingresos/gastos/ahorro, **donut de gastos por categoría**, cascada, "Resumen por cuenta", "Top gastos" y reportes guardados. Nombre de ruta a decidir.
* **Patrimonio (mock: `/patrimonio`)** — **Sin RFC.** Activos no financieros: propiedades, autos. Decisión 3 del §4. El único precedente es la tabla `assets` de FinanceApp-WSL.
* **Configuración (mock: `/configuracion`)** — sin RFC; distinta de `/profile`.
* **Mejorar plan (mock: `/mejorar-plan`)** — pantalla comercial del SaaS; se cruza con la deuda de `planName`/`planBilling` en `profiles`.

**Ya portados:** cuentas (`/accounts`), contactos (`/contacts`), transacciones (`/transactions`),
suscripciones (`/subscriptions`), **tarjetas (`/cards`)** y **configuración (`/settings`)**, esta
última con una sola pestaña activa —Categorías— y las otras tres deshabilitadas.

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
