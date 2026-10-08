---
name: espacio-personal-29
description: Plan 29 espacio Personal y entidades propias: supuestos del plan que no coincidieron (rol viewer sin guardas, visibilidad de privadas), tipo circular en el esquema, seeds y tests viejos rotos
metadata:
  type: project
---

Plan 29 ejecutado en worktree `-personal`, rama `feat/espacio-personal`. Sin consultas posibles (subagente sin AskUserQuestion): lo dudoso fue al informe.

- **Supuesto falso del plan (§3.6.6, AC-8/A4):** "el viewer ya no escribe por el rol (plan 07)". El plan 07 **nunca se ejecutó** (no existe `actionPolicy`): `createFinancialEntityAction` no mira el rol y un viewer la ejecuta con éxito. Además un viewer del espacio **no ve** las cuentas privadas del dueño (`cuentaVisibleEn`, y el listado oculta saldo ajeno), así que "ve cuentas con saldos" no se cumple. No se tocó; hallazgo para `tanda`. Zona a especificar siempre: roles/guardas de escritura y visibilidad de personales.
- **Esquema circular:** `organizations -> users -> organizations` exige `(): AnyPgColumn => users.id`; la "referencia diferida" del plan sola da TS7022.
- **`slugLibre`** era privado en un archivo `"use server"`: hubo que moverlo a `auth/services/slugLibre.ts` (refactor mínimo para reusar, no duplicar).
- **Tests viejos que se rompen con Personal:** los que cuentan membresías al entrar con Google (2 -> 3), `findByUser` de un usuario que entra por Google (filtrar `esPersonal`) y los de `crearCuentaPersonalAction` desde una organización (ahora deben crear en Personal).
- **`seed.ts` borra catálogos de TODAS las organizaciones**: el Personal previo queda sin catálogo; se resolvió eliminándolo y recreándolo. Correr `db:seed` después de `db:seed:reparto` deja los Personal de juan/ana/vera sin catálogo (preexistente).
- **Formulario dentro de formulario:** el Modal de entidad va como hermano del `<form>` (fragmento), no adentro: el submit del interno burbujea por React al externo y crearía la cuenta antes de tiempo.
- `createAccountForEntityAction` queda sin llamadores de producción (sólo tests); se dejó (la usa un test) y se informó.
- Regex con paréntesis en `getByLabelText` ("Saldo Inicial (Pesos)"): usar string con `{exact:false}`.
- Plan cumplió el resto: líneas del §2 coincidieron, mutaciones (a)-(d) fallaron donde debían.
