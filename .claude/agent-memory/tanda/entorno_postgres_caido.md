---
name: entorno-postgres-caido
description: Postgres apagado se disfraza de bug de login (AggregateError + 401) y de suite roja; siempre chequear el contenedor antes de investigar código
metadata:
  type: project
---

**Antes de investigar cualquier fallo de login, de datos o de tests, chequear que el contenedor
`postgres-dev` esté vivo:** `podman ps -a --format "{{.Names}}\t{{.Status}}"`. Se levanta con
`podman start postgres-dev`.

**Why:** el 2026-09-08 el usuario trajo un log de `pnpm dev` con
`ERROR: No se pudo consultar el estado de bloqueo de login. { error: 'AggregateError' }` seguido de
`POST /api/auth/callback/credentials 401`. Parecía un bug de auth y era el contenedor apagado hacía
33 horas. `AggregateError` es lo que tira `postgres-js` cuando no conecta a ninguna dirección
resuelta, y el 401 posterior no es contraseña incorrecta: sin base tampoco se lee el usuario.

**El mensaje engañoso es deliberado y está documentado en el código**
(`src/features/auth/services/loginAttemptService.ts:70-73`): ante error de base, `verificarBloqueo`
devuelve `{bloqueado: false}` en vez de propagar, porque responder "bloqueado" convertiría una caída
de infraestructura en un mensaje de cuenta bloqueada. **El log de error es la única señal.**

**How to apply:** es la misma trampa que la ficha ya anota para `pnpm test` (`ECONNREFUSED` en el
setup = entorno caído, no suite roja), pero por la vía del navegador. Levantar el contenedor es
corrección puntual, no plan. Después de levantarlo, verificar con
`podman exec postgres-dev psql -U postgres -d finanzas_db -c "select email from users limit 5;"`
(debe estar `admin@ejemplo.com`) y que `login_attempts` no tenga bloqueos acumulados — aunque los
fallos ocurridos con la base caída no se registran, por la misma razón.
