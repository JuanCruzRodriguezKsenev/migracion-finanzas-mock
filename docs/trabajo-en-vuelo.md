# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `master`. No hay trabajo a medias.

**Estado:** 🟢 **Las tres ramas encadenadas quedaron consolidadas en `master` el 2026-09-08**, por fast-forward y sin conflictos: `feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`. Son 23 commits (`b28eb08..ef21cf9`) que cubren el módulo de transacciones, el soporte multimoneda, el despachador Outbox, la Fase 0 completa, la agenda de contactos, la gobernanza de agentes y la corrección del alta de entidades financieras. El detalle congelado está en [`registro/2026-09-08-cierre-transacciones-contactos-entidades.md`](registro/2026-09-08-cierre-transacciones-contactos-entidades.md).

**Próximo paso de desarrollo:**
Retomar la **Fase 1** con el **RFC 015 — perfil, preferencias y consolidación multimoneda**: es el único RFC en `DRAFT` de los 21 y el único bloqueo formal que impide dar la fase por cerrada. Hoy no hay una sola línea de consolidación multimoneda en `src/`. **El RFC necesita tu aprobación antes de que se escriba código contra él**; ningún agente lo aprueba por su cuenta.

Al planificarlo, arrancar por contrastar el RFC contra `src/features/*/schema.db.ts`: los RFCs de junio traen esquemas anteriores al core contable y ya pasó una vez que uno redefiniera `accounts` con un tipo que hoy sería incorrecto.

> **Corrección de rumbo (2026-09-07):** este documento venía proponiendo Tarjetas o Metas como próximo
> módulo, en contra del artifact. **Tarjetas (RFC 007) es Fase 2 y Metas (RFC 011) es Fase 3.** Metas
> en la primera fase es justamente el error que el artifact documenta del `ROADMAP.md` viejo.

**Pendiente de la gobernanza:** revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.

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
