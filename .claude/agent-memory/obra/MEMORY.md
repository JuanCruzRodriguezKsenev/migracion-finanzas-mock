# Memoria de Obra

- [`i18n-categorias.md`](i18n-categorias.md): Lecciones de la tanda de internacionalización de `CategoriesSettingsContainer`, patrón de tests con diccionario real y deuda de `Result.error`.
- [`result-panel-categorias.md`](result-panel-categorias.md): Manejo de `Result` en `CategoriesSettingsContainer`, separación de canales `actionError`/`formError` y patrones de test de fallos.
- [`resumenes-mensuales-seed-discrepancia.md`](resumenes-mensuales-seed-discrepancia.md): Discrepancia en Paso 4 del plan de resúmenes mensuales: dependencia de `saldoAcumulado` en `seed.ts` y omisión de `occurredAt` en `registrarTransaccion`.
- [`resumenes-mensuales-cierre.md`](resumenes-mensuales-cierre.md): Cierre del plan de resúmenes mensuales, contra-asientos en derivación de flujos y verificación con subagente.
- [`migracion-boveda-limpieza.md`](migracion-boveda-limpieza.md): Lecciones de la migración de documentos a la bóveda (sustitución de enlaces y verificación de referencias huérfanas).
- [`acceso-1-aprovisionamiento.md`](acceso-1-aprovisionamiento.md): Extracción de catálogo y patrimonio a `organizationProvisioningService`, paridad en `seed.ts` e informes en la bóveda.
- [`acceso-2-membresias.md`](acceso-2-membresias.md): Lecciones del modelo de membresías en auth, orden de preferencia en resolución de identidad, fallback RN-15 y actualización de tests.
- [`estadisticas-1-reversados.md`](estadisticas-1-reversados.md): Exclusión de asientos reversados y contra-asientos en flujos vs saldos patrimoniales (RN-6).

- [`acceso-3-google.md`](acceso-3-google.md): Lecciones de autenticación federada Google, invitaciones atómicas, NextAuth v4 quirks y verificación señuelo.
- [`metas-1-modelo.md`](metas-1-modelo.md): Plan 13 Metas 1 en worktree propio: paso 6/7 omitidos, excepción de testCleanup en greps de inmutabilidad, revalidatePath con `(main)`.
- [`presupuestos-1-modelo.md`](presupuestos-1-modelo.md): Plan 11 presupuestos: trampa `\d` en sql de drizzle, índice parcial, huecos menores del plan.
- [`presupuestos-2-pagina.md`](presupuestos-2-pagina.md): Plan 12 página /budgets: minKey omitido, hero y ojito, PageHeader maxKey, checklist pendiente.
- [`metas-2-pagina.md`](metas-2-pagina.md): Plan 14 Metas 2: GoalView sin reservas/descubierta, ProgressBar copiada byte a byte de presupuestos, trampas jsdom.
- [`acceso-4-miembros.md`](acceso-4-miembros.md): Plan 06 miembros/selector: métodos ya existentes, test de carrera con demora, selector bajado por layout, mocks de next-auth/react.
