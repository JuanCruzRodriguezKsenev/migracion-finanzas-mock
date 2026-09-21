# Plan — Dejar de descartar el `Result` en el panel de categorías

**Rama:** `fix/result-panel-categorias` · **Escrito:** 2026-09-21 · **Abre deuda nueva:** sí (paso 7)

No hay RFC y no hace falta: esto no agrega comportamiento ni cambia el modelo, corrige un **defecto de
UX** preexistente. El contrato que gobierna es el **§4 de [`.agents/AGENTS.md`](../../.agents/AGENTS.md)**
(estilo, y la prohibición estricta de CSS inline) y el **§12 de [`patterns.md`](../patterns.md)**
(montaje de tests de componentes cliente).

---

## 0. El defecto, en una frase

`CategoriesSettingsContainer.tsx` llama a tres acciones de escritura **sin mirar `res.success`**: si el
servidor rechaza, la UI cierra el modal, refresca el árbol y sigue como si hubiera funcionado. El
usuario no se entera de que su archivado no ocurrió. Y dos lecturas del árbol se comen el error igual,
así que un refresco fallido deja la pantalla mostrando datos viejos sin decirlo.

**Detectado el 2026-09-20** investigando la tanda de i18n, y dejado fuera de ella a propósito para no
mezclar una traducción con un arreglo de comportamiento.

---

## 1. Radio de impacto

**Un solo archivo de producción, y esto está barrido, no supuesto.** Los cuatro barridos que lo
establecen, con su comando, para que se puedan repetir:

| Barrido | Comando | Resultado |
| :--- | :--- | :--- |
| Llamadas `await …Action(` sin asignar | `grep -rn "^\s*await [a-zA-Z]*Action(" src --include="*.tsx" --include="*.ts"` | **3, todas en este archivo** (`:141`, `:152`, `:279`) |
| `const x = await …Action(` sin consultar `x.success` en las 25 líneas siguientes | script ad-hoc sobre los 28 `.tsx`/`.ts` que llaman acciones | **0** |
| Acciones con `.then( res => … )` | `grep -rn "Action(.*).then"` | 4 (`useSubscriptions.ts:55,77,97`, `AddSubscriptionModal.tsx:208`), **las cuatro chequean `res.success`** |
| `Promise.all` en componentes cliente y en las 8 `page.tsx` | `grep -rn "Promise.all"` | Las páginas destructuran y chequean (`settings/page.tsx:31-32` es el molde). Los dos `Promise.all` de `CreateFinancialEntityForm` y `AddSubscriptionModal` son `fetch` a Brandfetch, **no devuelven `Result`** y su `.catch( () => [] )` es degradación deliberada del autocompletado |

Es decir: **el resto del repo maneja bien el `Result`.** Este archivo es la excepción.

| Archivo | Qué le pasa |
| :--- | :--- |
| `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx` | Estado `actionError` nuevo, cinco sitios que pasan a mirar el resultado, dos lugares donde se pinta el error |
| `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx` | **Cinco casos nuevos.** Los tres que ya existen no se tocan |
| `docs/TECHNICAL_DEBT.md` | Una viñeta nueva (paso 7), que **no** es esta corrección |
| `docs/trabajo-en-vuelo.md` | Rama y próximo paso, **en el mismo commit** |

**El `.module.css` no se toca, y hay motivo:** `.container` (`:1-6`) ya es `display: flex` con
`flex-direction: column` y `gap`, y `.archiveModalContent` (`:426-430`) también con `gap: 1rem`; el
banner es un hijo más y lo espacia el `gap` del padre. Encima `FormError` trae su propio
`margin-bottom: 0.9375rem` (`Form.module.css:114-123`). **No hace falta ninguna clase nueva, y no se
agrega `style={{ … }}`**: el §4 lo prohíbe estrictamente salvo valores dinámicos de runtime.

**No hay claves de diccionario nuevas.** Todo lo que se muestra es `res.error`, que hoy es prosa
española del servidor: eso es exactamente la deuda declarada el 2026-09-20 en `TECHNICAL_DEBT.md` §3 y
**esta tanda no la abre ni la parchea localmente**. Los tres diccionarios quedan intactos.

