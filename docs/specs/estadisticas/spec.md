# Spec — Página de estadísticas

**Estado:** `aprobada` (2026-10-06) — supuestos y texto aprobados «sin leer». PA-1 (cascada y «Resumen por cuenta») queda **fuera**: no se respondió y no estaba en lo aprobado.
**Fecha:** 2026-10-06
**Traza:** [`assumptions.md`](assumptions.md) · **Después de esta spec:** un RFC en `DRAFT` (el repo exige un RFC `APPROVED` antes del código) y recién entonces el plan.
**Referencia visual:** `/reportes` de `~/Dev/finanzas/FinanzasMock`.

---

## Historia

Como **persona que lleva sus finanzas en FinanzIA** —o como su contador, que sólo las mira—, quiero **ver cuánto entra,
cuánto sale, en qué se va la plata y cuánto valgo**, para **tomar decisiones sin armar una planilla**.

## Contexto y problema

Hoy no hay una pantalla que responda esas preguntas, y lo que hay tiene tres defectos de fondo:

- **Las cifras del dashboard se calculan en memoria sobre todas las transacciones** (`calcularIngresosMes` y
  `calcularGastosMes`, `accounting/utils/dashboardMetrics.ts:50` y `:72`), y suman **sólo un lado del asiento**: el
  crédito de las cuentas `revenue` y el débito de las `expense`. Un asiento reversado deja su contra-asiento en el lado
  que se ignora, así que **lo reversado sigue contando**. Lo mismo hace `derivarResumenDeMes`
  (`monthlySummaryService.ts:43-44`), que alimenta `monthly_summaries`. *(Por lectura del código; no lo reproduje.)*
- **El Patrimonio Neto vive en `/accounts`** (`AccountsContainer.tsx:99`) y el RFC 024 §6 ya decidió mudarlo a esta
  pantalla. Queda abierta la convención de signo de `monthly_summaries` (RFC 024 §9).
- **Mezcla divisas.** `monthly_summaries` no tiene columna de moneda, y los flujos se suman sin mirar la divisa de la
  cuenta. No hay cotizaciones guardadas, así que no hay cómo convertir.

**Lo que ya está decidido y esta spec respeta, no discute:** el donut de gastos por categoría es esta pantalla (RFC 022
§10); el Patrimonio Neto se muda acá (RFC 024 §6) y **resta las cuotas futuras de tarjeta** (RFC 025 §6); el nombre de la
ruta y la convención de signo se cierran en esta propuesta (RFC 024 §9).

## Alcance

**Incluye**
- Una página `/reports`, rotulada «Estadísticas», de sólo lectura.
- Cuatro métricas del período: ingresos, gastos, ahorro neto y tasa de ahorro; más la cantidad de transacciones.
- Tendencia de ingresos, gastos y ahorro neto de los últimos 12 meses.
- Gastos e ingresos por categoría, con desglose por subcategoría.
- Los cinco mayores gastos del período.
- Patrimonio Neto con su desglose.
- Corregir el neteo de lo reversado en las tres fuentes que lo ignoran (ver Dependencias).
- Retirar el Patrimonio Neto de `/accounts`.

**No incluye**
- Reportes guardados, exportación, filtros por cuenta, tarjeta o contacto, proyecciones e inflación.
- La cascada y el «Resumen por cuenta» del mock (ver PA-1).
- Convertir entre divisas ni totales multidivisa.
- Comparar organizaciones.
- Presupuestos y metas: tienen su propia spec.

## Glosario

| Término | Significa |
| :--- | :--- |
| **Período** | Un mes calendario, elegido con el `MonthSelector` |
| **Flujo** | Ingreso o gasto de un período: lo que entró o salió, no un saldo |
| **Saldo / snapshot** | El valor acumulado de una cuenta al cierre de un mes |
| **Asiento reversado** | Un asiento original con `reversed_at` no nulo |
| **Reversa** | El contra-asiento, con `reverses_transaction_id` no nulo |
| **Cuotas futuras** | La parte aún no imputada de las compras en cuotas con tarjeta (RFC 025) |

## Actores

| Acción | `owner` | `member` | `viewer` (sólo lectura) |
| :--- | :---: | :---: | :---: |
| Ver Estadísticas | ✓ | ✓ | ✓ |
| Cambiar período, divisa y gráficos | ✓ | ✓ | ✓ |

Nadie modifica nada desde esta pantalla. Sin sesión, redirige al signin como el resto de las rutas.

## Reglas de negocio

