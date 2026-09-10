# Registro de Cierre — Encabezado único por página (`PageHeader` compuesto)

* **Fecha de consolidación:** 2026-09-10
* **Rama base:** `master`
* **Rango consolidado:** `8e086d9..2fe778b` — 3 commits
* **Rama fusionada:** `fix/page-header-unico-por-pagina`, encadenada sobre `master` ya consolidado.
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `git log --merges` sigue vacío.
* **Resultado global:** **393 tests en 53 archivos de prueba**, 0 fallos; `eslint . --max-warnings 0` con 0 errores y 0 warnings; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; build de producción exitoso con 11 rutas. **Verificado dos veces de forma independiente**: por el subagente `verificador` al terminar la ejecución, y de nuevo antes del merge sobre el commit `2fe778b` con el árbol limpio, con `postgres-dev` vivo. Números idénticos las dos veces, y **idénticos a los de `8e086d9`**: la ronda no agregó ni movió tests.

---

## Detalle de lo consolidado

### El diagnóstico: el doble encabezado de `/cards` no era de tarjetas
* **Commit del plan:** `a51ef60` (ya estaba en `master`); **ejecución:** `2fe778b`
* `Header.tsx` decidía su título **mirando el `pathname`** con una cadena de ternarios que conocía cuatro rutas y mandaba el resto a un `else` con el saludo del dashboard. Afectaba a **cuatro de las ocho rutas**, con dos síntomas: `/sandbox` repetía el mismo título, y `/cards`, `/contacts` y `/settings` recibían *"Hola, Admin"*.
* El mismo vicio decidía el selector de mes, que aparecía en seis rutas **por descarte**.

### El cambio: se dio vuelta la responsabilidad
* El layout dejó de dibujar encabezado. `Header` salió de `AppShell` y pasó a `src/shared/ui/layout/PageHeader/PageHeader.tsx` (movimiento detectado por git como *rename*, 62% del archivo).
* `PageHeader` es **compuesto por cada página**, con `title` obligatoria renderizada como `<h1>`, `subtitle` opcional, `actions` contextuales y selector de mes condicional. **Cero comprobaciones de `pathname`** quedaron en el encabezado.
* El selector de mes quedó en `/` y `/transactions`, que son las dos rutas con datos navegables por período — por decisión explícita, no por descarte.
* **Ocho páginas migradas** con sus acciones contextuales: `/`, `/transactions`, `/accounts`, `/subscriptions`, `/cards`, `/contacts`, `/settings`, `/sandbox`.
* **Internacionalización:** claves `cardsPage` y `settingsPage` agregadas a `es.json`, `en.json` y `br.json`.
* **Limpieza CSS:** clases huérfanas eliminadas de los `.module.css` de los seis contenedores afectados.

### Los dos cabos que el plan anticipó
* **El CSS móvil ocultaba el título del header global**, que pasaba a ser el único. Se invirtió la regla: el título de la página siempre se ve y la marca redundante se oculta.
* **El botón hamburguesa perdió su `onMenuClick`** al salir del `AppShell`. Quedó inerte en móvil, anotado en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) §8 y **no** resuelto en esta ronda.

---

## Lo que la ronda dejó abierto, y por qué

La ejecución salió en verde pero **el plan tenía un hueco, y el hueco volvió como código relajado**. El plan declaró que los tests de `CategoriesSettingsContainer` estaban fuera de alcance; el contenedor pasó a montar `PageHeader`, que exige `dict`, y el test lo montaba sin diccionario ni providers. Se resolvió:

* volviendo `dict` **opcional** en `CategoriesSettingsContainer`, con un diccionario de respaldo embebido y casteado con `as unknown as` — que apaga el typechecker sobre la forma del diccionario y permite que una página futura se olvide de pasarlo sin error de tipos ni de build;
* agregando al setup global de vitest (`src/shared/lib/vitest.setup.mocks.ts`, que corre en **las 53 suites**) mocks de `next/navigation` y de `@/features/notifications/context/NotificationsContext` — el segundo es **código propio del proyecto**.

**No es un desvío de la ejecución: lo dejó el plan.** Si un paso agrega una prop obligatoria a un componente testeado, el plan tiene que enumerar los `render()` a actualizar y con qué montarlos.

Se enrutó a la ronda siguiente, en `docs/planes/mocks-de-ui-y-dict-obligatorio.md` (rama `fix/mocks-de-ui-y-dict-obligatorio`), que devuelve `dict` a obligatorio, monta el test con el diccionario real y el `NotificationsProvider` real, y fija la política del setup global: **se mockea el framework, no el proyecto.**

### El otro hallazgo, menor
La tabla del plan citaba `CategoriesSettingsContainer:296-302`; el archivo vive en
`src/features/accounting/components/CategoriesSettings/`. No costó un defecto, pero obligó a buscar.

---

## Estado de las ramas

`fix/page-header-unico-por-pagina` queda contenida en `master` y **no recibe más trabajo: se puede
borrar.** Sigue viva `fix/mocks-de-ui-y-dict-obligatorio`, encadenada sobre este `master`.
