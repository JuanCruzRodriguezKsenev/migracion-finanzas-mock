---
name: verificacion-no-tocar-el-arbol
description: Nunca editar archivos mientras corre el subagente verificador, y cómo diagnosticar una suite que falla de forma intermitente
metadata:
  type: feedback
---

# Mientras corre `verificador`, el árbol no se toca

**Why:** el 2026-09-10 chequeé con `pgrep` que no hubiera procesos de vitest/next/tsc y edité cinco
archivos "porque ya había terminado". No había terminado: siguió corriendo comandos después, y sus
corridas quedaron a ambos lados de mis ediciones. **Su veredicto se volvió imposible de interpretar**
—no sabía qué corrida vio qué estado— y encima produjo una conclusión falsa: reportó que el warning
de pnpm era "residual o cacheado" porque leyó un `package.json` que yo le había cambiado por debajo.
Tuve que descartar la corrida entera y repetirla.

**How to apply:** `pgrep` prueba un instante, no la finalización. La única señal válida de que el
subagente terminó es **su notificación de tarea**. Entre lanzarlo y recibirla: sólo lecturas — y eso
incluye los documentos, no sólo el código.

---

# Una suite "intermitente" es un orden de limpieza mal escrito

**Why:** en la misma ronda, la suite empezó a fallar en un archivo distinto cada vez con
`PostgresError: ... violates foreign key constraint "ledger_entries_account_id_accounts_id_fk"`.
**Dos verificaciones independientes lo dieron por preexistente del repo y no atribuible a la rama.
Las dos se equivocaron**, y mi primera hipótesis también (culpé al test nuevo de cascada). Lo había
introducido `6d365ba` al agregar `DELETE FROM accounts` a cinco suites sin agregar antes
`ledger_entries` y `ledger_transactions`.

**How to apply:** ante un fallo que no se repite:

1.  **No repitas la suite entera esperando que se acomode.** Un fallo intermitente en suites que
    comparten base es un residuo entre archivos hasta que se demuestre lo contrario.
2.  **Corré el par sospechoso en orden explícito** — `vitest run <suite que crea datos> <suite que
    falla>`. Si el defecto es de limpieza, se vuelve determinístico al instante.
3.  **Compará el `beforeEach` contra el de `master`** (`git show master:<archivo>`). Es lo que
    decidió el diagnóstico: cinco suites habían ganado un `DELETE` nuevo en la cadena sin commitear.
4.  Vitest ordena los archivos **por la duración de la corrida anterior**, así que el orden cambia
    solo entre corridas: por eso parece azar. `fileParallelism: false` **no protege de esto** — el
    problema no es el paralelismo, es el residuo. El comentario que acompaña esa opción en
    `vitest.config.ts` induce a creer lo contrario.

Ver [[rfc022-clasificacion-unificada]] y `TECHNICAL_DEBT.md` §7.
