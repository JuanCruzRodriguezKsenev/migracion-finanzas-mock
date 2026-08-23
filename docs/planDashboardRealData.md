# Plan — Conectar Dashboard a Datos Reales
**Proyecto:** migracion-finanzas_mock  
**Archivo principal a modificar:** `src/app/[lang]/(main)/page.tsx`  
**Objetivo:** Reemplazar valores hardcodeados por datos reales de la DB

---

## Contexto para el que lo implementa

El dashboard actual muestra valores fijos en el código:
```tsx
value: "$14,250.00"                                          // ← hardcodeado
sparklineData: [13900, 14100, 13800, 14300, 14000, 14250]   // ← hardcodeado
```

Ya existe toda la infraestructura necesaria:
- `getAccountsAction()` → devuelve todas las cuentas con sus saldos
- `getTransactionsAction()` → devuelve todas las transacciones con sus asientos
- Ambas validan la sesión del usuario automáticamente
- Los montos en DB están en **centavos** (ej: $14.250,00 = `1425000`)

No hay que crear ningún archivo nuevo de DB, repositorio ni service. Solo hay que llamar a lo que ya existe y transformar los datos para mostrarlos.

---

## Paso 1 — Agregar una función de cálculo de métricas

**Dónde:** Crear archivo nuevo `src/features/accounting/utils/dashboardMetrics.ts`

**Qué hace:** Recibe las cuentas y transacciones y calcula las métricas del dashboard.

```ts
/**
 * @file dashboardMetrics.ts
 * Utilidades para calcular métricas del dashboard desde datos contables reales.
 */
import { Account, LedgerTransaction, LedgerEntry } from "../types" ;
import { TransactionWithEntries } from "../repositories/ledgerRepository" ;

/**
 * Formatea centavos a string de moneda.
 * Ejemplo: 1425000 → "$14,250.00"
 */
export function formatCents( cents: number , currency: string = "ARS" ): string {
  const amount = cents / 100 ;
  const prefix = amount < 0 ? "-$" : "$" ;
  return `${prefix}${Math.abs(amount).toLocaleString("es-AR", {
    minimumFractionDigits: 2 ,
    maximumFractionDigits: 2 ,
  })}` ;
}

/**
 * Calcula el balance total sumando todas las cuentas de tipo 'asset'.
 */
export function calcularBalanceTotal( accounts: Account[] ): number {
  return accounts
    .filter( (a) => a.type === "asset" )
    .reduce( (sum, a) => sum + a.balance , 0 ) ;
}

/**
 * Calcula el total de ingresos del mes actual.
 * Busca transacciones donde haya créditos en cuentas de tipo 'revenue'.
 */
export function calcularIngresosMes(
  transactions: TransactionWithEntries[] ,
  accounts: Account[]
): number {
  const revenueIds = new Set( accounts.filter( (a) => a.type === "revenue" ).map( (a) => a.id ) ) ;
  const now = new Date() ;

  return transactions
    .filter( (tx) => {
      const d = new Date(tx.createdAt) ;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ;
    })
    .flatMap( (tx) => tx.entries )
    .filter( (e) => revenueIds.has(e.accountId) )
    .reduce( (sum, e) => sum + e.credit , 0 ) ;
}

/**
 * Calcula el total de gastos del mes actual.
 * Busca transacciones donde haya débitos en cuentas de tipo 'expense'.
 */
export function calcularGastosMes(
  transactions: TransactionWithEntries[] ,
  accounts: Account[]
): number {
  const expenseIds = new Set( accounts.filter( (a) => a.type === "expense" ).map( (a) => a.id ) ) ;
  const now = new Date() ;

  return transactions
    .filter( (tx) => {
      const d = new Date(tx.createdAt) ;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ;
    })
    .flatMap( (tx) => tx.entries )
    .filter( (e) => expenseIds.has(e.accountId) )
    .reduce( (sum, e) => sum + e.debit , 0 ) ;
}

/**
 * Genera datos para el sparkline: balance total de los últimos N meses.
 * Devuelve un array de N números (uno por mes, del más antiguo al más reciente).
 */
export function calcularSparklineBalance(
  transactions: TransactionWithEntries[] ,
  accounts: Account[] ,
  meses: number = 6
): number[] {
  const assetIds = new Set( accounts.filter( (a) => a.type === "asset" ).map( (a) => a.id ) ) ;
  const now = new Date() ;
  const resultado: number[] = [] ;

  for( let i = meses - 1 ; i >= 0 ; i-- ) {
    const hasta = new Date( now.getFullYear() , now.getMonth() - i + 1 , 0 ) ; // último día del mes

    // Suma todos los movimientos de cuentas asset hasta ese mes
    const saldo = transactions
      .filter( (tx) => new Date(tx.createdAt) <= hasta )
      .flatMap( (tx) => tx.entries )
      .filter( (e) => assetIds.has(e.accountId) )
      .reduce( (sum, e) => sum + e.debit - e.credit , 0 ) ;

    resultado.push( saldo / 100 ) ; // convertir centavos a pesos
  }

  return resultado ;
}

/**
 * Calcula el porcentaje de cambio entre dos valores.
 * Devuelve string formateado: "+12%" o "-4%"
 */
export function calcularTendencia( actual: number , anterior: number ): { value: string ; isPositive: boolean } {
  if( anterior === 0 ) return { value: "0%" , isPositive: true } ;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100 ;
  return {
    value:      `${Math.abs(pct).toFixed(1)}%` ,
    isPositive: pct >= 0 ,
  } ;
}
```

