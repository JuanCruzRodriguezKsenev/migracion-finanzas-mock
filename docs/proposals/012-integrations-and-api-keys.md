# RFC 012: Motor de Integraciones y API Keys para Aplicaciones Externas

*   **ID de la Propuesta:** 012
*   **Título:** Módulo de Integraciones (Sincronización Bancaria) y API Keys para Conexión de Aplicaciones de Terceros (ej: App de Pastelería)
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para que nuestro SaaS financiero actúe como la "única fuente de verdad" (Central Ledger) de las finanzas del usuario, debe ser capaz tanto de consumir datos externos (bancos, divisas) como de recibir transacciones de aplicaciones externas desarrolladas por el usuario (como una aplicación de costeo e ingredientes para una pastelería).

Mantener separada la lógica específica de otros negocios (recetas, ingredientes) en sus propias aplicaciones mantiene nuestro núcleo financiero limpio y de alto rendimiento, mientras que la integración vía API unifica la contabilidad.

### Objetivos:
1.  **Modelo de Datos en Drizzle:** Crear las tablas `integrations` y `api_keys`.
2.  **Conexión de APIs Salientes (Bancos/Divisas):** Estructurar las credenciales y tokens de sincronización (Open Banking).
3.  **Seguridad de Conexión Entrante (API Keys):** Implementar almacenamiento seguro de llaves de API mediante cifrado Hash (SHA-256) para evitar robos en base de datos.
4.  **Endpoint de Contabilidad API-First:** Diseñar la especificación para que una app externa inserte transacciones contables de partida doble de forma remota.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

### A. Integraciones Salientes (Bancos, Divisas, Acciones)

#### Tabla: `integrations`
```typescript
import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type").notNull(), // 'bank_sync' | 'exchange_rates' | 'stock_market'
  provider: text("provider").notNull(), // 'belvo' | 'prometeo' | 'dolarapi' | 'yfinance'
  
  // Credenciales cifradas de acceso (tokens de acceso, refresh tokens, etc.)
  credentials: jsonb("credentials"),
  
  status: text("status").default("active").notNull(), // 'active' | 'error' | 'disconnected'
  lastSyncAt: timestamp("last_sync_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

### B. Integraciones Entrantes (API Keys para Apps Propias/Externas)

#### Tabla: `api_keys`
Permite generar llaves de acceso para que la app de pastelería registre compras/ventas.
```typescript
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Ej: "App Pastelería Mamá"
  
  // Almacenamos el Hash SHA-256 de la API Key, NUNCA la clave en texto plano.
  // Cuando la app externa envíe la clave, calculamos el hash y lo comparamos con este campo.
  keyHash: text("key_hash").notNull().unique(),
  
  // Permisos asignados a la llave (ej: ['transactions:write', 'accounts:read'])
  scopes: text("scopes").array().notNull(),
  
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"), // Opcional, null si es indefinido
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at")
});
```

---

## 3. Especificación del Endpoint Contable (`/api/v1/transactions`)

Cuando la aplicación de pastelería vende un producto (ej. una torta por $25.000 ARS) o compra ingredientes (harina por $5.000 ARS), realiza una petición HTTP al backend de nuestro SaaS financiero:

### Ejemplo de Petición HTTP (`POST`):
```json
{
  "description": "Venta Torta de Bodas - Cliente: María Gómez",
  "posted_at": "2026-06-23T00:20:00.000Z",
  "entries": [
    {
      "account_code": "1.1.01.01", // Código de cuenta contable: Caja/Efectivo
      "debit": 2500000, // $25.000,00 ARS ingresan al activo
      "credit": 0,
      "currency": "ARS"
    },
    {
      "account_code": "4.1.01.01", // Código de cuenta: Ingresos por Ventas Pastelería
      "debit": 0,
      "credit": 2500000, // $25.000,00 ARS se acreditan en ingresos
      "currency": "ARS"
    }
  ]
}
```

### Seguridad del Backend en la Validación de API Keys:
1.  La app externa envía la cabecera: `Authorization: Bearer fin_live_abc123...`.
2.  El backend de Next.js extrae la llave y calcula su hash SHA-256 en memoria.
3.  Busca el registro en `api_keys` donde `keyHash` coincida con el hash calculado.
4.  Si existe y está activa, asume el contexto de la `organizationId` asociada a la API Key.
5.  Valida que los scopes contengan `transactions:write`.
6.  Ejecuta la transacción en partida doble y retorna `201 Created`.
