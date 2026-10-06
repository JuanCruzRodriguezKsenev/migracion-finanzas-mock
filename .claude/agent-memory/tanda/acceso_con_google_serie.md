---
name: acceso-con-google-serie
description: Spec aprobada y cinco planes escritos (2026-10-06) para login con Google, varias organizaciones por persona e invitaciones; decisiones, hechos del repo que los ordenan y qué falta.
metadata:
  type: project
---

Spec: `docs/specs/acceso-con-google/spec.md` (aprobada «sin leer» por el usuario). Planes en `docs/planes/`:
`acceso-1-aprovisionamiento…` → `2-membresias…` → `3-google-e-invitaciones` → `4-miembros-y-selector` → `5-despliegue-vercel-neon`.
Cada uno sale de la punta del anterior; el **plan 0** (`fix-resumenes-mensuales`, §6 en adelante) sigue sin ejecutar y precede a todos. Commit `451d0b0`.

**Decisiones del usuario:** una persona puede estar en N organizaciones (casa/pareja/familia, o negocio/trabajo), rol por membresía;
sin registro abierto, sólo invitación; producción en **Vercel + Neon**. **Why:** quiere usarla con su novia desde el celular.

**Hechos del repo que ordenan el diseño (verificados):**
- 54 lecturas de `session.user.organizationId`: si la sesión conserva su forma, el plan 2 no las toca.
- Ningún camino de producción crea organizaciones (sólo seed/tests); `General` (.99) nace sobre demanda, no se aprovisiona; la equity `3.1.01.01` sí hay que crearla.
- La base de tests es `finanzas_db_test`, aparte de la de desarrollo.
- `ledger_transactions` no guarda autor.
- La base de desarrollo tiene 0 transacciones (seed fallido a medias), un solo usuario `admin@ejemplo.com` (owner).

**Decisiones mías, a vigilar:** caso 3b (email de usuario con otro `sub` → rechazo; no estaba en la spec); producción nace por `db:bootstrap`
en una Neon vacía (se apartó de R2-2: no hay organización existente que reusar); las invitaciones no avisan por correo (no hay Resend).
**How to apply:** si vuelve un informe de `obra` sobre alguno de los planes, contrastar con esos tres puntos primero.

**Actualización 2026-10-06 (tarde):** se sumó el rol `viewer` (contador, sólo lectura) a la spec y se escribió el plan `acceso-4b-rol-de-solo-lectura`
(guarda `obtenerSesionDeEscritura` que lee el rol de la base; registro `actionPolicy` fail-closed; 31 acciones de escritura, 15 de lectura, 2 exentas).
Spec de estadísticas aprobada en `docs/specs/estadisticas/` (falta su RFC en DRAFT). Hallazgos de código: `obtenerCuentaPorMoneda` exportada desde `"use server"`;
el dashboard y `derivarResumenDeMes` suman un solo lado del asiento, así que lo reversado hoy sí cuenta. Pendientes sin spec: presupuestos y metas.
