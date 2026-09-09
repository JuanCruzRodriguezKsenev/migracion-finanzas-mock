# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** ninguna. `master` está en `5b011ea`, consolidado y sin trabajo sin integrar.

**Estado:** 🟢 **Sesión de diseño cerrada, sin código.** El 2026-09-09 se abrió y se cerró el
rediseño de la clasificación y de las transacciones propuestas, registrado en
[`diseno/rediseno-clasificacion-y-propuestas.md`](diseno/rediseno-clasificacion-y-propuestas.md).
**Los tres temas están decididos**, con bordes abiertos anotados dentro de cada uno. Nada de esto
habilita código todavía: falta partirlo en las propuestas formales del §7 bajo `proposals/`.

**Lo que se decidió en el §4 (navegación por instrumento):** `/accounts` pasa a ser el **directorio
por entidad** —se entra por Galicia y se ven sus cuentas, sus tarjetas y sus préstamos—; `/cards`,
`/debts` y la página de patrimonio (propiedades, autos) son páginas aparte; y el **Patrimonio Neto se
muda a la página de estadísticas**, donde también van a vivir las categorías.

**Escrita la primera propuesta: [`proposals/022-unified-classification.md`](proposals/022-unified-classification.md)**,
en `DRAFT`. Categoría = cuenta contable, imputación real del gasto, catálogo inicial de 18 categorías
con sus subcategorías, y la corrección de un defecto que el contraste destapó: un cambio de divisas
puede asentar contra el Patrimonio Neto (`TECHNICAL_DEBT.md` §5).

**Próximo paso: que el usuario apruebe el RFC 022.** Hasta que pase a `APPROVED` no habilita código.
Después siguen las otras propuestas del §7 del documento de diseño. El RFC 008 hay que
**reescribirlo**, no implementarlo: es de junio de 2026, usa `integer` para dinero y guarda un
`remainingBalance` propio que duplicaría el saldo ya materializado en `accounts.balance`.

**Por qué se frenó el código.** La ronda iba a ser suscripciones al libro mayor (RFC 004). Al
investigar aparecieron tres decisiones de arquitectura sin tomar y sin RFC, que ese trabajo
necesitaba: el estado de una transacción propuesta, la relación entre categoría y cuenta contable, y
la distinción entre instrumento y cuenta. Suscripciones necesita las dos primeras; las cuotas del
RFC 008 necesitan la primera y la tercera; los presupuestos necesitan la segunda.

**El hallazgo que reordenó las prioridades:** la app hoy no puede responder *de dónde viene cada
cosa*. Las estadísticas agrupan por tipo de cuenta contable y **nadie agrupa por categoría en ningún
lado**; la categoría que el usuario elige no llega a la contabilidad, y todos los gastos del
formulario se imputan a la misma cuenta. Los defectos quedaron anotados en
[`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §4 y §5.

**Batería sobre `master`:** 46 archivos de test, **348 tests**, lint 0, `tsc --noEmit` 0 errores,
build verde. Verificada de forma independiente antes del merge de tarjetas.

> **Convención asentada (2026-09-08):** los segmentos de ruta van **en inglés**
> (`ARCHITECTURE.md` §4).

> **Corrección de rumbo (2026-09-07):** **Tarjetas (RFC 007) es Fase 2 y Metas (RFC 011) es Fase 3.**
> Metas en la primera fase es el error que el artifact documenta del `ROADMAP.md` viejo.

**Pendiente de la gobernanza:** revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md`
§2–§5. Y el artifact de la hoja de ruta quedó desactualizado tras el merge de tarjetas: dice 321
tests y da tarjetas por pendiente.

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
suscripciones (`/subscriptions`) y **tarjetas (`/cards`)**.

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
