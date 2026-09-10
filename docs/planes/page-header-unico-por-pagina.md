# Plan — un solo encabezado por página: `PageHeader` compuesto, sin sniffeo de ruta

**Rama:** `fix/page-header-unico-por-pagina`, ya creada sobre `master` consolidado.
**Origen:** doble encabezado detectado en `/es/cards` el 2026-09-10. Al mapearlo resultaron **cuatro
rutas de ocho** afectadas, con dos síntomas y una sola causa.

Este plan no lleva progreso adentro. El estado vive en [`../trabajo-en-vuelo.md`](../trabajo-en-vuelo.md).

---

## El problema, en una línea

`shared/ui/layout/Header/Header.tsx:50-74` decide su título mirando el `pathname` con una cadena de
ternarios que conoce **cuatro** rutas y manda todo lo demás a un `else` que dice `"Hola, {nombre}"`.
El mismo vicio está en la línea 55: `showMonthSelector = ( !isAccounts && !isSubscriptions )`.

| Ruta | Header global muestra | La página pone `<h1>` | `*Page` en dict | Hoy |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `header.greeting` | — | — | ✅ |
| `/accounts` | `accountsPage.title` | — | ✅ | ✅ |
| `/subscriptions` | `subscriptionsPage.title` | — | ✅ | ✅ |
| `/transactions` | `transactionsPage.title` | — | ✅ | ✅ |
| `/sandbox` | `sandboxPage.title` | **sí** | ✅ | ❌ mismo título dos veces |
| `/contacts` | ⚠️ `"Hola, {nombre}"` | **sí** | ✅ | ❌ doble, y el de arriba miente |
| `/cards` | ⚠️ `"Hola, {nombre}"` | **sí** | ❌ **falta** | ❌ doble, y el de arriba miente |
| `/settings` | ⚠️ `"Hola, {nombre}"` | **sí** | ❌ **falta** | ❌ doble, y el de arriba miente |

## La decisión (acordada con el usuario el 2026-09-10)

**Se da vuelta la responsabilidad.** El layout deja de dibujar encabezado; cada página compone un
`PageHeader` compartido que trae lo global y recibe lo variable por props. `title` es **obligatoria**,
así que ninguna página puede quedarse sin `<h1>`.

Mueren las dos listas de rutas hardcodeadas: la del título y la del selector de mes.

---

## Lo que ya existe y NO hay que construir

| Cosa | Dónde | Qué hace |
| :--- | :--- | :--- |
| Todo el markup y el CSS del encabezado | `shared/ui/layout/Header/Header.tsx` + `Header.module.css` | Hamburguesa, marca móvil, campana con badge, `Popup` + `NotificationsDropdown`, `MonthSelector` con sincronización a la URL. **Se mueve y se poda, no se reescribe.** |
| `NotificationsProvider`, `ProfileProvider`, `SessionProvider` | `src/app/[lang]/layout.tsx:105-111` | Están **por encima** de `(main)/layout.tsx`, así que un `PageHeader` instanciado dentro de la página sigue teniendo los tres contextos. **No hay que mover ningún provider.** |
| El `.actionBar` de tres contenedores | `AccountsContainer`, `TransactionsContainer`, `SubscriptionDashboard` | Ya es exactamente "los botones de la página". Se pasa como `actions`, no se reinventa. |
| `MonthSelector` | `shared/ui/display/MonthSelector/` | No se toca: cambia quién decide mostrarlo, no cómo funciona. |
| `.globalHeader` NO es sticky | `Header.module.css:1-10` — `position: relative` | Scrollea con el contenido: es el primer bloque, nada más. **Mover el encabezado no afecta scroll ni anclaje.** |

---

## Paso 1 — crear `shared/ui/layout/PageHeader/`

Mover `Header/Header.tsx` y `Header/Header.module.css` a `PageHeader/PageHeader.tsx` y
`PageHeader/PageHeader.module.css` (`git mv`, para conservar el historial), y editarlos así.

### 1.a — la firma

