---
name: cuentas-4-ajuste-26
description: Plan 26 cuentas 4 (absorción, visibilidad con actor): retomado a mitad con código ya escrito; cómo cerrar, mutaciones y hallazgo de la reversa
metadata:
  type: project
---

Plan 26 se retomó con §3.1-3.7 ya escritos sin commitear (sesión previa) y el usuario listó lo que faltaba. Resultado: 1207 tests (1206 + prueba de reversa), commit `912e0ab`.

- **Retomar con árbol sucio:** leer plan + Estado, no re-implementar; hacer sólo la lista del usuario. Commitear con `git add -u -- src drizzle` + las dos migraciones nuevas, **dejando fuera** `.claude/agent-memory/**` ajenos (había memorias sin trackear del plan 27) y comitear la memoria aparte (`docs(memoria): …`).
- **Mutaciones sin git:** el código no estaba commiteado, así que `git checkout` no sirve para restaurar. Copiar los archivos al scratchpad antes, mutar con sed/python, restaurar con `cp` y verificar con `diff`.
- **Mutación (b)** (sin rama `compartida`) rompe 7 tests, no sólo AC-6: es normal, no un error de la mutación.
- **§3.4.6 reversa de absorbido:** `reverseLedgerTransaction` no toca `expense_splits`; no hizo falta código, sólo la prueba.
- **Hallazgo abierto:** el contra-asiento nace con `absorbed_by_holder = false` (default). Pasado a `tanda` en el informe.
- **Plan cumplió:** radio de impacto y líneas del §2 coincidieron; ninguna consulta necesaria. Zona que ya no necesita más detalle de `tanda`: permisos/visibilidad de cuentas personales.
- El shell del Bash tool no es fish para `${pipestatus}`; no confiar en `exit=` de pipes.
