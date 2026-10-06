---
name: acceso-2-membresias
description: Lecciones del modelo de membresías en auth, orden de preferencia en resolución de identidad, fallback RN-15 y actualización de tests
metadata:
  type: reference
---

# Cierre del plan Acceso 2 — Membresías y organización activa

- **Secuencia de migración en tres fases:** La separación en tres migraciones (`0029` alta de tabla y `last_organization_id`, `0030` backfill custom con `INSERT ... SELECT` y `UPDATE`, `0031` drop de columnas `organization_id` y `role` en `users`) garantiza migrabilidad reversible sin pérdida de pertenencia, funcionando sin advertencias tanto en desarrollo como en la creación desde cero de `finanzas_db_test`.
- **Efecto de RN-15 sobre pruebas heredadas de sesión huérfana:** La prueba preexistente en `auth.test.ts` asumía que un token con un `organizationId` arbitrario inexistente debía invalidar la sesión directamente. Con la regla RN-15, si el usuario aún posee membresías legítimas en la base de datos, el callback `jwt` conmuta de forma segura a la membresía activa en vez de invalidarse. Para probar una sesión huérfana genuina que resulte en `invalid = true`, se debe eliminar la organización de la base de datos para dejar al usuario con 0 membresías activas.
- **Tipado estricto en tests sin `any`:** La configuración de ESLint del proyecto impone `@typescript-eslint/no-explicit-any` incluso en archivos `.test.ts`. Casteos auxiliares para métodos internos de proveedores (como `authorize` de `authOptions.providers[0]`) deben tiparse con `unknown` en lugar de `any`.
- **Helper `crearUsuarioConMembresia`:** Centralizar en `src/shared/db/testFixtures.ts` la creación conjunta de usuario y membresía inicial aisló a los tests de integración (`userRepository`, `auth`, `resolveSubscriptionAction`, `installmentPlansActions`) del cambio de esquema, manteniendo limpios los tests sin repetir inserciones manuales en `memberships`.
