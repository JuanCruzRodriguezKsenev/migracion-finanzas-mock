# Spec — Presupuestos

**Estado:** `aprobada` (2026-10-06) — supuestos y texto aprobados «sin leer».
**Fecha:** 2026-10-06
**Traza:** [`assumptions.md`](assumptions.md) · **Después de esta spec:** el RFC 028 en `DRAFT` (el repo exige un RFC `APPROVED` antes del código) y los planes `presupuestos-1` y `presupuestos-2`.
**Referencia visual:** `/presupuestos` de `~/Dev/finanzas/FinanzasMock`.

---

## Historia

Como **persona que lleva sus finanzas en FinanzIA**, quiero **ponerle un tope mensual a lo que gasto en cada categoría y ver
cuánto llevo gastado**, para **no pasarme sin enterarme**.

## Contexto y problema

- Las categorías ya existen y son jerárquicas (RFC 022): un padre con sus hojas, una hoja `General` por padre, y cada categoría es una cuenta contable de resultado.
  Lo que el usuario gastó en cada una **ya se puede calcular**; lo que **no existe es el tope** ni ningún lugar donde compararlo.
- El mock tiene la pantalla de referencia, pero con datos inventados y sin motor contable: no hay nada que portar más que el diseño.
- La regla de **qué cuenta como gasto** ya la fija la [spec de estadísticas](../estadisticas/spec.md) (RN-4 a RN-6, RN-26). Presupuestos tiene que usar **la misma**, o las dos pantallas mostrarían números distintos para lo mismo.

## Alcance

**Incluye**
- Una página `/budgets`, rotulada «Presupuestos».
- Crear, cambiar el límite y eliminar un presupuesto mensual de una categoría.
- Ver, por mes, cuánto se gastó contra el límite, con su estado.
- Un resumen del total y tres indicadores.

**No incluye**
- Períodos que no sean el mes, arrastrar el sobrante al mes siguiente.
- Avisos por correo o push, avisar al cargar un gasto, consejos automáticos.
- El widget de presupuestos del dashboard.
- Presupuestar ingresos, o la categoría «Sin categoría».
- Cambiar la divisa de un presupuesto ya creado (se elimina y se crea otro).

## Glosario

| Término | Significa |
| :--- | :--- |
| **Presupuesto** | Un límite mensual de gasto para una categoría, en una divisa |
| **Límite vigente** | El límite que rige en un mes dado: el último cuya vigencia empezó en ese mes o antes |
| **Presupuesto raíz** | Un presupuesto cuya categoría no tiene un padre también presupuestado en la misma divisa |
| **Sub-límite** | Un presupuesto de una hoja cuyo padre también tiene presupuesto |
| **Estado** | En orden, en alerta o excedido, según el porcentaje usado |

## Actores

| Acción | `owner` | `member` | `viewer` (sólo lectura) |
| :--- | :---: | :---: | :---: |
| Ver Presupuestos | ✓ | ✓ | ✓ |
| Crear, cambiar el límite o eliminar un presupuesto | ✓ | ✓ | ✗ (los botones no se muestran) |

## Reglas de negocio

**El presupuesto**
- **RN-1.** Un presupuesto es un **límite mensual de gasto** para una categoría de tipo gasto —padre u hoja—, en una divisa. El límite es un monto **mayor a cero**.
- **RN-2.** Hay **como máximo un presupuesto vigente por categoría y divisa**.
- **RN-3.** La divisa **no se cambia** una vez creado: se elimina y se crea otro.
- **RN-4.** No se presupuesta la hoja `General` ni la categoría «Sin categoría» (no son elegibles). El gasto de la `General` de un padre cuenta en el presupuesto de ese padre.
- **RN-5.** Se puede presupuestar una categoría que todavía no tuvo gasto.

**El límite en el tiempo**
- **RN-6.** Crear un presupuesto o cambiar su límite rige **desde el mes en curso** (el de la zona horaria del usuario). **Los meses pasados conservan el límite que tenían**; un mes anterior a la creación no tiene presupuesto.
- **RN-7.** Cambiar el límite dos veces en el mismo mes deja **sólo el último** para ese mes.
- **RN-8.** Eliminar un presupuesto lo deja de evaluar **desde el mes en curso**; los meses anteriores siguen mostrándolo con el límite que tenían. Después se puede crear otro para la misma categoría.
- **RN-9.** Archivar una categoría **no borra** su presupuesto: se sigue viendo en los meses en que tuvo límite, y no se pueden crear presupuestos nuevos sobre una categoría archivada.