```
interface PageHeaderProps {
  title:             string ;              // obligatoria — es el <h1>
  subtitle?:         string ;
  actions?:          React.ReactNode ;     // botones/badges propios de la página
  showMonthSelector?: boolean ;            // default false
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  lang?:             string ;
  currentMonthKey?:  string ;
  minKey?:           string ;
  onMenuClick?:      () => void ;
}
```

### 1.b — qué se borra de `PageHeader.tsx`

*   **Las líneas 50-74 completas**: los cuatro `const isX = pathname.includes( ... )`, el
    `showMonthSelector` calculado, y las dos cadenas de ternarios `titleText` / `subtitleText`.
    `title` y `subtitle` ahora entran por props.
*   **Las líneas 45-48**: `greetingKey`, `nombreDefecto`, `nombreUsuario`, `primerNombre`. El saludo
    del dashboard lo arma el dashboard (Paso 3.a).
*   **`useSession`** (`:36`) y su import: era el único consumidor de la sesión.
*   `usePathname` y `useSearchParams` **se quedan**: los usa `handleMonthChange` para empujar el mes
    a la URL.

### 1.c — qué se agrega

*   `{ actions }` dentro de `.headerActions`, **antes** del selector de mes y de la campana, para que
    el orden de lectura sea acción de página → mes → notificaciones.
*   El selector pasa a depender de la prop: `{ showMonthSelector && ( ... ) }`, sin cálculo interno.

### 1.d — el CSS móvil, que hoy esconde el título

`PageHeader.module.css:138` tiene, dentro de `@media (max-width: 768px)`:

```
.headerGreetingWrap { display: none !important; }
```

Hoy eso oculta el título en celular y muestra `.headerBrandMobile` ("FinanzIA") en su lugar. **Con
este rediseño el `<h1>` es el único título que existe: si queda oculto, las ocho rutas se quedan sin
encabezado en móvil.** Se invierte:

```
.headerGreetingWrap { display: block ; }   /* el título de la página gana */
.headerBrandMobile  { display: none ; }    /* la marca ya está en el Navbar */
```

> **Decisión de diseño tomada acá:** en móvil gana el título de la sección sobre la marca. La marca ya
> aparece en el drawer del `Navbar`; no saber en qué sección estás molesta más que no ver el logo. Si
> el usuario prefiere lo contrario, son estas dos líneas.

Revisar además que `.headerGreeting` y `.headerSubtitle` (`:23` y `:33`) tengan tamaño usable en
móvil; si el título desborda, recortar con `font-size` dentro del mismo media query — **sin** tocar
`.globalHeader`, que ya es `flex` con `space-between` y no necesita cambios.

---

## Paso 2 — sacar el encabezado del `AppShell`

En `shared/ui/layout/AppShell/AppShell.tsx`:

*   Borrar el import de `Header` y el bloque `<Header ... />` (`:52-58`).
*   Borrar las props `dict`, `currentMonthKey` y `minKey` de `AppShellProps` **sólo si dejan de usarse**:
    `dict` la sigue usando `<Navbar dict={dict.sidebar}>` y `<BottomNav dict={dict.sidebar}>`, así que
    **`dict` se queda**. `currentMonthKey` y `minKey` sí quedan huérfanas: **se borran de la interfaz
    y de la desestructuración**, o el lint las marca.
*   `onMenuClick`: el `openDrawer` que hoy recibe el `Header` ya no tiene a quién ir desde acá. **El
    `BottomNav` ya expone su propio `onMenuClick`** (`:63-66`), así que el drawer sigue abriéndose en
    móvil. El botón hamburguesa del `PageHeader` queda sin cablear en esta tanda: ver "Cabo conocido".

En `src/app/[lang]/(main)/layout.tsx`:

*   `getEarliestMonthKeyAction()` y el cálculo de `currentMonthKey`/`minKey` (`:38-45`) ya no
    alimentan al `AppShell`. **Pero las siguen necesitando las dos páginas que muestran el selector**
    (dashboard y transacciones), y esas ya resuelven su propio mes. **Borrar del layout la llamada, el
    `Promise.all` que la envuelve y las dos constantes**, dejando `const dict = await getDictionary( lang ) ;`.
    Verificar con `grep -rn "getEarliestMonthKeyAction" src/` que el único consumidor restante sea el
    que lo use en el Paso 3; si no queda ninguno, **no borrar la acción**: se deja y se anota.

