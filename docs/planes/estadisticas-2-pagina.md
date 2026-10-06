# Plan — Estadísticas 2/2: la página `/reports`

**Rama:** `feat/estadisticas-pagina` (sale de la punta de `fix/reversados-en-flujos`) · **Escrito:** 2026-10-06 · **Abre deuda nueva:** sí (paso 9)
**Spec:** [`../specs/estadisticas/spec.md`](../specs/estadisticas/spec.md) — implementa **RN-1 a RN-26** salvo RN-20 (plan 1); cubre **AC-1 a AC-17**.
**RFC:** [`../proposals/027-statistics-page.md`](../proposals/027-statistics-page.md) — **debe figurar `APPROVED` antes de escribir una línea de código.** Hoy está en `DRAFT`. Si al empezar sigue en `DRAFT`, **parar y avisarlo**: el repo exige código sólo contra un RFC aprobado.
**Serie:** 1 `estadisticas-1-lo-reversado-no-cuenta` → **2 este**.
**Precondiciones:** el plan 1 está ejecutado y verificado; el plan `fix-resumenes-mensuales` también. **No depende** de la serie de acceso; si el plan 4b del acceso ya está, la acción nueva se registra además en `actionPolicy` (§Paso 4).

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa |
| :--- | :--- | :--- |
| `PageHeader` (`shared/ui/layout/PageHeader`) | Compuesto por cada página. Con `showMonthSelector` pinta el `MonthSelector` y **escribe el mes en `?month=YYYY-MM`** (`PageHeader.tsx:67-73`) | La página lee `searchParams.month` y pasa `currentMonthKey` y `minKey`. **No se reescribe el selector** |
| `MonthSelector` (`shared/ui/display/MonthSelector`) | Props `minKey`, `maxKey`, `todayKey`; bloquea meses futuros y anteriores al mínimo | El `minKey` sale de la Q5 del RFC (§4), **no** de `findEarliestMonthKey` (que lee `monthly_summaries`) |
| `MetricsSection` y `MetricCard` (`shared/ui/layout/MetricsSection`, `shared/ui/MetricCard`) | Tarjetas con `title`, `value`, `trend { value , isPositive , isRising , label }`, `sparkline`, `isDanger`, `isSensitive`. Sin `hero`, `MetricsSection` pinta una grilla simple | Las cuatro métricas del período |
| `MetricsVisibilityContext` | El ojito: `isContentVisible`. `MetricCard` con `isSensitive` ya enmascara | Todo importe, incluido el donut y el top, respeta el ojito (RN-24) |
| `formatCurrency( amount , currencyCode , locale )` (`shared/lib/currencyFormatter.ts:46`) | **Recibe el monto en la sub-unidad entera** y resuelve los decimales por divisa | Único formateador a usar. **No** usar `formatCents` (el viejo, sin divisa; `TECHNICAL_DEBT.md` §1) |
| `Sparkline` (`shared/ui/display/RechartsSparkline`) con su test jsdom | El único gráfico Recharts del repo. `Sparkline.test.tsx` muestra cómo montarlo con `MetricsVisibilityContext` | Para la mini-tendencia de cada tarjeta, y **como patrón de prueba** de los gráficos nuevos |
| `profileRepository.findByUserId( userId )` | Devuelve el perfil con `timezone` y `currency` | **Primer consumidor de producción** de esos dos campos (RFC 027 §0) |
| `installmentPlansRepository.findActiveByOrganization( orgId )` y `cuotasFuturasPorDivisa( planes )` | Lo que `cardCycleService.ts:58` ya usa para el disponible | El Patrimonio Neto resta lo mismo que la tarjeta: **un solo cálculo** |
| `categoryRepository` y `category_accounts` | Jerarquía de dos niveles; hoja `General` por padre y de tipo, con `is_system_leaf` | Q3. **No** recorrer recursivamente |

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/reports/repositories/reportsRepository.ts` | **Nuevo.** Q1 a Q5 y el Patrimonio Neto de hoy (RFC 027 §4) |
| `src/features/reports/services/reportsService.ts` | **Nuevo.** Composición, variaciones, padres, «Otras» |
| `src/features/reports/actions/reportsActions.ts` | **Nuevo.** `getReportsAction` |
| `src/features/reports/types.ts` | **Nuevo.** `ReportData` y sus partes (RFC 027 §5) |
| `src/features/reports/components/` | **Nuevos:** `StatsContainer`, `CategoryBreakdown`, `TopExpensesList`, `NetWorthCard`, `CurrencySelector` (+ `.module.css`) |
| `src/shared/ui/display/TrendChart/` · `DonutChart/` | **Nuevos** (+ `.module.css` y tests) |
| `src/app/[lang]/(main)/reports/page.tsx` (+ `page.module.css`) | **Nueva ruta** |
| `src/shared/ui/layout/Navbar/Navbar.tsx` · `BottomNav/BottomNav.tsx` | Una entrada «Estadísticas» |
| `src/dictionaries/es.json` · `en.json` · `br.json` | `sidebar.stats` y la sección `reportsPage` |
| `src/features/accounting/components/AccountsContainer.tsx` | Se retira el Patrimonio Neto (RFC 027 §7) |
| `src/features/accounting/components/AccountsContainer.test.tsx` (si existe) y su `dict` de prueba | Se ajustan a la ausencia del hero |
| `docs/patterns.md` §8 | La convención de signo de `monthly_summaries.liabilitiesSnapshot` |
| `docs/TECHNICAL_DEBT.md` · `docs/trabajo-en-vuelo.md` | Estado, deuda cerrada y abierta |
| `src/shared/lib/actionPolicy.ts` | **Sólo si el plan 4b ya está:** la acción como `"lectura"` |

**Quién más lee lo que se toca.** `AccountsContainer`: `grep -rn "netWorth\|sparklinePointsNetWorth\|tendenciaNetWorth\|accountsPageDict.netWorth" src/`. La clave `netWorth` del diccionario
**se borra sólo si el barrido no encuentra otro consumidor**. Los demás archivos de la tabla son nuevos o sólo se les agrega.

---

## 2. Pasos

### Paso 1 — Tipos y repositorio

`types.ts` con `ReportData` exactamente como en el RFC 027 §5 (todo en **centavos enteros**; `null` para variaciones sin base).
`reportsRepository` con las consultas Q1 a Q5 **tal como las define el RFC 027 §4**, en Drizzle. Reglas que no se negocian:
- Toda consulta lleva `eq( ledgerTransactions.organizationId , orgId )`. **La zona horaria entra como parámetro** (`profiles.timezone`), no como constante:
  `date_trunc( 'month' , ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona} )` con `sql\`\``. Ver RFC 027 §3.
