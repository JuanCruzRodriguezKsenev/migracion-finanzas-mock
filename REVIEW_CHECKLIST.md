# Checklist de Revisión de Archivos

Este checklist contiene todos los archivos creados y modificados en el proyecto hasta el momento. Puedes utilizarlo para llevar el control de tu revisión.

> [!NOTE]
> Si de aquí en adelante modifico cualquiera de estos archivos, me encargaré de **desmarcar** automáticamente su checkbox correspondiente para que sepas que requiere una nueva revisión.

---

### Configuración del Entorno y DB
*   [x] [ package.json      ]( package.json      ) *( Modificado )* - Dependencias (next-auth, drizzle, vitest, postgres) y scripts.
*   [x] [ .npmrc            ]( .npmrc            ) *( Creado     )* - Habilita dependencias construidas nativas (`esbuild`) en pnpm.
*   [x] [ .env.local        ]( .env.local        ) *( Creado     )* - Credenciales de PostgreSQL local (`finanzas_db`).
*   [x] [ drizzle.config.ts ]( drizzle.config.ts ) *( Modificado )* - Configuración de Drizzle Kit y carga explícita de variables locales.
*   [x] [ vitest.config.ts  ]( vitest.config.ts  ) *( Modificado )* - Integración de dotenv para cargar .env.local en el entorno de pruebas de Vitest.

### Capa de Base de Datos Compartida (Shared DB)
*   [x] [ src/shared/db/client.ts ]( src/shared/db/client.ts ) *( Modificado )* - Inicialización del cliente global de base de datos (`db`) con carga dinámica de variables locales.
*   [x] [ src/shared/db/schema.ts ]( src/shared/db/schema.ts ) *( Modificado )* - Re-exportación centralizada del esquema de base de datos (incluye perfil y contabilidad).
*   [x] [ src/shared/db/seed.ts   ]( src/shared/db/seed.ts   ) *( Modificado )* - Script de seeding optimizado asíncronamente con datos demo e de partida doble contable.

### Dominio de Autenticación (Feature: Auth)
*   [x] [ src/features/auth/schema.db.ts                 ]( src/features/auth/schema.db.ts                 ) *( Modificado )* - Esquemas multi-tenant Drizzle de `organizations` y `users`.
*   [ ] [ src/features/auth/types.ts                     ]( src/features/auth/types.ts                     ) *( Modificado )* - Extensiones de tipo de NextAuth (`Session`, `User`, `JWT`).
*   [ ] [ src/features/auth/services/authService.ts      ]( src/features/auth/services/authService.ts      ) *( Modificado )* - Lógica criptográfica asíncrona de hashing y verificado `scrypt`.
*   [x] [ src/features/auth/services/authService.test.ts ]( src/features/auth/services/authService.test.ts ) *( Creado )* - Pruebas unitarias de contraseñas seguras y salting.

### Dominio del Perfil de Usuario (Feature: Profile)
*   [ ] [ src/features/profile/schema.db.ts               ]( src/features/profile/schema.db.ts               ) *( Modificado )* - Tabla `profiles` con preferencias de UI, tema, moneda y planes.
*   [ ] [ src/features/profile/types.ts                   ]( src/features/profile/types.ts                   ) *( Modificado )* - Inferencias de tipo de Drizzle para el perfil de usuario.
*   [ ] [ src/features/profile/actions/profileActions.ts  ]( src/features/profile/actions/profileActions.ts  ) *( Creado )* - Server Action para actualizar el perfil del usuario autenticado de forma segura.
*   [ ] [ src/features/profile/context/ProfileContext.tsx ]( src/features/profile/context/ProfileContext.tsx ) *( Modificado )* - Proveedor y contexto de React para el perfil y sincronización del tema en localStorage.

### Capa de Componentes Compartidos (Shared UI Components)
*   [ ] [ src/shared/components/Sidebar.tsx ]( src/shared/components/Sidebar.tsx ) *( Modificado )* - Componente global de barra lateral (Sidebar) con menú de perfil y logout.
*   [ ] [ src/shared/components/Header.tsx  ]( src/shared/components/Header.tsx  ) *( Creado )* - Componente global de cabecera (Header) con saludo personalizado.

