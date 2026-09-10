# Plan — Gestión de categorías y selector jerárquico (RFC 022, segunda tajada)

*   **RFC:** [`../proposals/022-unified-classification.md`](../proposals/022-unified-classification.md) — `APPROVED`.
*   **Decisiones de interfaz:** §4bis de [`../diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md).
*   **Rama:** `feat/gestion-categorias`, encadenada sobre `feat/clasificacion-unificada`.
*   **Línea base verificada** (subagente `verificador`, 2026-09-09, sobre la rama padre):
    **48 archivos de test, 365 tests, lint 0, `tsc --noEmit` 0 errores, build verde**, con
    `db:migrate` y `db:seed` limpios. Si algo sale en rojo antes de tocar nada, es entorno.

---

## Qué se construye y por qué

La primera tajada dejó **todo el backend hecho y ninguna pantalla**. Hoy el usuario tiene 67
categorías, cinco Server Actions para administrarlas y **ninguna forma de usarlas**.

Peor: el catálogo dejó una pantalla **rota**. El selector de categorías del formulario de
transacción es un `<select>` plano; con 6 categorías funcionaba, con 67 es inusable.

Esta tanda cierra el circuito: se puede elegir bien una categoría al cargar un gasto, crear una que
falte sin salir del modal, y administrar el árbol completo desde Configuración.

---

## Lo que ya existe y NO hay que construir

Verificado archivo por archivo en la rama padre. **Todo esto está hecho**: si el plan parece pedir
que lo escribas de nuevo, está mal leído.

| Pieza | Dónde | Qué hace |
| :--- | :--- | :--- |
| `createCategoryAction` | `accounting/actions/categoryActions.ts:38` | Alta. Recibe `CreateCategoryInput` |
| `updateCategoryAction` | `:126` | Renombrar, ícono, color |
| `archiveCategoryAction` | `:165` | Baja lógica |
| `unarchiveCategoryAction` | `:201` | La devuelve |
| `getCategoryTreeAction` | `:237` | `Result< CategoryTreeNode[] >`, con `options?: { includeArchived?: boolean }` |
| `CategoryTreeNode` | `categoryRepository.ts:19` | `extends Category` + `children: Category[]`. **El árbol ya viene armado, no hay que ensamblarlo en el cliente** |
| Esquemas Zod | `accounting/schemas/category.schema.ts` | `createCategorySchema` pide `name`, `type` (`expense`\|`revenue`), `parentId?`, `icon?`, `color?` (hex `#RRGGBB` validado) |

Las cinco acciones devuelven `Result`, y **el éxito trae `value`, no `data`**
(`{ success: true, value: T }`).

---

## Radio de impacto

### A. El selector está roto hoy, y esta tanda es la única que lo toca

`TransactionFormModal.tsx:277-286` mapea todas las categorías a `<option>` planas. Con el catálogo
nuevo son **67 opciones** ordenadas alfabéticamente, con ingresos y gastos mezclados y con nombres
repetidos: hay **18 hojas llamadas `General`**, y *Entretenimiento* existe dos veces —como categoría
de gasto y como subcategoría de suscripciones—.

**La rama padre no tocó ese archivo** porque su plan decía que la UI de transacciones no cambiaba.

### B. Los íconos del catálogo no se pueden dibujar

`initialCatalog.ts` guarda nombres estilo lucide: `home`, `key`, `file-text`, `receipt`, `tool`…
Pero `shared/ui/display/Icons/Icons.tsx` exporta **14 íconos** —`IconBrand`, `IconDashboard`,
`IconAccounts`, `IconChevronDown`, `IconLogout`, `IconCalendar`, `IconBell`, `IconMenu`,
`IconClose`, `IconSettings`, `IconSandbox`, `IconRepeat`, `IconTransactions`, `IconContacts`— y
**ninguno coincide con un nombre del catálogo**. En `package.json` no hay librería de íconos
instalada.

**Resolución decidida, sin sumar dependencias:** un mapa `nombre → emoji` en
`accounting/utils/categoryIcons.ts`, con fallback `📦` para lo desconocido. Es lo que hace
FinanzasMock en `shared/utils/categoryIcons.ts`, y evita meter una dependencia nueva en una tanda
de UI. **No instalar paquetes**: si el mapa no alcanza, se reporta como hallazgo y se decide aparte.

### C. La navegación no lista todas las rutas

`Navbar.tsx` (escritorio) enlaza dashboard, sandbox, transactions, accounts, subscriptions y
contacts. **`/cards` no figura**, pese a existir desde el 2026-09-08. `BottomNav.tsx` (móvil) tiene
cuatro entradas más un botón "Menu".

Esta tanda agrega `/settings` **y de paso corrige la ausencia de `/cards`**: son dos líneas en el
mismo archivo y dejarlo para después es garantizar que se olvide.

### D. Tocar `subscriptions.category` arrastra cuatro archivos

`subscriptions/schema.db.ts:48` (la columna) · `subscriptions/schemas/subscriptions.schema.ts:20`
(el `z.enum` de siete valores) · `subscriptions.schema.test.ts:14,49` (**un test afirma que
`"gaming"` es inválido** y deja de tener sentido) · el selector del modal de alta · y el tipo de la
feature. **El treemap y la tarjeta no lo consumen**: hoy el campo no alimenta ninguna vista.

---

## Reusos: qué hay hoy en `shared/ui/`

No construir primitivas nuevas sin mirar acá primero.

*   **`Tabs`** (`display/Tabs/Tabs.tsx`) — `{ tabs: TabItem[] , activeTab: string , onChange: (key) => void }`.
    Es el que usa `/accounts` para sus dos solapas. **Es el de la pestaña de Configuración.**
*   **`Modal`** (`feedback/Modal/`) — el de los formularios de alta existentes.
*   **`Form` / `FormSelect` / `FormInput`** (`forms/Form/`) — `FormSelect` es el `<select>` estilado
    del proyecto; lo usa `CreateFinancialEntityForm.tsx:347`. **Hay que verificar si acepta
    `<optgroup>` como hijo o si sólo mapea `<option>`**: si no lo soporta, se extiende ahí, no se
    escribe un select suelto en el modal.
*   **`SearchInput`** (`forms/SearchInput/`) — para el buscador del árbol.
*   **`EmptyState`** (`feedback/EmptyState/`) — para "no hay archivadas".
*   **`Toolbar`** (`display/Toolbar/`) — barra de acciones.

---

## Pasos

### Paso 1 — Mapa de íconos

`src/features/accounting/utils/categoryIcons.ts`: función pura `iconoDeCategoria( nombre )` que
mapea los nombres del catálogo a emoji, con fallback `📦`. Con test propio. Los nombres a cubrir
salen de `initialCatalog.ts` — son los únicos que el seed produce.

### Paso 2 — Arreglar el selector del formulario

`TransactionFormModal.tsx`. Cambiar el `.map()` plano por un recorrido de dos niveles con
`<optgroup label={padre.name}>` conteniendo sus `children`.

*   La página que alimenta el modal hoy llama a `getCategoriesAction` (plano). **Pasa a
    `getCategoryTreeAction`**, que ya devuelve el árbol armado.
*   **Filtrar por tipo:** si el formulario está en `expense`, sólo se ofrecen categorías `expense`.
    Hoy ofrece todo mezclado.
*   **Las hojas `General` (`isSystemLeaf`) no se listan.** La primera opción del selector,
    `"Sin detallar"`, ya cubre ese caso: manda `categoryId` vacío y el backend resuelve la hoja
    (eso ya funciona, lo hizo la tanda anterior).

### Paso 3 — Crear categoría al vuelo

Última opción del desplegable: `＋ Crear categoría nueva`. Abre un formulario chico **dentro del
modal de transacción**, sin cerrarlo ni perder lo cargado:

*   **Nombre** (texto).
*   **Va dentro de** — selector de categorías padre del tipo actual, más la opción *"que sea una
    categoría principal"*.
*   **Ícono y color** — opcionales, con el mapa del Paso 1.
*   Al confirmar: `createCategoryAction`, y **la categoría creada queda seleccionada** en el
    formulario de transacción.

`type` no se pregunta: **lo determina el tipo de transacción en curso** (`expense` o `income`).

### Paso 4 — Ruta `/settings`

`src/app/[lang]/(main)/settings/page.tsx`, siguiendo la forma de `accounts/page.tsx`: Server
Component que llama a la acción y pasa los datos al container cliente.

Una sola pestaña activa, **Categorías**. Las demás —Perfil, Preferencias, Seguridad— se muestran
deshabilitadas con la marca *próximamente*, para que la pestaña única no parezca un error.

### Paso 5 — La pantalla: dos columnas

Layout decidido (variante B del wireframe).

**Columna izquierda** — lista de padres, agrupados por `GASTOS` e `INGRESOS`, con su ícono, su
nombre y **el número de subcategorías** (`—` si no tiene). El seleccionado va marcado.

**Columna derecha** — la ficha del padre seleccionado:

*   Ícono grande y nombre.
*   Botones **Renombrar** y **Archivar**.
*   Controles de **Ícono** y **Color** a la vista, no escondidos en un menú.
*   Lista de **subcategorías**, cada una con su menú `···` (*Renombrar · Cambiar ícono · Archivar*).
*   Botón **+ Agregar** subcategoría.
*   La hoja `General` se muestra como **"Sin detallar"**, al final, **sin menú de acciones**: no se
    renombra ni se archiva.

**Arriba:** buscador (`SearchInput`) que filtra el árbol, y casilla **"Ver archivadas"** que llama a
`getCategoryTreeAction({ includeArchived: true })`.

> **El código contable NO se muestra.** El RFC 022 §2 es explícito: el usuario ve *Supermercado* y
> **nunca ve el número**. Nada de `5.1.03` en la ficha.

### Paso 6 — Confirmación de archivado

Archivar es lo único con consecuencia en esta pantalla. La confirmación **dice cuántos movimientos
tiene** la categoría antes de archivarla — sin ese dato el usuario archiva a ciegas.

Si el conteo no está disponible en el repositorio, **agregarlo al repositorio, no consultarlo suelto
desde el componente**: todo el acceso al libro está encapsulado en `ledgerRepository` y esta tanda
mantiene la regla.

Archivar un padre **archiva sus hojas en cascada**, y la confirmación lo dice.

### Paso 7 — Navegación

Agregar `/settings` a `Navbar.tsx` y a `BottomNav.tsx`, **y agregar `/cards`, que falta en los dos**
(radio C). Usar `IconSettings`, que ya existe.

### Paso 8 — `subscriptions.category` → `categoryId`

*   Columna nueva `categoryId` con FK a `categories`, `onDelete: "set null"`. Migración **0024**.
*   Backfill: mapear los siete valores a las categorías del catálogo bajo *Suscripciones y servicios
    digitales* — `design`→Diseño, `productivity`→Productividad, `entertainment`→Entretenimiento,
    `fitness`→Salud y Fitness, `security`→Seguridad, `storage`→Almacenamiento, y `other` a la hoja
    `Sin detallar` de ese padre.
*   Recién después, borrar la columna vieja.
*   Actualizar el `z.enum` de siete valores, el selector del modal de alta, el tipo de la feature y
    **el test que afirma que `"gaming"` es inválido** (radio D).

### Paso 9 — Tests

1.  `iconoDeCategoria`: mapeo conocido y fallback.
2.  Selector: con un árbol de dos padres y cuatro hojas, se renderizan dos `<optgroup>`; **las hojas
    `isSystemLeaf` no aparecen**; en modo `expense` no se ofrecen categorías `revenue`.
3.  Crear al vuelo: al confirmar, se llama `createCategoryAction` con el `type` de la transacción en
    curso y la categoría nueva queda seleccionada.
4.  Pantalla: seleccionar un padre muestra sus hijas; "Ver archivadas" cambia la consulta.
5.  Archivado: la confirmación muestra el conteo; archivar un padre archiva las hojas.
6.  Suscripciones: el backfill deja cada valor viejo apuntando a su categoría, y `other` a la hoja
    `Sin detallar`.

> **Trampa conocida:** agregar columnas rompe fixtures de tests de otras features. Ya pasó dos veces
> —`cbu_cvu`/`alias` en `accounts`, y `type`/`account_code` en `categories`—. La columna del Paso 8
> es anulable, así que no debería romper, **pero verificarlo antes de dar la tanda por cerrada.**

### Paso 10 — Documentación, en el mismo commit

*   **`docs/trabajo-en-vuelo.md`**: en el **mismo commit** que avanza el trabajo.
*   **`docs/TECHNICAL_DEBT.md`**: cerrar `subscriptions.category no alimenta ninguna vista`. Abrir,
    si corresponde, lo que se encuentre.
*   **`docs/patterns.md`**: sólo si aparece un patrón nuevo. Contrastar antes contra lo que ya está.

---

## Verificación

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
pnpm db:migrate
pnpm db:seed
```

**El reporte pega la salida, no la describe.** Números exactos: archivos de test, tests, errores TS.

> **`pnpm build` no es typecheck**: `next build` no tipa los archivos de test. El `tsc` va aparte, y
> es lo que corre la compuerta CI.

> **Entorno:** `pnpm test` necesita `postgres-dev` vivo en podman. `ECONNREFUSED` o `AggregateError`
> en el setup es **entorno caído, no suite roja**. `podman ps` antes de diagnosticar.

---

## Lo que NO entra

*   **Las pestañas Perfil, Preferencias y Seguridad** de `/settings`. Van deshabilitadas.
*   **Reordenar categorías arrastrando.** `categories` no tiene columna de orden: se listan
    alfabéticamente. Agregarla es migración y no está decidido.
*   **Mostrar montos por categoría.** Decisión explícita del usuario: en Configuración no van
    montos. Los totales viven en la página de estadísticas.
*   **Mover una categoría de padre.** Cambiaría su código contable con movimientos ya imputados.
*   **Instalar una librería de íconos.** Si el mapa de emoji no alcanza, se reporta y se decide
    aparte.