---

## 2. Las cuatro decisiones, tomadas por precedente del repo

Ninguna es una decisión de producto abierta: las cuatro ya están resueltas en código, y el plan cita
dónde. **Seguir el precedente, no inventar.**

1.  **El error de una acción disparada desde una lista se pinta con `FormError` alimentado por un estado
    `actionError: string | null`.** Está tres veces en el repo, idéntico:
    `PendingInstallmentsInbox.tsx:62,74-85,155-159`, `PendingLoanSettlementsInbox.tsx:69,110-125,230` y
    `PendingOccurrencesInbox.tsx:65,85-97,205-207`. **No hay sistema de avisos ni toasts**: el
    `NotificationsContext` de este repo es la bandeja de dominio (`markAsSent`, `confirmReceipt`,
    `unreadCount`) y **no** un canal de errores. No usarlo para esto.
2.  **El modal que falla se queda abierto con el error adentro.** Precedente en el propio archivo:
    `handleUpdateCategory` (`:258-261`) hace `if( !res.success ) { setFormError( res.error ) ; return ; }`
    dentro del `try`, y el `finally` apaga el spinner igual. Se copia esa forma exacta, incluido el
    `return` dentro del `try`.
3.  **Un estado optimista se revierte cuando el servidor rechaza.** Precedente:
    `useSubscriptions.ts:70-73,81-82` y `:90-93,99-100` guarda un snapshot y lo restaura. Acá el único estado
    optimista es la casilla «Ver archivadas», que se marca *antes* de consultar: si la consulta falla,
    la casilla vuelve a como estaba.
4.  **Dos estados separados, no uno compartido.** `formError` es el canal de los modales y ya se pinta
    en los tres modales de formulario; `actionError` es el canal del panel. Con un solo estado, el
    mismo texto se renderizaría en el panel y dentro del modal a la vez, y `getByText` pasaría a
    encontrar dos nodos. **Un estado, un lugar donde se pinta.**

### Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Un sistema de toasts, o colgar el error del `NotificationsContext` | Ese contexto es la bandeja de dominio, no un canal de errores. El repo pinta errores con `FormError` y nada más |
| Una clase CSS nueva, o un `style={{ marginBottom: … }}` | El `gap` del padre ya espacia el banner, y el §4 prohíbe el CSS inline. Sí: `PendingInstallmentsInbox.tsx:156` lo hace con `style` inline — **es una violación del §4, no un modelo a copiar.** Va a deuda en el paso 7 |
| Claves de diccionario para los errores | Se muestra `res.error` crudo. Traducirlo es el refactor transversal ya declarado como deuda; abrirlo acá lo dejaría a medias en un solo archivo |
| Un `try/catch` alrededor de las acciones | Las acciones devuelven `Result`, no lanzan (`src/shared/lib/result.ts`). El `try/finally` que ya existe es para el spinner, y se conserva tal cual |
| Tocar los tres modales de formulario, o `handleCreateParent` / `handleCreateChild` / `handleUpdateCategory` | Ya chequean `res.success` correctamente. **No se refactorizan** |
| Sacar el `NotificationsProvider` que envuelve el `render()` del test | Hoy es vestigial —ningún componente del árbol usa `useNotifications`— pero quitarlo es otro cabo. **Dejarlo donde está** |
| Tocar `docs/patterns.md` | El patrón `actionError` + `FormError` ya existe tres veces y el §12 no cambia. Si se quisiera documentar, es otra ronda |

---

## 3. Paso 1 — El estado nuevo

En el bloque de `useState` del cuerpo del componente, **justo debajo de `isActionLoading`**
(`:43`), agregar:

```ts
  const [ actionError , setActionError ]                   = useState< string | null >( null ) ;
```

**Alinear el `=` a la columna del bloque** —la que fija la línea de `selectedParentId`—, como manda la
regla de alineación por columnas del §4.

---

## 4. Paso 2 — Los tres sitios de escritura

Ubicar por el nombre del handler, **no por el número de línea**: los números se corren en cuanto el
paso 1 inserta la suya.

### `handleConfirmArchive` (hoy `:133-147`)

