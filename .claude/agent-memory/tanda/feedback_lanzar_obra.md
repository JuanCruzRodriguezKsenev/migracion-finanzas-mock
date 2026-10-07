---
name: feedback-lanzar-obra
description: reglas del usuario para lanzar `obra` desde tanda: hasta 2 a la vez, sonnet medium, y NO lanzar más cuando terminen los actuales
metadata:
  type: feedback
---

- Desde 2026-10-06 tanda puede lanzar `obra` en segundo plano: **máximo 2 a la vez**, `model: sonnet`, `effort: medium`.
- **Orden vigente (2026-10-06): no lanzar ningún `obra` más una vez que terminen los dos en curso (plan 06 en carril A y plan 14 en carril D).** El plan 06b queda escrito sin ejecutar, hasta que el usuario lo pida.

- Orden vigente (2026-10-06): cuando termine el plan 06, lanzar **un solo** `verificador` (sobre el carril A). Los `verificador` de C y D los canceló el usuario; no relanzar sin pedido.

**Why:** el usuario quiere decidir él cuándo arranca cada ejecución; antes había dicho «lanzá el 06b cuando termine el 06» y lo revirtió.

**How to apply:** al terminar un `obra`, leer su informe y delegar la batería a `verificador`, pero no lanzar el siguiente plan sin pedido explícito nuevo. Lanzar sin ese pedido es tratar una orden vieja como vigente.
