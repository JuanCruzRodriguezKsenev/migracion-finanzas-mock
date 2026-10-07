---
name: notificaciones-1-campana
description: Plan 18 Notificaciones 1 (campana real, avisos de autoría): el plan cuadró casi al 100%; desvíos menores y trampas de lint/fixtures
metadata:
  type: project
---

Plan 18 ejecutado completo en `feat/notificaciones-1` (commits `eade5cf` backend, `fca94d0` UI). Sin paradas: todas las referencias del plan (líneas, firmas, archivos) coincidieron con el código.

**Dónde el plan se quedó corto / desvíos:**
- Pedía `currency varchar(3)`; el resto del repo (ledger_entries, accounts) usa `varchar(10)` y el motor valida `max(10)`. Con 3, una divisa de 4+ caracteres abortaría la carga entera (aviso atómico). Usé 10 y lo informé.
- No decía de dónde sale el `locale` del monto en la campana: `useProfileContext().profile.numberFormat` (como `TransactionsTable`). Obliga a que cualquier test que monte `NotificationsDropdown` envuelva con `ProfileProvider`.
- No decía qué `transaction_id` guarda el aviso de reverso: usé el de la **original** (descripción natural, monto de la original).
- `testFixtures.ts` y `eliminarCompleta` necesitaban la tabla nueva (el plan lo listó); `testCleanup.ts` no (cascade por FK).

**Trampas:**
- `react-hooks/refs` de eslint prohíbe leer `ref.current` en el render: el set de "sin leer al abrir" va en `useState(() => ...)`, no en `useRef`.
- `grep --include` falla en fish sin comillas: usar `grep -rn ... src` sin include.
- Los tests de atomicidad se hacen con `vi.spyOn(repo, "insertar")` que inserta de verdad y luego lanza.

**Why / How to apply:** cuando un plan agrega una columna `varchar(N)` para un dato que viene de otra tabla, contrastar el largo con la columna de origen. Un plan que pasa props de server actions a un Client Component queda bien resuelto con props opcionales (las 7 suites que montan el proveedor no se tocaron).
