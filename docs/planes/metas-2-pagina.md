# Plan — Metas 2/2: la página `/goals` y el saldo libre en `/accounts`

**Rama:** `feat/metas-pagina` (sale de la punta de `feat/metas-modelo`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/metas/spec.md`](../specs/metas/spec.md) — implementa **RN-15**, **RN-18 a RN-21** y los wireframes; cubre **AC-1**, **AC-2** (la parte visible), **AC-13**, **AC-15**, **AC-16** y **AC-17**.
**RFC:** [`../proposals/011-goals-and-reserves.md`](../proposals/011-goals-and-reserves.md) §6 y §7 — **debe estar `APPROVED`** (si no, parar).
**Serie:** 1 `metas-1-modelo-y-operaciones` → **2 este**.
**Precondición dura:** el plan 1 está mergeado y verificado: acá se usan sus siete acciones tal cual.

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa |
| :--- | :--- | :--- |
| `PageHeader`, `MetricsSection`, `MetricCard` (con el *slot* `progressBar`), `MetricsVisibilityContext` | La cabecera, las tarjetas de indicadores y el ojito | Los cinco indicadores de arriba |
| `Modal`, `FormInput`, `FormSelect`, `FormError`, `FormActions` | Formularios estandarizados | Alta, edición, aporte y retiro |
| `ProgressBar` (`shared/ui/display/ProgressBar/`, del plan `presupuestos-2`) | `role="progressbar"`, valor en texto, ancho recortado a 100 % | **Si existe, se reusa tal cual.** Si el plan `presupuestos-2` no se ejecutó todavía, **se construye acá con el contrato exacto de ese plan** (props `value`, `state`, `label`; ver su Paso 1) **y se anota**: no se duplica una versión distinta |
| `formatCurrency( centavos , divisa , locale )` | Formateo por divisa | Todos los importes de la página |
| `AccountsContainer.tsx:414-432` | Dentro del modal de detalle de una entidad, una `Card` por cuenta con `balanceDisplay` formateado con `formatCents`. **Es el único lugar donde se ve el saldo de una cuenta individual** (`grep -n "a.balance"`: `:226` es el total de la entidad, `:414` es la cuenta) | Ahí va la línea de saldo libre. Usa **el mismo formateador que el saldo de al lado** (`formatCents`) para que la tarjeta no mezcle dos estilos; la convivencia de formateadores ya es deuda (`TECHNICAL_DEBT.md` §1) |
| `accounts/page.tsx` | `Promise.all` de cinco acciones y se las pasa a `AccountsContainer` | Se suma una sexta lectura y una prop **opcional** |

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/shared/ui/display/ProgressBar/` | **Sólo si no existe** (ver §0) |
| `src/features/goals/components/` | **Nuevos:** `GoalsContainer`, `GoalCard`, `GoalFormModal`, `ContributeModal`, `GoalsFilter`, `CurrencySelector` si no se puede reusar (+ `.module.css` y tests) |
| `src/app/[lang]/(main)/goals/page.tsx` (+ `page.module.css`) | **Nueva ruta** |
| `src/app/[lang]/(main)/accounts/page.tsx` | Una lectura más: `getReservedByAccountAction()` |
| `src/features/accounting/components/AccountsContainer.tsx` | Prop opcional `reservado`; la línea `libre X` y el rótulo «descubierta» (`:414-432`) |
| `src/features/accounting/components/AccountsContainer.test.tsx` (si existe) | Un caso nuevo; **los existentes deben seguir en verde sin cambios** (la prop es opcional) |
| `src/shared/ui/layout/Navbar/Navbar.tsx` · `BottomNav/BottomNav.tsx` | Una entrada «Metas» |
| `src/dictionaries/es.json` · `en.json` · `br.json` | `sidebar.goals` y `goalsPage`, más la clave de «libre» y «descubierta» en `accountsPage` |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y deuda |

**Quién más usa `AccountsContainer`:** `grep -rn "<AccountsContainer" src/`. Con `reservado` opcional, ningún otro uso cambia.

---

## 2. Pasos

### Paso 1 — `ProgressBar` (sólo si falta)

Ver el §0. Si hay que construirla: `role="progressbar"`, `aria-valuenow/min/max`, `aria-label` con el valor en texto; el **ancho visual se recorta a 100 %**; el color sale del `state`, y el estado **también va en texto**; **sin transición de ancho al montar ni cambio de dimensiones en `:hover`**; test jsdom con 0, 50, 100 y 104.

### Paso 2 — Componentes

- **`GoalCard`:** nombre, estrella si es prioritaria, `ProgressBar`, porcentaje, «ahorrado de objetivo», la fecha y el **aporte sugerido** («$X por mes»), el rótulo **«vencida»** o **«descubierta»** si corresponde, el historial corto («Último aporte …») y los botones **«Aportar»**, **«Retirar»**, **«Editar»** y **«Abandonar»**, **ninguno renderizado si no hay permiso de escritura**. Abandonar pide confirmación y dice que **devuelve lo apartado** a sus cuentas.
- **`ContributeModal`** (aportar y retirar, un solo componente con `mode`): elige la **cuenta** de la lista que ya trae `getGoalsAction` (compatibles, con su **saldo libre**), el monto, y muestra el error del servidor en `FormError`. **Aportar:** si no hay ninguna cuenta compatible (A2), lo dice y **deshabilita «Aportar»**. **Retirar:** lista sólo las cuentas donde **esa meta** tiene algo apartado, y muestra cuánto. El monto se convierte a centavos **en un solo punto** con los decimales de la divisa (`getCurrencyDecimalPlaces`), no con `* 100`.
- **`GoalFormModal`:** alta (nombre, objetivo, divisa, fecha opcional, prioridad) y edición (la divisa en sólo lectura). Valida nombre vacío o de más de 150 caracteres, objetivo ≤ 0 y fecha mal formada **junto al campo**.
- **`GoalsFilter`:** Todas / Activas / Completadas; **estado en la URL** (`?filter=`) para que el enlace sea compartible.
- **`GoalsContainer`:** los cinco indicadores (`MetricCard`: metas, objetivo total, ahorrado total **con su %**, completadas, por completar), el selector de divisa, el filtro, la lista, «+ Nueva» y los estados: **vacío** (A1), esqueletos al cargar, ojito cerrado (importes `••••••`; **porcentajes y estados siguen**). Tras cada acción: `router.refresh()`.
- **Permiso:** si el plan **4b del acceso** ya está, `usePuedeEscribir()` (por omisión `false`); **si no**, `puedeEscribir` por props con valor `true` y **se anota** que el 4b debe cablearlo.

### Paso 3 — La ruta

`goals/page.tsx`, Server Component fino: valida `?currency=` (si falta, la del perfil si tiene metas; si no, la primera con metas; si no hay ninguna, la del perfil) y `?filter=` (`all` por defecto), llama `getGoalsAction`, carga el diccionario y delega. Si la acción devuelve `fail`, **lanza** para que lo recoja `error.tsx`.

### Paso 4 — El saldo libre en `/accounts`

- `accounts/page.tsx`: agregar `getReservedByAccountAction()` al `Promise.all` y pasar el resultado como prop `reservado` (`Record< accountId , { reservado , libre } >`); **si la acción falla, pasar `undefined`**: `/accounts` **no** puede dejar de cargar por un fallo de Metas.
- `AccountsContainer.tsx:414-432`: en la `Card` de una cuenta con entrada en `reservado`, **una línea bajo el saldo** con `libre X` (mismo formateador que el saldo, ver §0) y, si `libre < 0`, el rótulo **«descubierta»** (texto, no sólo color). El saldo grande **no cambia**. Ni Total Activos, ni Total Pasivos, ni el total de la entidad cambian (RN-16): **el barrido `git diff` no debe tocar esos cálculos**.
- Con el ojito cerrado, `libre X` se oculta igual que el saldo (`isContentVisible`).

### Paso 5 — Menú e i18n

`Navbar` y `BottomNav`: «Metas» con `sidebar.goals` (la prop del diccionario es opcional, como `cards` y `loans`). Diccionarios, **los tres a la vez**: `goalsPage` completa (títulos, indicadores, filtros, botones, los dos modales, «aporte sugerido», «vencida», «descubierta», estados vacíos, confirmación de abandono, `aria-label` de las barras) y, en `accountsPage`, «libre» y «descubierta». Los `fail()` del servidor siguen en español (deuda §3 conocida).

---

## 3. Tests

- **`GoalCard`:** las tres variantes de estado; prioritaria; «vencida»; sugerido sólo con fecha, activa y no vencida; progreso topado en 100 % con el porcentaje real visible; **sin permiso de escritura no hay ningún botón**; ojito cerrado.
- **`ContributeModal`:** aportar feliz (llama a la acción con centavos enteros); sin cuenta compatible → deshabilitado y explicado (A2); monto mayor al libre → error del servidor en `FormError`; retirar sólo ofrece cuentas con reserva de esa meta.
- **`GoalFormModal`:** validaciones junto al campo; edición con la divisa en sólo lectura.
- **`GoalsContainer`:** indicadores por divisa; los tres filtros; el orden de la lista; estado vacío (provider real y diccionario real, `testing_de_componentes_cliente`).
- **`AccountsContainer`:** con `reservado` muestra `libre X` y «descubierta»; **sin `reservado`, el render es idéntico al de hoy** (los tests existentes lo prueban); el saldo grande y los totales no cambian en ningún caso.

---

## 4. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -n "Estado:" docs/proposals/011-goals-and-reserves.md # tiene que decir APPROVED
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "<AccountsContainer\|<Navbar\|<BottomNav" src --include='*.tsx'   # todos siguen compilando
git diff --stat
pnpm dev
```

**Checklist manual** (sólo se ve en el navegador, con **dos navegadores** para la carrera; anotar lo que se vio en cada uno):
1. `/es/goals` sin metas: el estado vacío (A1).
2. Crear «Viaje» de $2.000.000, con fecha dentro de 10 meses, prioritaria: aparece primera, al 0 % (AC-1).
3. Aportar $200.000 desde una cuenta con saldo: la meta marca 10 % y el sugerido (AC-11). En `/accounts`, abrir la entidad: la cuenta muestra su saldo **sin cambios** y `libre` $200.000 menos (AC-2). **El Patrimonio Neto de Estadísticas no cambia** (AC-14).
4. Intentar aportar más que el libre: el error muestra el libre (AC-3). Con **dos navegadores** logueados, aportar a la vez a una cuenta con libre para uno solo: uno se acepta y el otro se rechaza (AC-4).
5. Cargar un gasto que deje la cuenta por debajo de lo reservado: se registra y la cuenta y la meta quedan «descubierta»; un aporte nuevo se rechaza (AC-13).
6. Retirar más de lo apartado en esa cuenta: se rechaza (AC-7). Completar la meta: pasa a «completada» (AC-8); retirar un poco: vuelve a «activa» (AC-9).
7. Abandonar una meta con plata en dos cuentas: ambas recuperan su libre y la meta desaparece de los tres filtros (AC-12).
8. Con metas en dos divisas: el selector cambia los indicadores sin mezclarlos (AC-15).
9. Ojito cerrado: ningún importe legible, ni en `/goals` ni en `/accounts`; porcentajes visibles (AC-17). Inglés y portugués.
10. Celular real (o 360 px): una columna, sin scroll horizontal.
11. Con un `viewer`, si el plan 4b ya está: ve todo, incluido el saldo libre, y **no hay botones de escritura** (AC-16); forzar una acción de escritura devuelve el rechazo.

Pegar la salida cruda de los comandos.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Aportes automáticos o recurrentes, rendimientos, metas compartidas | Fuera de alcance |
| Ver o reabrir metas abandonadas | PA-1 de la spec |
| Un saldo libre en otras pantallas (dashboard, `/transactions`) | RN-15 sólo pide `/accounts` |
| Cambiar Total Activos, Total Pasivos o el total de la entidad | RN-16: las reservas no tocan el libro |
| Una `ProgressBar` distinta de la de presupuestos | Contrato único |
| Avisar en el formulario de un gasto que la cuenta quedará descubierta | RN-17: sólo se avisa **después**, en la cuenta y en la meta |

## 6. Reportá

Los **hallazgos** en lista aparte, **el resultado del checklist punto por punto** (en especial la carrera con dos navegadores) y si `ProgressBar` se reutilizó o se construyó acá.
