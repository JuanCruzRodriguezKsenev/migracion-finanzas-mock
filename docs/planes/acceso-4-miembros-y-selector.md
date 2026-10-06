# Plan — Acceso 4/5: invitar a otra persona, cambiar de organización y crear una nueva

**Rama:** `feat/acceso-4-miembros-y-selector` (sale de la punta de `feat/acceso-3-google`) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — implementa **RN-9** a **RN-14**, **RN-17**, **RN-18** (la parte de alta), **NFR-5** y los tres wireframes (selector, pestaña Miembros, alta). Cubre **AC-7**, **AC-9**, **AC-10** (completo), **AC-11**, **AC-12**, **AC-13**, y la parte de interfaz de **AC-1**.
**Serie:** 0 → 1 → 2 → 3 `acceso-3-google-e-invitaciones` → **4 este** → 4b `acceso-4b-rol-de-solo-lectura` → 5 `acceso-5-despliegue-vercel-neon`.

No hay RFC y no hace falta. **Precondición dura:** el plan 3 está mergeado y verificado: acá se usan `memberships`,
`invitations`, el servicio de Google y el aprovisionamiento.

**Qué entrega al final:** vos invitás el Gmail de ella desde Configuración → Miembros, ella entra con Google y ve lo
mismo que vos. Cualquiera de los dos puede crear otra organización y pasar de una a otra. **Es el plan que cierra
la historia de la spec.**

---

## 0. Lo que ya existe y se reusa (verificado)

| Pieza | Qué hace hoy | Cómo se usa acá |
| :--- | :--- | :--- |
| `Tabs` (`shared/ui/display/Tabs/Tabs.tsx`) con `TabItem { key , label , disabled? , badge? }` | Las pestañas de `/settings`. Hoy hay dos activas y tres con `disabled: true` | Se agrega **una** pestaña `members`, sólo si el rol es `owner` (la spec: el `member` no la ve) |
| `SettingsContainer.tsx:39-46` | `useState< "categories" \| "ledger" >` fijo | El tipo de unión se ensancha; ver §Paso 4 |
| `settings/page.tsx` | Server Component que carga datos con `Promise.all` y se los pasa al contenedor | Se suma ahí la carga de miembros, **sólo si es `owner`** |
| `Navbar` (`shared/ui/layout/Navbar/Navbar.tsx`) | Marca, tres secciones de links y `ProfileMenu`. Recibe sólo `dict.sidebar` | **Ahí va el selector**, bajo la marca. Es global y se ve en toda ruta; `PageHeader` lo compone cada página y quedaría repetido |
| `AppShell` | Recibe `dict` y se lo pasa al `Navbar` | Recibe además la lista de organizaciones y la activa, y se las pasa |
| `(main)/layout.tsx` | Ya hace `getServerSession` y arma el `AppShell` | Es el único lugar donde se leen las membresías del usuario para el selector |
| `Popup` (`shared/ui/feedback/Popup`) y `Modal` | Portal con posicionamiento | Reusar para el desplegable del selector y para el modal de alta; **no** inventar uno nuevo |
| `Result` / `ok` / `fail` (`shared/lib/result`) | Contrato de todas las acciones | Las acciones nuevas lo usan. Los `fail()` llevan frases en español, **como hoy** (deuda §3 de `TECHNICAL_DEBT.md`; no la resuelve este plan) |
| `accountRepository.ts:62` y `ledgerRepository.ts:126` | `SELECT … FOR UPDATE` en una transacción para evitar carreras | **El patrón** para RN-12 (§Paso 2) |
| `useSession().update` | `SessionProvider` ya envuelve `[lang]/layout.tsx:105` | El cambio de organización llama `update( { organizationId } )`, que dispara el `trigger === "update"` del plan 2 |

