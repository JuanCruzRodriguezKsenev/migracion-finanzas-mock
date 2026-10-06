# RFC 027: Página de estadísticas (`/reports`)

*   **ID de la Propuesta:** 027
*   **Título:** Estadísticas del libro: flujos, categorías, tendencia y Patrimonio Neto, por divisa
*   **Estado:** `APPROVED` (2026-10-06 — aprobado por el usuario, firmado por Claude a su pedido expreso. Habilita código contra este texto)
*   **Fecha de Creación:** 2026-10-06
*   **Autor:** `tanda`
*   **Spec que implementa:** `~/Boveda/Proyectos/migracion-finanzas-mock/Specs/Estadísticas/Spec - Estadísticas.md` (aprobada) — este RFC es el *cómo*; la spec es el *qué*
*   **Depende de:** RFC 022 (clasificación, `APPROVED`), RFC 024 (instrumentos, `APPROVED`), RFC 025 (cuotas de tarjeta, `APPROVED`)
*   **Cierra, del RFC 024 §9:** la convención de signo de `monthly_summaries` y el nombre de la ruta

---

## 0. Contraste contra el código real (2026-10-06)

Verificado antes de escribir una consulta.

| Lo que se suponía | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| Los flujos del dashboard son confiables | `calcularIngresosMes` y `calcularGastosMes` (`dashboardMetrics.ts:50` y `:72`) traen **todas** las transacciones a memoria y suman sólo el **crédito** de las cuentas `revenue` y el **débito** de las `expense`. Un asiento reversado deja su contra-asiento en el lado que se ignora: **lo reversado sigue contando** | Estadísticas **no reutiliza** esas funciones. El defecto se corrige aparte (plan `estadisticas-1`) |
| `monthly_summaries` sirve de fuente histórica | **No tiene columna de divisa** (`accounting/schema.db.ts:146-160`: `year`, `month` y cinco `bigint`) y `derivarResumenDeMes` suma todas las cuentas sin mirar la moneda (`monthlySummaryService.ts:43-44`) | **Estadísticas no la lee.** Con cuentas en pesos y en dólares la tabla mezcla magnitudes, aun para la divisa principal |
| Para filtrar por divisa hace falta unir con `accounts` | `ledger_entries` **ya lleva `currency`** (`schema.db.ts:113`) | La divisa se filtra en la propia línea del asiento |
| La jerarquía de categorías es profunda | Son **dos niveles** (padre → hoja), con una hoja `General` por padre y una hoja `General` de tipo para lo sin categoría, ambas con `is_system_leaf` (`categoryRepository.ts:122`, `:166`, `:208`) | El desglose es padre → hoja, sin recursión |
| Hay un servicio de cuotas futuras | **Sí:** `cuotasFuturasPorDivisa( planes )` (`installmentService.ts:130`) es puro, y `installmentPlansRepository.findActiveByOrganization( orgId )` (`:111`) trae los planes. Es lo que ya usa `cardCycleService.ts:58` | El Patrimonio Neto resta **exactamente** lo que la tarjeta ya resta: un solo cálculo |
| El Patrimonio Neto de `/accounts` es el patrimonio de la organización | `AccountsContainer.tsx:97-99`: `netWorth = totalAssets + totalLiabs`, con el signo del motor (`patterns.md` §8) — **pero** sobre `walletAccounts`, que **excluye las cuentas de tarjetas y de préstamos** (`:86-93`), y **suma todas las divisas** en un número | El **signo** es correcto; el **alcance** no. Estadísticas calcula el neto sobre **todas** las cuentas `asset` y `liability` de la divisa elegida, tarjetas y préstamos incluidos (son cuentas de pasivo). **El número va a ser distinto del que `/accounts` mostraba**, y es lo correcto |
| Hay gráficos reutilizables | Sólo `RechartsSparkline/Sparkline.tsx`. **No hay donut ni gráfico de barras o líneas de varias series** | Hay que construirlos en `shared/ui/` |
| `profiles.timezone` se usa | Existe (`profile/schema.db.ts`) y `profileRepository.findByUserId` lo devuelve, pero **ningún código de producción lo consume** (`~/Boveda/Proyectos/migracion-finanzas-mock/Deuda.md` §3) | Estadísticas es el **primer consumidor** de la zona horaria y de `currency` |
| El dashboard delimita los meses como el usuario | Usa `new Date( año , mes , 1 )` en la zona del **servidor** (`monthlySummaryService.ts:37-38`) | En un servidor en UTC, un gasto de las 22:00 del 31 en Buenos Aires cae en el mes siguiente. Defecto **vivo**, no lo arregla este RFC (§10) |

