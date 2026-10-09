---
name: marcas-laboratorio-36
description: Plan 36 laboratorio de marcas en el sandbox: anti-SSRF, HTML puro con regex, sobrecargas de dns.promises.lookup en Vitest/TS, ubicación de tests de API route
metadata:
  type: project
---

Plan 36 ejecutado completo hasta el paso previo a [USUARIO] en la rama `marcas-laboratorio` (commit `e6a0f23`, sin pushear). Batería completa verde con `verificador` (160 suites, 1428 tests, eslint 0, tsc 0, build exitoso).

**Dónde el plan se quedó corto**
- **Ubicación de tests de API Route:** `vitest.config.ts` incluye exclusivamente `src/features/**/*.test.{ts,tsx}` y `src/shared/**/*.test.{ts,tsx}`. Si el test de la ruta se coloca junto a `src/app/api/sandbox/marcas/route.test.ts`, Vitest lo ignora en `pnpm test`. Se ubicó en `src/features/sandbox/route.test.ts` para que corra tanto local como en la suite global. Conviene que `tanda` especifique la ruta de los tests o amplíe el `include` de Vitest.
- **Sobrecargas de `dns.promises.lookup` en TypeScript:** En `@types/node`, `dns.promises.lookup` tiene dos sobrecargas (`LookupAddress` único y `LookupAddress[]` con `{ all: true }`). Vitest spyOn infiere la variante escalar, provocando error TS2345 al mockear con arrays (`mockResolvedValue([ ... ])`). Se resolvió tipando el spy con una interfaz explícita `DnsSpyMock` sin usar `any`.
- **`process.env.NODE_ENV` es read-only en TypeScript:** En el entorno de tipos de Next.js, asignar `process.env.NODE_ENV = "production"` arroja error TS2540. Se resolvió con helper `setNodeEnv` mediante cast `(process.env as Record<string, string | undefined>).NODE_ENV = valor`.
- **DuckDuckGo antibot en servidores:** La estrategia aborta de forma limpia y rápida ante HTTP 202 con script de anomaly, pero en entornos de servidor/datacenter este bloqueo es casi universal, limitando su efectividad real.

**Qué ahorró tiempo**
- **Aislamiento en funciones puras:** Modularizar `analisisHtml.ts` (expresiones regulares sin parser DOM pesado), `generarCandidatos` y `esIpPrivada` permitió probar exhaustivamente 25 casos de borde anti-SSRF y 20 casos de HTML antes de tocar la red.
- **Validación de diccionarios con Node:** Chequeo directo de claves con un one-liner de Node garantizó paridad exacta de las 22 claves de `sandboxPage` en `es.json`, `en.json` y `br.json` de una sola vez.
- **Mutaciones tempranas:** Probar las 5 mutaciones antes de lanzar el build y la batería oficial evitó reprocesos en la compuerta final.
