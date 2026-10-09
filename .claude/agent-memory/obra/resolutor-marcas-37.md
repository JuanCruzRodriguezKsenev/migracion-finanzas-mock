---
name: resolutor-marcas-37
description: Plan 37 resolutor de identidad de marca: cascada de íconos, normalización PNG con sharp y parseo ICO, color dominante determinista, mock de next-auth y tipados de lookup
metadata:
  type: project
---

Plan 37 ejecutado completo hasta el §4 (previo a [USUARIO] §7) en la rama `marcas-identidad` (commits `a847008` y `8d5f13b`, sin pushear). Batería completa verde con `verificador` (167 suites, 1489 tests, eslint 0, tsc 0, build exitoso).

**Dónde el plan se quedó corto**
- **Reexportación vs alcance local en TypeScript:** `export type { CandidatoIcono } from "..."` solo reexporta la interfaz para consumidores externos pero no la incorpora al ámbito léxico de ese archivo (`tipos.ts`), haciendo fallar TS2304 en `hallados?: CandidatoIcono[]`. Debe importarse explícitamente (`import type { CandidatoIcono } ...`) antes de reexportar.
- **Interferencia de `.env.local` con suites existentes:** `.env.local` tenía configurado `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID=1idI-gFzGm5rg6C6vEx` de pruebas interactivas previas, lo que rompía 4 aserciones de `brandSearch.test.ts` y `CreateFinancialEntityForm.test.tsx` que esperaban el fallback por defecto `c=brandfetch`. Se unificó a `brandfetch` en `.env.local`. Conviene que las pruebas de búsqueda de marcas stuben la variable en el runner para aislarse del entorno local del desarrollador.
- **Mock de `getServerSession` en Vitest:** En ESM/NextAuth v4, espiar directamente `vi.spyOn(nextAuth, "getServerSession")` arroja `Cannot redefine property: getServerSession` a menos que se defina `vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))` al inicio del archivo de prueba.
- **Umbral de brillo en `colorMarca`:** El requisito de considerar cromático a cubos con $V \le 0.95$ excluye píxeles con canales puros a 255 ($V = 1.0$), diseñado para evitar reflejos sobreexpuestos. Para fixtures de prueba cromáticos, se deben elegir colores con canal máximo ligeramente atenuado (ej. R=240, $V = 0.941$).

**Qué ahorró tiempo**
- **Soporte binario directo de `sharp`:** Incorporar `sharp@0.34.5` como dependencia directa funcionó de inmediato tanto en Node puro, como en Vitest y en `pnpm build` sin requerir hacks de empaquetado ni configuración de `onlyBuiltDependencies`.
- **Ejecución aislada y limpia de mutaciones:** Commitear la implementación base antes de mutar permitió usar `git diff` y `git checkout` para verificar y revertir cada una de las 7 mutaciones de forma ágil y segura.
- **Desacoplamiento de red en tests:** Generar las imágenes directamente en memoria con `sharp` y mockear `dns` y `fetch` permitió probar toda la lógica de validación de dominios, anti-SSRF y cascada de íconos en menos de 2 segundos sin conexiones externas reales.
