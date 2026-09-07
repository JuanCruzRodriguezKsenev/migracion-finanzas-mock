# Deuda Técnica — FinanzIA

Este documento registra los puntos de deuda técnica del repositorio, distinguiendo explícitamente entre ítems resueltos y pendientes de refactorización sobre código existente.

---

## § Resuelto (Sprint de Correctitud y Disciplina — Septiembre 2026)

### Correctitud del Dashboard y Métricas
*   [x] **S1 (Sparkline Tipado y Cronología Definitivo):** Reemplazo de array plano `number[]` por `SparklinePoint[] = { value: number, monthKey: string }[]` en los 7 gráficos de la aplicación (`page.tsx`, `AccountsContainer.tsx`, `DashboardSandbox.tsx`). Eliminación completa de la prop `data?: number[]`, `referenceDate` y derivación posicional en `Sparkline.tsx`.
*   [x] **Saneamiento de datos en `/accounts`:** Eliminación de datos inventados (`+300000` y `totalExpense` como pasivos) en las tarjetas de Activos y Pasivos de `/accounts`.
*   [x] **S2 (Privacidad en Sparklines):** Integración con `MetricsVisibilityContext`. Tooltip y valores enmascarados con `••••••` cuando el ojito de privacidad está cerrado.
*   [x] **S3 (Porcentajes y Tendencias):** Retorno explícito de `null` / `undefined` cuando no hay historial o base de comparación, evitando variaciones falsas de `+0.0%`.
*   [x] **A5 (Caché Granular DAL):** Eliminación del almacenamiento en memoria de resultados nulos en `monthlySummaryRepository.summaryCache`, previniendo bloqueos de lectura tras la creación de nuevos meses.
*   [x] **M1 (Determinación de Mes en Servidor):** Derivación de la clave de mes actual en el layout raíz del servidor para evitar discrepancias de zona horaria entre cliente y servidor.

### Aspecto Visual y Accesibilidad
*   [x] **S4 (Overflow Hero Card):** Reglas CSS de desbordamiento visible y `allowEscapeViewBox` para evitar que el tooltip del gráfico quede recortado.
*   [x] **S5 (Tokens CSS y Tooltips):** Unificación de tokens semánticos (`var(--border-subtle)`, `--bg-card-glass`) y elevación de capa `z-index: 100` en tooltips.
*   [x] **S6 (Formateo Monetario):** Consistencia de moneda en tooltips alineada con `formatCents` y soporte de locale internacional.
*   [x] **M7 (Tipografía y Espaciado):** Migración de medidas en píxeles fijos a `rem` y `clamp()`, eliminando bordes separadores duplicados.
*   [x] **S7 / M5 (Internacionalización i18n):** Claves completas para `header.monthSelector` (incluyendo `prevYear` y `nextYear`) en diccionarios `es.json`, `en.json` y `br.json`.
*   [x] **M5b (Etiquetas de Mes Dinámicas):** Generación de etiquetas cortas con `Intl.DateTimeFormat(locale, { month: "short" })`.
*   [x] **M6 (Semántica Accesible del Diálogo):** Rol `dialog`, eliminación de `aria-modal="true"` innecesario en popover no modal, vinculación dinámica mediante `useId()`, soporte de tecla `Escape` y retorno de foco.

### Límites de Navegación y Rutas
*   [x] **M2 (Contextualización del Selector):** Ocultamiento del `MonthSelector` en `/accounts` y `/subscriptions`, donde las vistas no admiten filtro por mes.
*   [x] **M3 (Límite Mínimo de Navegación):** Cálculo de `minKey` en base de datos (`findEarliestMonthKey`) y bloqueo de navegación retroactiva anterior al primer registro de la organización.

### Calidad de Código, Entorno y CI
*   [x] **ESLint (0 advertencias y 0 errores en repo completo):**
    *   Migración de `NotificationsContext` a `useSyncExternalStore`.
    *   Derivación síncrona en `InstitutionLogo` mediante `useMemo`.
    *   Inicialización perezosa y manejo de estado en eventos en `CreateFinancialEntityForm`.
    *   Saneamiento de catch bindings opcionales, variables no usadas e imports huérfanos.
    *   Memoización de reglas en `PasswordInput` para satisfacer `exhaustive-deps`.
    *   Exigencia estricta de `--max-warnings 0` en compuerta CI.
