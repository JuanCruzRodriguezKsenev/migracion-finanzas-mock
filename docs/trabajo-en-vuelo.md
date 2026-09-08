# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `master`. No hay trabajo a medias.

**Estado:** 🟢 **`feat/preferencias-canonicas` quedó consolidada en `master` el 2026-09-08**, por fast-forward y sin conflictos. Son 6 commits (`492b8cf..1ba3d37`): la aprobación del **RFC 015** sobre texto enmendado contra el esquema real —era el último de los 21 en `DRAFT`— y la primera tajada ejecutable de ese RFC, que normaliza las preferencias de perfil a códigos canónicos (ISO 4217 / IANA / BCP 47), migra las filas existentes con backfill en `0021_thick_corsair.sql`, cierra el escalamiento de plan en `updateProfileAction` con Zod `.strict()` y cablea el formateo monetario al locale del usuario. El detalle congelado está en [`registro/2026-09-08-cierre-preferencias-canonicas.md`](registro/2026-09-08-cierre-preferencias-canonicas.md).

**Batería sobre `master` en `1ba3d37`:** 41 archivos de test, 321 tests, `pnpm lint` en 0, `pnpm exec tsc --noEmit` en 0 errores y `pnpm build` verde. Los cuatro, con el typecheck como comando propio.

**`master` no está pusheado:** el trabajo vive local, por delante de `origin/master`. El push queda a tu criterio.

**Próximo paso de desarrollo:**
El módulo lo define el artifact de la hoja de ruta, no este documento. Lo que **no** corresponde tomar todavía es el resto del RFC 015: la consolidación multimoneda de su §4 consulta `wealthAssets` y `loans`, y ninguna de las dos tablas existe. Se retoma cuando estén las tablas de riqueza y deudas.

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
