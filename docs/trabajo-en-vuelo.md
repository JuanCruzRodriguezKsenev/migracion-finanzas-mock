# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** ninguna. `master` está en `0578bb2`, consolidado y sin trabajo sin integrar.

**Estado:** 🟢 **Tarjetas (RFC 007, primera tajada) consolidada en `master`.** El cierre quedó
congelado en [`registro/2026-09-08-cierre-tarjetas.md`](registro/2026-09-08-cierre-tarjetas.md):
modelo de dos tablas (`cards` y `card_accounts`), migración `0022`, ciclo de facturación resuelto en
el servidor con la zona horaria del perfil, y `/cards` mostrando saldo facturado, saldo en curso y
deuda total.

**Batería sobre `master`:** 46 archivos de test, **348 tests**, lint 0, `tsc --noEmit` 0 errores,
build verde. Verificada de forma independiente antes del merge.

**Próximo paso:** **suscripciones al libro mayor (RFC 004)**, segunda tajada de la Fase 2. El módulo
persiste en Postgres pero no emite un solo asiento contable, y el código de devengamiento que se
escriba ahí es el mismo que van a necesitar las cuotas del RFC 008: conviene resolverlo una vez.

**Comprometido para después, en este orden:** la ruta de edición del perfil —que se llama
**`/profile`**, no `/perfil`, por la convención de rutas— y las cuotas y préstamos del RFC 008.

> **Convención asentada (2026-09-08):** los segmentos de ruta van **en inglés**
> (`ARCHITECTURE.md` §4). El catálogo de FinanzasMock los nombra en español y las cinco rutas en pie
> nacieron en inglés sin que la regla estuviera escrita en ningún lado.

> **Corrección de rumbo (2026-09-07):** este documento venía proponiendo Tarjetas o Metas como
> próximo módulo, en contra del artifact. **Tarjetas (RFC 007) es Fase 2 y Metas (RFC 011) es Fase
> 3.** Metas en la primera fase es justamente el error que el artifact documenta del `ROADMAP.md`
> viejo.

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

**Ya portados:** cuentas (`/accounts`), contactos (`/contacts`), transacciones (`/transactions`),
suscripciones (`/subscriptions`) y **tarjetas (`/cards`)**.

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