**Divisa**
- **RN-1.** Todo se calcula en **una divisa a la vez**, con un selector. No se convierte ni se suma entre divisas.
- **RN-2.** La divisa por defecto es `profiles.currency` si la organización tiene cuentas en ella; si no, la divisa con más movimientos. Las opciones del selector son las divisas en las que la organización tiene cuentas.
- **RN-3.** Sólo cuentan las cuentas de la divisa elegida.

**Flujos del período**
- **RN-4.** Ingresos = suma del **crédito** de las cuentas `revenue`; gastos = suma del **débito** de las cuentas `expense`; ambos de asientos cuya `occurred_at` cae en el mes.
- **RN-5.** Transferencias, cambios de divisa y aperturas no son ingreso ni gasto: no tocan cuentas de resultado, así que ya quedan fuera.
- **RN-6.** **Un asiento reversado y su reversa no cuentan en ningún flujo** —ni en ingresos, ni en gastos, ni en el top, ni en el conteo de transacciones—, aunque la reversa caiga en otro mes que el original. Ver la tabla de decisión.
- **RN-7.** Ahorro neto = ingresos − gastos. Tasa de ahorro = ahorro neto ÷ ingresos, en puntos porcentuales con un decimal; **si los ingresos son cero se muestra «—»**, no 0 %.
- **RN-8.** Cada métrica se compara con el mes anterior. La variación es `null` («—») cuando el mes anterior no tiene base (es cero o no existe), nunca +0,0 % (precedente S3 de `TECHNICAL_DEBT.md`).
- **RN-9.** La tendencia muestra los 12 meses que terminan en el mes elegido; no incluye meses anteriores al primer movimiento.

**Categorías y top**
- **RN-10.** Un solo componente muestra **gastos o ingresos** según un interruptor. El donut tiene una porción por **categoría padre**; las 6 mayores van por separado y el resto se agrupa en «Otras».
- **RN-11.** Al elegir una porción se ve su desglose por subcategoría. Lo imputado a la hoja `General` de un padre aparece como «General» dentro de ese padre; lo imputado a la hoja `General` de tipo (sin categoría) aparece como «Sin categoría» al nivel de los padres.
- **RN-12.** Las categorías archivadas **siguen contando** en el período en que tuvieron movimientos: archivar no reescribe la historia.
- **RN-13.** «Top gastos» son los 5 asientos de mayor monto de gasto del período (la suma de sus débitos a cuentas `expense`), cada uno con descripción, categoría y fecha.

**Patrimonio Neto**
- **RN-14.** Patrimonio Neto = activos + pasivos − cuotas futuras de tarjeta. Los pasivos se guardan en negativo (`patterns.md` §8), así que se **suman**.
- **RN-15.** El Patrimonio Neto es **siempre el de hoy**, no el del mes elegido: las cuotas futuras de un mes pasado no se pueden reconstruir. Se muestra con su desglose (activos, pasivos, cuotas por pagar).
- **RN-16.** La serie histórica de la tendencia muestra **«patrimonio según libro»** (activos + pasivos al cierre de cada mes, sin cuotas futuras), rotulada así para no confundirla con el número de hoy.
- **RN-17.** Se **fija la convención de signo de `monthly_summaries.liabilitiesSnapshot` en la del motor** (negativa) y se escribe en `patterns.md`. Cierra el §9 del RFC 024.
- **RN-18.** El Patrimonio Neto **se retira de `/accounts`** en la misma entrega. Activos y Pasivos se quedan.

**Fuentes y consistencia**
- **RN-19.** Los meses cerrados salen de `monthly_summaries`; el mes en curso, las categorías y el top se calculan del libro en vivo, **con consultas agregadas en la base**, no trayendo todas las transacciones.
- **RN-20.** Los flujos de `monthly_summaries` y del dashboard aplican la **misma exclusión de RN-6**. El ahorro neto del mes en curso en Estadísticas **coincide** con el del dashboard.
- **RN-21.** Reversar un asiento de un **mes cerrado** vuelve a derivar el resumen de **ese** mes.

**Presentación**
- **RN-22.** Sin movimientos en el período: estado vacío con mensaje, **no** gráficos en cero (precedente S3).
- **RN-23.** No se navega a meses anteriores al primer movimiento (precedente M3, `minKey`).
- **RN-24.** El ojito de privacidad enmascara todos los importes y también las porciones del donut (`MetricsVisibilityContext`, precedente S2).
- **RN-25.** Textos en `es`, `en` y `br` desde el primer día; etiquetas de mes con `Intl`.

