# Despliegue en Vercel con Neon

Procedimiento operativo para publicar FinanzIA. **Este documento no lleva secretos**: las cadenas de conexión,
el `NEXTAUTH_SECRET` y las credenciales de Google se pegan en las consolas, nunca en el repositorio.

Producción corre en **Vercel (aplicación) + Neon (PostgreSQL)**. El acceso es sólo con Google.

## Cómo se conecta la aplicación

- `DATABASE_URL` en producción es la cadena **con pooler** de Neon (host con `-pooler`, pgbouncer en modo
  transacción). `src/shared/db/connectionOptions.ts` detecta ese host y desactiva las sentencias preparadas
  (`prepare: false`); contra la base local o el endpoint directo quedan activas.
- Las **migraciones** y el script de arranque usan la cadena **directa** (sin `-pooler`): el pooler no se lleva
  bien con migraciones.
- `max` del pool es 5, el valor de desarrollo, sin dimensionar. Si aparecen errores de conexiones, es lo primero a revisar.

## 1. Neon

1. Crear el proyecto. Región: la más cercana a Argentina (São Paulo, `aws-sa-east-1`, si está disponible);
   anotarla, porque la de Vercel tiene que coincidir.
2. Copiar **dos** cadenas: la **directa** (para migrar) y la **con pooler** (para la aplicación).
3. Migrar el esquema con la cadena **directa**:
   ```bash
   DATABASE_URL='<cadena directa>' pnpm db:migrate
   ```
   **No** correr `pnpm db:seed` contra Neon: borra tablas y siembra datos demo.
4. Comprobar: `psql '<cadena directa>' -c "\dt"` lista las tablas (entre ellas `memberships`, `invitations`,
   `notifications`, `expense_splits`, `organization_agreements`, `budgets` y `goals`) y
   `select count(*) from users` da 0.

## 2. Vercel

1. Importar el repositorio de GitHub (por HTTPS, autenticado con `gh`; no SSH).
2. Framework: Next.js (se detecta). Región de las funciones: la misma que la de Neon (`gru1` si es São Paulo).
   Node: el que use el CI; si Vercel no lo ofrece, fijar el más alto disponible y agregar `engines` a `package.json`.
3. Variables de entorno de **Production**:

   | Variable | Valor |
   | :--- | :--- |
   | `DATABASE_URL` | la cadena **con pooler** |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` (uno distinto al de desarrollo) |
   | `NEXTAUTH_URL` | `https://<dominio que da Vercel>` |
   | `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | los de la credencial de Google |

   Sin `NEXTAUTH_SECRET` la aplicación no arranca en producción: es una guarda, no un error.
4. Desplegar. El login con Google falla hasta completar la sección 3.

## 3. Credencial de Google

En Google Cloud Console, en el cliente OAuth «Web»:

1. Agregar la URI de redirección `https://<dominio>/api/auth/callback/google` (conservar la de `localhost`).
2. Pantalla de consentimiento: en «Testing» sólo entran las cuentas listadas como usuarios de prueba.
   Publicarla («In production») evita ese límite y no exige verificación (permisos básicos: `openid`,
   `email`, `profile`).
3. Guardar y esperar unos minutos: Google propaga los cambios con demora.

## 4. Arranque de la organización real

Con la cadena **directa** de Neon:

```bash
DATABASE_URL='<cadena directa>' pnpm db:bootstrap crear-organizacion --nombre "Casa"
DATABASE_URL='<cadena directa>' pnpm db:bootstrap invitar --org casa --email <gmail> --rol owner
```

Entrar a `https://<dominio>` con «Continuar con Google» con esa cuenta: queda como `owner` de «Casa».
Después, Configuración → Miembros → invitar a la otra persona. La base de producción nace sin datos demo; la
organización tiene el catálogo de categorías y la cuenta de Patrimonio Neto.

> Mientras el rol `viewer` no se haga cumplir en las acciones de escritura, invitar como `member` u `owner`,
> nunca como `viewer`: ese rol hoy puede escribir.

