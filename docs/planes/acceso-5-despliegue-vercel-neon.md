# Plan — Acceso 5/5: desplegar en Vercel con Neon y dejarla operativa

**Rama:** `feat/acceso-5-despliegue` (sale de la punta de `feat/acceso-4-miembros-y-selector`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — es la **Dependencia 2** (despliegue con HTTPS) y la que habilita **AC-17** sobre una base real. No agrega reglas nuevas.
**Serie:** 0 → 1 → 2 → 3 → 4 `acceso-4-miembros-y-selector` → **5 este**.
**Decisión del usuario (2026-10-06):** producción corre en **Vercel + Neon**. Se eligió sobre una PC con túnel, un VPS y «sólo local».

> **Este plan no lo ejecuta `obra` solo.** Mezcla **código chico** (que `obra` hace) con **pasos que sólo vos podés dar**
> —crear cuentas, pegar secretos, publicar la credencial de Google—, marcados **[USUARIO]**. Los pasos de código
> están en §2; los operativos, en §3. `obra` hace el §2 y se detiene antes del §3.

**Precondición dura:** los planes 1 a 4 están mergeados y verificados en local. Desplegar antes es desplegar sin
poder entrar.

---

## 0. Lo que el repo ya tiene para esto (verificado) y lo que no

| Hecho | Dónde | Consecuencia |
| :--- | :--- | :--- |
| `NEXTAUTH_SECRET` es **obligatorio en producción** y el módulo **lanza al importarse** si falta | `auth.ts:45-47` y `env.ts:15-26` | La app no arranca en Vercel sin esa variable; es una guarda, no un bug |
| `proxy.ts` ya borra las dos variantes de la cookie de sesión (`next-auth.session-token` y `__Secure-…`) | `proxy.ts:29-32` | Funciona bajo HTTPS; **hay que verificar** que `getToken` detecte el esquema seguro con `NEXTAUTH_URL` en `https://` (§Paso 5) |
| `postgres( connectionString , {max: 5} )`, **sin** `prepare: false` | `client.ts:26` | Contra el **pooler de Neon** (pgbouncer en modo transacción), las sentencias preparadas fallan de forma intermitente. **Es el cambio de código de este plan** |
| `drizzle.config.ts` toma `DATABASE_URL` de `.env.local` con `dotenv.config`, que **no pisa** una variable ya definida en el entorno | `drizzle.config.ts:11` | Se puede migrar contra Neon con `DATABASE_URL=… pnpm db:migrate` sin tocar `.env.local` |
| El seed **no** debe correr en producción: borra tablas y siembra datos demo | `seed.ts:43-56` | Producción arranca **sin demo**: la organización nace con `db:bootstrap` (plan 3) |
| `outbox_events` se llena y **nadie lo despacha** en producción (`db:outbox` es un script manual) | `package.json:16` | No afecta el uso; los eventos quedan `PENDING`. **Deuda declarada**, §6 |
| No hay `engines` en `package.json`; el CI corre Node 26 y pnpm 11.3.0 (`packageManager`) | `package.json:5`, `.github/workflows/compuerta.yml` | Vercel tiene que usar una versión de Node compatible: se mide en el §Paso 3 |
| `reactCompiler: true`, sin `output` ni `vercel.json` | `next.config.ts` | Despliegue por defecto de Next.js; nada que configurar |

**Qué NO hace falta:** ningún usuario con contraseña en producción. Todo ingreso es por Google. Eso vuelve
irrelevante el costo del `scrypt` (~128 MB por verificación, `authService.ts`) **salvo en un caso**: el camino
«email inexistente» de `authorize` corre una verificación señuelo con ese mismo costo ante cada intento por
contraseña. Es lo que hay que **medir** en Vercel (§Paso 7), no suponer.

---

## 1. Radio de impacto (el código)

| Archivo | Qué hacer |
| :--- | :--- |
| `src/shared/db/client.ts` | `prepare: false` cuando la URL apunta al pooler; extraer las opciones a una función pura |
| `src/shared/db/connectionOptions.ts` | **Nuevo.** `opcionesDeConexion( url )` → `{ max , prepare }` |
| `src/shared/db/connectionOptions.test.ts` | **Nuevo** |
| `.env.example` | Documentar las variables de producción |
| `docs/DEPLOY.md` | **Nuevo.** El procedimiento operativo del §3, para que no viva en una conversación |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado y las deudas del §6 |

`client.ts` lo importan todos los repositorios; **el cambio no altera la firma de `db`** (`export const db`,
`DBOrTx`). Contra la base local el comportamiento debe quedar idéntico.

---

## 2. Pasos de código (`obra`)

### Paso 1 — Conexión compatible con el pooler de Neon

`opcionesDeConexion( url: string ): { max: number ; prepare: boolean }`:
- Si el **host** de la URL contiene `-pooler` (así nombra Neon al endpoint con pgbouncer) → `prepare: false`.
  Contra una URL local o contra el endpoint directo (sin `-pooler`) → `prepare: true` (el default de postgres-js).
- `max`: **5** como hoy. **No** cambiarlo por intuición: es un valor a medir en el §Paso 7.
- Parsear con `new URL( url )`; ante una URL no parseable, devolver los defaults (la validación de la URL ya la
  hace `env.ts`, no duplicarla acá).

`client.ts` usa la función: `postgres( connectionString , opcionesDeConexion( connectionString ) )`.

**Test:** URL local → `prepare: true`; URL de Neon directa → `true`; URL con `-pooler` → `false`; URL con
`?sslmode=require` y contraseña con caracteres especiales no rompe el parseo; URL inválida → defaults.

### Paso 2 — Variables y procedimiento

`.env.example`: agregar, comentadas, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` si el plan 3 no lo hizo, y una nota
de que en producción `DATABASE_URL` es la URL **con pooler** de Neon y `NEXTAUTH_URL` es `https://<dominio>`.
`docs/DEPLOY.md`: escribir el §3 de este plan, adaptado, **sin ningún secreto**. Registrar en el mapa de docs de
`.claude/CLAUDE.md` una fila para `docs/DEPLOY.md` y otra para `docs/specs/`.

---

## 3. Pasos operativos ([USUARIO], con `obra` o `tanda` al lado)

### Paso 3 — Neon [USUARIO]

1. Crear proyecto en Neon. **Región:** la más cercana a Argentina que ofrezca (São Paulo, `aws-sa-east-1`, si está
   disponible); anotarla, porque la de Vercel tiene que coincidir.
2. Copiar **dos** cadenas: la **directa** (para migrar) y la **con pooler** (para la aplicación).
3. **Migrar el esquema contra Neon**, con la cadena **directa** (el pooler no se lleva bien con migraciones):
   ```bash
   DATABASE_URL='<cadena directa>' pnpm db:migrate
   ```
   **No** correr `pnpm db:seed` contra Neon.
4. Comprobar: `psql '<cadena directa>' -c "\dt"` lista las tablas, incluidas `memberships` e `invitations`, y
   `select count(*) from users` da 0.

### Paso 4 — Vercel [USUARIO]

1. Importar el repositorio de GitHub (por HTTPS, ya autenticado con `gh`; **no** SSH, ver `~/.claude/CLAUDE.md`).
2. **Framework:** Next.js (se detecta). **Región de las funciones:** la misma que la de Neon (`gru1` si es
   São Paulo). **Node:** el que use el CI; si Vercel no lo ofrece, fijar el más alto disponible y agregar
   `engines` a `package.json` (hallazgo a reportar).
3. Variables de entorno de **Production**:

   | Variable | Valor |
   | :--- | :--- |
   | `DATABASE_URL` | la cadena **con pooler** |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` (uno **distinto** al de desarrollo) |
   | `NEXTAUTH_URL` | `https://<el dominio que te dé Vercel>` |
   | `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | los del §Paso 5 |

4. Desplegar. La primera vez **va a fallar el login con Google** hasta completar el §Paso 5: es esperable.

### Paso 5 — Credencial de Google [USUARIO]

En Google Cloud Console → el cliente OAuth «Web» del plan 3:
1. **Agregar la URI de redirección** `https://<dominio>/api/auth/callback/google` (la de `localhost` se conserva).
2. **Pantalla de consentimiento:** si está en **«Testing»**, sólo entran las cuentas listadas como usuarios de
   prueba (ella tendría que estar ahí). **Publicarla («In production»)** evita ese límite y no exige verificación
   porque los permisos son los básicos (`openid`, `email`, `profile`). Recomendado: publicar.
3. Guardar y esperar unos minutos: Google propaga los cambios con demora.

### Paso 6 — Arranque de la organización real [USUARIO + `obra`]

Con la cadena **directa** de Neon (el script abre pocas conexiones y no necesita pooler):

```bash
DATABASE_URL='<cadena directa>' pnpm db:bootstrap crear-organizacion --nombre "Casa"
DATABASE_URL='<cadena directa>' pnpm db:bootstrap invitar --org casa --email <tu gmail> --rol owner
```

Entrar a `https://<dominio>` con «Continuar con Google» **con esa cuenta**. Ya sos `owner` de «Casa». Después:
Configuración → Miembros → invitar el Gmail de ella (plan 4). **La base de producción nace vacía de datos demo**; la
organización tiene el catálogo de categorías y la cuenta de Patrimonio Neto, nada más.

> **Cambio respecto de lo que dice el supuesto R2-2 de la spec** (que habla de reusar la organización existente):
> en producción **no hay una existente**, porque Neon arranca de cero y el seed no corre. La organización nace del
> script. Es un detalle de arranque, no una regla nueva; y la base **local** conserva su organización demo para
> desarrollo. **Los datos que ya tengas en la base local no se migran:** si querés llevarlos, es un pedido aparte.

### Paso 7 — Verificación y mediciones en producción [USUARIO + `obra`]

El checklist del §4. Además, **tres mediciones** (hechos que sólo se ven desplegado; no se suponen):

| # | Medir | Cómo | Qué decide |
| :-: | :--- | :--- | :--- |
| M-1 | Que `AccessDenied` aterriza en `/es/auth/signin?error=AccessDenied` y no en una página de error de next-auth | Entrar con una cuenta de Google **sin invitación** | Si no: el `pages.error` del plan 3 no alcanza en producción; reportarlo |
| M-2 | Latencia de una carga de `/accounts` y de un alta de movimiento | Pestaña Red del navegador, tres mediciones | Si > 2 s sostenidos: revisar que Vercel y Neon estén en la misma región antes de tocar código |
| M-3 | Que un intento por contraseña con un email inexistente **no** devuelve error 500/timeout | Usar el formulario de email en producción con un email cualquiera | Si falla por memoria (el `scrypt` señuelo reserva ~128 MB): subir la memoria de la función o bajar `PARAMS_ACTUALES.N`, **decisión del usuario** (el comentario de `authService.ts` documenta que es un cambio de una línea) |

---

## 4. Verificación literal y checklist

**Código** (antes de tocar Vercel):
```bash
git status --short                                         # limpio antes de empezar
pnpm test                                                  # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
```

**Producción** (sólo se ve desplegado). Anotar qué se vio en cada uno:
1. `https://<dominio>/es/auth/signin` carga con HTTPS y muestra el botón de Google.
2. Entrar con tu cuenta → caés en «Casa», vacía, con el selector arriba.
3. Cargar una cuenta con saldo inicial → aparece en `/accounts` y el Patrimonio Neto cuadra (verifica que la
   cuenta `3.1.01.01` se aprovisionó).
4. Cargar un gasto sin categoría → funciona (la hoja `General` nace sobre demanda).
5. Invitar a tu novia desde Configuración → Miembros. **Ella** entra desde **su celular**, con su Google → ve la
   misma organización.
6. Cargar un movimiento desde cada celular y verlo del otro lado, **recargando**.
7. Cerrar sesión y volver a entrar → vuelve a «Casa» (RN-14).
8. M-1, M-2 y M-3 del §Paso 7.

**Respaldo** (no se salta): comprobar en la consola de Neon **cuánto historial de restauración** da el plan
contratado. Además, una copia manual antes de empezar a cargar datos reales:
```bash
pg_dump '<cadena directa>' --format=custom --file=finanzia-$(date +%F).dump
```
Guardar el archivo **fuera del repositorio**. Probar una vez que `pg_restore --list` lo lee.

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Dominio propio | El que da Vercel alcanza; agregar uno es un cambio en Vercel y en la URI de Google |
| Un cron o worker para `outbox_events` | Fase 3 (QStash). Sin consumidores no hay nada que despachar |
| Envío de correos | Resend, pendiente |
| Automatizar los respaldos | La copia manual alcanza para dos personas; automatizar es un plan aparte |
| Migrar los datos de la base local | Pedido aparte, si se quiere |
| Ningún secreto en el repo ni en `docs/DEPLOY.md` | NFR-4 |

## 6. Deuda que se abre (en `TECHNICAL_DEBT.md`)

1. **`outbox_events` se acumula en producción sin despachar.**
2. **Respaldo manual:** sin automatizar.
3. **`max: 5` del pool no está dimensionado:** se dejó el valor de desarrollo; si hay errores de conexiones, es lo primero.

## 7. Reportá

Los **hallazgos** en lista aparte, y los resultados de **M-1, M-2 y M-3** con lo que se vio.
