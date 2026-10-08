---
name: cuentas-2-uso
description: Plan 24 cuentas personales en movimientos: sin consultas, rama no creada, lista de movimientos sí filtra bien pero la UI pierde el nombre, bloqueo ordenado, mutaciones
metadata:
  type: project
---

Plan 24 salió completo, un commit de código, batería verde, sin consultas al usuario. Dónde el plan se quedó corto:

- **Rama:** pedía `cuentas-2-uso` creada por `tanda`; la sesión arrancó en `feat/cuentas-1-modelo`. Commiteé ahí y lo dejé en el informe. **How to apply:** si pasa otra vez, no frenar, anotarlo.
- **Paso 5 (lista RN-13):** la consulta paginada ya filtraba por la transacción, no por la cuenta; lo que se perdía era el nombre en la UI (mapa de `getAccountsAction`). Lo resolví con `cuentasPersonales` en `TransactionsPageResult`, sin saldo (AC-3: un `Account` completo filtraría `balance`). La UI queda para el plan 25.
- **Reversa con cuenta ya no compartida** necesitó un `findHistoricaByIdForUpdate` que el plan no listaba (no se puede bloquear con la versión sin lock).
- **Bloqueo ordenado:** se bloquea por id en un pase aparte y el loop original usa el mapa; así el orden de `entries` no cambia. El test de concurrencia necesita DOS personales compartidas en sentido inverso para provocar deadlock (con una sola no pasa nada); sin `.sort()` falla.
- **Mutación AC-6:** sin `exigirPermisoSobreCuentas`, el rechazo de «member sin habilitación» sigue en la acción (`autorizarTitular`); lo que rompe son «a nombre de otro» y «sin autor» (llamadas directas al motor).
- Atomicidad: `vi.spyOn(accountRepository, "updateBalance")` fallando en la 2ª llamada funciona; `afterEach(vi.restoreAllMocks)`.
- Shell fish: heredocs de Python con `python3 - <<'EOF'` andan bien para ediciones múltiples.

Relacionado: [[cuentas-1-modelo]].