- Q1, Q3 y Q4 **excluyen el par reversado** (`reversed_at IS NULL AND reverses_transaction_id IS NULL`). **Q2 (saldos) y Q5 no** lo excluyen. El plan 1 explica la diferencia: es la tabla de decisión de la spec.
- Filtrar la divisa por `ledgerEntries.currency`, que existe (`accounting/schema.db.ts:113`), no por una unión con `accounts`.
- Las sumas de `bigint` vuelven como `string` desde `sql<string>` y se convierten con `Number(...)`, igual que `derivarResumenDeMes`. **Verificar que ningún total pase de `2^53`** (el repo ya lo asume con `mode: "number"`).
- **No** traer filas para sumarlas en JavaScript, salvo el agrupado final de hojas en padres (§Paso 2).

### Paso 2 — Servicio

`reportsService.armarReporte( { orgId , userId , monthKey , currency } )`:
1. Carga el perfil (`profileRepository.findByUserId`) para `timezone` y `currency`. **Si no hay perfil**, usa los defaults de las columnas (`America/Argentina/Buenos_Aires`, `ARS`): no falla. (Los usuarios creados por Google tienen su fila de `profiles` desde el plan 3 del acceso, pero la base actual puede no tenerla.)
2. **Divisa (RN-2):** la pedida, si está entre las de la organización; si no, la del perfil si la organización la tiene; si no, la de más movimientos.
3. Variación porcentual: `( actual − anterior ) / anterior` **sólo si `anterior > 0`**; si no, `null`. Tasa de ahorro: `null` si ingresos es 0; variación de la tasa en puntos porcentuales, `null` si el mes anterior no tuvo ingresos.
4. **Padres y hojas (RN-10, RN-11):** agrupar las filas de Q3 por `parent_id`. Una hoja con `is_system_leaf` que cuelga de un padre se muestra como «General» **dentro** de ese padre; la hoja `General` de tipo (sin padre) y las cuentas sin categoría suman a «Sin categoría» **al nivel de los padres**. Las categorías archivadas **cuentan** (RN-12): no filtrar por `archived_at`.
5. «Otras»: las 6 mayores por separado y el resto agrupado, ordenado de mayor a menor. Si hay **7 o menos** padres, no hay «Otras».
6. Tendencia: 12 puntos que terminan en el mes elegido, sin meses anteriores a `minKey`; el patrimonio de cada punto es el acumulado de Q2 (**«patrimonio según libro»**, RN-16).
7. Patrimonio Neto **de hoy**, aunque el mes elegido sea otro (RN-15): `activos + pasivos − cuotasPorPagar`, con `cuotasPorPagar = cuotasFuturasPorDivisa( planes )[ divisa ] ?? 0`. **Los pasivos ya están en negativo; se suman** (`patterns.md` §8). Comentario en el código que remita a ese párrafo.
8. `hayMovimientos`: falso si Q5 no devuelve nada.

