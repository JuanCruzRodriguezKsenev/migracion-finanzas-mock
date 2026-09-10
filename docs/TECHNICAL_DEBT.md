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

### Despachador de Eventos Outbox (RFC 020)
*   [x] **Despachador desacoplado, índice y purga en `outbox_events`:** Implementación de `outboxDispatcher.ts` con ciclo en 3 pasos (reclamo atómico con `SKIP LOCKED` a `PROCESSING`, despacho fuera de transacción de BD, y asentamiento final a `SENT` o reintento con backoff hasta `MAX_ATTEMPTS = 5`). Recuperación automática de eventos `PROCESSING` colgados con TTL de 5 minutos (`recoverStaleProcessing`), purga periódica de eventos `SENT` con más de 30 días (`purgeOldSentEvents`), script CLI `db:outbox` (`dispatchOutbox.ts`) e índice `outbox_status_created_idx` sobre `(status, created_at)` con migración `0016_eminent_roxanne_simpson.sql`.

### Rendimiento y Optimización de Base de Datos
*   [x] **Índice compuesto único en `monthly_summaries`:** Creación de índice único `monthly_summaries_org_year_month_unique` sobre `(organization_id, year, month)` con migración `0017_free_iron_monger.sql`, acelerando consultas de rangos históricos `findRecent` e impidiendo duplicados de resumen para un mismo período contable.
*   [x] **Migración de columnas monetarias a `bigint` (RFC 019):** Ensanchamiento de 9 columnas que manejan dinero en centavos (`accounts.balance`, `ledger_entries.debit/credit`, `monthly_summaries.total_revenue/total_expense/balance_snapshot/assets_snapshot/liabilities_snapshot`, `subscriptions.amount`) a `bigint(..., { mode: "number" })` con migración `0018_slimy_wiccan.sql`. Previene el desbordamiento aritmético de runtime en PostgreSQL ($2^{31} - 1 \approx \$21.4\text{M}$) manteniendo compatibilidad transparente con `number` en JS/TS hasta $2^{53} - 1$.

### Entidades Financieras y Cuentas Propias
*   [x] **Separación del alta de entidades financieras y emisión de asientos de apertura:** `createFinancialEntityAction` quedó desacoplada como alta pura a nivel organización sin crear cuentas contables asociadas por defecto. La creación de la cuenta asociada se extrajo a `createAccountForEntityAction`, que garantiza la partida doble emitiendo un asiento contable contra Patrimonio Neto (`3.1.01.01`) si se ingresa saldo inicial. Se agregó la columna `brand_domain` (migración `0020_soft_fixer.sql` con backfill), se protegió la selección de logos e iconos en `CreateFinancialEntityForm`, y se añadió la prop `withOwnAccount` para que el flujo de métodos de cobro de contactos (`PaymentMethodsPanel`) no cree cuentas propias ni solicite saldo inicial.

### Clasificación Unificada e Imputación Contable (RFC 022 — Primera Tajada)
*   [x] **La categoría elegida por el usuario no tiene ningún efecto contable:** `createTransactionFromFormAction` (`transactionsActions.ts`) ahora imputa directamente el débito o crédito a la cuenta de la categoría elegida (o a la hoja `General` si viene vacía o apunta a un padre) en la moneda de la cuenta de origen.
*   [x] **`obtenerCuentaPorMoneda` descarta el `codigoBase` que recibe (Defecto D1 corregido):** La búsqueda busca por coincidencia exacta de código (`${codigoBase}-${currency}`) y tipo, impidiendo que transacciones de cambio resuelvan contra la cuenta de Patrimonio Neto (`3.1.01.01`) en lugar de `3.3.01-ARS`.
*   [x] **Nadie agrupa por `categoryId` en toda la aplicación:** La categoría es ahora la cuenta contable de resultado; los saldos quedan materializados en `accounts.balance` vinculados a través de `category_accounts`.
*   [x] **El usuario no puede crear categorías:** Implementación completa de Server Actions (`createCategoryAction`, `updateCategoryAction`, `archiveCategoryAction`, `unarchiveCategoryAction`, `getCategoryTreeAction`), repositorio `categoryRepository` y generador correlativo `getNextCategoryCode` con reserva de la hoja `General` (`.99`), soporte de mudanza automática R3 y protección de borrado mediante archivo lógico (R4).

