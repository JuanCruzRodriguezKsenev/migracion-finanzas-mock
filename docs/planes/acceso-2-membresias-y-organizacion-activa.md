# Plan — Acceso 2/5: membresías y organización activa en la sesión

**Rama:** `feat/acceso-2-membresias` (sale de la punta de `feat/acceso-1-aprovisionamiento`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — implementa **RN-5** (sin membresías no se entra), **RN-13** (verificación de la membresía en el servidor), **RN-14** (última organización usada), **RN-15** (revalidación con membresía) y **RN-16**; la migración de la sección **Datos**. Cubre **AC-8**, **AC-10** (la mitad de «pierde el acceso») y **AC-15**.
**Serie:** 0 → 1 `acceso-1-aprovisionamiento-de-organizacion` → **2 este** → 3 `acceso-3-google-e-invitaciones` → 4 `acceso-4-miembros-y-selector` → 5 `acceso-5-despliegue-vercel-neon`.

No hay RFC y no hace falta: es el modelo de pertenencia que la spec ya fija. **Es una refactorización que no
cambia lo que el usuario ve**: al terminar, el login por contraseña de `admin@ejemplo.com` anda igual, con una
sola organización. Lo que cambia es el suelo: la pertenencia pasa de una columna a una tabla.

---

## 0. Lo que hace barato este plan (verificado)

**La sesión conserva su forma.** `session.user.organizationId` y `session.user.role` siguen existiendo, ahora
con el significado «organización activa». Las 54 líneas que lo leen
(`grep -rn "session.user.organizationId" src/`; sólo `accountingActions.ts` concentra 19) **no se tocan**, ni
tampoco `proxy.ts:127` (`token.organizationId`) ni la guarda de `(main)/layout.tsx`. Si ese conteo cambia al
final, algo se desvió.

**Quién lee `users.organizationId` y `users.role` de verdad:** sólo `userRepository.ts:69-73`
(`findIdentidadVigente`), `authorize` en `auth.ts` a través del `User` que devuelve `findByEmail`, el seed y
cuatro tests (§1). Es todo el radio.

**Hecho de la base:** hay un único usuario, `admin@ejemplo.com`, con `role = 'owner'`
(`select email, role from users`, 2026-10-06). El mapeo del rol en el backfill no pierde nada.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/auth/schema.db.ts` | Tabla `memberships`; `users` gana `lastOrganizationId`; **al final** pierde `organizationId` y `role` (paso 5) |
| `drizzle/migrations/0029_*.sql` · `0030_*.sql` · `0031_*.sql` | Tres migraciones, **en ese orden** (paso 1) |
| `src/features/auth/repositories/userRepository.ts` | `findIdentidadVigente` cambia de forma y de firma; `User` pierde dos campos; método nuevo `registrarUltimaOrganizacion` |
| `src/features/auth/repositories/membershipRepository.ts` | **Nuevo**, mínimo: lo que este plan necesita |
| `src/shared/lib/auth.ts` | `authorize` resuelve la organización activa; el callback `jwt` gana la rama `trigger === "update"` y cambia la regla de la revalidación |
| `src/features/auth/types.ts` | Sin cambios de forma. Se revisa el comentario de `invalid` |
| `src/shared/db/testCleanup.ts` | `memberships` entra en el orden de borrado, **antes** de `users` |
| `src/shared/db/testFixtures.ts` | **Nuevo:** `crearUsuarioConMembresia()` |
| `src/shared/db/seed.ts` | El upsert de `users` pierde `organizationId` y `role`; se agrega la membresía `owner` |
| `userRepository.test.ts` · `auth.test.ts` · `resolveSubscriptionAction.test.ts` · `installmentPlansActions.test.ts` | Dejan de insertar `organizationId` y `role` en `users` (`grep -rn "insert( *users" src/`) |
| `docs/trabajo-en-vuelo.md` | Rama y próximo paso, **en el mismo commit** |

---

## 2. El cambio de regla que hay que decir en voz alta (contraste con el código)

`auth.ts`, callback `jwt`, hoy invalida la sesión si **la organización que la base le asigna al usuario no es
la del token**, y lo justifica: *«Reescribir el valor en silencio sería más permisivo: dejaría pasar un token
manipulado»*.

**La spec cambia esa regla a propósito (RN-15):** si el usuario perdió la organización activa pero **tiene
otras**, la sesión pasa a la usada más recientemente; sólo se invalida si no le queda ninguna. Es seguro porque:
(1) el JWT va firmado y cifrado, no es manipulable desde el cliente; (2) el reemplazo sólo apunta a una
membresía que la base confirma; (3) el caso «usuario o organización borrados» sigue invalidando.

**Reescribí ese comentario** para que diga lo nuevo. Un comentario que defiende la regla vieja sobre código que
hace la nueva es la peor forma de deuda.

---

## 3. Pasos

### Paso 1 — Esquema y migraciones (el orden importa)

La migración **no es reversible sin el backfill**, y retirar las columnas antes de llenar la tabla deja la base
sin saber quién es de quién. Tres migraciones, tres comandos, en este orden:

1. En `auth/schema.db.ts`: agregar `memberships` y `users.lastOrganizationId`. **No** tocar `organizationId`
   ni `role` todavía.
   - `memberships`: `userId` (→ `users`, `cascade`), `organizationId` (→ `organizations`, `cascade`),
     `role` `varchar(50)` default `"member"` (`'owner' | 'member'`), `createdAt` con zona horaria. **Clave única
     `(userId, organizationId)`**; mirar cómo declara `categoryAccounts` su unicidad compuesta
     (`accounting/schema.db.ts:76`, `uniqueIndex(...)`) y copiar esa forma. Índice por `organizationId`.
   - `lastOrganizationId`: `uuid` → `organizations`, **`onDelete: "set null"`**, nullable.
   `pnpm db:generate` → **0029**.
2. `pnpm exec drizzle-kit generate --custom --name=backfill_memberships` → **0030**, a mano, con el precedente
   de `0026_backfill_recurrence_pointers.sql`:
   ```sql
   INSERT INTO "memberships" ("user_id","organization_id","role")
   SELECT "id","organization_id", CASE WHEN "role" = 'owner' THEN 'owner' ELSE 'member' END FROM "users"
   ON CONFLICT DO NOTHING;--> statement-breakpoint
   UPDATE "users" SET "last_organization_id" = "organization_id";
   ```
3. Recién ahora, en el esquema, **sacar `organizationId` y `role` de `users`**. `pnpm db:generate` → **0031**.
   Antes de este paso el código del §3.2 y §3.3 ya no puede leerlas.

`pnpm db:migrate` sobre la base de desarrollo. **La base de tests aplica la cadena entera desde cero** en cada
corrida (`vitest.setup.ts`): el `INSERT … SELECT` sobre tablas vacías tiene que correr sin error.

### Paso 2 — Repositorios

**`userRepository.findIdentidadVigente( id , preferida? )`** — una sola consulta. Une `memberships` con
`organizations` (el `INNER JOIN` que hoy comprueba que la organización exista **se conserva**: es lo que detecta
una organización borrada) y con `users`, y elige **una** fila, en este orden de preferencia:
1. la membresía de la organización `preferida` si existe;
2. la de `users.lastOrganizationId`;
3. la más reciente (`memberships.createdAt` descendente).

Devuelve `{ id , organizationId , role }` —el rol es el de **esa membresía**—, o `null` si el usuario no existe
o no tiene ninguna. Es la función de **dos usos**: el login la llama sin `preferida`; la revalidación, con la
organización del token.

**`userRepository.registrarUltimaOrganizacion( userId , organizationId , tx? )`** — `UPDATE users SET
last_organization_id`. Se llama sólo cuando el cambio de organización fue verificado.

**`User`** (`typeof users.$inferSelect`) pierde `organizationId` y `role` solo, por el cambio de esquema.

**`membershipRepository`** — sólo `findByUser( userId )` (con el nombre de la organización, para el selector del
plan 4) y `findMembership( userId , organizationId )`. El resto (invitar, quitar, contar `owner`) es del plan 3.

### Paso 3 — `auth.ts`

- **`authorize`:** tras verificar la contraseña, llamar `findIdentidadVigente( usuario.id )`. Si devuelve `null`
  → `return( null )` (RN-5: sin membresías no se entra, **misma respuesta que una contraseña incorrecta**).
  Si no, devolver `{ id , email , name , organizationId: identidad.organizationId , role: identidad.role }`.
  La rama `user` del callback `jwt` queda como está.
- **Revalidación** (la rama `if( token.id && token.organizationId )`): llamar
  `findIdentidadVigente( token.id , token.organizationId )`.
  - `null` → invalidar, **igual que hoy**.
  - `identidad.organizationId !== token.organizationId` → **fallback (RN-15):** asignar la nueva organización y
    el rol al token, `logger.info` con las dos, y `registrarUltimaOrganizacion`.
  - igual → refrescar sólo `role` y `lastVerified`, **como hoy**.
- **Rama nueva `trigger === "update"`** (`jwt( {token , user , trigger , session} )`; next-auth `^4.24.14` la
  trae): si `session?.organizationId` es un string,
  `findIdentidadVigente( token.id , session.organizationId )`; **sólo si** el resultado existe **y** su
  `organizationId` es **exactamente** el pedido, se cambia el token (`organizationId`, `role`, `lastVerified`) y se
  llama `registrarUltimaOrganizacion`. En cualquier otro caso **se ignora el pedido** —el token queda intacto— y se
  `logger.warn`. **El `session` que llega es input del cliente: nunca se confía en él, sólo se usa para pedir.**
  Cubre AC-8. (La interfaz que llama a `update()` es del plan 4.)

### Paso 4 — Fixtures y tests

**`src/shared/db/testFixtures.ts`:** `crearUsuarioConMembresia( { organizationId , email , role? , … } )` →
inserta el usuario y su membresía y devuelve el usuario. Los cuatro tests que hoy insertan `users` lo usan (hay
cuatro llamadores: justifica el helper).

**Tests nuevos** (integración, base real, `limpiarBase()`):
- `userRepository`: la preferida gana sobre la última; sin preferida, gana la última; sin ninguna de las dos,
  la más reciente; usuario sin membresías → `null`; organización borrada → no aparece (**el INNER JOIN**).
- `auth.test.ts` (ya existe `ParametrosJwt`):
  - `update` a una organización **de la que es miembro** → el token cambia y `users.last_organization_id` se
    actualiza.
  - **AC-8:** `update` a una organización **ajena** → el token no cambia.
  - `update` con un `organizationId` que no es string (`undefined`, número, objeto) → no cambia.
  - **AC-10 (parte):** quitarle la membresía a la organización activa teniendo otra → en la siguiente
    revalidación el token pasa a la otra. Con `lastVerified` viejo para forzar la consulta.
  - Misma situación sin otra membresía → `token.invalid = true`.
  - Usuario sin membresías → `authorize` devuelve `null` (si `authorize` no es alcanzable con la estructura de
    `auth.test.ts`, cubrir `findIdentidadVigente` → `null` y reportarlo como hallazgo).
- `testCleanup.ts`: la suite existente de limpieza tiene que seguir en verde con `memberships` incluida.

**AC-15** lo cubren las suites de repositorio que ya filtran por `organizationId` más el caso 7 del plan 1; este
plan no agrega un test redundante.

### Paso 5 — Seed

El upsert de `users` pierde `organizationId` y `role`; después, `insert( memberships )` con `role: "owner"` y
`onConflictDoUpdate` sobre la clave compuesta (el seed es idempotente por diseño: mantiene los UUID entre
corridas), y `lastOrganizationId`. Sigue creando `admin@ejemplo.com`: se retira recién en el plan 3.

---

## 4. Verificación literal

```bash
git status --short                                         # limpio antes de empezar
grep -rn "session.user.organizationId" src --include='*.ts' --include='*.tsx' | wc -l   # anotar ANTES y comparar DESPUÉS: tiene que dar lo mismo
pnpm db:migrate
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d memberships"
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d users"      # sin organization_id ni role; con last_organization_id
pnpm test                                                   # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rnE "users\.(organizationId|role)" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'   # vacío
pnpm db:seed
pnpm dev   # y entrar con admin@ejemplo.com en /es/auth/signin: tiene que andar igual que antes
```

Checklist manual (sólo se ve en el navegador): login con `admin@ejemplo.com` / la contraseña del seed → cae en el
dashboard y `/accounts` muestra las cuentas. Pegar la salida cruda, no describirla.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| El selector de organización, la pantalla de miembros o `update()` desde el cliente | Plan 4 |
| Invitaciones, `googleSub`, el proveedor de Google | Plan 3 |
| Un método para quitar o invitar en `membershipRepository` | Plan 3 |
| Tocar alguna de las 54 lecturas de `session.user.organizationId` | La forma de la sesión no cambia; si hace falta tocarlas, el diseño se desvió |
| Cambiar de rol a nadie | Fuera de alcance de la spec |

## 6. Reportá

Los **hallazgos** en lista aparte. En particular: cualquier consumidor de `users.organizationId` o `users.role` que
este plan no nombró.
