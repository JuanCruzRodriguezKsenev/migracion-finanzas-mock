# Plan — Presupuestos 2/2: la página `/budgets`

**Rama:** `feat/presupuestos-pagina` (sale de la punta de `feat/presupuestos-modelo`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/presupuestos/spec.md`](../specs/presupuestos/spec.md) — implementa **RN-15 a RN-20** y los wireframes; cubre **AC-1**, **AC-2**, **AC-11**, **AC-15** y **AC-16**, y la parte visible del resto.
**RFC:** [`../proposals/028-budgets.md`](../proposals/028-budgets.md) §5 — **debe estar `APPROVED`** (si no, parar).
**Serie:** 1 `presupuestos-1-modelo-y-calculo` → **2 este**.
**Precondición dura:** el plan 1 está mergeado y verificado: acá se usan sus cuatro acciones tal cual.

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa |
| :--- | :--- | :--- |
| `PageHeader` con `showMonthSelector` | Pinta el `MonthSelector` y escribe `?month=YYYY-MM` (`PageHeader.tsx:67-73`) | La página lee `searchParams.month` y pasa `currentMonthKey` y `minKey` |
| `MonthSelector` (`minKey`, `maxKey`, `todayKey`) | Bloquea meses futuros y anteriores al mínimo | `maxKey` = mes en curso (RN-15). `minKey`: el más viejo `effectiveFrom` de los presupuestos de la organización, o el mes en curso si no hay |
| `MetricsSection` / `MetricCard` | Tarjetas con `title`, `value`, `trend`, `isSensitive`, y un **slot** `progressBar: React.ReactNode` + `progressLabel` (`MetricCard.tsx:41-42`, `:171-174`) | El resumen de arriba y los tres indicadores |
| `MetricsVisibilityContext` | El ojito | Importes enmascarados; **los porcentajes y estados no** (RN-19) |
| `Modal`, `FormInput`, `FormSelect`, `FormError`, `FormActions` | Piezas de formulario ya estandarizadas | El modal de alta y edición |
| `DataTable` | Lista tabular con `columns` y `emptyMessage` | **No** se usa: la lista tiene filas anidadas (sub-límites) y barras; se arma con `BudgetRow` |
| `getCategoryTreeAction` | El árbol de dos niveles | Opciones del selector |
| `formatCurrency( amount , currency , locale )` | Recibe **centavos** | Único formateador; `formatCents` no |

**Lo que NO existe y se construye:** una barra de progreso (`ProgressBar`) y el selector de categorías con padres elegibles (`BudgetCategoryOptions`).

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/shared/ui/display/ProgressBar/` | **Nuevo** (+ `.module.css` y test) |
| `src/features/budgets/components/` | **Nuevos:** `BudgetsContainer`, `BudgetRow`, `BudgetFormModal`, `BudgetCategoryOptions`, `CurrencySelector` si no se puede reusar el de Estadísticas (+ `.module.css` y tests) |
| `src/app/[lang]/(main)/budgets/page.tsx` (+ `page.module.css`) | **Nueva ruta** |
| `src/shared/ui/layout/Navbar/Navbar.tsx` · `BottomNav/BottomNav.tsx` | Una entrada «Presupuestos» |
| `src/dictionaries/es.json` · `en.json` · `br.json` | `sidebar.budgets` y la sección `budgetsPage` |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y deuda |

**Reuso de Estadísticas:** si el `CurrencySelector` de `features/reports/components/` es genérico, **importarlo**; si está atado a `ReportData`, **no tocarlo**: escribir el de presupuestos y anotar la duplicación como hallazgo.
**Los usos de `Navbar` y `BottomNav`:** `grep -rn "<Navbar\|<BottomNav" src/`; la prop nueva del diccionario es opcional, como `cards` y `loans`, para no romper sus tests.

---

## 2. Pasos

### Paso 1 — `ProgressBar`

`shared/ui/display/ProgressBar/ProgressBar.tsx`: recibe `value` (0-100 **sin tope**, para mostrar el 104 %), `state` (`"ok" | "warning" | "danger"`) y `label` (texto para lectores).
- `role="progressbar"`, `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={100}` y `aria-label` con el valor en texto (NFR-6). **El ancho visual se recorta a 100 %**; el exceso se señala con el estado y con el texto «excedido», **no** con una barra más larga que su contenedor.
- El color depende del `state` (tokens del repo: success / warning / danger); **y el estado también va en texto** (no sólo color).
- **Estilo (`.agents/AGENTS.md` §4):** CSS Modules con tokens, `rem`; **sin transición de ancho al montar ni cambio de dimensiones en `:hover`**.
- Test jsdom (patrón de `Sparkline.test.tsx`): valores 0, 50, 100 y 104; el atributo `aria-valuenow`; el ancho visual recortado.

### Paso 2 — Componentes

- **`BudgetCategoryOptions`:** por cada padre del árbol, un `<optgroup>` con la opción **«Todo <padre>»** (el padre) y sus hojas visibles. **Excluye:** hojas `isSystemLeaf`, categorías archivadas, categorías de ingresos, y las que **ya tienen un presupuesto vigente** en la divisa elegida (A3/A4 de la spec). Recibe el árbol y el conjunto de ids ocupados por props; **no** llama a la base. Referencia de forma, **no** para copiar: `TransactionFormModal.tsx:403-423`.
- **`BudgetFormModal`:** alta (categoría + límite + divisa) y edición (**sólo** el límite; categoría y divisa en sólo lectura). El campo del límite acepta decimales según la divisa y **convierte a centavos enteros en un solo punto** (usar la resolución de decimales de `currencyFormatter.ts`, `getCurrencyDecimalPlaces`, no `* 100` a mano). Valida 0, negativo y no numérico **junto al campo** con el foco en él (AC-14). Errores del servidor en `FormError`.
- **`BudgetRow`:** nombre y ícono de la categoría, `ProgressBar`, porcentaje, estado en texto, «restante X» o «excedido por X»; sus **sub-límites anidados** con sangría. Los botones «Editar» y «Eliminar» **no se renderizan** si `!puedeEscribir`. Eliminar pide confirmación.
- **`BudgetsContainer`:** el resumen (`MetricCard` con el slot `progressBar`), los tres indicadores, la lista **ordenada de mayor a menor porcentaje usado** (sólo raíces en el orden; los sub-límites quedan dentro de su padre), «+ Nuevo presupuesto» (oculto sin permiso de escritura), y los estados de la spec: **vacío** (A1), **sin presupuestos en este mes** (A2), esqueletos al cargar. Tras crear, editar o eliminar: `router.refresh()`.
- **Permiso:** si el plan **4b del acceso** ya está, usar `usePuedeEscribir()` (por omisión `false`). **Si no está**, el contenedor recibe `puedeEscribir` por props con valor `true` y **se anota como hallazgo** que el 4b debe cablearlo.

### Paso 3 — La ruta

`budgets/page.tsx`, Server Component fino como `settings/page.tsx`:
- Valida `searchParams.month` (`YYYY-MM`; si es inválido o futuro, el mes en curso **en la zona del usuario**, `claveDeMesActual`) y `searchParams.currency` (si falta, la divisa del perfil si tiene presupuestos; si no, la primera con presupuestos; si no hay ninguno, la del perfil).
- `getBudgetsAction( { monthKey , currency } )`, `getCategoryTreeAction()` y el diccionario, en paralelo con `Promise.all`.
- Si la acción devuelve `fail`, **lanza** para que lo recoja `error.tsx`.

### Paso 4 — Menú e i18n

- `Navbar` y `BottomNav`: «Presupuestos» con `sidebar.budgets` (ícono: reusar uno de `Icons.tsx`; agregar uno sólo si no hay).
- Diccionarios, **los tres a la vez**: `budgetsPage` completa: título y subtítulo, «Nuevo presupuesto», campos del modal, «Todo <padre>», los tres estados, «excedido por», «restante», «% utilizado», los tres indicadores, «días restantes», los estados vacíos (A1 y A2), el aviso de confirmación de borrado y los `aria-label` de las barras. **Los textos del servidor** (`fail()`) siguen en español: deuda §3 conocida, no se abre otra.

---

## 3. Tests

- **`BudgetCategoryOptions`:** ofrece «Todo <padre>» y las hojas; excluye hojas de sistema, archivadas, de ingresos y las ya presupuestadas.
- **`BudgetFormModal`:** alta feliz (llama a la acción con centavos enteros); límite 0, negativo y «abc» no llaman a la acción y muestran el error junto al campo; edición con categoría y divisa en sólo lectura; error del servidor en `FormError`.
- **`BudgetRow` / `BudgetsContainer`** (provider real y diccionario real, `testing_de_componentes_cliente`): estados en orden / alerta / excedido con su texto (**no sólo color**); «excedido por X»; sub-límites dentro del padre; orden por porcentaje; **ojito cerrado: ningún importe legible, porcentaje y estado sí** (AC-16); vacío y «sin presupuestos en este mes»; **sin permiso de escritura no hay «Nuevo», «Editar» ni «Eliminar»** (AC-15).
- **`ProgressBar`:** paso 1.

---

## 4. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -n "Estado:" docs/proposals/028-budgets.md            # tiene que decir APPROVED
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "<Navbar\|<BottomNav" src --include='*.tsx'      # todos siguen compilando
git diff --stat
pnpm dev
```

**Checklist manual** (sólo se ve en el navegador; anotar lo que se vio en cada uno):
1. `/es/budgets` sin presupuestos: el estado vacío con la invitación (A1).
2. Crear uno para una categoría con gasto este mes: aparece con su porcentaje y estado (AC-1). Probar uno de un **padre** y uno de una **hoja** de ese padre: la hoja queda **anidada**, y el límite total del resumen **no** suma los dos (AC-8).
3. Cargar gastos hasta cruzar 85 % y 100 %: los estados cambian (AC-2, AC-3).
4. Cambiar el límite: el mes en curso lo toma; ir a un mes anterior a la creación y ver «sin presupuestos en este mes» (AC-5).
5. Eliminar un presupuesto y volver a crear otro para la misma categoría (AC-6, AC-10).
6. Archivar la categoría presupuestada: el presupuesto sigue; no se ofrece al crear (AC-13).
7. Con dos divisas: el selector cambia la lista (AC-11).
8. Ojito cerrado: ningún importe legible; porcentajes visibles (AC-16). Cambiar a inglés y portugués.
9. Celular real (o 360 px): una columna, sin scroll horizontal, barras legibles.
10. Con un `viewer`, si el plan 4b ya está: ve todo y **no hay ningún botón de escritura**; forzar una acción devuelve el rechazo (AC-15).
11. Un gasto a las 22:00 del último día del mes (hora de Argentina): cuenta en ese mes (AC-12).

Pegar la salida cruda de los comandos.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Avisos al cargar un gasto, correos, consejos automáticos | Fuera de alcance de la spec |
| El widget de presupuestos del dashboard | Fuera de alcance |
| Presupuestar ingresos, «Sin categoría» o la hoja `General` | RN-4 |
| Refactorizar los otros tres selectores de categorías | Es deuda anotada (plan 1, paso 6) |
| Una transición animada de las barras | §4 de `.agents/AGENTS.md` |

## 6. Reportá

Los **hallazgos** en lista aparte, **el resultado del checklist punto por punto**, y si `puedeEscribir` quedó por props (4b ausente) o por el provider.