### Tabla de decisión — qué hace cada asiento en cada cifra

El orden es el de la evaluación. La tabla expone el cruce que la historia no veía: **los flujos excluyen el par, los saldos no.**

| # | El asiento es | ¿Entra en ingresos/gastos? | ¿Entra en el top y el conteo? | ¿Entra en saldos y Patrimonio Neto? |
| :-: | :--- | :-: | :-: | :-: |
| 1 | Normal, sin reversar | sí | sí | sí |
| 2 | **Original reversado** (`reversed_at` ≠ nulo) | **no** | **no** | sí, pero su reversa lo anula |
| 3 | **Reversa** (`reverses_transaction_id` ≠ nulo) | **no** | **no** | sí |
| 4 | Normal, de **otra divisa** que la elegida | no | no | no |
| 5 | Reversa en **otro mes** que su original | no, en ninguno de los dos | no | cada uno cuenta en **su** mes |

**Hueco que mostró la fila 5:** los saldos son acumulativos por fecha del asiento, así que el saldo al cierre de marzo
incluye el gasto original y no su reversa de abril, mientras el flujo de marzo ya no lo muestra. **Marzo deja de
reconciliar flujos contra saldo.** Se acepta (PA-3), porque la alternativa —mostrar gasto en marzo y gasto negativo en
abril— contradice la regla de que lo reversado no cuenta.

## Flujos

**Camino feliz**
1. Abre Estadísticas desde el menú. Ve el mes en curso, en su divisa por defecto.
2. Lee las métricas del mes con su variación contra el mes anterior.
3. Mira la tendencia de 12 meses, elige «Gastos», toca la porción más grande del donut y ve su desglose.
4. Cambia de mes con el selector, o de divisa con el selector de divisa.

**Alternativos**

| # | Situación | Qué pasa |
| :-: | :--- | :--- |
| A1 | La organización no tiene movimientos | Estado vacío, sin gráficos |
| A2 | El mes elegido no tiene movimientos pero hay otros | Estado vacío del período; el selector sigue habilitado |
| A3 | No hay ingresos en el mes | Tasa de ahorro «—» |
| A4 | El mes anterior no tiene base | Variación «—» |
| A5 | Hay cuentas en dos divisas | El selector las ofrece; cambiar de divisa recalcula todo |
| A6 | Un asiento del mes se reversa | Desaparece de los flujos de ambos meses involucrados |
| A7 | La consulta falla | Mensaje de error de la página, con la misma forma que el resto de las rutas (`error.tsx`) |
| A8 | `viewer` | Ve todo igual; no hay ninguna acción que ocultarle |

## Wireframes

Pensados para el celular, con la pantalla angosta como caso base y una sola columna.

**Estado base**
```
┌──────────────────────────────┐
│ Estadísticas        [May 26▾]│
│ ARS ▾                        │
├──────────────────────────────┤
│ Ahorro neto                  │
│ $ 412.300        ▲ 8,2 %     │
│ ▁▂▃▄▃▅▆  vs. mes anterior    │
├──────────────────────────────┤
│ Ingresos    $ 1.250.000  ▲ 3%│
│ Gastos      $   837.700  ▼ 2%│
│ Tasa de ahorro    33,0 %  ▲  │
│ Transacciones           48   │
├──────────────────────────────┤
│ Tendencia · 12 meses         │
│  ▂▃▃▅▄▆▆▅▇▆▅▇   ● ingresos   │
│  ▁▂▂▃▃▄▃▄▄▃▄▄   ● gastos     │
├──────────────────────────────┤
│ Por categoría  [Gastos|Ingr.]│
│      ◔  Vivienda     38 %    │
│         Alimentos    24 %    │
│         Transporte   12 %    │
│         Otras        26 %    │
├──────────────────────────────┤
│ Top gastos                   │
│ Alquiler        $ 320.000    │
│ Supermercado    $ 118.400 …  │
├──────────────────────────────┤
│ Patrimonio Neto              │
│ $ 6.480.000   (a hoy)        │
│ Activos        $ 7.100.000   │
│ Pasivos       −$   420.000   │
│ Cuotas por pagar −$ 200.000  │
└──────────────────────────────┘
```
**Con la tarjeta de Patrimonio Neto:** el rótulo dice «a hoy» siempre, aunque el mes elegido sea otro (RN-15).