### Gestión de Categorías y Selector Jerárquico (RFC 022 — Segunda Tajada)
*   [x] **Selector de categorías jerárquico y alta al vuelo:** `TransactionFormModal` migrado de un `<select>` plano a un selector jerárquico `<optgroup>` filtrado por tipo contable (`expense`/`revenue`), sin hojas `isSystemLeaf` expuestas y con formulario inline de alta rápida que autoselecciona la categoría creada.
*   [x] **Pantalla de gestión de categorías en `/settings`:** Pestaña inicial de Configuración con layout de dos columnas (padres a la izquierda con contador de subcategorías, ficha a la derecha con color e ícono a la vista), navegación accesible, exclusión de códigos contables y confirmación informada de archivado por cantidad de movimientos históricos en el libro mayor (`countByCategories`).
*   [x] **`subscriptions.category` migrado a `categoryId`:** Migración `0024_remarkable_stepford_cuckoos.sql` con agregado de `category_id uuid references categories(id) on delete set null`, backfill automático de los 7 valores canónicos a subcategorías del catálogo (`5.1.09.01` a `5.1.09.06` y `5.1.09.99` para general/other) y eliminación de la columna obsoleta `category`. Actualización de esquema Zod, modal de alta `AddSubscriptionModal` y tests de repositorio.
*   [x] **Navegación completa a `/settings` y `/cards`:** Integración de enlaces de navegación en `Navbar` y `BottomNav`.

#### Bandeja de Recurrencias y Ejecución Contable (RFC 023)
*   [x] **Vinculación de suscripciones con el libro mayor (`ledgerTransactions`):** Implementación de la bandeja de transacciones propuestas sobre el treemap en `/subscriptions`, confirmación atómica al libro mayor (asiento Debe = Haber en transacción ACID única con avance de `resolved_through` y recálculo de `nextPaymentDate`), guarda de idempotencia y secuencia cronológica, y opción de descarte sin asiento contable.
*   [x] **Corrección de `addInterval` sin desborde en fin de mes:** Derivación anclada en el día nominal (`anchorDay`) y recorte al último día del mes mediante `recortarDia` de `cards/utils/ciclo.ts`, evitando saltos y desvíos permanentes al operar con fin de mes (e.g. 31 de enero -> 28/29 de febrero -> 31 de marzo).
*   [x] **Resolución unificada de categoría padre → hoja (`categoryRepository.resolveToLeaf`):** Extracción del resolutor a hoja imputable reutilizable en `categoryRepository`, eliminando la duplicación existente en `transactionsActions.ts` y garantizando fallback determinístico a la hoja general del padre o catálogo.

## § Abierto (Pendiente de Refactorización)

### 1. Visualización y Gráficos
*   [ ] **Limitación de escala categórica en Recharts Sparkline:** En gráficos de línea categóricos sin eje X continuo, Recharts reserva padding discreto en bandas laterales, lo que evita que el trazo toque los bordes exactos del contenedor (a diferencia de un path SVG manual directo). Si a futuro se requiere renderizado borde a borde absoluto, evaluar cálculo directo de coordenadas SVG o escala continua.
*   [ ] **Convivencia de formateadores monetarios (`formatCents` vs `formatCurrency`):** Hoy conviven dos formateadores monetarios: `formatCents` (`src/features/accounting/utils/dashboardMetrics.ts`, más antiguo, sin parámetro de divisa ni de locale) y `formatCurrency` (`src/shared/lib/currencyFormatter.ts`, moderno, con resolución dinámica de decimales por divisa y soporte de locale internacional vía `Intl`). Además, `.agents/AGENTS.md` §8.2 todavía nombra a `formatCents` como el canónico cuando `formatCurrency` lo superó. Pendiente unificar ambos en una sola utilidad compartida.

