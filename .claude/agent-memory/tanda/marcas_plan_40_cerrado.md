---
name: marcas-plan-40-cerrado
description: Plan 40 verificado con éxito; laboratorio sin Brandfetch, estrategia verificados y batería de nombre a ícono
metadata:
  type: project
---

# Plan 40: Laboratorio de marcas sin Brandfetch y batería de nombre a ícono

- **Ejecución y verificación (2026-10-09):** rama `marcas-39b`, commits `90e267a` y `441b54b`.
- **Verificación independiente:** 168 suites pasadas, 1530 tests (+24 netos), eslint 0, tsc 0, build exitoso.
- **Detalle técnico:**
  - Brandfetch eliminado de `resolutorIdentidad.ts`, `estrategiasDominio.ts`, `estrategiasIcono.ts`, `tipos.ts`, `route.ts` y UI del laboratorio.
  - `extraerNombreSitio` en `analisisHtml.ts` lee `og:site_name`, `application-name`, `<title>` y decodifica entidades HTML.
  - Estrategia `verificados` en `estrategiasDominio.ts` genera candidatos con TLDs comunes (`.com`, `.com.ar`, `.ar`), resuelve DNS, analiza HTML y ordena por coincidencia.
  - Batería de 22 consultas en `consultas.ts`, helpers puros en `bateriaVista.ts`, componentes modulares de tabla y caché de dominios por corrida.
  - 12 mutaciones obligatorias probadas y revertidas con éxito.
- **Siguiente paso:** prueba interactiva en navegador (§7 [USUARIO]), copiar JSON de resultados y pasar a `tanda` para planificar el Plan 41 (producción).
