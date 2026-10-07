---
name: estado-actual
description: estado al cierre de la sesión del 2026-10-06: nada corriendo; carriles A, C y D por verificar/integrar; 06b sin lanzar; contrastar con git log
metadata:
  type: project
---

**2026-10-06 tarde:** una sesión de `obra` murió a mitad del 06b. Verifiqué su WIP (627 tests, 80 suites, lint/tsc/build verdes) y lo commiteé: `070d1b9` (pasos 1-3 del 06b: repo, acciones, tests). Escribí el plan [[06c]] (`Planes/06c - Acceso 4c interfaz (continuación del 06b).md`: pasos 4-5 + tests de componentes) y el usuario pidió lanzar `obra` sobre él (corriendo en segundo plano). Al terminar: leer `Informes/06c…`, delegar batería a `verificador`. Ver [[feedback-lanzar-obra]]: sólo se lanza con pedido explícito.

- `master` = `cd86ad0` (planes 00-04, 09, 10). Sin pushear. Los tres carriles siguen sin integrar.
- **Carril A** (checkout principal): rama `feat/acceso-4-miembros-y-selector` (`e68cb33`) incluye plan 05 y 06. **Plan 06 verificado por `verificador`**: 78 suites, 601 tests, lint 0, tsc 0, build verde. Falta checklist manual del usuario (dos cuentas de Google; AC-7). Árbol limpio (memorias commiteadas en `adaabb9`). Server :3000: si se porta raro, reiniciar (el build comparte `.next/`).
- **Plan 06b** (abandonar/eliminar/renombrar/cambiar rol): escrito y ajustado a lo que dejó el 06 (`bloquearOwners` ya existe en `membershipRepository.ts:147`; `exigirOwner` en `organizations/services/exigirOwner.ts`). **Sin lanzar**: el usuario lo pedirá. Spec «Acceso con Google» rev. 2 (bóveda `565efc6`). El usuario quiere 06b **antes** de probar el acceso con Google.
- **Carril C** (`/home/jcrod/Dev/finanzas/migracion-finanzas-mock-presupuestos`, `feat/presupuestos-pagina` `e2deaf6`): planes 11 y 12 hechos (653 tests según obra). **Sin verificar por mí**: el usuario canceló los `verificador`. Checklist manual pendiente (:3002, admin@ejemplo.com).
- **Carril D** (`…-metas`, `feat/metas-pagina` `b3ceb97`): planes 13 y 14 hechos (647 tests según obra). Sin verificar por mí. Checklist manual pendiente; riesgo: barra móvil con 9 entradas a 360 px.
- **Carril B** (`…-estadisticas`): integrado; falta el checklist manual del 10 y medir `getReportsAction`.
- Sin escribir: planes 07 (viewer) y 08 (despliegue) ya existen sin ejecutar. No hay planes nuevos más allá del 14.

**Al integrar** (de a uno, fast-forward, lo hace tanda): migración `0032` repetida en A (`0032_orange_queen_noir`), C (`0032_melted_paladin`), D (`0032_sour_old_lace`); `ProgressBar` idéntica en C y D (verificar merge limpio); tablas nuevas de presupuestos y metas deben sumarse a `TABLAS_CON_ORGANIZACION` (plan 06b); `usePuedeEscribir` y `actionPolicy` los cierra el 07/4b.

**Trampas:** eliminar una organización no puede confiar en el cascade (FKs `RESTRICT`, borrar en el orden de `testCleanup.ts`); `postgres-dev` apagado frena al verificador (`podman start postgres-dev`).

**Ideas y deuda:** [[idea-cargar-por-otro]] (Deuda §16). Deuda abierta nueva hoy: §12b (acceso 4), §14 (presupuestos), §15 (metas).
