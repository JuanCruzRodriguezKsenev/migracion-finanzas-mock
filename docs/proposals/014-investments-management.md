# RFC 014: Gestión de Inversiones, Multiactivos y Dividendos

*   **ID de la Propuesta:** 014
*   **Título:** Módulo de Portafolio de Inversión Multi-Broker, Historial de Valuación y Registro de Dividendos
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para maximizar el patrimonio neto, los usuarios invierten en activos bursátiles (Acciones, CEDEARs, Bonos), Criptomonedas, Fondos Comunes (FCI) y Plazos Fijos. Estas inversiones residen en brokers de bolsa (Cocos, Balanz) o billeteras (Binance, Ledger) y generan rendimientos variables, revalorizaciones y rentas periódicas (dividendos).

### Objetivos:
1.  **Modelo Multi-Broker (Integración de Cuentas):** Vincular cada activo de inversión a una cuenta real (`accounts.id`) que actúa como la cartera/broker.
2.  **Soporte de Actualización Dual (API / Manual):** Sincronizar precios automáticamente vía API para activos cotizados en bolsa (acciones/cripto) y permitir ingresos manuales para activos privados o plazos fijos.
3.  **Historial de Valuación Patrimonial:** Registrar la cotización histórica para dibujar el rendimiento acumulado de la cartera (Ganancia/Pérdida - P&L).
4.  **Registro Contable de Dividendos:** Controlar los dividendos e intereses cobrados, su acumulación histórica y su correspondiente acreditación en el saldo del broker.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

Proponemos la creación de las tablas de Activos, Historial de Precios y Dividendos cobrados:

```typescript
import { pgTable, text, integer, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";
import { accounts } from "../../features/accounts/schema.db";

// 1. Tabla de Activos de Inversión
export const investmentAssets = pgTable("investment_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  
  // Cuenta del Broker o Billetera donde reside la inversión (ej: Cuenta Cocos Capital)
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(), // Ej: "Apple Inc." o "Bitcoin"
  ticker: text("ticker").notNull(), // Ej: "AAPL", "BTC", "AL30" (para sincronizar)
  type: text("type").notNull(), // 'stock' | 'crypto' | 'bond' | 'fci' | 'fixed_term' | 'other'
  
  // Tenencia y Costo
  quantity: doublePrecision("quantity").notNull(), // Cantidad (admite decimales para cripto, ej: 0.045 BTC)
  averagePurchasePrice: integer("average_purchase_price").notNull(), // Precio de compra unitario promedio (en centavos)
  currency: text("currency").default("USD").notNull(), // Divisa de compra
  
  // Método de Actualización
  updateMethod: text("update_method").default("api").notNull(), // 'api' | 'manual'
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 2. Historial de Precios / Cotizaciones (Para calcular el P&L y la curva de valor del portafolio)
export const investmentValuations = pgTable("investment_valuations", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => investmentAssets.id, { onDelete: "cascade" }).notNull(),
  priceDate: timestamp("price_date").defaultNow().notNull(),
  price: integer("price").notNull(), // Cotización en centavos a esa fecha
  currency: text("currency").default("USD").notNull()
});

// 3. Registro de Dividendos o Intereses Cobrados
export const investmentDividends = pgTable("investment_dividends", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => investmentAssets.id, { onDelete: "cascade" }).notNull(),
  
  // Cuenta líquida donde ingresó el efectivo del dividendo (suele ser la cuenta corriente del Broker)
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }).notNull(),
  
  amount: integer("amount").notNull(), // Monto cobrado en centavos
  currency: text("currency").default("USD").notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  notes: text("notes") // Ej: "Pago Dividendos Q3"
});
```

---

## 3. Lógica Contable de Dividendos e Intereses

Cuando cobras un dividendo o un cupón de interés de un bono:

1.  **Registro en la Tabla:** Se guarda una fila en `investment_dividends` con los datos del cobro.
2.  **Asiento de Partida Doble (Ledger):** El sistema genera automáticamente la transacción en tu Libro Mayor para sumar ese efectivo a tu broker:
    *   **Debe (Debit):** *Cuenta Efectiva del Broker / Banco (Activo)* -> **+$Monto** (Ingresa el efectivo).
    *   **Haber (Credit):** *Ingresos por Dividendos / Rentas (Ingresos)* -> **+$Monto** (Registra la ganancia).
3.  *Resultado:* El dinero líquido en tu broker aumenta automáticamente y la ganancia se registra en tus reportes anuales de ingresos pasivos.

---

## 4. Consulta de Rendimiento y Dividendos Acumulados

El sistema puede resolver dos consultas clave para la interfaz de inversiones:

### A. Ganancia / Pérdida del Portafolio (P&L):
Calcula la diferencia entre el valor actual de mercado (último registro en `investment_valuations`) y el costo medio de compra:
$$\text{Rendimiento del Activo} = \text{Cantidad} \times (\text{Precio Actual} - \text{Precio de Compra})$$

### B. Dividendos Acumulados Históricos:
Obtiene el total del flujo de caja pasivo generado por ese activo:
```typescript
const accumulatedDividends = await db
  .select({
    totalEarned: sql<number>`SUM(${investmentDividends.amount})`
  })
  .from(investmentDividends)
  .where(eq(investmentDividends.assetId, targetAssetId));
```
Esto le permite al usuario ver: **"Apple Inc.: Tenencia: $500 USD | Rendimiento de Capital: +$45 USD | Dividendos Acumulados Cobrados: +$12 USD"**.
