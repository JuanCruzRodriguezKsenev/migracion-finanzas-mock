# RFC 011: Metas de ahorro y reservas virtuales

*   **ID de la Propuesta:** 011
*   **Título:** Metas con monto y divisa, y reservas virtuales que apartan saldo de una cuenta sin tocar el libro
*   **Estado:** `DRAFT` (2026-10-06 — **reescrito; se le baja el sello**. El `APPROVED` del 2026-06-23 correspondía al texto anterior, que era anterior al core contable y no se podía implementar. **No se programa código contra este texto hasta que figure `APPROVED` de nuevo**)
*   **Fecha de Creación:** 2026-06-22 · **Reescrito:** 2026-10-06
*   **Autor:** Antigravity (texto original) · `tanda` (reescritura)
*   **Spec que implementa:** [`../specs/metas/spec.md`](../specs/metas/spec.md) (aprobada) — este RFC es el *cómo*
*   **Depende de:** RFC 019 (`bigint`), RFC 022 (clasificación), RFC 024 (instrumentos), [RFC 027](027-statistics-page.md) (Patrimonio Neto: las reservas **no** lo cambian)

> [!IMPORTANT]
> **Qué se conserva del texto de 2026-06-22:** la idea de **reservas virtuales** —plata apartada del saldo real de una cuenta— y del **saldo libre** = saldo − reservas, y el progreso de una meta calculado «al vuelo» desde sus reservas.
> **Qué cambia, y por qué:** ver el §0.

---

## 0. Contraste contra el código real (2026-10-06)

| Lo que decía el texto anterior | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| `import { accounts } from "../../features/accounts/schema.db"` | **No existe `features/accounts`**. Las cuentas viven en `src/features/accounting/schema.db.ts:49` | El esquema nuevo importa de `accounting/schema.db` |
| Importes con `integer` (`targetAmount`, `amount`) | Todo monto del repo es **`bigint( … , { mode: "number" } )`** desde el RFC 019 | `bigint` en las dos tablas |
| Las metas no tienen divisa | `accounts.currency` existe y el motor valida por divisa | La meta **lleva divisa**, y una reserva sólo se arma entre cuenta y meta de la **misma** divisa |
| `timestamp( … )` sin zona | El repo usa `timestamp( … , { withTimezone: true } )` | Se corrige |
| Una tabla `reserves` con `amount` mutable | Un monto mutable no tiene historia y se desfasa | **Un registro de movimientos** (`goal_movements`); lo reservado y lo ahorrado **son sumas** (§2) |
| `status` de las reservas `'active' \| 'released'` | Con un registro de aportes y retiros, «liberar» es un retiro | Desaparece el estado de la reserva |
| «El saldo libre necesita que los compromisos existan» (inventario de `trabajo-en-vuelo.md`, Fase 3) | Los compromisos existen hoy (cuotas de tarjeta, RFC 025; préstamos, RFC 008), **pero reserva y compromiso son cosas distintas**: el saldo libre de este RFC es `saldo − reservas`, no `saldo − compromisos` | **No hay dependencia con los compromisos.** Si algún día se quiere un «disponible real», será otra propuesta |
| Hay un bloqueo de fila para evitar carreras | **Sí:** `accountRepository.findByIdForUpdate( id , orgId , tx )` (`accountRepository.ts:52`) hace `SELECT … FOR UPDATE` | Se reusa para serializar aportes por cuenta |
| Hay una barra de progreso | No como pieza; `MetricCard` sólo tiene un *slot* `progressBar` (`MetricCard.tsx:41`). El plan `presupuestos-2` construye `ProgressBar` | Se reusa **sin duplicarlo** (§7) |
| `/accounts` muestra el saldo por cuenta | Sí: `AccountsContainer.tsx:414` (`balanceDisplay`) | Ahí va la línea de saldo libre |

---

## 1. Contexto y objetivos

Una meta es un objetivo con monto y divisa. Apartar plata para ella **no es un movimiento contable**: la plata sigue en su cuenta y sigue siendo del usuario.
Este RFC fija el **modelo** (§2), **cómo se calcula lo que se muestra** (§3), **cómo se serializan las operaciones** (§4), las **acciones** (§5) y la **interfaz** (§6 y §7).

---

## 2. El modelo

**Decisión: dos tablas; el ahorro y lo reservado se calculan, no se guardan.**