---

## 1. Contexto y objetivos

La spec define el comportamiento. Este RFC fija cuatro cosas que la spec deja abiertas a propósito:
**de dónde salen los números** (§2), **cómo se delimita un mes** (§3), **qué consultas se hacen** (§4) y **qué piezas de interfaz se
construyen** (§6).

**No agrega tablas ni columnas.** Es una pantalla de sólo lectura.

---

## 2. La decisión que define este RFC: el libro en vivo, no los resúmenes

**Decisión:** todas las cifras salen de consultas agregadas sobre `ledger_entries`, en cada visita. **`monthly_summaries` no se toca.**

| Alternativa | Por qué se descarta |
| :--- | :--- |
| Leer `monthly_summaries` para los meses cerrados (lo que decía el supuesto 15 de la spec) | La tabla suma divisas. Es **incorrecta** para cualquier organización con cuentas en dos monedas |
| Agregar `currency` a `monthly_summaries` | Cambia la clave única `(organization_id, year, month)`, exige una migración con *backfill* y **no evita** calcular el mes en curso en vivo. Más superficie para el mismo resultado |
| Traer las transacciones y sumar en memoria, como el dashboard | Es el patrón que el §0 señala como defectuoso, y no escala |

**Costo aceptado:** tres consultas agregadas por visita (§4). Para el volumen de una casa —cientos de asientos por mes— es trivial; **no se midió** (§10). Si en producción pesara, se evalúa un resumen **con** divisa; no antes.

**Consecuencia buena:** un asiento reversado o cargado con fecha pasada se refleja **al instante** en todos los meses. No hay nada que quede viejo.

---

## 3. Cómo se delimita un mes

Los meses se delimitan en la **zona horaria del usuario**, `profiles.timezone` (IANA, por defecto `America/Argentina/Buenos_Aires`), y no en la del servidor.

En SQL, sobre `ledger_transactions.occurred_at` (`timestamptz`):

```sql
date_trunc( 'month' , lt.occurred_at AT TIME ZONE $zona )
```

El resultado es una fecha **sin zona** que ya es el mes calendario local; se compara con las claves `YYYY-MM` que arma el selector.
**No se usa `new Date( año , mes , 1 )` del servidor para esto.** Tampoco se usa `findEarliestMonthKey` para el límite del selector: **lee `monthly_summaries`**
(`monthlySummaryRepository.ts:142-159`), que no tiene el mes en curso ni divisa. `minKey` sale de la **Q5** (§4), sobre el libro y en la zona del usuario.

---

## 4. Las consultas

Todas filtran por `lt.organization_id = $org` y **excluyen el par reversado**:

```sql
lt.reversed_at IS NULL AND lt.reverses_transaction_id IS NULL
```

**Q1 — Flujos por mes (tendencia y métricas).** Una consulta, 13 meses hacia atrás desde el elegido (12 de tendencia + el anterior para la variación):
`GROUP BY` mes local; por mes: `SUM( CASE WHEN a.type = 'revenue' THEN le.credit ELSE 0 END )` = ingresos,
`SUM( CASE WHEN a.type = 'expense' THEN le.debit ELSE 0 END )` = gastos, y `COUNT( DISTINCT lt.id )` = transacciones. Filtra `le.currency = $divisa`.

**Q2 — Patrimonio según libro, mes a mes.** Una consulta, **sin piso**: por mes y tipo, `SUM( le.debit - le.credit )` de cuentas `asset` y `liability`
con `le.currency = $divisa`; el acumulado se arma en el servicio. **Aquí NO se excluye el par reversado**: los saldos incluyen el original y su reversa, que se anulan
(tabla de decisión de la spec, filas 2 y 3).

**Q3 — Categorías del mes.** Por hoja: suma de `debit` (gastos) o de `credit` (ingresos) del mes elegido, unida a `category_accounts` ⋈ `categories`
(`LEFT JOIN`: una cuenta de resultado sin categoría cae en «Sin categoría»). El servicio agrupa en padres con `parent_id`.

**Q4 — Top gastos.** Dos pasos: los 5 `lt.id` con mayor `SUM( le.debit )` sobre cuentas `expense` del mes; después, sus líneas de gasto con categoría
para elegir la del mayor importe (PA-4 de la spec).

