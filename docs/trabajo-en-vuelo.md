# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `docs/rfc-010-patrimonio-fisico`, creada el 2026-09-11 sobre `master` ya
consolidado. **No cambiar de rama.**

**Estado:** 🟢 **El RFC 008 quedó cerrado, verificado y consolidado en `master`** por fast-forward
(`129a2f9..99deff1`), congelado en
[`registro/2026-09-11-cierre-rfc008.md`](registro/2026-09-11-cierre-rfc008.md). Sus dos tandas
—modelo de préstamos con migración `0028`, y la pantalla `/loans` entera con su bandeja de
liquidación, su i18n y la familia «Préstamos» de `/accounts`— cierran la propuesta: **485 tests en 68
archivos, 0 ESLint, 0 TS y build verde.**

**Próximo paso:** **cerrar los dos documentos que le faltan a la sesión de diseño**
([`diseno/rediseno-clasificacion-y-propuestas.md`](diseno/rediseno-clasificacion-y-propuestas.md)):
el **contraste del RFC 010** (patrimonio físico) y la **enmienda al RFC 003** (división de gastos por
eventos).

### Por qué esos dos y por qué ahora

Los dos están **`APPROVED` desde el 2026-06-23 y son anteriores al core contable**, así que hoy
autorizan formalmente el esquema equivocado. Es la misma trampa que el §0 del RFC 008 denuncia y que
el repositorio ya se cobró dos veces, en el RFC 006 y en el RFC 015.

*   **RFC 010 — patrimonio físico** (135 líneas): seis columnas monetarias en `integer` e importa
    `doublePrecision`, cuando el repositorio migró a `bigint` en el RFC 019. Pero el desajuste de
    fondo es mayor que los tipos: **no dice cómo un inmueble entra al libro** como cuenta de activo,
    ni usa el patrón de tabla puente que el RFC 024 §4 declara para «todo instrumento que venga».
    Probablemente salga **reescritura completa**, como el 008, y no enmienda de tipos.
*   **RFC 003 — división de gastos por eventos** (139 líneas): dos columnas monetarias en `integer`,
    más la enmienda de fondo que pide el §9 de la sesión de diseño: su flujo
    `pending → sent → confirmed` sobre `event_debts` **confirma sin categorizar**, y hay que dejar
    explícito que **cada parte categoriza en su propio libro** — lo que a vos te entra como recupero,
    al otro le sale como gasto. Se comparte el hecho, no la categorización.

**El 010 va antes que la página de estadísticas, y no al revés:** el Patrimonio Neto que esa página
tiene que mostrar incluye los activos no financieros que el 010 modela. Escribirla antes de
contrastar el 010 es escribirla dos veces.

### La secuencia que queda

1.  **Contraste del RFC 010 y enmienda del RFC 003** — en curso. Cierra la sesión de diseño abierta
    desde el 2026-09-09.
2.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que tiene que recibir el Patrimonio Neto que el 024
    desaloja de `/accounts` —donde **se queda hasta entonces**, por decisión del usuario. Antes de
    tocar código hay que resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
    **El RFC 008 §9 le suma un encargo:** un préstamo registra el pasivo completo el día uno y una
    compra en cuotas no, así que financiar la misma heladera de las dos formas da patrimonios netos
    distintos. Esa brecha la cierra esta propuesta.
3.  **Internacionalizar `CategoriesSettingsContainer`** — 766 líneas de español directo en buscador,
    modales y confirmaciones. Es el único resto de i18n de `/settings`
    ([`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §3).
4.  **El neto por contacto en `/contacts`** — el §9 del RFC 008 lo deja abierto y depende de él. Hoy
    `/contacts` no muestra un solo importe.

Más atrás: las **5 declaraciones de `dict?:` opcional heredadas** (`ContactsTable.tsx:26`,
`PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`).

**Lo consolidado quedó congelado en `registro/`:**
[`2026-09-10-cierre-rfc023-y-compuerta.md`](registro/2026-09-10-cierre-rfc023-y-compuerta.md)
(`2ae7186..8e086d9`),
[`2026-09-10-cierre-page-header.md`](registro/2026-09-10-cierre-page-header.md)
(`8e086d9..2fe778b`),
[`2026-09-10-cierre-mocks-ui-y-storage.md`](registro/2026-09-10-cierre-mocks-ui-y-storage.md)
(`ba8b7ca..90bee72`),
[`2026-09-10-cierre-rfc024.md`](registro/2026-09-10-cierre-rfc024.md)
(`5f8882b..6210045`),
[`2026-09-11-cierre-rfc025.md`](registro/2026-09-11-cierre-rfc025.md)
(`07aadb3..94c02b4`) y
[`2026-09-11-cierre-rfc008.md`](registro/2026-09-11-cierre-rfc008.md)
(`129a2f9..99deff1`).

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
