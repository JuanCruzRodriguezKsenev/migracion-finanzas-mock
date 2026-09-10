# Plan — alinear el script `lint` con la compuerta y sacar el `reload()` de tarjetas

**Rama:** `fix/cabos-rfc023-y-limpieza-de-tests` (la misma, encadenada sobre `feat/bandeja-recurrencias`).
**Origen:** los dos hallazgos que dejó la ejecución de [`cierre-cabos-rfc023.md`](cierre-cabos-rfc023.md).
**Estado de partida:** `df53f56`, verificado en verde el 2026-09-10 — 393 tests / 53 suites, eslint
0 warnings con el flag de la compuerta, `tsc` 0 errores, build exitoso.

Este plan no lleva progreso adentro. El estado vive en [`../trabajo-en-vuelo.md`](../trabajo-en-vuelo.md).

---

## Lo que ya existe y NO hay que construir

| Cosa | Dónde está hoy | Qué hace |
| :--- | :--- | :--- |
| Revalidación de la ruta de tarjetas | `cards/actions/cardsActions.ts:100`, `:178`, `:253` | Ya normalizada a `revalidatePath( "/[lang]/(main)/cards" , "page" )` en la ronda anterior. **No se toca.** |
| Cierre del modal tras el alta | `cards/components/CardFormModal.tsx:93-94` | Ya llama `onSuccess( res.value )` y **después `onClose()`**. **No agregar `setIsModalOpen( false )` en el contenedor.** |
| El patrón de contenedor server-driven | `accounting/components/AccountsContainer.tsx:54-55` | Sólo guarda estado de UI (dos booleanos de modal). Los datos se renderizan **directo de props**. Es el molde del Paso 2. |
| El patrón de invalidación | `CreateAccountForm.tsx:88`, `CreateFinancialEntityForm.tsx:303`, `SignInForm.tsx:106` | Los tres únicos usos de `router.refresh()` del repo: dentro de la transición, después del `res.success`. |
| El diálogo de confirmación con `confirm()` | `ContactsContainer.tsx:98`, `PaymentMethodsPanel.tsx:111`, `TransactionDetailModal.tsx:120`, `CardsContainer.tsx:56` | Convención establecida en cuatro lugares. **Fuera de alcance**, no reemplazar por `Modal`. |

---

## Paso 1 — el script `lint` de `package.json`

### Qué se cambia

`package.json:10`:

```diff
-    "lint": "eslint",
+    "lint": "eslint . --max-warnings 0",
```

### Por qué así, y por qué es seguro

El proyecto está en **ESLint 9 con flat config** (`eslint.config.mjs`; no existe ningún `.eslintrc`).
En flat config, `eslint` sin patrones ya lintea el directorio actual, así que **agregar el `.` no
cambia el alcance** — es sólo dejar el script textualmente idéntico al de la compuerta
(`.github/workflows/compuerta.yml:66`). El único delta funcional es `--max-warnings 0`, que es
justamente el agujero por el que pasaron los 75 warnings.

El árbol está en 0 warnings verificados, así que el script alineado sale en verde desde el primer día.

### Radio de impacto documental

El cambio invalida cuatro lugares que hoy advierten lo contrario. **Hay que tocar los cuatro**, y
sólo los cuatro:

1.  **`.claude/CLAUDE.md:32`** — la línea `pnpm lint             # eslint` del bloque `## Comandos`
    pasa a `pnpm lint             # eslint . --max-warnings 0 — idéntico a la compuerta`.
2.  **`.claude/CLAUDE.md:50`** — en el bloque `## Verificación`, el comentario
    `# NO es `pnpm lint`: ver la nota de abajo` deja de ser cierto. Reemplazarlo por
    `# el script `pnpm lint` ahora es idéntico`.
3.  **`.claude/CLAUDE.md:55-59`** — la nota en bloque `> **`pnpm lint` NO es lo que corre la
    compuerta.**` se **reescribe, no se borra**: la lección sigue valiendo. Redacción a usar:

    > **`pnpm lint` ahora sí es lo que corre la compuerta.** El script de `package.json` era `eslint`
    > a secas, sin `--max-warnings 0`, y salía con código 0 aunque hubiera warnings: verificar con él
    > y reportar «lint 0» dejó pasar 75 warnings de imports huérfanos que tumbaban CI (2026-09-10).
    > Se alineó a `eslint . --max-warnings 0`, idéntico a `.github/workflows/compuerta.yml:66`. **Si
    > algún día vuelven a divergir, la compuerta manda.**

