# RFC 018: Core Contable de Partida Doble: Esquema de BD, Relaciones y Servicio Transaccional

*   **ID de la Propuesta:** 018
*   **Título:** Core Contable de Partida Doble: Esquema de BD, Relaciones Multi-Tenant y Servicio Transaccional
*   **Estado:** `APPROVED` (Implementado y consolidado - 2026-09-07)
*   **Fecha de Creación:** 2026-06-24
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para consolidar el backend financiero de FinanzIA, es indispensable implementar un motor contable robusto basado en el principio de la **partida doble** (Double-Entry Bookkeeping). Cada transacción financiera debe quedar registrada como un asiento contable compuesto por múltiples movimientos (entradas) donde la suma de los Débitos sea exactamente igual a la suma de los Créditos (Balance Cero).

### Objetivos Principales:
1.  **Consistencia Matemática:** Garantizar que no se inserten transacciones desbalanceadas en el sistema (evitar descuadres).
2.  **Seguridad Multi-Tenant:** Asegurar que cada transacción, cuenta y categoría esté estrictamente vinculada a su organización (`organizationId`), impidiendo fugas de datos entre inquilinos.
3.  **Integridad Transaccional (ACID):** Realizar las operaciones de creación de asientos contables y actualización de saldos dentro de una misma transacción de base de datos.
4.  **Precisión Numérica:** Manejar montos monetarios en centavos enteros (`integer` a nivel de DB) para prevenir errores de precisión de coma flotante.

---

## 2. Propuesta de Diseño de Base de Datos (Drizzle ORM)

El esquema se ubicará en [src/features/accounting/schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/schema.db.ts) y constará de cuatro tablas principales:

### A. Categorías (`categories`)
Define la clasificación de ingresos y gastos, soportando una estructura de árbol (categorías padre e hijas).
```typescript
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "@/features/auth/schema.db";

export const categories = pgTable("categories", {
  id:             uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  parentId:       uuid("parent_id"), // Auto-referencia para jerarquías
  name:           varchar("name", { length: 100 }).notNull(),
  icon:           varchar("icon", { length: 50 }),
  color:          varchar("color", { length: 7 }), // Hex (#FFFFFF)
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});
```

### B. Cuentas (`accounts`)
Representa las cuentas financieras (Banco, Efectivo, Tarjeta, Ingresos, Gastos) sobre las cuales se asientan las entradas contables.
```typescript
export const accounts = pgTable("accounts", {
  id:             uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code:           varchar("code", { length: 50 }).notNull(), // Código contable (ej. '1.1.01')
  name:           varchar("name", { length: 150 }).notNull(),
  type:           varchar("type", { length: 50 }).notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  balance:        integer("balance").default(0).notNull(), // En centavos. Negativo para pasivos o sobregiros
  currency:       varchar("currency", { length: 10 }).default("ARS").notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});
```

### C. Transacciones del Libro Diario (`ledger_transactions`)
Representa el encabezado del asiento contable (quién, cuándo, descripción general).
```typescript
export const ledgerTransactions = pgTable("ledger_transactions", {
  id:             uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  categoryId:     uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  description:    varchar("description", { length: 255 }).notNull(),
  merchantName:   varchar("merchant_name", { length: 150 }),
  merchantDomain: varchar("merchant_domain", { length: 100 }),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});
```

### D. Asientos/Movimientos Contables (`ledger_entries`)
Representa las líneas individuales de la transacción. Cada transacción debe tener al menos dos entradas (un débito y un crédito).
```typescript
import { integer } from "drizzle-orm/pg-core";

export const ledgerEntries = pgTable("ledger_entries", {
  id:             uuid("id").defaultRandom().primaryKey(),
  transactionId:  uuid("transaction_id").notNull().references(() => ledgerTransactions.id, { onDelete: "cascade" }),
  accountId:      uuid("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }), // Impedir borrar cuenta con movimientos
  debit:          integer("debit").default(0).notNull(),  // Monto débito (positivo, en centavos)
  credit:         integer("credit").default(0).notNull(), // Monto crédito (positivo, en centavos)
  currency:       varchar("currency", { length: 10 }).default("ARS").notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});
```

---

## 3. Reglas y Lógica del Motor Transaccional

El servicio de contabilidad se creará en `src/features/accounting/services/accountingService.ts` y encapsulará la creación de asientos garantizando el cumplimiento de las siguientes reglas de negocio:

### A. Regla de Balance Cero (Débitos = Créditos)
Antes de insertar cualquier registro en la base de datos, el servicio comprobará aritméticamente el balance:
$$\sum \text{debits} - \sum \text{credits} = 0$$
Si la diferencia no es exactamente cero, la transacción es inválida, se aborta la operación y se lanza un error semántico descriptivo.

### B. Transaccionalidad ACID
La inserción de la cabecera, la inserción de las entradas y la actualización del saldo de las cuentas involucradas se ejecutarán dentro de una transacción nativa de PostgreSQL (`db.transaction()`). Si alguna operación falla, la base de datos revierte automáticamente todo el estado (Rollback), impidiendo saldos corruptos.

