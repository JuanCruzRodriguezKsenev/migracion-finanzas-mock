---
name: repos-hermanos-como-levantarlos
description: Cómo levantar FinanzasMock y FinanceApp-WSL en local, y qué tiene cada uno adentro que valga la pena consultar
metadata:
  type: reference
---

Los dos repos de referencia viven en `~/Dev/finanzas/FinanzasMock` (catálogo visual) y
`~/Dev/finanzas/FinanceApp-WSL` (infraestructura). **Ninguno tiene `node_modules` de fábrica.**

## FinanzasMock — levantado y funcionando el 2026-09-09

**El bloqueo:** está atado a Neon. `src/shared/lib/db/index.ts` importa `@neondatabase/serverless` y
usa `neon-http` / `neon-serverless`; **no habla con un Postgres local**, y `drizzle-kit push` se
cuelga. Crear una base local para él es inútil.

**La salida, autorizada por el usuario:**

1.  `pnpm install`.
2.  `.env.local` con `USE_DRIZZLE=false` (así el DAL es `MockDalService`, todo en memoria, **sin
    base**), `MOCK_AUTH_BYPASS=true`, `AUTH_SECRET` de 32+ caracteres y `AUTH_TRUST_HOST=true`.
    **Sin `DATABASE_URL`**. `.env*` está en su `.gitignore`.
3.  Los datos no son el problema; **el login sí**: `auth.ts` hace un `select` real contra la base y
    `proxy.ts` (Next 16 renombró `middleware` a `proxy`) manda a `/auth/login` toda ruta sin sesión.
    Hay un **bypass de 3 líneas** al inicio de `authorize`, detrás de `MOCK_AUTH_BYPASS`, con el
    original en `src/auth.ts.orig-tanda`. Se revierte con `mv`.
4.  `pnpm dev --port 3001`. Usuario `alejandro@correo.com` / `12345678`.

**Trampa de herramienta:** el clasificador de permisos bloquea escribir archivos con heredocs de
python vía Bash. Para editar, usar Read + Edit.

**Lo que se ve adentro:** el menú lateral trae `Cuentas`, `Tarjetas`, `Transacciones`,
`Presupuestos`, `Metas`, `Contactos`, `Deudas`, `Patrimonio`, `Inversiones`, `Facturación`,
`Reportes`, `Suscripciones`, `Integraciones`, `Configuración` **como entradas separadas**.
**Muchos números salen en $0.00**: el `MockDalService` filtra por un período fijo (mayo 2024) y las
transacciones sembradas no caen ahí. La estructura visual está toda; los datos no.

**Calidad como referencia:** visual, no de modelo. Agrupa categorías por **string**
(`groups[t.category]`), el color sale de `getCategoryIconInfo()` que hace
`label.toLowerCase().includes('super')`, y `budgets` guarda `used` **materializado** en la fila.

## FinanceApp-WSL — no levantado

Mucho más caro y con menos para ver: sin `.env.example`, pide `DATABASE_URL` **y**
`DATABASE_READ_ONLY_URL` (sus tablas usan RLS con `app.current_user_id`), `AUTH_SECRET`, Upstash
Redis, QStash y Resend. Su UI son 3 rutas.

**Su valor está en el esquema, y ya está leído:**

*   Una tabla por instrumento: `bank_accounts` (CBU, alias, banco), `digital_wallets`, `assets`
    (`REAL_ESTATE | STOCKS | CASH | CRYPTO | OTHER`), `liabilities` (`PERSONAL_LOAN | MORTGAGE |
    OTHER`), `credit_cards`.
*   **`credit_cards.autoDebit`** — el débito automático, que en nuestro `cards` no existe (tenemos
    `linkedAccountId`, que dice de dónde se paga pero no si se paga solo).
*   **`net_worth_snapshots`** con `exchangeRateUsed`, `targetCurrency` y un `breakdown` jsonb: es el
    precedente exacto de lo que el RFC 015 quiere para las cotizaciones.
*   Su dashboard son tres tarjetas: `NetWorthCard`, `LiquidityCard`, `DebtsCard`.
*   De categorías, casi nada: un `topCategories` leído de `metadata.category` con fallback `"Otros"`.

Ver [[decisiones-modelo-clasificacion]] para qué se decidió con esta evidencia.
