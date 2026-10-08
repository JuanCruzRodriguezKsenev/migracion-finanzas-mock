---
name: solo-lectura-30
description: Plan 30 solo lectura y visibilidad en Personal: dónde el plan se quedó corto (inventario, props con default true, estilo de reescritura mecánica), trampas de tests con guarda y de fish/python
metadata:
  type: project
---

Plan 30 ejecutado completo hasta la batería en el worktree `-personal` (3 commits de código: `2d92243` servidor, `adc1130` interfaz, `665b00c` visibilidad + arreglos). Sin consultas: nada obligó a parar.

**Dónde el plan se quedó corto**
- **Inventario del §2:** decía 22 archivos de acciones y 45 escrituras; hay 21 archivos. Al borrar `createAccountForEntityAction` (§3.6.3) y migrar las dos de habilitaciones a la guarda quedan **46 escrituras distintas, 13 exentas**, y el test de efecto recorre **49 pares** porque `transactionsActions.ts` reexporta 3 de `accountingActions` (hay que clasificarlas también: `import * as` las ve). Conviene que `tanda` cuente con reexportaciones.
- **`BudgetsContainer` y `GoalsContainer` ya tenían una prop `puedeEscribir = true` por omisión** y las páginas nunca la pasaban: un viewer veía todos los botones (el plan 07 la iba a cablear). Se reemplazó por el hook. Zona a vigilar siempre: props con default permisivo.
- **El plan no mencionaba** `InstallmentPlansModal`, `PaymentMethodsPanel`, `PendingInstallmentsInbox`, `PendingLoanSettlementsInbox`, `PendingOccurrencesInbox`, `SubscriptionCard`, `ContactsTable` ni el estado vacío del dashboard (Server Component: hizo falta `SoloConPermiso`). Salieron de grepear qué componentes importan las 46 escrituras.
- **`readOnlyBadge` ya existía como `switcher.viewerBadge`** («Sólo lectura»): se reusó y sólo faltaba en el botón del selector.
- **No había textos viejos de splits que actualizar:** las suites de splits sólo afirman `success false`, así que el mensaje nuevo no rompió nada.
- Dictionary `es.json` tiene un ` ,` a mano ("holderFilterAll"): `json.dumps` no reproduce el archivo; para claves nuevas insertar líneas con texto, no reserializar.

**Qué ahorró tiempo**
- Reescritura mecánica de las guardas con un script Python que parte por `export async function` y reemplaza el bloque `getServerSession`+if; salvo 8 acciones con `){` sin espacio, calzó todo. Después `tsc` y `eslint` dicen qué import sobra.
- `renderConPermisos` (alias `render`) en `src/shared/lib/renderConPermisos.tsx` arregla los tests de componentes existentes con un cambio de import; los que ya pasaban `puedeEscribir` por prop pasan `{ puedeEscribir }` como opción.
- Tests de acciones con guarda: 6 suites fallaban porque su sesión mock usaba ids inventados; arreglo = `crearUsuarioConMembresia` real (y membresía explícita si la sesión cambia de organización).

**Trampas**
- Cada llamada a Bash reinicia el cwd y no conserva variables de shell (`$SP`): repetirlas en el mismo comando; en fish los globs sin match fallan (`--include=*.ts`), usar rutas o python.
- `pnpm test` completo tarda ~5-6 min y comparte la base `_test`: no correr otro vitest mientras `verificador` corre la batería.
- `import.meta.glob` no tiene tipos sin `vite/client` en este proyecto: `declare global { interface ImportMeta { glob... } }` en el test.
- jsdom: el treemap de suscripciones necesita `ResizeObserver`; `SubscriptionDashboard` además pide `NotificationsProvider` y `next/navigation` con `usePathname`/`useParams`.

Ver [[espacio-personal-29]] (hallazgos 1 y 2 que este plan cierra) y [[acceso-4c-interfaz]].
