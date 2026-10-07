---
name: seed-reparto-21b
description: Plan 21b seed de reparto: plan exacto, sin consultas; sólo detalles de codigo del plan que hubo que completar
metadata:
  type: project
---

Plan 21b ejecutado sin consultas (commit `f0407ac`): el plan coincidió con el código. Los scripts de seed no corren en CI, así que se ejecutó de verdad dos veces.

**Huecos menores del plan (resueltos sin consultar):**
- El plan no pedía `eq` de drizzle ni la membresía explícita: `seedReparto.ts` inserta `memberships` a mano (el seed viejo también).
- Fechas: se clampean a `min(día, hoy)` y a `ahora` si la hora cae en el futuro.
- `provisionarOrganizacion` no choca con los códigos `1.1.01.01/.03` ni `2.1.01.01`: se crean después a mano.

**Trampa:** el shell de Bash del arnés es zsh, no fish; una variable con el comando `podman exec ...` sin función falla. Usar una función `p(){ podman exec postgres-dev psql -U postgres -d finanzas_db -c "$1"; }`.

**Why / How to apply:** `tanda` puede seguir planeando seeds auxiliares con este nivel de detalle; las cuentas de `accounts.balance` se actualizan solas vía `createLedgerTransaction`.