4.  **`AGENTS.md:57`** — mismo comentario que el punto 2. Además, **hoy esa línea tiene una referencia
    rota**: dice "ver la nota de abajo" y en `AGENTS.md` no hay ninguna nota abajo (la nota vive en
    `.claude/CLAUDE.md`). Al reemplazar el comentario, la referencia rota se va sola.

**`README.md:68`** (`pnpm lint             # ESLint`) queda como está: describe el script, no la
compuerta, y sigue siendo cierto.

### Lo que NO se toca

`docs/planes/*.md` (ocho archivos), `docs/registro/2026-09-08-*.md` y
`docs/proposals/021-*.md`, `022-*.md` mencionan `pnpm lint`. **Son documentos históricos: registran lo
que se corrió el día que se corrió.** Reescribirlos sería falsificar el registro. Dejarlos intactos.

---

## Paso 2 — `CardsContainer` deja de fotografiar las props

### El diagnóstico, para que no se arregle al revés

El hallazgo propone cambiar `window.location.reload()` (`CardsContainer.tsx:70`) por
`router.refresh()` porque `revalidatePath` ya está normalizado. **Ese swap solo rompe la pantalla.**
El motivo del reload no es la caché del servidor, es esto:

```
CardsContainer.tsx:43   const [ cards , setCards ] = useState( initialCards ) ;
```

El contenedor copia las props a estado local en el primer montaje. `router.refresh()` re-ejecuta el
server component (`src/app/[lang]/(main)/cards/page.tsx`) y baja un `initialCards` nuevo, pero ese
`useState` ya no lo mira: **la tarjeta recién creada no aparecería.** El `reload()` funciona porque
remonta todo el árbol.

La corrección es sacar la copia, no cambiar el mecanismo de invalidación.

### 2.a — `src/features/cards/components/CardsContainer.tsx`

1.  **Import.** Agregar en el bloque `// Librerías externas`, **antes** del import de React, siguiendo
    `CreateAccountForm.tsx:3-5`:

    ```
    import { useRouter } from "next/navigation" ;
    ```

    Realinear la columna del `from` del bloque según el estilo del repo (`.agents/AGENTS.md` §4).

2.  **Borrar el estado espejo.** Sacar la línea 43 completa (`const [ cards , setCards ] = useState(
    initialCards ) ;`) y declarar `const router = useRouter() ;` junto a las otras constantes.

3.  **Reemplazar las cuatro lecturas de `cards` por `initialCards`:**

    | Línea hoy | Qué es |
    | :--- | :--- |
    | `:50` | `const filteredCards = cards.filter( ... )` |
    | `:91` | contador del tab "Todas": `cards.length` |
    | `:98` | contador del tab "Crédito": `cards.filter( ( c ) => c.type === "credit" ).length` |
    | `:105` | contador del tab "Débito": `cards.filter( ( c ) => c.type === "debit" ).length` |

    Son las cuatro; después del cambio, `grep -n "cards\b" CardsContainer.tsx` no debe devolver
    ninguna referencia al identificador `cards` que no sea `initialCards` o `filteredCards`.

4.  **`handleArchive` (`:55-65`)** — sacar el `setCards( ( prev ) => prev.filter( ... ) )` y dejar
    `router.refresh()` en su lugar, dentro de la misma `startTransition`. `archiveCardAction` ya
    revalida la ruta (`cardsActions.ts:253`), así que el refresh trae la lista sin la tarjeta.
    El `confirm()` de la línea 56 **se queda tal cual**.

5.  **`handleSuccessNewCard` (`:68-71`)** — el cuerpo pasa a `router.refresh() ;` y se borra el
    comentario `// Si bien revalidatePath refresca el servidor, recargamos la página`, que deja de
    describir lo que hace. **Mantener la firma sin parámetros**: `CardFormModal` la tipa como
    `( nueva: Card ) => void` (`CardFormModal.tsx:29`), y declarar `nueva` sin usarlo dispara
    `no-unused-vars`, que con el Paso 1 ya rompe `pnpm lint`.

