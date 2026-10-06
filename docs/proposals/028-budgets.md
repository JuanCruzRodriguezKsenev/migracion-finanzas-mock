# RFC 028: Presupuestos mensuales por categoría

*   **ID de la Propuesta:** 028
*   **Título:** Límites mensuales de gasto por categoría, con vigencia, y su evaluación contra el libro
*   **Estado:** `DRAFT` (2026-10-06 — espera la aprobación del usuario. **No se programa código contra este texto hasta que figure `APPROVED`**)
*   **Fecha de Creación:** 2026-10-06
*   **Autor:** `tanda`
*   **Spec que implementa:** `~/Boveda/Proyectos/migracion-finanzas-mock/Specs/Presupuestos/Spec - Presupuestos.md` (aprobada) — este RFC es el *cómo*
*   **Depende de:** RFC 022 (clasificación, `APPROVED`) y [RFC 027](027-statistics-page.md) (estadísticas, `DRAFT`: de ahí salen la regla de gasto y la utilidad de mes)

---

## 0. Contraste contra el código real (2026-10-06)

| Lo que se suponía | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| Algo de presupuestos ya existe | **Nada.** `grep -rli "budget\|presupuesto" src/` no encuentra una sola coincidencia, ni en código ni en los diccionarios | Todo es nuevo: tablas, feature, ruta y textos |
| La jerarquía de categorías es profunda | Son **dos niveles**: `categories.parentId` es nulo para el padre y apunta al padre para la hoja (`accounting/schema.db.ts:16-31`). Cada padre puede tener una hoja `General` (`is_system_leaf`) | «El padre incluye sus hojas» es una **unión de un salto**, no una recursión |
| Hay un árbol cargado listo para el selector | `categoryRepository.findTree( orgId , includeArchived )` (`:82`) devuelve `CategoryTreeNode[]` (padre con `children`), y `getCategoryTreeAction` lo expone | El selector del modal se arma de ahí |
| Hay un selector de categorías reutilizable | **No.** El `<optgroup>` está escrito a mano en `TransactionFormModal.tsx:403-423` (y repetido en `AddSubscriptionModal` e `InstallmentPlanFormModal`), con una opción por **hoja** y el padre sólo cuando no tiene hojas visibles | Presupuestos necesita elegir **también un padre** como totalidad: no se puede reutilizar tal cual. Se escribe uno propio y se deja anotada la duplicación |
| El gasto por categoría ya se calcula | Lo hará `reportsRepository.gastoPorHojaDelMes` del plan `estadisticas-2` (RFC 027 §4, Q3). **Hoy no existe** | Este RFC **depende** de esa función y **no la reimplementa**: la regla de «qué es gasto» vive en un solo lugar |
| Existe la utilidad de «mes en la zona del usuario» | No: el repo usa `getMonth()` del servidor. La introduce el plan `estadisticas-2` (`shared/lib/monthKey.ts`) | Se reusa; **no se escribe otra** |
| `monthly_summaries` guarda claves de mes reutilizables | Guarda `month` **0-indexado** (`schema.db.ts:150`: «0 = Enero»), igual que `Date.getMonth` | **No se copia.** Las claves de mes de este RFC son texto `YYYY-MM` |
| Hay un componente de barra de progreso | **No como pieza.** `MetricCard` tiene un *slot* `progressBar: React.ReactNode` y `progressLabel` (`MetricCard.tsx:41-42`, `:171-174`), pero nada que dibuje la barra | Se escribe `ProgressBar` en `shared/ui/display/`; el resumen la pasa por ese slot y las filas la usan directo |
| Todas las acciones distinguen el rol | No: ninguna mira `role` hoy. El rol `viewer` lo hace cumplir el plan 4b del acceso, con un registro `actionPolicy` | Las acciones nuevas se clasifican ahí **si el 4b ya está** (§6) |

---

## 1. Contexto y objetivos

La spec define el comportamiento. Este RFC fija lo que la spec deja abierto: **el modelo de datos con vigencia** (§2), **cómo se evalúa un mes** (§3),
**qué acciones y qué piezas de interfaz** (§4 y §5). Una pantalla de lectura sobre dos tablas nuevas; **no toca el libro mayor**.

---

## 2. El modelo

**Decisión:** dos tablas. El presupuesto (la identidad: categoría, divisa, ciclo de vida) y sus límites con vigencia (la historia).