**Dónde va el código nuevo:** una feature nueva, `src/features/organizations/` (`actions/`, `components/`,
`schemas/`), según `ARCHITECTURE.md` §4 (feature-driven). Los **repositorios** de membresías e invitaciones ya
viven en `auth/` (planes 2 y 3) y **no se mueven**: la feature nueva los importa.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/auth/repositories/membershipRepository.ts` | Suma `findByOrganization`, `countOwners`, `remove` y los bloqueos del §Paso 2 |
| `src/features/auth/repositories/invitationRepository.ts` | Suma `findPendientesVigentes( orgId )`, `revocar`, `marcarVencidasComoRevocadas` |
| `src/features/organizations/schemas/organization.schema.ts` | Zod: nombre (1-100, recortado), email, rol |
| `src/features/organizations/actions/organizationActions.ts` | `crearOrganizacionAction`, `listarOrganizacionesAction` |
| `src/features/organizations/actions/membersActions.ts` | `listarMiembrosAction`, `invitarMiembroAction`, `revocarInvitacionAction`, `quitarMiembroAction` |
| `src/features/organizations/components/OrganizationSwitcher.tsx` (+ `.module.css`) | **Nuevo**, cliente |
| `src/features/organizations/components/CreateOrganizationModal.tsx` | **Nuevo** |
| `src/features/organizations/components/MembersPanel.tsx` (+ `.module.css`) | **Nuevo** |
| `src/shared/ui/layout/Navbar/Navbar.tsx` | Renderiza el selector. **No** recibe lógica: recibe el nodo ya armado o los datos |
| `src/shared/ui/layout/AppShell/AppShell.tsx` | Pasa los datos del selector al `Navbar` |
| `src/app/[lang]/(main)/layout.tsx` | Lee las membresías y se las pasa al `AppShell` |
| `src/features/settings/components/SettingsContainer.tsx` · `src/app/[lang]/(main)/settings/page.tsx` | La pestaña Miembros |
| `src/dictionaries/es.json` · `en.json` · `br.json` | Claves nuevas (NFR-3): ver §Paso 6 |
| `src/shared/ui/display/Icons/Icons.tsx` | Los íconos que falten (chevron, check, más) — **mirar antes qué hay** (`IconChevronDown` ya existe) |
| `docs/trabajo-en-vuelo.md` · `docs/TECHNICAL_DEBT.md` | Estado, y las dos deudas del §7 |

**Quién más construye o lee estos tipos:** `membershipRepository` y `invitationRepository` los consumen
`auth.ts` (plan 2/3) y el servicio de Google (plan 3); **agregar métodos no cambia los existentes**. Si en algún
momento hay que cambiar una firma ya publicada por los planes 2 o 3, **parar y reportarlo**.

---

## 2. Pasos

### Paso 1 — Autorización: quién puede hacer qué

Una función `exigirOwner( session )` en `organizations/` (o en `auth/`, la que el ejecutor encuentre más natural
sin duplicarla), usada por **todas** las acciones de miembros:

- Toma `session.user.id` y `session.user.organizationId`, y **consulta `membershipRepository.findMembership`**: el
  rol sale de la **base**, no de `session.user.role`. El rol del token se refresca cada ≤ 5 minutos
  (`REVALIDACION_MS`), y alguien que acaba de perder el rol `owner` no puede seguir invitando en esa ventana.
- Devuelve `fail("No autorizado.")` si no hay sesión, no hay membresía o el rol no es `owner`.

`crearOrganizacionAction` y `listarOrganizacionesAction` **no** exigen `owner`: cualquier usuario con membresía
(RN-17). Sólo exigen sesión.

### Paso 2 — Acciones de miembros

Todas filtran **siempre por `session.user.organizationId`**: el `organizationId` jamás llega del cliente (RN-16).

- **`listarMiembrosAction()`** → `{ miembros: { userId , nombre , email , rol }[] , invitaciones: { id , email , rol , venceEl }[] }`.
  Las invitaciones son sólo `pending` con `expiresAt` futuro.
- **`invitarMiembroAction( { email , rol } )`:** validar con Zod (email válido, rol ∈ `owner | member | viewer`);
  normalizar con la **misma** función de normalización del plan 3 (no copiarla). En **una transacción**:
  1. si ese email ya es miembro de la organización → `fail`, y **no** se crea la invitación (RN-10);
  2. `marcarVencidasComoRevocadas( orgId , email )` — un `pending` vencido bloquearía el índice único parcial;
  3. si queda una vigente → `fail("Ya hay una invitación vigente…")`;
  4. insertar con `invitedBy = session.user.id`, `expiresAt = now + 7 días`.
  **No se envía ningún correo:** el repositorio no tiene envío de email todavía (Resend es deuda de infraestructura).
  La interfaz le dice al `owner`, en el mensaje de éxito, que le avise a la persona que entre con Google. No simular
  un envío que no existe.
- **`revocarInvitacionAction( id )`:** `UPDATE … SET status = 'revoked' WHERE id = $id AND organization_id = $org
  AND status = 'pending'`. Si no afectó ninguna fila → `fail`. **El `AND organization_id` es el aislamiento:** sin
  él, un `owner` de otra organización revocaría la tuya.
- **`quitarMiembroAction( userId )`:** en **una transacción**, para que RN-12 aguante una carrera:
  1. `SELECT … FROM memberships WHERE organization_id = $org AND role = 'owner' FOR UPDATE` (patrón de
     `ledgerRepository.ts:126`);
  2. si el miembro a quitar es `owner` y los `owner` bloqueados son uno solo → `fail` (RN-12, AC-11; incluye
     quitarse a uno mismo);
  3. `DELETE` de la membresía;
  4. si `users.last_organization_id` apuntaba a esa organización → `NULL`. El `ON DELETE SET NULL` del plan 2 cubre
     el borrado de la **organización**, no el de la **membresía**.
  Conserva los movimientos que cargó (RN-11): **no hay nada que reasignar**, porque `ledger_transactions` no
  guarda autor (verificado: la spec lo deja fuera de alcance).

### Paso 3 — Crear una organización

`crearOrganizacionAction( { nombre } )`, en **una transacción** (NFR-2, AC-13):
1. Zod: 1-100 caracteres, recortado.
2. `INSERT organizations` con `slug` derivado del nombre; **si choca, agregar un sufijo corto y reintentar** (el
   `slug` es único: `auth/schema.db.ts`). No dejar que el usuario vea un error de clave duplicada.
3. `provisionarOrganizacion( orgId , tx )` — **el servicio del plan 1**, pasándole el `tx`.
4. `INSERT memberships` con `role: "owner"`.
5. `registrarUltimaOrganizacion`.
Devuelve `{ organizationId }`. **Si el paso 3 lanza, no queda ni la organización ni la membresía** (AC-13). El
cliente entonces llama `update( { organizationId } )` y `router.refresh()`.

### Paso 4 — La interfaz

**Selector (`OrganizationSwitcher`)** — en el `Navbar`, bajo la marca:
- Botón con el nombre de la organización activa y un chevron; abre un `Popup` con la lista (la activa marcada con
  ✓), una línea separadora y «+ Crear organización». **Con una sola organización se muestra igual** (es la puerta a
  crear otra).
- Elegir otra: `await update( { organizationId } )` de `useSession()` y después `router.refresh()`. **Hay que
  refrescar:** las páginas del servidor ya renderizaron con la organización vieja y siguen sirviendo su caché
  (`revalidatePath` de las acciones sólo corre al mutar). Un cambio sin refresco mostraría datos de la organización
  anterior bajo el nombre de la nueva: es el peor defecto posible de este plan.
- Si `update` no cambió la organización (el servidor lo rechazó, AC-8), restaurar la selección y mostrar un mensaje.
- Teclado: abrir con Enter/Espacio, moverse con flechas, Escape cierra y devuelve el foco (mismo patrón que
  `MonthSelector`, M6 de `TECHNICAL_DEBT.md`). **Sin movimiento ni cambio de tamaño en `:hover`** (§4).

**`(main)/layout.tsx`:** después del `getServerSession`, `membershipRepository.findByUser( session.user.id )` y le
pasa al `AppShell` `{ organizaciones: { id , nombre , rol }[] , activaId }` —el `rol` de cada membresía sale de la misma consulta; es lo que el plan 4b usa para ocultar botones y el selector para mostrar «Sólo lectura»—. Una consulta por render del layout; es
barata, pero **si el layout se vuelve el cuello de botella es hallazgo, no motivo para cachear acá**.

**Pestaña Miembros:** `SettingsContainer` recibe `esOwner: boolean` y los datos de miembros (o `null`). Cambios:
- El tipo de `activeTab` se ensancha a `"categories" | "ledger" | "members"` (hoy es la unión fija de
  `SettingsContainer.tsx:39` y la del `onChange` de `:62`; **los dos sitios**).
- `settingsTabs` suma `{ key: "members" , label: dict.settingsPage.tabMembers }` **sólo si `esOwner`**. Las tres
  pestañas deshabilitadas (Perfil, Preferencias, Seguridad) no se tocan.
- `settings/page.tsx` llama `listarMiembrosAction()` **sólo si** el usuario es `owner` (si no, `fail` y se descarta).

**`MembersPanel`:** la lista con el rol de cada persona y «Quitar»; el bloque «Invitaciones pendientes» con «Revocar» y
la fecha de vencimiento; el botón «+ Invitar» abre un modal con email y rol. Estados de la spec: sección de
pendientes **oculta** si no hay; «Quitar» **deshabilitado y explicado** si es el único `owner`; errores del servidor
en `FormError`, como el resto. Confirmación antes de quitar a alguien.

**`CreateOrganizationModal`:** un campo de nombre, el botón, y el error en línea. Mientras crea, el botón queda
deshabilitado y el foco no se pierde.

### Paso 5 — `Navbar` y `AppShell`

Mínimo: nuevas props opcionales, para no romper los tests existentes de ambos (`grep -rn "<Navbar\|<AppShell" src/`):
si no llegan, el selector no se renderiza. **No** reestructurar el `Navbar`.

### Paso 6 — i18n (NFR-3)

Los **tres** diccionarios a la vez. Sección nueva `organizations` con selector, modal de alta, panel de miembros y
errores de interfaz, más `settingsPage.tabMembers`. Los `fail()` de las acciones llevan frases en español y se
pintan crudas: es la deuda ya registrada (`TECHNICAL_DEBT.md` §3, 201 llamadas) y **este plan no la agrava de forma
nueva**: sigue el contrato vigente. Si el ejecutor ve una forma barata de que los mensajes de las acciones nuevas
nazcan como código, **reportarlo; no hacerlo**.

---

## 3. Tests

Integración contra la base real, salvo los de componentes (jsdom, ver `testing_de_componentes_cliente`: el
setup global mockea `next/cache` y `next-auth`; montar real el provider y el diccionario).

**Acciones (`membersActions.test.ts`, `organizationActions.test.ts`)** — mockear sólo `getServerSession`, como
las suites de acciones vigentes (`categoryActions.test.ts`):
- **Autorización:** un `member` que llama a `invitar`, `revocar`, `quitar` o `listarMiembros` recibe `fail`.
  **Un `owner` cuya sesión dice `role: "owner"` pero cuya membresía en la base ya es `member` también recibe `fail`**
  (el rol sale de la base, §Paso 1).
- **AC-9:** invitar a alguien que ya tiene usuario en otra organización → tras su login con Google ve las dos.
- **RN-10:** invitar a un miembro actual → `fail`; invitar dos veces el mismo email → `fail`; invitar tras vencer
  la anterior → procede.
- **Aislamiento (AC-15, RN-16):** un `owner` de la organización B **no puede** revocar la invitación de A ni quitar a
  un miembro de A (se prueba con ids reales de A bajo sesión de B).
- **AC-10:** quitar a Ana → su membresía desaparece, **sus 12 movimientos siguen** (crear 12 con
  `createLedgerTransaction`), y sus otras organizaciones no se tocan; y con la revalidación del plan 2 pierde el
  acceso.
- **AC-11:** el único `owner` no se quita, ni a sí mismo. **Carrera:** dos `owner`s que se quitan **a la vez** con
  `Promise.all` → uno procede y el otro recibe `fail`; **nunca** quedan cero (el test que prueba el `FOR UPDATE`).
- **AC-12:** `crearOrganizacionAction` deja la organización con su catálogo y su cuenta de Patrimonio Neto, él como
  `owner`, y **se puede registrar un gasto sin categoría** (la hoja `General` nace sobre demanda).
- **AC-13:** forzar un fallo en el aprovisionamiento (mockear `provisionarOrganizacion` para que lance) → no queda
  organización ni membresía.
- **Slug repetido:** crear dos organizaciones con el mismo nombre → ambas existen, slugs distintos.
- **Zod:** nombre vacío, 101 caracteres, email inválido, rol inventado.

**Componentes:**
- `OrganizationSwitcher`: muestra la activa marcada; con una sola organización igual muestra «+ Crear organización»;
  elegir otra llama `update` con su id y después `router.refresh`; teclado (flechas, Escape).
- `MembersPanel`: oculta pendientes si no hay; «Quitar» deshabilitado para el único `owner`; pide confirmación.
- `SettingsContainer`: **con `esOwner = false` no existe la pestaña Miembros** (los tests actuales de este
  componente tienen que seguir en verde sin cambios).

**AC-7** (cambio de organización y lo que se ve) **se verifica a mano**, porque el cambio atraviesa el JWT, el
`router.refresh` y la caché: es el criterio que ninguna prueba unitaria alcanza.

---

## 4. Verificación literal

```bash
git status --short                                     # limpio antes de empezar
pnpm test                                              # anotar suites y tests exactos
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
grep -rn "<Navbar\|<AppShell" src --include='*.tsx'    # todos los usos siguen compilando sin las props nuevas
pnpm dev
```

**Checklist manual**, con dos navegadores (o uno normal y otro en incógnito) y dos cuentas de Google:

1. Con la cuenta A (`owner`): Configuración → Miembros → «+ Invitar» con el Gmail de B, rol `member`.
2. Con la cuenta B en el otro navegador: «Continuar con Google» → entra y ve **las mismas** cuentas y movimientos
   que A (AC-1, AC-9). **No** ve la pestaña Miembros (Actores).
3. A crea «Prueba» desde el selector → «Prueba» queda activa y **vacía**; registra un gasto **sin categoría** y
   funciona (AC-12). Vuelve a la primera con el selector: sus datos **reaparecen** y los de «Prueba» ya no se ven
   (AC-7). **Mirar el dashboard, `/accounts` y `/transactions` después del cambio:** si alguna conserva datos de la
   organización anterior, falta el `router.refresh`.
4. A intenta quitarse siendo el único `owner` → el botón está deshabilitado y explica por qué (AC-11).
5. A quita a B. B sigue con la pestaña abierta: en **≤ 5 minutos** (en desarrollo 30 s, `REVALIDACION_MS`) su próxima
   navegación la manda al signin, y los movimientos que B cargó **siguen en la organización** (AC-10).
6. Con teclado solamente: abrir el selector, elegir, cerrar con Escape (NFR-5).

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Enviar un correo de invitación | No hay envío de email en el repo. Resend es infraestructura pendiente |
| Cambiar el rol de un miembro | Fuera de alcance de la spec (RN-26: se quita y se reinvita) |
| Hacer cumplir el rol `viewer` en las acciones y ocultar los botones | Plan 4b. **Este plan sólo deja que se invite con ese rol y que el selector lo muestre** |
| Eliminar, transferir o renombrar organizaciones | Fuera de alcance |
| Autoría por movimiento («quién cargó esto») | Fuera de alcance |
| Vista consolidada entre organizaciones | Fuera de alcance |
| Cachear el listado de organizaciones del layout | Si pesa, es hallazgo |
| Límite de organizaciones por usuario o de miembros por organización | PA-3 de la spec: sin decidir |

## 6. Hallazgos que el plan ya sabe que hay que anotar

- **PA-1 de la spec:** quien tiene sesión no ve una invitación nueva hasta volver a entrar. Si en el checklist se
  nota como un problema real de uso, reportarlo; no resolverlo acá.
- Si el layout (Server Component) hace una consulta más por navegación y se nota.

## 7. Deuda que se abre (al cerrar, en `TECHNICAL_DEBT.md`)

1. **Las invitaciones no se avisan por correo:** el `owner` tiene que decirle a la persona que entre. Depende de
   Resend (Fase de infraestructura).
2. **Nadie puede borrar ni transferir una organización,** ni cambiar el rol de un miembro.

## 8. Reportá

Los **hallazgos** en lista aparte, y **el resultado del checklist paso a paso**, con lo que se vio en cada uno.
