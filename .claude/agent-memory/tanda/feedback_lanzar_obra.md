---
name: feedback-lanzar-obra
description: reglas del usuario para lanzar `obra` desde tanda: sonnet medium, hasta 2 a la vez; el 2026-10-07 autorizó lanzar el plan 19 cuando termine y se verifique el 18
metadata:
  type: feedback
---

- `obra` se lanza en segundo plano con `model: sonnet`, `effort: medium`; máximo 2 a la vez.
- **Orden vigente (2026-10-07):** el usuario dijo «cuando llegue el momento lanzalo» sobre el plan 19: al terminar el plan 18, leer su informe, verificar, integrar a master (fast-forward, rama nueva desde master) y **lanzar `obra` con el plan 19** sin volver a preguntar. Es sólo para el 19; para el 20 en adelante esperar pedido.
- Antes eran órdenes de «no lanzar más» (2026-10-06): ya no valen; cada lanzamiento sale de un pedido explícito del usuario.

**Why:** el usuario quiere decidir cuándo arranca cada ejecución, pero a veces lo delega por adelantado, plan por plan.

**How to apply:** una orden de lanzar vale sólo para el plan nombrado. Al terminar un `obra`, leer su informe y delegar la batería a `verificador` antes de dar el siguiente paso. Si `obra` o el sistema niega una acción destructiva (borrar ramas), no repetirla: dejarla al usuario.
