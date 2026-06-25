# RFC 007: Gestión Avanzada de Tarjetas de Crédito, Ciclos e Intereses

*   **ID de la Propuesta:** 007
*   **Título:** Modelado Avanzado de Tarjetas, Ciclos de Cierre/Vencimiento, Intereses y Cumplimiento de Seguridad
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Las tarjetas de crédito no se comportan como cuentas bancarias normales. Tienen una línea de crédito otorgada, un saldo acumulado durante el mes que se congela en una "Fecha de Cierre" y debe pagarse antes de una "Fecha de Vencimiento". Si no se cancela el total, se aplican tasas de interés complejas sobre el saldo remanente.

Para un SaaS financiero escalable, automatizar el cálculo de estos ciclos, alertar sobre vencimientos y estimar los intereses financieros de forma transparente aporta un valor diferencial masivo para el usuario.

### Objetivos:
1.  **Modelo de Datos Completo para Tarjetas:** Soporte para límites de compra, pago mínimo, tasas de interés nominales anuales (TNA), fechas de cierre y vencimiento.
2.  **Seguridad de Datos Financieros:** Establecer directrices estrictas para cumplir con las mejores prácticas de seguridad (PCI-DSS), prohibiendo el almacenamiento de datos sensibles como el CVV real.
3.  **Lógica del Ciclo de Tarjeta:** Algoritmo para separar los consumos del período actual (que vencerán el mes siguiente) de los consumos facturados que vencen en el mes corriente.
4.  **Estimación de Intereses por Financiación:** Calcular los intereses devengados si el usuario no realiza el pago total.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

Proponemos separar las tarjetas de las cuentas genéricas para dotarlas de atributos financieros específicos:

```typescript
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { accounts } from "../../features/accounts/schema.db";
import { organizations } from "../../features/auth/schema.db";

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  
  // Cuenta bancaria/billetera a la que pertenece o está vinculada para el débito automático de su pago
  linkedAccountId: uuid("linked_account_id").references(() => accounts.id, { onDelete: "set null" }),

  label: text("label").notNull(), // Ej: "Visa Black Galicia"
  type: text("type").notNull(), // 'credit' | 'debit'
  network: text("network").notNull(), // 'visa' | 'mastercard' | 'amex' | 'other'
  
  // Seguridad (Strict compliance)
  lastFour: text("last_four").notNull(), // Solo guardamos los últimos 4 dígitos
  expiryMonth: integer("expiry_month").notNull(), // Ej: 12
  expiryYear: integer("expiry_year").notNull(), // Ej: 2029
  
  // --- CAMPOS EXCLUSIVOS DE TARJETA DE CRÉDITO ---
  creditLimit: integer("credit_limit"), // Límite de compra en centavos
  
  // Fechas del Ciclo (Días del mes)
  closingDay: integer("closing_day"), // Día del mes en que cierra (ej: 25)
  dueDay: integer("due_day"), // Día del mes en que vence el pago (ej: 5 del mes siguiente)
  
  // Tasas de Interés (Almacenado como entero multiplicado por 100. Ej: 85.5% TNA = 8550)
  interestRateFinancing: integer("interest_rate_financing"), // TNA para saldos financiados
  interestRatePenalty: integer("interest_rate_penalty"), // TNA punitorio por retraso
  
  // Costos Fijos
  monthlyMaintenanceFee: integer("monthly_maintenance_fee").default(0).notNull(), // Mantenimiento mensual (centavos)
  annualRenewalFee: integer("annual_renewal_fee").default(0).notNull(), // Renovación anual (centavos)
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
```

---

## 3. Seguridad y Almacenamiento de Datos (PCI-DSS Compliance)

Para proteger al SaaS de filtraciones de datos y cumplir con las normativas internacionales de seguridad de tarjetas de pago:

1.  **Prohibición de CVV:** El código CVV/CVC **no se almacenará bajo ninguna circunstancia** en la base de datos del servidor. Si el frontend requiere el CVV para alguna operación temporal, este solo vivirá en la memoria del cliente (React State) y nunca viajará en payloads que se guarden en base de datos.
2.  **Prohibición del PAN (Primary Account Number):** El número de tarjeta de 16 dígitos completo **no se guardará**. Solo se almacenará la columna `lastFour` (los últimos 4 dígitos) para que el usuario identifique visualmente la tarjeta en la interfaz.

---

## 4. Lógica de Ciclos de Facturación de Tarjeta de Crédito

Una tarjeta tiene dos estados de consumo activos en paralelo:

1.  **Saldo Facturado (Período Anterior):** Transacciones realizadas entre el último día de cierre y el día de cierre actual. Este monto se congela y representa el *"Saldo a Pagar"* (o pago mínimo). Debe pagarse antes de la *Fecha de Vencimiento*.
2.  **Saldo en Curso (Período Actual):** Transacciones realizadas después del día de cierre actual. Estos consumos no vencen este mes, sino en el vencimiento del mes siguiente.

