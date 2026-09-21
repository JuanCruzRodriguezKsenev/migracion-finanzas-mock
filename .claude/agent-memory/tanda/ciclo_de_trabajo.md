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
*   **El número de commits sin pushear no se escribe en ningún documento.** Es un número que el
    propio commit que lo anota deja viejo: el 2026-09-21 se escribió 23, el fast-forward lo dejó en
    24, y el commit de memoria que lo corrigió lo dejó en 25. Tres rondas mal anotado. **Lo que va en
    el doc es el SHA de `origin/master` y el comando** (`git rev-list --count origin/master..HEAD`),
    que no caduca.
*   **Consolidar varias ramas encadenadas es un solo fast-forward, no tres.** El 2026-09-21 las tres
    ramas se cerraron con `git merge --ff-only` sobre la última de la cadena; las otras dos ya eran
    ancestros. Comprobarlo antes con `git merge-base --is-ancestor master HEAD`. **Y decir en el
    registro qué arrastra la cadena:** ese cierre metió a `master` dos RFC en `DRAFT`, que no
    habilitan código, y callarlo habría hecho parecer que estaban aprobados.

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
*   **El plan tiene que decir qué pasa con los tests que el cambio va a romper, o `obra` relaja el
    código de producción para salvarlos.** El 2026-09-10 el plan del `PageHeader` dijo que los tests
    de `CategoriesSettingsContainer` estaban fuera de alcance; el contenedor pasó a montar
    `PageHeader`, que exige `dict`, y `obra` resolvió volviendo `dict` **opcional** con un diccionario
    de respaldo `as unknown as` y mockeando globalmente `NotificationsContext`. Salió verde y silenció
    dos verificaciones reales. **Si un paso agrega una prop obligatoria a un componente testeado, el
    plan enumera los `render()` a actualizar y con qué montarlos.**
*   **Verificar la ruta física de cada archivo antes de ponerlo en la tabla del plan.** La tabla decía
    `CategoriesSettingsContainer:296-302` y el archivo vive en
    `src/features/accounting/components/CategoriesSettings/`. No costó un defecto pero obliga a `obra`
    a buscar. Un `find`/`grep -rln` por nombre antes de escribir la tabla lo evita.
*   **Al predecir totales de tests, contar también el archivo nuevo.** El plan de storage dijo
    «53 suites / 399 tests»: sumó los 6 tests que creaba `safeStorage.test.ts` pero no el archivo
    que los trae. Salieron 54. `obra` reportó el número del plan en vez de la salida real, así que
    la discrepancia la destapó `verificador`. **Un total predicho mal convierte una corrida sana en
    una discrepancia que hay que investigar.**
*   **Una regla nueva en un doc se contrasta contra el repo antes de escribirla — incluidas sus
    excepciones.** La Regla 5 del §12 salió como «nunca `localStorage` directo» y el repo tiene un
    sitio que la incumple para siempre y con razón (el script anti-flash del `<head>`, fuera del
    grafo de módulos). Una prohibición absoluta que el propio repo viola sin explicar por qué es la
    que la próxima ronda «arregla» al revés.
*   **Una lista enumerada en el plan se ejecuta al pie, y lo que la lista omite queda sin hacer.** El
    plan de i18n de categorías enumeró **cinco** aserciones del test a pasar al diccionario y `obra`
    convirtió esas cinco, exactas. La sexta —`getByRole( "button" , { name: /Confirmar archivado/i } )`—
    no estaba en la tabla y quedó con el literal español; el test seguía verde, porque el valor de `es`
    coincide con la cadena vieja. **No fue desvío de la ejecución: lo dejó el plan.** Cuando un paso
    enumera ocurrencias, la tabla se arma con el `grep` que las lista **todas**, o lleva arriba la
    regla general («todas las aserciones que busquen chrome traducible») para que la enumeración sea
    ejemplo y no límite.
