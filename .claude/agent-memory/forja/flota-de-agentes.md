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

## El traspaso lo escribe el agente, lo lleva el usuario (2026-09-07)

**Cada agente cierra con un bloque de traspaso explícito y copiable que dice qué le pasa el usuario a
quién.** `obra` §8 reescrita; `tanda` §5 nueva (memoria corrida a §6).

**Why:** el usuario es el orquestador a propósito, así que lo único que cruza de una sesión a la otra
es lo que él copia — y lo que el agente no deja escrito muere en el scrollback. La primera ronda real
de `obra` (2026-09-07, commit `2ebc37e`) lo probó: de su informe sobrevivió **el tercio redundante**
—el resumen de pasos y archivos, que el diff ya reproduce— copiado al § Estado de
`trabajo-en-vuelo.md` y a `TECHNICAL_DEBT.md` § Resuelto; y se perdieron **los hallazgos**, salvo uno
(`kk`, la entidad de diagnóstico) que entró de contrabando en la línea de *próximo paso* porque no
había renglón donde ponerlo.

**How to apply:** el informe tiene tres tercios y sólo uno necesita cargador. Pasos y archivos → a
nadie (está en el diff). Salida de `verificador` → a nadie (`tanda` §1 la vuelve a correr por su
cuenta; lo que re-verifica no es el veredicto sino la **afirmación** de quien ejecutó). **Hallazgos →
`tanda`, y es el único que no existe en ningún otro lado.** Al escribir cualquier agente de una flota
donde el humano traslada, la sección de cierre nombra destinatario o no sirve.

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

## Pendientes abiertos (2026-09-07)

*   **Nada cubre el estilo estricto de `.agents/AGENTS.md` §4** (espaciado, `return( ... ) ;`,
    alineación por columnas, nada de movimiento en `:hover`). Ni `lint` ni `verificador` lo miran.

## La memoria de un agente tiene que ser un paso, no un apéndice (2026-09-07)

`obra` terminó su primera ronda con `memory: project` activado y **no escribió una línea**. Su §9
estaba redactada como descripción (*"Anotá lo que abarate…"*) y colgaba al final del archivo, sin
disparador. §8 se reescribió como **secuencia numerada de cierre** —informe, traspaso, memoria— y §9
abre diciendo que es el paso 3 de esa secuencia, no un apéndice.

**Why:** la memoria de quien ejecuta es el insumo de `tanda` §2 para calibrar cuánto detalle poner en
el plan. Sin ella el circuito de mejora entre los dos queda cortado, y no se nota: nadie reclama una
memoria que no se escribió.

**How to apply:** una instrucción de cierre que no está numerada dentro de una secuencia no se
ejecuta — para cuando el agente llega, el trabajo ya se siente hecho. Vale para memoria, informe y
traspaso por igual. **Pendiente de confirmar:** falta una ronda de `obra` con esta versión para saber
si el arreglo alcanzó o si el problema era que la sesión se cortaba antes del cierre.

## Chequeo de paso vs. batería (2026-09-07, resuelto)

`obra` §3 y §5 se contradecían en la letra —"corré esa verificación" contra "no la corras vos"— porque
**las dos cosas se llamaban `verificación`**. Desambiguadas por nombre: **chequeo de paso** (puntual,
mientras escribe, lo corre él, no produce veredicto) contra **la batería** (completa, al final,
delegada a `verificador`, único veredicto). §5 se retituló "El veredicto lo delegás; los chequeos de
paso son tuyos".

**How to apply:** cuando dos secciones de un agente parecen contradecirse, mirá primero si es la misma
palabra tapando dos cosas. Bautizarlas distinto suele arreglarlo sin cambiar ninguna regla.

## Criterio de modelo

*   `tanda` y `forja`: `inherit`. Son agentes de sesión (`--agent`), así que `inherit` = el modelo que
    el usuario eligió al lanzar. Es una perilla, no una omisión.
*   `verificador`: **`sonnet` desde el 2026-09-07** (antes `inherit`). Es subagente, corre comandos y
    pega salida cruda: no hay juicio de diseño que perder. No `haiku`: parafrasear un stack trace en
    vez de pegarlo es el fallo que lo vuelve inútil. **`inherit` era la perilla equivocada para él**:
    sirve en los agentes de sesión, donde significa "el modelo que el usuario eligió al lanzar", pero
    `verificador` no se lanza nunca — heredaba el del que lo llamaba, decisión ajena a su trabajo. Con
    `settings.json` en `"model": "opus"` eso eran dos corridas de Opus por ronda para correr cuatro
    comandos. Un subagente mecánico merece modelo fijo.
*   Ejecutor (`obra`): Opus. Su habilidad central no es escribir sino **frenar cuando el plan no
    coincide con el código real** — el primer juicio que se pierde al achicar el modelo. Para abaratar,
    la perilla es `effort`, no `model`.