El error va al **modal**, que se queda abierto. Queda así:

```ts
  const handleConfirmArchive = async () => {
    if( !archiveTargetCat ) {
      return ;
    }

    const catId = archiveTargetCat.id ;
    setFormError( "" ) ;
    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await archiveCategoryAction( { id: catId } ) ;
      if( !res.success ) {
        setFormError( res.error ) ;
        return ;
      }

      await refreshTree() ;
      setArchiveTargetCat( null ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;
```

**Por qué limpia los dos estados:** `formError` porque es donde va a escribir, y `actionError` porque
un archivado que ahora sí funciona no debe dejar atrás el banner de un intento anterior.

### `handleUnarchive` (hoy `:149-157`)

No hay modal abierto: el error va al **panel**.

```ts
  const handleUnarchive = async ( id: string ) => {
    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await unarchiveCategoryAction( { id } ) ;
      if( !res.success ) {
        setActionError( res.error ) ;
        return ;
      }

      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;
```

Se llama desde **dos** lugares —el botón de la ficha del padre y el de cada hija—, y los dos quedan
cubiertos con este único cambio. No hay que tocar el JSX de ninguno de los dos botones.

### `handleApplyVisualChanges` (hoy `:272-289`)

```ts
    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await updateCategoryAction( {
        id:    activeParent.id ,
        icon:  ( quickIcon.trim() || null ) ,
        color: ( quickColor.trim() || null ) ,
      } ) ;

      if( !res.success ) {
        setActionError( res.error ) ;
        return ;
      }

      setCustomVisuals( null ) ;
      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
```

**El `setCustomVisuals( null )` queda después del chequeo, a propósito:** si el guardado falla, lo que
el usuario tipeó sigue en pantalla para que pueda reintentar. Descartarlo le borraría la edición
además de perderla.

---

## 5. Paso 3 — Los dos sitios de lectura

Hoy se comen el error del `getCategoryTreeAction` con un `if( res.success )` sin `else`.

### `refreshTree` (hoy `:83-88`)

```ts
  const refreshTree = async () => {
    const res = await getCategoryTreeAction( { includeArchived: showArchived } ) ;
    if( res.success ) {
      setTree( res.value ) ;
    } else {
      setActionError( res.error ) ;
    }
  } ;
```

Importa porque `refreshTree` corre **después** de una escritura exitosa: si el refresco falla, el dato
se guardó pero la pantalla muestra lo viejo, y hoy eso es indistinguible de que no se guardó nada.

### `handleToggleArchived` (hoy `:69-80`)

```ts
  const handleToggleArchived = async ( checked: boolean ) => {
    setActionError( null ) ;
    setShowArchived( checked ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await getCategoryTreeAction( { includeArchived: checked } ) ;
      if( res.success ) {
        setTree( res.value ) ;
      } else {
        setShowArchived( !checked ) ;
        setActionError( res.error ) ;
      }
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;
```

La casilla se marca antes de consultar; si la consulta falla, **vuelve atrás** (decisión 3). Sin eso, la
casilla dice «estoy mostrando las archivadas» sobre un árbol que no las tiene.

---

## 6. Paso 4 — `handleOpenArchiveModal` limpia el error del modal

En `handleOpenArchiveModal` (hoy `:116-131`), agregar `setFormError( "" ) ;` junto a los otros tres
`set…` de apertura. **Es un arreglo que el paso 2 vuelve visible:** ese handler nunca limpió
`formError`, así que sin esto un error dejado por el modal de renombrar aparecería dentro del modal de
archivado la próxima vez que se abra.

---

## 7. Paso 5 — Los dos lugares donde se pinta

Usar el idioma del propio archivo, `{ cond && <FormError … /> }`, que es como se pintan hoy los tres
modales de formulario. **No** el ternario `? … : null` de los inboxes.

1.  **Banner del panel.** Entre el `</div>` que cierra la barra de herramientas (`:330`) y el comentario
    `{/* Disposición en dos columnas */}` (`:332`), como hijo directo de `.container`:

    ```tsx
      {actionError && <FormError error={actionError} />}
    ```