### Paso 3 — Tests del repositorio y del servicio

Integración contra la base real (`limpiarBase()`, patrón de `monthlySummaryService.test.ts`). **Cada fila del §9 del RFC 027 es un test**, con datos creados por `createLedgerTransaction` y `reverseLedgerTransaction`
(**no** insertando asientos a mano, salvo el de zona horaria que necesita fijar `occurredAt`). En particular, los que protegen lo que este plan puede romper:
- **Zona horaria (AC-17):** un gasto con `occurredAt` a las 22:00 del 31 de mayo en Buenos Aires (= 01:00 UTC del 1 de junio) cae en **mayo** con `America/Argentina/Buenos_Aires`, y en **junio** con `UTC`. Fijar la zona **como parámetro**; no depender de la del servidor de pruebas.
- **Saldos con reversa en otro mes:** el acumulado de marzo incluye el gasto y no su reversa de abril (fila 5 de la tabla de decisión).
- **Una divisa a la vez (AC-7)** y **aislamiento entre organizaciones** (NFR-2).
- **El Patrimonio Neto coincide con la tarjeta:** el valor de `cuotasPorPagar` es el mismo que `card.ciclo.cuotasFuturas[ divisa ]` para los mismos planes.
- **Vacío (AC-12):** organización sin asientos → `hayMovimientos: false`, `minKey: undefined`.
- Unitarios del servicio sin base para variaciones, tasa, «Otras» y «Sin categoría» (funciones puras).

### Paso 4 — La acción

`getReportsAction( { monthKey , currency } )`: valida con Zod (`monthKey` con forma `YYYY-MM`, `currency` opcional de 3 letras), obtiene la sesión como las demás lecturas
(`getServerSession( authOptions )`, `session.user.organizationId`), llama al servicio y devuelve `Result< ReportData , string >`. **No escribe nada.**
Mensajes de error con `fail()` en español, como el resto (deuda §3 conocida). Si el plan 4b del acceso está, registrarla `"lectura"` en `actionPolicy`
**y verificar que `actionPolicy.test.ts` pase**.

### Paso 5 — Gráficos compartidos

`TrendChart` y `DonutChart` en `shared/ui/display/`, con Recharts (`^3.9.0`, ya instalado), **sin lógica de negocio**: reciben series y etiquetas ya formateadas.
Reglas:
- **Accesibilidad (NFR-4):** cada uno lleva `role="img"` con `aria-label` descriptivo **y** una lista o tabla con los mismos valores, visible para lectores de pantalla. El donut **no depende sólo del color**: cada porción muestra nombre y porcentaje.
- **Ojito (RN-24):** usan `useMetricsVisibility`; con el ojito cerrado, valores y porcentajes como `••••••`.
- **Celular:** `ResponsiveContainer`, sin ancho fijo. **Estilo (`.agents/AGENTS.md` §4):** CSS Modules con tokens, `rem`, y **nada de movimiento ni cambio de dimensiones en `:hover`** — incluido el resaltado de porciones del donut, que se hace con color, no con escala.
- Tests jsdom siguiendo `Sparkline.test.tsx`: renderiza con datos; con datos vacíos no rompe; con el ojito cerrado no hay números legibles; la alternativa textual está.

### Paso 6 — Componentes de la feature

`StatsContainer` (cliente) recibe `ReportData` y compone, en este orden de arriba hacia abajo (una columna): métricas (`MetricsSection` + cuatro `MetricCard` + transacciones), `TrendChart`, `CategoryBreakdown`, `TopExpensesList`, `NetWorthCard`.
`CategoryBreakdown`: interruptor Gastos/Ingresos y el `DonutChart`; **elegir una porción muestra su desglose por hoja** (estado local; no hace falta URL).
`NetWorthCard`: el rótulo **«a hoy»** siempre y el desglose (activos, pasivos, cuotas por pagar).
`CurrencySelector`: cambia `?currency=`. **Estados (spec, Wireframes):** vacío del período (banda «Sin movimientos en <mes>», el selector sigue habilitado y el Patrimonio Neto se sigue mostrando), esqueletos al cargar, y un solo mes de historia (la tendencia se reemplaza por una línea de texto).
Tests de componente con provider real y diccionario real (`testing_de_componentes_cliente`).

### Paso 7 — La ruta

`reports/page.tsx`, Server Component fino como `settings/page.tsx`:
- Lee `searchParams` (`month`, `currency`) y valida; un mes inválido o futuro cae al mes actual.
- Llama a `getReportsAction`, carga el diccionario, y pasa `currentMonthKey` y `minKey` al `PageHeader` con `showMonthSelector`.
- **Error (A7):** si la acción devuelve `fail`, lanza para que lo recoja `error.tsx`, como las demás rutas.
- **No** dispara `rellenarResumenesMensualesAction`: esta página no usa `monthly_summaries`.

