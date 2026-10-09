---
name: blindaje-marcas-32
description: Plan 32 blindaje de buscadores de marcas en CreateFinancialEntityForm y AddSubscriptionModal: fake timers, portales en jsdom, mocks de directMatch y 10 mutaciones comprobadas
metadata:
  type: project
---

Plan 32 ejecutado completo sobre la rama activa `seed-cuentas-propias` (commit `488a176`). Cero cambios en código de producción (`git diff` vacío).

**Patrones y trampas en pruebas de componentes con buscadores y debounce**
- **Fake timers y React 19:**
  - Si un componente usa debounce con `setTimeout(..., 500)`, el avance de tiempo debe envolverse en `act`: `await act( async () => { await vi.advanceTimersByTimeAsync( 500 ) ; } )`.
  - Evitar el uso de `waitFor` de `@testing-library/react` mientras haya fake timers activos sin avanzar: produce timeouts de 5000 ms. Para resoluciones asíncronas inmediatas tras eventos de click o submit, usar `await act( async () => { await vi.runAllTimersAsync() ; } )`.
- **Portales en jsdom (`Modal.tsx`):**
  - `<Modal>` usa `createPortal(..., document.body)`. El formulario interno (`#add-subscription-form`) no vive dentro de `container` retornado por `render()`. Buscar siempre con `document.querySelector("#add-subscription-form")`.
- **Mocks de red concurrentes (`Brandfetch` y `/api/brand`):**
  - En `AddSubscriptionModal.tsx:417`, `directMatch.domain.toLowerCase()` asume que si la respuesta de `/api/brand` no es nula, posee la propiedad `.domain`. Un mock genérico de `fetch` que devuelva `{ ok: true, json: async () => ({}) }` dispara un `TypeError` no controlado. El mock por defecto debe responder 404 / null a `/api/brand` y array vacío `[]` a llamadas de búsqueda de Brandfetch.
- **Colisiones de roles en jsdom:**
  - `<select>` en jsdom tiene `role="combobox"` por defecto y sus `<option>` tienen `role="option"`. Para evitar `getMultipleElementsFoundError`, las opciones del Autocomplete deben consultarse dentro del listbox: `within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )`.
  - Los campos envueltos con `FormInput` o `FormSelect` concatenan ` *` dentro del `<label>`, por lo que las búsquedas por `getByLabelText` deben usar `{ exact: false }`.

**Mutaciones**
- Las 10 mutaciones temporales requeridas por el plan (§3.3) pusieron en rojo al menos un test específico cada una y fueron revertidas inmediatamente con `git checkout`, verificando que el árbol de producción quedara 100% limpio.