### Algoritmo de Filtro de Consumos por Período:
Dado un día de cierre $C$ y un día de vencimiento $V$:
*   **Transacciones del Período Facturado:**
    $$\text{Fecha transacciones} \in [\text{Cierre Mes Anterior}, \text{Cierre Mes Actual}]$$
*   **Transacciones del Período en Curso:**
    $$\text{Fecha transacciones} > \text{Cierre Mes Actual}$$

---

## 5. Cálculo y Asiento de Intereses por Financiación

Si al llegar la *Fecha de Vencimiento*, el usuario realiza un pago menor al Saldo Facturado (pero mayor o igual al Pago Mínimo):

1.  **Cálculo del Saldo Financiado ($S_f$):**
    $$S_f = \text{Saldo Facturado} - \text{Monto Pagado}$$
2.  **Cálculo de Intereses Diarios ($I_d$):**
    Usando la Tasa Nominal Anual (TNA) de financiación dividida entre 365 días:
    $$I_d = S_f \times \left( \frac{\text{interestRateFinancing}}{10000 \times 365} \right) \times \text{Días de financiación}$$
3.  **Registro Contable del Interés:**
    Al inicio del nuevo período, el sistema calcula este interés y genera automáticamente el siguiente asiento contable en partida doble:
    *   **Debe (Debit):** *Gasto por Intereses Financieros* (Categoría egresos).
    *   **Haber (Credit):** *Cuenta de la Tarjeta de Crédito* (Incrementa el saldo adeudado de la tarjeta).

---

## 6. Costos de Mantenimiento y Renovaciones

Las tarjetas de crédito suelen acarrear costos fijos independientes de los consumos del usuario. Estos se procesan de la siguiente manera:

1.  **Costo de Mantenimiento Mensual:** En la fecha de cierre de la tarjeta (`closingDay`), si `monthlyMaintenanceFee > 0`, el sistema genera automáticamente una transacción de gasto:
    *   **Debe (Debit):** *Gasto por Mantenimiento de Cuenta* (Egresos).
    *   **Haber (Credit):** *Cuenta de Tarjeta de Crédito* (Suma al saldo a pagar).
2.  **Costo de Renovación Anual:** Al cumplirse el año de emisión de la tarjeta (calculado desde `createdAt` o ingresado manualmente), el sistema debita el valor de `annualRenewalFee` en un asiento contable idéntico pero clasificado como *Gasto de Renovación*.

---

## 7. Soporte Contable Multidivisa (ARS / USD / Otras)

En mercados como el argentino, las tarjetas de crédito operan con un **saldo dual** (un balance en pesos ARS y otro balance en dólares USD que se cobran de manera independiente en el mismo resumen).

### A. Diseño de Base de Datos sin Redundancia
En lugar de añadir columnas rígidas como `balance_ars` y `balance_usd` a la tabla de tarjetas, implementamos el soporte multimoneda a nivel de la tabla `ledger_entries` (Apuntes contables).

Añadimos una columna `currency` a cada apunte:
```typescript
// En la tabla ledger_entries:
export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => ledgerTransactions.id),
  accountId: uuid("account_id").references(() => accounts.id),
  debit: bigint("debit", { mode: "bigint" }).default(0).notNull(),
  credit: bigint("credit", { mode: "bigint" }).default(0).notNull(),
  
  // Especificación de la divisa de este apunte
  currency: text("currency").default("ARS").notNull(), 
});
```

### B. Cálculo Dinámico de Balances
El saldo de una tarjeta o cuenta en una moneda específica se calcula sumando sus apuntes de forma dinámica agrupando por divisa:
```typescript
// Consulta conceptual en Drizzle para obtener el balance multidivisa de una tarjeta:
const cardBalances = await db
  .select({
    currency: ledgerEntries.currency,
    totalBalance: sql<number>`SUM(${ledgerEntries.debit} - ${ledgerEntries.credit})`
  })
  .from(ledgerEntries)
  .where(eq(ledgerEntries.accountId, cardAccountId))
  .groupBy(ledgerEntries.currency);

// Resultado devuelto:
// [ { currency: 'ARS', totalBalance: 5500000 }, { currency: 'USD', totalBalance: 12050 } ]
// (Representa $55.000,00 ARS y $120,50 USD de deuda acumulada).
```

### C. Arbitraje y Pago de Consumos en Dólares con Pesos
Cuando el usuario decide pagar su saldo en dólares usando pesos de su cuenta bancaria (lo cual involucra un tipo de cambio / cotización "Dólar Tarjeta"), el sistema registra una sola transacción de **arbitraje de divisas** para equilibrar el libro diario:

