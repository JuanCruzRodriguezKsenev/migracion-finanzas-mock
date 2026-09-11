# RFC 007: Gestión Avanzada de Tarjetas de Crédito, Ciclos e Intereses

*   **ID de la Propuesta:** 007
*   **Título:** Modelado Avanzado de Tarjetas, Ciclos de Cierre/Vencimiento, Intereses y Cumplimiento de Seguridad
*   **Estado:** `APPROVED` (2026-06-23, y de nuevo el 2026-09-08 sobre el texto enmendado)
*   **Fecha de Creación:** 2026-06-22
*   **Fecha de Enmienda:** 2026-09-08
*   **Fecha de Aprobación de la Enmienda:** 2026-09-08 — aprobada por el usuario. Habilita código
    contra §2, §7A y §7B en su redacción enmendada.
*   **Autor:** Antigravity (AI Coding Assistant)

> [!IMPORTANT]
> **Enmienda de Contraste (2026-09-08) — aprobada por el usuario.**
> Este RFC se redactó el 2026-06-22, **antes del core contable de partida doble**. Al contrastarlo
> archivo por archivo contra el esquema real, **cuatro de sus puntos describían un sistema que no es
> el que existe**, y uno de ellos —el saldo dual del §7B— era directamente irrealizable con el motor
> actual. El detalle del contraste está en la Sección 0.
>
> **El texto vigente es el enmendado.** §2, §7A y §7B se leen en su redacción de esta enmienda; las
> versiones de junio quedan sólo como registro de la decisión y **no se copian**. El resto del RFC
> —§3 seguridad, §4 ciclos, §5 intereses, §6 comisiones y §8 interfaz— se sostiene sin cambios desde
> su aprobación original.

---

## 0. Contraste contra el esquema real (2026-09-08)

Verificado archivo por archivo y contra la base de desarrollo. Lo que este RFC daba por cierto y no lo es:

| Lo que el RFC asumía | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| `accounts` se importa de `../../features/accounts/schema.db` | `accounts` vive en [`src/features/accounting/schema.db.ts`](../../src/features/accounting/schema.db.ts). **La carpeta `features/accounts/` no existe** | Ruta de import inválida. Se corrige en §2 |
| `creditLimit`, `monthlyMaintenanceFee` y `annualRenewalFee` en `integer` | El **RFC 019** migró toda columna monetaria a `bigint` en modo `number` (migración `0018`) | Tres columnas nacerían violando el cimiento de la Fase 0. Se corrigen en §2 |
| §7A propone **añadir** la columna `currency` a `ledger_entries` | **Ya existe** (`varchar(10)`, default `'ARS'`), desde el soporte multimoneda. El snippet del RFC la declara además `bigint` en `mode: "bigint"`, cuando el repositorio usa `mode: "number"` en todas | §7A ya está construida. Su snippet, si alguien lo copia, rompe el modo. Se marca implementada |
| §7B obtiene el saldo dual con `SUM(debit-credit) … GROUP BY currency` sobre **un** `cardAccountId` | [`accountingService.ts`](../../src/features/accounting/services/accountingService.ts) impone que **la moneda de un asiento la manda su cuenta**, y rechaza con excepción cualquier asiento en otra divisa | Ese `GROUP BY` **sólo puede devolver una fila**. El saldo dual con una sola cuenta es imposible. §7B se reescribe |

### La restricción que decide el diseño

El motor no permite que una cuenta acumule dos monedas. La regla está en `createLedgerTransaction`:

```typescript
const monedaAsiento = ( entry.currency || account.currency ) ;

if( monedaAsiento !== account.currency ){
  throw new Error( `La cuenta ${account.name} opera en ${account.currency} y el asiento vino en ${monedaAsiento}. Para mover valor entre monedas usá una transacción de cambio.` ) ;
}
```

Es la misma razón por la que el cambio de divisas se registra contra cuentas de posición
`3.3.01-<MONEDA>` y las contrapartidas de gasto se crean por divisa (`5.1.01.99-<MONEDA>`): **cada
moneda es un libro propio y cierra por separado.**

Por lo tanto, una tarjeta con saldo en pesos y en dólares —el caso argentino que este RFC describe
correctamente en §7— **no es una cuenta: son dos**, una por divisa, colgando de la misma tarjeta.

### Lo que sí se sostiene sin cambios

*   **§3 — Seguridad y PCI-DSS.** Prohibir el PAN y el CVV sigue vigente palabra por palabra. La enmienda sólo agrega **cómo se hace cumplir**: validación Zod en modo `.strict()`, que rechaza el payload en vez de descartar la clave en silencio.
*   **§4 — Lógica de ciclos.** El algoritmo de partición por fecha de cierre es correcto. La enmienda le agrega las condiciones de borde que el texto original no nombra: día de cierre mayor que los días del mes, años bisiestos, `dueDay < closingDay`, y la zona horaria del usuario.
*   **§5 y §6 — Intereses y comisiones.** El modelo de cálculo y los asientos son correctos. Requieren devengamiento periódico, que depende de los crons de la Fase 3.
*   **§8 — Interfaz.** La lógica de débito espejo, las capas de saldo de la tarjeta de crédito y las directrices de rendimiento se sostienen enteras.

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