### Capa de Rutas, Seguridad e i18n
*   [x] [ src/shared/services/idempotencyService.ts    ]( src/shared/services/idempotencyService.ts    ) *( Creado     )* - Servicio de idempotencia para asegurar operaciones de red una sola vez.
*   [x] [ src/shared/lib/result.ts                     ]( src/shared/lib/result.ts                     ) *( Creado     )* - Estructura Result para control de flujo y manejo tipado de errores.
*   [ ] [ src/shared/lib/currencyFormatter.ts          ]( src/shared/lib/currencyFormatter.ts          ) *( Modificado )* - Formateador de moneda dinámico y escalable resolviendo decimales con Intl.
*   [ ] [ src/shared/lib/currencyFormatter.test.ts     ]( src/shared/lib/currencyFormatter.test.ts     ) *( Modificado )* - Pruebas unitarias para validar el formateo correcto de múltiples divisas.
*   [ ] [ src/shared/lib/circuitBreaker.ts             ]( src/shared/lib/circuitBreaker.ts             ) *( Modificado )* - Patrón Circuit Breaker para protección ante fallos externos.
*   [ ] [ src/shared/lib/logger.ts                     ]( src/shared/lib/logger.ts                     ) *( Modificado )* - Logger estructurado nativo adaptado para desarrollo y producción.
*   [ ] [ src/proxy.ts                                 ]( src/proxy.ts                                 ) *( Modificado )* - Proxy Next.js 16 para i18n (locales `/es` / `/en`) y guardias de seguridad.
*   [ ] [ src/shared/lib/auth.ts                       ]( src/shared/lib/auth.ts                       ) *( Modificado )* - Configuración y callbacks de NextAuth (`authOptions`).
*   [x] [ src/app/api/auth/[...nextauth]/route.ts      ]( src/app/api/auth/[...nextauth]/route.ts      ) *( Creado     )* - Endpoints de sesión GET/POST.
*   [ ] [ src/app/globals.css                          ]( src/app/globals.css                          ) *( Modificado )* - Core del sistema de diseño.
*   [ ] [ src/app/[lang]/layout.tsx                    ]( src/app/[lang]/layout.tsx                    ) *( Modificado )* - Layout global internacionalizado (desmarcado tras integrar ProfileProvider y script anti-flicker).
*   [ ] [ src/app/[lang]/(main)/layout.tsx             ]( src/app/[lang]/(main)/layout.tsx             ) *( Modificado )* - Layout estructural (App Shell) para envolver las páginas protegidas.
*   [ ] [ src/app/[lang]/(main)/page.tsx               ]( src/app/[lang]/(main)/page.tsx               ) *( Modificado )* - Vista principal del Home simplificada bajo el grupo `(main)`.
*   [ ] [ src/app/[lang]/(main)/page.module.css        ]( src/app/[lang]/(main)/page.module.css        ) *( Creado     )* - Estilos del home simplificados.
*   [ ] [ src/app/[lang]/auth/signin/page.tsx          ]( src/app/[lang]/auth/signin/page.tsx          ) *( Modificado )* - Vista de Login.
*   [ ] [ src/app/[lang]/auth/signin/signin.module.css ]( src/app/[lang]/auth/signin/signin.module.css ) *( Creado     )* - Módulo CSS para la pantalla de login.
 
### Dominio Contable (Feature: Accounting)
*   [ ] [ src/features/accounting/schema.db.ts                       ]( src/features/accounting/schema.db.ts                       ) *( Modificado )* - Definición de tablas incluyendo idempotency_keys y outbox_events.
*   [ ] [ src/features/accounting/schemas/accounting.schema.ts       ]( src/features/accounting/schemas/accounting.schema.ts       ) *( Modificado )* - Esquema Zod de validación runtime y auditoría de partida doble.
*   [ ] [ src/features/accounting/repositories/accountRepository.ts  ]( src/features/accounting/repositories/accountRepository.ts  ) *( Modificado )* - Capa de acceso a datos (DAL) para la tabla de cuentas contables.
*   [ ] [ src/features/accounting/repositories/ledgerRepository.ts   ]( src/features/accounting/repositories/ledgerRepository.ts   ) *( Modificado )* - Capa de acceso a datos (DAL) para transacciones y asientos de diario.
*   [ ] [ src/features/accounting/types.ts                           ]( src/features/accounting/types.ts                           ) *( Modificado )* - Tipos inferidos de Drizzle y contratos para el motor de partida doble.
*   [ ] [ src/features/accounting/services/accountingService.ts      ]( src/features/accounting/services/accountingService.ts      ) *( Modificado )* - Motor transaccional ACID de partida doble con soporte para Result y outbox.
*   [ ] [ src/features/accounting/actions/accountingActions.ts       ]( src/features/accounting/actions/accountingActions.ts       ) *( Modificado )* - Acciones de servidor con validación Zod y control de idempotencia.
*   [ ] [ src/features/accounting/services/accountingService.test.ts ]( src/features/accounting/services/accountingService.test.ts ) *( Modificado )* - Pruebas de integración contable actualizadas con Zod, idempotencia y reversiones.
*   [ ] [ docs/proposals/018-double-entry-accounting-core.md         ]( docs/proposals/018-double-entry-accounting-core.md         ) *( Creado     )* - Propuesta de arquitectura borrador (RFC) para el Core Contable.