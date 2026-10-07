---
name: metas-2-pagina
description: Plan 14 Metas 2 página: dónde el plan se quedó corto (datos que la vista no traía), ProgressBar duplicada entre carriles, trampas de jsdom
metadata:
  type: project
---

Plan 14 se ejecutó en el worktree `migracion-finanzas-mock-metas`, rama `feat/metas-pagina`, sobre `feat/metas-modelo`.

**Dónde el plan se quedó corto:**
- El plan decía que `getGoalsAction` ya traía lo necesario para «Retirar» (cuentas con reserva de esa meta) y para marcar la meta «descubierta»: **no era cierto**. Hubo que extender `GoalView` con `reservas` y `descubierta` (aditivo, vía `sumSignedByGoalAndAccount` por meta; no se tocó el repositorio porque un test fija sus claves exactas).
- «Si no está, construí ProgressBar»: el carril de presupuestos ya tenía la suya en otra rama. Se copió **byte a byte** (`git show feat/presupuestos-pagina:...`) para que el add/add al integrar no choque. Su contrato: `state` obligatorio, `label` verbatim (el consumidor compone valor y estado), `aria-valuetext`.
- `AccountsContainer.test.tsx` no existía ("si existe"): se creó.
- El default de divisa lo resuelve el servicio (perfil o primera divisa), no la página.
- `<input type="date">` descarta fechas inválidas incluso en jsdom: la validación de «fecha mal formada» no se puede testear tecleando.

**Why:** `tanda` decide cuánto detalle poner; **How to apply:** en planes de UI sobre una vista ya construida, verificar que los datos que la UI necesita estén realmente en el tipo de la vista.

Sin fricción: el diccionario real y los providers reales en tests de contenedor funcionaron a la primera; la inserción textual de claves i18n (no json.dump, que reformatea) mantiene el diff mínimo.