> **Reescrito en la enmienda aprobada del 2026-09-08.** La versión anterior importaba
> `accounts` de una carpeta que no existe y declaraba tres columnas monetarias en `integer`, contra el
> `bigint` que impuso el RFC 019. Además modelaba **una sola cuenta por tarjeta**, lo que hace
> irrealizable el saldo dual de §7. El texto original queda reemplazado por lo que sigue.

Las tarjetas se separan de las cuentas genéricas para dotarlas de atributos financieros específicos.
Son **dos tablas**: el plástico y sus atributos por un lado, y el vínculo con el libro mayor por otro:

```typescript
import { pgTable , uuid , varchar , integer , bigint , timestamp , index , uniqueIndex } from "drizzle-orm/pg-core" ;

import { accounts , financialEntities } from "@/features/accounting/schema.db" ;
import { organizations }                from "@/features/auth/schema.db" ;

export const cards = pgTable( "cards" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  // Entidad emisora: de acá salen el logotipo y el color de marca de §8C, vía brand_domain.
  entityId:        uuid( "entity_id"         ).references( () => financialEntities.id , {onDelete: "restrict"} ) ,
  // Débito: la cuenta que la tarjeta espeja. Crédito: la cuenta de la que se paga el resumen.
  linkedAccountId: uuid( "linked_account_id" ).references( () => accounts.id , {onDelete: "set null"} ) ,

  label:   varchar( "label"   , {length: 100} ).notNull() , // Ej: "Visa Black Galicia"
  type:    varchar( "type"    , {length: 20 } ).notNull() , // 'credit' | 'debit'
  network: varchar( "network" , {length: 20 } ).notNull() , // 'visa' | 'mastercard' | 'amex' | 'other'

  // Seguridad (§3). No hay columna para el PAN ni para el CVV, y no la va a haber.
  lastFour:    varchar( "last_four" , {length: 4} ).notNull() ,
  expiryMonth: integer( "expiry_month" ).notNull() , // 1-12
  expiryYear:  integer( "expiry_year"  ).notNull() , // Ej: 2029

  // --- CAMPOS EXCLUSIVOS DE TARJETA DE CRÉDITO (todos anulables) ---
  creditLimit: bigint( "credit_limit" , {mode: "number"} ) , // Centavos. bigint por RFC 019

  closingDay: integer( "closing_day" ) , // Día del mes en que cierra (ej: 25)
  dueDay:     integer( "due_day"     ) , // Día del mes en que vence el pago (ej: 5)

  // Tasas: puntos básicos x100 (85,5% TNA = 8550). NO son dinero: integer, igual que year y month.
  interestRateFinancing: integer( "interest_rate_financing" ) ,
  interestRatePenalty:   integer( "interest_rate_penalty"   ) ,

  // Costos fijos, en centavos.
  monthlyMaintenanceFee: bigint( "monthly_maintenance_fee" , {mode: "number"} ).default( 0 ).notNull() ,
  annualRenewalFee:      bigint( "annual_renewal_fee"      , {mode: "number"} ).default( 0 ).notNull() ,

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica, como contacts
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgLabelIdx: index( "cards_org_label_idx" ).on( table.organizationId , table.label ) ,
} ) ; } ) ;

/**
 * Vínculo entre una tarjeta y sus cuentas del libro mayor: una fila por divisa.
 * Es lo que hace posible el saldo dual de §7 sobre un motor donde cada cuenta tiene una sola moneda.
 */
export const cardAccounts = pgTable( "card_accounts" , {
  id:        uuid( "id"         ).primaryKey().defaultRandom() ,
  cardId:    uuid( "card_id"    ).references( () => cards.id    , {onDelete: "cascade"}  ).notNull() ,
  accountId: uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,
  currency:  varchar( "currency" , {length: 10} ).notNull() ,
  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueCardCurrency: uniqueIndex( "card_accounts_card_currency_unique" ).on( table.cardId , table.currency ) ,
} ) ; } ) ;
```

### Notas de diseño de la enmienda