### Cabo conocido, a dejar anotado en `TECHNICAL_DEBT.md`

El botón hamburguesa vive dentro de `PageHeader` y su `onMenuClick` lo proveía el `AppShell`, que ya
no lo instancia. En esta tanda **el `PageHeader` recibe `onMenuClick` opcional y ninguna página se lo
pasa**, así que el botón queda inerte; el drawer se sigue abriendo por el `BottomNav`. Cablearlo
requiere subir el estado del drawer a un contexto, que es una tanda propia. **Anotarlo como deuda
abierta, no resolverlo acá.**

---

## Paso 3 — las ocho páginas

**Regla que evita el defecto clásico:** el `PageHeader` se instancia **donde viven las acciones**. Las
`actions` llevan `onClick`, y **una función no se puede pasar de un Server Component a un Client
Component**. Así que en siete de ocho el `PageHeader` va dentro del **contenedor cliente**; sólo en el
dashboard, que no tiene acciones, va en el `page.tsx`.

| # | Ruta | Dónde se inserta | `title` / `subtitle` | `actions` | Mes |
| :-- | :--- | :--- | :--- | :--- | :-- |
| a | `/` | `(main)/page.tsx:201`, antes de `<DashboardAlerts>` | `` `${dict.header.greeting}, ${primerNombre}` `` / `dict.header.subtitle` | — | **sí** |
| b | `/transactions` | `TransactionsContainer`, reemplaza el `.actionBar` | `transactionsPage.title` / `.subtitle` | `+ Nueva Transacción` | **sí** |
| c | `/accounts` | `AccountsContainer`, reemplaza el `.actionBar` (`:~55`) | `accountsPage.title` / `.subtitle` | `+ Nueva Entidad` y `+ Nueva Cuenta` | no |
| d | `/subscriptions` | `SubscriptionDashboard`, reemplaza el `.actionBar` | `subscriptionsPage.title` / `.subtitle` | el `countLabel` y el botón de alta | no |
| e | `/cards` | `CardsContainer:74-84`, reemplaza el `<header>` | `cardsPage.title` / `.subtitle` (**nuevas**) | `Nueva Tarjeta` | no |
| f | `/contacts` | `ContactsContainer:115-133`, reemplaza el `<div className={styles.header}>` | `contactsPage.title` / `.subtitle` | el `countBadge` y `btnNew` | no |
| g | `/settings` | `CategoriesSettingsContainer:296-302`, reemplaza el `.headerSection` | `settingsPage.title` / `.subtitle` (**nuevas**) | — | no |
| h | `/sandbox` | `SandboxContainer:39-45`, reemplaza el `<div className={styles.header}>` | `sandboxPage.title` / `.subtitle` | — | no |

### El saludo del dashboard (3.a)

El `primerNombre` que hoy calcula el `PageHeader` se muda al dashboard. `(main)/page.tsx` es un
**Server Component**, así que **no uses `useSession`**: el nombre sale de
`getServerSession( authOptions )`, que el layout ya usa (`(main)/layout.tsx:27`). Replicar ahí la
lógica de `Header.tsx:45-48`, incluido el fallback por idioma
(`greeting === "Hello" ? "User" : greeting === "Olá" ? "Usuário" : "Usuario"`).

### El mes en las dos páginas que lo muestran (3.a y 3.b)

`currentMonthKey` y `minKey` los tiene que armar cada una de esas dos páginas, con lo mismo que hoy
hace `(main)/layout.tsx:38-45`: `getEarliestMonthKeyAction()` para `minKey`, y `new Date()` para
`currentMonthKey`. Las dos son `async` y ya hacen `await` de otras acciones, así que entra en su
`Promise.all` existente.

### Páginas que hoy NO llaman a `getDictionary` y ahora lo necesitan

