# Plan — Metas 1/2: el modelo, el cálculo y las operaciones atómicas

**Rama:** `feat/metas-modelo` (sale de la punta de `feat/presupuestos-pagina`) · **Escrito:** 2026-10-06 · **Abre deuda nueva:** sí (paso 8)
**Spec:** [`../specs/metas/spec.md`](../specs/metas/spec.md) — implementa **RN-1 a RN-14**, **RN-16** y **RN-17**; cubre **AC-1** a **AC-14** y **AC-16** (la mitad del servidor).
**RFC:** [`../proposals/011-goals-and-reserves.md`](../proposals/011-goals-and-reserves.md) (**reescrito**) — **debe figurar `APPROVED` de nuevo antes de escribir código.** Hoy está en `DRAFT`: si sigue así, **parar y avisarlo**.
**Serie:** **1 este** → 2 `metas-2-pagina`.
**Precondiciones duras:** el plan `estadisticas-2-pagina` está ejecutado (se usa `claveDeMes` de `shared/lib/monthKey.ts`, y el Patrimonio Neto de su servicio para el test de AC-14). **No** depende de presupuestos: si `presupuestos-2` ya está, mejor; si no, ver el plan 2 por `ProgressBar`.
**Independiente** de la serie de acceso; si el plan 4b ya está, aplica el §Paso 6.

No hay nada que se muestre al terminar: este plan deja tablas, cálculo y operaciones **probadas**, incluida la concurrencia. La pantalla es el plan 2.

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa |
| :--- | :--- | :--- |
| `accountRepository.findByIdForUpdate( id , orgId , tx )` (`accountRepository.ts:52`) | `SELECT … FOR UPDATE` filtrado por organización | **El bloqueo de cuenta** de aportar. No se reimplementa |
| `accounts` (`accounting/schema.db.ts:49`) | `type`, `currency`, `balance` en centavos (`bigint`), `organizationId` | Validación de aporte: `type = 'asset'`, misma divisa, misma organización |
| `claveDeMes( fecha , zona )` (`shared/lib/monthKey.ts`, plan `estadisticas-2`) | `"YYYY-MM"` en la zona IANA | Meses que faltan hasta la fecha (RN-13) |
| `profileRepository.findByUserId` | `timezone` | La zona del usuario; **sin perfil**, los defaults (`America/Argentina/Buenos_Aires`) |
| `limpiarBase()` (`shared/db/testCleanup.ts`) | Vacía todo en orden topológico por FK `restrict` | **Hay que agregarle las dos tablas** (§Paso 1) |
| `createLedgerTransaction` (`accountingService.ts`) | Crea asientos | **No se usa:** aportar no genera asientos (RN-5). Sirve **sólo en los tests**, para dar saldo a una cuenta y para el caso de la cuenta descubierta |

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/goals/schema.db.ts` | **Nuevo:** `goals` y `goalMovements` (RFC 011 §2) |
| `src/shared/db/schema.ts` | Un `export *` más (`:7-13`) |
| `drizzle/migrations/<siguiente>_*.sql` | Una migración generada. **El número es el siguiente libre al ejecutar** |
| `src/shared/db/testCleanup.ts` | `goalMovements` y luego `goals`, **antes** de `accounts` |
| `src/features/goals/repositories/goalsRepository.ts` · `goalMovementsRepository.ts` | **Nuevos** |
| `src/features/goals/services/goalCalculations.ts` | **Nuevo.** Funciones puras (RFC 011 §3) |
| `src/features/goals/services/goalsService.ts` | **Nuevo.** Las operaciones atómicas (RFC 011 §4) y la vista |
| `src/features/goals/schemas/goal.schema.ts` · `types.ts` | **Nuevos** |
| `src/features/goals/actions/goalsActions.ts` | **Nuevo.** Siete acciones (RFC 011 §5) |
| `src/shared/lib/actionPolicy.ts` | **Sólo si el plan 4b del acceso ya está** |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` · `docs/ROADMAP.md` | Estado y deuda |

**Quién más construye o lee estas tablas:** nadie (nuevas). **Quién más cambia por `testCleanup.ts`:** todas las suites que llaman `limpiarBase()`; la corrida completa de `pnpm test` lo prueba.
**Nadie escribe en `accounts`**: este plan **no** toca `balance`. Si un paso lo requiere, **parar**: el diseño se desvió (RN-5, RN-16).

---

## 2. Pasos

### Paso 1 — Esquema, migración y limpieza de tests

`goals` y `goalMovements` **tal como el RFC 011 §2**, con las precisiones que el RFC deja:
- `CHECK` en la migración: `target_amount > 0`, `amount > 0`, `priority IN ('normal','high')`, `status IN ('active','completed','abandoned')`, `kind IN ('contribution','withdrawal')` (drizzle `check()`; **verificar el SQL generado**).
- Índices en `goal_movements( goal_id )` y `( account_id )`; en `goals( organization_id , status )`.
- `pnpm db:generate`, `pnpm db:migrate`. **La base de tests aplica la cadena desde cero**: tiene que correr limpia.
- `testCleanup.ts`: `goalMovements`, `goals`, **antes** de `accounts` (FK `restrict` de `goal_movements.account_id`).