*   **Por qué la tabla intermedia y no una columna `card_id` en `accounts`.** `cards` ya referencia a `accounts` por `linkedAccountId`; la columna inversa cerraría un ciclo de imports entre los dos `schema.db.ts`. Con `card_accounts` la dependencia va en un solo sentido —`cards` → `accounting`—, que es la misma dirección de `contact_payment_methods` → `financial_entities`. El índice único sobre `(card_id, currency)` es lo que impide dos cuentas en pesos para la misma tarjeta.
*   **`isActive` se reemplaza por `archivedAt`.** Es la convención de baja lógica que ya usa `contacts`, y conserva *cuándo* se dio de baja en vez de sólo *que* se dio.
*   **La deuda de una tarjeta es su saldo negado.** En el motor, un `liability` aumenta con el débito y disminuye con el crédito; un consumo **acredita** la tarjeta, así que su `balance` queda **negativo**. Toda lectura de deuda pasa por una única función de conversión; repartir el cambio de signo por los componentes es cómo se termina mostrando una deuda en negativo y un disponible mayor que el límite.

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

> **Ya implementada (enmienda del 2026-09-08).** La columna `currency` **existe desde el soporte
> multimoneda del core contable**, como `varchar( "currency" , {length: 10} ).default( "ARS" ).notNull()`.
> El snippet de abajo se conserva como registro de la decisión, pero **no se copia**: declara los
> montos en `mode: "bigint"` cuando todo el repositorio usa `mode: "number"`, y el tipo real de
> `currency` es `varchar(10)`, no `text`.

La decisión, que se sostiene: en lugar de añadir columnas rígidas como `balance_ars` y `balance_usd` a la tabla de tarjetas, el soporte multimoneda vive a nivel de la tabla `ledger_entries` (Apuntes contables), con una columna `currency` en cada apunte:
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

> **Reescrito en la enmienda aprobada del 2026-09-08.** La consulta original agrupa
> por divisa los apuntes de **una** cuenta. Sobre el motor real esa consulta **sólo puede devolver una
> fila**: `createLedgerTransaction` rechaza con excepción todo asiento cuya moneda no sea la de su
> cuenta, así que los apuntes de una cuenta son siempre de una única divisa. El `GROUP BY` no está
> mal escrito: está apoyado sobre un supuesto que el core contable no admite.

Una tarjeta con saldo dual **tiene una cuenta de pasivo por divisa**, vinculadas por `card_accounts`.
El saldo dual se obtiene recorriendo las cuentas de la tarjeta, no agrupando los apuntes de una sola:

```typescript
// Saldo por divisa de una tarjeta: una fila por cuenta vinculada.
const saldos = await db
  .select( {
    currency: cardAccounts.currency ,
    balance:  accounts.balance ,      // Negativo en un pasivo: la deuda es -balance
  } )
  .from( cardAccounts )
  .innerJoin( accounts , eq( accounts.id , cardAccounts.accountId ) )
  .where( and(
    eq( cardAccounts.cardId       , cardId         ) ,
    eq( accounts.organizationId   , organizationId ) , // Aislamiento multi-tenant, siempre
  ) ) ;

// [ { currency: 'ARS', balance: -5500000 }, { currency: 'USD', balance: -12050 } ]
// Es decir: $55.000,00 ARS y u$s 120,50 de deuda.
```

`accounts.balance` es el saldo acumulado que el motor mantiene dentro de la misma transacción ACID
que inserta los asientos, así que no hace falta sumar apuntes para conocerlo. **Sumar apuntes sí hace
falta para el ciclo** —separar lo facturado de lo que está en curso—, porque eso no es un saldo sino
una partición por fecha; esa consulta filtra por `ledger_transactions.occurred_at`, no por
`ledger_entries.created_at`, y excluye las transacciones reversadas.
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
    *   *Cuotas Futuras Pendientes:* Saldo total remanente de compras en cuotas que aún no se han facturado, pero que restan del límite disponible (ej: si compraste en 10 cuotas, las 9 restantes).
3.  **Disponible para Compras:** El límite que le queda al usuario para seguir gastando:
    $$\text{Disponible} = \text{Límite} - (\text{Saldo Facturado} + \text{Saldo en Curso} + \text{Cuotas Futuras})$$

> [!WARNING]
> **Esta fórmula está corregida por el [RFC 025](025-card-installment-plans.md) §6 (2026-09-11).**
> `Saldo Facturado` y `Saldo en Curso` son los asientos de un rango de fechas del ciclo vigente
> ([`cardCycleService.ts`](../../src/features/cards/services/cardCycleService.ts)), así que el saldo
> impago de ciclos anteriores no cae en ninguno de los dos y la resta deja deuda afuera: **la fórmula
> sobrestima el disponible.** El cálculo vigente es `Límite − Deuda total − Cuotas futuras`, donde la
> deuda total sale de `deudaDe()` sobre las cuentas de la tarjeta. **El código ya lo hacía así**
> ([`CardVisual.tsx:40`](../../src/features/cards/components/CardVisual.tsx)); lo que le faltaba era
> el término de cuotas futuras.
>
> **La tabla que este párrafo llamaba `installmentPlans` no existía al escribirse.** La modela el
> RFC 025 como `card_installment_plans`, y allí se define también cómo se cuentan las cuotas no
> imputadas: proyección con `ocurrenciaN()` contra el puntero `resolved_through`, sin columna
> contadora.

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



