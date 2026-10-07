---
name: titulares-22
description: Plan 22 titulares sin viewers: plan correcto, sin consultas; un test de integración (AC-15 reparto) quedó imposible de armar por la acción.
metadata:
  type: project
---

Plan 22 (RN-17): ejecutado sin consultas, el plan coincidía con el código (líneas citadas exactas). Batería verde a la primera.

- El radio de impacto del plan (§3) listó bien los tests de `autoria.test.ts`, pero se quedó corto: también rompían `habilitacionesActions.test.ts:201` y `splits/reparto.test.ts` AC-15 (cargaba por la acción con titular viewer). El grep sugerido sólo con `titular|holder` los encuentra a medias; correr las suites de `organizations` y `splits` completas lo revela.
- AC-15 ya no se puede reproducir por la acción: se reescribió como rechazo; la RN-24 queda cubierta sólo por el unitario `utils/reparto.test.ts` fila 5. Informado a `tanda`.
- `titularService.test.ts` no existía; patrón: `crearUsuarioConMembresia` + `limpiarBase`, `membershipRepository.cambiarRol` para degradar a viewer.
- La rama ya venía creada (`feat/titulares-sin-viewers`) y el Estado.md aún apuntaba a otra: el desajuste era sólo de Estado, no un problema.

**Why:** evidencia para `tanda` sobre cuánto detalle poner en planes de reglas de rol.
**How to apply:** en planes que endurecen una validación, anticipar los tests de integración que cargaban el caso ahora prohibido.
