# RFC 017: Configuración de Base de Datos Local, Migraciones y Seed

*   **ID de la Propuesta:** 017
*   **Título:** Configuración de PostgreSQL en Docker, Drizzle Kit y Seed con Partida Doble
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-23
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para que el equipo de desarrollo pueda trabajar localmente de forma independiente y reproducible, se requiere un entorno de base de datos estandarizado y comandos claros para sincronizar los cambios de esquemas de Drizzle ORM.
Además, para realizar pruebas manuales y unitarias realistas, es necesario proveer un script de inicialización de datos (seed) que pueble la base de datos con una estructura multi-tenant realista, incluyendo usuarios simulados y transacciones financieras coherentes que cumplan estrictamente la regla contable de la partida doble.

---

## 2. Entorno Local PostgreSQL (Docker Compose)

Crearemos un archivo `docker-compose.yml` en la raíz del proyecto para simplificar la inicialización del motor PostgreSQL local:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres_dev:
    image: postgres:16-alpine
    container_name: finanzas_postgres_dev
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_dev_pwd
      POSTGRES_DB: finanzas_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

volumes:
  postgres_dev_data:
    driver: local
```

*Variable de entorno local (`.env.local`):*
```env
DATABASE_URL=postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db
NEXTAUTH_SECRET=un_secreto_muy_seguro_de_32_caracteres_minimo_para_jwt
```

---

## 3. Configuración de Drizzle Kit (`drizzle.config.ts`)

Ubicado en la raíz del proyecto, le indica a Drizzle Kit dónde buscar esquemas y dónde guardar los archivos de migración generados:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/db/schema.ts", // Apunta al re-exportador unificado de features
  out: "./drizzle/migrations",          // Directorio donde se generarán los archivos SQL
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db",
  },
  verbose: true,
  strict: true,
});
```

---

## 4. Scripts en `package.json`

Agregaremos los comandos necesarios para automatizar el ciclo de desarrollo en `package.json`:

```json
"scripts": {
  "db:up": "docker-compose up -d",
  "db:down": "docker-compose down",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:seed": "pnpm tsx src/shared/db/seed.ts"
}
```

---

## 5. Diseño del Script de Inicialización Contable (`src/shared/db/seed.ts`)

El script poblará la base de datos con un Workspace inicial y transacciones perfectamente balanceadas según las reglas del libro diario (Debits y Credits sumando cero en total).

### Lógica del Script:

