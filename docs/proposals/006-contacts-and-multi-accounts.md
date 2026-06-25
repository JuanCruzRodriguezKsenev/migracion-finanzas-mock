# RFC 006: Modelado de Contactos y Multi-Cuentas de Transferencia

*   **ID de la Propuesta:** 006
*   **Título:** Estructura de Datos para Contactos con Múltiples Cuentas de Cobro y Tarjetas
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

En el ecosistema financiero actual (especialmente en Argentina con el sistema de Alias, CBU y CVU), los usuarios y sus contactos poseen cuentas en múltiples entidades bancarias (BBVA, Galicia, etc.) y billeteras virtuales (Mercado Pago, Cuenta DNI, Ualá).

Para que la división de gastos en eventos (RFC 003) y transacciones generales funcionen de manera fluida, la base de datos debe ser capaz de modelar esta multiplicidad de cuentas y tarjetas sin redundancia ni mezcla de datos de privacidad.

### Objetivos:
1.  **Modelo de Contactos Flexibles:** Permitir que cada contacto tenga una agenda de múltiples cuentas de destino para transferencias (Relación 1 a Muchos).
2.  **Atributos de Cobro en Cuentas Propias:** Añadir campos de transferencia (CBU/CVU, Alias, CUIT) a nuestras cuentas de balance para que otros puedan pagarnos fácilmente.
3.  **Modelado de Tarjetas:** Estructurar las tarjetas (de débito y crédito) como instrumentos vinculados a nuestras cuentas financieras.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

### A. Dominio de Contactos Externos

#### 1. Tabla: `contacts`
Representa a una persona en la agenda de la organización/workspace.
```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Ej: "Pedro Gómez"
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

#### 2. Tabla: `contact_payment_methods` (Cuentas del Contacto)
Representa los CBUs/Alias que el contacto utiliza para recibir dinero. **No tienen saldo.**
```typescript
export const contactPaymentMethods = pgTable("contact_payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }).notNull(),
  
  institution: text("institution").notNull(), // Ej: "Mercado Pago", "BBVA", "Cuenta DNI"
  type: text("type").default("wallet").notNull(), // 'bank_account' | 'wallet'
  
  // Datos de transferencia
  cbuCvu: text("cbu_cvu"), // 22 dígitos numéricos
  alias: text("alias"), // Texto
  
  // Datos del titular (por si transfiere a cuenta de un tercero)
  holderName: text("holder_name"), 
  holderTaxId: text("holder_tax_id"), // CUIT/CUIL
  
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
```

---

### B. Dominio de Cuentas Propias (Nuestra Contabilidad)

Actualizamos y ampliamos las tablas que definimos en el RFC 002 para incorporar datos de transferencia y tarjetas:

#### 1. Tabla: `accounts` (Nuestras Cuentas con Saldo)
```typescript
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(), // Ej: "Mi Caja de Ahorro BBVA"
  type: text("type").notNull(), // 'asset' | 'liability'
  balance: integer("balance").default(0).notNull(), // En centavos
  currency: text("currency").default("ARS").notNull(),
  
  // Datos de transferencia propios (para cuando nos tengan que pagar a nosotros)
  cbuCvu: text("cbu_cvu"),
  alias: text("alias"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

#### 2. Tabla: `cards` (Tarjetas vinculadas a nuestras cuentas)
Una tarjeta puede ser de débito (descuenta saldo de una cuenta asociada directamente) o crédito (representa una línea de deuda independiente).
```typescript
export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(), // Cuenta bancaria principal
  
  type: text("type").notNull(), // 'credit' | 'debit'
  network: text("network").default("visa").notNull(), // 'visa' | 'mastercard' | 'amex' | 'other'
  label: text("label").notNull(), // Ej: "Visa Gold Personal"
  lastFour: text("last_four").notNull(), // Ej: "4321"
  
  // Exclusivos de tarjeta de crédito
  creditLimit: integer("credit_limit"), // Límite en centavos
  closingDay: integer("closing_day"), // Día de cierre de tarjeta
  dueDay: integer("due_day"), // Día de vencimiento de pago
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
```

---

## 3. Integración en Flujos de Pago

Cuando se consolida una deuda grupal (ej: *"Pedro le debe $5.000 a Juan"*):
1.  **Búsqueda del Acreedor (Juan):** La aplicación busca en las cuentas de Juan (`accounts`) si tiene alguna con Alias/CBU cargado. Si hay varias, toma la marcada por defecto.
2.  **Renderizado del Cobro:** En la notificación de Pedro se inyecta el `alias` o `cbuCvu` de esa cuenta específica.
3.  **Búsqueda del Deudor (Pedro):** Si Juan quiere recordarle a Pedro por otro canal (ej: WhatsApp), la app le permite ver la lista de cuentas de Pedro (`contact_payment_methods`) para sugerirle: *"Che Pedro, transferime a mi alias o si querés te paso el tuyo de Mercado Pago `pedro.mp` para que me envíes desde ahí"*.