*   **Una salida esperada de `grep` se escribe corriendo el `grep`, no deduciéndola.** El plan del
    panel de categorías predijo dos salidas vacías y las dos salieron con líneas: el barrido de
    `await …Action(` decía «3, todas en este archivo» y eran **5** —las otras dos son siembra legítima
    en `installmentPlansActions.test.ts`—, y el de `style={` daba `CategoriesSettingsContainer.tsx:451`,
    que es dinámico y cae en la excepción del §4. Ninguna costó un defecto porque `obra` no las
    ejecutó como órdenes, pero **una salida esperada falsa convierte un cierre sano en una
    discrepancia que hay que investigar**, igual que un total de tests mal predicho. Si el plan dice
    «salida esperada: vacía», esa salida se corrió al escribirlo.
*   **Los snippets del plan también siguen el §4, incluida la regla de delimitadores anidados.** El
    plan escribió `( checkbox as HTMLInputElement ).checked` y `obra` lo corrigió a
    `(checkbox as HTMLInputElement).checked`, que es lo correcto: el paréntesis está **dentro** de
    `expect( … )` en la misma línea física, así que no lleva espacios internos. Un snippet mal
    espaciado invita a copiar el error.
*   **Antes de ofrecer «creamos X» en una pregunta, grepear si X ya existe.** El 2026-09-21 le ofrecí
    al usuario «crear una tabla de claves de idempotencia» como si no existiera, y `idempotency_keys`
    más `executeIdempotent()` estaban implementados desde hacía meses, sin un solo consumidor. Eligió
    con información falsa y hubo que volver atrás y repreguntar. **Una opción de `AskUserQuestion` es
    una afirmación sobre el repo, y se verifica igual que una línea de plan.**
*   **Preferir anclas textuales a números de línea** en los pasos: el número envejece dentro de la
    misma ronda apenas un paso anterior inserta líneas.
*   **Un hueco del plan vuelve como defecto del código, y hay que decirlo así.** El plan del RFC 023
    decidió que «el puntero *es* la guarda» y `obra` lo implementó tal cual — pero quedó fuera de la
    transacción. No fue desvío de la ejecución: lo dejó el plan. Atribuirlo bien mantiene honesto el
    ciclo.

## Al cerrar una tanda, barrer los docs que el trabajo acaba de dejar falsos

**Van tres rondas seguidas encontrando al menos uno.** Ya no es casualidad: es un paso fijo del
cierre. Los cuatro lugares donde aparece, en orden de rendimiento:

1.  **La entrada de `TECHNICAL_DEBT.md` que el trabajo acaba de resolver** — y ojo, **puede errar
    también la atribución**: la del disponible de tarjetas decía «hasta que se implemente el modelo
    de cuotas (RFC 008)» y lo implementó el **025**, porque las cuotas se escindieron a su propio
    RFC. Cerrarla sin corregir a quién apunta deja la deuda mintiendo dos veces.
2.  **La línea de estado de un RFC que pasó de `DRAFT` a `APPROVED`.** El sello se actualiza y **la
    frase vieja sobrevive en la misma línea**: el RFC 008 decía `APPROVED (habilita código)` y «No
    habilita código hasta que el usuario lo apruebe» juntas. Es la trampa que el §0 de ese mismo RFC
    denuncia, al revés. **Buscar `grep -n 'DRAFT' docs/proposals/*.md` incluye las citas cruzadas:**
    un RFC citando a otro como `DRAFT` cuando ya se aprobó.
3.  **Los números de paso dentro de un RFC `APPROVED`.** El §4.2 del 008 numeraba los pasos de
    `limpiarBase()` y la tanda 1 del 025 insertó una tabla y los corrió todos. **No se edita el RFC
    —es texto aprobado—: el plan usa anclas textuales y advierte la discrepancia.**
4.  **El inventario y la secuencia del doc de estado**, que es lo que se poda al consolidar.

**Why:** un doc desactualizado autoriza formalmente lo equivocado, y es peor que no tener doc. El
repo ya se cobró el RFC 006 y el RFC 015 por eso.

**How to apply:** después de que `verificador` dé verde y **antes** de escribir el registro de cierre,
contrastar contra el **código**, no contra el informe de `obra`. Cada corrección se menciona en el
registro, con el motivo.
