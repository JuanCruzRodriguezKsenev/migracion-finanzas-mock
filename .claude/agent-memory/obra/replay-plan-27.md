---
name: replay-plan-27
description: Pedido de reejecutar el plan 27 ya hecho (2026-10-08): se consultó y no se hizo nada; cómo evitar duplicar infraestructura
metadata:
  type: project
---

Se pidió ejecutar el plan 27 (despliegue Vercel/Neon) hasta el §5 cuando `Estado.md` ya lo daba por hecho. Con el árbol sucio de `cuentas-4-ajuste` (plan 26 a medias), consulté y el usuario eligió no hacer nada.

**Why:** reejecutar crearía otro proyecto Neon/Vercel; el plan no es idempotente.

**How to apply:** antes de ejecutar un plan, cruzar con `Estado.md` e `Informes/`; si ya figura hecho, consultar. El informe de esa sesión se escribió aparte (`... (sesión 2026-10-08).md`) para no pisar el informe original. Ver [[despliegue-vercel-neon-27]].