```typescript
export const budgets = pgTable( "budgets" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  categoryId:     uuid( "category_id"     ).references( () => categories.id    , {onDelete: "restrict"} ).notNull() ,
  currency:       varchar( "currency" , {length: 10} ).notNull() ,
  endedFrom:      varchar( "ended_from" , {length: 7} ) ,                // "YYYY-MM"; nulo = vigente
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( t ) => ( {
  // Un solo presupuesto vigente por categoría y divisa (RN-2). Índice ÚNICO PARCIAL.
  vigentePorCategoria: uniqueIndex( "budgets_active_category_currency_unique" )
                         .on( t.organizationId , t.categoryId , t.currency ).where( sql`${t.endedFrom} IS NULL` ) ,
} ) ) ;

export const budgetLimits = pgTable( "budget_limits" , {
  id:            uuid( "id" ).primaryKey().defaultRandom() ,
  budgetId:      uuid( "budget_id" ).references( () => budgets.id , {onDelete: "cascade"} ).notNull() ,
  effectiveFrom: varchar( "effective_from" , {length: 7} ).notNull() ,   // "YYYY-MM"
  amount:        bigint( "amount" , {mode: "number"} ).notNull() ,        // centavos, > 0
} , ( t ) => ( {
  unicoPorMes: uniqueIndex( "budget_limits_budget_month_unique" ).on( t.budgetId , t.effectiveFrom ) ,
} ) ) ;
```
`CHECK ( amount > 0 )` en la migración. La eliminación de una categoría no existe en este repo (se archiva), así que `restrict` no bloquea nada real y protege la historia.

**Por qué texto `YYYY-MM` y no un entero ni una fecha:** la comparación lexicográfica de `"2026-05"` contra `"2026-11"` es correcta, coincide con las claves que ya manejan `MonthSelector` y `PageHeader` (`?month=`), y evita el mes 0-indexado de `monthly_summaries`.

**Por qué versionar el límite en vez de guardar uno solo:** para que **cambiar el límite hoy no reescriba si un mes pasado estaba bien o mal** (RN-6). La alternativa —un solo límite mutable— es más simple y miente sobre el pasado.

---

## 3. Cómo se evalúa un mes

Funciones **puras** en `features/budgets/services/budgetEvaluation.ts`, sin acceso a la base, para poder probarlas exhaustivamente:

- `limiteVigente( limites , monthKey )`: el de mayor `effectiveFrom` ≤ `monthKey`, o `null` (fila 2 de la tabla de decisión de la spec).
- `presupuestoActivoEn( presupuesto , monthKey )`: `monthKey >= primer effectiveFrom` **y** (`endedFrom == null` **o** `monthKey < endedFrom`).
- `estadoDe( gastado , limite )`: `en_orden` si `gastado * 100 < limite * 85`; `en_alerta` si `<= limite * 100`; si no, `excedido`. **Aritmética entera**, sin dividir: `AC-3` de la spec fija 84.999 → en orden y 85.000 → en alerta, y con `Math.round( gastado / limite * 100 )` ambos darían 85.
- `raicesYSublimites( presupuestos , arbol )`: marca como **sub-límite** al presupuesto de una hoja cuyo padre también está presupuestado en la misma divisa (RN-13, RN-14).
- `resumen( presupuestosEvaluados )`: total de límites y total gastado **sólo de raíces**; porcentaje; restante; contadores de excedidas y en alerta (se cuentan **todos** los presupuestos, raíces y sub-límites; son categorías, no dinero).

**El gasto** de cada presupuesto sale de **una** llamada a `reportsRepository.gastoPorHojaDelMes( { orgId , monthKey , zona , currency , tipo: "expense" } )`, agrupada en el servicio:
si el presupuesto es de un padre, suma sus hojas **y la hoja `General` del padre**; si es de una hoja, sólo esa hoja. (La hoja `General` de tipo y las cuentas sin categoría **no** entran en ningún presupuesto: RN-4 y PA-1 de la spec.)

---

## 4. Acciones

En `features/budgets/actions/budgetsActions.ts`, todas `Result< T , string >`, todas con el `organizationId` de la sesión y nunca del cliente:

| Acción | Tipo | Qué hace |
| :--- | :--- | :--- |
| `getBudgetsAction( { monthKey , currency } )` | lectura | Presupuestos activos ese mes, ya evaluados, más las divisas disponibles y el resumen |
| `createBudgetAction( { categoryId , currency , amount } )` | escritura | **Una transacción:** valida que la categoría exista, sea de gasto, no esté archivada y **no sea hoja de sistema**; inserta el presupuesto y su **primer límite** con vigencia en el mes en curso (zona del usuario) |
| `updateBudgetLimitAction( { budgetId , amount } )` | escritura | Upsert del límite con `effectiveFrom` = mes en curso (reemplaza si ya hay uno de ese mes: RN-7) |
| `deleteBudgetAction( { budgetId } )` | escritura | `endedFrom` = mes en curso (RN-8). **No borra filas** |

**Atomicidad (NFR-4):** `createBudgetAction` abre `db.transaction`; si el insert del límite falla, no queda el presupuesto. **Concurrencia:** el índice único parcial es la barrera real contra dos presupuestos vigentes de la misma categoría; el código captura la violación de unicidad (`23505`) y devuelve el mensaje de «ya existe uno vigente» en vez de dejar pasar la excepción.
**Validación (Zod):** `amount` entero en centavos mayor a 0 (la interfaz convierte desde el campo decimal), `currency` de 3 letras, ids con forma de UUID.

