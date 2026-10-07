---
name: autoria-1-titular
description: Plan 15 Autoría 1 (autor/titular/habilitaciones): dónde el plan se quedó corto y qué supuestos no coincidieron con el código
metadata:
  type: project
---

Plan 15 ejecutado completo (commits `be7675b`, `fd6983b`, `a9b370f`, `3787f3a`); batería verde 728 tests / 92 suites.

**Dónde el plan se quedó corto:**
- Decía «los tests vigentes siguen en verde sin editarse», pero guardar `created_by_user_id` con FK rompió 19 tests de 4 archivos (`accountingActions`, `cardsActions`, `loansActions`, `transactionsActions`): sus sesiones mock usan `user.id` inventado. Paré y el usuario autorizó editar sólo el setup (usuario real con `crearUsuarioConMembresia`).
- Pedía claves `transactions.holder*`: el diccionario usa `transactionsPage`.
- Pedía `FormSelect` en el filtro de la barra: sus vecinos son `<select>` nativos; usé `FormSelect` con compensación de margen (como `roleCell` de MembersPanel).
- «Dentro de la transacción de idempotencia» es sólo el callback de `executeIdempotent`, no una transacción de BD (ventana de carrera menor).
- `ToggleSwitch` no admite `aria-label`: se nombra con `<label htmlFor>`.

**Why / How to apply:** cualquier plan que agregue una columna con FK a `users` en una tabla que escriben tests con sesión mock vuelve a romper esos fixtures: avisar en el plan que se editará el setup. Los tests de componentes de `TransactionFormModal`/`SettingsContainer` siguen verdes si las props nuevas son opcionales.

**Cosas que ahorran tiempo:** `crearOrganizacionRica` con usuarios sueltos (sin membresía) no altera conteos de otros tests; dictionaries JSON round-trip con `indent=2`; mutación rápida de guardias con copia en scratchpad.

Ver [[acceso-4c-interfaz]] para el mismo patrón de props opcionales.
