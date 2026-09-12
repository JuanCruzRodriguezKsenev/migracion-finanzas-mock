# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/rfc-008-loans`, creada el 2026-09-11 sobre `master` ya consolidado.
**No cambiar de rama.**

**Estado:** 🟢 **La tanda 2 del RFC 008 quedó ejecutada y verificada.** Interfaz completa de `/loans`
—métricas (`MetricsSection`), tabla con tabs por dirección (`LoanTable`), bandeja de liquidación de
cuotas vencidas (`PendingLoanSettlementsInbox`), modal de alta (`LoanFormModal`) con amortización
proyectada en vivo—, navegación con icono de préstamo en `Navbar` y `BottomNav`, i18n completa en los
tres diccionarios (`es`, `en`, `br`), backend extendido (`findAllWithRelations`, `loanSummaryService`,
`getLoansAction` y `archiveLoanAction`), y la familia **Préstamos** en el detalle de entidad de
`/accounts` con exclusión de las cuentas espejo de la lista cruda de cuentas.
La suite subió a **485 tests en 68 archivos** (18 tests nuevos, 3 archivos de test nuevos), 0 ESLint, 0 TS y
build verde, verificado por `verificador` en corrida independiente.

**Próximo paso:** **Cerrar los documentos que faltan de la sesión de diseño:** el **contraste del RFC 010**
(patrimonio físico, siete columnas monetarias en `integer`) y la **enmienda al RFC 003**.

### Las tres decisiones de la tanda 2, cerradas por el usuario el 2026-09-11

1.  **La pantalla es una tabla con tabs por dirección** (Todos / Pedidos / Dados), con
    `MetricsSection` arriba. **No** es una grilla de tarjetas al estilo `/cards`: un préstamo tiene
    seis columnas numéricas que en una tarjeta no entran.
2.  **La liquidación vive en una bandeja global arriba de la tabla**, con modal de selección de
    cuenta. La fila de la tabla no lleva botón de pago. La bandeja muestra **una sola fila por
    préstamo** —su cuota más antigua— porque la acción rechaza cualquier otra.
3.  **La familia «Préstamos» de `/accounts` entra en esta misma tanda**, junto con el filtro que saca
    las cuentas espejo de la lista de cuentas de la entidad.

De paso, la tanda 2 cerró la deuda §8 del `<span>Tarjetas</span>` en duro: agregó `sidebar.cards` a
los tres diccionarios, que además apaga el respaldo que usaba `BottomNav.tsx:77`.

### La decisión que el plan de la tanda 1 cerró

El RFC 008 §5D y §5E necesitan una categoría de intereses —gasto al pagar una cuota, ingreso al
cobrarla— pero el esquema aprobado de `loans` **no tiene ninguna columna de categoría**. Resuelto por
el usuario el 2026-09-11: **fija por código, sin cambio de esquema.** La feature resuelve
`5.1.11.02 Intereses` para `borrowed` y el padre `4.1.04 Intereses y rendimientos` para `lent`, que
cae a su hoja `General` por `resolveToLeaf()`. No se abre nota de corrección al RFC.

La otra decisión que el §9 del RFC delegaba al plan —**dónde entra `/loans` en la navegación**— quedó
resuelta en el plan: sección «Finanzas» del `Navbar`, inmediatamente después de `/cards`, con
`dict.loans` en los tres diccionarios.

### La secuencia que queda

1.  ~~**Ejecutar la tanda 2 del RFC 008**~~ — **Completada y verificada.** Pantalla `/loans` entera más la
    familia «Préstamos» que el RFC 024 §3.2 dejó declarada y vacía.
2.  **Cerrar los documentos que faltan de la sesión de diseño:** el **contraste del RFC 010**
    (patrimonio físico, siete columnas monetarias en `integer`) y la **enmienda al RFC 003**.
3.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que tiene que recibir el Patrimonio Neto que el 024
    desaloja de `/accounts` —donde **se queda hasta entonces**, por decisión del usuario. Antes de
    tocar código hay que resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
    **El RFC 008 §9 le suma un encargo:** un préstamo registra el pasivo completo el día uno y una
    compra en cuotas no, así que financiar la misma heladera de las dos formas da patrimonios netos
    distintos. Esa brecha la cierra esta propuesta.
4.  **Internacionalizar `CategoriesSettingsContainer`** — 766 líneas de español directo en buscador,
    modales y confirmaciones. Es el único resto de i18n de `/settings`
    ([`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §3).

Más atrás: las **5 declaraciones de `dict?:` opcional heredadas** (`ContactsTable.tsx:26`,
`PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`). El
`<span>Tarjetas</span>` en duro del `Navbar` (§8 de la deuda) **quedó cerrado en la tanda 2 del 008**.

**Lo consolidado quedó congelado en `registro/`:**
[`2026-09-10-cierre-rfc023-y-compuerta.md`](registro/2026-09-10-cierre-rfc023-y-compuerta.md)
(`2ae7186..8e086d9`),
[`2026-09-10-cierre-page-header.md`](registro/2026-09-10-cierre-page-header.md)
(`8e086d9..2fe778b`),
[`2026-09-10-cierre-mocks-ui-y-storage.md`](registro/2026-09-10-cierre-mocks-ui-y-storage.md)
(`ba8b7ca..90bee72`),
[`2026-09-10-cierre-rfc024.md`](registro/2026-09-10-cierre-rfc024.md)
(`5f8882b..6210045`) y
[`2026-09-11-cierre-rfc025.md`](registro/2026-09-11-cierre-rfc025.md)
(`07aadb3..94c02b4`).

---

### Inventario de migración de módulos (Fuentes de referencia)

#### 1. Módulos pendientes de portar desde `FinanzasMock` (Catálogo UI de 17 dominios)

Las rutas van **en inglés** (`ARCHITECTURE.md` §4); entre paréntesis, el nombre que el módulo tiene
en el catálogo del mock, que es donde está la referencia visual.

* **Metas de ahorro (`/goals`, mock: `/metas`)** — RFC 011 (`011-goals-and-reserves.md`): barras de progreso, cálculo de fecha objetivo y asignación de fondos. **Fase 3**, no antes: su saldo libre necesita que los compromisos existan.
* **Presupuestos (`/budgets`, mock: `/presupuestos`):** Donut ring, barras de progreso y límites de gasto asociados al árbol de `categories`. **Sin RFC**: hay que escribirlo antes de tocar código.
* **Inversiones (`/investments`, mock: `/inversiones`)** — RFC 014 (`014-investments-management.md`): portafolio, cotizaciones y gráficos con Recharts.
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
suscripciones (`/subscriptions`), **tarjetas (`/cards`)** —con planes de cuotas desde el RFC 025—,
**préstamos (`/loans`)** —RFC 008 tandas 1 y 2— y
**configuración (`/settings`)**, esta última con dos pestañas activas —Categorías y Plan contable, la
segunda desde la tanda 2 del RFC 024— y las otras tres (Perfil, Preferencias, Seguridad)
deshabilitadas.

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