**Rol de sólo lectura:** `createBudgetAction`, `updateBudgetLimitAction` y `deleteBudgetAction` son de **escritura**; `getBudgetsAction`, de **lectura**. Si el plan 4b del acceso está ejecutado, se registran en `actionPolicy` y **la acción llama primero a `obtenerSesionDeEscritura`**. Si no, siguen el patrón actual (`getServerSession`) y el plan 4b las incorporará: su test de completitud las encontraría sin clasificar.

---

## 5. La interfaz

**Ruta:** `src/app/[lang]/(main)/budgets/page.tsx`, Server Component fino: lee `?month=` y `?currency=`, llama `getBudgetsAction`, carga el diccionario y delega en `BudgetsContainer` (cliente).

| Componente | Dónde | Qué hace |
| :--- | :--- | :--- |
| `BudgetsContainer` | `features/budgets/components/` | Resumen, indicadores y lista; abre el modal |
| `BudgetRow` | ídem | Una fila: nombre de categoría, barra, porcentaje, estado, restante; sus sub-límites anidados |
| `BudgetFormModal` | ídem | Alta y edición. Alta: categoría + límite + divisa. Edición: sólo el límite |
| `BudgetCategoryOptions` | ídem | El `<optgroup>`: por cada padre, la opción «Todo <padre>» **y** sus hojas visibles; excluye hojas de sistema y archivadas, y las categorías que ya tienen presupuesto vigente en esa divisa |
| `ProgressBar` | `shared/ui/display/` | Barra con `role="progressbar"`, `aria-valuenow` y el valor en texto (NFR-6); el color depende del **estado**, y la barra **no** se anima ni cambia de tamaño en `:hover` |

**Se reutiliza:** `PageHeader` con `showMonthSelector`, `MonthSelector`, `MetricsSection` y `MetricCard` para el resumen y los indicadores, `Modal`, `DataTable` (la lista), `FormInput` / `FormSelect` / `FormError`, `MetricsVisibilityContext`, `formatCurrency`.
**Estados:** vacío (A1), «sin presupuestos en este mes» (A2), cargando con esqueletos, errores en `FormError`. **Menú:** una entrada «Presupuestos» en `Navbar` y `BottomNav` (`sidebar.budgets`). **i18n:** sección `budgetsPage` completa en `es`, `en` y `br`.
**Estilo (`.agents/AGENTS.md` §4):** CSS Modules con tokens, `rem`, nada de movimiento ni cambio de dimensiones en `:hover`.

---

## 6. Verificación

La batería del repo (los cuatro, y `tsc --noEmit` como comando propio) más las pruebas del §7 y el recorrido manual: crear, cambiar y eliminar un presupuesto; un mes pasado; dos divisas; el ojito; tres idiomas; el celular; y un `viewer` si el plan 4b ya está.

## 7. Casos de prueba que este RFC exige

| Caso | Qué afirma |
| :--- | :--- |
| `estadoDe` en los umbrales | 84.999 → en orden, 85.000 → en alerta, 100.000 → en alerta, 100.001 → excedido (AC-3), con **enteros** |
| `limiteVigente` | Cambio de límite en mayo: abril usa el viejo, mayo el nuevo (AC-4); dos cambios en el mismo mes dejan el último (RN-7) |
| `presupuestoActivoEn` | Antes de la creación: no (AC-5); después de eliminarlo: no, y el mes anterior sí (AC-6) |
| `raicesYSublimites` y `resumen` | Padre 300.000 + hoja 100.000 con 80.000 gastados: límite total 300.000 y gasto 80.000 **una vez** (AC-8) |
| Gasto de un padre | Suma de sus hojas y de su hoja `General` (AC-7) |
| Lo reversado | No suma (AC-9) |
| Un vigente por categoría y divisa | Dos creaciones seguidas: la segunda se rechaza con el mensaje, **incluso con `Promise.all`** (AC-10) |
| Categoría archivada | No es elegible; su presupuesto existente sigue visible (AC-13) |
| Zona horaria | Gasto de las 22:00 del 31 (AC-12) |
| Atomicidad | Si falla el insert del límite, no queda el presupuesto (NFR-4) |
| Aislamiento | Dos organizaciones: ninguna ve ni modifica los presupuestos de la otra (NFR-2) |
| Validaciones | 0, negativo, no entero, divisa inválida, hoja de sistema, categoría de ingresos (AC-14) |

---

## 8. Lo que este RFC deja abierto

*   **El gasto en «Sin categoría»** no se controla (PA-1 de la spec).
*   **Un presupuesto de hoja que pasa de raíz a sub-límite** cuando se presupuesta su padre cambia el total del resumen sin tocar ningún límite (PA-3).
*   **El selector de categorías está duplicado** en cuatro modales. No se unifica acá; es deuda de interfaz.
*   **No hay avisos** (correo, push, al cargar un gasto): fuera de alcance de la spec.
*   **Rendimiento:** `getBudgetsAction` hace una consulta de gasto por visita (la de Estadísticas). No se midió; es trivial para una casa.
