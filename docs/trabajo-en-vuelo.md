# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `docs/rfc-024-navegacion-por-entidad`, encadenada sobre `master` consolidado.

**Estado:** 🟡 **RFC 024 escrito, en `DRAFT`, esperando aprobación del usuario.**
[`024-instruments-and-entity-navigation.md`](proposals/024-instruments-and-entity-navigation.md)
cubre el §4 de la sesión de diseño: `/accounts` como directorio por entidad, el instrumento
presentado como instrumento, el plan de cuentas mudado a `/settings` en sólo lectura, y el
Patrimonio Neto fuera de `/accounts`. **No lleva migración de base de datos**: `financial_entities`
y las tres columnas `entityId` ya existen. **No habilita código hasta que el usuario lo apruebe.**

Dejó **dos defectos activos convertidos en requisitos** —el Patrimonio Neto suma la deuda en vez de
restarla (`AccountsContainer.tsx:87-89`), y `CreateAccountForm` crea cuentas de gasto huérfanas del
árbol de categorías (`:122-126`)— y corrigió **tres afirmaciones inexactas** de la sesión de diseño.

**Próximo paso:** **que el usuario apruebe o corrija el RFC 024.** Recién con `APPROVED` se puede
escribir el plan de ejecución para `obra`.

Detrás, en orden de cercanía:

1.  **Reescritura del RFC 008** (deudas y cuotas) y **contraste del RFC 010** (patrimonio físico).
    Las dos referencian al 024, así que van después.
2.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que recibe el Patrimonio Neto que el 024 desaloja.
3.  **Las 5 declaraciones de `dict?:` opcional heredadas** — `ContactsTable.tsx:26`,
    `PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`.

**Higiene al día (2026-09-10):** `master` quedó **pusheado a `origin`** y las cuatro ramas ya
contenidas se borraron (`feat/bandeja-recurrencias`, `fix/cabos-rfc023-y-limpieza-de-tests`,
`fix/page-header-unico-por-pagina`, `fix/mocks-de-ui-y-dict-obligatorio`). **No queda ninguna rama
local fuera de `master`.**

**Lo consolidado el 2026-09-10 quedó congelado en `registro/`:**
[`2026-09-10-cierre-rfc023-y-compuerta.md`](registro/2026-09-10-cierre-rfc023-y-compuerta.md)
(`2ae7186..8e086d9`),
[`2026-09-10-cierre-page-header.md`](registro/2026-09-10-cierre-page-header.md)
(`8e086d9..2fe778b`) y
[`2026-09-10-cierre-mocks-ui-y-storage.md`](registro/2026-09-10-cierre-mocks-ui-y-storage.md)
(`ba8b7ca..90bee72`). El código consolidado llega hasta `90bee72`.

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