### Paso 2 — Repositorios

`goalsRepository` y `goalMovementsRepository`, con `tx: DBOrTx = db`:
- `goalsRepository`: `create`, `findById( id , orgId , tx )`, **`findByIdForUpdate( id , orgId , tx )`** (`.for( "update" )`, mismo patrón que `accountRepository`), `update( id , orgId , data , tx )` (siempre `updatedAt = now`), `setStatus( id , orgId , status , completedAt , tx )`, `findVisibleByOrganization( orgId , currency )` (**excluye** `abandoned`).
- `goalMovementsRepository`: **sólo** `insert( data , tx )` y consultas de lectura. **No hay `update` ni `delete`** (RFC 011 §2): ni como método.
  Lecturas: `sumSignedByGoal( goalIds , orgId )`, `sumSignedByGoalAndAccount( goalId , orgId , tx )` (un renglón por cuenta), `sumReservedByAccount( orgId , accountIds? , tx )` y `history( goalIds , orgId , limit )` con el nombre de la cuenta.
  `signed = CASE kind WHEN 'contribution' THEN amount ELSE -amount END`; las sumas vuelven como `string` y se convierten con `Number(...)`, como `derivarResumenDeMes`.
- **Todo** con `organizationId`.

### Paso 3 — Las funciones puras

`goalCalculations.ts` sin importar la base (RFC 011 §3): `porcentaje`, `porcentajeParaBarra`, `mesesRestantes`, `aporteSugerido`, `estaVencida`, `transicionDeEstado`.
Reglas que no se negocian:
- **Aritmética entera en el sugerido:** `Math.ceil( restante / meses )`, con `meses ≥ 1`. Un `restante ≤ 0` devuelve `0` y **no** una sugerencia negativa.
- `transicionDeEstado( estado , ahorrado , objetivo )`: `active → completed` si `ahorrado ≥ objetivo`; `completed → active` si `ahorrado < objetivo`; **`abandoned` no cambia nunca**.
- `mesesRestantes` recibe la **zona** y usa `claveDeMes` (no `getMonth()` del servidor). Fecha en el mes de hoy → **1**, no 0.

### Paso 4 — `goalsService`: las operaciones

Cada una **abre su `db.transaction`** y respeta el **orden de bloqueo meta → cuenta** (RFC 011 §4). Todas reciben `orgId` de la sesión.
- **`aportar( { goalId , accountId , amount } )`:** el orden y las validaciones del RFC 011 §4, fila por fila. **El reservado de la cuenta se calcula DENTRO de la transacción y después de bloquear la cuenta**: calcularlo antes reabre la carrera (AC-4).
  El mensaje de rechazo lleva el **saldo libre actual** (A3). Una cuenta con saldo libre negativo rechaza **cualquier** aporte (hueco de la tabla de decisión de la spec).
- **`retirar( { goalId , accountId , amount } )`:** valida contra `sumSignedByGoalAndAccount` de **esa** meta en **esa** cuenta (AC-7); mensaje con lo apartado.
- **`abandonar( goalId )`:** un retiro por cada cuenta con neto **positivo**; después `status = 'abandoned'`. **Una meta sin plata apartada también se puede abandonar.**
- **`crear`** y **`editar`** (nombre, objetivo, fecha, prioridad; **nunca** la divisa): `editar` aplica `transicionDeEstado` con el objetivo nuevo (AC-9).
- **`vista( { orgId , userId , currency , filter } )`:** metas visibles, ahorrado, porcentaje, sugerido, `vencida`, historial corto, **indicadores por divisa** (cantidad, objetivo total, ahorrado total y su %, completadas, por completar) y las **cuentas compatibles con su saldo libre**. Orden de la lista (RN-20): prioritarias, luego fecha más próxima (**las sin fecha al final**), luego nombre.
- **`reservadoPorCuenta( orgId )`:** `Record< accountId , { reservado , libre } >` sólo de cuentas `asset` con `reservado > 0`.
- Estados de la acción: `Result< T , string >`; mensajes de `fail()` en español como el resto (deuda §3 conocida).

### Paso 5 — Zod y acciones

`goal.schema.ts` y `goalsActions.ts` según el RFC 011 §5: nombre 1-150 recortado, monto entero > 0 (la interfaz convierte), divisa de 3 letras, fecha opcional con forma `YYYY-MM-DD`, prioridad en la lista, ids con forma de UUID.
La **sesión** de cada acción es `getServerSession( authOptions )` y el `organizationId` sale de ahí, **nunca del cliente**.

### Paso 6 — Rol de sólo lectura