**Estados**
- *Vacío del período:* en lugar de métricas y gráficos, una banda «Sin movimientos en mayo de 2026» y el selector de mes habilitado. El Patrimonio Neto se sigue mostrando.
- *Cargando:* esqueletos con las mismas alturas, para que no salte el diseño.
- *Ojito cerrado:* todos los importes como `••••••`; los porcentajes del donut también.
- *Con un solo mes de historia:* la tendencia se reemplaza por una línea de texto, no por un gráfico de un punto.

## Datos

No se agregan tablas ni columnas. Fuentes:

| Cifra | Fuente |
| :--- | :--- |
| Flujos de meses cerrados y tendencia | `monthly_summaries` (con la exclusión de RN-6 aplicada al derivarlos) |
| Flujos del mes en curso, categorías y top | `ledger_entries` ⋈ `ledger_transactions` ⋈ `accounts`, y `category_accounts` ⋈ `categories` para la jerarquía |
| Patrimonio Neto de hoy | `accounts.balance` + `card_installment_plans` |

`monthly_summaries` sigue sin columna de divisa. **Consecuencia (PA-2):** la tendencia de 12 meses de una divisa que no sea la
principal no puede salir de esa tabla; se calcula del libro en vivo.

## Criterios de aceptación

```gherkin
AC-1 — Las métricas del mes
  Dado que en mayo de 2026 hay ingresos por $1.250.000 y gastos por $837.700 en pesos
  Cuando abro Estadísticas en mayo, en ARS
  Entonces veo ahorro neto $412.300, tasa de ahorro 33,0 %
    y la cantidad de transacciones del mes
```
```gherkin
AC-2 — Lo reversado no cuenta
  Dado un gasto de $100.000 en mayo y su reversa, hechos en mayo
  Cuando abro Estadísticas en mayo
  Entonces el gasto no figura en los gastos, ni en el top, ni en el conteo de transacciones
```
```gherkin
AC-3 — Reversa en otro mes
  Dado un gasto de $100.000 de marzo, reversado en abril
  Cuando miro marzo y abril
  Entonces ninguno de los dos meses lo cuenta en sus gastos
    y el resumen de marzo, que ya estaba escrito, se volvió a derivar al reversar
```
```gherkin
AC-4 — Coinciden con el dashboard
  Dado un mes en curso con un gasto reversado
  Cuando comparo el ahorro neto de Estadísticas con el del dashboard
  Entonces los dos números son iguales
```
```gherkin
AC-5 — Sin ingresos
  Dado un mes con gastos y sin ingresos
  Cuando abro Estadísticas
  Entonces la tasa de ahorro muestra «—» y no 0 %
```
```gherkin
AC-6 — Variación sin base
  Dado que el mes anterior no tiene movimientos
  Cuando abro Estadísticas
  Entonces la variación de cada métrica muestra «—» y no +0,0 %
```
```gherkin
AC-7 — Una divisa a la vez
  Dado que tengo cuentas en ARS y en USD, con gastos en ambas
  Cuando elijo USD
  Entonces las cifras suman sólo las cuentas en dólares
    y cambiar a ARS vuelve a las cifras en pesos
```
```gherkin
AC-8 — Categorías
  Dado gastos del mes en seis categorías padre y una séptima más chica
  Cuando miro el donut de gastos
  Entonces veo las seis mayores y «Otras» con la séptima
    y al tocar una veo su desglose por subcategoría
```
```gherkin
AC-9 — Archivar no reescribe
  Dado una categoría archivada que tuvo gastos en mayo
  Cuando abro mayo
  Entonces su gasto sigue en el donut de mayo
```
```gherkin
AC-10 — Patrimonio Neto
  Dado activos por $7.100.000, pasivos de −$420.000 y cuotas futuras por $200.000
  Cuando abro Estadísticas, en cualquier mes
  Entonces el Patrimonio Neto de hoy es $6.480.000
    y muestra el desglose de activos, pasivos y cuotas por pagar
```
```gherkin
AC-11 — Se retira de /accounts
  Dado Estadísticas ya disponible
  Cuando abro /accounts
  Entonces no aparece el Patrimonio Neto, y siguen Activos y Pasivos
```
```gherkin
AC-12 — Vacío
  Dado una organización sin movimientos
  Cuando abro Estadísticas
  Entonces veo el estado vacío y ningún gráfico en cero
```
```gherkin
AC-13 — Límite hacia atrás
  Dado que el primer movimiento es de enero de 2026
  Cuando intento ir a diciembre de 2025
  Entonces el selector no me deja
```
```gherkin
AC-14 — Privacidad
  Dado el ojito de privacidad cerrado
  Cuando abro Estadísticas
  Entonces ningún importe es legible, ni en las tarjetas ni en el donut ni en el top
```
```gherkin
AC-15 — Sólo lectura
  Dado un usuario `viewer`
  Cuando abro Estadísticas
  Entonces la ve completa y no hay ninguna acción que modifique datos
```
```gherkin
AC-16 — Idiomas
  Dado el idioma en inglés
  Cuando abro Estadísticas
  Entonces todos los textos y las etiquetas de mes están en inglés
```

