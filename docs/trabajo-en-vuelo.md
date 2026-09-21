# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `master`. **No hay nada en vuelo:** las tres ramas encadenadas
—`docs/rfc-010-patrimonio-fisico` → `feat/i18n-categorias` → `fix/result-panel-categorias`— se
consolidaron el 2026-09-21 por fast-forward puro y se borraron. La historia sigue estrictamente
lineal, cero merge commits.

Lo cerrado quedó congelado en
[`registro/2026-09-21-cierre-categorias-y-rfc-010-003.md`](registro/2026-09-21-cierre-categorias-y-rfc-010-003.md)
(`1dbc993..0428b22`): la reescritura de los RFC 010 y 003, la i18n del panel de categorías y el
manejo del `Result` en ese mismo panel. **490 tests en 68 archivos, 0 ESLint, 0 TS, build verde**,
verificado por `verificador` al cerrar cada tanda.

**Próximo paso: aprobar o corregir los RFC 010 y 012.** Son las dos decisiones que bloquean código, y
son tuyas: ningún agente aprueba un RFC. **El RFC 003 ya no está en esa cola** — ver abajo.

> **El RFC 010 está en `master` y en `DRAFT` al mismo tiempo, y eso es deliberado.** Entró con la
> consolidación porque la cadena de ramas es lineal, **no porque esté aprobado**: no habilita una
> línea de código. Bajó de `APPROVED` a `DRAFT` el 2026-09-12 porque llevaba quince meses aprobado
> sin implementar, autorizando formalmente el esquema equivocado — la trampa que ya se cobró el
> RFC 006 y el RFC 015. El porqué y las cinco decisiones del usuario están en el registro de cierre y
> en el §0 de [`010-wealth-assets-management.md`](proposals/010-wealth-assets-management.md).

### Dos decisiones del usuario del 2026-09-21

**1. Los eventos se van a una aplicación aparte.** El RFC 003 quedó `SUPERSEDED` y **no se implementa
acá**: cero tablas nuevas. Un evento tiene dominio propio —participantes, exclusiones, simplificación
de deudas— que no es contabilidad, y lo único que el libro necesita de él es el asiento de recupero
cuando entra la plata. Eso ya tiene camino escrito: el **RFC 012**, cuyo §1 establece que la lógica
de otros negocios vive en sus propias aplicaciones y se integra por API. **Y desbloquea lo que acá era
imposible:** que participen otras personas con cuenta, que el aislamiento multi-tenant prohíbe entre
organizaciones. El fundamento completo está en el §0 bis de
[`003-event-splitting.md`](proposals/003-event-splitting.md), que se conserva porque su §4 —el
algoritmo de reparto— es la herencia de la que arranca esa aplicación.

> **La puerta está escrita y sin construir.** El **RFC 012** figura `APPROVED` desde el 2026-06-23 y
> **no tiene una sola línea de código**: no existen `src/app/api/v1/`, ni `api_keys`, ni
> `integrations` —verificado contra el esquema y contra la base real—. Es anterior al core contable,
> a `bigint` y a la clasificación unificada. **Necesita el mismo contraste que recibieron el 008, el
> 010 y el 003 antes de que nadie escriba ese endpoint**, y hoy su sello autoriza a escribirlo con el
> modelo viejo.

**3. El RFC 012 se contrastó y se reescribió**, y quedó en `DRAFT` esperando tu firma. Cuatro
decisiones: se partió en dos —lo saliente al **RFC 026**—; el endpoint habla en **vocabulario de
dominio direccionado por código de categoría**, no en partida doble cruda, así que la aplicación
satelital no necesita conocer el plan de cuentas; la idempotencia va en **dos capas**; y
`idempotency_keys` gana `organizationId` ahora que no la usa nadie, porque su clave primaria global
deja que dos organizaciones colisionen.

> **Hallazgo de esa ronda:** `idempotency_keys` y `executeIdempotent()` **ya están implementados** y
> **no los usa nadie** —cero consumidores—. Son maquinaria construida para este endpoint, que nunca
> existió. No hay que escribirlos: hay que cablearlos y arreglarles el alcance.

**2. `/contacts` no muestra importes.** Es la libreta de contactos y nada más: sin saldos, sin deudas,
sin netos. Eso vive en las pantallas que son sobre plata. **No hay nada que deshacer** —`/contacts`
hoy no muestra un solo importe, verificado en sus cinco componentes—: cancela trabajo futuro. El §9
del **RFC 008** deja abierto «el neto por contacto en `/contacts`»; ese RFC está `APPROVED` y **no se
edita**, así que la discrepancia queda advertida acá y en el §0 bis del 003.

**Publicado:** el usuario pusheó el 2026-09-21 y `origin/master` quedó en `c8633e0`, con la
consolidación entera adentro. **Acá no va el número de commits de diferencia**, porque el commit que
lo escribe ya lo deja viejo: se cuenta en el momento, con
`git rev-list --count origin/master..HEAD`.

---

### La secuencia que queda

1.  **Aprobar o corregir el RFC 010.** Decisión del usuario; ningún agente aprueba un RFC.
2.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que tiene que recibir el Patrimonio Neto que el 024
    desaloja de `/accounts` —donde **se queda hasta entonces**, por decisión del usuario. Antes de
    tocar código hay que resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
    **Le llegan dos encargos más:** la brecha del §9 del RFC 008 —un préstamo registra el pasivo
    completo el día uno y una compra en cuotas no— y ahora el patrimonio físico del 010, que es la
    razón por la que el 010 fue antes que ella.
3.  **Aprobar o corregir el RFC 012**, reescrito el 2026-09-21 y hoy en `DRAFT`. Es la puerta de
    entrada de asientos externos: lo que habilita la aplicación de eventos y cualquier otra satelital.
    Su mitad saliente —bancos y cotizaciones— se escindió al **RFC 026**, que queda `DRAFT` y **no es
    aprobable todavía**: su §3 declara un bloqueante real, que el repositorio no puede cifrar
    credenciales hoy.
4.  **Inquilinos, incidencias y cap rate**, escindidos del 010 (§8 de ese RFC).
5.  **Los `Result.error` como códigos y no como frases en español** — 201 `fail()` en 13 archivos.
    **Exige RFC propio**: hasta que exista, toda pantalla internacionalizada queda a medias en cuanto
    el servidor rechaza algo ([`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §3).

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
(`129a2f9..99deff1`) y
[`2026-09-21-cierre-categorias-y-rfc-010-003.md`](registro/2026-09-21-cierre-categorias-y-rfc-010-003.md)
(`1dbc993..0428b22`).

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
* **Patrimonio (mock: `/patrimonio`)** — **RFC 010, reescrito el 2026-09-12 y hoy en `DRAFT`.** Activos no financieros: propiedades, autos. Decisión 3 del §4. El único precedente es la tabla `assets` de FinanceApp-WSL. **La ruta en inglés todavía no se eligió** y el RFC no la fija: su §5 deja el nombre y el diseño de pantalla para el plan de ejecución.
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
