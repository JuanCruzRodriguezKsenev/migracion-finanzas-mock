# Registro de Cierre — Plan de Punta a Punta FinanzIA (Tandas 0 a G)

* **Fecha de consolidación:** 2026-09-06
* **Rama base:** `master`
* **Resultado global:** 182 tests unitarios pasando en 24 archivos de prueba; 0 errores de ESLint; compilación de producción exitosa; compuerta de CI en GitHub Actions activa.

---

## Detalle de Tandas Consolidadas

### Tanda 0 — Gobernanza Base (`docs/gobernanza-base`)
* **Commit:** `36b0019`
* **Entregables:**
  * Creación del documento canónico de seguimiento en vivo `docs/trabajo-en-vuelo.md`.
  * Incorporación de sección §8 en `.agents/AGENTS.md` ("Lo que este proyecto cobra caro") con las 5 reglas inviolables contables verificadas contra el código.
  * Vinculación de punteros en `CLAUDE.md`.

### Tanda A — Correctitud del Dashboard (`fix/dashboard-correctitud`)
* **Commit:** `2661f8e`
* **Entregables:**
  * **S1:** Sparkline tipado con `SparklinePoint[] = { value: number, monthKey: string }[]`, ordenado cronológicamente y sin ceros espurios.
  * **S2:** Integración del ojito de privacidad (`MetricsVisibilityContext`) en Sparklines y tooltips (`••••••`).
  * **S3:** `calcularCambioPorcentual` y tendencias retornan `null` / `undefined` ante bases nulas o sin historial previo.
  * **A5:** Corrección en `monthlySummaryRepository.ts` eliminando el cacheo de resultados negativos (`null`) en `summaryCache`.
  * **M1:** Clave de mes actual `currentMonthKey` derivada en el servidor en `layout.tsx` y propagada hacia el encabezado.

### Tanda B — Pulido Visual y CSS (`fix/dashboard-visual`)
* **Commit:** `b41b0b3`
* **Entregables:**
  * **S4:** Reglas de desbordamiento visible en tarjetas hero y `allowEscapeViewBox` para evitar recorte de tooltips.
  * **S5:** Unificación de stroke y tema claro en Sparkline con token `var(--border-subtle)` y elevación de capa `z-index: 100`.
  * **S6:** Armonización de formateo de moneda en `CustomMiniTooltip` alineada con `formatCents`.
  * **M7:** Reemplazo de px fijos por `rem` y `clamp()` en `MonthSelector.module.css`; eliminación de doble borde separador.
  * **S8:** Estabilización de altura y renderizado de gráficos sin flashes de montaje.

### Tanda C — Internacionalización y Accesibilidad (`fix/dashboard-i18n-a11y`)
* **Commit:** `12a9c5c`
* **Entregables:**
  * **S7 / M5:** Claves completas `header.monthSelector` añadidas en diccionarios `es.json`, `en.json` y `br.json`.
  * **M5b:** Generación dinámica de nombres cortos de mes con `Intl.DateTimeFormat(locale, { month: "short" })`.
  * **M6:** Accesibilidad de diálogo completo (`role="dialog"`, `aria-modal="true"`, `aria-expanded`, `aria-controls`), navegación por teclado con `Escape` y retorno de foco al disparador.
  * **M4 / M8:** Botón rápido al mes actual (`todayKey`) y normalización de clases condicionales.

### Tanda D — Límites y Rutas del Selector (`feat/month-selector-limites`)
* **Commit:** `6e7bbe8`
* **Entregables:**
  * **M2:** Ocultamiento contextual del selector de mes en rutas `/accounts` y `/subscriptions`.
  * **M3:** Consulta de clave más antigua en base de datos (`findEarliestMonthKey` en `monthlySummaryRepository.ts` y `getEarliestMonthKeyAction`).
  * Bloqueo de avance retroactivo (`isPrevDisabled`), bloqueo de navegación anual (`viewYear <= minYear`) y meses deshabilitados en la grilla.

### Tanda E — Limpieza de ESLint (`fix/lint-set-state-in-effect`)
* **Commit:** `4cdb0ad`
* **Entregables:**
  * Migración de `NotificationsContext` a `useSyncExternalStore` con `notificationStore` desacoplado.
  * Derivación síncrona en `InstitutionLogo` con `resolveDirectLogo` en `useMemo`.
  * Inicialización perezosa y manejo de estado en eventos de usuario en `CreateFinancialEntityForm`.
  * Reducción a exactamente **0 errores de ESLint**.

### Tanda F — Validación Zod de Entorno (`feat/env-validado`)
* **Commit:** `70b147d`
* **Entregables:**
  * Módulo `src/shared/lib/env.ts` con esquema Zod `envSchema` y función evaluada con caché `obtenerEnv()`.
  * Eliminación del fallback silencioso a localhost en `src/shared/db/client.ts`.
  * 7 tests unitarios en `src/shared/lib/env.test.ts`.
  * Actualización de `.env.example` y `README.md`.

### Tanda G — Compuerta de CI (`ci/compuerta`)
* **Commit:** `a190447`
* **Entregables:**
  * Pipeline `.github/workflows/compuerta.yml` con servicio PostgreSQL, Node 20, pnpm 11.3.0, typecheck, lint, pruebas unitarias y compilación de producción.
  * Anclaje explícito de `"packageManager": "pnpm@11.3.0"` en `package.json`.
