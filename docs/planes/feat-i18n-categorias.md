# Plan — Internacionalizar `CategoriesSettingsContainer`

**Rama:** `feat/i18n-categorias` · **Escrito:** 2026-09-20 · **Cierra:**
[`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) §3, tercera viñeta.

No hay RFC: esto no agrega comportamiento, traduce el que ya existe. El contrato que sí gobierna es
el **§12 de [`patterns.md`](../patterns.md)** (montaje de tests de componentes cliente), y los cinco
puntos de sus reglas se cumplen al pie.

---

## 0. Qué se hace y qué no

`CategoriesSettingsContainer.tsx` son 766 líneas con cadenas en español directo por todos lados: **58 textos distintos**, repartidos en ~70 ocurrencias. Es el último
resto de i18n de `/settings`: la ruta ya llama a `getDictionary` desde la tanda 2 del RFC 024, el
shell `SettingsContainer` localiza cabecera y tabs, y el panel hermano `LedgerAuditPanel` ya recibe
`dict`. **El cableado existe; falta enchufarlo.**

**Fuera de alcance, por decisión del usuario del 2026-09-20:** los **23 `fail()`** de
`categoryActions.ts` devuelven la frase de error en español y `FormError` la pinta cruda. Traducirlos
exige cambiar el contrato de `Result.error` de frase humana a código, y ese contrato se repite **201
veces en 13 archivos**. Es un refactor transversal con RFC propio. Esta tanda **no lo toca** y lo
declara como deuda (paso 6). Es el mismo límite con el que se internacionalizó `/cards` en la tanda 2
del RFC 025.

---

## 1. Radio de impacto

Seis archivos, y **ninguno más**. Verificado con `grep -rn "CategoriesSettingsContainer" src`: el
único consumidor del componente es `SettingsContainer.tsx:66`.

| Archivo | Qué le pasa |
| :--- | :--- |
| `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx` | Recibe `dict`, consume las claves nuevas |
| `src/features/settings/components/SettingsContainer.tsx` | Línea 66: pasa `dict={dict}` |
| `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx` | **Rompe seguro.** Sin `dict` no compila, y seis aserciones buscan las cadenas a mano |
| `src/dictionaries/es.json` | Bloque `settingsPage.categories` |
| `src/dictionaries/en.json` | Ídem |
| `src/dictionaries/br.json` | Ídem |

**El `.module.css` no se toca.** Ninguna clase cambia: sólo cambia el texto dentro de los nodos.

**`SettingsContainer.test.tsx` no se toca.** Monta el panel indirecto en su primer caso, pero sus
aserciones son sobre **datos** del fixture (`"Vivienda"`, `"Alquiler"`, `"1.1.01.01"`), no sobre
chrome traducible. Ya pasa `dict={dict}` al shell, así que la prop nueva le llega sola. Entra igual
en la verificación del paso 7 para confirmarlo.

### Tres cosas que este plan decide, para que no se decidan sobre la marcha

1.  **Las claves van anidadas en `settingsPage.categories.*`**, no planas dentro de `settingsPage`.
    Precedente en el repo: `loansPage.settlement` y `cardsPage.installments`. Son **58 claves**; planas
    sepultarían las 20 que `settingsPage` ya tiene.
2.  **La interpolación se hace con `.replace( "{clave}" , String( valor ) )`.** Es el único patrón de
    interpolación que existe en el repo — `LoansContainer.tsx:350-351` y
    `PendingLoanSettlementsInbox.tsx:150`. **No hay helper de i18n y no se escribe uno.**
3.  **El componente recibe `dict` pero NO `lang`.** El §12.1 de `patterns.md` dice «`dict` como prop
    obligatoria (y `lang` correspondiente)», pero el panel hermano `LedgerAuditPanel.tsx:23-25` sólo
    declara `dict`, y este componente **no formatea un solo número, importe ni fecha**: el único
    número que pinta es `realCount`, crudo. Se sigue el precedente del código, no la lectura literal
    del doc. **No agregar `lang`.**

### Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Un helper `t()` o `interpolate()` | El repo interpola con `String.replace` y nada más |
| Un `FALLBACK_DICT` o `dict?:` opcional | `patterns.md` §12.1 lo prohíbe explícito. La prop es **obligatoria** |
| Un `as unknown as` sobre la forma de `dict` | Mismo §12.1: apaga la única verificación de que las tres claves existen |
| Traducir los placeholders de color (`"#3498db"`, `"#e67e22"`, `"#f39c12"`) | Son valores hexadecimales de ejemplo, no prosa. **Quedan hardcodeados en el JSX** |
| Traducir los nombres de las categorías | Vienen de la base (`parent.name`, `child.name`). Son datos de la organización |
| Tocar `categoryActions.ts` | Fuera de alcance, §0 |
| Tocar el `.module.css` | Ninguna clase cambia |
| Arreglar los `Result` ignorados | Es un hallazgo aparte; va a deuda en el paso 6, no se corrige acá |

---

## 2. Paso 1 — El bloque de diccionario, en los tres archivos

**Los tres, siempre los tres.** El tipo de `dict` es la *unión* de `es | en | br`: una clave que
exista en un solo archivo **no compila** — `tsc --noEmit` la rechaza, y es lo que corre la compuerta.

Insertar el objeto `"categories"` **dentro de `settingsPage`**, después de `"ledgerEmpty"`.

### `src/dictionaries/es.json`

```json
"categories": {
  "searchPlaceholder": "Buscar categoría o subcategoría...",
  "showArchived": "Ver archivadas",
  "newParent": "+ Nueva categoría principal",
  "groupExpense": "Gastos",
  "groupRevenue": "Ingresos",
  "archivedBadge": "Archivada",
  "emptySearchTitle": "Sin resultados",
  "emptySearchDescription": "No encontramos categorías que coincidan con tu búsqueda.",
  "emptyDetailTitle": "Ninguna categoría seleccionada",
  "emptyDetailDescription": "Seleccioná una categoría de la columna izquierda para ver y editar sus detalles.",
  "typeBadgeExpense": "Categoría de Gastos",
  "typeBadgeRevenue": "Categoría de Ingresos",
  "archivedSuffix": "· ARCHIVADA",
  "rename": "Renombrar",
  "archive": "Archivar",
  "unarchive": "Desarchivar",
  "iconLabel": "Ícono visual",
  "iconPlaceholder": "Emoji o nombre",
  "colorLabel": "Color distintivo",
  "save": "Guardar",
  "subcategoriesTitle": "Subcategorías",
  "addChild": "+ Agregar subcategoría",
  "systemLeafName": "Sin detallar",
  "systemLeafTag": "Sistema",
  "createParentTitle": "Nueva Categoría Principal",
  "createParentSubtitle": "Creá una categoría raíz de primer nivel en el árbol contable",
  "nameLabel": "Nombre de la categoría",
  "namePlaceholder": "Ej: Impuestos, Movilidad, Salidas...",
  "typeLabel": "Tipo contable",
  "optionExpense": "Gasto",
  "optionRevenue": "Ingreso",
  "iconOptionalLabel": "Ícono (opcional)",
  "iconParentPlaceholder": "Ej: 🚗 o truck",
  "colorOptionalLabel": "Color (hexadecimal opcional)",
  "submitCreateParent": "Crear Categoría",
  "createChildTitle": "Nueva subcategoría en {parent}",
  "createChildSubtitle": "Creá una subcategoría de segundo nivel vinculada a este padre",
  "childNameLabel": "Nombre de la subcategoría",
  "childNamePlaceholder": "Ej: Combustible, Colectivo, Subte...",
  "iconChildPlaceholder": "Ej: ⛽ o fuel",
  "submitCreateChild": "Agregar Subcategoría",
  "renameTitle": "Renombrar Categoría",
  "renameSubtitle": "Actualizá el nombre visible de la categoría y sus cuentas contables",
  "renameNameLabel": "Nombre",
  "submitRename": "Guardar Cambios",
  "archiveTitle": "Archivar \"{name}\"",
  "archiveSubtitle": "Confirmación de baja lógica con impacto contable",
  "archiveWarningParent": "Esta categoría principal dejará de ofrecerse en nuevos registros.",
  "archiveWarningParentStrong": "Archivar un padre archiva en cascada todas sus subcategorías.",
  "archiveWarningChild": "Esta subcategoría dejará de ofrecerse en los selectores de transacciones.",
  "archiveCounting": "Consultando movimientos contables en el libro mayor...",
  "archiveMovements": "Movimientos registrados: {count}",
  "submitArchive": "Confirmar archivado",
  "cancel": "Cancelar",
  "errorNameRequired": "Ingresá un nombre para la categoría.",
  "errorChildNameRequired": "Ingresá un nombre para la subcategoría.",
  "errorNameInvalid": "Ingresá un nombre válido.",
  "errorColorInvalid": "El color debe ser un hexadecimal de 6 caracteres (ej: #3498db)."
}
```

### `src/dictionaries/en.json`

```json
"categories": {
  "searchPlaceholder": "Search category or subcategory…",
  "showArchived": "Show archived",
  "newParent": "+ New main category",
  "groupExpense": "Expenses",
  "groupRevenue": "Revenue",
  "archivedBadge": "Archived",
  "emptySearchTitle": "No results",
  "emptySearchDescription": "We couldn't find any categories matching your search.",
  "emptyDetailTitle": "No category selected",
  "emptyDetailDescription": "Select a category from the left column to view and edit its details.",
  "typeBadgeExpense": "Expense category",
  "typeBadgeRevenue": "Revenue category",
  "archivedSuffix": "· ARCHIVED",
  "rename": "Rename",
  "archive": "Archive",
  "unarchive": "Unarchive",
  "iconLabel": "Display icon",
  "iconPlaceholder": "Emoji or name",
  "colorLabel": "Accent color",
  "save": "Save",
  "subcategoriesTitle": "Subcategories",
  "addChild": "+ Add subcategory",
  "systemLeafName": "Unspecified",
  "systemLeafTag": "System",
  "createParentTitle": "New Main Category",
  "createParentSubtitle": "Create a top-level root category in the chart of accounts",
  "nameLabel": "Category name",
  "namePlaceholder": "e.g. Taxes, Transport, Going out…",
  "typeLabel": "Accounting type",
  "optionExpense": "Expense",
  "optionRevenue": "Revenue",
  "iconOptionalLabel": "Icon (optional)",
  "iconParentPlaceholder": "e.g. 🚗 or truck",
  "colorOptionalLabel": "Color (optional hex)",
  "submitCreateParent": "Create Category",
  "createChildTitle": "New subcategory under {parent}",
  "createChildSubtitle": "Create a second-level subcategory linked to this parent",
  "childNameLabel": "Subcategory name",
  "childNamePlaceholder": "e.g. Fuel, Bus, Subway…",
  "iconChildPlaceholder": "e.g. ⛽ or fuel",
  "submitCreateChild": "Add Subcategory",
  "renameTitle": "Rename Category",
  "renameSubtitle": "Update the display name of the category and its ledger accounts",
  "renameNameLabel": "Name",
  "submitRename": "Save Changes",
  "archiveTitle": "Archive \"{name}\"",
  "archiveSubtitle": "Soft-delete confirmation with accounting impact",
  "archiveWarningParent": "This main category will no longer be offered on new records.",
  "archiveWarningParentStrong": "Archiving a parent cascades the archive to all its subcategories.",
  "archiveWarningChild": "This subcategory will no longer be offered in transaction selectors.",
  "archiveCounting": "Checking ledger entries in the general ledger…",
  "archiveMovements": "Recorded entries: {count}",
  "submitArchive": "Confirm archive",
  "cancel": "Cancel",
  "errorNameRequired": "Enter a name for the category.",
  "errorChildNameRequired": "Enter a name for the subcategory.",
  "errorNameInvalid": "Enter a valid name.",
  "errorColorInvalid": "The color must be a 6-character hexadecimal value (e.g. #3498db)."
}
```

### `src/dictionaries/br.json`

```json
"categories": {
  "searchPlaceholder": "Buscar categoria ou subcategoria…",
  "showArchived": "Ver arquivadas",
  "newParent": "+ Nova categoria principal",
  "groupExpense": "Despesas",
  "groupRevenue": "Receitas",
  "archivedBadge": "Arquivada",
  "emptySearchTitle": "Sem resultados",
  "emptySearchDescription": "Não encontramos categorias que correspondam à sua busca.",
  "emptyDetailTitle": "Nenhuma categoria selecionada",
  "emptyDetailDescription": "Selecione uma categoria na coluna da esquerda para ver e editar seus detalhes.",
  "typeBadgeExpense": "Categoria de despesas",
  "typeBadgeRevenue": "Categoria de receitas",
  "archivedSuffix": "· ARQUIVADA",
  "rename": "Renomear",
  "archive": "Arquivar",
  "unarchive": "Desarquivar",
  "iconLabel": "Ícone visual",
  "iconPlaceholder": "Emoji ou nome",
  "colorLabel": "Cor distintiva",
  "save": "Salvar",
  "subcategoriesTitle": "Subcategorias",
  "addChild": "+ Adicionar subcategoria",
  "systemLeafName": "Sem detalhar",
  "systemLeafTag": "Sistema",
  "createParentTitle": "Nova Categoria Principal",
  "createParentSubtitle": "Crie uma categoria raiz de primeiro nível na árvore contábil",
  "nameLabel": "Nome da categoria",
  "namePlaceholder": "Ex: Impostos, Transporte, Lazer…",
  "typeLabel": "Tipo contábil",
  "optionExpense": "Despesa",
  "optionRevenue": "Receita",
  "iconOptionalLabel": "Ícone (opcional)",
  "iconParentPlaceholder": "Ex: 🚗 ou truck",
  "colorOptionalLabel": "Cor (hexadecimal opcional)",
  "submitCreateParent": "Criar Categoria",
  "createChildTitle": "Nova subcategoria em {parent}",
  "createChildSubtitle": "Crie uma subcategoria de segundo nível vinculada a este pai",
  "childNameLabel": "Nome da subcategoria",
  "childNamePlaceholder": "Ex: Combustível, Ônibus, Metrô…",
  "iconChildPlaceholder": "Ex: ⛽ ou fuel",
  "submitCreateChild": "Adicionar Subcategoria",
  "renameTitle": "Renomear Categoria",
  "renameSubtitle": "Atualize o nome visível da categoria e de suas contas contábeis",
  "renameNameLabel": "Nome",
  "submitRename": "Salvar Alterações",
  "archiveTitle": "Arquivar \"{name}\"",
  "archiveSubtitle": "Confirmação de baixa lógica com impacto contábil",
  "archiveWarningParent": "Esta categoria principal deixará de ser oferecida em novos registros.",
  "archiveWarningParentStrong": "Arquivar um pai arquiva em cascata todas as suas subcategorias.",
  "archiveWarningChild": "Esta subcategoria deixará de ser oferecida nos seletores de transações.",
  "archiveCounting": "Consultando lançamentos contábeis no livro razão…",
  "archiveMovements": "Lançamentos registrados: {count}",
  "submitArchive": "Confirmar arquivamento",
  "cancel": "Cancelar",
  "errorNameRequired": "Digite um nome para a categoria.",
  "errorChildNameRequired": "Digite um nome para a subcategoria.",
  "errorNameInvalid": "Digite um nome válido.",
  "errorColorInvalid": "A cor deve ser um hexadecimal de 6 caracteres (ex: #3498db)."
}
```

> **Los `{parent}`, `{name}` y `{count}` son literales**, con llaves, dentro del JSON. Se sustituyen
> en el componente con `.replace()`. **No son sintaxis de plantilla de ninguna librería.**

---

## 3. Paso 2 — La prop en el componente

En `CategoriesSettingsContainer.tsx`:

1.  Agregar al bloque `// Shared` de imports, respetando la pirámide invertida por longitud de línea:

    ```ts
    import type { getDictionary } from "@/shared/lib/dictionary" ;
    ```

2.  Extender la interfaz de props (molde exacto: `LedgerAuditPanel.tsx:23-26`):

    ```ts
    export interface CategoriesSettingsContainerProps {
      initialTree: CategoryTreeNode[] ;
      dict:        Awaited< ReturnType< typeof getDictionary > > ;
    }
    ```

3.  Desestructurar `dict` en la firma, después de `initialTree`.

4.  Para no repetir `dict.settingsPage.categories` sesenta veces, declarar **una sola constante** al
    principio del cuerpo, antes de los `useState`:

    ```ts
    const t = dict.settingsPage.categories ;
    ```

---

## 4. Paso 3 — Las sustituciones, una por una

Las líneas son las del archivo **antes** de editarlo; se corren a medida que se insertan los imports.
Ubicar por el texto, no por el número.

### Validaciones de formulario (cuerpo del componente)

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 159 | `"Ingresá un nombre para la categoría."` | `t.errorNameRequired` |
| 164 | `"El color debe ser…"` | `t.errorColorInvalid` |
| 201 | `"Ingresá un nombre para la subcategoría."` | `t.errorChildNameRequired` |
| 206 | `"El color debe ser…"` | `t.errorColorInvalid` |
| 243 | `"Ingresá un nombre válido."` | `t.errorNameInvalid` |

### Barra de herramientas

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 296 | `placeholder="Buscar categoría o subcategoría..."` | `placeholder={t.searchPlaceholder}` |
| 307 | `<span>Ver archivadas</span>` | `<span>{t.showArchived}</span>` |
| 323 | `+ Nueva categoría principal` | `{t.newParent}` |

### Columna izquierda

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 334 | `>Gastos<` | `>{t.groupExpense}<` |
| 368 | `>Ingresos<` | `>{t.groupRevenue}<` |
| 352 y 386 | `>Archivada<` | `>{t.archivedBadge}<` — **son dos ocurrencias, las dos** |
| 402-403 | `title="Sin resultados"` / `description="No encontramos…"` | `title={t.emptySearchTitle}` / `description={t.emptySearchDescription}` |

### Ficha del padre activo

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 424 | `? "Categoría de Gastos" : "Categoría de Ingresos"` | `? t.typeBadgeExpense : t.typeBadgeRevenue` |
| 425 | `{activeParent.archivedAt && " · ARCHIVADA"}` | `{activeParent.archivedAt && ` ${t.archivedSuffix}`}` — **el espacio de separación va en el template literal del JSX**, porque la clave del diccionario no lo lleva |
| 439 | `Renombrar` | `{t.rename}` |
| 448 | `Desarchivar` | `{t.unarchive}` |
| 455 | `Archivar` | `{t.archive}` |
| 464 | `<label …>Ícono visual</label>` | `{t.iconLabel}` |
| 473 | `placeholder="Emoji o nombre"` | `placeholder={t.iconPlaceholder}` |
| 479 | `<label …>Color distintivo</label>` | `{t.colorLabel}` |
| 498 | `placeholder="#3498db"` | **NO SE TOCA.** Valor hexadecimal |
| 505 | `Guardar` | `{t.save}` |

### Subcategorías

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 514 | `>Subcategorías<` | `>{t.subcategoriesTitle}<` |
| 525 | `+ Agregar subcategoría` | `{t.addChild}` |
| 540 | `>Archivada<` | `>{t.archivedBadge}<` — **tercera ocurrencia, la de las hijas** |
| 554 | `Renombrar` | `{t.rename}` |
| 563 | `Desarchivar` | `{t.unarchive}` |
| 571 | `Archivar` | `{t.archive}` |
| 587 | `>Sin detallar<` | `>{t.systemLeafName}<` |
| 588 | `>Sistema<` | `>{t.systemLeafTag}<` |
| 597-598 | `title="Ninguna categoría seleccionada"` / `description="Seleccioná…"` | `title={t.emptyDetailTitle}` / `description={t.emptyDetailDescription}` |

### Modal: nueva categoría principal

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 608-609 | `title=` / `subtitle=` | `title={t.createParentTitle}` / `subtitle={t.createParentSubtitle}` |
| 615 | `label="Nombre de la categoría"` | `label={t.nameLabel}` |
| 618 | `placeholder="Ej: Impuestos…"` | `placeholder={t.namePlaceholder}` |
| 623 | `label="Tipo contable"` | `label={t.typeLabel}` |
| 627-628 | `<option>Gasto</option>` / `<option>Ingreso</option>` | `{t.optionExpense}` / `{t.optionRevenue}` — **los `value="expense"` y `value="revenue"` NO cambian**: son la clave del estado |
| 632 | `label="Ícono (opcional)"` | `label={t.iconOptionalLabel}` |
| 635 | `placeholder="Ej: 🚗 o truck"` | `placeholder={t.iconParentPlaceholder}` |
| 639 | `label="Color (hexadecimal opcional)"` | `label={t.colorOptionalLabel}` |
| 642 | `placeholder="#e67e22"` | **NO SE TOCA** |
| 647-648 | `cancelLabel` / `submitLabel` | `cancelLabel={t.cancel}` / `submitLabel={t.submitCreateParent}` |

### Modal: agregar subcategoría

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 658 | `title={ \`Nueva subcategoría en ${activeParent?.name \|\| ""}\` }` | `title={ t.createChildTitle.replace( "{parent}" , (activeParent?.name \|\| "") ) }` |
| 659 | `subtitle=` | `subtitle={t.createChildSubtitle}` |
| 665 | `label="Nombre de la subcategoría"` | `label={t.childNameLabel}` |
| 668 | `placeholder="Ej: Combustible…"` | `placeholder={t.childNamePlaceholder}` |
| 673 | `label="Ícono (opcional)"` | `label={t.iconOptionalLabel}` |
| 676 | `placeholder="Ej: ⛽ o fuel"` | `placeholder={t.iconChildPlaceholder}` |
| 680 | `label="Color (hexadecimal opcional)"` | `label={t.colorOptionalLabel}` |
| 683 | `placeholder="#f39c12"` | **NO SE TOCA** |
| 688-689 | `cancelLabel` / `submitLabel` | `cancelLabel={t.cancel}` / `submitLabel={t.submitCreateChild}` |

### Modal: renombrar

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 699-700 | `title=` / `subtitle=` | `title={t.renameTitle}` / `subtitle={t.renameSubtitle}` |
| 706 | `label="Nombre"` | `label={t.renameNameLabel}` |
| 714-715 | `cancelLabel` / `submitLabel` | `cancelLabel={t.cancel}` / `submitLabel={t.submitRename}` |

### Modal: confirmación de archivado

| Línea | Hoy | Queda |
| :--- | :--- | :--- |
| 725 | `title={ \`Archivar "${archiveTargetCat?.name \|\| ""}"\` }` | `title={ t.archiveTitle.replace( "{name}" , (archiveTargetCat?.name \|\| "") ) }` |
| 726 | `subtitle=` | `subtitle={t.archiveSubtitle}` |
| 732-733 | El fragmento con `<strong>` | `{t.archiveWarningParent}` y `<strong> {t.archiveWarningParentStrong}</strong>` — **conservar el `<strong>` y su espacio inicial**; son dos claves porque el énfasis parte la oración |
| 736 | `"Esta subcategoría dejará…"` | `t.archiveWarningChild` |
| 742 | `"Consultando movimientos…"` | `t.archiveCounting` |
| 743 | `` `Movimientos registrados: ${archiveMovementsCount ?? 0}` `` | `t.archiveMovements.replace( "{count}" , String( archiveMovementsCount ?? 0 ) )` |
| 752 | `Cancelar` | `{t.cancel}` |
| 759 | `Confirmar archivado` | `{t.submitArchive}` |

---

## 5. Paso 4 — `SettingsContainer.tsx`

Una línea. En la 66:

```tsx
<CategoriesSettingsContainer initialTree={initialTree} dict={dict} />
```

`SettingsContainer` ya recibe `dict` en sus props (`:27`) y lo desestructura (`:36`). **No hay que
tocar nada más de ese archivo**, ni la página que lo monta.

---

## 6. Paso 5 — El test

`CategoriesSettingsContainer.test.tsx` **no compila** apenas la prop pase a ser obligatoria. Molde
exacto a copiar: `SettingsContainer.test.tsx:85-104` y `LedgerAuditPanel.test.tsx:1-14`, que ya
implementan el §12.2 de `patterns.md`.

1.  Agregar `beforeAll` a los imports de `vitest` (hoy importa `describe, it, expect, vi, beforeEach`).
2.  Agregar el bloque `// Shared` de imports con `import { getDictionary } from "@/shared/lib/dictionary" ;`
    — **el import de valor, no `import type`**, porque el test la invoca.
3.  Declarar y cargar el diccionario real dentro del `describe`:

    ```ts
    let dict: Awaited< ReturnType< typeof getDictionary > > ;

    beforeAll( async () => {
      dict = await getDictionary( "es" ) ;
    } ) ;
    ```

4.  Pasar la prop en `renderContainer`:

    ```tsx
    <CategoriesSettingsContainer initialTree={tree} dict={dict} />
    ```

5.  **Las cinco aserciones que hoy buscan la cadena a mano pasan a leerla del diccionario.** Este es
    el punto del §12.2: si mañana la clave se renombra, el test se cae en vez de pasar en falso.

| Aserción de hoy | Queda |
| :--- | :--- |
| `screen.getByText( "Sin detallar" )` | `screen.getByText( dict.settingsPage.categories.systemLeafName )` |
| `screen.getByLabelText( /Ver archivadas/i )` | `screen.getByLabelText( dict.settingsPage.categories.showArchived )` |
| `getAllByRole( "button" , { name: /^Archivar$/i } )` | `getAllByRole( "button" , { name: dict.settingsPage.categories.archive } )` — un `name` de tipo string hace **match exacto** sobre el nombre accesible normalizado, así que sigue excluyendo el título del modal `Archivar "Vivienda"`; el ancla `^…$` ya no hace falta |
| `getByText( /Movimientos registrados: 14/i )` | `getByText( dict.settingsPage.categories.archiveMovements.replace( "{count}" , "14" ) )` |
| `getByText( /archiva en cascada todas sus subcategorías/i )` | `getByText( dict.settingsPage.categories.archiveWarningParentStrong )` |

**Lo que NO se toca del test:** `getByRole( "heading" , { name: "Vivienda" , level: 2 } )`,
`getByText( "Alquiler" )`, `getByText( "Supermercado" )`, `getByRole( "button" , { name: /Alimentación/i } )`
y los `queryByText` de códigos contables. Son **datos del fixture**, no chrome traducible.

> **Trampa conocida:** `getDictionary` no lleva `server-only` — es un `import()` dinámico de JSON y
> corre bien en vitest. Está verificado en las dos suites hermanas. **No inventar un diccionario de
> respaldo dentro del test**, que es justo lo que el §12.2 prohíbe.

---

## 7. Paso 6 — Los dos documentos

1.  **`docs/TECHNICAL_DEBT.md` §3, tercera viñeta.** Tildarla y reescribirla como resuelta, con la
    forma que usa la viñeta de `/cards` justo debajo:

    > `[x] ~~**`CategoriesSettingsContainer` no está internacionalizado:**~~ Resuelto el 2026-09-20:
    > el panel recibe `dict` obligatoria y sus 58 textos viven en `settingsPage.categories` de los
    > tres diccionarios. **Queda fuera, y es deuda nueva:** los 23 `fail()` de `categoryActions.ts`
    > devuelven la frase de error en español y `FormError` la pinta cruda en los tres idiomas.
    > Traducirlos exige cambiar el contrato de `Result.error` de frase humana a código, que se repite
    > 201 veces en 13 archivos; es refactor transversal con RFC propio.*

2.  **Abrir la deuda nueva en `§3`**, como viñeta sin tildar, para que no se pierda:

    > `[ ] **Los `Result.error` son frases humanas en español, no códigos:** las 201 llamadas a
    > `fail()` de los 13 archivos de acciones devuelven prosa que la UI pinta cruda. Cualquier
    > pantalla internacionalizada queda i18n a medias en cuanto el servidor rechaza algo. Cerrarlo
    > exige un RFC que fije el contrato (código + parámetros) y el mapeo en los tres diccionarios.
    > Detectado el 2026-09-20 al internacionalizar el panel de categorías.*

3.  **`docs/trabajo-en-vuelo.md`:** rama y próximo paso. **Se actualiza en el mismo commit** que
    avanza el trabajo — un doc de estado que se actualiza después es un doc de estado que miente.

> **`docs/patterns.md` NO se toca.** Su §12 cita hoy a `CategoriesSettingsContainer.test.tsx` como
> «ejemplo de referencia» que «carga `getDictionary( "es" )` en `beforeAll`». Eso es **falso hoy** y
> esta tanda lo vuelve verdadero. No hay nada que corregir: hay que dejarlo como está.

---

## 8. Verificación literal

**Entorno primero.** `pnpm test` necesita Postgres vivo: sin el contenedor `postgres-dev` la suite
muere en el setup con `ECONNREFUSED`, y eso es **entorno caído, no suite roja**.

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

`pnpm build` **no es typecheck**: `next build` no tipa los archivos de test. `tsc --noEmit` va como
comando propio porque es lo que corre la compuerta (`.github/workflows/compuerta.yml:62`), y ya
convivió un build verde con un typecheck roto.

Contar los errores de tipo con:

```bash
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
```

### Los dos archivos de test del radio de impacto, por separado

```bash
pnpm exec vitest run src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx
pnpm exec vitest run src/features/settings/components/SettingsContainer.test.tsx
```

### Paridad de claves entre los tres diccionarios

Es la comprobación que `tsc` hace por su cuenta, pero este comando dice **cuál** clave falta en vez
de un error de unión de tipos ilegible:

```bash
python3 -c "
import json
ks = {}
for l in ['es','en','br']:
    d = json.load( open(f'src/dictionaries/{l}.json') )
    ks[l] = set( d['settingsPage']['categories'].keys() )
base = ks['es']
for l in ['en','br']:
    falta = base - ks[l] ; sobra = ks[l] - base
    print( l , 'faltan:' , sorted(falta) , '| sobran:' , sorted(sobra) )
print( 'total claves es:' , len(base) )
"
```

Salida esperada: `faltan: [] | sobran: []` en los dos, y `total claves es: 58`.

### Control de que no quedó español suelto en el componente

```bash
grep -nE '"[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}|>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}' \
  src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx \
  | grep -v "^[0-9]*: *//\|^[0-9]*: */\*\|@file\|styles\."
```

Sólo deben quedar líneas de comentario o de import. **Cualquier literal de prosa que aparezca es una
cadena que se escapó.**

> **El reporte pega la salida cruda de cada comando, no la describe.** «Tests verdes» no es un
> reporte; el conteo de suites y tests sí.

---

## 9. Criterio de terminado

*   Los cuatro comandos de la batería en verde, con sus números exactos pegados.
*   `total claves es: 58` y paridad sin faltantes ni sobrantes en `en` y `br`.
*   El grep de control sin literales de prosa.
*   `TECHNICAL_DEBT.md` §3 con la viñeta vieja tildada y la nueva abierta.
*   `trabajo-en-vuelo.md` actualizado **en el mismo commit**.
