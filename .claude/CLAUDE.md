# Notas de sesión — FinanzIA

Esto vale para **cualquier** sesión en este repo, incluida una consulta de dos minutos. Para el modo
de trabajo por rondas —investigar, consultar, planificar, revisar, verificar— usá el agente de sesión:

```bash
claude --agent tanda
```

Ese agente (`.claude/agents/tanda.md`) lleva el acuerdo de roles completo, el mapa de lectura de los
docs y del artifact de la hoja de ruta, y la calibración de cuánto detalle poner en cada plan. Las
sesiones que no lo invoquen quedan como sesiones normales, que es a propósito.

---

## `pnpm build` no es typecheck

`next build` sólo tipa los archivos del grafo de build, y los archivos de test **no entran**. Vitest
tampoco tipa. Así que **build verde + tests verdes conviven con `tsc --noEmit` roto**, que es lo que
corre la compuerta CI (`.github/workflows/compuerta.yml:62`) y lo que la pondría en rojo. Ya pasó una
vez, reportado como "typecheck completo".

Corré siempre los cuatro, y el tercero por separado:

```bash
pnpm test                  # vitest, una pasada
pnpm lint                  # eslint --max-warnings 0
pnpm exec tsc --noEmit     # SEPARADO. No lo cubre el build.
pnpm build                 # produccion
```

`pnpm test` necesita Postgres vivo: contenedor `postgres-dev` en podman. Sin él la suite muere en el
setup con `ECONNREFUSED`, que es entorno caído y no suite roja.

Para contrastar el esquema contra la base real:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d <tabla>"
```

## Restricciones duras

*   **`migracion/` está prohibido** leer, escribir, listar o buscar con cualquier herramienta, sin
    autorización escrita explícita. Ver `.agents/AGENTS.md` §1.
*   **`pnpm` únicamente.** `npm` está prohibido para dependencias y scripts.
*   **Código sólo contra RFC `APPROVED`** (`docs/proposals/`). Las enmiendas quedan en `DRAFT` hasta
    que el usuario las apruebe.

## Reportar exactamente lo que se hizo

No afirmar verificaciones que no se corrieron ni capacidades que no existen. El estado del trabajo
vive en `docs/trabajo-en-vuelo.md` y se actualiza **en el mismo commit** que lo avanza.
