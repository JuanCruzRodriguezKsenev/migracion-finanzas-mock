# RFC 015: Perfil del Usuario, Preferencias de Interfaz y Consolidación Monetaria

*   **ID de la Propuesta:** 015
*   **Título:** Módulo de Perfil del Usuario, Preferencias de Formateo y Algoritmo de Patrimonio Neto Consolidado
*   **Estado:** `DRAFT` (Enmienda 2026-09-07 — Cotizaciones Históricas)
*   **Fecha de Creación:** 2026-06-22
*   **Fecha de Enmienda:** 2026-09-07
*   **Autor:** Antigravity (AI Coding Assistant)

> [!NOTE]
> **Enmienda de Arquitectura (2026-09-07 — Bloque B):**
> Se incorpora la Sección 5 con el registro formal de la decisión arquitectónica sobre **Cotizaciones Históricas y Manejo Multimoneda** (tabla `exchange_rates`, cierres contables persistidos vs. saldos vivos cacheados). Esta decisión queda asentada por escrito para no perder el criterio técnico de diseño, mientras que su implementación de código se reserva para la ronda correspondiente a este RFC.

---

## 1. Contexto y Objetivos

Para ofrecer una experiencia de usuario altamente personalizada, el sistema debe adaptarse a las preferencias de formato de cada persona (idioma, formato de fecha, formato de miles, zona horaria y moneda base). 

Además, dado que el usuario posee activos en diferentes monedas (ej: cuentas bancarias en pesos, inmuebles e inversiones bursátiles en dólares), necesitamos una métrica unificada de "Patrimonio Neto Total" expresada en la moneda preferida del perfil del usuario.

### Objetivos:
1.  **Esquema de Preferencias en Drizzle:** Definir todos los campos de configuración en la tabla `users`.
2.  **Configuración de Multi-tenancy Activa:** Guardar el Workspace en uso actual para gestionar la navegación entre espacios personales y laborales de forma fluida.
3.  **Algoritmo de Consolidación Monetaria:** Escribir la lógica para convertir todos los activos y pasivos a la moneda base del usuario en tiempo real para generar reportes unificados.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

