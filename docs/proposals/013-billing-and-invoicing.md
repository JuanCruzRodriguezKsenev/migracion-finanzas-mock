# RFC 013: Motor de Facturación y Detalle de Facturas (Invoicing Engine)

*   **ID de la Propuesta:** 013
*   **Título:** Módulo de Facturación con Detalle de Items, Automatización Contable e Integración por API
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para un negocio (como la pastelería) o un profesional independiente, llevar el registro de ventas requiere facturar. Una factura es un documento formal que detalla múltiples artículos o servicios prestados a un cliente específico, rastrea si la deuda está saldada y automatiza la entrada contable correspondiente al cobro.

### Objetivos:
1.  **Modelo Relacional Completo (Items de Factura):** Estructurar facturas que puedan contener múltiples líneas de detalle (productos, cantidades, precios unitarios).
2.  **Integración con Contactos (Clientes):** Vincular cada factura a un cliente registrado en la tabla `contacts` (RFC 006).
3.  **API de Creación de Facturas:** Proveer un endpoint para que aplicaciones externas (como la app de pastelería) puedan registrar facturas y comandas directamente en nuestro sistema.
4.  **Generación Automática de Asiento Contable:** Crear los movimientos contables en el Libro Mayor (partida doble) automáticamente cuando la factura se marca como pagada (`paid`).

---

## 2. Esquema de Base de Datos (Drizzle ORM)

Proponemos la creación de la tabla `invoices` y su tabla de detalle `invoice_items` vinculadas en relación "Uno a Muchos":

```typescript
import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";
import { contacts } from "./schema"; // RFC 006

// 1. Tabla de Facturas
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "restrict" }).notNull(), // Cliente
  
  invoiceNumber: text("invoice_number").notNull(), // Correlativo. Ej: "FAC-0001"
  status: text("status").default("draft").notNull(), // 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
  
  currency: text("currency").default("ARS").notNull(),
  
  // Resúmenes de montos en centavos
  subtotal: integer("subtotal").notNull(),
  taxAmount: integer("tax_amount").default(0).notNull(), // IVA / Impuestos calculados
  total: integer("total").notNull(), // Monto final neto (subtotal + taxAmount)
  amountPaid: integer("amount_paid").default(0).notNull(), // Monto total cobrado acumulado (señas + pagos)
  
  notes: text("notes"),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"), // Fecha límite de pago
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});


// 2. Tabla de Detalle de Factura (Items)
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  
  description: text("description").notNull(), // Ej: "Torta Lemon Pie 24cm"
  quantity: integer("quantity").default(1).notNull(), // Cantidad vendida
  unitPrice: integer("unit_price").notNull(), // Precio unitario en centavos
  
  totalPrice: integer("total_price").notNull(), // precio unitario * cantidad (en centavos)
});

// 3. Tabla de Pagos de Factura (Soporte para Señas / Adelantos / Pagos en cuotas)
export const invoicePayments = pgTable("invoice_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }).notNull(), // Cuenta donde ingresó el dinero
  
  amount: integer("amount").notNull(), // Monto del adelanto/pago en centavos
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  notes: text("notes"), // Ej: "Seña inicial del 50% para reservar fecha"
});
```

---

## 3. Integración de API para Aplicaciones Externas (`POST /api/v1/invoices`)

Para que la app de pastelería pueda guardar comandas y emitir facturas en nuestro sistema, enviará una petición HTTP de este estilo:

### Petición HTTP (`POST`):
```json
{
  "contact_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", // ID del cliente Pedro
  "due_date": "2026-06-30T00:00:00.000Z",
  "currency": "ARS",
  "notes": "Entrega por la tarde - Tortas de cumpleaños",
  "items": [
    {
      "description": "Torta Rogel Mediana",
      "quantity": 2,
      "unit_price": 1200000 // $12.000,00 ARS c/u
    },
    {
      "description": "Caja de Macarons x12",
      "quantity": 1,
      "unit_price": 850000 // $8.500,00 ARS
    }
  ]
}
```

### Comportamiento del Servidor:
1.  Calcula los subtotales y totales automáticamente en centavos en base a los items recibidos.
2.  Genera el correlativo secuencial `invoice_number` (ej: busca la última factura emitida para la organización y le suma 1).
3.  Crea la factura en estado `'draft'` o `'sent'` según corresponda.
4.  Retorna la factura creada.

---

## 4. Conciliación y Asiento Contable Automático (Libro Mayor)

El sistema soporta tanto cobros totales en un solo pago como cobros fraccionados (señas o adelantos):

### A. Registro de un Adelanto / Seña / Pago Parcial
Cuando el cliente realiza un pago a cuenta de una factura (ej. abona una seña de $10.000 ARS para reservar una torta de $30.000 ARS):

1.  **Ingreso en la Base de Datos:** Se inserta una fila en `invoice_payments` con el monto de $10.000 ARS y la cuenta destino (ej. Mercado Pago).
2.  **Actualización de la Factura:** 
    *   Se suma el monto a la columna `amountPaid` de la factura.
    *   Como `amountPaid < total`, el estado (`status`) de la factura cambia automáticamente a `'partially_paid'`.
3.  **Asiento Contable de Partida Doble (Ledger):**
    El sistema genera una transacción contable por el valor del adelanto cobrado:
    *   **Debe (Debit):** *Cuenta Bancaria de Destino (Mercado Pago)* -> **+$10.000 ARS** (Ingresa el efectivo).
    *   **Haber (Credit):** *Ingresos por Ventas (Ingresos)* -> **+$10.000 ARS** (Registra la porción cobrada).

---

### B. Liquidación y Pago Final
Cuando el cliente abona los $20.000 ARS restantes al retirar la torta:

1.  **Ingreso del Pago Final:** Se crea un nuevo registro en `invoice_payments` por $20.000 ARS.
2.  **Actualización de la Factura:**
    *   `amountPaid` se actualiza a $30.000 ARS.
    *   Como `amountPaid == total`, el estado (`status`) de la factura cambia automáticamente a `'paid'`.
3.  **Asiento Contable Final:**
    *   **Debe (Debit):** *Cuenta de Destino (ej. Efectivo)* -> **+$20.000 ARS**.
    *   **Haber (Credit):** *Ingresos por Ventas (Ingresos)* -> **+$20.000 ARS**.
4.  *Resultado Final:* La factura queda saldada, y en el Libro Mayor de la organización figuran dos cobros que suman el 100% de la transacción en las fechas reales de caja.

