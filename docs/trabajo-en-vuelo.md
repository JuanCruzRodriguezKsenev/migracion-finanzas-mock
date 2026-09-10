# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/gestion-categorias`, ejecutando el plan
[`planes/gestion-categorias.md`](planes/gestion-categorias.md). Rama encadenada sobre `feat/clasificacion-unificada`.

**Estado:** 🟢 **Segunda tajada completada (Gestión de categorías, selector jerárquico y migración de suscripciones).**
Se completaron los 10 pasos del plan del RFC 022:
*   **Mapeo de iconos (`categoryIcons.ts`):** Función `iconoDeCategoria` que mapea cada ícono del catálogo a su emoji representativo, con fallback estándar `📦`.
*   **Selector jerárquico en `TransactionFormModal`:** Carga dinámica del árbol de categorías (`getCategoryTreeAction`), agrupación con `<optgroup>` por padre, exclusión estricta de hojas `isSystemLeaf`, filtro según tipo de transacción (`expense`/`revenue`), opción por defecto "Sin detallar" y formulario integrado de alta rápida sin abandonar el modal.
*   **Página de gestión `/settings`:** Server Component con layout de dos columnas (`CategoriesSettingsContainer.tsx`), listado de padres con conteo de subcategorías, ficha derecha con muestra de color e ícono, alta de subcategorías, hoja `General` no mutable, modal de confirmación de archivado informando movimientos imputados en el libro mayor (`ledgerRepository.countByCategories`), y toggle de categorías archivadas.
*   **Soporte de pestañas en `Tabs`:** Incorporación de propiedades `disabled` (para Perfil, Preferencias y Seguridad) y `badge`.
*   **Navegación completa:** Enlaces a `/settings` (Configuración) y `/cards` (Tarjetas) integrados en `Navbar.tsx` y `BottomNav.tsx`.
*   **Migración de suscripciones (0024):** Columna `category_id` vinculada por FK a `categories` (`onDelete: "set null"`), backfill atómico de los 7 valores a las subcategorías contables de *Suscripciones y servicios digitales* (`5.1.09.01`–`5.1.09.06` y `5.1.09.99` para general/other), y eliminación de la columna obsoleta `category`. Esquema Zod actualizado, `AddSubscriptionModal` con selector jerárquico dinámico, y `seed.ts` demo ajustado.
*   **Batería de tests completa:** Tests unitarios e integración pasando (iconos, selector con optgroup y exclusión de system leaves, creación al vuelo, interacción en `/settings`, archivado en cascada informado, y persistencia de suscripciones).

> **Enmienda al RFC 015 (2026-09-09):** no hay ruta `/profile`. El perfil pasa a ser otra pestaña de
> `/settings`, por la duplicación que trae la referencia del mock. Anotada en el propio RFC.


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
