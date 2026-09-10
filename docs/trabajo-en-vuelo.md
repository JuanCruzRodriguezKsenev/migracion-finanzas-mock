# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/bandeja-recurrencias`, encadenada sobre `master`. **Próximo paso:** ejecutar
[`planes/bandeja-de-recurrencias.md`](planes/bandeja-de-recurrencias.md).

**Estado:** 🟡 **Ronda abierta — bandeja de recurrencias (RFC 023).** Hoy una suscripción es una fila
en un treemap y **no toca la contabilidad**: el usuario carga Netflix y el libro mayor no se entera.
Esta tanda cierra el circuito sin meter supuestos en el libro — la suscripción *pregunta* una vez por
período y el asiento nace **al confirmar**.

*   **RFC 023 `APPROVED` (2026-09-10)**, acotado al origen recurrente: las otras dos bandejas
    —lo que entra de afuera y lo de terceros— no tienen productor todavía.
*   **Sin tabla de pendientes.** Se derivan de un único campo nuevo, `subscriptions.resolved_through`.
    Es lo que el diseño ya pedía y **es lo que hace que esta ronda no dependa de los crons de la
    Fase 3**: un pendiente materializado necesita quién lo cree; uno derivado aparece al leer.
*   **Enmienda al RFC 004:** sus §3 (worker nocturno) y §4 (`needs_review` dentro del libro) quedaron
    **revocadas**. Anotada en el propio RFC 004, como su §6.
*   **Dos deudas dejaron de ser deudas y pasaron a requisito:** `addInterval` —que hoy manda una
    suscripción del 31 de enero al 3 de marzo, y es la función que genera toda la serie de períodos—
    y la resolución categoría padre → hoja duplicada en `transactionsActions`.

**Batería sobre `master` (`2ae7186`):** 51 archivos de test, **376 tests**, lint 0 errores /
0 warnings, `tsc --noEmit` 0 errores, build verde, **compuerta CI remota en verde**.

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
