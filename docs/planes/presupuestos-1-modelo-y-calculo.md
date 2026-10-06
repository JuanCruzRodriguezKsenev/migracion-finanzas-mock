# Plan — Presupuestos 1/2: el modelo, el cálculo y las acciones

**Rama:** `feat/presupuestos-modelo` (sale de la punta de `feat/estadisticas-pagina`) · **Escrito:** 2026-10-06 · **Abre deuda nueva:** sí (paso 6)
**Spec:** [`../specs/presupuestos/spec.md`](../specs/presupuestos/spec.md) — implementa **RN-1 a RN-14**; cubre **AC-1** a **AC-10**, **AC-12**, **AC-13** y **AC-14** (la parte que no es de pantalla).
**RFC:** [`../proposals/028-budgets.md`](../proposals/028-budgets.md) — **debe figurar `APPROVED` antes de escribir código.** Hoy está en `DRAFT`: si sigue así al empezar, **parar y avisarlo**.
**Serie:** **1 este** → 2 `presupuestos-2-pagina`.
**Precondición dura:** el plan `estadisticas-2-pagina` está ejecutado y verificado. De ahí salen **`reportsRepository.gastoPorHojaDelMes`** y **`shared/lib/monthKey.ts`** (`claveDeMes`, `claveDeMesActual`). Si no existen, **parar**: no se reimplementan acá (RFC 028 §0).
**Independiente** de la serie de acceso. Si el plan `acceso-4b-rol-de-solo-lectura` ya está, aplica el §Paso 5.

