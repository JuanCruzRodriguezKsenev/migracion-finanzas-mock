---
name: boveda-obsidian-pendiente-en-agentes
description: La bóveda ~/Boveda ya define dónde van specs/planes/estado/deuda de cada proyecto, pero la definición de tanda/obra todavía no lo dice; este repo sigue usando docs/ hasta migrarlo.
metadata:
  type: reference
---

`~/Boveda/AGENTS.md` asigna a `tanda` escribir tarjeta, specs, planes, diseños y deuda en `Proyectos/<repo>/`, y a `obra` sólo `Estado.md`.
El diseño que lo aterriza en los agentes es `~/Boveda/Sistema/Diseño de forja - agentes y la bóveda.md` (decidido 2026-09-26): fases 2 y 3 = `reglas/global.md`
+ ediciones a tanda/obra/verificador/forja + skill `spec`, en un solo commit de `~/Dev/agentes`.
**Estado al 2026-10-06:** `~/Dev/agentes/reglas/` no existe y `agentes/tanda.md` no menciona la bóveda → fases 2/3 sin aplicar. Las aplica `forja`, no `tanda`.
Este repo (`migracion-finanzas-mock`) no tiene carpeta en `Proyectos/`; su ficha apunta a `docs/`, y los agentes son compatibles hacia atrás con eso.
**How to apply:** si el usuario pregunta por la bóveda, decir que está decidido y sin aplicar; no reescribir mi propia definición ni mudar docs por mi cuenta.


**Actualización 2026-10-06 (tarde):** forja ya aplicó el diseño (`~/Dev/agentes`, commit `fe5ad19`: `reglas/global.md`, tanda/obra/verificador/forja/spec; `generar --check` en 0).
La migración de ESTE repo quedó planificada, no ejecutada: tarjeta y planes `00 - Migración 1 importar a la bóveda` (bibliotecario) y `01 - Migración 2 limpiar el repo` (obra)
en `~/Boveda/Proyectos/migracion-finanzas-mock/Planes/`. Decisión del usuario: los 28 RFC de `docs/proposals/` se QUEDAN en el repo (como los ADR). La memoria de los agentes también se queda.
**Pendiente mío tras el plan 01:** actualizar las rutas `docs/trabajo-en-vuelo`, `docs/planes`, `TECHNICAL_DEBT` que citan mis notas (estado_actual, ciclo_de_trabajo, trampas_del_repo, decisiones_*, i18n_*, verificacion_no_tocar_el_arbol) a las de la bóveda.
