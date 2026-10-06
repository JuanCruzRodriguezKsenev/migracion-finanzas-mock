# CLAUDE.md

> **Estado de trabajo en curso y próximo paso:** `~/Boveda/Proyectos/migracion-finanzas-mock/Estado.md`.

## Las reglas de este repo no son específicas de Claude

Viven en [`AGENTS.md`](AGENTS.md), que se autocarga: reglas duras (`migracion/` prohibido, `pnpm`
únicamente, RFC `APPROVED`, centavos, `organizationId`, Debe = Haber), la batería de verificación y
las rutas al resto.

**`AGENTS.md` es un router: lleva las rutas, no el contenido completo.** El estilo de código y las
trampas de dominio están en [`.agents/AGENTS.md`](.agents/AGENTS.md) §4 y §8, que **no se autocarga**.
Abrilo antes de escribir el primer archivo.

## Lo específico de Claude Code

[`.claude/CLAUDE.md`](.claude/CLAUDE.md) — ficha de proyecto y flota de agentes. El ciclo es `tanda`
piensa (deja el plan en la bóveda, `Planes/`) → `obra` ejecuta → `verificador` comprueba.

## Mapa rápido

| Ruta | Qué tiene |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | Reglas duras, verificación y rutas. Autocargado |
| [`.agents/AGENTS.md`](.agents/AGENTS.md) | §1 restricciones · §4 estilo · §7 flujo · §8 lo que cobra caro. **No autocargado** |
| [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | Ficha de proyecto y flota de agentes |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arquitectura feature-driven, nomenclatura, tests, proceso RFC |
| `~/Boveda/Proyectos/migracion-finanzas-mock/Estado.md` | Único doc de estado |
