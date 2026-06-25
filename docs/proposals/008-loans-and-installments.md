# RFC 008: Préstamos, Compras en Cuotas y Deudas con Terceros

*   **ID de la Propuesta:** 008
*   **Título:** Modelado y Automatización de Préstamos, Compras en Cuotas y Deudas con Terceros
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para un control de salud financiera completo, un SaaS financiero no solo debe registrar transacciones del día a día, sino también pasivos a largo plazo. Los pasivos se dividen en tres grandes grupos:

1.  **Compras en Cuotas (Planes de Pago):** Pagos recurrentes fijos que descuentan del límite de una tarjeta de crédito y se cargan mes a mes.
2.  **Préstamos de Amortización (Bancos/Financieras):** Deudas a largo plazo que se pagan en cuotas mensuales compuestas por dos conceptos: devolución de capital (amortización de deuda) y pago de intereses (gasto financiero).
3.  **Deudas Informales con Terceros (Contactos):** Préstamos privados con personas de nuestra agenda (amigos, familiares, socios) con o sin intereses.

### Objetivos:
1.  **Modelo de Datos en Drizzle:** Definir tablas para `installment_plans` y `loans`.
2.  **Automatización de Cuotas:** Un motor en segundo plano que registre el cobro de cuotas mensuales de manera automática.
3.  **Seguimiento Contable de Intereses:** Diferenciar contablemente entre amortizar deuda (reducir pasivo) y pagar intereses (registrar gasto).
4.  **Consolidación de Deuda con Contactos:** Integrar las deudas con la tabla de contactos (`contacts`) del RFC 006 para obtener balances por persona de forma automatizada.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

### A. Compras en Cuotas (Planes de Pago)

#### Tabla: `installment_plans`
Rastrea compras financiadas en tarjetas.
```typescript
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { cards } from "../../features/accounts/schema.db";
import { organizations } from "../../features/auth/schema.db";

export const installmentPlans = pgTable("installment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  cardId: uuid("card_id").references(() => cards.id, { onDelete: "cascade" }).notNull(), // Tarjeta donde se carga
  
  description: text("description").notNull(), // Ej: "Compra Heladera Smart"
  totalAmount: integer("total_amount").notNull(), // Monto total en centavos
  installmentsCount: integer("installments_count").notNull(), // Cantidad de cuotas (ej: 12)
  monthlyAmount: integer("monthly_amount").notNull(), // Cuánto se cobra por mes en centavos
  
  currentInstallment: integer("current_installment").default(1).notNull(), // Cuota en la que va (ej: 3)
  startDate: timestamp("start_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

### B. Préstamos y Deudas a Terceros

#### Tabla: `loans`
Soporta tanto préstamos de entidades financieras como deudas privadas con contactos.
```typescript
import { contacts } from "./schema"; // RFC 006

export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(), // Ej: "Préstamo Personal Galicia" o "Deuda con Pedro"
  type: text("type").default("bank").notNull(), // 'bank' (Entidad) | 'peer' (Contacto de agenda)
  
  // Relaciones condicionales
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }), // Null si es un banco
  
  // Datos Financieros (Centavos)
  principalAmount: integer("principal_amount").notNull(), // Capital inicial prestado
  remainingBalance: integer("remaining_balance").notNull(), // Capital adeudado actual
  
  // Tasas e interés
  interestRateAnual: integer("interest_rate_anual").default(0).notNull(), // TNA * 100
  
  // Plazos
  totalInstallments: integer("total_installments").default(1).notNull(),
  installmentsPaid: integer("installments_paid").default(0).notNull(),
  nextDueDate: timestamp("next_due_date"),
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

## 3. Flujos Contables de Partida Doble (Ledger Integration)

### A. Otorgamiento del Préstamo (Ingreso de Capital)
El banco (o Pedro) te entrega $10.000 en tu banco:
*   **Debe (Debit):** *Tu Cuenta Corriente (Activo)* -> **+$10.000**
*   **Haber (Credit):** *Cuenta del Préstamo (Pasivo)* -> **+$10.000**
*   *Efecto:* Aumenta tu liquidez (Activos) y aumenta tu obligación de pago (Pasivos).

### B. Pago de Cuota del Préstamo (Amortización + Interés)
Pagas una cuota de $1.200 (donde $800 reduce la deuda y $400 es interés del mes):
*   **Debe (Debit):** *Cuenta del Préstamo (Pasivo)* -> **-$800** (La deuda baja).
*   **Debe (Debit):** *Gasto por Intereses Financieros (Egreso)* -> **+$400** (Costo devengado).
*   **Haber (Credit):** *Tu Cuenta Corriente (Activo)* -> **-$1.200** (Dinero que sale).
*   *Efecto:* El pasivo disminuye en $800 y registras un gasto real de $400.

### C. Compra en Cuota Mensual Automatizada
En el día de cierre de la tarjeta, para la "Compra Heladera Smart" (Cuota 3 de 12 de $10):
*   **Debe (Debit):** *Gasto por Equipamiento del Hogar (Egreso)* -> **+$10**
*   **Haber (Credit):** *Cuenta de Tarjeta de Crédito (Pasivo)* -> **+$10**
*   *Efecto:* Registras el consumo del mes y aumenta tu saldo deudor en la tarjeta de crédito.

---

## 4. Consolidación de Balance de Deudas por Persona

Gracias a la columna `contactId` en la tabla `loans` y los asientos contables asociados:
*   La aplicación puede consultar instantáneamente todas las deudas activas e ingresos de transferencias vinculados a un contacto:
    ```typescript
    // Obtener la deuda neta acumulada con un contacto de la agenda:
    const contactDebt = await db
      .select({
        remainingDebt: sql<number>`SUM(${loans.remainingBalance})`
      })
      .from(loans)
      .where(eq(loans.contactId, targetContactId));
    ```
*   Esto nos permite mostrar en la ficha del contacto: **"Saldo Neto con Pedro: Le debes $5.000 / Te debe $0"**.