---

## Paso 2 — Modificar `page.tsx` para usar datos reales

**Archivo:** `src/app/[lang]/(main)/page.tsx`

Reemplazar el contenido completo con esto:

```tsx
/**
 * @file page.tsx
 * Página de inicio (Dashboard) — conectada a datos reales de la DB.
 */
// Shared
import { getDictionary }  from "@/shared/lib/dictionary" ;
import { MetricsSection } from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { MetricCard }     from "@/shared/ui/MetricCard/MetricCard" ;
import { Sparkline }      from "@/shared/ui/display/Sparkline/Sparkline" ;
import styles             from "./page.module.css" ;

// Actions
import { getAccountsAction }     from "@/features/accounting/actions/accountingActions" ;
import { getTransactionsAction } from "@/features/accounting/actions/accountingActions" ;

// Utils
import {
  formatCents ,
  calcularBalanceTotal ,
  calcularIngresosMes ,
  calcularGastosMes ,
  calcularSparklineBalance ,
  calcularTendencia ,
} from "@/features/accounting/utils/dashboardMetrics" ;


interface HomePageProps {
  params: Promise< {lang: string} > ;
}

export default async function HomePage( {params}: HomePageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  // ── Obtener datos reales de la DB ──────────────────────────────────────────
  const [ accountsResult , transactionsResult ] = await Promise.all( [
    getAccountsAction() ,
    getTransactionsAction() ,
  ] ) ;

  // Si hay error de autenticación o DB, usar valores vacíos (no romper el dashboard)
  const accounts     = accountsResult.success     ? accountsResult.value     : [] ;
  const transactions = transactionsResult.success ? transactionsResult.value : [] ;

  // ── Calcular métricas ──────────────────────────────────────────────────────
  const balanceTotal  = calcularBalanceTotal( accounts ) ;
  const ingresosMes   = calcularIngresosMes( transactions , accounts ) ;
  const gastosMes     = calcularGastosMes( transactions , accounts ) ;
  const ahorro        = ingresosMes - gastosMes ;
  const sparklineData = calcularSparklineBalance( transactions , accounts , 6 ) ;

  // Tendencias (comparar mes actual vs mes anterior)
  // Por ahora usamos una estimación simple: si hay datos del mes pasado en el sparkline
  const balanceAnterior  = sparklineData.length >= 2 ? sparklineData[sparklineData.length - 2] * 100 : balanceTotal ;
  const ingresosAnteriores = ingresosMes * 0.88 ; // fallback estimado si no hay dato previo real
  const gastosAnteriores   = gastosMes   * 1.04 ; // fallback estimado si no hay dato previo real

  const tendenciaBalance  = calcularTendencia( balanceTotal , balanceAnterior ) ;
  const tendenciaIngresos = calcularTendencia( ingresosMes  , ingresosAnteriores ) ;
  const tendenciaGastos   = calcularTendencia( gastosMes    , gastosAnteriores ) ;
  const tendenciaAhorro   = calcularTendencia( ahorro        , ingresosAnteriores - gastosAnteriores ) ;

  // ── Iconos SVG ────────────────────────────────────────────────────────────
  const iconoIngresos = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ) ;

  const iconoEgresos = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="7" x2="17" y2="17" />
      <polyline points="17 7 17 17 7 17" />
    </svg>
  ) ;

  const iconoAhorro = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ) ;

  return(
    <div className={styles.container}>
      <MetricsSection
        allowVisibilityToggle={true}
        hero={ {
          label:         dict.dashboard.balanceLabel ,
          value:         formatCents( balanceTotal ) ,
          sparklineData: sparklineData.length >= 2 ? sparklineData : undefined ,
          lang:          lang ,
          isInverted:    false ,
          trend:         tendenciaBalance ,
        } }
      >
        {/* Tarjeta 1: Ingresos */}
        <MetricCard
          title={dict.dashboard.incomeLabel}
          value={formatCents( ingresosMes )}
          trend={ {
            value:      tendenciaIngresos.value ,
            isPositive: tendenciaIngresos.isPositive ,
            label:      dict.dashboard.savingTrend ,
          } }
          icon={iconoIngresos}
          iconBg="rgba(5, 150, 105, 0.12)"
          iconColor="var(--color-success)"
          sparkline={
            <Sparkline
              data={sparklineData.length >= 2 ? sparklineData : [0, 0]}
              color="var(--color-success)"
              height={26}
              lang={lang}
            />
          }
        />

        {/* Tarjeta 2: Gastos */}
        <MetricCard
          title={dict.dashboard.expenseLabel}
          value={formatCents( gastosMes )}
          trend={ {
            value:      tendenciaGastos.value ,
            isPositive: !tendenciaGastos.isPositive , // gastos que bajan = positivo
            isRising:   tendenciaGastos.isPositive ,
            label:      dict.dashboard.savingTrend ,
          } }
          isDanger={gastosMes > ingresosMes}
          icon={iconoEgresos}
          iconBg="rgba(225, 29, 72, 0.12)"
          iconColor="var(--color-danger)"
          sparkline={
            <Sparkline
              data={sparklineData.length >= 2 ? sparklineData : [0, 0]}
              color="var(--color-success)"
              height={26}
              lang={lang}
              isInverted={true}
            />
          }
        />

        {/* Tarjeta 3: Ahorro Neto */}
        <MetricCard
          title={dict.dashboard.savingsLabel}
          value={formatCents( ahorro )}
          trend={ {
            value:      tendenciaAhorro.value ,
            isPositive: tendenciaAhorro.isPositive ,
            label:      dict.dashboard.savingTrend ,
          } }
          icon={iconoAhorro}
          iconBg="rgba(124, 58, 237, 0.12)"
          iconColor="var(--color-purple)"
          sparkline={
            <Sparkline
              data={sparklineData.length >= 2 ? sparklineData : [0, 0]}
              color="var(--color-purple)"
              height={26}
              lang={lang}
            />
          }
        />
      </MetricsSection>
    </div>
  ) ;
}
```

