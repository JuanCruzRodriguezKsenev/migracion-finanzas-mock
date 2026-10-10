---
name: avisos-persona-43
description: Plan 43 avisos de la persona con filtro por organización, discrepancia en notificacionesAutoria.test.ts, storage en jsdom y mutaciones
metadata:
  type: reference
---

# Lecciones del Plan 43 — Avisos de la persona con filtro por organización

- **Discrepancia en tests preexistentes de autoría (`notificacionesAutoria.test.ts`):** El plan 43 transformó las notificaciones para que pertenezcan a la persona a través de todas sus organizaciones (AC-31). Sin embargo, el plan prohibía en §4 tocar tests preexistentes fuera de `NotificationsContext.test.tsx`. `notificacionesAutoria.test.ts:281-286` (del plan 18) afirmaba expresamente que Ana en `orgB` no debía ver notificaciones generadas en `orgA` (`expect(deOtra.items).toHaveLength(0)`). Esta contradicción obligó a detenerse y consultar (`ask_question`) para adaptar la aserción: sin filtro ve su aviso (AC-31) y filtrando por `orgB` recibe 0 (AC-32). Tanda debe incluir en el radio de impacto de planes que cambian visibilidad los tests de planes anteriores que afirmaban la visibilidad opuesta.
- **`localStorage` en Vitest con jsdom:** Vitest bajo Node y entorno jsdom no provee un `window.localStorage` completo con métodos `getItem`, `setItem` funcionales entre renders aislados. Las pruebas del contexto requirieron `vi.stubGlobal("localStorage", storageMock)` con un mock en memoria para validar la persistencia (`finanzia.avisos.filtroOrg`) y la restauración tolerante a excepciones.
- **Regla ESLint `react-hooks/set-state-in-effect`:** La restauración de estado desde `localStorage` dentro de un `useEffect` de montaje dispara la advertencia estricta de React 19 / Next.js. Requiere el comentario justificativo `// eslint-disable-next-line react-hooks/set-state-in-effect -- ...` análogo al patrón existente en `OrganizationSwitcher.tsx:96`.
- **Cuidado con `git checkout -- <file>` al verificar mutaciones:** Si se ejecutan mutaciones antes de realizar el commit del paso, un `git checkout` accidental sobre un archivo modificado borra las ediciones en lugar de revertir la mutación. Es más seguro revertir mutaciones vía `replace_file_content` o realizar el commit atómico de código antes de la batería de mutaciones destructivas.
- **Defensa en profundidad en repositorios (`innerJoin` con memberships):** Aunque `abandonarOrganizacionAction` y `quitarMiembroAction` purgan avisos con `eliminarDeUsuario`, el `innerJoin` con `memberships` en `listarRecientes` y `contarNoLeidas` asegura a nivel consulta que la revocación de membresía oculte de inmediato cualquier aviso residual (RN-33).
