---
name: acceso-1-aprovisionamiento
description: Extracción del catálogo y cuenta de patrimonio a organizationProvisioningService, preservación del seed y nuevo formato de informes en la bóveda
metadata:
  type: reference
---

# Cierre del plan Acceso 1 — Aprovisionamiento de Organización

- **Servicio desacoplado del seed:** `provisionarOrganizacion( organizationId , tx )` traslada la creación de categorías contables iniciales (`INITIAL_CATEGORIES_CATALOG`), cuentas asociadas en ARS (`accounts`), vínculos (`category_accounts`) y la cuenta de Patrimonio Neto Inicial (`3.1.01.01` de tipo `equity`) sin abrir transacciones propias, habilitando transaccionalidad atómica y rollback (`AC-13`) para quien invoque el alta de organizaciones (plan 4 y `seed.ts`).
- **Mapeo para variables demo:** El retorno estructurado con `Map<string, Category>` y `Map<string, Account>` indexado por código de catálogo permite que scripts o servicios conserven referencias inmediatas a categorías y cuentas clave (ej: `subSueldos`, `ctaIngSueldo`, `subCatByCode`) sin releer de la base de datos ni romper asignaciones posteriores.
- **Paridad estricta en el seed:** La sustitución del bucle manual por el servicio en `seed.ts` preservó de forma idéntica los registros y conteos de la base de datos de desarrollo (`67 | 71 | 67`), reduciendo 86 líneas netas en el seed (-104 líneas, +18 líneas).
- **Nuevo estándar de informes de ejecución:** Los informes de `obra` ahora se guardan físicamente en la bóveda en `~/Boveda/Proyectos/<repo>/Informes/<nombre del plan>.md` y se registran con commits acotados en la bóveda, sirviendo de entrada directa para la apertura de rondas de `tanda`.
