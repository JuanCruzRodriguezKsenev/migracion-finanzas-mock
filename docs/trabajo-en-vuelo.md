# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/tarjetas` (sale de `master` en `e4d8cb3`).

**Estado:** 🟢 **Tarjetas como cuentas de pasivo (RFC 007, primera tajada) implementada según el plan.** Se implementó el modelo de dos tablas (`cards` y `card_accounts`) con migración `0022_familiar_richard_fisk.sql`, agregación en `ledgerRepository.sumEntriesByAccountInRange`, cálculo puro de ciclos en `ciclo.ts` con soporte IANA, validación PCI-DSS estricta en `cards.schema.ts`, Server Actions con emisión contable diferenciada en `cardsActions.ts`, UI completa en `/cards` (`CardVisual`, `CardsContainer`, `CardFormModal`), siembra idempotente en `seed.ts`, 24 tests unitarios/integración en 4 archivos, patrón §7 documentado en `patterns.md`, deuda técnica registrada en `TECHNICAL_DEBT.md` y corrección de `.agents/AGENTS.md` §8.1.

**Cierre de la verificación independiente (2026-09-08).** La batería reproducía en verde, pero
`calcularPeriodos` y `sumEntriesByAccountInRange` **no tenían consumidor de producción**: la
maquinaria del ciclo estaba construida y probada, y la tarjeta seguía mostrando sólo deuda total.
Esa partición es el §4 del RFC y la justificación de la ronda entera. Se cableó con un servicio
nuevo, [`cardCycleService.ts`](../src/features/cards/services/cardCycleService.ts), que resuelve el
ciclo en el servidor —la partición sale de una agregación del libro mayor— y con la zona horaria del
perfil, de la que depende a qué día del mes pertenece un consumo. `/cards` ahora muestra **saldo
facturado con su fecha de vencimiento, saldo en curso desde el cierre, y deuda total**. Se corrigieron
además el mensaje de error del alta —que tragaba el estado a medias de cuatro escrituras no
atómicas— y una función que devolvía una constante.

**Batería sobre la rama:** 46 archivos de test, **348 tests**, lint 0, `tsc --noEmit` 0 errores, build verde.

**Próximo paso:** revisión y merge de `feat/tarjetas` a `master`, o siguiente tajada de Fase 2 (cuotas y préstamos del RFC 008, o el flujo de pago del resumen).

**Pendientes menores heredados de la ronda**, anotados en el registro y sin ejecutar: el catálogo de `preferences.ts` todavía no tiene consumidor de producción (sólo tests) porque `/perfil` quedó fuera de alcance, `formatCurrency` no protege el locale contra un valor heredado no-BCP-47, y `roundAmounts` se guarda pero nadie lo lee.

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
