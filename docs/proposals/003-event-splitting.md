# RFC 003: División de Gastos por Eventos con Exclusiones y Recordatorios

*   **ID de la Propuesta:** 003
*   **Título:** División de Gastos en Eventos con Exclusiones (Vegetariano/Abstemio) y Flujo de Confirmación de Pagos
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Problema y Objetivos

Para reuniones sociales, viajes u asados grupales, calcular "quién le debe a quién" suele ser tedioso. El problema se complica cuando existen restricciones de consumo:
*   Personas que **no comen carne** no deberían pagar por el asado/vacío.
*   Personas que **no consumen alcohol** no deberían pagar por las cervezas/vinos.

Además, como la aplicación no es una entidad bancaria que realiza débitos automáticos, dependemos de que los usuarios realicen transferencias externas (ej: Mercado Pago, banco tradicional) y las registren manualmente en la aplicación.

### Objetivos:
1.  **División por Categoría de Gasto:** Permitir asociar gastos a categorías exclusivas (`meat`, `alcohol`, `general`).
2.  **Ajuste de Preferencias por Participante:** Poder marcar si un participante come carne o consume alcohol.
3.  **Notificaciones y Acción Rápida (UX):** Mostrar notificaciones claras a los deudores con la información bancaria del acreedor (CBU/CVU/Alias) y un botón rápido para copiarla y registrar el pago.
4.  **Flujo de Conciliación de Confianza:** Un sistema de doble confirmación para liquidar deudas de forma segura.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

Proponemos la creación de las siguientes tablas para soportar el módulo de eventos:

```typescript
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "../../features/profile/schema.db";

// 1. Tabla de Eventos
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // Ej: "Asado Viernes"
  date: timestamp("date").defaultNow().notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 2. Participantes del Evento (Pueden ser usuarios registrados o invitados manuales)
export const eventParticipants = pgTable("event_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // Null si es invitado sin cuenta
  name: text("name").notNull(), // Nombre visible (Ej: "Maria", "Pedro")
  email: text("email"), // Para invitar o enviar notificaciones
  
  // Preferencias/Restricciones del participante para el asado/evento
  excludesMeat: boolean("excludes_meat").default(false).notNull(),
  excludesAlcohol: boolean("excludes_alcohol").default(false).notNull(),
});

// 3. Gastos asociados al Evento
export const eventExpenses = pgTable("event_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(), // Ej: "Carne y carbón"
  amount: integer("amount").notNull(), // Almacenado en centavos
  paidBy: uuid("paid_by").references(() => eventParticipants.id, { onDelete: "cascade" }).notNull(),
  
  // Categoría para aplicar reglas de división
  category: text("category").default("general").notNull(), // 'meat' | 'alcohol' | 'general'
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 4. Tabla de Liquidaciones / Deudas Consolidadas (Quién le debe a quién en el evento)
export const eventDebts = pgTable("event_debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  debtorId: uuid("debtor_id").references(() => eventParticipants.id, { onDelete: "cascade" }).notNull(), // Deudor
  creditorId: uuid("creditor_id").references(() => eventParticipants.id, { onDelete: "cascade" }).notNull(), // Acreedor
  amount: integer("amount").notNull(), // Monto de la deuda en centavos
  
  // Estado del flujo de pago
  status: text("status").default("pending").notNull(), // 'pending' | 'sent' | 'confirmed'
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

## 3. Algoritmo de Cálculo y Exclusión

Cuando finaliza el evento o se añade un nuevo gasto, el sistema recalcula los balances individuales siguiendo estos pasos:

### Paso 1: Cálculo del Costo por Participante
Para cada gasto, se divide su `amount` entre el número de participantes elegibles:
*   Si la categoría del gasto es `'meat'`, se divide entre los participantes que tienen `excludesMeat = false`.
*   Si es `'alcohol'`, entre los participantes con `excludesAlcohol = false`.
*   Si es `'general'`, entre todos los participantes del evento.

### Paso 2: Cálculo del Balance Neto ($B_p$)
Para cada participante $p$:
$$B_p = \text{Total Pagado por } p - \text{Total Consumido por } p$$
*   Si $B_p > 0$, el participante es **acreedor** (puso más dinero del que consumió).
*   Si $B_p < 0$, el participante es **deudor** (consumió más dinero del que pagó).

### Paso 3: Simplificación de Deudas (Minimización de Transacciones)
Para evitar que todos le transfieran a todos, aplicamos un algoritmo de emparejamiento clásico:
1.  Identificar al deudor máximo y al acreedor máximo.
2.  El deudor máximo le paga al acreedor máximo el menor valor entre la deuda de uno y el crédito del otro.
3.  Actualizar sus balances netos y repetir hasta que todos los balances queden en cero.
4.  Guardar estos resultados en la tabla `event_debts` con estado `'pending'`.

---

## 4. Flujo de Notificaciones y Reconciliación (UX)

### A. Vista del Deudor al ingresar a la App:
Cuando un participante que es deudor (`debtorId`) inicia sesión en la aplicación, se mostrará una notificación o tarjeta interactiva destacada en su Dashboard:

> **Tarjeta de Notificación:**
> 📢 **Pendiente de Pago: Asado Viernes**
> Le debes **$12.500** a **Juan**.
> *   CBU/CVU/Alias de Juan: `juan.mp.finanzas`
> 
> `[ Copiar Alias ]`  `[ Ya transferí / Marcar como enviado ]`

*   **Copiar Alias:** Copia instantáneamente la información bancaria al portapapeles del celular o computadora.
*   **Ya transferí:** Cambia el estado en `event_debts` a `'sent'`.

---

### B. Vista del Acreedor al ingresar a la App:
Cuando el acreedor (`creditorId`) inicia sesión, si un deudor marcó la deuda como `'sent'`, se le presentará la siguiente alerta:

> **Tarjeta de Notificación:**
> 🔔 **Confirmar Recepción de Pago**
> **Maria** indica que te transfirió **$12.500** por el **Asado Viernes**. ¿Recibiste el dinero?
> 
> `[ Confirmar Recibido ]`  `[ Rechazar / Aún no llegó ]`

*   **Confirmar Recibido:** Cambia el estado a `'confirmed'`. La deuda contable se elimina (se archiva) y se actualizan los balances internos del historial contable.
*   **Rechazar:** Revierte el estado a `'pending'` y le notifica al deudor que el pago no fue recibido para que verifique el comprobante de transferencia.