```typescript
export const goals = pgTable( "goals" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name" , {length: 150} ).notNull() ,
  currency:       varchar( "currency" , {length: 10} ).notNull() ,
  targetAmount:   bigint( "target_amount" , {mode: "number"} ).notNull() ,          // centavos, > 0
  targetDate:     date( "target_date" ) ,                                            // nulo = sin fecha
  priority:       varchar( "priority" , {length: 10} ).default( "normal" ).notNull() , // 'normal' | 'high'
  status:         varchar( "status" , {length: 20} ).default( "active" ).notNull() , // 'active' | 'completed' | 'abandoned'
  completedAt:    timestamp( "completed_at" , {withTimezone: true} ) ,
  createdAt:      timestamp( "created_at"   , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:      timestamp( "updated_at"   , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

export const goalMovements = pgTable( "goal_movements" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  goalId:         uuid( "goal_id"    ).references( () => goals.id    , {onDelete: "restrict"} ).notNull() ,
  accountId:      uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,
  kind:           varchar( "kind" , {length: 12} ).notNull() ,                       // 'contribution' | 'withdrawal'
  amount:         bigint( "amount" , {mode: "number"} ).notNull() ,                  // centavos, > 0
  occurredAt:     timestamp( "occurred_at" , {withTimezone: true} ).defaultNow().notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;
```
`CHECK` en la migración: `target_amount > 0`, `amount > 0`, `priority IN (…)`, `status IN (…)`, `kind IN (…)`. Índices: `goal_movements( goal_id )` y `goal_movements( account_id )`.
**`goal_movements` sólo recibe `INSERT`:** nunca `UPDATE` ni `DELETE` (así el historial es confiable); ninguna acción los ofrece.

**Por qué registro y no una tabla `reserves` mutable:** el texto anterior guardaba un monto que había que mantener sincronizado con la meta y con la cuenta. Con un registro, **no hay nada que desincronizar**: ahorrado y reservado son `SUM`.
**Por qué la meta tiene divisa:** una reserva sólo tiene sentido entre una cuenta y una meta de la misma moneda; sin divisa en la meta no se puede validar (AC-5 de la spec).

---

## 3. Lo que se calcula

Sumas sobre `goal_movements`, **siempre filtradas por `organization_id`**; `signed = CASE kind WHEN 'contribution' THEN amount ELSE -amount END`.

| Cifra | Consulta |
| :--- | :--- |
| **Ahorrado** de una meta | `SUM( signed )` por `goal_id` |
| Lo apartado por una meta **en una cuenta** | `SUM( signed )` por `( goal_id , account_id )` |
| **Reservado de una cuenta** | `SUM( signed )` por `account_id` |
| **Saldo libre** | `accounts.balance − reservado`. **Se calcula, no se guarda** |
| **Descubierta** | `saldo libre < 0` |
| Historial de una meta | Los últimos movimientos, con el nombre de la cuenta |

**Funciones puras** (`features/goals/services/goalCalculations.ts`, sin acceso a la base): `porcentaje( ahorrado , objetivo )` (el real, sin tope, y uno topado en 100 para la barra),
`mesesRestantes( hoy , fecha , zona )` (meses calendario entre el mes de hoy y el de la fecha, **mínimo 1**, con `claveDeMes` de Estadísticas), `aporteSugerido( restante , meses )` (`Math.ceil`, **enteros**), `estaVencida( hoy , fecha , zona )`, `transicionDeEstado( estado , ahorrado , objetivo )` (RN-11).

---

## 4. Operaciones atómicas y su orden de bloqueo

Toda operación de escritura es **una `db.transaction`** y bloquea **siempre en este orden: la meta primero, la cuenta después** (así dos operaciones concurrentes no pueden bloquearse en cruz).
`goalsRepository.findByIdForUpdate( id , orgId , tx )` es nuevo (`SELECT … FOR UPDATE`, mismo patrón que `accountRepository.findByIdForUpdate`).

| Operación | Dentro de la transacción |
| :--- | :--- |
| **Aportar** | 1) bloquea la meta; 2) rechaza si está abandonada; 3) bloquea la cuenta (`accountRepository.findByIdForUpdate`); 4) valida que sea de la organización, de tipo `asset` y de la **divisa de la meta**; 5) calcula el **reservado** de la cuenta *dentro* de la transacción y exige `monto ≤ balance − reservado`; 6) inserta el movimiento; 7) recalcula el ahorrado y aplica `transicionDeEstado` (puede completar la meta) |
| **Retirar** | 1) bloquea la meta; 2) calcula lo apartado **por esa meta en esa cuenta** y exige `monto ≤` eso; 3) inserta el retiro; 4) `transicionDeEstado` (puede reabrir) |
| **Abandonar** | 1) bloquea la meta; 2) por cada cuenta con neto positivo, inserta un retiro por ese neto; 3) `status = 'abandoned'` |
| **Editar** | Bloquea la meta; actualiza nombre, objetivo, fecha y prioridad (**no la divisa**); `transicionDeEstado` con el objetivo nuevo (AC-9: subir el objetivo reabre) |

**Un aporte no necesita bloquear la meta para ser correcto respecto del saldo; la bloquea para que `transicionDeEstado` no se pise con otro aporte simultáneo.**
El test de concurrencia (§9) es el que prueba el orden de bloqueo.

---

## 5. Acciones

En `features/goals/actions/goalsActions.ts`, todas `Result< T , string >`, con el `organizationId` de la **sesión**:

