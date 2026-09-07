---
name: flota-de-agentes
description: Decisiones de diseño sobre la flota de agentes (tanda, obra, verificador, forja) — traspaso por doc, sin comunicación entre agentes, criterio de modelo, y por qué NO se partió tanda en subagentes.
metadata:
  type: project
---

Los agentes viven en `~/.claude/agents/` (nivel usuario, genéricos); lo específico del repo es la
ficha en `.claude/CLAUDE.md`. No hay `.claude/agents/` de proyecto y eso es deliberado.

## Decisiones tomadas (2026-09-07)

*   **Los agentes no se comunican entre sí. El usuario invoca cada uno a mano.**
    **Why:** preferencia explícita del usuario; quiere el control del traspaso, no una cadena
    automática. **How to apply:** no diseñes handoffs agente→agente ni `Agent` cruzados entre
    `tanda` y el ejecutor. La única delegación viva es `tanda`/ejecutor → `verificador`.
*   **El plan de `tanda` se escribe en la documentación**, no se pega a mano en la terminal.
    **Why:** quien ejecuta arranca en frío y lo único que ve es el documento; además deja rastro de
    contra qué plan se ejecutó. **How to apply:** la ruta es `docs/planes/`, uno por ronda nombrado
    por la rama. El plan **no** lleva progreso adentro: el estado sigue en `trabajo-en-vuelo.md`.
*   **`obra` creado el 2026-09-07** en `~/.claude/agents/obra.md`, genérico. `tanda.md` §1 ajustado
    ("Ejecuta otro"; el plan se entrega escrito) y la ficha actualizada con `docs/planes/`.
*   **Los agentes de usuario son GENÉRICOS; lo específico del repo va en la ficha.**
    **Why:** convención establecida por el usuario en el commit `677a337`. El primer borrador de
    `obra` hardcodeaba `docs/planes/`, `AGENTS.md §4` y `organizationId`, y hubo que generalizarlo.
    **How to apply:** al escribir cualquier agente nuevo, referí a "lo que la ficha nombre" en vez de
    rutas y reglas concretas; si algo es irreduciblemente del repo, va a `.claude/CLAUDE.md`.

## Por qué NO se partió `tanda` en subagentes (2026-09-07)

El usuario propuso partirlo en investigador/planificador/revisor con un orquestador. Se descartó:

1.  Un subagente no puede usar `AskUserQuestion`, y `tanda` §1 exige consultar **antes** de escribir
    el plan. El orquestador tendría que preguntar sin el contexto de la investigación.
2.  **Planificar necesita la investigación en contexto, no un resumen.** `tanda` §2 tiene anotado el
    incidente: "recomendar un reuso sin abrir el archivo ya introdujo un bug". Partirlo convierte ese
    defecto en arquitectura.
3.  El orquestador no aporta juicio propio: enruta entre fases de una conversación, que es lo que la
    conversación ya hace. El orquestador es el usuario, a propósito.

**How to apply:** el test para separar un verbo es *otras herramientas, otro modelo, o ruido
voluminoso y descartable*. Sólo "barrer la base de código" lo aprueba, y para eso ya está `Explore`.
Un **revisor** independiente es el único candidato vivo, pero se posterga hasta ver dónde se escapan
las cosas entre el plan y el commit con `obra` andando.

## Criterio de modelo

*   `tanda` y `forja`: `inherit`. Son agentes de sesión (`--agent`), así que `inherit` = el modelo que
    el usuario eligió al lanzar. Es una perilla, no una omisión.
*   `verificador`: hoy `inherit`, **debería ser `sonnet`**. Es subagente, corre comandos y pega salida
    cruda. No `haiku`: parafrasear un stack trace en vez de pegarlo es el fallo que lo vuelve inútil.
*   Ejecutor (`obra`): Opus. Su habilidad central no es escribir sino **frenar cuando el plan no
    coincide con el código real** — el primer juicio que se pierde al achicar el modelo. Para abaratar,
    la perilla es `effort`, no `model`.
