---
name: acceso-4c-interfaz
description: Plan 06c (interfaz del ciclo de vida de la organización): dónde el plan se quedó corto y trampas de selector, panel y tests con tests vigentes intocables
metadata:
  type: reference
---

# Plan 06c — interfaz abandonar / eliminar / renombrar / rol

- **`contarOwners` ya existía** en `membershipRepository` (lo había dejado el WIP del 06b): el paso 1 del plan decía "si ya hay uno, reusarlo". Grepear antes de sumar.
- **El plan se contradice sobre `esUnicoOwner`:** lo manda también a la pestaña Organización "para el deshabilitado de Eliminar", pero la spec del panel sólo deshabilita Eliminar con una sola organización (un único owner SÍ puede eliminar). No se pasó `esUnicoOwner` al panel; sí `nombre` y `cantidadOrganizaciones` (por `findByUser` en `settings/page.tsx`). Hallazgo para tanda.
- **El selector vive en el layout y NO se remonta** al cambiar de organización: un aviso de `sessionStorage` leído "al montar" (como pedía el plan) no se vería tras eliminar desde Configuración. Se lee en un `useEffect` con dependencia `activaId`; al abandonar desde el propio selector el aviso se pone directo en estado.
- **Tests vigentes "sin editarse" + props nuevas:** `dict.leave` y `esUnicoOwner` opcionales en el Switcher (sin `leave` no ofrece la línea). Los tests nuevos van en archivos hermanos (`*.leave.test.tsx`, `MembersPanel.rol.test.tsx`, `SettingsContainer.organizacion.test.tsx`).
- **Mutación obligatoria en tests de "no existe la pestaña":** el primer test de `esOwner=false` pasaba aunque se quitara el `esOwner &&` porque yo pasaba `organizacion=null` en ese caso. Pasar los datos igual y variar sólo el flag.
- **No hay componente select propio:** `FormSelect` (`shared/ui/forms/Form/FormSelect.tsx`) ya lo usa el modal de invitar. Trae `width:100%` y `margin-bottom` de formulario: en una fila flex se envolvió en `.roleCell` con margen negativo compensatorio (`containerStyle` es CSS inline, prohibido).
- **eslint 9 / React 19:** `react-hooks/set-state-in-effect` se desactiva puntual con comentario cuando se sincroniza con almacenamiento externo; `no-unused-vars` marca la desestructuración `{ [k]: _x , ...resto }` (usar `delete` sobre copia).
- **Diccionarios:** `json.dumps( indent=2 , ensure_ascii=False )` + `\n` reproduce los tres archivos byte a byte; editar con Python no mete ruido en el diff. El test de paridad no existe: se comprobó con `jq` (claves de primer nivel de `organizations` y, más estricto, todas las rutas).
- Checklist manual con dos cuentas de Google: no ejecutable por obra, queda para el usuario.
