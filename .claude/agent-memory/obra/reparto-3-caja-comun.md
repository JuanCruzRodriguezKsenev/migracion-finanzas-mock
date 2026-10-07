---
name: reparto-3-caja-comun
description: Plan 21 caja común: plan bien especificado, sin consultas; desvíos mínimos, trampas de z.input, barrel de schema y candados
metadata:
  type: project
---

Plan 21 ejecutado hasta el §4 en `feat/reparto-3-caja-comun` (commit `5dd3ac2`), sin consultas al usuario: el plan coincidió con el código en todo lo verificable (era el más detallado hasta ahora; `tanda` puede seguir con ese nivel).

**Dónde se quedó corto (mínimo):**
- `VistaCaja` necesitó `yoId` para precargar el selector del owner.
- `guardarAcuerdoSchema` con `.default([])`: `z.infer` vuelve el campo obligatorio y rompe llamadas/tests viejos; se exportó el tipo con `z.input`.
- Las plantillas del AcuerdoPanel (`trabajo` pone `usaCaja = true`) chocan con la nueva exigencia de cuenta: se resolvió con `usaCajaEfectiva = usaCaja && hayMarcables` y guardado deshabilitado sin cuentas.
- Realinear columnas del bloque `CONSULTAS` de `testFixtures.ts` cuando entra una clave más larga (estilo de columnas).

**Trampas:**
- Los esquemas de drizzle se importan por el barrel `@/shared/db/schema` (ya re-exporta `splits/schema.db`); `organizationRepository` está en `features/auth/repositories`, no en `organizations`.
- Los JSON de diccionarios se pueden editar con python `json.dumps(indent=2, ensure_ascii=False)+"\n"`: reproduce byte a byte el archivo original.
- Mutación útil: quitar `cajaRepository.bloquear` y comprobar que el test `Promise.all` de retiros simultáneos falla.
- Apareció `.claude/agent-memory/tanda/estado_actual.md` modificado por otra sesión durante la ejecución: no commitearlo, `git add` explícito por rutas (`drizzle src`).

**Why / How to apply:** en planes de este módulo `splits` no hace falta consultar; verificar siempre `git status` antes de `git add` y no usar `git add -A`.