```typescript
import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../../features/auth/schema.db";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // UUID provisto por el sistema de autenticación
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"), // Hash seguro (Bcrypt/Argon2)
  bio: text("bio"),
  imageUrl: text("image_url"),
  
  // --- MULTI-TENANCY ACTIVO ---
  // Guarda el Workspace/Organización en la que opera actualmente el usuario
  activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, { onDelete: "set null" }),
  
  // --- PREFERENCIAS VISUALES Y OPERATIVAS ---
  theme: text("theme").default("system").notNull(), // 'light' | 'dark' | 'system'
  defaultView: text("default_view").default("dashboard").notNull(), // Pantalla de inicio por defecto
  roundAmounts: boolean("round_amounts").default(false).notNull(), // Redondear montos rápidos en la UI
  weeklyStart: text("weekly_start").default("monday").notNull(), // 'monday' | 'sunday'
  includeTransfers: boolean("include_transfers").default(true).notNull(), // Incluir transferencias en reportes de gastos
  
  // --- PREFERENCIAS DE LOCALIZACIÓN Y FORMATEO ---
  currency: text("currency").default("ARS").notNull(), // Moneda base consolidada (ej: ARS, USD, EUR)
  dateFormat: text("date_format").default("DD/MM/YYYY").notNull(), // Formato de fechas
  numberFormat: text("number_format").default("es-AR").notNull(), // Formato de números de JS
  timezone: text("timezone").default("America/Argentina/Buenos_Aires").notNull(), // Zona horaria
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

## 3. Lógica de Aplicación de Preferencias en el Frontend (UX)

El cliente de Next.js lee el perfil del usuario autenticado para adaptar toda la visualización del sistema dinámicamente:

### A. Formateo de Moneda
Usando el `numberFormat` y la moneda de la cuenta (`currency`):
```typescript
export function renderMoney(amountInCents: number, currency: string, user: typeof users.$inferSelect) {
  const value = amountInCents / 100;
  const formatted = new Intl.NumberFormat(user.numberFormat, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: user.roundAmounts ? 0 : 2,
  }).format(value);
  return formatted;
}
// Ejemplo para user.numberFormat = 'es-AR', currency = 'USD', amount = 150075 ($1500.75):
// Retorna: "US$ 1.500,75" (o "$1.501" si roundAmounts = true)
```

### B. Formateo de Fecha y Zona Horaria
Todas las marcas de tiempo de la base de datos se almacenan en UTC. Al renderizarlas, se traducen a la zona horaria del usuario (`timezone`) usando bibliotecas como `dayjs` o `date-fns-tz` y se muestran con el formato `dateFormat` (ej: `23/06/2026`).

---

## 4. Algoritmo de Consolidación del Patrimonio Neto (Net Worth)

Para calcular la métrica unificada de patrimonio neto que se muestra en el Dashboard principal:

$$\text{Patrimonio Neto Total} = \sum(\text{Activos Convertidos}) - \sum(\text{Pasivos Convertidos})$$

### Algoritmo Optimizado (Criterios de Rendimiento de Vercel):
1.  **Deduplicación de Configuración (`server-cache-react`):** Envolver el fetching de preferencias del usuario y la organización activa mediante `React.cache()` en la capa de servicios para que sea compartido por todos los componentes del árbol sin llamadas redundantes a la base de datos.
2.  **Obtener Todos los Saldos en Paralelo (`async-parallel`):**
    Consultar los saldos de cuentas, tarjetas, activos y deudas en paralelo utilizando `Promise.all` para evitar cascadas asíncronas en el servidor:
    ```typescript
    const [ctaSaldos, assetSaldos, loanSaldos] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.organizationId, orgId)),
      db.select().from(wealthAssets).where(eq(wealthAssets.organizationId, orgId)),
      db.select().from(loans).where(eq(loans.organizationId, orgId))
    ]);
    ```
3.  **Evitar Consultas en Bucle de Tasas de Cambio (`async-parallel-fetching`):**
    *   **Incorrecto:** Llamar a `await ExchangeRateService.getRate(Mo, Md)` de forma secuencial dentro de un bucle `map` para cada cuenta.
    *   **Correcto:** Identificar el conjunto único de divisas de origen involucradas en los saldos (`Mo_unicas`) y consultar todos sus tipos de cambio hacia la moneda destino ($M_d$) en una única consulta de base de datos o en paralelo mediante `Promise.all`.
4.  **Cálculo en Memoria:** Una vez que el mapa de tasas de cambio y los saldos están cargados en memoria del servidor, realizar la multiplicación y agregación de forma puramente síncrona:
    $$\text{Saldo Convertido} = S \times \text{Tasa de Cambio en Memoria}$$

---

## 5. Registro de Decisión Arquitectónica: Cotizaciones Históricas y Manejo Multimoneda

*Nota: Esta sección documenta la decisión formal de diseño para el almacenamiento de cotizaciones y conversión cambiaria. Su construcción queda fuera del alcance del Bloque B y se ejecutará cuando se aborde integralmente el RFC 015.*

### A. Problemática
El cálculo del patrimonio neto consolidado y la visualización de balances o transacciones en monedas extranjeras (USD, EUR, etc.) requiere un criterio explícito para evitar distorsiones o inconsistencias causadas por la volatilidad cambiaria histórica.

### B. Criterio de Doble Estrategia

| Dimensión | Enfoque Técnico | Criterio de Negocio |
| :--- | :--- | :--- |
| **Cierres mensuales** | **Persistidos en Base de Datos** | Todo balance cerrado (`monthly_summaries`) fija la cotización vigente al cierre y la guarda. Es el único caso donde hay que almacenarla: un cierre es un total en moneda base sin dos importes de los que deducir el cociente. No se recalcula retrospectivamente. |
| **Transacciones de cambio** | **Deducida, nunca almacenada** | Una transacción de cambio ya lleva los dos importes en sus asientos, así que su cotización efectiva es el cociente entre ambos. Guardarla aparte crearía un dato que puede contradecir a los asientos. Esta regla ya está implementada y documentada en `patterns.md` §Cambio de divisas; esta sección no la altera. |
| **Saldos Vivos del Dashboard** | **Caché del Día (In-Memory / TTL)** | La conversión en tiempo real de saldos vigentes hacia la divisa preferida del usuario utiliza la cotización oficial/de referencia del día. Se cachea a nivel servidor con TTL (ej. 24 horas o intradía) para evitar llamadas concurrentes a APIs externas o consultas recurrentes a la base de datos. |

### C. Esquema Relacional de Referencia (`exchange_rates`)
Para la persistencia histórica de tasas de cambio diarias/oficiales:

```typescript
import { pgTable , uuid , varchar , bigint , date , timestamp , uniqueIndex , index } from "drizzle-orm/pg-core" ;

export const exchangeRates = pgTable( "exchange_rates" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  // Sin `organization_id`: las cotizaciones son dato de referencia del sistema, iguales para todos
  // los inquilinos. Una columna de tenant anulable obligaría a todas las consultas a hacer
  // `or( eq(orgId) , isNull(orgId) )`, que es exactamente el patrón que filtra datos cuando alguien
  // olvida la mitad. Una cotización propia por organización necesita su propia decisión.
  baseCurrency:   varchar( "base_currency"   , {length: 10} ).notNull() , // Ej: 'USD'
  targetCurrency: varchar( "target_currency" , {length: 10} ).notNull() , // Ej: 'ARS'
  // Tasa entera con factor fijo RATE_SCALE = 1_000_000 (seis decimales). 1 USD = 1487,50 ARS se
  // guarda como 1_487_500_000. El factor es único y no negociable: una escala ambigua se lee mal
  // tarde o temprano. Seis decimales cubren también los pares invertidos (1 ARS = 0,000672 USD).
  rate:           bigint( "rate" , {mode: "number"} ).notNull() ,
  // `date` y no `timestamp`: la cotización es de un día. Con marca de tiempo, dos capturas del mismo
  // día a distinta hora pasarían el índice único y habría dos cotizaciones para la misma fecha.
  rateDate:       date( "rate_date" ).notNull() ,
  source:         varchar( "source" , {length: 50} ).default( "official" ).notNull() , // 'official' | 'blue' | 'mep' | 'ccl'
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueRateEntry: uniqueIndex( "exchange_rates_currency_date_source_unique" ).on(
    table.baseCurrency ,
    table.targetCurrency ,
    table.rateDate ,
    table.source
  ) ,
  lookupIdx: index( "exchange_rates_lookup_idx" ).on(
    table.targetCurrency ,
    table.baseCurrency ,
    table.rateDate
  ) ,
} ) ; } ) ;
```

