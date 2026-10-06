# Traza de supuestos — acceso con Google a organizaciones compartidas

Historia: «Quiero que mi novia y yo usemos FinanzIA sobre la misma organización, entrando con login de
Google.» Corrección del usuario (2026-10-06): **una persona puede pertenecer a más de una
organización.** Una organización es, para casi todos, la casa, la familia o la pareja; también puede ser
un negocio o un trabajo.

Estado: rondas 1 y 2 aprobadas «sin leer» (2026-10-06). Spec escrita en [`spec.md`](spec.md), estado `draft`.

## Ronda 1 — asumidos y aceptados

| # | Supuesto | Estado |
|---|---|---|
| 1 | Google se suma al login por email y contraseña; éste no se retira | asumido |
| 2 | Sin registro abierto: con Google sólo entra quien fue autorizado de antemano | asumido |
| 3 | El despliegue a un host con HTTPS queda fuera de esta spec (plan aparte, previo a que ella entre) | asumido |
| 4 | Sin autoría por movimiento ni cuentas/categorías privadas por persona | asumido |
| 5 | Dos roles, `owner` y `member`; `admin` no se usa | **reformulado** → ver R2-1 |
| 6 | Un `member` hace todo lo contable; no invita ni quita personas | asumido |
| 7 | ~~Una persona pertenece a una sola organización~~ | **rechazado → resuelto** |
| 8 | Tu usuario real nace al entrar con tu Google; `admin@ejemplo.com` se elimina | **reformulado** → ver R2-2 |
| 9 | Autorización por invitación de un `owner` (email + rol) | **reformulado** → ver R2-5 |
| 10 | La invitación vence a los 7 días y es revocable | asumido |
| 11 | Sólo emails verificados por Google | asumido |
| 12 | Email comparado normalizado, sin distinguir mayúsculas | asumido |
| 13 | Se ancla la identidad al `sub` de Google en el primer login | asumido |
| 14 | Quitar a un miembro conserva sus movimientos; su sesión muere en ≤ 5 min | **reformulado** → ver R2-3 |
| 15 | Un `owner` no puede quitarse si es el único | **reformulado** → ver R2-3 |
| 16 | `passwordHash` y `salt` pasan a opcionales | asumido |
| 17 | Tabla nueva de invitaciones | **reformulado** → ver R2-5 |
| 18 | Nombre y foto desde Google; moneda e idioma con defaults | asumido (`profiles` ya es por usuario: `profile/schema.db.ts:12`) |
| 19 | Sin invitación: «Tu cuenta no tiene acceso», sin revelar nada | asumido |
| 20 | Cancelación o falla de Google: vuelve al signin con mensaje traducido | asumido |
| 21 | El bloqueo por intentos no se aplica al flujo Google | asumido |
| 22 | Botón «Continuar con Google» arriba del formulario, en es/en/br | asumido |
| 23 | Pestaña «Miembros» en `/settings`, sólo para `owner` | **reformulado** → ver R2-7 |
| 24 | Sesión JWT de 12 h con revalidación | asumido |
| 25 | Credenciales de Google las crea el usuario; sin ellas el botón no aparece | asumido |

## #7 resuelto

**Decisión:** una persona puede tener varias organizaciones. **Porqué:** la organización es la unidad
de datos —hogar, pareja, negocio, trabajo—, y una misma persona es parte de varias.

**Lo que esto mueve (hechos verificados en el repo):**
- `users.organizationId` es `notNull` y es 1 a 1 (`auth/schema.db.ts:22`). Hay que sacarlo de `users` y
  llevarlo a una tabla de membresías.
- `users.role` es un solo valor por usuario (`:23`). El rol pasa a ser **por membresía**.
- El JWT carga un único `organizationId` (`shared/lib/auth.ts`, callback `jwt`) y el aislamiento
  multi-tenant se apoya en eso. Pasa a ser la **organización activa** de la sesión.
- `profiles` es por usuario (`userId` como clave primaria), así que moneda, zona horaria y tema no se
  duplican por organización.
- **No existe en producción ningún camino que cree una organización**: sólo el seed y los tests
  insertan en `organizations`. Un usuario que cree organizaciones propias exige también el
  aprovisionamiento de su plan de cuentas y su hoja `General`, que hoy sólo vive en el seed.

## Ronda 2 — derivados de #7 (sin responder)

Todos aprobados el 2026-10-06 (resuelto).

| # | Supuesto derivado |
|---|---|
| R2-1 | El rol vive en la **membresía**: `owner` o `member` por organización. `users.role` deja de ser fuente |
| R2-2 | Tu Google crea tu usuario y tu membresía `owner` en la organización existente, que se renombra y se vacía de datos demo |
| R2-3 | Quitar a alguien borra su **membresía** de esa organización; su usuario y sus otras organizaciones siguen. «Único `owner`» se evalúa por organización |
| R2-4 | La sesión lleva una **organización activa**; todo el aislamiento sigue colgando de ella |
| R2-5 | Las invitaciones son **por organización**. Si el invitado ya tiene usuario, se le suma una membresía sin crear otro usuario |
| R2-6 | Ninguna organización ve datos de otra, y no hay vista consolidada entre organizaciones en este corte |
| R2-7 | Cambio de organización activa con un selector en el encabezado; la «Miembros» de `/settings` administra la organización activa |
| R2-8 | Al volver a entrar se abre la última organización usada; con invitación nueva, aterriza en la invitada |
| R2-9 | Cualquier usuario ya autorizado puede **crear organizaciones nuevas** y queda como `owner`; sin invitación previa nadie crea la primera |
| R2-10 | Una organización nueva nace con el plan de cuentas estándar y la hoja `General`; ese aprovisionamiento se extrae del seed |
| R2-11 | Quedan fuera: eliminar, transferir o renombrar organizaciones desde la interfaz |