**Si el plan `acceso-4b-rol-de-solo-lectura` ya está ejecutado:** las cinco de escritura llaman **primero** a `obtenerSesionDeEscritura()` (antes de Zod), y las siete acciones se agregan a `actionPolicy.ts`; **verificar que `actionPolicy.test.ts` pase**. **Si no:** `getServerSession` como las demás, **anotado en el reporte**: el 4b las va a encontrar sin clasificar.

### Paso 7 — Documentos

`ROADMAP.md` y el inventario de `trabajo-en-vuelo.md` nombran el RFC 011 como aprobado: actualizar su estado a «reescrito, `DRAFT`» o «`APPROVED`» según corresponda al ejecutar.

### Paso 8 — Deuda que se abre

`TECHNICAL_DEBT.md`: **(a)** las reservas no se reducen solas cuando una cuenta queda descubierta (PA-3 de la spec); **(b)** las metas abandonadas no se pueden ver ni reabrir (PA-1); **(c)** no hay un «disponible real» que descuente compromisos (RFC 011 §10).

---

## 3. Tests

Integración contra la base real (`limpiarBase()`), cada fila del §9 del RFC 011. Los que más protegen:

| Caso | Cómo |
| :--- | :--- |
| **Sin asiento** (AC-2) | Contar `ledger_transactions` y `ledger_entries` **antes y después** de aportar: iguales. Y `accounts.balance` **no cambia** |
| **Carrera de aportes** (AC-4) | Cuenta con saldo libre de 10.000.000; `Promise.all` de dos aportes de 8.000.000: **uno** se acepta, el otro se rechaza; el reservado es 8.000.000. **Repetir el test 20 veces en un bucle**: una carrera que falla 1 de cada 10 no puede pasar |
| **Interbloqueo** | `Promise.all` de aportes de dos metas distintas **a la misma cuenta** y de un aporte contra un retiro de la misma meta: ambos terminan, ninguno lanza `deadlock detected` |
| **Divisa y tipo** (AC-5) | Cuenta en otra divisa; cuenta que no es `asset`; cuenta de **otra organización** (con un id real de esa otra) |
| **Retiro por cuenta** (AC-7) | Meta con 20.000.000 de la cuenta A y 10.000.000 de la B: retirar 25.000.000 a A se rechaza |
| **Estados** (AC-8, AC-9, AC-10) | Completar, reabrir por retiro, reabrir por **subir el objetivo**, aportar a una completada |
| **Sugerido** (AC-11) | Fecha dentro del mes → meses = 1; 10 meses → `ceil( falta / 10 )`; vencida → sin sugerencia; sin fecha → ninguna; `restante ≤ 0` → 0 |
| **Abandonar** (AC-12) | Dos cuentas con reserva: ambas recuperan su libre, el historial tiene los retiros, la meta no sale de `vista`; **abandonar sin plata apartada** funciona |
| **Descubierta** (AC-13) | `createLedgerTransaction` que baja el saldo por debajo de lo reservado **no falla**; esa cuenta rechaza un aporte nuevo |
| **Patrimonio Neto** (AC-14) | Con el servicio de Estadísticas: el neto es igual antes y después de aportar |
| **Orden de la lista** (RN-20) | Prioritaria sin fecha, normal con fecha cercana, normal sin fecha: el orden de la spec |
| **Aislamiento** | Dos organizaciones; ninguna ve ni modifica lo de la otra |
| **Inmutabilidad** | `grep -rn "goalMovements" src/ \| grep -i "update\|delete"` no encuentra ninguna escritura distinta de `insert` (**además** de un test que lo afirme) |
| **Validaciones** | 0, negativo, decimal, nombre vacío o de 151 caracteres, divisa inválida, fecha mal formada, prioridad inventada |

---

## 4. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -n "Estado:" docs/proposals/011-goals-and-reserves.md # tiene que decir APPROVED
ls src/shared/lib/monthKey.ts                              # la precondición
pnpm db:migrate
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d goals" -c "\d goal_movements"
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "goalMovements" src --include='*.ts' | grep -v '\.test\.' | grep -i "update\|delete"   # vacío
git diff --stat                                            # accounts, ledger* sin tocar
```

Pegar la salida cruda. **Criterio de «no tocó el libro»:** `git diff --stat` no incluye ningún archivo de `accounting/` salvo `schema.ts`/barrel y `testCleanup.ts`.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Un asiento contable al aportar, ni cuentas de ahorro nuevas | RN-5: el ahorro es virtual |
| Un contador guardado de «ahorrado» o «reservado» | NFR-4: se calculan del registro |
| `UPDATE` o `DELETE` sobre `goal_movements` | El registro es sólo de inserción |
| Reducir reservas solas cuando la cuenta queda descubierta | PA-3: es del usuario |
| La pantalla, el menú, el saldo libre en `/accounts` | Plan 2 |
| Un «disponible real» que reste cuotas o préstamos | Otra propuesta |

## 6. Reportá

Los **hallazgos** en lista aparte, **cuántas veces corrió el test de carrera y cuántas falló**, y si hubo algún `deadlock` en la base durante la corrida.