6.  **`useTransition` se queda.** `const [ , startTransition ] = useTransition() ;` (`:47`) lo sigue
    usando `handleArchive`. `useState` también se queda: lo usan `activeTab` e `isModalOpen`.

### 2.b — el cabo que hoy tapa el `reload()`: el formulario no se resetea

`CardFormModal` tiene **16 `useState`** (`:40-56`) sin ningún reset y sin `useEffect` de limpieza. Ese
estado vive en el componente wrapper, **fuera** del `<Modal>` interno — y `Modal` es el único que
desmonta (`shared/ui/feedback/Modal/Modal.tsx:126` retorna `null` cuando `isOpen` es false). Hoy no se
nota porque el `reload()` borra la página entera. **Sin el reload, la segunda alta abre el formulario
con los datos de la primera.**

Por eso el contenedor tiene que **montar el modal condicionalmente**, en `CardsContainer.tsx:136-142`:

```
{ isModalOpen ? (
  <CardFormModal
    isOpen={isModalOpen}
    onClose={ () => setIsModalOpen( false ) }
    financialEntities={financialEntities}
    accounts={accounts}
    onSuccess={handleSuccessNewCard}
  />
) : null }
```

Así el desmontaje al cerrar limpia los 16 campos, sin agregar código de reset ni estado nuevo.

> Esto es lo que distingue a `CardsContainer` de `AccountsContainer`: allá el formulario va **adentro**
> del `<Modal>` (`AccountsContainer.tsx:314-332`), así que el desmontaje ya lo cubre. Acá el wrapper
> queda por fuera. Es la razón por la que el molde no se copia literal.

### Radio de impacto del Paso 2

*   **`CardFormModal.tsx` no se modifica.** Único consumidor: `CardsContainer.tsx:25` y `:136`.
*   **`CardVisual.tsx` no se modifica.** Recibe `card`, `locale` y `onArchive` por props; ninguna
    cambia de forma.
*   **`cardsActions.ts` no se modifica.**
*   **`src/app/[lang]/(main)/cards/page.tsx` no se modifica.** Ya es un server component fino que baja
    `initialCards` por props.
*   **No hay tests que actualizar.** `src/features/cards/` tiene cinco archivos de test
    (`actions`, `repositories`, `schemas`, `services`, `utils`) y **ninguno de componentes**; el repo
    no tiene infraestructura de test de componentes montada. No inventar una en esta tanda.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck como comando propio. **Pegar la salida, no describirla.**

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

Además, la comprobación específica del Paso 1 — el script y la compuerta tienen que dar lo mismo:

```bash
pnpm lint ; echo "exit: $status"
```

**Criterio de aceptación:**

*   `pnpm test` — **393 tests / 53 suites**, 0 fallos. El número no debe moverse: este plan no toca
    nada que la suite cubra.
*   `pnpm exec eslint . --max-warnings 0` — código 0, sin la línea `ESLint found too many warnings`.
*   `pnpm lint` — código 0, y **misma salida** que el comando de arriba.
*   `pnpm exec tsc --noEmit | grep -c "error TS"` — **0**.
*   `pnpm build` — exitoso.

`pnpm test` necesita el contenedor `postgres-dev` vivo en podman. Si muere en el setup con
`ECONNREFUSED`, eso es **entorno caído, no suite roja**.

---

## Fuera de alcance

*   **Reemplazar los cuatro `confirm()` por el `Modal` de `shared/ui`.** Es convención establecida en
    cuatro componentes; cambiarla es una tanda propia con decisión de diseño previa.
*   **Consolidar las ramas.** `fix/cabos-rfc023-y-limpieza-de-tests` y `feat/bandeja-recurrencias` se
    mergean después de esta tanda, y lo decide el usuario.
*   **Los documentos históricos** de `docs/planes/`, `docs/registro/` y `docs/proposals/` que mencionan
    `pnpm lint`.
*   **`docs/TECHNICAL_DEBT.md`** — este plan no abre ni cierra ítems de deuda. El `reload()` de
    tarjetas nunca estuvo anotado ahí, y se resuelve en la misma tanda en que se detectó.
