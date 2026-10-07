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
- [`acceso-4c-interfaz.md`](acceso-4c-interfaz.md): Plan 06c interfaz del ciclo de vida: `esUnicoOwner` contradictorio, selector no se remonta (aviso), FormSelect en fila, mutación de tests.
- [`autoria-1-titular.md`](autoria-1-titular.md): Plan 15 autoría/titular/habilitaciones: 19 tests con sesión mock rompieron por FK, desvíos del plan y fixtures.
- [`integracion-17-rebase.md`](integracion-17-rebase.md): Plan 17: --update-refs mueve respaldos, journal autofusionado, choque de inmutabilidad de goal_movements.
- [`notificaciones-1-campana.md`](notificaciones-1-campana.md): Plan 18 campana real y avisos de autoría: currency varchar(10) vs plan, locale por perfil, lint react-hooks/refs.
- [`reparto-1-acuerdo.md`](reparto-1-acuerdo.md): Plan 19 reparto: `transaction_id` nullable por `agreement_changed`, test S-S contradictorio, vista previa y caja común, trampas de tests.
- [`acceso-5-despliegue.md`](acceso-5-despliegue.md): Plan 08 §2 pooler de Neon: vitest no incluye `src/shared/db`, tests van en `shared/lib`.
- [`reparto-3-caja-comun.md`](reparto-3-caja-comun.md): Plan 21 caja común: sin consultas, `z.input` por default, plantillas vs cuentas, archivo ajeno modificado en el árbol.
- [`seed-reparto-21b.md`](seed-reparto-21b.md): Plan 21b seed de reparto: sin consultas, huecos menores, trampa del shell para psql.
