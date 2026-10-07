---
name: acceso-4-miembros
description: Plan 06 acceso 4 (miembros, selector, alta de organización): dónde el plan se quedó corto y trampas de tests de carrera y de componentes
metadata:
  type: reference
---

# Plan 06 — miembros y selector

- **El plan pedía `marcarVencidasComoRevocadas` y ya existía** como `invitationRepository.revocarVencidasPorEmailYOrganizacion` (plan 3). Antes de agregar un método de repositorio, grepear el nombre semántico: el plan listaba métodos que ya estaban. Tampoco hizo falta `countOwners`: `bloquearOwners` (SELECT FOR UPDATE) devuelve los ids y alcanza.
- **Test de carrera sin demora no prueba el lock.** Con `Promise.all` de dos `quitarMiembroAction` pasaba aun sin `FOR UPDATE` (las transacciones no se solapaban). Hay que espiar `bloquearOwners` y demorar 150 ms tras la lectura; verificado quitando el `.for("update")` (falla) y restaurándolo (pasa).
- **Revalidar al dueño dentro de la transacción:** tras esperar el bloqueo, quien llama pudo perder el rol; se comprueba `owners.includes(solicitanteId)`.
- **Layering:** `Navbar`/`AppShell` son `shared/ui`; el selector (feature) se arma en `(main)/layout.tsx` y baja como `selector: ReactNode`, no importándolo desde shared.
- **Tests de componentes con `useSession`:** el setup global NO mockea `next-auth/react`; mockear `useSession` local con `vi.hoisted`. `routerMock` global no es importable: mockear `next/navigation` local.
- **`generarSlug`** se reusa de `src/shared/db/bootstrap.ts` (script CLI, guardado por `process.argv`); funciona pero mete un módulo de script en el bundle de una server action. Hallazgo para tanda.
- **Checklist manual con Google no es ejecutable por obra** (sin cuentas): queda para el usuario. AC-7 sin probar en navegador.
