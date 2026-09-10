# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `fix/cabos-rfc023-y-limpieza-de-tests`, encadenada sobre `feat/bandeja-recurrencias`.
**Próximo paso:** ejecutar [`docs/planes/cabos-rfc023-y-limpieza-de-tests.md`](planes/cabos-rfc023-y-limpieza-de-tests.md).

**`feat/bandeja-recurrencias` quedó verificada y lista para consolidar** (2026-09-10, `dd7388d`):
`verificador` la corrió entera y dio **53 archivos, 392 tests en verde, lint 0, `tsc --noEmit` 0,
build verde**, con la suite corrida **dos veces seguidas** y conteo idéntico en ambas. Pasa la
compuerta de CI. No se mergeó todavía: la ronda siguiente se encadena sobre ella, como es la
convención del repo.

**Lo que la revisión encontró y el plan de la ronda siguiente corrige:**

*   **La guarda del puntero se evalúa fuera de la transacción** (`resolveSubscriptionAction.ts:87-100`
    lee, `:137` abre la transacción). Dos confirmaciones concurrentes pasan las dos y generan dos
    asientos para la misma ocurrencia. No fue desvío de la ejecución: el plan anterior decidió que el
    puntero era la guarda; lo que faltaba era leerlo bajo bloqueo.
*   **El backfill de la 0025 manda `weekly`/`quarterly`/`custom` al fallback** `start_date - 1 mes`,
    que a una semanal le abre unas cuatro ocurrencias juntas en la bandeja.
*   **La deuda §7 pasó de 14 a 18 suites** en una sola tanda. Los tres hallazgos del informe de
    ejecución apuntan todos ahí.

**Estado:** 🟢 **Bandeja de recurrencias implementada (RFC 023).** La confirmación de recurrencias
emite asientos contables en el libro mayor de forma atómica (partida doble con fecha civil de ocurrencia),
avanza el puntero de resolución `resolved_through` como guarda de idempotencia y secuencia cronológica, y
ofrece opción de descarte sin asiento.

*   **RFC 023 completado íntegramente:**
    *   `categoryRepository.resolveToLeaf` extraído y reutilizado en transacciones y resolución de recurrencias.
    *   `addInterval` corregido con anclaje de día nominal y recorte sin desborde de mes.
    *   Servicio de serie civil puro `recurrenceService.ts` con cobertura exhaustiva (10/10).
    *   Migración `0025_neat_hellcat.sql` aplicada (`resolved_through date` con backfill de mensuales y anuales).
    *   Server Action `resolveSubscriptionAction` con transacción ACID estricta y revalidación de ruta.
    *   Componente accesible `PendingOccurrencesInbox` integrado en `/subscriptions` sobre el treemap.
    *   Patrón 10 ("Bandeja de transacciones propuestas y avance por puntero de resolución") documentado en `docs/patterns.md`.

**Batería de tests local:** 53 archivos de test, **392 tests** pasando en verde (100% pasando).

> **Enmienda al RFC 015 (2026-09-09):** no hay ruta `/profile`. El perfil pasa a ser otra pestaña de
> `/settings`, por la duplicación que trae la referencia del mock. Anotada en el propio RFC.

> **Convención asentada (2026-09-08):** los segmentos de ruta van **en inglés**
> (`ARCHITECTURE.md` §4).

**Pendiente de la gobernanza:** revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md`
§2–§5.

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