### Paso 8 — Menú, i18n y retiro del Patrimonio Neto de `/accounts`

- `Navbar` y `BottomNav`: una entrada «Estadísticas» (ícono: mirar `Icons.tsx` y reusar uno existente de gráfico; agregar uno **sólo** si no hay) con `sidebar.stats`. Los tests existentes de ambos no deben romper: la prop del diccionario es opcional como `cards` y `loans`.
- Diccionarios: `reportsPage` **completa y a la vez en los tres**: títulos, rótulos de métricas, «vs. mes anterior», «a hoy», «patrimonio según libro», «Otras», «Sin categoría», «General», estados vacíos, el interruptor, los textos de accesibilidad y el `aria-label` de cada gráfico.
- **`AccountsContainer`:** según el RFC 027 §7 — quitar el `hero`, pasar `MetricsSection` a la variante sin hero con **Total Activos y Total Pasivos**, y borrar `netWorth`, `sparklinePointsNetWorth` y `tendenciaNetWorth` si el barrido (§1) no encuentra otro uso. **Total Activos y Pasivos de `/accounts` no cambian de alcance** (siguen siendo de billeteras). **AC-11.**

### Paso 9 — Documentos

- `patterns.md` §8: un párrafo que fije **la convención de signo de `monthly_summaries.liabilitiesSnapshot` = negativa**, como `accounts.balance` (RFC 027 §7). Cierra el §9 del RFC 024.
- `TECHNICAL_DEBT.md`: **cerrar** la viñeta «`monthly_summaries` usa la convención de signo opuesta a `accounts`» (§6) **sólo en lo que toca al signo** si el seed ya la deja alineada (el plan `fix-resumenes-mensuales`); y abrir: **(a)** el dashboard delimita los meses con la zona del servidor (PA-5 de la spec); **(b)** `/accounts` suma divisas en Total Activos y Total Pasivos; **(c)** las tres consultas agregadas por visita no se midieron.

---

## 3. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -n "Estado:" docs/proposals/027-statistics-page.md    # tiene que decir APPROVED
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "netWorth\|sparklinePointsNetWorth" src --include='*.tsx' --include='*.ts' | grep -v '\.test\.'
git diff --stat
pnpm dev
```

**Checklist manual** (sólo se ve en el navegador; con la base sembrada o datos propios; anotar lo que se vio en cada uno):
1. `/es/reports` carga con las cinco secciones y los números del mes en curso (AC-1).
2. Cargar un gasto, reversarlo, y comprobar que **desaparece** de gastos, del top y del conteo (AC-2). **Comparar el ahorro neto con el del dashboard**: tienen que coincidir (AC-4).
3. Cambiar de mes con el selector; ir a un mes sin movimientos (estado vacío, AC-12); intentar ir antes del primer movimiento (AC-13).
4. Con cuentas en dos divisas: cambiar el selector y comprobar que las cifras cambian de verdad (AC-7).
5. Tocar una porción del donut y ver el desglose; probar el interruptor Gastos/Ingresos (AC-8).
6. Cerrar el ojito: ningún importe legible, ni en el donut ni en el top (AC-14).
7. Cambiar a inglés y a portugués: todos los textos y los meses (AC-16).
8. `/accounts` ya no muestra el Patrimonio Neto y sí Activos y Pasivos (AC-11).
9. En el celular real (o 360 px de ancho en el navegador): una columna, sin scroll horizontal, gráficos legibles.
10. **El Patrimonio Neto** de Estadísticas: sumar a mano activos, pasivos y cuotas por pagar y comparar con lo mostrado (AC-10). **Va a diferir del que `/accounts` mostraba antes** —ése excluía tarjetas y préstamos—; confirmar que la diferencia es exactamente esa.
11. Con un usuario `viewer`, si el plan 4b ya está: la página se ve completa (AC-15).

---

## 4. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Leer `monthly_summaries` | RFC 027 §2: no tiene divisa |
| Reportes guardados, exportación, filtros por cuenta, proyecciones | Fuera de alcance de la spec |
| La cascada ni el «Resumen por cuenta» del mock | PA-1 de la spec: fuera |
| Convertir entre divisas ni totales multidivisa | Decisión de producto: una a la vez |
| Arreglar el mes del dashboard en UTC ni la suma de divisas de `/accounts` | Deuda declarada (paso 9) |
| Cachear las consultas | Sin medir; si pesa, es hallazgo |
| Tocar `rellenarResumenesMensualesAction` | Sigue siendo del dashboard |

## 5. Reportá

Los **hallazgos** en lista aparte, **el resultado del checklist punto por punto**, y los tiempos de respuesta de `getReportsAction` con la base sembrada (una medición, no un compromiso): es lo que cierra el supuesto sin medir del RFC.
