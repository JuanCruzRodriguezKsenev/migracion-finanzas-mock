---
name: marcas-planes-33-34
description: Planes 33 y 34 (búsqueda de marcas compartida) escritos el 2026-10-08; por qué módulo de funciones y no hook, y qué duplicación queda
metadata:
  type: project
---

Planes 33 y 34 en la bóveda (`Planes/`), misma rama `marcas-busqueda-compartida` desde la punta de `seed-cuentas-propias` (los tests del 32 no están en `master`).

*   **Módulo de funciones, no hook:** `src/shared/services/brand/brandSearch.ts`. **Why:** entidad busca sola con rebote de 500 ms, suscripciones sólo al elegir «Buscar en la web»; un hook sería de un consumidor. Además vitest no corre tests en `src/shared/hooks/` (globs en `vitest.config.ts`).
*   **Única diferencia deliberada:** dedupe de dominios sin distinguir mayúsculas (la entidad lo hacía con).
*   **Queda duplicado (Deuda §27):** `InstitutionLogo`, `/api/brand` en entidad y `selectBrand`, dos detecciones de país.
*   **How to apply:** al leer el informe del 33/34, cerrar §27 y revisar que `AddSubscriptionModal.test.tsx` conserve sus 14 tests originales.