| Acción | Tipo |
| :--- | :--- |
| `getGoalsAction( { currency , filter } )` | lectura: metas visibles (sin abandonadas), con ahorrado, porcentaje, sugerido, vencida, historial corto, indicadores y divisas; y las **cuentas compatibles con su saldo libre** (para el modal) |
| `getReservedByAccountAction()` | lectura: `Record< accountId , { reservado , libre } >`, para `/accounts` |
| `createGoalAction`, `updateGoalAction` | escritura |
| `contributeToGoalAction`, `withdrawFromGoalAction`, `abandonGoalAction` | escritura |

Zod: nombre 1-150, monto entero > 0, divisa de 3 letras, fecha opcional, prioridad en la lista. **Rol de sólo lectura:** las cinco de escritura se clasifican así en `actionPolicy` y llaman **primero** a `obtenerSesionDeEscritura`, **si el plan 4b del acceso ya está**.

---

## 6. La pantalla `/goals`

Ruta `src/app/[lang]/(main)/goals/page.tsx` (Server Component fino) y `GoalsContainer` (cliente). Piezas: `GoalCard`, `GoalFormModal`, `ContributeModal` (aportar y retirar), `GoalsFilter`, `CurrencySelector`.
**Se reutiliza:** `PageHeader`, `MetricsSection`/`MetricCard` (indicadores), `Modal`, `FormInput`/`FormSelect`/`FormError`, `MetricsVisibilityContext`, `formatCurrency`, y **`ProgressBar`** (`shared/ui/display/ProgressBar/`, del plan `presupuestos-2`; si ese plan no está ejecutado, **se construye una sola vez, en el primero que se ejecute**, con el contrato que el plan de presupuestos fija).
Orden de la lista (RN-20): prioritarias primero, luego fecha límite más próxima, luego nombre. Menú: «Metas» en `Navbar` y `BottomNav`. i18n: `goalsPage` completa en los tres idiomas.

## 7. El saldo libre en `/accounts`

`accounts/page.tsx` llama `getReservedByAccountAction()` y le pasa a `AccountsContainer` un `reservado` **opcional** (sin él, no cambia nada). En `AccountsContainer.tsx:414`, para una cuenta de activo con reservado > 0:
una línea bajo el saldo, `libre X`, y un rótulo «descubierta» si el libre es negativo. **Ni Total Activos ni Total Pasivos ni ningún saldo cambian** (RN-16).

---

## 8. Verificación

La batería del repo (los cuatro, y `tsc --noEmit` como comando propio) más las pruebas del §9 y el recorrido manual con dos navegadores (la carrera de aportes simultáneos) y con un `viewer` si el plan 4b ya está.

## 9. Casos de prueba que este RFC exige

| Caso | Qué afirma |
| :--- | :--- |
| Aportar y saldo libre | AC-2: el libre baja y **no hay ningún asiento** nuevo (contar `ledger_transactions` antes y después) |
| Aportar de más | AC-3: se rechaza con el libre a la vista |
| **Carrera de aportes** | AC-4: `Promise.all` de dos aportes que juntos superan el libre: uno gana, el otro se rechaza; el reservado nunca supera el saldo |
| **Carrera de aporte y retiro** y **de dos aportes a metas distintas con la misma cuenta** | Sin interbloqueo (`deadlock`) y con el resultado correcto |
| Divisa distinta / cuenta que no es de activo / de otra organización | AC-5: rechazo en el servidor |
| Retirar | AC-6 y AC-7: no se retira más de lo apartado **en esa cuenta** |
| Estados | AC-8 (se completa), AC-9 (se reabre por retiro y por suba del objetivo), AC-10 (aportar a una completada) |
| Sugerido | AC-11: 10 meses calendario → `ceil( falta / 10 )`; vencida; sin fecha |
| Abandonar | AC-12: cada cuenta recupera su libre, queda el historial, la meta no se lista |
| Descubierta | AC-13: un gasto que la deja descubierta **no se bloquea** y la cuenta no admite aportes |
| Patrimonio Neto | AC-14: no cambia (usar el servicio de Estadísticas) |
| Aislamiento | Dos organizaciones: ninguna ve ni toca lo de la otra |
| Inmutabilidad | Ninguna ruta de código hace `UPDATE`/`DELETE` sobre `goal_movements` |

---

## 10. Lo que este RFC deja abierto

*   **Metas abandonadas** no se ven ni se reabren desde la interfaz (PA-1 de la spec).
*   **Aportar a una meta completada** se permite (PA-2); la alternativa es bloquearlo.
*   **Las reservas no se reducen solas** cuando la cuenta queda descubierta (PA-3).
*   **Un «disponible real»** que descuente compromisos (cuotas, préstamos) es otra propuesta; este RFC no la necesita.
*   **Aportes automáticos, rendimientos y metas compartidas:** fuera de alcance.