**Patrimonio Neto de hoy:** `accounts.balance` por tipo (`asset`, `liability`) para la divisa, **más** `cuotasFuturasPorDivisa( planes )[ divisa ]` con
`planes = installmentPlansRepository.findActiveByOrganization( orgId )`. Neto = `activos + pasivos − cuotas`.

**Q5 — Primer mes con movimientos.** `MIN( lt.occurred_at )` de la organización (sin excluir nada: un mes con sólo asientos reversados igual es navegable), convertido a clave `YYYY-MM` en la zona del usuario. Es el `minKey` del `MonthSelector` (RN-23 de la spec).

**Divisas disponibles:** `SELECT DISTINCT currency FROM accounts WHERE organization_id = $org`.

---

## 5. El servicio y su contrato

`src/features/reports/` (feature nueva, según `ARCHITECTURE.md` §4): `repositories/reportsRepository.ts` (las cuatro consultas),
`services/reportsService.ts` (composición, variaciones, agrupación en padres, «Otras»), `actions/reportsActions.ts`.

Una **sola acción de lectura**, `getReportsAction( { monthKey , currency } )`, que devuelve `Result< ReportData , string >`:

```ts
interface ReportData {
  currency:   string ;
  monthKey:   string ;                            // "YYYY-MM"
  metrics:    { ingresos , gastos , ahorroNeto : MetricaConVariacion ; tasaAhorro : { value: number | null ; deltaPP: number | null } ; transacciones : number } ;
  tendencia:  { monthKey: string ; ingresos: number ; gastos: number ; ahorroNeto: number ; patrimonioLibro: number }[] ;   // 12 puntos
  categorias: { tipo: "expense" | "revenue" ; total: number ; padres: { id , nombre , color , total , hojas: { id , nombre , total }[] }[] }[] ;
  topGastos:  { id , descripcion , categoria , fecha , monto }[] ;
  patrimonio: { activos: number ; pasivos: number ; cuotasPorPagar: number ; neto: number } ;
  divisas:    string[] ;
  minKey:     string | undefined ;                // Q5; undefined si no hay asientos
  hayMovimientos: boolean ;
}
```
`MetricaConVariacion` es `{ value: number ; variacionPct: number | null }` (`null` = «—», nunca 0). Todo en **centavos enteros**; el formateo es de la interfaz (`formatCurrency`).

Es **lectura**: no escribe nada. En el plan de rol de sólo lectura (4b del acceso) se clasifica `"lectura"` en `actionPolicy`.

---

## 6. La interfaz

**Ruta:** `src/app/[lang]/(main)/reports/page.tsx`, Server Component fino como `settings/page.tsx`: carga el diccionario y los datos y delega en un contenedor cliente. El mes llega por `?month=YYYY-MM` y la divisa por `?currency=XXX`, para que el enlace sea compartible con el contador.

**Componentes nuevos:**

| Componente | Dónde | Qué hace |
| :--- | :--- | :--- |
| `StatsContainer` | `features/reports/components/` | Compone las secciones; recibe `ReportData` |
| `TrendChart` | `shared/ui/display/` | Líneas de ingresos, gastos (y ahorro) de 12 meses. Recharts |
| `DonutChart` | `shared/ui/display/` | Una porción por padre con «Otras»; tocar una la selecciona |
| `CategoryBreakdown` | `features/reports/components/` | Interruptor Gastos/Ingresos, el donut y el desglose por hoja |
| `TopExpensesList` | `features/reports/components/` | Cinco filas |
| `NetWorthCard` | `features/reports/components/` | Rótulo «a hoy» y desglose |
| `CurrencySelector` | `features/reports/components/` | Las divisas de `ReportData.divisas` |

**Se reutiliza, sin reescribir:** `PageHeader` con `showMonthSelector`, `MonthSelector` (`minKey`/`maxKey`), `MetricsSection` y `MetricCard`,
`MetricsVisibilityContext` (el ojito), `formatCurrency` (`shared/lib/currencyFormatter.ts:46`), `Sparkline` para la mini-tendencia de cada tarjeta.

**Accesibilidad (NFR-4 de la spec):** cada gráfico tiene una lista o tabla con los **mismos valores** visible para lector de pantalla, y `aria-label`. El donut no depende sólo del color: cada porción lleva su nombre y su porcentaje.

**Menú:** una entrada «Estadísticas» en el `Navbar` y el `BottomNav`, claves `sidebar.stats` en los tres diccionarios. **i18n:** sección `reportsPage` completa en `es`, `en` y `br`.

