---
name: marcas-plan-41-escrito
description: Plan 41 escrito (2026-10-10) para integración en producción de identidad de marcas sin Brandfetch
metadata:
  type: project
---

Plan 41 en la bóveda (`Planes/41 - Integración de marcas en producción sin Brandfetch.md`, commit bóveda `9e9e7ca`). Rama `marcas-39b`, árbol limpio.

- **Alcance integrado:**
  - Decodificador DIB/BMP para archivos ICO en `imagenIcono.ts` (BBVA, Provincia, Coto).
  - Lógica de `verificados` extraída a `src/shared/services/brand/verificados.ts` con umbral de confianza (`confianzaAlta = coincide || esEtiquetaExacta`).
  - Esperados corregidos en `consultas.ts` (`galicia.com.ar`, `belo.ar`).
  - Endpoint `/api/brand` migrado a `verificados` para búsqueda y compatibilidad de dominio con `/api/brand/identidad`.
  - `buscarMarcas` desacoplado de Brandfetch, consultando `/api/brand?q=...`.
  - `getBrandLogoUrl` redirige a Google S2 como CDN público; `InstitutionLogo` desacoplado de llamadas a Brandfetch.
  - `CreateFinancialEntityForm` consume `/api/brand/identidad` para color e icono.
  - `AddSubscriptionModal` simplificado: eliminado el panel `brandDetailsBox` (tabs info, colores, contexto, productos); consume identidad.
  - Retiro de `BRANDFETCH_API_KEY` y `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` en `env.ts`.
- **Precondiciones para obra:** árbol del repo limpio en `marcas-39b`, sin cambio de rama.
