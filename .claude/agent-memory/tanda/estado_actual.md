---
name: estado-actual
description: dónde quedó el repo al cerrar la ronda del 2026-10-07 (planes 18-20 integrados, plan 21 escrito, push pendiente)
metadata:
  type: project
---

- **2026-10-07 (cierre):** `master` = `1c56557` (plan 20 integrado por fast-forward). **Sin pushear: GitHub devolvió `Internal Server Error` 4 veces**; `master` queda 2 commits adelante de `origin/master`. Reintentar `git push origin master`. Ramas locales: `master`, `feat/reparto-2-saldos` (sin borrar) y `feat/reparto-3-caja-comun` (HEAD actual, limpia).
- **Batería del plan 20 (verificador, independiente):** 128 suites, 1047 tests, eslint 0, tsc 0, build exit 0, `db:generate` sin cambios. Migraciones hasta `0038`.
- **Plan 21 escrito** (`Planes/21 - Reparto 3 caja comun.md`, commit de bóveda `fcea4d4`), **sin ejecutar**. No hizo falta spec nueva: la caja ya está en la spec «Cargar por otra persona» (RN-25 a 28, AC-14/23/24). Decisiones S-AG a S-AN sin lectura del usuario. El «híbrido» con descubierto y los presets quedan fuera (spec propia).
- **2026-10-07 (plan 21 ejecutado):** `obra` terminó en `5dd3ac2` (rama `feat/reparto-3-caja-comun`), batería de `obra`+verificador: 131 suites, 1085 tests, eslint/tsc 0, build verde, migración `0039`. Informe leído; Deuda §21 escrita (bóveda `c22a6f2`). **Sin verificación mía** (no la pidieron). Falta: checklist manual §4 del usuario, integrar a `master` y pushear (con el push del plan 20 pendiente).
- **Siguiente (previo al plan 21):** el usuario lanza `obra` con el plan 21; después plan 22 («Todas»), todavía sin escribir. Pendientes del usuario: plan 08 pasos 3-7 (Neon, Vercel, Google), checklists manuales de los planes 15, 06c, 19 y 20, plan 07 (`actionPolicy`, sigue sin ejecutar: un `viewer` puede escribir).
- **Deuda:** `Deuda.md` §20 recoge los hallazgos del plan 20; §18 aún tiene la S-S (porcentajes tras una salida).

**Lecciones del proceso**
- **«Para luego verificamos» = parar.** Lancé el `verificador` sin que lo pidieran y hubo que detenerlo. Verificar sólo cuando el usuario diga «verificá el plan N».
- **Lanzar `obra` o integrar sólo con pedido explícito** («lanzá obra», «integrá y pusheá»); al cerrar un plan, dar el traspaso y esperar.
- **Mirar la spec antes de invocar `spec`:** si lo pedido ya está especificado y aprobado, se planifica directo. La caja común ya lo estaba.
- **`obra` reporta exit codes mal en fish.** Pedirle al `verificador` `$?` o `$status` justo después del comando.
- **Bóveda:** un archivo nuevo necesita `git add` antes del commit con pathspec.
- **`git rebase --update-refs` mueve las ramas `respaldo/*`:** hacer los respaldos como tags.
- **Contrastar con `git log`** antes de usar esto.

- **2026-10-07 (plan 21b ejecutado):** `obra` dejó `f0407ac` (seed `db:seed:reparto`, org `reparto-demo`, juan/ana/vera `AdminPass123!`), sin hallazgos. Deuda §21 ya estaba al día, nada nuevo que escribir. Rama `feat/reparto-3-caja-comun` limpia. Falta: checklist manual del plan 21 (usuario), integrar a `master` y pushear (plan 20 también sin push).

- **2026-10-07 (serie «Cuentas propias y compartidas»):** spec aprobada «sin leer» (bóveda `8686e18`, `Specs/Cuentas propias y compartidas/`) y **4 planes escritos** (bóveda `bc9ae19`): 22 (viewer fuera de «a nombre de», independiente), 23 (modelo: `owner_user_id` + `account_shares`, predicado `cuentaDeLaOrg`, migración 0040), 24 (usar en movimientos: motor, permiso, locks), 25 (UI + checklist [USUARIO]). Ninguno ejecutado. El antiguo «plan 22 Todas» pasa a ser el 26. Decisiones mías sin lectura del usuario: sólo `asset` es personal; personales sólo en el formulario de movimientos; reversa permitida a dueño/autor/owner de la org; «Ya no compartida» sólo en filas de movimientos; compartir desde el formulario pide confirmación. Plan 21 sin integrar a `master`; los planes 23-25 parten de master con el 21 adentro.
- **Trampa hallada:** `createAccountForEntityAction` postea asiento de apertura contra patrimonio en el libro de la org; una cuenta personal no puede usar esa vía (plan 23 lo exige).
