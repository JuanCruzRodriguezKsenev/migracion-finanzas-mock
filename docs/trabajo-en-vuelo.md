# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `docs/rfc-025-cuotas-de-tarjeta`, creada el 2026-09-11 sobre `07aadb3`. **No cambiar
de rama.** `master` quedó consolidado y pusheado hasta `07aadb3`.

**Estado:** 🟢 **Tandas 1 y 2 del RFC 025 ejecutadas.** El RFC 025 quedó completo en backend e interfaz:
modelo relacional de cuotas (`card_installment_plans`), cálculo de cuotas futuras y disponible real,
bandeja global de pendientes arriba de la grilla (`PendingInstallmentsInbox`), modal de planes por
tarjeta (`InstallmentPlansModal`), alta contextual (`InstallmentPlanFormModal`), corrección de fechas
nulas en el ciclo (`string | null`), y localización completa de `/cards` en los tres diccionarios.

**Próximo paso:** verificación independiente con subagente `verificador`, consolidación de la rama
`docs/rfc-025-cuotas-de-tarjeta` y redacción del plan para el **RFC 008** (`/loans`).

**Por qué el 025 va antes que el 008**, que es más grande y crea la feature `/loans` entera: el RFC 007
—`APPROVED` y reaprobado el 2026-09-08— calcula el disponible de la tarjeta restando una tabla
`installmentPlans` que nunca se modeló, así que hoy hay una fórmula aprobada que no se puede
implementar. Además el 025 estrena el patrón de «instrumento con cuotas» sobre una feature ya
construida y verde, que es más barato que estrenarlo creando una feature nueva.

### Lo aprobado el 2026-09-11

*   **[RFC 008](proposals/008-loans-and-installments.md)** — préstamos bidireccionales, ruta **`/loans`**. Reescrito entero: la versión de junio se descartó.
*   **[RFC 025](proposals/025-card-installment-plans.md)** — compras en cuotas con tarjeta, dentro de `/cards`.

**Renombre aplicado:** `/debts` → `/loans` en el RFC 024 (líneas 62, 79, 85, 291, 297), en
`ARCHITECTURE.md:81` y en el inventario de abajo. **No se tocaron** `docs/registro/`, `docs/diseno/`
ni los planes ya ejecutados: son actas de lo que pasó.

**Nota aplicada al RFC 007** (§8B, el bloque de aviso tras la fórmula del disponible): la fórmula
sobrestimaba el disponible y `installmentPlans` no existía. Se siguió el precedente del RFC 023 sobre
el RFC 004 —nota en el lugar exacto, sin enmienda aparte—, habilitado por la aprobación del 025.

### La secuencia que queda

1.  **Ejecutar el RFC 025** — tanda 1 hecha y verificada; **tanda 2 escrita y en cola**
    (`planes/025-tanda-2-cuotas-en-la-interfaz.md`). Con la 2 el RFC 025 queda cerrado salvo sus
    cabos del §10.
2.  **Ejecutar el RFC 008** — `/loans` entero: feature nueva, dos tablas, cronograma con amortización
    francesa y la familia «Préstamos» que el RFC 024 §3.2 dejó declarada y vacía. Sin plan todavía.
    **Antes de escribirlo conviene tener el informe de la tanda 1 del 025**, que estrena el mismo
    patrón de cuotas a menor escala.
3.  **Cerrar los documentos que faltan de la sesión de diseño:** el **contraste del RFC 010**
    (patrimonio físico, siete columnas monetarias en `integer`) y la **enmienda al RFC 003**.
4.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que tiene que recibir el Patrimonio Neto que el 024
    desaloja de `/accounts` —donde **se queda hasta entonces**, por decisión del usuario. Antes de
    tocar código hay que resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
5.  **Internacionalizar `CategoriesSettingsContainer`** — 766 líneas de español directo en buscador,
    modales y confirmaciones. Es el único resto de i18n de `/settings`
    ([`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §3).

Más atrás: las **5 declaraciones de `dict?:` opcional heredadas** (`ContactsTable.tsx:26`,
`PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`).

**Lo consolidado el 2026-09-10 quedó congelado en `registro/`:**
[`2026-09-10-cierre-rfc023-y-compuerta.md`](registro/2026-09-10-cierre-rfc023-y-compuerta.md)
(`2ae7186..8e086d9`),
[`2026-09-10-cierre-page-header.md`](registro/2026-09-10-cierre-page-header.md)
(`8e086d9..2fe778b`),
[`2026-09-10-cierre-mocks-ui-y-storage.md`](registro/2026-09-10-cierre-mocks-ui-y-storage.md)
(`ba8b7ca..90bee72`) y
[`2026-09-10-cierre-rfc024.md`](registro/2026-09-10-cierre-rfc024.md)
(`5f8882b..6210045`).

---

### Inventario de migración de módulos (Fuentes de referencia)

#### 1. Módulos pendientes de portar desde `FinanzasMock` (Catálogo UI de 17 dominios)

Las rutas van **en inglés** (`ARCHITECTURE.md` §4); entre paréntesis, el nombre que el módulo tiene
en el catálogo del mock, que es donde está la referencia visual.

* **Metas de ahorro (`/goals`, mock: `/metas`)** — RFC 011 (`011-goals-and-reserves.md`): barras de progreso, cálculo de fecha objetivo y asignación de fondos. **Fase 3**, no antes: su saldo libre necesita que los compromisos existan.
* **Presupuestos (`/budgets`, mock: `/presupuestos`):** Donut ring, barras de progreso y límites de gasto asociados al árbol de `categories`. **Sin RFC**: hay que escribirlo antes de tocar código.
* **Inversiones (`/investments`, mock: `/inversiones`)** — RFC 014 (`014-investments-management.md`): portafolio, cotizaciones y gráficos con Recharts.
* **Préstamos (`/loans`, mock: `/deudas`)** — RFC 008 (`008-loans-and-installments.md`), `APPROVED` el 2026-09-11: préstamos bidireccionales, cronograma proyectado y amortización. La ruta se llamaba `/debts` hasta ese día.
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
última con dos pestañas activas —Categorías y Plan contable, la segunda desde la tanda 2 del RFC
024— y las otras tres (Perfil, Preferencias, Seguridad) deshabilitadas.

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
