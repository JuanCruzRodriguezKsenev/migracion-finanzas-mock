# RFC 021: Módulo de Transacciones (/transactions): Libro Diario, Paginación, Edición/Reversión y UI

*   **ID de la Propuesta:** 021
*   **Título:** Módulo de Transacciones (/transactions): Libro Diario, Paginación por Cursor, Edición de Metadatos, Reversión Contable y UI
*   **Estado:** `APPROVED`
*   **Fecha de Creación:** 2026-09-06
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

FinanzIA posee un núcleo contable de partida doble robusto (`accountingService.ts`, `ledgerRepository.ts`), con validación de balance cero, bloqueo de concurrencia `SELECT FOR UPDATE`, control de idempotencia y eventos transaccionales Outbox.

Sin embargo, el módulo de usuario `/transactions` no ha sido construido, y existen cuatro limitaciones estructurales en la capa de persistencia y servicios:
1. **Ausencia de fecha del hecho económico:** La tabla `ledger_transactions` sólo posee `created_at` (marca de tiempo del sistema de registro), impidiendo cargar operaciones retroactivas o de fechas pasadas y provocando que el selector de mes agrupe por momento de carga en vez de ocurrencia real.
2. **Inexistencia de edición o reversión:** Sólo existen operaciones de `create` y `delete`.
3. **Falta de paginación y filtros en el DAL:** `findTransactionsWithEntries` trae el conjunto sin límite ni paginación cursorizada, lo cual degrada la performance al acumular historial.
4. **Falta de componentes de tabla y búsqueda en `src/shared/ui/`:** No existen primitivas genéricas de `DataTable` ni `SearchInput` adaptadas al sistema de diseño tokenizado y a las restricciones visuales anti-shift.

### Objetivos:
1. Incorporar `occurred_at timestamptz NOT NULL` con backfill automático sobre `created_at` e índices compuestos optimizados para consultas temporales.
2. Proveer paginación por cursor determinístico `(occurred_at, id)` junto con búsqueda textual y filtros multidimensionales (cuenta, categoría, tipo, rango de fechas).
3. Implementar edición segura de metadatos (descripción, categoría, comercio) sin alterar la partida doble, y reversión contable automática mediante asiento espejo compensatorio en una sola transacción ACID.
4. Diseñar la derivación pura de tipo de transacción (`income`, `expense`, `transfer`) en función del plan de cuentas de las entradas contables, sin redundancia de datos.
5. Desarrollar las primitivas `DataTable` y `SearchInput` en `src/shared/ui/`, y la feature completa en `src/features/transactions/` junto con la ruta `src/app/[lang]/(main)/transactions/`.

---

## 2. Decisiones Arquitectónicas Clave

### Decisión A: Fecha de ocurrencia (`occurred_at`)
* Se agrega `occurred_at` como `timestamp with time zone NOT NULL DEFAULT now()`.
* Se realiza backfill: para registros existentes, `occurred_at` toma el valor de `created_at`.
* `created_at` se mantiene inmutable como rastro de auditoría técnica.
* Se añade índice compuesto `(organization_id, occurred_at DESC, id DESC)` para acelerar consultas paginadas y filtradas por mes.

### Decisión B: Inmutabilidad contable y Reversión
* En un sistema de partida doble, alterar directamente montos o cuentas de asientos ya asentados destruye la pista de auditoría.
* **Metadatos editables:** Se permite modificar `description`, `categoryId`, `merchantName` y `merchantDomain` mediante `updateLedgerTransactionMetadata`.
* **Modificación de importes o cuentas:** Requiere la operación de reversión contable (`reverseLedgerTransaction`), la cual crea un asiento inverso espejo (donde los débitos pasan a créditos y viceversa) con actualización atómica de saldos de las cuentas involucradas y evento Outbox `TRANSACTION_REVERSED`.

### Decisión C: Tipo de transacción derivado
* El tipo comercial (`income`, `expense`, `transfer`) **no se almacena** en una columna de base de datos para evitar desincronizaciones con las cuentas reales.
* Se calcula en runtime a través de la función pura `derivarTipoTransaccion(entries, accounts)`:
  * Si la transacción contiene débitos o créditos contra cuentas `revenue` -> `income`.
  * Si contiene débitos o créditos contra cuentas `expense` -> `expense`.
  * Si involucra únicamente cuentas de balance (`asset` <-> `asset` o `asset` <-> `liability`) -> `transfer`.

