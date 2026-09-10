---
name: ciclo-de-trabajo
description: Cómo se prepara el entorno para `obra`, cómo se cierra una rama en FinanzIA, y qué forma de plan ya salió sin defectos.
metadata:
  type: feedback
---

# El ciclo de trabajo en este repo

## Cómo arranca `obra`

**`obra` exige árbol limpio y tiene prohibido cambiar de rama.** Preparar el entorno es trabajo de
`tanda`, **antes** de pasarle el plan: commitear la ronda de planificación, crear la rama de la ronda
si hace falta una nueva, y dejar `trabajo-en-vuelo.md` sincronizado y commiteado.

**Why:** con el árbol sucio devuelve un informe de factibilidad y no toca una línea — verificado el
2026-09-07, funciona como se espera. **Y rebota igual con el árbol limpio si la rama que el plan
nombra no existe todavía**: el 2026-09-10 el plan del `PageHeader` decía en su línea 3 «Rama: a crear
por `tanda` antes del traspaso», la rama no se creó, y `obra` devolvió «Hallazgos: ninguno, la
estructura coincidió con lo anticipado por el plan» — que **no** es el reporte de un trabajo hecho
sino la confirmación de que el plan es aplicable. Se distinguen mirando el repo, no el informe: mismo
`HEAD`, reflog sin entradas nuevas, ningún archivo de `src/` tocado.

**How to apply:** el bloque de traspaso lleva tres partes: qué hacer antes de pasárselo, el comando
exacto, y el mensaje textual con la ruta del plan. **La primera parte la ejecuta `tanda`, no la
ofrece.** Cerrar una ronda con «¿querés que consolide o arrancamos directo?» deja el traspaso a medias
y el usuario invoca a `obra` sobre un entorno sin preparar: pasó el 2026-09-10 y costó una ronda
entera. Si el plan nombra una rama, esa rama existe **antes** de que el bloque de traspaso se escriba.

## Cómo se cierra una rama

*   **La historia es estrictamente lineal: cero merge commits.** La convención es fast-forward, y las
    ramas se encadenan una sobre otra en vez de salir todas de `master`. Verificar con
    `git log --merges --oneline` (vacío) antes de proponer cualquier `--no-ff`.
*   **Consolidar no es sólo mergear.** Se escribe `docs/registro/YYYY-MM-DD-<nombre>.md` con fecha de
    consolidación, rama base, **resultado global** (tests / lint / build) y detalle por tanda con su
    commit; y las secciones cerradas se podan de `trabajo-en-vuelo.md`, que sólo lleva lo vivo.
    Modelo a copiar: `docs/registro/2026-09-06-cierre-tandas-0-a-g.md`.
*   **El merge lo decide el usuario.** No consolidar por cuenta propia aunque la rama esté verde.

## Qué forma de plan ya salió sin defectos

*   **La tabla "Lo que ya existe y NO hay que construir" funcionó.** El plan de la segunda tajada del
    RFC 022 listó las cinco acciones existentes con archivo y línea, y `obra` no reescribió ninguna.
    Vale la pena en todo plan que se apoye en trabajo de una tanda anterior.
*   **Los radios de impacto nombrados salieron limpios; lo no nombrado volvió como defecto.** Los
    cuatro archivos del radio D se actualizaron sin residuos. Lo que quedó suelto fue todo *implícito*:
    un tipo muerto, dos imports y una prop sin usar.
*   **Contrastar el hallazgo antes de enrutarlo: el informe puede acertar la conclusión y errar el
    motivo.** Pasó dos veces seguidas. `obra` reportó bien que `cardsActions.ts` estaba fuera de
    convención pero lo fundamentó al revés («usan el locale» — usan el patrón de archivos); y reportó
    bien que el `reload()` de `CardsContainer` sobraba, atribuyéndolo a la caché cuando la causa era
    el `useState( initialCards )`. **Escrito sin contrastar, el próximo lo arregla al revés.**
*   **Un hueco del plan vuelve como defecto del código, y hay que decirlo así.** El plan del RFC 023
    decidió que «el puntero *es* la guarda» y `obra` lo implementó tal cual — pero quedó fuera de la
    transacción. No fue desvío de la ejecución: lo dejó el plan. Atribuirlo bien mantiene honesto el
    ciclo.
