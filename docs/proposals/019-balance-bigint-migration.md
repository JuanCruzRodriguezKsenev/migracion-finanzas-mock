# RFC 019: Migración de Columnas Monetarias de `integer` a `bigint`

*   **ID de la Propuesta:** 019
*   **Título:** Prevención de Overflow en Columnas Monetarias (Saldos, Débitos, Créditos, Suscripciones y Resúmenes Mensuales)
*   **Estado:** `APPROVED` (Aprobado y consolidado - 2026-09-07)
*   **Fecha de Creación:** 2026-07-08
*   **Autor:** Claude & Antigravity (AI Coding Assistants) — a partir de auditoría de código

---

## 1. Contexto y Problema

El esquema contable original almacena los importes monetarios en centavos enteros usando el tipo `integer` de PostgreSQL (32 bits con signo), con un rango máximo positivo de `2.147.483.647` centavos, equivalente a **$21.474.836,47** (veintiún millones cuatrocientos setenta y cuatro mil pesos/dólares).

En una economía con inflación o en cuentas corporativas/PYMEs operando en pesos argentinos (ARS), este techo se supera con facilidad en la operativa cotidiana o al acumular resúmenes históricos anuales (`SUM()` o saldos agregados). Cuando un valor supera $2^{31} - 1$, PostgreSQL arroja una excepción de runtime irrecuperable (`integer out of range`), abortando la transacción en curso.

Por tanto, es mandatorio ensanchar todas las columnas que manejan dinero a `bigint` (64 bits) de manera consistente en todos los módulos del sistema.

---

## 2. Inventario de Columnas Afectadas (9 columnas)

Se identifican 9 columnas monetarias en 4 tablas del modelo relacional:

| Módulo | Tabla | Columna | Rol Contable / Financiero |
|---|---|---|---|
| **Accounting** | `accounts` | `balance` | Saldo acumulado de cada cuenta |
| **Accounting** | `ledger_entries` | `debit` | Importe del Debe en centavos |
| **Accounting** | `ledger_entries` | `credit` | Importe del Haber en centavos |
| **Accounting** | `monthly_summaries` | `total_revenue` | Total de ingresos acumulados del mes |
| **Accounting** | `monthly_summaries` | `total_expense` | Total de egresos acumulados del mes |
| **Accounting** | `monthly_summaries` | `balance_snapshot` | Saldo general de cierre del período |
| **Accounting** | `monthly_summaries` | `assets_snapshot` | Total de activos al cierre del período |
| **Accounting** | `monthly_summaries` | `liabilities_snapshot` | Total de pasivos al cierre del período |
| **Subscriptions** | `subscriptions` | `amount` | Importe de la cuota/abono recurrente |

---

## 3. Propuesta de Implementación

### A. Estrategia de Tipado en Drizzle (`mode: "number"`)

Drizzle ORM permite configurar columnas `bigint` en modo número de JavaScript:

```typescript
bigint( "nombre_columna" , {mode: "number"} )
```

*   **Rango seguro en JavaScript:** El tipo `number` (IEEE 754 de doble precisión) soporta enteros exactos sin pérdida de precisión hasta `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9.007.199.254.740.991$). En centavos, esto equivale a más de **90 billones de pesos/dólares** ($90.071.992.547.409,91$).
*   **Transparencia de tipos:** Al permanecer como `number` en TypeScript, se evita la fricción de manejar `BigInt` primitivo (`100n`), eliminando la necesidad de serializadores JSON manuales en Server Components, Server Actions y respuestas de API.
*   **Cast transparente en Drizzle:** Drizzle parsea la columna de 64 bits de Postgres a `number` nativo al leer y lo envía adecuadamente al escribir.

### B. Migración SQL

Generada vía `pnpm db:generate` (`0018_*.sql`):

```sql
ALTER TABLE "accounts" ALTER COLUMN "balance" SET DATA TYPE bigint;
ALTER TABLE "ledger_entries" ALTER COLUMN "debit" SET DATA TYPE bigint;
ALTER TABLE "ledger_entries" ALTER COLUMN "credit" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_revenue" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_expense" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "balance_snapshot" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "assets_snapshot" SET DATA TYPE bigint;
ALTER TABLE "monthly_summaries" ALTER COLUMN "liabilities_snapshot" SET DATA TYPE bigint;
ALTER TABLE "subscriptions" ALTER COLUMN "amount" SET DATA TYPE bigint;
```

`ALTER COLUMN ... SET DATA TYPE bigint` es una operación completamente segura en PostgreSQL que no produce pérdida de datos al tratarse de una ampliación de dominio (widening conversion de 32 a 64 bits).

---

## 4. Impacto

*   **Aplicación y lógica de negocio:** Cero cambios destructivos en DAL, servicios contables, acciones y utilidades de dashboard, dado que todos los cálculos operan con centavos en `number`.
*   **Persistencia:** Se eliminan los bloqueos por desbordamiento de int32.
*   **Rendimiento:** 8 bytes por campo vs 4 bytes previos; despreciable en el volumen de datos de FinanzIA.

---

## 5. Plan de Verificación

1.  Generación y aplicación de la migración SQL con Drizzle Kit.
2.  Prueba de integración en `accountingService.test.ts` registrando transacciones con montos superiores a $2^{31} - 1$ centavos (ej: `3.000.000.000` centavos = $30.000.000,00), validando persistencia, actualización correcta de saldos y cumplimiento estricto de la regla Debe = Haber.
3.  Comprobación de la suite completa de tests y build de producción.