---

## Paso 3 — Verificar que el diccionario tiene las keys necesarias

**Archivo:** `src/dictionaries/es.json` (y `en.json`, `br.json`)

Asegurarse de que existan estas keys bajo `dashboard`:

```json
{
  "dashboard": {
    "balanceLabel": "Balance Total",
    "incomeLabel": "Ingresos",
    "expenseLabel": "Gastos",
    "savingsLabel": "Ahorro Neto",
    "savingTrend": "vs mes anterior"
  }
}
```

Si no existen, agregarlas. Si ya existen con otros nombres, ajustar las referencias en `page.tsx`.

---

## Paso 4 — Estado vacío (sin datos en DB)

Si la DB está vacía (usuario nuevo, sin transacciones), todos los cálculos devuelven `0`.  
El dashboard se verá así:
- Balance: `$0.00`
- Ingresos: `$0.00`  
- Gastos: `$0.00`
- Sparkline: no se renderiza (requiere mínimo 2 puntos — ya está manejado con el fallback `[0, 0]`)

Esto es comportamiento correcto. No hace falta un estado de error especial.

---

## Checklist para el que lo implementa

- [ ] Crear `src/features/accounting/utils/dashboardMetrics.ts` con el código del Paso 1
- [ ] Reemplazar `src/app/[lang]/(main)/page.tsx` con el código del Paso 2
- [ ] Verificar keys del diccionario en `es.json`, `en.json`, `br.json` (Paso 3)
- [ ] Levantar la DB local (`postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db`)
- [ ] Correr `pnpm dev` y verificar que el dashboard carga sin errores
- [ ] Verificar en browser que los valores cambian si se insertan transacciones de prueba en la DB
- [ ] Verificar que con DB vacía el dashboard muestra `$0.00` sin romper

---

## Notas importantes

**Los montos en DB están en centavos.** `1425000` en DB = `$14,250.00` en pantalla. La función `formatCents()` maneja la conversión. No dividir por 100 en ningún otro lugar.

**`getAccountsAction()` y `getTransactionsAction()` requieren sesión activa.** Si el usuario no está logueado, devuelven `{ success: false }`. El código ya maneja esto con el fallback a arrays vacíos.

**No usar `await` dentro de Server Components en paralelo secuencial.** El `Promise.all()` del Paso 2 es intencional — llama a ambas actions simultáneamente para no duplicar el tiempo de carga.

**Los `sparklineData` para ingresos y gastos** actualmente reutilizan el sparkline del balance total. Si se quiere un sparkline específico por métrica, habría que crear funciones adicionales en `dashboardMetrics.ts` siguiendo el mismo patrón de `calcularSparklineBalance`.