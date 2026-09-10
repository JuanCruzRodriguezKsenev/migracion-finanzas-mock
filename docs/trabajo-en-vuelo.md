# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/gestion-categorias`. **Próximo paso:** ejecutar
[`planes/limpieza-rfc022.md`](planes/limpieza-rfc022.md) y, con eso en verde, consolidar la rama a
`master` por fast-forward, escribir el registro en [`registro/`](registro/) y podar
`feat/tarjetas` (ya contenida en `master`) y `feat/clasificacion-unificada` (ancestro de ésta).

**Estado:** 🟢 **RFC 022 completo — sus dos tajadas ejecutadas y verificadas de forma
independiente.**

*   **Primera tajada** (`6d365ba`): el backend entero. Tabla `categories` jerárquica con
    `account_code`, `is_system_leaf` y `archived_at`; las cinco Server Actions; imputación contable
    real por categoría en `transactionsActions`; catálogo inicial de 67 categorías. Sin pantallas.
*   **Segunda tajada** (`a71d439`): selector jerárquico con `<optgroup>` y alta al vuelo en
    `TransactionFormModal`; pantalla de gestión en `/settings` con las pestañas Perfil, Preferencias
    y Seguridad deshabilitadas; mapa de emoji (`accounting/utils/categoryIcons.ts`, sin dependencias
    nuevas); confirmación de archivado informada por `ledgerRepository.countByCategories`;
    navegación a `/settings` y `/cards`; y migración **0024**, que reemplaza `subscriptions.category`
    (enum de siete valores) por `categoryId` con FK `onDelete: "set null"`, backfill de los siete
    valores al catálogo y baja de la columna vieja.

**Batería sobre `a71d439`** (subagente `verificador`, 2026-09-10, con el esquema real contrastado
contra `finanzas_db`): **51 archivos de test, 375 tests, lint 0 errores / 0 warnings,
`tsc --noEmit` 0 errores, build verde.** La rama pasaría la compuerta CI.

**Lo que la verificación encontró y no se hizo.** Cuatro cabos sueltos, ninguno rompe nada hoy y los
cuatro son cosas que el plan anterior no nombró: un tipo muerto (`SubscriptionCategory`), dos
componentes cliente importando un tipo desde el módulo del repositorio, una prop `lang` sin uso, y
el test de cascada de archivado que el plan pedía y no se escribió. **Van en la tanda de limpieza.**
Los otros dos —desarchivado asimétrico y resolución padre→hoja duplicada— son cambios de
comportamiento y bajaron a [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §4.

> **Enmienda al RFC 015 (2026-09-09):** no hay ruta `/profile`. El perfil pasa a ser otra pestaña de
> `/settings`, por la duplicación que trae la referencia del mock. Anotada en el propio RFC.

> **Convención asentada (2026-09-08):** los segmentos de ruta van **en inglés**
> (`ARCHITECTURE.md` §4).

> **Corrección de rumbo (2026-09-07):** **Tarjetas (RFC 007) es Fase 2 y Metas (RFC 011) es Fase 3.**
> Metas en la primera fase es el error que el artifact documenta del `ROADMAP.md` viejo.

**Pendiente de la gobernanza:** revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md`
§2–§5. Y el artifact de la hoja de ruta quedó desactualizado: dice 321 tests, da tarjetas por
pendiente, dice `/tarjetas` donde el repo tiene `/cards`, y no conoce `/settings` ni el RFC 022.

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