2.  **Dentro del modal de archivado.** Como **primer** hijo de `<div className={styles.archiveModalContent}>`
    (hoy `:732`), antes del `<p className={styles.archiveWarning}>`:

    ```tsx
          {formError && <FormError error={formError} />}
    ```

`FormError` ya está importado en el archivo (`:17`). **No hay imports nuevos.**

---

## 8. Paso 6 — Los tests

**La regla, antes de la lista:** todo camino de fallo que el paso 2 y el paso 3 introducen lleva su
caso. La enumeración de abajo son esos casos, y es exhaustiva **respecto de los cinco sitios**; si al
escribirla aparece un sexto camino, se cubre también. *(La tanda anterior de este mismo archivo se
comió una aserción justamente porque el plan trató una enumeración como límite en vez de como
ejemplo.)*

### Preparación

1.  **Agregar al import de acciones** (hoy trae tres) `unarchiveCategoryAction` y
    `updateCategoryAction`, que ya están en la factory del `vi.mock` pero no se importaban:

    ```ts
    import {
      getCategoryTreeAction ,
      archiveCategoryAction ,
      unarchiveCategoryAction ,
      updateCategoryAction ,
      getCategoryMovementsCountAction
    } from "../../actions/categoryActions" ;
    ```

2.  **Un fixture con una categoría archivada**, que hoy no existe: ninguna entrada de `sampleTree`
    tiene `archivedAt`. Declararlo después de `sampleTree`:

    ```ts
    const archivedTree: CategoryTreeNode[] = [
      { ...sampleTree[0] , archivedAt: new Date() } ,
    ] ;
    ```

3.  **El texto del error es una constante local del test, no una clave del diccionario** — es prosa que
    devuelve el servidor. Declarar arriba del `describe` o dentro, como se prefiera:

    ```ts
    const ERROR_SERVIDOR = "La categoría tiene movimientos asociados." ;
    ```

    Y afirmar sobre él con `screen.getByText( ERROR_SERVIDOR )`. **No buscarlo en `dict`**: no está, y
    ponerlo ahí es justo la deuda que esta tanda no abre.

4.  El molde de mock es el que ya usa el archivo: `vi.mocked( X ).mockResolvedValue( { success: false , error: ERROR_SERVIDOR } )`.

### Los cinco casos

| Caso | Montaje | Qué afirma |
| :--- | :--- | :--- |
| `el archivado rechazado muestra el error y no cierra el modal` | `getCategoryMovementsCountAction` → `ok(14)`; `archiveCategoryAction` → `fail(ERROR_SERVIDOR)` | Aparece `ERROR_SERVIDOR`; el modal sigue abierto (el título `archiveTitle.replace( "{name}" , "Vivienda" )` todavía está); y **`getCategoryTreeAction` no fue llamado** — es la prueba de que no refrescó como si hubiera funcionado |
| `el desarchivado rechazado muestra el error en el panel` | `renderContainer( archivedTree )`; `unarchiveCategoryAction` → `fail(ERROR_SERVIDOR)`. El botón es `getByRole( "button" , { name: dict.settingsPage.categories.unarchive } )` | Aparece `ERROR_SERVIDOR` y `getCategoryTreeAction` no fue llamado |
| `el guardado de ícono y color rechazado conserva lo tipeado` | `updateCategoryAction` → `fail(ERROR_SERVIDOR)`. Tipear en `getByPlaceholderText( dict.settingsPage.categories.iconPlaceholder )` y apretar `getByRole( "button" , { name: dict.settingsPage.categories.save } )` | Aparece `ERROR_SERVIDOR` y el input **mantiene el valor tipeado** (`customVisuals` no se limpió) |
| `la casilla Ver archivadas vuelve atrás si la consulta falla` | `getCategoryTreeAction` → `fail(ERROR_SERVIDOR)`; click en la casilla | Aparece `ERROR_SERVIDOR` y `( checkbox as HTMLInputElement ).checked` es `false` |
| `un refresco fallido tras archivar avisa en vez de callarse` | `getCategoryMovementsCountAction` → `ok(14)`; `archiveCategoryAction` → `ok(...)`; `getCategoryTreeAction` → `fail(ERROR_SERVIDOR)` | El archivado se ejecutó (`toHaveBeenCalledWith( { id: "cat-exp-1" } )`) **y** aparece `ERROR_SERVIDOR` |

