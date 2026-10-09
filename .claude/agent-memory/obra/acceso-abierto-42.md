---
name: acceso-abierto-42
description: Plan 42 acceso abierto con Google sin invitación, espacio Personal por defecto y test de auth.ts
metadata:
  type: reference
---

# Lecciones del Plan 42 — Acceso abierto con Google sin invitación

- **Registro abierto a Personal (Revisión 3):** `resolverIdentidadGoogle` ya no rechaza ante ausencia de invitaciones ni ante usuario existente sin membresías. Siempre crea el usuario (si no existe) y ejecuta `asegurarEspacioPersonal( usuario.id , tx )` dentro de la transacción. `lastOrganizationId` se mantiene en `null` si no hay invitaciones aceptadas, dejando que `userRepository.findIdentidadVigente` seleccione el espacio Personal como organización activa.
- **Inventario de tests fuera de la feature (`auth.test.ts`):** Los planes que modifican políticas de denegación/admisión de autenticación no deben limitarse a los tests del servicio (`googleSignInService.test.ts`). `src/shared/lib/auth.test.ts` prueba directamente el callback `signIn` de NextAuth y contenía una aserción de rechazo (`toBe(false)`) ante usuarios de Google desconocidos. Al omitirse en el plan, provocó una discrepancia que requirió consulta al usuario (`ask_question`) para actualizar el test y validar AC-35 y AC-39.
- **Trampa de mutación de atomicidad (RN-40):** La mutación para probar la atomicidad de `asegurarEspacioPersonal` consiste en mover la llamada **después** del bloque `db.transaction`. Si se intenta pasar `db` en lugar de `tx` dentro del mismo bloque de transacción, se produce contención de bloqueos (*lock contention*) y *timeout* en el pool de conexiones de Postgres.
- **Servicio Postgres local:** Las suites de integración y limpieza (`limpiarBase`) requieren el contenedor `postgres-dev` activo en Podman. Si está detenido (`Exited`), los tests fallan inmediatamente con `ECONNREFUSED 127.0.0.1:5432`.