### 2. Persistencia y Modelado de Datos
*   [ ] **`createAccountForEntityAction` fija `currency: "ARS"` en duro:** la cuenta principal que se crea para una entidad financiera nace siempre en pesos, en un motor que ya valida Debe = Haber por divisa y opera transacciones de cambio. Una entidad que opera en otra moneda igual recibe cuenta en ARS y obliga a corregirla a mano. Detectado al verificar la rama `fix/entidades-financieras` (2026-09-07); no lo introdujo esa rama, venía del alta anterior.
*   [x] **Vincular suscripciones recurrentes con asientos de `ledgerTransactions`:** Resuelto con la bandeja de transacciones propuestas (RFC 023). Las suscripciones emiten asientos de partida doble al confirmarse y registran el avance mediante el puntero `resolved_through`.
*   [ ] **Separación de datos de suscripción comercial de la tabla `profiles`:** `planName`, `planBilling` y `planNextCharge` son datos de suscripción comercial SaaS mezclados en la tabla de preferencias y perfil de usuario. Aunque la acción `updateProfileAction` fue asegurada con Zod estricto para impedir su manipulación desde el cliente, deberían residir en su propia tabla relacional.
*   [ ] **Intereses y comisiones de tarjetas sin devengar periódicamente:** Las columnas `interestRateFinancing`, `monthlyMaintenanceFee` y `annualRenewalFee` están modeladas en la tabla `cards`, pero ningún proceso automático las devenga contablemente en la fecha de cierre. Su devengamiento periódico depende de los crons y workers de fondo de la Fase 3.
*   [ ] **Disponible de tarjetas de crédito no descuenta cuotas futuras pendientes:** El cálculo de disponible para compras (`Disponible = Límite − Deuda total`) no descuenta el saldo remanente de compras en cuotas hasta que se implemente el modelo relacional de cuotas (`installmentPlans`, RFC 008).

### 3. Preferencias de Usuario y Perfil
*   [ ] **El catálogo de `preferences.ts` no tiene consumidor de producción:** los códigos canónicos (ISO 4217, IANA, BCP 47) que la migración `0021` dejó en `profiles` sólo los usan los tests. La causa es que **no existe la ruta de edición del perfil**, que quedó fuera del alcance de la ronda de preferencias canónicas (2026-09-08) a propósito. Comprometido para una ronda propia; por la convención de rutas de `ARCHITECTURE.md` §4 la ruta se llama **`/profile`**, no `/perfil`.
*   [ ] **`roundAmounts` se persiste pero nadie lo lee:** la preferencia existe en la tabla y en el catálogo, y ningún formateador la consulta. Mismo origen que el punto anterior: sin pantalla de edición no se cerró el circuito.
*   [ ] **`/settings` no está internacionalizada:** es la única ruta que no llama a `getDictionary` (seis páginas sí lo hacen) y las 789 líneas de `CategoriesSettingsContainer` llevan los textos en español directo. Detectado el 2026-09-10; se dejó así a propósito al cerrar la segunda tajada del RFC 022, porque internacionalizarla es una tanda propia.
*   [ ] **`formatCurrency` no valida el locale que recibe:** `src/shared/lib/currencyFormatter.ts` pasa el locale directo a `Intl` sin protegerlo contra un valor heredado que no sea BCP 47. Las filas viejas se migraron con el `UPDATE` de la `0021`, pero una fila que escape a ese backfill —o un valor escrito por fuera de la acción— haría lanzar a `Intl` en tiempo de render. Falta un `try/catch` con fallback al locale por defecto y su test.

### 4. Clasificación por Categoría (detectado el 2026-09-09)
Items pendientes tras el RFC 022:
*   [ ] **`accounts` no tiene jerarquía real:** el árbol del plan de cuentas existe sólo como convención dentro del texto del código (`5.1.01.01`), sin `parentId` ni relación consultable.
*   [ ] **Desarchivar un padre no devuelve sus hojas:** `categoryRepository.archive` archiva en cascada las hijas del padre (segundo `UPDATE` por `parentId`), pero `unarchive` sólo toca la fila del padre. El usuario que archiva *Supermercado* con sus cuatro subcategorías y se arrepiente lo recupera **vacío**, y las hijas quedan huérfanas de toda pantalla porque el árbol las filtra por `archivedAt`. Además los dos `UPDATE` de `archive` no van dentro de una transacción: si el segundo falla, el padre queda archivado y las hojas activas. Detectado el 2026-09-10 al verificar la segunda tajada; no lo introdujo esa tanda.
*   [x] **La resolución de categoría padre → hoja está duplicada en la capa de acciones:** Resuelto con `categoryRepository.resolveToLeaf`, reutilizado en `transactionsActions.ts` (ramas expense e income) y en `resolveSubscriptionAction.ts`.

