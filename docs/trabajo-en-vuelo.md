# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `docs/rfc-010-patrimonio-fisico`, creada el 2026-09-11 sobre `master` ya
consolidado. **No cambiar de rama.**

**Estado:** 🟢 **La sesión de diseño del 2026-09-09 quedó cerrada del todo.** Sus siete propuestas
están escritas: las dos que faltaban —**RFC 010** (patrimonio físico) y **RFC 003** (división de
gastos por eventos)— se cerraron el 2026-09-12. **Ninguna de las dos salió enmienda: las dos salieron
reescritura completa**, y las dos quedan en **`DRAFT`**, que es una bajada deliberada de sello.

> **Por qué bajarles el sello importa más que subirlo.** Las dos estaban `APPROVED` desde el
> 2026-06-23 y ninguna estaba implementada, así que durante quince meses **autorizaron formalmente a
> escribir el esquema equivocado**. Es la trampa que ya se cobró el RFC 006 y el RFC 015, y que el §0
> del RFC 008 documentó por tercera vez. Un texto en `DRAFT` no autoriza nada, que es estrictamente
> mejor que un texto aprobado que autoriza lo incorrecto.

**Próximo paso:** **el usuario aprueba o corrige los dos RFC.** Hasta que alguno pase a `APPROVED`,
no hay código que escribir contra ellos y no hay plan que pasarle a `obra`.

### Lo que el contraste encontró, y que la sesión de diseño no había visto

La sesión de diseño pedía «contrastar los tipos de las columnas». Debajo de eso había dos agujeros
estructurales, uno por RFC, y son los que obligaron a reescribir en vez de enmendar:

*   **RFC 010 — el activo nunca entraba al libro.** Un departamento de USD 100.000 no aparecía en el
    patrimonio neto, porque `AccountsContainer.tsx:97-98` lo calcula sumando `accounts.balance` y ese
    departamento no tenía cuenta. Además el RFC decía vincular cada movimiento «al ID del activo», y
    **`ledgerTransactions` no tiene ninguna columna de instrumento** (`:82-102`): el vínculo con un
    instrumento *es la cuenta contable*. Es la misma clase de error que el `remainingBalance` del 008
    de junio — dinero modelado fuera del libro.
*   **RFC 003 — el evento era un segundo libro.** Repartía plata entre participantes y la resolvía
    cambiando un `status`, sin emitir un solo asiento; y su §4 mandaba que al confirmar «la deuda
    contable **se elimina**», cuando el libro es inmutable y `ledgerTransactions:90-93` lo dice en el
    propio esquema. Aparte, **ninguna de sus cuatro tablas llevaba `organizationId`** y los
    participantes se modelaban contra `users` en vez de `contacts`.

**Y un error de conteo que circulaba por tres documentos:** el RFC 024 §9, la sesión de diseño y este
mismo doc decían que el RFC 010 tenía **siete** columnas monetarias en `integer`. **Son cuatro**
(`purchase_price`, `value`, `rent_amount`, `cost`); `square_meters` y `year` también son `integer` y
está bien que lo sean, porque no son dinero. El número se propagó de documento en documento sin que
nadie lo contara contra el archivo. Corregido en la sesión de diseño y acá; **en el RFC 024 no, que
es texto `APPROVED` y no se edita** — la discrepancia queda advertida en el §0 del 010.

### Las cinco decisiones que el usuario cerró el 2026-09-12

Con `AskUserQuestion`, una pregunta por vez, y eligió la recomendada en las cinco.

1.  **El revalúo va contra patrimonio, no contra resultados.** Debe Activo / Haber `Reserva por
    revalúo` (equity). Si fuera contra una cuenta `4.x`, los USD 25.000 de una revalorización
    aparecerían como **ingreso del mes** en la página de estadísticas, distorsionando sus cinco
    métricas con plata que no entró a ninguna cuenta.
2.  **El RFC 010 se acota al núcleo patrimonial.** Activos, valuaciones e imágenes. **Inquilinos e
    incidencias escindidos** a propuestas propias, con el precedente del 008, que escindió las cuotas
    al 025. Un contrato de alquiler no es una tabla: es el motor de recurrencias del RFC 023 entero.
3.  **La cuenta del activo nace con `getNextCode( "asset" )`**, o sea `1.1.01.NN`, igual que tarjetas
    y préstamos. Contablemente un inmueble es activo **no** corriente, pero el repositorio no
    distingue corriente de no corriente **para nadie**: usar `1.1.01` mantiene la regla en vez de
    abrir una excepción. **Deuda declarada**, no resuelta.
4.  **El vínculo activo↔cuenta es una columna `accountId`, no una tabla puente.** Único apartamiento
    deliberado del RFC 024 §4, y el motivo es que dos cuentas espejo sobre el mismo inmueble lo
    meterían **dos veces** en el patrimonio neto. Con columna 1:1 eso es imposible por construcción;
    con tabla puente sería apenas una prohibición escrita, porque el `unique (assetId, currency)` de
    los otros instrumentos no impide la segunda fila.
5.  **El evento toca el libro sólo al cobrar**, contra `4.1.05 Reintegros y devoluciones`, que **ya
    existe** (`initialCatalog.ts:220`). El gasto entró por su camino normal cuando se pagó; el evento
    sólo reparte. Se descartó apoyarse en `loans` con `direction: 'lent'` —que modela lo mismo— por
    un detalle de implementación: `loansActions.ts:141` crea **una cuenta contable por préstamo**, y
    diez asados con cuatro amigos serían cuarenta cuentas en el plan.

### La secuencia que queda

1.  **Aprobar o corregir los RFC 010 y 003.** Decisión del usuario; ningún agente aprueba un RFC.
2.  **La página de estadísticas** — sin RFC y sin nombre de ruta elegido. Es la que lee la dimensión
    de categoría que construyó el RFC 022, y la que tiene que recibir el Patrimonio Neto que el 024
    desaloja de `/accounts` —donde **se queda hasta entonces**, por decisión del usuario. Antes de
    tocar código hay que resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
    **Le llegan dos encargos más:** la brecha del §9 del RFC 008 —un préstamo registra el pasivo
    completo el día uno y una compra en cuotas no— y ahora el patrimonio físico del 010, que es la
    razón por la que el 010 fue antes que ella.
3.  **Internacionalizar `CategoriesSettingsContainer`** — 766 líneas de español directo en buscador,
    modales y confirmaciones. Es el único resto de i18n de `/settings`
    ([`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §3). **Es la única tanda de código lista para plan.**
4.  **El neto por contacto en `/contacts`** — hoy no muestra un solo importe. Lo dejan abierto el §9
    del RFC 008 y ahora también el §9 del RFC 003: **cuando se escriba tiene que sumar las dos
    fuentes**, préstamos y eventos, o mostrará la mitad del cuadro.
5.  **Inquilinos, incidencias y cap rate**, escindidos del 010 (§8 de ese RFC).

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
