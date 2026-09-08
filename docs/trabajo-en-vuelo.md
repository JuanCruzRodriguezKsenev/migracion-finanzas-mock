# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/preferencias-canonicas` (sale de `master`). Plan ejecutado: [`planes/normalizar-preferencias-perfil.md`](planes/normalizar-preferencias-perfil.md).

**Estado:** 🟢 **Completado y verificado en la rama.** Se ejecutaron los 7 pasos del plan [`planes/normalizar-preferencias-perfil.md`](planes/normalizar-preferencias-perfil.md). Se creó el catálogo canónico de preferencias [`src/features/profile/preferences.ts`](../src/features/profile/preferences.ts), se actualizaron los defaults en el esquema Drizzle y se aplicó la migración `0021_thick_corsair.sql` con backfill sobre PostgreSQL. Se sincronizaron los productores de datos (`DEFAULT_PROFILE` en layout y los dos bloques en `seed.ts`). Se protegió `updateProfileAction` mediante validación Zod estricta (`updateProfileSchema`) impidiendo la alteración de campos comerciales (`planName`, etc.) y el ingreso de etiquetas de UI. Se cablearon las 8 llamadas de `formatCurrency` al locale dinámico del perfil (`profile.numberFormat`), y se agregaron 16 tests unitarios en `profile/`.

**Fuera de alcance, y nombrado para que no se filtre:** `exchange_rates` y la consolidación de patrimonio (dependen de tablas inexistentes), multi-workspace (`users.organization_id` es `NOT NULL`; es cambio de modelo, RFC propio) y la ruta `/perfil`.

**Verificación independiente (2026-09-08), sobre `002e7c7`:** `pnpm test` 41 archivos / 321 tests en verde · `pnpm lint` 0 · `pnpm exec tsc --noEmit` 0 errores · `pnpm build` verde. Las cinco columnas de `profiles` y sus `column_default` quedaron en códigos canónicos en la base real.

Sobre esa verificación se corrigió un borde: `ProfileContext.updateProfile` pasa a tipar `UpdateProfileInput` en lugar de `Partial<ProfileData>`. Ese `Partial` incluía `planName`, `userId` y `createdAt`, que el `.strict()` del esquema rechaza en runtime sin aviso del compilador; era una trampa armada para quien construya la UI de `/perfil`.

**Próximo paso de desarrollo:**
1.  Merge a `master` y congelamiento de sección en `registro/`.
2.  Retomar la consolidación multimoneda en rondas posteriores cuando existan las tablas de riqueza y deudas.

**Pendiente menor detectado al verificar, no ejecutado:** el catálogo de `preferences.ts` (`etiquetaDe`, `PREFERENCE_CATALOG`, `LABEL_TO_CODE_MAP`) todavía no tiene consumidor de producción — sólo tests —, porque `/perfil` quedó fuera de alcance; y `formatCurrency` no protege el locale contra un valor heredado no-BCP-47 que el `ELSE` del backfill haya preservado. Ninguno es bug activo con los datos de hoy.

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
