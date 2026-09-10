# Registro de Cierre — Bandeja de recurrencias (RFC 023), limpieza topológica de suites y desbloqueo de la compuerta

* **Fecha de consolidación:** 2026-09-10
* **Rama base:** `master`
* **Rango consolidado:** `2ae7186..8e086d9` — 12 commits
* **Ramas fusionadas:** `feat/bandeja-recurrencias` (RFC 023) y `fix/cabos-rfc023-y-limpieza-de-tests`, encadenadas una sobre otra.
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `git log --merges` sigue vacío.
* **Resultado global:** **393 tests en 53 archivos de prueba**, 0 fallos; `eslint . --max-warnings 0` con 0 errores y 0 warnings; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; build de producción exitoso. Verificado de forma independiente por el subagente `verificador`, con `postgres-dev` vivo.

> **Este registro se escribió en diferido, el 2026-09-10, junto con el de `fix/page-header-unico-por-pagina`.** La consolidación se hizo en su momento pero se omitió el archivo que la convención pide, y el hueco se detectó recién al buscar el rango del registro siguiente. Queda anotado acá y no se disimula: la fecha de consolidación y la de redacción coinciden por casualidad del calendario, no porque el registro se haya escrito al cerrar.

---

## Detalle de lo consolidado

### RFC 023 aprobado y la bandeja de transacciones propuestas
* **Commits:** `9769ea1`, `dd7388d`
* El RFC bajó a propuesta las ocho decisiones del §2 del doc de diseño, **acotado al origen recurrente**: las otras dos bandejas no tienen productor todavía.
* **Sin tabla de pendientes.** Las ocurrencias se derivan de un único campo nuevo, `subscriptions.resolved_through` (migración `0025`, con backfill al período anterior). Es lo que el diseño ya pedía y lo que hace que la ronda **no dependa de los crons de la Fase 3**.
* **Enmienda al RFC 004:** sus secciones 3 (worker nocturno) y 4 (`needs_review` dentro del libro) quedaron revocadas, anotado en el propio RFC 004.
* **Dos deudas pasaron a requisito y se cerraron acá:**
  * `addInterval` mandaba una suscripción del 31 de enero al 3 de marzo y generaba toda la serie de períodos corrida. Se corrigió anclando en el día nominal y recortando con `recortarDia`, sin desborde de fin de mes.
  * La resolución de categoría padre → hoja estaba duplicada literal en `transactionsActions`. Se extrajo a `categoryRepository.resolveToLeaf` y se consume desde ahí.
* `recurrenceService` con ventana de consulta de ocurrencias pendientes; `resolveSubscriptionAction` atómica, que registra el asiento contable y avanza el puntero en la misma transacción; y el componente `PendingOccurrencesInbox` sobre el treemap en `/subscriptions`.
* **Patrón 10** documentado en `patterns.md` (transacciones propuestas y puntero de idempotencia).

### Los dos defectos que encontró la verificación del RFC 023
* **Commits:** `4ead5e2` (plan), `f21ba07`, `9da3a77`
* **La guarda del puntero quedaba fuera de la transacción.** No fue un desvío de la ejecución: **lo dejó el plan**, que decidió que «el puntero *es* la guarda» sin decir dónde se leía. Se cerró consumiendo `subscriptionRepository.findByIdForUpdate` desde `resolveSubscriptionAction`, con la guarda releída bajo bloqueo `FOR UPDATE`.
* **El backfill de `0025` sólo contemplaba frecuencias mensuales.** Se agregó la migración `0026_backfill_recurrence_pointers.sql` para las demás.
* **Limpieza topológica unificada:** cada suite limpiaba la base a mano, con su propio orden y su propio subconjunto de tablas — 14 archivos, y era la causa raíz del fallo "intermitente" documentado en el registro del RFC 022. Se centralizó en `src/shared/db/testCleanup.ts` (`limpiarBase()`), consumido con `afterAll( limpiarBase )` por **las 18 suites de integración**, y se centralizó el factory `makeSubscription` y el mock de `next/cache`. Quedó como **Patrón 11** en `patterns.md`.

### El desbloqueo de la compuerta de CI
* **Commits:** `eabd54c` (plan), `5bdf1ab`, `df53f56`, `681bcd2`, `6131e42`, `c16cee2`, `a51ef60`
* **El defecto de método de la ronda:** el script `lint` de `package.json` era `eslint` a secas, **sin `--max-warnings 0`**, y salía con código 0 aunque hubiera warnings. Verificar con `pnpm lint` y reportar «lint 0» dejó pasar **75 warnings de imports huérfanos** que ponían CI en rojo — los mismos imports que la centralización de `limpiarBase()` y del factory habían dejado sin uso en 18 archivos de test.
* Se sanearon los 75 warnings y se alineó el script a `eslint . --max-warnings 0`, **idéntico a `.github/workflows/compuerta.yml:66`**. La advertencia quedó escrita en la ficha del proyecto: si algún día vuelven a divergir, **la compuerta manda**.
* **`revalidatePath` normalizado** en las tres llamadas de `src/features/cards/actions/cardsActions.ts` a `revalidatePath( "/[lang]/(main)/cards" , "page" )`, alineadas con la estructura física de archivos de ruta de Next.js y cubriendo todos los idiomas. El fundamento del informe original estaba invertido —decía «usan el locale»— y se corrigió antes de escribirlo.
* **`CardsContainer`:** se sacó el `window.location.reload()`. El motivo tampoco era el que decía el informe: no lo forzaba la caché sino que el contenedor fotografiaba `initialCards` en un `useState`, así que `router.refresh()` solo habría roto la pantalla. Se alineó con el patrón de `AccountsContainer` —renderizar desde props—, se reemplazó el reload por `refresh()` y se montó el modal condicionalmente, que era el cabo que el reload tapaba: los 16 `useState` de `CardFormModal` vivían fuera del `Modal` que los desmonta.

---

## Deuda abierta en esta ronda

Anotada en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) § Abierto, ninguna bloqueante:

* **Cobertura de métodos en el mock de `next/cache`:** el mock del setup global cubre sólo lo que las suites usan hoy.
* **Retroceso potencial de punteros en la migración `0026`.**

El ítem §7 (cada suite limpiando la base a mano) pasó a § Resuelto.

---

## Estado de las ramas

`feat/bandeja-recurrencias` y `fix/cabos-rfc023-y-limpieza-de-tests` quedaron contenidas en `master`
y **no reciben más trabajo: se pueden borrar.**
