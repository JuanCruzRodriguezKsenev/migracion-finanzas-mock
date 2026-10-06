# Plan — Acceso 3/5: entrar con Google, las invitaciones y el arranque

**Rama:** `feat/acceso-3-google` (sale de la punta de `feat/acceso-2-membresias`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — implementa **RN-1 a RN-8**, **RN-19** y **RN-20**, la tabla de decisión completa, las secciones **Datos** (`googleSub`, `image`, `invitations`) y **NFR-3/NFR-4**. Cubre **AC-1** a **AC-6**, **AC-14**, **AC-16** y **AC-17**.
**Serie:** 0 → 1 → 2 `acceso-2-membresias-y-organizacion-activa` → **3 este** → 4 `acceso-4-miembros-y-selector` → 4b `acceso-4b-rol-de-solo-lectura` → 5 `acceso-5-despliegue-vercel-neon`.

No hay RFC y no hace falta: la spec aprobada es la fuente. **Precondición dura:** el plan 2 está mergeado y
verificado; sin `memberships` nada de esto tiene dónde apoyarse.

**Qué entrega al final:** vos podés crear una organización y una invitación `owner` desde la terminal, entrar con
tu Google y quedar adentro. **Todavía no hay pantalla para invitar a nadie más:** eso es el plan 4. El orden es
deliberado: éste es el que contiene todo el riesgo de seguridad, y se verifica solo.

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa acá |
| :--- | :--- | :--- |
| `authorize` en `auth.ts` | Verifica contraseña con costo constante: si el email no existe corre una verificación señuelo (`DUMMY_HASH`) y registra el fallo | **Se extiende** al usuario sin contraseña: mismo señuelo, mismo `return( null )` (RN-6, AC-14). No se duplica |
| `loginAttemptService` | Bloqueo por email e IP | **No se toca y no se llama** desde el flujo de Google (RN-7) |
| `userRepository.findByEmail` | Normaliza el email a minúsculas antes de consultar (`:34-47`) | Se reusa para RN-2.2 y RN-3: **la normalización ya existe, no se reescribe** |
| `userRepository.findIdentidadVigente` | Del plan 2: elige la organización activa | El flujo de Google la llama para dejar `organizationId` y `role` en el token |
| `organizationProvisioningService` | Del plan 1 | Lo usa el script de arranque para crear la organización |
| `env.ts` / `obtenerEnv()` | Zod, lazy, `optional()` para lo no obligatorio | Se agregan dos variables opcionales |
| `SessionProvider` | Ya envuelve `[lang]/layout.tsx:105` | Sin cambios |

**Hecho de `profiles` verificado:** todas sus columnas `notNull` tienen `default` (`profile/schema.db.ts:11-30`).
Un usuario nuevo se puede dar de alta con `insert( profiles ).values( { userId } )` y nada más. Quien lea el
perfil (`profileRepository.findByUserId`, `:27`) devuelve `null` si no hay fila, así que **hay que crearla** al
crear el usuario.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/auth/schema.db.ts` | `users`: `googleSub` (único, nullable), `image` (nullable), `passwordHash` y `salt` **pasan a nullable**, `CHECK` de coherencia. Tabla `invitations` |
| `drizzle/migrations/0032_*.sql` | Una migración generada (`pnpm db:generate`) |
| `src/features/auth/repositories/userRepository.ts` | `findByGoogleSub`, `createFromGoogle`, `linkGoogle`, `updateProfileFromGoogle`; `User.passwordHash` y `.salt` pasan a `string \| null` |
| `src/features/auth/repositories/invitationRepository.ts` | **Nuevo** |
| `src/features/auth/services/googleSignInService.ts` | **Nuevo.** Implementa RN-1 a RN-5 y la tabla de decisión |
| `src/shared/lib/auth.ts` | Proveedor Google condicional; callback `signIn`; `authorize` tolera `passwordHash` nulo; `pages.error` |
| `src/shared/lib/env.ts` | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, opcionales, **ambas o ninguna** |
| `src/features/auth/components/SignInForm.tsx` · `Signin.module.css` · `src/app/[lang]/auth/signin/page.tsx` | Botón de Google, separador, mensajes de error |
| `src/shared/ui/display/Icons/Icons.tsx` | `IconGoogle` |
| `src/dictionaries/es.json` · `en.json` · `br.json` | Claves nuevas en `signin` (NFR-3) |
| `src/shared/db/bootstrap.ts` | **Nuevo.** Script de arranque (RN-19) |
| `package.json` | Script `db:bootstrap` |
| `.env.example` | Las dos variables, comentadas |
| `src/shared/db/testCleanup.ts` | `invitations` entra **antes** de `users` y de `organizations` |
| `docs/trabajo-en-vuelo.md` | Rama y próximo paso, **en el mismo commit** |

**Quién más lee `users.passwordHash` / `users.salt`:** `authorize` (`auth.ts`) y `updatePasswordHash`
(`userRepository.ts`); el seed los escribe. `grep -rn "passwordHash\|\.salt\b" src/ | grep -v test` antes de
empezar: si aparece otro lector, **el tipo nullable lo va a marcar** en `tsc`.

---

## 2. Pasos

### Paso 1 — Esquema

- `users`: `googleSub` `varchar(255)` **único**, nullable. `image` `text`, nullable. `passwordHash` y `salt` sin
  `.notNull()`.
- **Coherencia (Datos de la spec):** `CHECK ( password_hash IS NOT NULL OR google_sub IS NOT NULL )`. Un usuario
  sin ninguna forma de entrar no debe poder existir. `hash_params` no se toca (ya es nullable).
- `invitations`: `id` uuid; `organizationId` (→ `organizations`, `cascade`); `email` `varchar(255)` normalizado;
  `role` (`'owner' | 'member' | 'viewer'`); `invitedBy` uuid → `users`, **`onDelete: "set null"` y nullable** (la primera
  invitación la crea el script de arranque, no un usuario); `status` (`'pending' | 'accepted' | 'revoked'`);
  `expiresAt`; `createdAt`; `acceptedAt` nullable.
- **Única vigente por `(organizationId, email)`:** índice único **parcial** `WHERE status = 'pending'`
  (`uniqueIndex(...).on(...).where(sql\`...\`)`). Un `pending` vencido seguiría estorbando: por eso `invitar`
  (plan 4) marca como `revoked` los vencidos de ese par antes de insertar. Dejar el comentario en el esquema.
- `pnpm db:generate` → **0032**. Aplicar con `pnpm db:migrate`.

### Paso 2 — El servicio que decide quién entra

`googleSignInService.resolverIdentidadGoogle( { sub , email , emailVerificado , nombre , imagen } )` →
`Result` con `{ userId }` o un motivo (`"no_verificado" | "sin_acceso"`). **Una sola transacción**
(`db.transaction`): la creación del usuario, sus membresías y el marcado de las invitaciones son atómicos (NFR-2).
Orden de evaluación **idéntico al de RN-2**, y es lo que la tabla de decisión de la spec comprueba:

1. `emailVerificado` falso → `"no_verificado"` (fila 1).
2. `findByGoogleSub( sub )` → es ese usuario (fila 2).
3. Si no: `findByEmail( email )`. Si existe **y su `googleSub` es nulo** → `linkGoogle` y es ese usuario (fila 3).
   **Si existe y su `googleSub` ya es otro distinto → `"sin_acceso"`:** ese email pertenece a otra cuenta de
   Google. **Este caso no estaba en la spec;** se resuelve por el lado seguro y se reporta como hallazgo.
4. Si no hay usuario: `findVigentesPorEmail( email )` (pendientes y con `expiresAt` futuro). Si hay al menos una →
   crear usuario (`createFromGoogle`, con `googleSub`, `image`, `name`, **sin contraseña**) y su fila de
   `profiles` (sólo `userId`); si no → `"sin_acceso"` (fila 5).
5. **En los caminos 2, 3 y 4:** aceptar **todas** las invitaciones vigentes del email (RN-4): por cada una,
   `INSERT memberships … ON CONFLICT DO NOTHING` y `status = 'accepted'`, `acceptedAt = now()`. Si el usuario no
   tenía `lastOrganizationId`, fijarlo en la primera organización aceptada (RN-14).
6. Actualizar `name` e `image` desde Google (RN-8). **No** tocar `profiles`.
7. Si después de todo el usuario **no tiene ninguna membresía** → `"sin_acceso"` (fila 6, RN-5).
   Esto hace que el rollback de la transacción deshaga un usuario creado en el camino 4 sin membresías; no puede
   ocurrir por 4 (exige invitación), pero la guarda es lo que protege a 2 y 3.

**Normalización:** `trim().toLowerCase()`, la misma de `findByEmail`. Extraerla a una función exportada si la
necesitan dos módulos (invitaciones y este servicio); no copiarla.

### Paso 3 — `auth.ts`

- **Proveedor:** `GoogleProvider( { clientId , clientSecret } )` (`next-auth/providers/google`) **sólo si**
  `obtenerEnv()` trae las dos variables (RN-20). Se arma el arreglo de `providers` condicionalmente.
- **Callback `signIn( { user , account , profile } )`:** si `account?.provider !== "google"` → `return( true )` sin
  tocar nada (el flujo de contraseña no cambia). Si es Google: llamar al servicio con `sub = account.providerAccountId`,
  `email`, `emailVerificado = profile?.email_verified === true`, `nombre`, `imagen = profile?.picture`.
  - Rechazo → `return( false )`.
  - Éxito → `findIdentidadVigente( userId )` y **asignar sobre el objeto `user`**: `user.id`, `user.organizationId`,
    `user.role`. Es el mecanismo del callback `jwt`: la rama `if( user )` ya copia esos tres campos al token
    (`auth.ts`, hoy `:193`). **Verificar con un test** que lo asignado en `signIn` llega a `jwt`; si no llegara
    en esta versión de next-auth, resolver la identidad dentro de `jwt` con `account`/`profile` y reportarlo.
- **`authorize` con usuario sin contraseña (RN-6, AC-14):** donde hoy llama `verifyPassword( … usuario.passwordHash … )`,
  si `passwordHash` o `salt` son `null`, ejecutar la **misma verificación señuelo** del camino «el email no existe»
  (`DUMMY_HASH` / `DUMMY_SALT` / `DUMMY_PARAMS`), `registrarFallo`, `return( null )`. Mismo costo, misma respuesta.
- **`pages.error: "/auth/signin"`:** next-auth v4 manda `AccessDenied` a la página de error, **no** a la de login
  aunque `pages.signIn` esté fijada. **No asumirlo: comprobarlo en el navegador** (§4) y, si el comportamiento
  difiere, ajustar acá.

### Paso 4 — Entorno

`env.ts`: dos `z.string().optional()` y un `.refine` que exija **ambas o ninguna** (mensaje claro). `.env.example`:
agregar las dos variables **comentadas**, con una línea que diga dónde se crean y la URI de redirección de
desarrollo (`http://localhost:3000/api/auth/callback/google`). **Ningún secreto al repositorio** (NFR-4):
verificar con `git diff` antes de commitear.

### Paso 5 — La pantalla de signin

- `page.tsx` calcula `googleHabilitado` en el servidor (`obtenerEnv()` con ambas variables) y se lo pasa al
  formulario. **El cliente no ve ni el id ni el secreto**, sólo un booleano.
- `SignInForm.tsx`: arriba del formulario, un botón «Continuar con Google» que llama
  `signIn( "google" , { callbackUrl: resolverDestino( … ) } )`, reusando `resolverDestino` que ya evita el redirector
  abierto. Después, un separador «o». Si `googleHabilitado` es falso, **ninguno de los dos** (AC-16).
- Estados: cargando (botón deshabilitado, «Conectando…»); error. Se lee `?error=` de `useSearchParams`:
  `AccessDenied` → «Tu cuenta no tiene acceso. Pedile a quien administra tu organización que te invite.»; **cualquier
  otro valor de la familia OAuth** (`OAuthCallback`, `OAuthSignin`, `Callback`…) → mensaje genérico de que no se pudo
  completar el ingreso con Google (A2). El mensaje no revela si la organización existe.
- `Button` ya existe en `shared/ui/display/Button`; el ícono va a `Icons.tsx`.
- **Estilo** (`.agents/AGENTS.md` §4): CSS Modules con tokens, `rem` y no `px` estructurales, **nada de movimiento ni
  cambio de dimensiones en `:hover`**. Leer ese §4 antes de escribir el CSS.
- **i18n (NFR-3):** claves nuevas bajo `signin` en los tres diccionarios, **a la vez**: `googleBtn`, `googleLoading`,
  `orSeparator`, `accessDenied`, `googleError`. Tipar `dict` en `SignInFormProps` con los campos nuevos.

### Paso 6 — El arranque (RN-19, AC-17)

Hay un huevo y una gallina: nadie es `owner` todavía, así que nadie puede invitar al primero. `src/shared/db/bootstrap.ts`,
con el patrón de `seed.ts` (`pnpm tsx`, `await import( "./client" )`), tres subcomandos:

| Subcomando | Qué hace | Guarda |
| :--- | :--- | :--- |
| `crear-organizacion --nombre "Casa"` | Dentro de **una transacción**: inserta la organización (`slug` derivado del nombre, único) y llama a `provisionarOrganizacion` | Falla si el `slug` ya existe |
| `invitar --org <slug> --email <e> --rol owner\|member\|viewer [--dias 7]` | Inserta la invitación (`invitedBy` nulo) | Normaliza el email; una vigente por par |
| `retirar-admin` | Elimina `admin@ejemplo.com` | **Se niega** si la organización de ese usuario no tiene **otro** `owner`. Es la protección que pide RN-19 |

Script en `package.json`: `"db:bootstrap": "pnpm tsx src/shared/db/bootstrap.ts"`. Los argumentos se validan con
Zod (nombre no vacío, email válido, rol válido); **no** abrir la base antes de validar.
Cada subcomando imprime qué hizo. El script es el **único** camino de arranque: no hay endpoint ni pantalla.

---

## 3. Tests

Integración contra la base real, `limpiarBase()` en `beforeEach`.

**`googleSignInService.test.ts`** — una prueba por **fila de la tabla de decisión** de la spec, con
`it.each` sobre `Esquema` de entradas:
| Fila | Caso | Esperado |
| :-: | :--- | :--- |
| 1 | email no verificado, con invitación vigente | `"no_verificado"`, **cero** usuarios creados (AC-3) |
| 2 | `sub` ya vinculado, con invitación pendiente a otra organización | entra, queda con las dos membresías (AC-9) |
| 3 | usuario con contraseña, mismo email, sin `sub` | se vincula el `sub`, **un solo** usuario (AC-5); el siguiente login lo encuentra por `sub` |
| 3b | usuario con **otro** `sub` y el mismo email | `"sin_acceso"` |
| 4 | sin usuario, con invitación vigente | crea usuario + membresía + fila de `profiles` (AC-1) |
| 5 | sin usuario ni invitación | `"sin_acceso"`, cero usuarios (AC-2) |
| 6 | usuario existente con **cero** membresías y sin invitación | `"sin_acceso"` |
| — | invitación vencida (`expiresAt` ayer) / `revoked` | `"sin_acceso"` (AC-4) |
| — | cambió el email en Google, mismo `sub` | entra al mismo usuario (AC-6) |
| — | email con mayúsculas y espacios | se resuelve igual |
| — | dos invitaciones vigentes del mismo email | se aceptan las dos |

**`auth.test.ts`:** `authorize` con usuario de Google (sin contraseña) → `null`, **y el tiempo de la respuesta no
delata** (no medir tiempos: verificar que se llamó `verifyPassword` con el señuelo, como hace el camino «email
inexistente»); la rama Google de `signIn` rechaza y acepta; lo asignado en `signIn` llega al token; **un login de
Google no incrementa `loginAttempts`** (RN-7).

**`env.test.ts`:** ambas variables o ninguna; sólo una → falla con mensaje.

**`bootstrap`:** extraer la lógica de cada subcomando a funciones exportadas y testear **las funciones**, no el
CLI: `crear-organizacion` deja la organización aprovisionada; `invitar` crea la invitación; **`retirar-admin` se
niega si no hay otro `owner` y procede si lo hay (AC-17)**.

**AC-16:** test del componente `SignInForm` con `googleHabilitado = false` → sin botón y sin separador (siguiendo
`testing_de_componentes_cliente`: `vi.hoisted`, diccionario real).

---

## 4. Verificación literal

```bash
git status --short                                       # limpio antes de empezar
pnpm db:migrate
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d users" -c "\d invitations"
pnpm test                                                # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
git grep -nE "GOCSPX|googleusercontent" -- . ':!.env.local'   # vacío: ningún secreto ni client id commiteado
```

**Checklist manual** (sólo se ve en el navegador, con credenciales reales; **las crea el usuario** en Google Cloud
Console antes: OAuth client «Web», URI `http://localhost:3000/api/auth/callback/google`, y las pega en `.env.local`):

1. Sin las variables, `/es/auth/signin` **no** muestra el botón ni el «o» (AC-16).
2. Con las variables: `pnpm db:bootstrap crear-organizacion --nombre "Prueba"` y
   `pnpm db:bootstrap invitar --org prueba --email <tu gmail> --rol owner`.
3. «Continuar con Google» con tu cuenta → entra a «Prueba» (AC-1, AC-17 en lo que toca al `owner`).
4. Con **otra** cuenta de Google sin invitación → vuelve al signin con «Tu cuenta no tiene acceso». **Comprobar
   que llega ahí y no a `/api/auth/error`** (§Paso 3, `pages.error`).
5. Cancelar en la pantalla de Google → vuelve con el mensaje genérico (A2).
6. `pnpm db:bootstrap retirar-admin` en la base de desarrollo: `admin@ejemplo.com` es el único `owner` de la
   organización demo, así que el comando **se niega y lo dice**. Es la negativa lo que se prueba acá; el caso que
   procede lo cubre el test (AC-17).
7. Entrar con `admin@ejemplo.com` y su contraseña sigue funcionando.

Pegar la salida cruda de los comandos; las capturas del checklist, descritas con lo que se vio.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Una pantalla o acción para invitar, revocar o quitar | Plan 4 |
| El selector de organización o crear organizaciones desde la interfaz | Plan 4 |
| Un adapter de next-auth (tablas `accounts`/`sessions` de NextAuth) | La sesión es JWT y la identidad es `googleSub` en `users`. Un adapter duplicaría el modelo |
| Vincular por email a un usuario que ya tiene **otro** `sub` | Caso 3b: se rechaza |
| «Olvidé mi contraseña» | Fuera de alcance de la spec |
| Cambiar `SESION_MAX_AGE_SEGUNDOS` ni la revalidación | NFR-1: la sesión sigue igual |

## 6. Reportá

Los **hallazgos** en lista aparte. Dos que ya se sabe que hay que decir: **(a)** el caso 3b que la spec no tenía;
**(b)** si `pages.error` hizo falta o no, y qué ruta recibió realmente el `AccessDenied`.