```typescript
// src/shared/db/seed.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../../features/auth/services/authService";
import * as schema from "./schema";

const queryClient = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db");
const db = drizzle(queryClient, { schema });

async function main() {
  console.log("🌱 Iniciando poblamiento de base de datos (Seed)...");

  // 1. Crear Organización (Tenant)
  const [org] = await db.insert(schema.organizations).values({
    name: "Familia Gómez - Finanzas",
    slug: "familia-gomez",
  }).returning();

  console.log(`✅ Organización creada: ${org.name} [${org.id}]`);

  // 2. Crear Usuario Administrador con Contraseña Hash Scrypt
  const { hash, salt } = await hashPassword("GomezPass2026!");
  const [user] = await db.insert(schema.users).values({
    organizationId: org.id,
    email: "gomez.admin@finanzas.com",
    name: "Carlos Gómez",
    role: "owner",
    passwordHash: hash,
    salt: salt,
  }).returning();

  console.log(`✅ Usuario inicial creado: ${user.email}`);

  // 3. Crear Categorías Básicas Jerárquicas
  const [catIngresos] = await db.insert(schema.categories).values({
    organizationId: org.id,
    name: "Ingresos",
    icon: "banknote",
    color: "#2ecc71",
  }).returning();

  const [subSueldo] = await db.insert(schema.categories).values({
    organizationId: org.id,
    parentId: catIngresos.id,
    name: "Sueldos y Honorarios",
    icon: "briefcase",
    color: "#27ae60",
  }).returning();

  const [catAlimentos] = await db.insert(schema.categories).values({
    organizationId: org.id,
    name: "Alimentos y Bebidas",
    icon: "shopping-cart",
    color: "#e67e22",
  }).returning();

  console.log("✅ Categorías de ejemplo inicializadas.");

  // 4. Crear Plan de Cuentas Financieras (Accounts)
  // Cuentas de Activo (Aumentan con Debe / Débito)
  const [ctaBanco] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "1.1.01.01",
    name: "Caja de Ahorro ARS - Banco Galicia",
    type: "asset",
    balance: 50000000, // $500,000.00 ARS (en centavos)
    currency: "ARS",
  }).returning();

  const [ctaEfectivo] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "1.1.01.02",
    name: "Efectivo en Billetera",
    type: "asset",
    balance: 2000000, // $20,000.00 ARS
    currency: "ARS",
  }).returning();

  // Cuentas de Pasivo (Aumentan con Haber / Crédito)
  const [ctaTarjeta] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "2.1.01.01",
    name: "Tarjeta de Crédito Visa Galicia",
    type: "liability",
    balance: -4500000, // -$45,000.00 ARS (saldo adeudado)
    currency: "ARS",
  }).returning();

  // Cuentas de Patrimonio
  const [ctaCapital] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "3.1.01.01",
    name: "Patrimonio Inicial",
    type: "equity",
    balance: 47500000, // Net worth inicial
    currency: "ARS",
  }).returning();

  // Cuentas de Ingresos y Gastos
  const [ctaIngSueldo] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "4.1.01.01",
    name: "Ingresos por Sueldo",
    type: "revenue",
    balance: 0,
    currency: "ARS",
  }).returning();

  const [ctaGastoSuper] = await db.insert(schema.accounts).values({
    organizationId: org.id,
    code: "5.1.01.01",
    name: "Gastos de Supermercado",
    type: "expense",
    balance: 0,
    currency: "ARS",
  }).returning();

  console.log("✅ Cuentas del libro diario inicializadas.");

  // 5. Insertar Transacciones Contables de Partida Doble
  // Transacción A: Cobro de Sueldo Mensual ($350,000.00 ARS)
  // - Débito (Aumento de Activo) en Caja de Ahorro ARS: 35000000
  // - Crédito (Aumento de Ingresos) en Ingresos por Sueldo: 35000000
  const [txSueldo] = await db.insert(schema.ledgerTransactions).values({
    organizationId: org.id,
    categoryId: subSueldo.id,
    description: "Sueldo Neto de Junio 2026",
    merchantName: "Empresa Empleadora S.A.",
  }).returning();

  await db.insert(schema.ledgerEntries).values([
    {
      transactionId: txSueldo.id,
      accountId: ctaBanco.id,
      debit: 35000000, // Aumenta cuenta banco Galicia
      credit: 0,
      currency: "ARS",
    },
    {
      transactionId: txSueldo.id,
      accountId: ctaIngSueldo.id,
      debit: 0,
      credit: 35000000, // Aumenta ingresos
      currency: "ARS",
    }
  ]);

  // Transacción B: Gasto en Supermercado con Efectivo ($12,500.00 ARS)
  // - Débito (Aumento de Gasto) en Gastos de Supermercado: 1250000
  // - Crédito (Disminución de Activo) en Efectivo: 1250000
  const [txSuper] = await db.insert(schema.ledgerTransactions).values({
    organizationId: org.id,
    categoryId: catAlimentos.id,
    description: "Compra semanal de mercadería",
    merchantName: "Supermercado Carrefour",
    merchantDomain: "carrefour.com.ar",
  }).returning();

  await db.insert(schema.ledgerEntries).values([
    {
      transactionId: txSuper.id,
      accountId: ctaGastoSuper.id,
      debit: 1250000, // Aumenta el gasto
      credit: 0,
      currency: "ARS",
    },
    {
      transactionId: txSuper.id,
      accountId: ctaEfectivo.id,
      debit: 0,
      credit: 1250000, // Disminuye efectivo
      currency: "ARS",
    }
  ]);

  console.log("✅ Transacciones de prueba de partida doble insertadas correctamente.");
  console.log("🌱 Seed completado exitosamente.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error ejecutando el seed:", err);
  process.exit(1);
});
```

---

## 6. Verificación de Integridad Contable

Para asegurar que no haya desbalances en el seed o en ejecuciones futuras, la lógica de validación debe correr queries de control de auditoría periódicos como el siguiente:

```sql
-- Verificar desbalances (Debe sumarse por Transacción y dar Cero)
SELECT transaction_id, SUM(debit) - SUM(credit) AS desbalance
FROM ledger_entries
GROUP BY transaction_id
HAVING SUM(debit) - SUM(credit) <> 0;
```
En desarrollo, un test de integración puede ejecutar esta misma comprobación tras poblar el seed para certificar que el libro diario inició sin inconsistencias.