**`/cards`** (`cards/page.tsx`) y **`/transactions`** (`transactions/page.tsx`) no lo llaman.
`/settings` hay que verificarlo. Las que lo necesiten: agregar `getDictionary( lang )` al
`Promise.all` de la página y bajar el `dict` al contenedor por props, como ya hace
`accounts/page.tsx:20,39`.

### Limpieza que el cambio arrastra

Cada contenedor tocado deja **reglas CSS huérfanas** en su `.module.css`: `.header`, `.headerSection`,
`.titleRow`, `.title`, `.subtitle`, `.actionBar`, `.headerInfo`, `.countBadge`, `.countLabel` según el
caso. **Borrar sólo las que quedan sin ningún selector que las use**, verificando una por una con
`grep -rn "styles.<clase>" src/`. Varias de esas clases se usan en más de un lugar del mismo archivo:
no borrar por nombre sin comprobar.

---

## Paso 4 — los diccionarios

Agregar en **los tres** archivos (`src/dictionaries/es.json`, `en.json`, `br.json`), respetando el
orden alfabético de claves que ya traen:

```
"cardsPage":    { "title": ... , "subtitle": ... } ,
"settingsPage": { "title": ... , "subtitle": ... } ,
```

Textos de partida, que hoy están hardcodeados en español:

*   `cardsPage.title` = `"Tarjetas"`; `subtitle` = `"Administrá tus plásticos de crédito y débito, límites y cuentas de pasivo."` (`CardsContainer:77-80`).
*   `settingsPage.title` = `"Configuración"`; `subtitle` = `"Administrá las categorías contables de gastos e ingresos de tu organización."` (`CategoriesSettingsContainer:298-301`).

Traducir los cuatro a `en` y `br` siguiendo el registro de las claves vecinas.

> **Alcance de i18n:** esto internacionaliza **el encabezado** de esas dos rutas, nada más. Las 789
> líneas de `CategoriesSettingsContainer` siguen en español y siguen en deuda (`TECHNICAL_DEBT.md`
> §3). No ampliar.

---

## Verificación

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

Más estas comprobaciones específicas, que la batería no cubre:

```bash
# 1. No quedó ningún sniffeo de ruta en el encabezado
grep -rn "pathname.includes" src/shared/ui/layout/

# 2. Las ocho páginas tienen exactamente un <h1>
grep -rn "<h1" src/features src/app

# 3. Ningún consumidor viejo del componente movido
grep -rn "layout/Header/Header" src/
```

**Criterio de aceptación:**

*   `pnpm test` — **393 tests / 53 suites**, 0 fallos. Este plan no toca lógica cubierta por la suite;
    si el número baja, algo se rompió de más.
*   Los tres greps: el 1 y el 3 **sin resultados**; el 2 devuelve **ocho**, uno por ruta.
*   `tsc --noEmit` en 0 y eslint en 0 warnings — **acá es donde aparecen los imports huérfanos** que
    deja sacar `Header` del `AppShell` y vaciar los `.actionBar`.
*   **Comprobación visual, ruta por ruta, en escritorio y en móvil (≤768 px):** las ocho muestran un
    solo encabezado, con su título correcto, y el selector de mes aparece **únicamente** en `/` y
    `/transactions`. En móvil el título tiene que verse (Paso 1.d).

`pnpm test` necesita el contenedor `postgres-dev` vivo en podman. Si muere en el setup con
`ECONNREFUSED`, eso es **entorno caído, no suite roja**.

---

## Fuera de alcance

*   **Cablear el botón hamburguesa** del `PageHeader` al drawer. Queda inerte y anotado como deuda; el
    `BottomNav` sigue abriendo el drawer en móvil.
*   **Internacionalizar `/settings`** más allá de su título (deuda §3).
*   **Tests de componentes.** El repo no tiene infraestructura para eso y esta tanda no es el lugar
    para montarla.
*   **Rediseñar el `MonthSelector`** o cambiar cómo sincroniza con la URL.
*   **`/cards` con selector de mes.** Se decidió que no: el ciclo que muestra `CardVisual` es el
    vigente y no es navegable por mes. El día que lo sea, la página pasa `showMonthSelector` y listo.