### 6. Signo de los pasivos en `/accounts` (detectado el 2026-09-09)
*   [x] **Causa raíz: `patterns.md` se contradecía a sí mismo.** El §1.4 decía que los pasivos "aumentan por el Crédito (Haber)" —convención contable clásica, saldo positivo— y el §7.2 decía lo contrario con la fórmula del motor (`balance + debit - credit`), llegando a contradecirse dentro de la misma viñeta entre el texto y la fórmula. El §1.5 daba `Patrimonio Neto = Activos - Pasivos` sin aclarar que no se aplica sobre la columna `balance`. **Quien escribió `AccountsContainer.tsx:88` siguió la documentación.** Resuelto el 2026-09-09 con el **§8 de `patterns.md`**, que fija la convención vigente, y la corrección de §1.4, §1.5 y §7.2.
*   [ ] **El Patrimonio Neto de `/accounts` suma la deuda en vez de restarla:** el motor guarda los pasivos en negativo (`accountingService.ts:117` los trata con la misma regla que los activos, así que un consumo de tarjeta deja la cuenta en negativo), y el resto del repositorio respeta esa convención — `accountingActions.ts:99` invierte el signo al alta manual, `CardVisual.tsx:34` calcula la deuda como `-balance`. **`AccountsContainer.tsx:87-88` no:** acumula los pasivos con `sum + a.balance` (total negativo) y después hace `netWorth = totalAssets - totalLiabs`, o sea *activos − (−deuda)*. Con una tarjeta en `-2.500.000` el patrimonio queda inflado en 5.000.000. En la misma pantalla, el "Saldo Neto" por entidad (línea 220) hace la cuenta bien.
*   [ ] **`monthly_summaries` usa la convención de signo opuesta a `accounts`:** el seed guarda `liabilitiesSnapshot` en **positivo** (`activosMes = saldoAcumulado + pasivosMes`), mientras que `accounts.balance` guarda los pasivos en negativo. Las tres métricas de `/accounts` mezclan las dos fuentes: el número grande sale de `accounts` y su sparkline de `monthly_summaries`. Hay que fijar una sola convención y documentarla en `patterns.md`.

### 5. Cálculo de Fechas y Códigos (detectado el 2026-09-09)
*   [x] **`addInterval` deriva en fin de mes** (`subscriptions/utils/calculations.ts:55`): Resuelto en RFC 023 usando anclaje en el día nominal (`anchorDay`) y recorte de mes con `recortarDia`.
*   [ ] **`getNextCode` no sabe anidar y topea en 99** (`accounting/utils/accountCodes.ts`): genera códigos planos (prefijo fijo + correlativo de dos dígitos), así que no puede producir una subcategoría, y al llegar a 100 el `padStart(2, "0")` rompe el formato del código.
*   [ ] **`1.1.01.02 Efectivo en Billetera` tiene balance negativo** (`-1.032.300` en la base local): un activo de efectivo en negativo es imposible. Dato del seed o falta de validación de sobregiro para cuentas de caja.


### 7. Limpieza de la base entre suites de test (detectado el 2026-09-10)
*   [ ] **Cada suite limpia la base a mano, con su propio orden y su propio subconjunto de tablas:** son **14 archivos** de test que abren su `beforeEach` con una lista de `db.delete( ... )` escrita a ojo. Ninguno limpia al salir, así que el último test de cada archivo deja sus filas para el siguiente, y basta que una suite borre una tabla padre sin haber borrado antes sus hijas para que reviente la que corra después. **Ya pasó:** la primera tajada del RFC 022 agregó `DELETE FROM accounts` a cinco suites sin agregar `ledger_entries` ni `ledger_transactions` antes, y la suite completa empezó a fallar en un archivo distinto cada vez — porque vitest ordena los archivos por la duración de la corrida anterior. Se parcheó en `567544f`, pero el patrón sigue: cualquier tabla nueva con FK va a reproducirlo. **La corrección de fondo es un único `limpiarBase()` en orden topológico**, compartido por las 14 suites, en vez de catorce listas divergentes. Nota para quien lo tome: `fileParallelism: false` **no protege de esto** y el comentario que lo acompaña en `vitest.config.ts` induce a creer que sí — el problema no es el paralelismo, es el residuo que queda entre archivos.