> El `placeholder` es la única forma de agarrar el input de ícono: su `<label className={styles.controlLabel}>`
> no tiene `htmlFor`, así que `getByLabelText` no lo encuentra. Con la casilla «Ver archivadas» sí
> funciona `getByLabelText`, porque el `<label>` envuelve al input — el tercer test que ya existe lo usa.

**Los tres casos que ya existen no se tocan.**

---

## 9. Paso 7 — Los documentos

1.  **`docs/TECHNICAL_DEBT.md`, viñeta nueva** (no cierra ninguna existente: este defecto nunca estuvo
    registrado, se detectó el 2026-09-20 investigando la i18n). La deuda que sí hay que abrir es la que
    el barrido destapó de paso, y **no es lo que esta tanda arregla**:

    > `[ ] **CSS inline estático en JSX, contra el §4:** el §4 de `.agents/AGENTS.md` prohíbe
    > `style={{…}}` salvo valores dinámicos de runtime, y hay layout estático escrito así. Verificados a
    > mano: `PendingInstallmentsInbox.tsx:156,221,237`, `CardFormModal.tsx:198`,
    > `InstallmentPlansModal.tsx:112` y `CardVisual.tsx:79`. Un barrido heurístico marca ~22 casos en 13
    > archivos, **con falsos positivos** (`AccountsContainer.tsx:245` es `style={cardStyle}`, dinámico):
    > el conteo exacto es parte de cerrarla. Detectado el 2026-09-21.*

2.  **`docs/trabajo-en-vuelo.md`:** rama y próximo paso, **en el mismo commit** que el código.

> **`docs/patterns.md` no se toca** (ver la tabla del §2).

---

## 10. Verificación literal

**Entorno primero.** Sin el contenedor `postgres-dev` la suite muere en el setup: eso es entorno
caído, no suite roja.

```bash
podman ps --filter name=postgres-dev --format "{{.Names}} {{.Status}}"
```

### La batería, los cuatro, en este orden

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

`pnpm build` **no es typecheck**: no tipa los archivos de test. `tsc --noEmit` va como comando propio
porque es lo que corre la compuerta (`.github/workflows/compuerta.yml:62`).

```bash
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
```

### El archivo de test, por separado

```bash
pnpm exec vitest run src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx
```

Hoy son **3 tests** en ese archivo y el total de la suite es **485 en 68 archivos** (verificado el
2026-09-21). Con los cinco casos nuevos deberían quedar **8 en el archivo** y **490 en 68 archivos**,
sin archivos nuevos. **Pegar el número que imprime vitest, no el que dice este plan:** un total
predicho mal convierte una corrida sana en una discrepancia que hay que investigar.

### Que no quedó ningún `Result` descartado

```bash
grep -rn "^\s*await [a-zA-Z]*Action(" src --include="*.tsx" --include="*.ts"
```

Salida esperada: **vacía**. Hoy devuelve tres líneas, las tres de este archivo.

```bash
grep -c "res.success" src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx
```

Hoy imprime **6**; con los tres chequeos nuevos tiene que imprimir **9**. Es una confirmación, no una
meta: si da otro número, se explica en el reporte en vez de forzarlo.

### Que no se colaron ni CSS inline ni claves de diccionario

```bash
grep -n "style={" src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx
git diff --stat src/dictionaries/
```

Las dos salidas tienen que ser **vacías**: ni un `style` inline en el componente, ni una línea tocada en
los tres diccionarios.

> **El reporte pega la salida cruda de cada comando, no la describe.**

---

## 11. Criterio de terminado

*   Los cuatro comandos de la batería en verde, con sus números exactos pegados.
*   El grep de `await …Action(` vacío, y `res.success` en 9.
*   Los cinco casos nuevos verdes, y los tres viejos intactos y verdes.
*   Sin `style={` en el componente y sin cambios en `src/dictionaries/`.
*   `TECHNICAL_DEBT.md` con la viñeta del CSS inline abierta.
*   `trabajo-en-vuelo.md` actualizado **en el mismo commit**.
