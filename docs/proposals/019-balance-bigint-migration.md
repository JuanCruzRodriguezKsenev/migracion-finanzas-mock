# RFC 019: Migración de Columnas Monetarias de `integer` a `bigint`

*   **ID de la Propuesta:** 019
*   **Título:** Prevención de Overflow en Columnas Monetarias (Saldos, Débitos, Créditos y Resúmenes Mensuales)
*   **Estado:** `DRAFT` (Borrador - 2026-07-08)
*   **Fecha de Creación:** 2026-07-08
*   **Autor:** Claude (AI Coding Assistant) — a partir de auditoría de código

---

## 1. Contexto y Problema

El esquema definido en [RFC 018](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/docs/proposals/018-double-entry-accounting-core.md) almacena todos los montos monetarios en centavos enteros usando el tipo `integer` de PostgreSQL (32 bits con signo), con un rango máximo de `2.147.483.647` (~$21.474.836 en pesos, dado que se expresa en centavos).

El script de seed ([src/shared/db/seed.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/db/seed.ts)) ya siembra un saldo acumulado inicial de `19.000.000 * 100 = 1.900.000.000` centavos — un **88% del límite de `integer`**. Cualquier organización con más historial, saldos más altos, o múltiples cuentas sumando montos vía `SUM()` en reportes futuros puede desbordar la columna, lo que en Postgres produce un error de runtime (`integer out of range`) que aborta la transacción — en el peor caso, en medio de una operación contable ya en curso.

Este es un defecto de diseño estructural (afecta el esquema Drizzle y las migraciones SQL), por lo que requiere RFC según la regla de ARCHITECTURE.md §6.

---

## 2. Columnas Afectadas

En [src/features/accounting/schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/schema.db.ts):

| Tabla | Columna | Uso |
|---|---|---|
| `accounts` | `balance` | Saldo acumulado de cada cuenta |
| `ledger_entries` | `debit`, `credit` | Montos individuales de cada asiento |
| `monthly_summaries` | `total_revenue`, `total_expense`, `balance_snapshot` | Agregados mensuales |

---

## 3. Propuesta

### A. Cambio de tipo en Drizzle

Reemplazar `integer(...)` por `bigint(... , {mode: "number"})` en las columnas listadas:

```typescript
// Antes
balance: integer( "balance" ).default( 0 ).notNull() ,

// Después
balance: bigint( "balance" , {mode: "number"} ).default( 0 ).notNull() ,
```

`mode: "number"` mantiene el valor como `number` de JavaScript (no `bigint` nativo), preservando compatibilidad total con el código de servicios/repositorios existente sin requerir cambios de tipo en cascada. Es seguro hasta `Number.MAX_SAFE_INTEGER` (2^53 - 1 ≈ 9 cuatrillones de centavos ≈ $90 billones), un margen que ninguna organización de este SaaS alcanzará en la práctica.

### B. Migración SQL

Generada vía `pnpm db:generate` tras el cambio de esquema, resultando en sentencias equivalentes a:

```sql
ALTER TABLE "accounts" ALTER COLUMN "balance" SET DATA TYPE bigint;
ALTER TABLE "ledger_entries" ALTER COLUMN "debit" SET DATA TYPE bigint;
ALTER TABLE "ledger_entries" ALTER COLUMN "credit" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_revenue" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_expense" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "balance_snapshot" SET DATA TYPE bigint;
```

`ALTER COLUMN ... TYPE bigint` desde `integer` es una operación segura y sin pérdida de datos en PostgreSQL (ensanchamiento de tipo numérico).

---

## 4. Impacto

*   **Código de aplicación:** ningún cambio requerido fuera del esquema — `mode: "number"` es transparente para servicios, repositorios y tests existentes.
*   **Datos existentes:** la migración `ALTER COLUMN` preserva todos los valores actuales.
*   **Rendimiento:** `bigint` ocupa 8 bytes vs. 4 bytes de `integer`; el impacto de almacenamiento es marginal para las tablas involucradas.

---

## 5. Plan de Testing

Ampliar `accountingService.test.ts` con un caso que registre una transacción con montos cercanos al límite de `integer` (ej. `2.100.000.000` centavos) y verifique que se persiste sin error, cubriendo específicamente el escenario que este RFC previene.

---

## 6. Alternativas Consideradas

*   **`numeric(19,0)`:** más preciso para valores arbitrariamente grandes, pero introduce overhead de serialización y requiere manejar `string`/`Decimal` en el código en vez de `number`, un cambio invasivo desproporcionado al problema real.
*   **No hacer nada:** rechazado — el seed actual ya opera al 88% del límite; es cuestión de tiempo antes de que una organización real lo alcance.