**El cálculo**
- **RN-10.** El gasto de un presupuesto es el de **la categoría y todas sus hojas**, con la regla de Estadísticas: cuentas `expense`, sin asientos reversados ni reversas, en la divisa del presupuesto, en el mes calendario de la **zona horaria del usuario**.
- **RN-11.** Restante = límite − gastado. Si es negativo se muestra **«excedido por X»**.
- **RN-12.** Estado: **en orden** si lo usado es menor al 85 % del límite; **en alerta** de 85 % a 100 % inclusive; **excedido** si supera el 100 %. El umbral es fijo.
- **RN-13.** El presupuesto de un padre y el de una de sus hojas **conviven** y se evalúan por separado, sin descontarse. El de la hoja es un **sub-límite**.
- **RN-14.** **El total del resumen suma sólo presupuestos raíz.** Si se sumaran también los sub-límites, el gasto de la hoja se contaría dos veces: una dentro del padre y otra en el sub-límite.

**La pantalla**
- **RN-15.** El mes es el del selector existente, por defecto el mes en curso; no hay meses futuros. Un mes pasado muestra el resultado final con los límites de entonces.
- **RN-16.** Una divisa a la vez, con selector, igual que Estadísticas. Los presupuestos se listan sólo de la divisa elegida.
- **RN-17.** El resumen muestra el **% utilizado** y lo **restante** del total, y tres indicadores: categorías **excedidas**, categorías **en alerta** (entre 85 % y 100 %) y los **días que quedan** del mes. En un mes pasado, los días restantes se muestran como «—».
- **RN-18.** La lista tiene una fila por presupuesto, con barra de progreso, porcentaje y estado, ordenada de **mayor a menor porcentaje usado**; los sub-límites se muestran **dentro** de su padre.
- **RN-19.** El ojito de privacidad enmascara todos los importes; los porcentajes y los estados siguen visibles.
- **RN-20.** Textos en `es`, `en` y `br` desde el primer día.

### Tabla de decisión — qué límite rige en un mes

El orden es el de la evaluación. La tabla expone el cruce entre «existió», «cambió» y «terminó» que la historia no veía.

| # | ¿Hay un límite con vigencia ≤ el mes? | ¿El presupuesto terminó antes o en el mes? | ¿Es un mes futuro? | Resultado |
| :-: | :-: | :-: | :-: | :--- |
| 1 | — | — | sí | No se evalúa (no hay meses futuros) |
| 2 | no | — | no | **Sin presupuesto en ese mes** (es anterior a su creación) |
| 3 | sí | sí | no | Sin presupuesto: terminó antes (RN-8). **El mes en que se elimina ya no se evalúa** |
| 4 | sí | no | no | Rige **el límite de vigencia más reciente ≤ el mes** (RN-6) |

**Hueco que mostró la tabla:** un mes anterior a la creación del primer presupuesto de una categoría no tiene límite, así que en esos meses la pantalla puede
quedar **vacía aunque la organización tenga gasto**. Se acepta y se muestra con su propio mensaje (A2).

## Flujos

**Camino feliz**
1. Abre Presupuestos y ve el mes en curso con los presupuestos de su divisa.
2. Toca «Nuevo presupuesto», elige «Alimentos», pone $300.000 y confirma.
3. Ve la fila de Alimentos con lo gastado hasta hoy, su barra y su estado.
4. A mitad de mes cambia el límite a $350.000: el mes en curso y los siguientes lo usan, los anteriores no.

**Alternativos**

| # | Situación | Qué pasa |
| :-: | :--- | :--- |
| A1 | No hay presupuestos | Estado vacío con una invitación a crear el primero |
| A2 | El mes elegido es anterior a todos los presupuestos | «Sin presupuestos en este mes»; el selector sigue habilitado |
| A3 | Se intenta crear uno para una categoría que ya tiene uno vigente | Se rechaza: ya existe; se ofrece editar el límite |
| A4 | Se intenta presupuestar una categoría archivada | No aparece en el selector |
| A5 | Se escribe un límite de cero, negativo o no numérico | Se rechaza con un mensaje junto al campo |
| A6 | Una categoría presupuestada se archiva | Su presupuesto sigue en la lista de los meses con límite |
| A7 | Hay presupuestos en dos divisas | El selector las ofrece; cambiar recalcula todo |
| A8 | `viewer` | Ve todo; no hay botones de alta, edición ni borrado |
| A9 | Gasto en «Sin categoría» | No es presupuestable; no aparece en ningún presupuesto (PA-1) |

## Wireframes

Celular primero, una sola columna.

