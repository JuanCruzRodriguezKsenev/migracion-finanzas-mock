---
name: idea-cargar-por-otro
description: idea del usuario (2026-10-06): habilitar a otra persona a cargar movimientos a su nombre, con autoría registrada; requiere spec nueva
metadata:
  type: project
---

El usuario carga a veces gastos que hizo su pareja en una organización de familia. Quiere una opción para **habilitar a otra persona a ingresar transacciones por él, siempre con registro de quién las cargó**.

**Why:** la spec «Acceso con Google» dejó fuera la autoría por movimiento; esta idea la vuelve necesaria. Anotada en `Deuda.md` §16.

**How to apply:** cuando el usuario la retome, invocar la skill `spec` (no planificar directo). Contrastar con `ledger_transactions` (no guarda autor hoy) y con `actionPolicy` del plan 4b. No mezclarla con el 06b.