*   [x] **Desglose histórico de Activos y Pasivos en `/accounts`:** Incorporación de columnas `assets_snapshot` y `liabilities_snapshot` en la tabla `monthly_summaries` con migración `0012_tranquil_luckman.sql`. Persistencia en `seed.ts` respetando la invariante contable ($\text{Patrimonio Neto} = \text{Activos} - \text{Pasivos}$) y conexión de `SparklinePoint[]` con tendencias dinámicas en las tarjetas de Total Activos y Total Pasivos de `/accounts`.
*   [x] **Prevención de sesiones huérfanas tras reseed y control de FK 23503:** Idempotencia en `seed.ts` con upsert sobre slug de organización demo y email de usuario demo para conservar UUIDs estables entre re-ejecuciones. Revalidación periódica de existencia de la organización en el callback `jwt` de NextAuth (con invalidación de token y redirección a signin en `MainLayout` y `proxy.ts` ante orfandad), y captura de violación de clave foránea (`23503`) en Server Actions contables retornando mensajes amigables al usuario en lugar de excepciones de Postgres.
*   [x] **Validación Zod de Entorno:** Módulo `src/shared/lib/env.ts` con `obtenerEnv()` lazy y validación de protocolos de conexión; eliminación del fallback silencioso a localhost en producción.
*   [x] **Compuerta CI en GitHub Actions:** Pipeline `.github/workflows/compuerta.yml` con contenedor de servicio PostgreSQL, Node 26, pnpm 11.3.0, typecheck, lint (`--max-warnings 0`), 184 tests unitarios y build de producción. Verificada en ejecución remota.
*   [x] **Módulo de Transacciones Contables (`/transactions`):** Soporte integral de partida doble, fecha de ocurrencia `occurred_at` indexada con migración `0014_real_komodo.sql`, paginación por cursor determinístico `(occurred_at, id)` previniendo desfases por inserciones concurrentes, reversión contable atómica (ACID) con Outbox Pattern (`TRANSACTION_REVERSED`), componentes accesibles `DataTable` y `SearchInput` en `shared/ui/`, y modales de alta/edición integrados.

### Integridad Contable Multimoneda y Reversión
*   [x] **Integridad multimoneda y cambio de divisas:** El balance Debe = Haber se valida por moneda y dentro de la transacción ACID; la moneda de un asiento la impone su cuenta (`accountingService.ts`), lo que impedía que un saldo en pesos acumulara centavos de dólar. Las contrapartidas de gasto e ingreso se crean por divisa (`5.1.01.99-<MONEDA>`). Nuevo tipo de transacción **cambio**: cuatro asientos en dos libros contra cuentas de posición `3.3.01-<MONEDA>`, con la cotización deducida del cociente en vez de almacenada.
*   [x] **Reversión irrepetible y consultable:** Bloqueo de la fila original, guarda sobre `reversed_at` y vínculo bidireccional (`reverses_transaction_id`). Antes se podía reversar dos veces y duplicar la devolución de saldos; el nexo sólo vivía en el payload del outbox, así que la interfaz no podía marcar una transacción como reversada.
*   [x] **Índice redundante eliminado:** `ledger_tx_org_occurred_idx` estaba cubierto por prefijo por `ledger_tx_org_occurred_id_idx` y sólo costaba escrituras (migración `0015`).

## § Abierto (Pendiente de Refactorización)

### 1. Visualización y Gráficos
*   [ ] **Limitación de escala categórica en Recharts Sparkline:** En gráficos de línea categóricos sin eje X continuo, Recharts reserva padding discreto en bandas laterales, lo que evita que el trazo toque los bordes exactos del contenedor (a diferencia de un path SVG manual directo). Si a futuro se requiere renderizado borde a borde absoluto, evaluar cálculo directo de coordenadas SVG o escala continua.

### 2. Persistencia y Modelado de Datos
*   [ ] **Vincular suscripciones recurrentes con asientos de `ledgerTransactions`:** El módulo de suscripciones persiste en Postgres vía Drizzle, pero opera de forma aislada sin emitir asientos contables ni débitos automáticos en el libro mayor.

### 3. Rendimiento de Base de Datos
*   [ ] **Índice compuesto en `monthly_summaries`:** Agregar índice sobre `(organization_id, year, month)` para acelerar consultas de rangos históricos `findRecent`.
*   [ ] **Índice para polling en `outbox_events`:** La tabla `outbox_events` no cuenta con índice sobre `status` o `(status, created_at)`. Las consultas del futuro dispatcher realizarían un sequential scan sobre una tabla en crecimiento continuo.
