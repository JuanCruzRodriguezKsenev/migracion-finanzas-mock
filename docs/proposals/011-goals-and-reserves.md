# RFC 011: Sistema de Metas y Reservas Financieras (Pockets)

*   **ID de la Propuesta:** 011
*   **Título:** Modelado Contable de Metas (Objetivos) y Reservas Virtuales (Sobres/Pockets de Ahorro)
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para ayudar a los usuarios a planificar su futuro financiero y evitar gastos impulsivos, el sistema debe permitir separar el dinero con propósitos claros. 

Distinguimos dos conceptos contables y operativos:
1.  **Metas (Goals):** Aspiraciones u objetivos a largo plazo con montos y plazos definidos. Son de carácter informativo y motivacional.
2.  **Reservas (Reserves / Pockets):** Bloques de saldo real que se apartan del balance general de una cuenta física (ej. banco, efectivo, billetera) para asegurar el pago de obligaciones futuras o fondos de emergencia.

### Objetivos:
1.  **Modelo de Datos en Drizzle:** Definir las tablas para `goals` y `reserves`.
2.  **Aislamiento Virtual de Saldos (Envelope Budgeting):** Calcular el "Saldo Disponible Libre" restando las reservas activas del balance real de la cuenta.
3.  **Vinculación Meta-Reserva:** Permitir que las reservas alimenten el progreso de una meta asociada de manera automática.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

### A. Estructura de Metas (Goals)

#### Tabla: `goals`
Representa el hito a cumplir.
```typescript
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Ej: "Viaje a Europa 2026"
  description: text("description"),
  
  targetAmount: integer("target_amount").notNull(), // Monto objetivo (centavos)
  targetDate: timestamp("target_date"), // Fecha límite (opcional)
  
  status: text("status").default("active").notNull(), // 'active' | 'completed' | 'abandoned'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

### B. Estructura de Reservas (Reserves / Sobres Virtuales)

#### Tabla: `reserves`
Representa dinero real apartado dentro de una cuenta bancaria o billetera.
```typescript
import { accounts } from "../../features/accounts/schema.db";

export const reserves = pgTable("reserves", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(), // Cuenta física de origen (ej: Mercado Pago)
  
  // Relación opcional con una Meta
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }), // Si es para fondear una meta específica
  
  name: text("name").notNull(), // Ej: "Fondo Emergencia", "Matrícula Universidad", "Reserva Visa"
  amount: integer("amount").notNull(), // Monto reservado (centavos)
  
  status: text("status").default("active").notNull(), // 'active' | 'released' (Liberado/gastado)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

## 3. Lógica del "Saldo Libre" (Free Balance)

Para evitar que el usuario gaste dinero que ya está reservado para expensas, luz o tarjetas, la aplicación calcula dos saldos para cada cuenta (`accounts`):

1.  **Saldo Bancario Real (`balance`):** El dinero físico reportado por el banco (ej: $100.000).
2.  **Saldo Libre Disponible (`free_balance`):** El dinero que el usuario realmente puede gastar:
    $$\text{Saldo Libre} = \text{Saldo Bancario} - \sum(\text{Reservas Activas asociadas a esa cuenta})$$

### Ejemplo de Uso:
*   Tienes $100.000 en la cuenta *Mercado Pago*.
*   Creas una reserva de $30.000 para *"Pago Tarjeta Visa"*.
*   Creas una reserva de $20.000 para *"Fondo de Emergencia"*.
*   **En la UI:** 
    *   Mercado Pago muestra: Saldo total: `$100.000` | Disponible para gastar: `$50.000`.
    *   Si realizas un gasto corriente de $60.000, la app te advierte: *"Este gasto excede tu saldo libre disponible. Tendrás que liberar fondos de tus reservas"*.

---

## 4. Progreso Automático de Metas

El progreso de ahorro de una meta se calcula al vuelo (on the fly) sumando los montos de todas las reservas de ahorro activas vinculadas a su `goalId`:

```typescript
// Consulta para calcular el progreso de una Meta:
const goalProgress = await db
  .select({
    currentSaved: sql<number>`SUM(${reserves.amount})`
  })
  .from(reserves)
  .where(and(
    eq(reserves.goalId, targetGoalId),
    eq(reserves.status, "active")
  ));

// Porcentaje de progreso:
// (currentSaved / targetAmount) * 100
```
De este modo, cuando el usuario asigna más saldo a la reserva "Ahorro Viaje" desde su cuenta, la barra de progreso de la Meta "Viaje a Europa" se actualiza automáticamente.
