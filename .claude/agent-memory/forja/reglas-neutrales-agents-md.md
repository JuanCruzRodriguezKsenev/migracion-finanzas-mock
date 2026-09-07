---
name: reglas-neutrales-agents-md
description: Dónde va AGENTS.md y por qué — el estándar es la raíz; .agents/ es una propuesta que exige un router en la raíz. Aplicable a cualquier repo del usuario.
metadata:
  type: reference
---

El usuario mantiene reglas **neutrales de vendor** (para cualquier agente de IA, no sólo Claude) en
`.agents/AGENTS.md`. Investigado el 2026-09-07:

*   **El estándar implementado es `AGENTS.md` en la RAÍZ** — [agents.md](https://agents.md/),
    custodiado por la Linux Foundation, leído nativamente por Codex, Cursor, Copilot, Gemini CLI,
    Aider, Windsurf, Zed y +20 herramientas, en +60.000 repos. Claude Code lo tiene hardcodeado junto
    a `CLAUDE.md` (string verificado en el binario v2.1.263).
*   Los `AGENTS.md` **anidados** existen sólo para paquetes de un monorepo, con la regla "el más
    cercano al archivo editado gana". Un `.agents/AGENTS.md` bajo esa regla no gobierna `src/`.
*   **`.agents/` es una propuesta real pero no implementada**:
    [dotagents](https://github.com/bgreenwell/dotagents) (draft) y
    [agentsstandard.com](https://agentsstandard.com/) (tier 3). dotagents lo dice textual: *"Not a
    client protocol... Clients still need to support AGENTS.md and follow the routes it contains."*
*   **La propia propuesta prescribe un `AGENTS.md` en la raíz como router** hacia `.agents/`.

**Decisión del usuario (2026-09-07):** router en la raíz + el grueso en `.agents/AGENTS.md`. Es su
convención implementada como ella misma indica, sin pagar los ~4k tokens de tener el archivo completo
autocargado en toda sesión.

**How to apply:** en cualquier repo suyo, si ves `.agents/AGENTS.md` sin un `AGENTS.md` en la raíz,
ese archivo es invisible para todos los clientes — señalalo. Y al escribir agentes, la regla genérica
es: *lo que cita `§N` de otro archivo es referencia, no contenido; hay que seguir la ruta*. Está
incorporada a `tanda` §3 y `obra` §4. Ver [[flota-de-agentes]].