### C. Algoritmo de Actualización de Saldos
Dependiendo del tipo de cuenta, el saldo acumulado en la tabla `accounts` se modificará de la siguiente forma ante un asiento contable:
*   **Activos (Asset) y Gastos (Expense):**
    $$\text{Nuevo Saldo} = \text{Saldo Anterior} + \text{Débito} - \text{Crédito}$$
*   **Pasivos (Liability), Patrimonio (Equity) e Ingresos (Revenue):**
    $$\text{Nuevo Saldo} = \text{Saldo Anterior} - \text{Débito} + \text{Crédito}$$

---

## 4. Plan de Testing (Vitest)

Para validar el motor contable de partida doble, se creará el archivo de pruebas `src/features/accounting/services/accountingService.test.ts`. 

### Casos de Prueba Críticos:
1.  **Transacción Balanceada Válida:** Registrar un asiento contable simple (Débito en Banco, Crédito en Ingresos) y verificar que las tablas se pueblen correctamente y los saldos de las cuentas se actualicen bajo las fórmulas correctas.
2.  **Rechazo de Transacción Desbalanceada:** Intentar registrar un asiento donde los débitos y créditos difieran (ej. Debe: \$100, Haber: \$90). Verificar que la transacción sea abortada, se lance una excepción y no se persista ningún registro en base de datos.
3.  **Rollback ante Fallo Físico:** Provocar un fallo controlado (por ejemplo, referenciando una cuenta inexistente en el segundo movimiento contable) y verificar que el primer movimiento no se considere en base de datos.
4.  **Auditoría Contable de Balance Cero:** Escribir un test de integración que consulte la tabla `ledger_entries` y valide que la suma agregada de todas las entradas del libro diario arroje balance cero para cada ID de transacción.

---

## 5. Estado de implementación (2026-09-07)

### A. Construido según la propuesta original
*   **Esquema y relaciones:** Tablas `categories`, `accounts`, `ledger_transactions` y `ledger_entries` en `src/features/accounting/schema.db.ts` con aislamiento multi-tenant estricto (`organization_id`), claves foráneas y cascadas / restricciones de integridad referencial.
*   **Servicio Contable Transaccional:** `src/features/accounting/services/accountingService.ts` implementa la validación aritmética de balance cero (Debe = Haber en centavos enteros) y mutación atómica dentro de una transacción nativa (`db.transaction()`).
*   **Actualización de saldos por tipo de cuenta:** Regla algebraica de Débito/Crédito según naturaleza contable (`asset`/`expense` incrementan con débitos y decrementan con créditos; `liability`/`equity`/`revenue` incrementan con créditos y decrementan con débitos).
*   **Suite de pruebas de integración:** `src/features/accounting/services/accountingService.test.ts` valida balance cero, rechazo de asientos desbalanceados y rollback automático ante errores.

### B. Extensiones y evoluciones posteriores no contempladas en el RFC original
A lo largo de las tandas de desarrollo e integración contable (migraciones `0012` a `0016`), el core contable se extendió con los siguientes componentes:
1.  **Entidades Financieras (`financial_entities`):** Abstracción de bancos, billeteras virtuales y efectivo físico vinculadas a cuentas contables individuales para soporte UI/UX institucional (migración `0010_clear_zaran.sql`).
2.  **Resúmenes Mensuales Históricos (`monthly_summaries`):** Cierres mensuales para agregación temporal y visualización de métricas en dashboard, incorporando snapshots de balance general, desglose de activos (`assets_snapshot`) y pasivos (`liabilities_snapshot`) (migración `0012_tranquil_luckman.sql` e índice único en `0017_free_iron_monger.sql`).
3.  **Fecha de Ocurrencia Indexada (`occurred_at`):** Soporte para fecha de devengamiento contable de transacciones independiente de `created_at`, con índice compuesto determinante para paginación por cursor `(occurred_at, id)` (migración `0014_real_komodo.sql`).
4.  **Integridad Multimoneda y Cuentas de Posición:** Validación del balance Debe = Haber segregado por divisa. Soporte nativo para transacciones de tipo **cambio** (4 asientos en 2 libros contra cuentas técnicas de posición `3.3.01-<MONEDA>`), con tipo de cambio deducido del cociente aritmético sin almacenar floats (migración `0015_icy_blizzard.sql`).
5.  **Reversión Contable ACID Irrepetible:** Bloqueo de fila original con `SELECT ... FOR UPDATE`, registro de auditoría con columnas `reversed_at` y `reverses_transaction_id` (migración `0015_icy_blizzard.sql`) y emisión de contra-asientos automáticos que devuelven los saldos a las cuentas de origen.
6.  **Patrón Outbox Desacoplado (RFC 020):** Emisión transaccional de eventos en `outbox_events` (`TRANSACTION_CREATED`, `TRANSACTION_REVERSED`) con worker asíncrono desacoplado en 3 pasos con `SKIP LOCKED`, índice de polling `outbox_status_created_idx` (migración `0016_eminent_roxanne_simpson.sql`), reintentos exponenciales y purga histórica.