## 5. Verificación en producción

1. `https://<dominio>/es/auth/signin` carga con HTTPS y muestra el botón de Google.
2. Entrar con la cuenta del `owner`: cae en «Casa», vacía, con el selector arriba.
3. Cargar una cuenta con saldo inicial: aparece en `/accounts` y el Patrimonio Neto cuadra (la cuenta `3.1.01.01` se aprovisionó).
4. Cargar un gasto sin categoría: funciona (la hoja `General` nace sobre demanda).
5. Invitar a la otra persona; entra desde su celular con su Google y ve la misma organización.
6. Cargar un movimiento desde cada celular y verlo del otro lado, recargando.
7. Cargar un gasto con el acuerdo de reparto en «sin reparto» (el estado por defecto): se comporta como antes.
8. Cerrar sesión y volver a entrar: vuelve a «Casa».

Mediciones que sólo se ven desplegado:

- **M-1.** Entrar con una cuenta de Google sin invitación: debe aterrizar en el panel, con **Personal**
  como única opción del selector. Si la pantalla de consentimiento OAuth de Google está en modo Testing, sólo entran los usuarios de prueba (M-3 de la spec).
- **M-2.** Latencia de una carga de `/accounts` y de un alta de movimiento (pestaña Red, tres mediciones). Si
  es mayor a 2 s sostenidos, revisar primero que Vercel y Neon estén en la misma región.
- **M-3.** Un intento por contraseña con un email inexistente no debe dar 500 ni timeout (el `scrypt` señuelo
  reserva ~128 MB). Si falla por memoria: subir la memoria de la función o bajar `PARAMS_ACTUALES.N`
  (decisión del dueño del proyecto).
- **M-4.** Cargar un gasto a las 22:00 del último día de un mes y ver en qué mes lo cuenta el dashboard:
  el servidor está en UTC y el usuario en UTC-3, y el dashboard delimita el mes con la zona del servidor.
- **M-5.** Contar en la pestaña Red cuántos POST hace una carga de `/es` (esperado: 1).

## 6. Respaldo

Comprobar en la consola de Neon cuánto historial de restauración da el plan contratado. Además, una copia
manual antes de cargar datos reales:

```bash
pg_dump '<cadena directa>' --format=custom --file=finanzia-$(date +%F).dump
```

Guardar el archivo **fuera del repositorio** y probar una vez que `pg_restore --list` lo lee.

## 7. Actualizar producción

El proyecto está conectado a GitHub (§2): **cada push a `master` despliega automáticamente a producción**.

Para evitar desalinear la aplicación con la base de datos, el orden de actualización es estricto:

1. **Respaldo previo:** crear una rama temporal en Neon como red de seguridad (`neon branches create --name pre-...`).
2. **Migrar la base antes de pushear:** aplicar las migraciones pendientes con la cadena directa como indica el §1.3 (`DATABASE_URL='<cadena directa>' pnpm db:migrate`).
3. **Verificar paridad:** comprobar que `select count(*) from drizzle.__drizzle_migrations` coincida con la cantidad de archivos en `ls drizzle/migrations/*.sql | wc -l` (43 hoy).
4. **Recién después, pushear:** `git push origin master`. El nuevo despliegue en Vercel encontrará las tablas y columnas ya presentes.
5. **Limpieza:** una vez verificado el despliegue en producción, eliminar la rama temporal de respaldo de Neon.

Notas operativas:
- Las migraciones del proyecto son aditivas por convención; cualquier cambio de esquema destructivo (drop o rename) exige un plan propio de migración y transición en dos fases.
- Si se modifica la región de funciones en Vercel (p. ej. `gru1`), el cambio aplica únicamente a los despliegues **nuevos**.

## Limitaciones conocidas

- `outbox_events` se llena y nadie lo despacha en producción (`pnpm db:outbox` es manual): los eventos quedan `PENDING`.
- Los respaldos son manuales.
- No hay dominio propio, ni envío de correos, ni migración de los datos de la base local.
