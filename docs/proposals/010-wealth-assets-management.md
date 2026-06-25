# RFC 010: Gestión Avanzada de Patrimonio Físico (Wealth Assets)

*   **ID de la Propuesta:** 010
*   **Título:** Módulo de Patrimonio Físico (Inmuebles y Vehículos), Historial de Valuación, Gestión de Inquilinos e Incidencias
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

El patrimonio de una persona o empresa va más allá de sus cuentas bancarias e inversiones financieras. Incluye activos físicos de alto valor como inmuebles (casas, oficinas, terrenos) y vehículos (autos, motos). Estos activos devengan ingresos (alquileres) y egresos (mantenimiento, patentes, seguros, expensas), y su valor de mercado fluctúa en el tiempo.

### Objetivos:
1.  **Historial de Valuaciones (Línea de Tendencia):** Permitir registrar actualizaciones de valor periódicas en cualquier divisa para graficar la evolución del patrimonio.
2.  **Soporte Multimedia (Fotos):** Almacenar referencias a imágenes de los activos.
3.  **Gestión de Alquileres (Inquilinos):** Vincular contratos de alquiler con la tabla de contactos (`contacts`), registrando cobros recurrentes y divisas duales.
4.  **Bitácora de Incidencias (Issues Log):** Registrar problemas de mantenimiento, reparaciones necesarias y sus costos asociados para deducirlos del rendimiento neto del activo.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

Proponemos la siguiente estructura modular para el dominio de patrimonio físico (`wealth`):

```typescript
import { pgTable, text, integer, boolean, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";
import { contacts } from "./schema"; // RFC 006

// 1. Tabla Principal de Activos Patrimoniales
export const wealthAssets = pgTable("wealth_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Ej: "Departamento Palermo" o "Ford Focus 2020"
  type: text("type").notNull(), // 'real_estate' | 'vehicle' | 'other'
  
  // Compra Inicial
  purchasePrice: integer("purchase_price").notNull(), // Centavos
  purchaseCurrency: text("purchase_currency").default("USD").notNull(),
  acquiredAt: timestamp("acquired_at"),
  
  // Detalles específicos de Inmuebles
  address: text("address"),
  squareMeters: integer("square_meters"),
  
  // Detalles específicos de Vehículos
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  licensePlate: text("license_plate"), // Patente
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 2. Historial de Valuaciones (Para gráficos de tendencia)
export const wealthAssetValuations = pgTable("wealth_asset_valuations", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => wealthAssets.id, { onDelete: "cascade" }).notNull(),
  valuationDate: timestamp("valuation_date").defaultNow().notNull(),
  value: integer("value").notNull(), // Valuación estimada en centavos
  currency: text("currency").default("USD").notNull(),
});

// 3. Imágenes Asociadas a los Activos
export const wealthAssetImages = pgTable("wealth_asset_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => wealthAssets.id, { onDelete: "cascade" }).notNull(),
  imageUrl: text("image_url").notNull(), // URL de almacenamiento local o CDN
  description: text("description"), // Ej: "Frente", "Contrato escaneado"
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 4. Contratos de Alquiler / Inquilinos
export const wealthAssetTenants = pgTable("wealth_asset_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => wealthAssets.id, { onDelete: "cascade" }).notNull(),
  tenantContactId: uuid("tenant_contact_id").references(() => contacts.id, { onDelete: "restrict" }).notNull(), // Vinculado a contactos
  
  rentAmount: integer("rent_amount").notNull(), // Monto de alquiler (centavos)
  currency: text("currency").default("ARS").notNull(),
  paymentFrequency: text("payment_frequency").default("monthly").notNull(), // 'monthly' | 'quarterly'
  
  contractStart: timestamp("contract_start").notNull(),
  contractEnd: timestamp("contract_end"),
  isActive: boolean("is_active").default(true).notNull()
});

// 5. Registro de Incidencias / Problemas de Mantenimiento
export const wealthAssetIssues = pgTable("wealth_asset_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").references(() => wealthAssets.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(), // Ej: "Rotura de termotanque"
  description: text("description"),
  
  cost: integer("cost").default(0).notNull(), // Costo de reparación (centavos)
  currency: text("currency").default("ARS").notNull(),
  status: text("status").default("pending").notNull(), // 'pending' | 'resolved' | 'discarded'
  
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at")
});
```

---

## 3. Lógica Contable de Egresos y Rentas (Libro Mayor)

La integración del patrimonio con la contabilidad de partida doble del SaaS se maneja mediante flujos automatizados de transacciones:

### A. Cobro del Alquiler (Renta del Inmueble)
Cuando el inquilino paga el alquiler (ej: $150.000 ARS):
*   **Debe (Debit):** *Caja de Ahorro / Billetera del Propietario (Activo)* -> **+$150.000 ARS**
*   **Haber (Credit):** *Ingresos por Alquileres (Ingresos)* -> **+$150.000 ARS**
*   *Asociación:* Esta transacción se vincula al ID del activo en `wealth_assets` para poder calcular su tasa de retorno neta.

### B. Pago de Gastos Fijos (Patente, Seguro, Expensas o Reparación de Incidencias)
Si pagas $40.000 ARS por expensas o para solucionar la incidencia "Rotura de termotanque":
*   **Debe (Debit):** *Gasto por Mantenimiento / Expensas de Inmuebles (Egreso)* -> **+$40.000 ARS**
*   **Haber (Credit):** *Tu Cuenta Bancaria (Activo)* -> **-$40.000 ARS**
*   *Asociación:* El gasto se vincula directamente al activo, lo que reduce el retorno neto del inmueble/vehículo en los informes anuales.

---

## 4. Retorno de Inversión y Línea de Tendencia (Proyección)

Con este esquema relacional, la aplicación puede realizar cálculos financieros avanzados automáticamente:

1.  **Cálculo de Rentabilidad Anual Neta (Cap Rate):**
    $$\text{Rendimiento Anual} = \frac{\sum(\text{Cobros de Alquiler}) - \sum(\text{Gastos + Expensas + Reparaciones})}{\text{Última Valuación del Activo}} \times 100$$
2.  **Línea de Tendencia Patrimonial:**
    Al agrupar los datos de `wealth_asset_valuations` por fecha, el frontend puede trazar un gráfico de curvas temporales mostrando cómo tu departamento se revalorizó de $100.000 USD a $125.000 USD a lo largo de los años.