**Celular primero:** una sola columna, sin tablas anchas; los gráficos ocupan el ancho y se leen con la lista de abajo. **Sin movimiento ni cambio de dimensiones en `:hover`** (`.agents/AGENTS.md` §4).

---

## 7. El Patrimonio Neto se muda

En `AccountsContainer.tsx`, el Patrimonio Neto es el **hero** del `MetricsSection` (`:157-170`). Se quita el `hero` y la sección pasa a la variante **sin hero** de `MetricsSection` (rama `simpleGrid`,
`MetricsSection.tsx:118`), con **Total Activos y Total Pasivos** como las dos tarjetas. Se borran `netWorth` (`:99`), `sparklinePointsNetWorth` (`:102`), `tendenciaNetWorth` (`:118`)
y la clave `accountsPageDict.netWorth` **si ya nadie la usa** (verificar con `grep`). **Activos y Pasivos de `/accounts` siguen siendo sólo de billeteras**, como hoy: no cambian de alcance en esta tanda.
**La fórmula vive ahora en `reportsRepository`** (§4), con el comentario que remite a `patterns.md` §8 para que nadie la «arregle» al revés.

**Convención de signo (cierra el §9 del RFC 024):** `monthly_summaries.liabilitiesSnapshot` queda **negativa**, como `accounts.balance` y como `derivarResumenDeMes` ya la calcula (`monthlySummaryService.ts:62`). Se documenta en un párrafo nuevo de `patterns.md` §8. **El seed no se toca** (el plan `fix-resumenes-mensuales` ya lo alinea).

---

## 8. Verificación

La batería del repo (los cuatro, y `tsc --noEmit` como comando propio) más:
- Las pruebas de integración de las cuatro consultas contra la base real (§9).
- Un chequeo de **coincidencia con el dashboard**: con los mismos datos y servidor en la zona del usuario, el ahorro neto del mes en curso es el mismo número en ambas pantallas.
- El recorrido manual en el navegador: tres divisas de prueba, el ojito cerrado, el idioma inglés, un `viewer`, y un celular real.

---

## 9. Casos de prueba que este RFC exige

| Caso | Qué afirma |
| :--- | :--- |
| `un asiento reversado no cuenta` | Gasto y reversa en el mismo mes: gastos y conteo no lo ven (AC-2 de la spec) |
| `reversa en otro mes` | Gasto de marzo reversado en abril: ninguno de los dos meses lo cuenta; los **saldos** de marzo sí lo incluyen (AC-3, tabla de decisión) |
| `una divisa a la vez` | Gastos en ARS y en USD: cada selección suma sólo la suya (AC-7) |
| `zona horaria` | Un gasto a las 22:00 del 31 hora de Buenos Aires cae en ese mes aunque en UTC sea el siguiente (AC-17). Se fija la zona en el test, no el servidor |
| `tasa de ahorro sin ingresos` | `null`, no 0 (AC-5) |
| `variación sin base` | Mes anterior en cero: `null` (AC-6) |
| `padres, hojas y "Otras"` | Siete padres: seis y «Otras»; el desglose de uno suma al total del padre (AC-8) |
| `archivar no reescribe` | Una categoría archivada con gastos del mes sigue en el donut (AC-9) |
| `sin categoría` | Un gasto a una hoja `General` de tipo aparece como «Sin categoría» al nivel de los padres |
| `patrimonio neto` | Activos, pasivos negativos y cuotas futuras: el neto de la spec (AC-10), y coincide con lo que resta `CardVisual` |
| `aislamiento` | Dos organizaciones: ninguna ve datos de la otra (NFR-2) |
| `vacío` | Organización sin asientos: `hayMovimientos = false` y ninguna cifra inventada (AC-12) |
| `el top` | Cinco asientos, el reversado ausente, categoría del mayor importe |

---

## 10. Lo que este RFC deja abierto

*   **El mes del dashboard en UTC** (PA-5 de la spec). El dashboard y `derivarResumenDeMes` delimitan con la zona del servidor. **Hay que decidirlo antes del despliegue** (el plan 5 del acceso lo lista como medición M-4); no se arregla acá.
*   **El rendimiento de las tres consultas** no se midió. Se asume trivial para una casa.
*   **Cascada y «Resumen por cuenta»** del mock: fuera de alcance (PA-1 de la spec).
*   **`/accounts` sigue sumando divisas** en Total Activos y Total Pasivos (`:97-98`). Mismo defecto que `CardVisual`; no se arregla acá.
*   **Los totales de otra divisa en la misma pantalla:** no se muestran. Es decisión de producto (una divisa a la vez), no deuda.
