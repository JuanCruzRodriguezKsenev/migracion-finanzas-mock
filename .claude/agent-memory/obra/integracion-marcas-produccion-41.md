---
name: integracion-marcas-produccion-41
description: Plan 41 integración de marcas en producción sin Brandfetch, desacople de Brandfetch y resolutor propio
metadata:
  type: execution-lessons
---

# Plan 41: Integración de marcas en producción sin Brandfetch

## Resumen de ejecución
- **Alcance cumplido:** Desacople total de Brandfetch en producción; eliminación de `BRANDFETCH_API_KEY` en `.env.example`, `env.ts` y `next.config.mjs`; `brandService.ts` migrado a Google S2 con aislamiento cliente/servidor; `InstitutionLogo.tsx` y `SubscriptionIcon.tsx` sin Brandfetch; integración de `POST /api/brand/identidad` en `CreateFinancialEntityForm.tsx` y `AddSubscriptionModal.tsx`; suite `api-brand-identidad.test.ts` (10 tests); actualización de `brandService.test.ts`, `api-brand.test.ts`, `CreateFinancialEntityForm.test.tsx` y `AddSubscriptionModal.test.tsx`; 9 mutaciones comprobadas y revertidas; batería oficial delegada a `verificador` en verde (171 suites, 1562 tests, 0 lint warnings, 0 type errors, build OK). Commit de código `c471929` en rama `marcas-39b` y commit de estado `2719718` en la bóveda.

## Lecciones aprendidas para futuros planes y para `tanda`

1. **Aislamiento Server/Client en `brandService.ts`:**
   - `brandService.ts` se importa en Client Components (`InstitutionLogo.tsx`, `SubscriptionIcon.tsx`).
   - Para evitar que Next.js/Turbopack o el compilador de Webpack intenten empacar librerías nativas de Node (`dns`, `net`, `sharp`, `fs`, `child_process`), `getBrandMetadata` en `brandService.ts` debe mantenerse puro devolviendo un objeto sintético con Google S2 sin importar directamente `resolutorIdentidad.ts`.
   - La resolución de identidad profunda (BMP/ICO, HTML title, DNS) debe consumirse siempre a través de la API HTTP (`POST /api/brand/identidad`).

2. **Tipado de Route Handlers para evitar TS18048 en tests:**
   - En Next.js App Router, si un helper dentro de un Route Handler puede retornar condicionalmente o no está fuertemente tipado, TypeScript puede inferir `Promise<NextResponse | undefined>`.
   - En las suites de tests unitarios de API, esto produce errores `TS18048 ('res' is possibly 'undefined')` al llamar a `res.json()`.
   - Solución: tipar explícitamente la función del handler como `: Promise<NextResponse>` y garantizar un `return NextResponse.json({ ... }, { status: 400 })` ante parámetros ausentes.

3. **Contrato plano de array en búsqueda de marcas:**
   - `buscarMarcas` y `/api/brand?q=...` retornan un array plano `MarcaEncontrada[]`, no un envoltorio `{ marcas: [...] }`.
   - Al simular respuestas de `fetchSeguro` en pruebas de integración, debe inyectarse directamente el array en `json()`.

4. **ESLint estricto en tests:**
   - Regla anti-`any`: en tests de handlers o servicios, evitar `mockResolvedValueOnce({ ... } as any)`. Usar `satisfies RespuestaSegura` o el tipo exacto importado del módulo.
