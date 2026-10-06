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
