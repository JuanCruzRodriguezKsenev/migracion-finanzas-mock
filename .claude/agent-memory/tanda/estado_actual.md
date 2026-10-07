---
name: estado-actual
description: estado al 2026-10-06 (tarde): carriles A, C y D; spec rev. 2 y plan 06b escritos; contrastar con git log
metadata:
  type: project
---

- `master` = `cd86ad0` (planes 03, 04, 09, 10). Sin pushear.
- **Carril A** (checkout principal): plan 05 en `feat/acceso-3-google` ejecutado, sin verificar por `verificador` ni integrar. El usuario pidió **construir 06 + 06b antes de probar** el acceso con Google. **Plan 06 corriendo** (obra a27c87307a8b0ddef, rama `feat/acceso-4-miembros-y-selector`). Server :3000 recarga solo; no probar hasta que termine.
- **Plan 06b** escrito, **sin ejecutar y sin lanzar**: el usuario ordenó no lanzar más `obra` al terminar los actuales. Ver [[feedback-lanzar-obra]].
- **Carril C** (`feat/presupuestos-pagina`): planes 11 y 12 hechos (12 = `e2deaf6`, 653 tests según obra, sin verificar por mí). Checklist manual pendiente (:3002, admin@ejemplo.com). Hallazgos del 12 por enrutar: `minKey` omitido, `usePuedeEscribir` inexistente (lo cablea el 4b), deuda i18n de `Modal`.
- **Carril D** (`feat/metas-pagina`): plan 13 hecho; plan 14 corriendo (obra a828b5c2578fa8348).
- **Spec «Acceso con Google» rev. 2** (bóveda `565efc6`): abandonar, eliminar, renombrar, cambiar rol (RN-28..39, AC-24..34, NFR-6).
- Choques al integrar: migración `0032` (A, C, D) y `ProgressBar` (C lo construyó en shared/ui/display; D también). Tablas nuevas de presupuestos y metas deben sumarse a `TABLAS_CON_ORGANIZACION` (plan 06b).
- Trampa: eliminar una organización NO puede confiar en el cascade: hay FKs `RESTRICT` entre sus tablas (ledger_entries→accounts…); borrar en el orden de `testCleanup.ts`.
- `postgres-dev` apagado frena al `verificador`: `podman start postgres-dev`.
- Idea aparcada: [[idea-cargar-por-otro]] (Deuda §16).
