# Deuda Técnica — FinanzIA

Este documento registra los puntos de deuda técnica del repositorio, distinguiendo explícitamente entre ítems resueltos y pendientes de refactorización sobre código existente.

---

## § Resuelto (Sprint de Correctitud y Disciplina — Septiembre 2026)

### Correctitud del Dashboard y Métricas
*   [x] **S1 (Sparkline Tipado y Cronología):** Reemplazo de array plano `number[]` por `SparklinePoint[] = { value: number, monthKey: string }[]`. Eliminación de ceros espurios y desfases de índice al navegar entre meses.
*   [x] **S2 (Privacidad en Sparklines):** Integración con `MetricsVisibilityContext`. Tooltip y valores enmascarados con `••••••` cuando el ojito de privacidad está cerrado.
*   [x] **S3 (Porcentajes y Tendencias):** Retorno explícito de `null` / `undefined` cuando no hay historial o base de comparación, evitando variaciones falsas de `+0.0%`.
*   [x] **A5 (Caché Granular DAL):** Eliminación del almacenamiento en memoria de resultados nulos en `monthlySummaryRepository.summaryCache`, previniendo bloqueos de lectura tras la creación de nuevos meses.
*   [x] **M1 (Determinación de Mes en Servidor):** Derivación de la clave de mes actual en el layout raíz del servidor para evitar discrepancias de zona horaria entre cliente y servidor.

### Aspecto Visual y Accesibilidad
*   [x] **S4 (Overflow Hero Card):** Reglas CSS de desbordamiento visible y `allowEscapeViewBox` para evitar que el tooltip del gráfico quede recortado.
*   [x] **S5 (Tokens CSS y Tooltips):** Unificación de tokens semánticos (`var(--border-subtle)`, `--bg-card-glass`) y elevación de capa `z-index: 100` en tooltips.
*   [x] **S6 (Formateo Monetario):** Consistencia de moneda en tooltips alineada con `formatCents` y soporte de locale internacional.
*   [x] **M7 (Tipografía y Espaciado):** Migración de medidas en píxeles fijos a `rem` y `clamp()`, eliminando bordes separadores duplicados.
*   [x] **S7 / M5 (Internacionalización i18n):** Claves completas para `header.monthSelector` en diccionarios `es.json`, `en.json` y `br.json`.
*   [x] **M5b (Etiquetas de Mes Dinámicas):** Generación de etiquetas cortas con `Intl.DateTimeFormat(locale, { month: "short" })`.
*   [x] **M6 (Semántica Accesible del Diálogo):** Roles `dialog`, `aria-modal="true"`, `aria-expanded`, soporte de tecla `Escape` y retorno de foco al elemento disparador.

### Límites de Navegación y Rutas
*   [x] **M2 (Contextualización del Selector):** Ocultamiento del `MonthSelector` en `/accounts` y `/subscriptions`, donde las vistas no admiten filtro por mes.
*   [x] **M3 (Límite Mínimo de Navegación):** Cálculo de `minKey` en base de datos (`findEarliestMonthKey`) y bloqueo de navegación retroactiva anterior al primer registro de la organización.

### Calidad de Código, Entorno y CI
*   [x] **ESLint (`set-state-in-effect`):**
    *   Migración de `NotificationsContext` a `useSyncExternalStore`.
    *   Derivación síncrona en `InstitutionLogo` mediante `useMemo`.
    *   Inicialización perezosa y manejo de estado en eventos en `CreateFinancialEntityForm`.
    *   Resultado: **0 errores de ESLint** en todo el proyecto.
*   [x] **Validación Zod de Entorno:** Módulo `src/shared/lib/env.ts` con `obtenerEnv()` lazy y validación de protocolos de conexión; eliminación del fallback silencioso a localhost en producción.
*   [x] **Compuerta CI en GitHub Actions:** Pipeline `.github/workflows/compuerta.yml` con contenedor de servicio PostgreSQL, Node 20, pnpm 11.3.0, typecheck, lint, 182 tests unitarios y build de producción.

---

## § Abierto (Pendiente de Refactorización)

### 1. Retrocompatibilidad en Componentes Legacy
*   [ ] **Migración total a `SparklinePoint[]`:** `AccountsContainer.tsx` y `DashboardSandbox.tsx` aún conservan consumo de arrays planos `number[]`. Deben migrarse a la interfaz tipada `{ value: number, monthKey: string }[]`.
*   [ ] **Limpieza de warnings menores de Next.js Image:** Reemplazar etiquetas nativas `<img>` en `SubscriptionIcon.tsx` y `AddSubscriptionModal.tsx` por `<Image />` o un loader optimizado de `next/image`.

### 2. Persistencia y Modelado del Módulo de Suscripciones
*   [ ] **Desacoplar suscripciones de memoria mock:** El repositorio `subscriptionRepository.ts` actualmente opera con datos simulados y debe migrarse a las tablas de suscripciones vinculadas a `ledgerTransactions`.

### 3. Rendimiento de Base de Datos
*   [ ] **Índice compuesto en `monthly_summaries`:** Agregar índice sobre `(organization_id, year, month)` para acelerar consultas de rangos históricos `findRecent`.