## Requisitos no funcionales

- **NFR-1.** Todo monto viaja en centavos enteros hasta el borde de formateo (`formatCurrency`); nada de punto flotante.
- **NFR-2.** Toda consulta va con el `organizationId` de la sesión (aislamiento multi-tenant).
- **NFR-3.** Las cifras se agregan en la base: ninguna consulta trae todas las transacciones a memoria, que es lo que hace hoy el dashboard.
- **NFR-4.** Recharts, con el estilo del dashboard; cada gráfico con su alternativa textual accesible (una tabla o una lista de los mismos valores).
- **NFR-5.** Pensada para el celular: sin tablas anchas y legible en pantalla angosta. **Sin movimiento ni cambio de dimensiones en `:hover`** (`.agents/AGENTS.md` §4).
- **NFR-6.** La pantalla no escribe nada. **Excepción heredada:** abrir el dashboard sigue rellenando resúmenes faltantes.

## Dependencias

1. **El plan `fix-resumenes-mensuales`** (los resúmenes derivados del libro): hoy en ejecución. Esta spec lo da por hecho.
2. **Corregir la exclusión de lo reversado en tres lugares, antes de mostrar nada**: `derivarResumenDeMes`
   (`monthlySummaryService.ts:43-44`), `calcularIngresosMes` y `calcularGastosMes` (`dashboardMetrics.ts:50,72`). Es la RN-20, y
   **cambia números que hoy ve el usuario en el dashboard**.
3. **Un disparador en la reversión** que vuelva a derivar el resumen del mes del original (RN-21): hoy `reverseLedgerTransaction`
   no toca `monthly_summaries`.
4. **El RFC de estadísticas** en `APPROVED`, que firma el usuario.
5. **Nombre del rótulo en el menú:** claves nuevas en los tres diccionarios (`sidebar.stats` y la sección de la página).

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
| :--- | :--- | :--- |
| Nombre de la ruta | `/reports` | Ya figura en `ARCHITECTURE.md` §4; el rótulo visible es «Estadísticas» |
| Divisa | Una a la vez, sin conversión | No hay cotizaciones guardadas; sumarlas es el defecto que ya tiene `CardVisual` |
| Lo reversado | No cuenta, en ningún mes | Es lo que el usuario espera ver; obliga a re-derivar (RN-21) |
| Patrimonio Neto | Siempre el de hoy | Las cuotas futuras de un mes pasado no se pueden reconstruir |
| Serie histórica | «Patrimonio según libro» | Evita mostrar como un solo número dos magnitudes distintas |
| Signo de los pasivos | El del motor (negativo) | Es el que usan `accounts.balance` y `CardVisual`; la otra convención era la del seed |
| Alcance | Sin reportes guardados ni exportación | Quita superficie sin tocar lo que el usuario pidió |

## Preguntas abiertas

- **PA-1.** El mock trae una **cascada** y un **«Resumen por cuenta»** que esta spec no incluye porque no entraron en los supuestos aprobados. ¿Se agregan después o se descartan?
- **PA-2.** Para una divisa que no sea la principal, la tendencia de 12 meses se calcula en vivo del libro, no de `monthly_summaries`. Se asumió que alcanza para dos usuarios; no se midió.
- **PA-3.** Marzo deja de reconciliar flujos contra saldo cuando algo se reversa en abril (tabla de decisión, fila 5). Se aceptó sin consultar al usuario.
- **PA-4.** Qué se muestra en «Top gastos» cuando un asiento reparte el gasto en varias categorías: se asumió **uno por asiento**, con la categoría del mayor importe.

## Secciones condicionales descartadas

- **Diagrama de estados:** la página no tiene máquina de estados.
- **Contrato de interfaz:** no hay API ni evento; las consultas son internas.
- **Mediciones pendientes:** ningún `M-n`; lo que se podía verificar leyendo el repo se verificó.
