---
name: acceso-3-google
description: Lecciones de autenticación federada Google, invitaciones atómicas, NextAuth v4 quirks y verificación señuelo
metadata:
  type: reference
---

# Cierre del plan Acceso 3 — Entrar con Google, invitaciones y arranque

- **NextAuth v4 CredentialsProvider options.authorize:** Al invocar directamente un proveedor de credenciales en pruebas unitarias, `provider.authorize` ejecuta un stub `() => null`. La función implementada vive en `(provider as { options: { authorize: ... } }).options.authorize`.
- **ES Module Spying y objeto contenedor `authService`:** Para espiar llamadas a `verifyPassword` en `auth.ts` desde `auth.test.ts`, un import nombrado directo de función no es interceptable por `vi.spyOn`. Centralizar las funciones en el objeto `authService` y consumirlas mediante `authService.verifyPassword` permite espías limpios sin romper el encapsulamiento.
- **Rutas de test en `vitest.config.ts`:** Las pruebas dentro de `src/shared/` requieren ubicarse en `src/shared/lib/**/*.test.ts` (o `services`/`ui`) para ser descubiertas por Vitest. Pruebas de utilidades compartidas como `bootstrap` deben vivir en `src/shared/lib/bootstrap.test.ts`.
- **Redirección de errores OAuth en NextAuth v4:** NextAuth v4 no redirige las fallas de `signIn` (`return false` o `AccessDenied`) a `pages.signIn`, sino a `pages.error`. Es mandatorio configurar explícitamente `pages.error: "/auth/signin"` para que el usuario sea devuelto a la pantalla de login con `?error=AccessDenied`.
- **Caso 3b en resolución de identidades:** Si un email existe pero ya tiene un `googleSub` vinculado que difiere del provisto por Google, la resolución debe retornar `"sin_acceso"` de forma segura para impedir secuestro o colisión de cuentas.