**Estado base**
```
┌──────────────────────────────┐
│ Presupuestos        [May 26▾]│
│ ARS ▾              [+ Nuevo] │
├──────────────────────────────┤
│ 62 % utilizado               │
│ ███████████░░░░░░            │
│ $ 1.116.000 de $ 1.800.000   │
│ restante $ 684.000           │
├──────────────────────────────┤
│ Excedidas 1 · En alerta 2    │
│ Días restantes 12            │
├──────────────────────────────┤
│ Alimentos           92 %  ⚠  │
│ ██████████████████░░         │
│ $ 276.000 de $ 300.000       │
│  └ Supermercado     71 %     │
│    ████████████░░░░░         │
│ Vivienda           104 %  ✕  │
│ ████████████████████▌        │
│ excedido por $ 8.000         │
│ Transporte          31 %     │
│ ██████░░░░░░░░░░░░           │
└──────────────────────────────┘
```
**Modal de alta y edición**
```
┌──────────────────────────────┐
│ Nuevo presupuesto            │
│ Categoría   [Alimentos     ▾]│
│ Límite mensual  [ 300.000 ]  │
│ Divisa      [ARS ▾]          │
│ Rige desde este mes          │
│            [Cancelar][Crear] │
└──────────────────────────────┘
```
*Edición:* la categoría y la divisa quedan en sólo lectura; sólo se cambia el límite. *Error:* un mensaje bajo el campo, con el foco en él.
*Cargando:* esqueletos de las mismas alturas. *Ojito cerrado:* los importes como `••••••`, la barra y el porcentaje siguen. *Un `viewer`:* sin «+ Nuevo» ni editar.

## Datos

| Entidad | Campos | Notas |
| :--- | :--- | :--- |
| `budgets` (nueva) | `id` · `organizationId` · `categoryId` · `currency` · `createdAt` · `endedFrom` (`YYYY-MM`, nulo si sigue vigente) | Única vigente por `(organizationId, categoryId, currency)` mientras `endedFrom` sea nulo |
| `budget_limits` (nueva) | `id` · `budgetId` · `effectiveFrom` (`YYYY-MM`) · `amount` (centavos, `bigint`) | Única por `(budgetId, effectiveFrom)`; cambiar el límite en el mismo mes **reemplaza** la fila |

Todo con `organizationId` y en centavos enteros. **Las claves de mes son texto `YYYY-MM`**, no el entero 0-indexado de `monthly_summaries`: ese esquema es una trampa que no se repite.

## Criterios de aceptación

```gherkin
AC-1 — Un presupuesto nuevo
  Dado que gasté $276.000 en Alimentos este mes y no hay presupuestos
  Cuando creo un presupuesto de $300.000 para Alimentos
  Entonces veo la fila con 92 % y estado «en alerta»
    y restante $24.000
```
```gherkin
AC-2 — Excedido
  Dado un presupuesto de $200.000 para Vivienda y gastos por $208.000
  Cuando abro el mes
  Entonces la fila muestra 104 %, estado «excedido» y «excedido por $8.000»
```
```gherkin
AC-3 — Los umbrales
  Dado un presupuesto con límite de $100.000
  Cuando lo gastado es <gastado>
  Entonces el estado es <estado>

  Ejemplos:
    | gastado   | estado      |
    | $84.999   | en orden    |
    | $85.000   | en alerta   |
    | $100.000  | en alerta   |
    | $100.001  | excedido    |
```
```gherkin
AC-4 — Los meses pasados conservan el límite
  Dado un presupuesto de $300.000 desde abril y un cambio a $350.000 en mayo
  Cuando miro abril y mayo
  Entonces abril se evalúa contra $300.000 y mayo contra $350.000
```
```gherkin
AC-5 — Antes de crearse no hay presupuesto
  Dado un presupuesto creado en mayo
  Cuando miro abril
  Entonces no aparece, aunque haya gasto en esa categoría
```
```gherkin
AC-6 — Eliminar no borra la historia
  Dado un presupuesto con gasto en abril, eliminado en mayo
  Cuando miro abril y mayo
  Entonces abril lo sigue mostrando con su límite y mayo ya no
    y puedo crear otro para la misma categoría
```
```gherkin
AC-7 — Un padre incluye a sus hojas
  Dado un presupuesto para Alimentos, y gastos en Supermercado y en Restaurantes (hojas de Alimentos)
  Cuando abro el mes
  Entonces el gasto de Alimentos es la suma de las dos hojas
    y el gasto de la hoja General de Alimentos también cuenta
```
```gherkin
AC-8 — Sub-límites sin doble conteo
  Dado un presupuesto de $300.000 para Alimentos y otro de $100.000 para Supermercado, con $80.000 gastados en Supermercado
  Cuando miro el resumen
  Entonces el límite total es $300.000 y no $400.000
    y el gasto del resumen cuenta los $80.000 una sola vez
    y Supermercado aparece dentro de Alimentos
```
```gherkin
AC-9 — Lo reversado no cuenta
  Dado un gasto de $50.000 en Alimentos y su reversa
  Cuando miro el presupuesto
  Entonces el gasto reversado no suma
```
```gherkin
AC-10 — Un presupuesto vigente por categoría y divisa
  Dado un presupuesto vigente para Alimentos en ARS
  Cuando intento crear otro para Alimentos en ARS
  Entonces se rechaza y se me ofrece editar el límite
```
```gherkin
AC-11 — Divisa
  Dado presupuestos en ARS y en USD
  Cuando elijo USD
  Entonces veo sólo los de USD, medidos contra el gasto en dólares
```
```gherkin
AC-12 — Mes en la zona del usuario
  Dado un usuario en America/Argentina/Buenos_Aires y un gasto a las 22:00 del 31 de mayo
  Cuando miro mayo y junio
  Entonces el gasto cuenta en mayo
```
```gherkin
AC-13 — Categoría archivada
  Dado un presupuesto sobre una categoría que después se archiva
  Cuando miro los meses con límite
  Entonces sigue apareciendo
    y la categoría no se ofrece al crear presupuestos nuevos
```
```gherkin
AC-14 — Validaciones
  Dado el modal de alta
  Cuando escribo un límite de 0, negativo o con letras
  Entonces no se crea y veo el motivo junto al campo
```
```gherkin
AC-15 — Sólo lectura
  Dado un usuario viewer
  Cuando abro Presupuestos
  Entonces lo ve completo y no hay botones de alta, edición ni eliminación
    y una escritura forzada es rechazada por el servidor
```
```gherkin
AC-16 — Privacidad e idiomas
  Dado el ojito cerrado y el idioma en inglés
  Cuando abro Presupuestos
  Entonces ningún importe es legible, los porcentajes siguen visibles y todos los textos están en inglés
```