---

## 3. Especificación de Base de Datos y DAL

### Modificación de esquema en `src/features/accounting/schema.db.ts`:
```typescript
export const ledgerTransactions = pgTable( "ledger_transactions" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  categoryId:     uuid( "category_id"     ).references( () => categories.id     , {onDelete: "set null"} ) ,
  description:    varchar( "description"     , {length: 255} ).notNull() ,
  merchantName:   varchar( "merchant_name"   , {length: 150} ) ,
  merchantDomain: varchar( "merchant_domain" , {length: 100} ) ,
  occurredAt:     timestamp( "occurred_at" , {withTimezone: true} ).defaultNow().notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgOccurredIdx:   index( "ledger_tx_org_occurred_idx"    ).on( table.organizationId , table.occurredAt ) ,
  orgOccurredIdIdx: index( "ledger_tx_org_occurred_id_idx" ).on( table.organizationId , table.occurredAt , table.id ) ,
} ) ; } ) ;
```

### Nueva función de paginación y búsqueda en `ledgerRepository`:
* `findTransactionsPage( params: QueryTransactionsParams , tx?: DBOrTx )`
  * Filtro por `organizationId` (estricto multi-tenant).
  * Filtro por texto `search` (búsqueda insensible a mayúsculas sobre `description` y `merchantName`).
  * Filtro por `categoryId`, `accountId` (vía subquery o join sobre `ledgerEntries`), `fromDate` y `toDate`.
  * Paginación por cursor basado en `(occurred_at, id)`.
  * Orden descendente: `desc(ledgerTransactions.occurredAt), desc(ledgerTransactions.id)`.

---

## 4. Primitivas de UI Compartidas (`src/shared/ui/`)

1. **`src/shared/ui/display/DataTable/DataTable.tsx`**:
   * Tabla genérica parametrizada por tipo `T`.
   * Estilos CSS Modules con consumo de variables de diseño de `src/app/globals.css`.
   * Cumplimiento estricto de la regla anti-CLS: sin cambios de tamaño o traslaciones en `:hover`.
2. **`src/shared/ui/forms/SearchInput/SearchInput.tsx`**:
   * Input de búsqueda accesible con icono SVG, botón de limpiar y soporte para anchos fluidos.

---

## 5. Módulo de Transacciones (`src/features/transactions/`)

* **`components/TransactionsContainer.tsx`**: Orquestador en el cliente que administra estados de búsqueda, filtros, modal de alta, modal de edición/reversión y paginación.
* **`components/TransactionsControls.tsx`**: Barra de controles con `SearchInput`, selectores de cuenta, categoría y tipo, y botón para resetear filtros.
* **`components/TransactionsTable.tsx`**: Presentación de las transacciones con badge de tipo, montos formateados en color semántico y menú de acciones.
* **`components/TransactionFormModal.tsx`**: Modal de creación con soporte para gastos, ingresos y transferencias, generando automáticamente el balance de partida doble.
* **`components/TransactionDetailModal.tsx`**: Vista de detalle que expone los asientos contables y permite edición de metadatos o reversión contable.
* **`actions/transactionsActions.ts`**: Server Actions para alimentar la vista y ejecutar mutaciones.
* **`utils/derivarTipo.ts`**: Helper puro para inferir el tipo y monto relevante.

---

## 6. Plan de Verificación y Testing

* **Tests de Esquema y Migración:** Aplicación de Drizzle Kit y verificación de integridad referencial.
* **Tests de Repositorio:** Pruebas de cursor pagination, búsqueda textual y filtros combinados.
* **Tests de Servicio Contable:** Reversión atómica de saldos, preservación de consistencia contable, eventos Outbox.
* **Tests Unitarios de `derivarTipo`:** Cobertura total de combinaciones de cuentas (ingreso, gasto, transferencias entre cuentas bancarias y con tarjeta).
* **Tests de Componentes:** Verificación en entorno `jsdom` de `DataTable` y `SearchInput`.
* **Compuerta de Calidad:** `pnpm tsc --noEmit` = 0, `pnpm lint` = 0 errores / 0 warnings, `pnpm test` = 100% pasando, `pnpm build` = éxito.
