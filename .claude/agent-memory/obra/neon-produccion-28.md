---
name: neon-produccion-28
description: "Lecciones del Plan 28: actualización de esquema en Neon, psql vía podman, --no-secrets en branches create, PATCH de región en Vercel y push alineado"
metadata:
  type: operativo
---

# Neon al día y producción alineada (Plan 28)

- **`psql` local vs contenedor:** `psql` no está instalado directamente en el `$PATH` del host de desarrollo. Cuando un plan o procedimiento operativo requiere invocar `psql "$DIRECT_URL" -c "..."`, se debe declarar un wrapper delegando al contenedor local: `psql() { podman exec -i postgres-dev psql "$@" ; }`. El contenedor de PostgreSQL en Podman resuelve SSL y conecta a Neon de forma transparente.
- **`neon branches create` filtra secretos si no se flaggea:** Por defecto el comando `neon branches create` emite las credenciales de conexión en `stdout`. Para cumplir con la restricción T-4 de no imprimir secretos en la sesión ni en logs, debe pasarse explícitamente `--no-secrets`.
- **Actualización de región en Vercel vía API:** El comando `printf '{"serverlessFunctionRegion":"gru1"}' | vercel api /v9/projects/<id> --scope <team> -X PATCH --input -` cambia efectivamente la región para los despliegues posteriores sin requerir navegación interactiva en la consola.
- **Orden estricto de despliegue:** Con el repositorio conectado a GitHub en Vercel, todo push a `master` dispara un build a producción. Para evitar caídas por columnas inexistentes (como ocurrió con `personal_owner_user_id`), el orden obligado es: respaldo de Neon -> `DATABASE_URL="$DIRECT_URL" pnpm db:migrate` -> comprobaciones de esquema -> `git push origin master`.