## Requisitos no funcionales

- **NFR-1.** Importes en centavos enteros hasta el borde de formateo (`formatCurrency`).
- **NFR-2.** Toda consulta y toda escritura va con el `organizationId` de la sesión.
- **NFR-3.** El gasto se calcula en la base, con consultas agregadas, **reutilizando la función de gasto por categoría de Estadísticas** (una sola regla de «qué es gasto»).
- **NFR-4.** Crear y cambiar el límite es **atómico**: no queda un presupuesto sin su primer límite.
- **NFR-5.** Celular primero; sin tablas anchas; **sin movimiento ni cambio de dimensiones en `:hover`** (`.agents/AGENTS.md` §4).
- **NFR-6.** Cada barra de progreso lleva su valor en texto para lectores de pantalla.

## Dependencias

1. **La spec y el plan de Estadísticas** (`estadisticas-2-pagina`): de ahí salen `reportsRepository.gastoPorHojaDelMes` y la utilidad `claveDeMes` / `claveDeMesActual`.
2. **El RFC de presupuestos** (028) en `APPROVED`, que firma el usuario.
3. **El plan 4b del acceso**, si ya está: las acciones nuevas se clasifican en `actionPolicy` y se registran como lectura o escritura.
4. **RFC 022** (categorías): sus tablas y el árbol de dos niveles.

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
| :--- | :--- | :--- |
| Qué es un presupuesto | Un límite mensual por categoría y divisa | Es lo que el mock muestra y lo que el usuario pidió |
| Los meses pasados | Conservan su límite (versionado) | Si no, cambiar el límite hoy reescribiría si un mes pasado estaba bien o mal |
| Padre y hoja | Conviven; el total suma sólo raíces | Evita contar dos veces el gasto de la hoja (RN-14) |
| Qué es gasto | Lo mismo que Estadísticas | Dos pantallas no pueden discrepar sobre el mismo mes |
| Claves de mes | Texto `YYYY-MM` | `monthly_summaries` guarda el mes 0-indexado, una trampa documentada |
| Umbral de alerta | 85 % fijo | Es el del mock; configurarlo es otra decisión de producto |

## Preguntas abiertas

- **PA-1.** El gasto en «Sin categoría» no se puede presupuestar y por lo tanto **no se controla**. Se asumió que es aceptable; no se discutió.
- **PA-2.** ¿Los días restantes cuentan el día de hoy? Se asumió que sí (del día de hoy al último inclusive); no se discutió.
- **PA-3.** Un presupuesto de una hoja cuando el padre **se presupuesta después**: la hoja pasa de raíz a sub-límite y el total del resumen **cambia** sin que nadie haya tocado su límite. Se acepta; el resumen lo recalcula siempre.

## Secciones condicionales descartadas

- **Diagrama de estados:** el estado de un presupuesto es una función del porcentaje, no una máquina.
- **Contrato de interfaz:** no hay API ni evento públicos.
- **Mediciones pendientes:** ningún `M-n`.