No hay nada que se muestre al terminar: este plan deja tablas, cálculo y acciones **probadas**; la pantalla es el plan 2.

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa |
| :--- | :--- | :--- |
| `reportsRepository.gastoPorHojaDelMes( { orgId , monthKey , zona , currency , tipo } )` (plan `estadisticas-2`) | Suma el gasto por hoja con la regla de Estadísticas: cuentas `expense`, sin el par reversado, mes en la zona del usuario | **La única fuente del gasto.** No se hace otra consulta de gasto |
| `claveDeMesActual( zona )` y `claveDeMes( fecha , zona )` (`shared/lib/monthKey.ts`, plan `estadisticas-2`) | `"YYYY-MM"` en la zona IANA | El «mes en curso» de crear, cambiar y eliminar (RN-6, RN-8) |
| `categoryRepository.findTree( orgId , includeArchived )` (`categoryRepository.ts:82`) | Árbol de dos niveles: padre con `children`; cada hoja trae `isSystemLeaf` y `archivedAt` | Para saber qué hojas cuelgan de cada padre y cuáles son `General` |
| `profileRepository.findByUserId` | `timezone` y `currency` | La zona del usuario |
| `limpiarBase()` (`shared/db/testCleanup.ts`) | Vacía todas las tablas en orden topológico por FK `restrict` | **Hay que agregarle las dos tablas nuevas** (§Paso 1) |
| `accounting/schema.db.ts:16-31` (`categories`) | Patrón de `uniqueIndex` con la tabla `categories` de referencia | Modelo para el índice único parcial |

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/budgets/schema.db.ts` | **Nuevo:** `budgets` y `budgetLimits` (RFC 028 §2) |
| `src/shared/db/schema.ts` | Un `export *` más, junto a los de las demás features (`:7-13`) |
| `drizzle/migrations/<siguiente>_*.sql` | Una migración generada. **El número es el siguiente libre al ejecutar; no fijarlo a mano** |
| `src/shared/db/testCleanup.ts` | `budgetLimits` y luego `budgets`, **antes** de `categories` |
| `src/features/budgets/repositories/budgetsRepository.ts` | **Nuevo** |
| `src/features/budgets/services/budgetEvaluation.ts` | **Nuevo.** Funciones puras (RFC 028 §3) |
| `src/features/budgets/services/budgetsService.ts` | **Nuevo.** Compone repositorio + gasto + árbol |
| `src/features/budgets/schemas/budget.schema.ts` | **Nuevo.** Zod |
| `src/features/budgets/actions/budgetsActions.ts` | **Nuevo.** Cuatro acciones (RFC 028 §4) |
| `src/features/budgets/types.ts` | **Nuevo** |
| `src/shared/lib/actionPolicy.ts` | **Sólo si el plan 4b del acceso ya está** (§Paso 5) |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y deuda |

**Quién más construye o lee estas tablas:** nadie: son nuevas. **Quién más cambia por tocar `testCleanup.ts`:** las ~18 suites de integración que llaman `limpiarBase()`; la corrida completa de `pnpm test` es la que lo prueba.

---

## 2. Pasos

### Paso 1 — Esquema, migración y limpieza de tests

`budgets` y `budgetLimits` **tal como el RFC 028 §2**, con estas precisiones que el RFC no cierra:
- `endedFrom` y `effectiveFrom` son `varchar( 7 )` con forma `YYYY-MM`. Agregar `CHECK` de formato: `~ '^\d{4}-(0[1-9]|1[0-2])$'` (drizzle `check()` en el segundo argumento de `pgTable`; **verificar el SQL generado** en el `.sql`).
- `CHECK ( amount > 0 )` en `budget_limits`.
- El índice único **parcial** (`WHERE ended_from IS NULL`): `uniqueIndex( … ).on( … ).where( sql\`…\` )`. **Comprobar en el `.sql` generado** que el `WHERE` quedó; si drizzle-kit no lo emite, agregarlo a mano en la migración y avisarlo como hallazgo.
- `pnpm db:generate`, luego `pnpm db:migrate` sobre la base de desarrollo. **La base de tests aplica toda la cadena desde cero** en cada corrida: la migración tiene que correr limpia.
- `testCleanup.ts`: `budgetLimits`, después `budgets`, **antes** de `categories` (la FK de `budgets.categoryId` es `restrict`).

### Paso 2 — Repositorio

`budgetsRepository` con `db: DBOrTx = db` como el resto:
- `create( { orgId , categoryId , currency , monthKey , amount } , tx )`: inserta el presupuesto y su primer límite **en la misma `tx`** que recibe. **No abre transacción propia** (la abre la acción).
- `findByOrganization( orgId , currency )`: **todos** los presupuestos de esa divisa con **todos sus límites** (dos consultas o un join agrupado en el servicio). El filtro por mes lo hacen las funciones puras, no el SQL: así `limiteVigente` y `presupuestoActivoEn` son lo único que decide.
- `findActiveByCategory( orgId , categoryId , currency , tx )` y `findById( id , orgId , tx )`: **siempre** con `organizationId`.
- `upsertLimit( budgetId , monthKey , amount , tx )`: `INSERT … ON CONFLICT ( budget_id , effective_from ) DO UPDATE SET amount` (RN-7).
- `end( budgetId , monthKey , orgId , tx )`: `UPDATE budgets SET ended_from = $mes WHERE id = $id AND organization_id = $org AND ended_from IS NULL`; si no afectó ninguna fila, devolver `null`.

### Paso 3 — Las funciones puras (todo el comportamiento vive acá)

`budgetEvaluation.ts`, **sin importar la base**, con el RFC 028 §3: `limiteVigente`, `presupuestoActivoEn`, `estadoDe`, `raicesYSublimites`, `resumen`.
Reglas que no se negocian:
- **`estadoDe` usa aritmética entera**: `gastado * 100 < limite * 85` → en orden; `gastado * 100 <= limite * 100` → en alerta; si no, excedido. **Prohibido** `Math.round( gastado / limite * 100 )` para decidir el estado (AC-3). El porcentaje que se *muestra* sí se puede redondear; el estado no.
- Los productos pueden pasar de `2^53` sólo con importes absurdos; aun así, comparar con `BigInt` **no** hace falta: el repo asume `number` hasta `2^53` (`mode: "number"`).
- Un límite no positivo nunca llega acá (lo frena Zod y el `CHECK`); la función **no** divide por cero: si `limite <= 0` devuelve `excedido` si hay gasto y `en_orden` si no, y lo documenta.

### Paso 4 — El servicio

`budgetsService.evaluarMes( { orgId , userId , monthKey , currency } )`:
1. Perfil (`profileRepository.findByUserId`) para la zona; **sin perfil, usar los defaults** (`America/Argentina/Buenos_Aires`), como Estadísticas.
2. `findByOrganization( orgId , currency )` y `categoryRepository.findTree( orgId , true )` (**con archivadas**: RN-9 pide seguir viendo el presupuesto de una categoría archivada).
3. **Una** llamada a `gastoPorHojaDelMes` para el mes y la divisa.
4. Para cada presupuesto activo en el mes (`presupuestoActivoEn`) con límite (`limiteVigente`): gastado = suma de la hoja (si es hoja) o de **todas las hojas del padre, la hoja `General` del padre incluida** (si es padre). **Nada** de lo imputado a la hoja `General` de tipo ni a cuentas sin categoría entra en un presupuesto (RN-4).
5. Marcar raíces y sub-límites, calcular estado y restante, y el `resumen`.
6. Devolver `{ presupuestos , resumen , divisas , monthKey , diasRestantes }`. `diasRestantes`: **del día de hoy al último del mes, inclusive**, en la zona del usuario; `null` si `monthKey` no es el mes en curso (RN-17).

### Paso 5 — Zod y acciones

`budget.schema.ts` y `budgetsActions.ts` según el RFC 028 §4. Detalles del plan:
- `createBudgetAction`: **una `db.transaction`**: valida la categoría **dentro** de la transacción (existe, es de la organización, `type = 'expense'`, no archivada, **no `isSystemLeaf`**), inserta con `monthKey = claveDeMesActual( zona )`. Captura la violación de unicidad (`23505`) del índice parcial y devuelve `fail( "Ya hay un presupuesto vigente para esa categoría y divisa." )`.
- Mensajes de `fail()` en español, como el resto del repo (deuda §3 conocida).
- **Si el plan 4b del acceso ya está ejecutado:** las tres de escritura llaman **primero** a `obtenerSesionDeEscritura()` (antes de Zod), y las cuatro se agregan a `actionPolicy.ts` (`escritura` / `lectura`). **Verificar que `actionPolicy.test.ts` pase.** Si **no** está, usar `getServerSession` como las demás y **dejarlo anotado en el reporte**: el 4b las va a encontrar sin clasificar y las va a exigir.

### Paso 6 — Deuda que se abre

`TECHNICAL_DEBT.md`: **(a)** el selector jerárquico de categorías está escrito a mano en `TransactionFormModal`, `AddSubscriptionModal`, `InstallmentPlanFormModal` y, desde el plan 2, en presupuestos: cuatro copias; **(b)** el gasto en «Sin categoría» no se controla (PA-1 de la spec).

---

## 3. Tests

Integración contra la base real (`limpiarBase()`), cada fila del §7 del RFC 028. En particular los que protegen lo que este plan puede romper:

| Caso | Cómo |
| :--- | :--- |
| **Umbrales** (AC-3) | `it.each` sobre `estadoDe` con límite 10.000.000 centavos y gastados 8.499.999 / 8.500.000 / 10.000.000 / 10.000.001 |
| **Vigencia** (AC-4, RN-7) | Límite desde abril, otro desde mayo, otro cambio en mayo: abril, mayo y un mes sin nada |
| **Antes y después** (AC-5, AC-6) | `presupuestoActivoEn` antes de crear, durante, y desde `endedFrom` |
| **Doble conteo** (AC-8) | Padre 30.000.000, hoja 10.000.000, 8.000.000 gastados en la hoja: resumen con límite 30.000.000 y gastado 8.000.000 |
| **Padre incluye hojas y `General`** (AC-7) | Gastos reales con `createLedgerTransaction`: el gasto sin detallar de un padre (cae en su `General`) **cuenta** |
| **Reversados** (AC-9) | `reverseLedgerTransaction`, no asientos a mano |
| **Carrera** (AC-10) | `Promise.all` de dos `createBudgetAction` iguales: **uno** gana, el otro recibe el mensaje; queda **una** fila vigente |
| **Atomicidad** (NFR-4) | Forzar el fallo del insert del límite (mock del repositorio): no queda el presupuesto |
| **Zona horaria** (AC-12) | Gasto a las 22:00 del 31 de mayo, hora de Buenos Aires, con la zona del perfil fijada |
| **Archivada** (AC-13) | Presupuesto existente sobre una categoría que se archiva: sigue evaluándose; crear uno nuevo sobre ella falla |
| **Validaciones** (AC-14) | 0, negativo, decimal, divisa inválida, hoja de sistema, categoría de ingresos, id inexistente, id de **otra organización** |
| **Aislamiento** | Con sesiones de dos organizaciones: ninguna ve, cambia ni elimina lo de la otra |

---

## 4. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -n "Estado:" docs/proposals/028-budgets.md            # tiene que decir APPROVED
ls src/shared/lib/monthKey.ts ; grep -n "gastoPorHojaDelMes" src/features/reports/repositories/reportsRepository.ts   # las dos precondiciones
pnpm db:migrate
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d budgets" -c "\d budget_limits"
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
git diff --stat
```

En el `\d budgets` tiene que aparecer el índice único **con** `WHERE ( ended_from IS NULL )`. Pegar la salida cruda.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Otra consulta de gasto | RFC 028 §0: una sola regla, en `reportsRepository` |
| Una utilidad de mes propia | Se usa `monthKey.ts` |
| La pantalla, el menú, los textos | Plan 2 |
| Avisos al cargar un gasto, correos, sobrante que se arrastra | Fuera de alcance de la spec |
| Cambiar la divisa de un presupuesto | RN-3: se elimina y se crea otro |
| `Math.round` para decidir un estado | AC-3: aritmética entera |

## 6. Reportá

Los **hallazgos** en lista aparte, y si el `WHERE` del índice parcial salió de drizzle-kit o hubo que agregarlo a mano.
