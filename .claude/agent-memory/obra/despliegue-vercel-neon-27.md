---
name: "despliegue-vercel-neon-27"
description: "Lecciones del Plan 27: despliegue con CLI de Neon y Vercel en worktree desacoplado, trampas de regiones, disconnect de git y dominios asignados."
metadata:
  type: "operativo"
---

# Despliegue en Vercel y Neon con CLIs (Plan 27)

- **Aislamiento por Worktree desacoplado (T-1):** Cuando el árbol principal tiene cambios de otro plan en curso (p. ej. plan 26 con migraciones pendientes), usar `git worktree add --detach <dir> origin/master` garantiza que `vercel deploy` no capture archivos no confirmados ni dependencias incompletas. La posterior eliminación con `git worktree remove --force` deja el árbol original completamente limpio.
- **Regiones en Neon CLI:** `neon projects create --help` muestra una lista de ejemplo en choices que omite `aws-sa-east-1`, pero `neon api /regions` confirma que la región de São Paulo está activa. Se debe crear con `--region-id aws-sa-east-1` sin vacilar.
- **Interacción no documentada en Neon:** `neon projects create` solicita interactivamente confirmar la organización por defecto si no se pasa `--org-id`.
- **Desconexión inmediata de Git en Vercel (T-2):** `vercel link --yes` asocia automáticamente el repositorio GitHub remoto si lo detecta en el worktree. Para evitar auto-despliegues en futuros `push` que pondrían en producción migraciones no ejecutadas en Neon, debe ejecutarse inmediatamente `vercel git disconnect --yes`.
- **Dominio asignado en Vercel:** Si el nombre estándar `finanzia.vercel.app` está ocupado globalmente en Vercel, el CLI o la plataforma asignan un alias con sufijo aleatorio (p. ej. `finanzia-blond.vercel.app`). La URL real debe consultarse de la API o del inspect antes de configurar `NEXTAUTH_URL`.
- **Inyección segura de secretos (T-4):** Las cadenas de conexión y secrets nunca tocan disco ni stdout; se inyectan a Vercel pasando las variables de shell directo a `vercel env add <NAME> production --yes` por stdin.
- **Migración y bootstrap en Neon:** Drizzle migrations sobre la cadena directa y el comando `pnpm db:bootstrap` con `tsx` funcionan sin incidencias contra Postgres 18 en Neon.