*   **Paso 1:** El usuario paga $100 USD (Cotización: $1 USD = $1.400 ARS). Paga en total $140.000 ARS de su cuenta bancaria.
*   **Asiento Contable de Pago (Partida Doble Balanceada):**
    1.  **Debe (Debit) en USD:** *Cuenta Tarjeta de Crédito* -> **+$100 USD** (Reduce la deuda en dólares a cero).
    2.  **Haber (Credit) en ARS:** *Caja de Ahorro en Pesos* -> **-$140.000 ARS** (Saca los pesos del banco).
    3.  **Diferencia de Cambio (Asiento de Cierre):** El sistema calcula y registra la diferencia en una cuenta contable del sistema llamada *Pérdida por Tipo de Cambio (Diferencial)* para mantener el balance global cuadrado matemáticamente.

---

## 8. Representación Visual y Lógica en la Interfaz (Credit vs. Debit Card)

Para que el usuario entienda de un vistazo su salud de deuda, la aplicación diferencia la lógica y el diseño visual de cada tipo de tarjeta:

### A. Lógica y Vista de Tarjeta de Débito (Debit Card)
Una tarjeta de débito no posee balance propio; es un "espejo" de una cuenta bancaria con fondos.

*   **Saldo Mostrado:** Lee directamente el balance actual de la cuenta vinculada (`linkedAccountId`).
*   **Comportamiento:**
    *   No tiene límite de crédito, ni fecha de cierre, ni cuotas futuras.
    *   Al realizar un gasto con la tarjeta de débito, la transacción descuenta el dinero inmediatamente de la cuenta corriente/caja de ahorros asociada.
*   **En la UI:** Se presenta con una etiqueta clara que dice `DÉBITO` y el nombre de la cuenta bancaria de origen (ej: *BBVA Caja de Ahorro*).

---

### B. Lógica y Vista de Tarjeta de Crédito (Credit Card)
Una tarjeta de crédito es una cuenta de pasivo que muestra múltiples capas de información financiera:

1.  **Tope (Límite de Crédito):** El monto máximo que el banco autorizó gastar (ej: $1.000.000).
2.  **Saldo Consumido Total:** La suma de toda la deuda acumulada en la tarjeta. Se divide visualmente en:
    *   *Saldo Facturado (A pagar este mes):* Consumos del período cerrado que vencen pronto.
    *   *Saldo en Curso (Siguiente período):* Consumos realizados tras la fecha de cierre que vencerán el próximo mes.
    *   *Cuotas Futuras Pendientes:* Saldo total remanente de compras en cuotas (`installmentPlans`) que aún no se han facturado, pero que restan del límite disponible (ej: si compraste en 10 cuotas, las 9 restantes).
3.  **Disponible para Compras:** El límite que le queda al usuario para seguir gastando:
    $$\text{Disponible} = \text{Límite} - (\text{Saldo Facturado} + \text{Saldo en Curso} + \text{Cuotas Futuras})$$
4.  **Resumen de Intereses y Mínimo:** Muestra la tasa de financiación (TNA) y el Pago Mínimo calculado para evitar mora.

---

### C. Diseño Visual Premium (Frontend Design Standards)

De acuerdo con la habilidad de diseño, las tarjetas no serán meras filas de texto; se renderizarán como **tarjetas físicas digitales interactivas**:

*   **Color de Fondo Dinámico:** Extraído automáticamente en hexadecimal desde la API de Brandfetch (ej: azul para *Galicia*, rojo para *Santander*, negro mate para *American Express*).
*   **Logotipo de la Entidad:** El logo oficial de la marca (`logoUrl` de Brandfetch) posicionado en la esquina superior.
*   **Estilo del Plástico:** Efecto de "vidrio esmerilado" (glassmorphism), chip de tarjeta en dorado/plata y el logo de la red (`Visa` / `Mastercard` / `Amex`) abajo a la derecha.
*   **Indicador de Límite (Barra de Progreso):** Una barra visual de progreso muy sutil y delgada que muestra qué porcentaje del límite de crédito ha sido consumido. Si supera el 80%, la barra cambia a color de advertencia (ámbar/rojo).
*   **Modo Moneda Dual:** Si tiene saldo en pesos y dólares, la tarjeta muestra ambos balances de forma paralela en tipografía monoespaciada limpia:
    ```text
    ARS: $145.200,00 
    USD: u$s 350,00
    ```

---

### D. Directrices de Rendimiento y Optimización de Vercel (UI & Fetch)
*   **Paralelización de Carga (`async-parallel`):** Al cargar el listado de tarjetas y las cuentas vinculadas asociadas en un Server Component, utilizar `Promise.all` para cargarlas en paralelo de base de datos en lugar de esperar la resolución de cada tarjeta en bucle.
*   **Renderizado Condicional Seguro (`rendering-conditional-render`):**
    *   *Incorrecto:* `{card.monthlyMaintenanceFee && <FeeBadge />}` (si es `0`, dibuja `0` en la pantalla).
    *   *Correcto:* `{card.monthlyMaintenanceFee > 0 ? <FeeBadge /> : null}` o `{!!card.monthlyMaintenanceFee && <FeeBadge />}`.
*   **Tree Shaking de Esquemas (`bundle-barrel-imports`):** El componente de tarjetas debe importar la tabla `cards` directamente desde `@/features/cards/schema.db`, no del barrel central de base de datos.



