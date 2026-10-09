---
name: avisos-y-acceso-planes-42-45
description: Planes 42-45 escritos el 2026-10-09 (acceso abierto, avisos por persona, «Ya pagué», aviso en Habilitaciones); worktree, decisiones por defecto y qué falta
metadata:
  type: project
---

Planes en la bóveda (`Planes/42..45`), commit bóveda `bc116d8`. Rama `feat/avisos-y-acceso` en el **worktree** `~/Dev/finanzas/migracion-finanzas-mock-avisos` (desde `master` `a782c71`; base `finanzas_db_avisos`, puerto 3002, `.env.local` copiado; sin `node_modules`: el §0 del 42 hace `pnpm install` y `db:migrate`). Orden 42 → 43 → 44 → 45, una invocación de `obra` cada uno, **lanzada desde el worktree**. El 44 lleva la migración 0043 y exige migrar Neon antes de desplegar.

- Revisión 3 de las specs «Acceso con Google» (RN-40..44, AC-35..40) y «Cargar por otra persona» (RN-33..41, AC-31..40). Reemplazan RN-5/AC-2/filas 5-6 (acceso) y ajustan RN-9/RN-10 (avisos). El RN-6 de la spec del espacio personal quedó derogado.
- **Los supuestos de ambas revisiones los fijé yo con la recomendación por defecto** porque el usuario dijo «arma todos los planes»; el usuario no los leyó. Sólo cerró con él: color extremo→null y resolución 32/16 px (plan 40b), y «Ya pagué»+confirmación del acreedor.
- Pendiente del usuario: M-3 (consola de Google en modo Testing), correr el SQL de los 9 avisos `debt_created`, el §7 del 40b (JSON de las baterías → plan 41 de producción de marcas, sin escribir).

**Why:** el usuario prioriza velocidad («la forma más rápida ahora»); propuso borrar la base y se le dio un INSERT de 9 filas en su lugar.
**How to apply:** cuando pida «arma todos los planes», usar defaults recomendados, dejarlos nombrados en la spec como «fijados por tanda» y decirlo en el traspaso. Para datos de producción: Neon se lee con `npx neonctl connection-string --org-id org-snowy-feather-32472443 --project-id wispy-glitter-17581739` (cadena sólo a un archivo temporal, se borra), pero **el clasificador de permisos bloquea escribir en producción**: el usuario corre el SQL en la consola.

**Lección (tiempos):** `to_char`/`::timestamp` + postgres-js en una máquina con TZ -03 corre las horas 3 h; me hizo diagnosticar mal («gastos posteriores al acuerdo»). Pedir siempre `to_char( col at time zone 'UTC' , … )` y comparar las dos columnas con el mismo formato antes de concluir.
