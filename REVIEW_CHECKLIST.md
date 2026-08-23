# Checklist de Revisión de Archivos

Este checklist contiene todos los archivos creados y modificados en el proyecto hasta el momento. Puedes utilizarlo para llevar el control de tu revisión.

> [!NOTE]
> Si de aquí en adelante modifico cualquiera de estos archivos, me encargaré de **desmarcar** automáticamente su checkbox correspondiente para que sepas que requiere una nueva revisión.

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
*   [x] [ src/features/auth/components/SignInForm.tsx    ]( src/features/auth/components/SignInForm.tsx    ) *( Creado     )* - Formulario cliente interactivo de inicio de sesión.
*   [ ] [ src/features/auth/repositories/userRepository.ts ]( src/features/auth/repositories/userRepository.ts ) *( Creado     )* - Repositorio de acceso a datos para usuarios (DAL).
*   [x] [ src/features/auth/schema.db.ts                   ]( src/features/auth/schema.db.ts                   ) *( Modificado )* - Esquemas multi-tenant Drizzle de `organizations` y `users`.
*   [x] [ src/features/auth/types.ts                       ]( src/features/auth/types.ts                     ) *( Modificado )* - Extensiones de tipo de NextAuth (`Session`, `User`, `JWT`).
*   [x] [ src/features/auth/services/authService.ts        ]( src/features/auth/services/authService.ts      ) *( Modificado )* - Lógica criptográfica asíncrona de hashing y verificado `scrypt`.
*   [x] [ src/features/auth/services/authService.test.ts   ]( src/features/auth/services/authService.test.ts ) *( Creado )* - Pruebas unitarias de contraseñas seguras y salting.

### Dominio del Perfil de Usuario (Feature: Profile)
*   [x] [ src/features/profile/repositories/profileRepository.ts ]( src/features/profile/repositories/profileRepository.ts ) *( Creado     )* - Repositorio de acceso a datos para perfiles (DAL).
*   [x] [ src/features/profile/schema.db.ts                      ]( src/features/profile/schema.db.ts                     ) *( Modificado )* - Tabla `profiles` con preferencias de UI, tema, moneda y planes.
*   [x] [ src/features/profile/types.ts                          ]( src/features/profile/types.ts                         ) *( Modificado )* - Inferencias de tipo de Drizzle para el perfil de usuario.
*   [x] [ src/features/profile/actions/profileActions.ts         ]( src/features/profile/actions/profileActions.ts        ) *( Creado     )* - Server Action para actualizar el perfil del usuario autenticado de forma segura.
*   [ ] [ src/features/profile/context/ProfileContext.tsx        ]( src/features/profile/context/ProfileContext.tsx ) *( Modificado )* - Proveedor y contexto de React para el perfil y sincronización del tema en localStorage.

### Capa de Componentes Compartidos (Shared UI Components)
*   [ ] [ src/shared/components/SessionProvider.tsx   ]( src/shared/components/SessionProvider.tsx   ) *( Creado     )* - Proveedor de sesión de NextAuth para el lado del cliente.
*   [ ] [ src/shared/components/Navbar.tsx            ]( src/shared/components/Navbar.tsx            ) *( Creado     )* - Barra lateral de navegación (Navbar) compuesta de links y menú de usuario.
*   [ ] [ src/shared/components/Navbar.module.css     ]( src/shared/components/Navbar.module.css     ) *( Creado     )* - Estilos modulares responsivos para la barra lateral.
*   [ ] [ src/shared/components/ProfileMenu.tsx       ]( src/shared/components/ProfileMenu.tsx       ) *( Creado     )* - Componente de menú de usuario flotante acoplado a portal.
*   [ ] [ src/shared/components/ProfileMenu.module.css ]( src/shared/components/ProfileMenu.module.css ) *( Creado     )* - Estilos modulares del perfil y disparador del portal.
*   [ ] [ src/shared/components/Popup.tsx             ]( src/shared/components/Popup.tsx             ) *( Creado     )* - Portal de posicionamiento genérico y escape de stacks.
*   [ ] [ src/shared/components/Popup.module.css      ]( src/shared/components/Popup.module.css      ) *( Creado     )* - Estilos y animaciones del popup de portal.
*   [ ] [ src/shared/components/Header.tsx            ]( src/shared/components/Header.tsx            ) *( Modificado )* - Componente global de cabecera con CSS Module.
*   [ ] [ src/shared/components/Header.module.css     ]( src/shared/components/Header.module.css     ) *( Creado     )* - Estilos modulares para la cabecera.
*   [ ] [ src/shared/components/BottomNav.tsx         ]( src/shared/components/BottomNav.tsx         ) *( Creado     )* - Barra inferior responsiva tipo SofaScore con CSS Module.
*   [ ] [ src/shared/components/BottomNav.module.css  ]( src/shared/components/BottomNav.module.css  ) *( Creado     )* - Estilos modulares para el BottomNav móvil.
*   [ ] [ src/shared/components/AppShell.tsx          ]( src/shared/components/AppShell.tsx          ) *( Modificado )* - Contenedor orquestador responsivo cliente con CSS Module.
*   [ ] [ src/shared/components/AppShell.module.css   ]( src/shared/components/AppShell.module.css   ) *( Creado     )* - Estilos modulares del layout del App Shell y Drawer responsivos.
*   [ ] [ src/shared/components/Icons.tsx             ]( src/shared/components/Icons.tsx             ) *( Modificado )* - Iconos SVG optimizados con IconWrapper.
*   [x] [ src/shared/ui/feedback/Modal/Modal.tsx                 ]( src/shared/ui/feedback/Modal/Modal.tsx                 ) *( Creado     )* - Componente modal genérico accesible y responsivo.
*   [x] [ src/shared/ui/feedback/Modal/Modal.module.css          ]( src/shared/ui/feedback/Modal/Modal.module.css          ) *( Creado     )* - Estilos modulares del fondo translúcido y animaciones de modal.
*   [x] [ src/shared/ui/display/Button/Button.tsx                 ]( src/shared/ui/display/Button/Button.tsx                 ) *( Creado     )* - Componente de botón genérico con soporte de carga, variantes e iconos.
*   [x] [ src/shared/ui/display/Button/Button.module.css          ]( src/shared/ui/display/Button/Button.module.css          ) *( Creado     )* - Estilos modulares del componente de botón y animaciones del spinner.
*   [x] [ src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx ]( src/shared/ui/display/InstitutionLogo/InstitutionLogo.tsx ) *( Creado )* - Componente dinámico de logotipos marcarios utilizando la Brand Search API.
*   [x] [ src/shared/ui/display/InstitutionLogo/InstitutionLogo.module.css ]( src/shared/ui/display/InstitutionLogo/InstitutionLogo.module.css ) *( Creado )* - Estilos y animaciones del componente de logotipos marcarios.
*   [x] [ src/shared/ui/display/Toolbar/Toolbar.tsx             ]( src/shared/ui/display/Toolbar/Toolbar.tsx             ) *( Creado     )* - Barra de herramientas genérica y modular que integra filtros, orden y columnas.
*   [x] [ src/shared/ui/display/Toolbar/SearchBar.tsx           ]( src/shared/ui/display/Toolbar/SearchBar.tsx           ) *( Creado     )* - Barra de búsqueda integrada con opción de borrado.
*   [x] [ src/shared/ui/display/Toolbar/FilterBtn.tsx           ]( src/shared/ui/display/Toolbar/FilterBtn.tsx           ) *( Creado     )* - Control de filtrado dinámico multi-criterio con insignias.
*   [x] [ src/shared/ui/display/Toolbar/SortControl.tsx         ]( src/shared/ui/display/Toolbar/SortControl.tsx         ) *( Creado     )* - Control de ordenación por campos y alternancia de dirección.
*   [x] [ src/shared/ui/display/Toolbar/ColumnSelector.tsx      ]( src/shared/ui/display/Toolbar/ColumnSelector.tsx      ) *( Creado     )* - Selector y alternador de visibilidad de columnas de datos.
*   [x] [ src/shared/ui/display/Toolbar/Toolbar.module.css      ]( src/shared/ui/display/Toolbar/Toolbar.module.css      ) *( Creado     )* - Estilos modulares responsivos y transparentes (glassmorphism) para la barra de herramientas.

### Capa de Rutas, Seguridad e i18n
*   [x] [ src/shared/services/idempotencyService.ts    ]( src/shared/services/idempotencyService.ts    ) *( Creado     )* - Servicio de idempotencia para asegurar operaciones de red una sola vez.
*   [x] [ src/shared/lib/result.ts                     ]( src/shared/lib/result.ts                     ) *( Creado     )* - Estructura Result para control de flujo y manejo tipado de errores.
*   [x] [ src/shared/lib/currencyFormatter.ts          ]( src/shared/lib/currencyFormatter.ts          ) *( Modificado )* - Formateador de moneda dinámico y escalable resolviendo decimales con Intl.
*   [x] [ src/shared/lib/currencyFormatter.test.ts     ]( src/shared/lib/currencyFormatter.test.ts     ) *( Modificado )* - Pruebas unitarias para validar el formateo correcto de múltiples divisas.
*   [x] [ src/shared/lib/circuitBreaker.ts             ]( src/shared/lib/circuitBreaker.ts             ) *( Modificado )* - Patrón Circuit Breaker para protección ante fallos externos.
*   [x] [ src/shared/lib/logger.ts                     ]( src/shared/lib/logger.ts                     ) *( Modificado )* - Logger estructurado nativo adaptado para desarrollo y producción.
*   [x] [ src/proxy.ts                                 ]( src/proxy.ts                                 ) *( Modificado )* - Proxy Next.js 16 para i18n (locales `/es` / `/en`) y guardias de seguridad.
*   [ ] [ src/shared/lib/auth.ts                       ]( src/shared/lib/auth.ts                       ) *( Modificado )* - Configuración y callbacks de NextAuth (`authOptions`).
*   [ ] [ src/shared/lib/dictionary.ts                 ]( src/shared/lib/dictionary.ts                 ) *( Creado     )* - Cargador dinámico asíncrono de diccionarios de traducciones.
*   [ ] [ src/dictionaries/es.json                     ]( src/dictionaries/es.json                     ) *( Creado     )* - Diccionario de traducciones en español.
*   [ ] [ src/dictionaries/en.json                     ]( src/dictionaries/en.json                     ) *( Creado     )* - Diccionario de traducciones en inglés.
*   [ ] [ src/dictionaries/br.json                     ]( src/dictionaries/br.json                     ) *( Creado     )* - Diccionario de traducciones en portugués (Brasil).
*   [x] [ src/app/api/auth/[...nextauth]/route.ts      ]( src/app/api/auth/[...nextauth]/route.ts      ) *( Creado     )* - Endpoints de sesión GET/POST.
*   [ ] [ src/app/globals.css                          ]( src/app/globals.css                          ) *( Modificado )* - Core del sistema de diseño.
*   [ ] [ src/app/[lang]/layout.tsx                    ]( src/app/[lang]/layout.tsx                    ) *( Modificado )* - Layout global internacionalizado (desmarcado tras integrar ProfileProvider y script anti-flicker).
*   [ ] [ src/app/[lang]/(main)/layout.tsx             ]( src/app/[lang]/(main)/layout.tsx             ) *( Modificado )* - Layout estructural (App Shell) para envolver las páginas protegidas.
*   [ ] [ src/app/[lang]/(main)/page.tsx               ]( src/app/[lang]/(main)/page.tsx               ) *( Modificado )* - Vista principal del Home simplificada bajo el grupo `(main)`.
*   [x] [ src/app/[lang]/(main)/page.module.css        ]( src/app/[lang]/(main)/page.module.css        ) *( Creado     )* - Estilos del home simplificados.
*   [ ] [ src/app/[lang]/auth/signin/page.tsx          ]( src/app/[lang]/auth/signin/page.tsx          ) *( Modificado )* - Vista de Login.
*   [x] [ src/app/[lang]/auth/signin/signin.module.css ]( src/app/[lang]/auth/signin/signin.module.css ) *( Creado     )* - Módulo CSS para la pantalla de login.

### Dominio del Sandbox (Feature: Sandbox)
*   [x] [ src/app/[lang]/(main)/sandbox/page.tsx       ]( src/app/[lang]/(main)/sandbox/page.tsx       ) *( Modificado )* - Ruta del panel de sandboxes de FinanzIA.
*   [x] [ src/features/sandbox/components/SandboxContainer.tsx ]( src/features/sandbox/components/SandboxContainer.tsx ) *( Creado )* - Contenedor cliente de sandboxes con Tabs.
*   [x] [ src/features/sandbox/components/DashboardSandbox.tsx ]( src/features/sandbox/components/DashboardSandbox.tsx ) *( Creado )* - Simulador interactivo de métricas con el componente Card genérico.
*   [x] [ src/features/sandbox/components/DashboardSandbox.module.css ]( src/features/sandbox/components/DashboardSandbox.module.css ) *( Creado )* - Estilos del simulador de métricas.

### Dominio Contable (Feature: Accounting)
*   [x] [ src/features/accounting/schema.db.ts                       ]( src/features/accounting/schema.db.ts                       ) *( Modificado )* - Definición de tablas incluyendo idempotency_keys y outbox_events.
*   [x] [ src/features/accounting/schemas/accounting.schema.ts       ]( src/features/accounting/schemas/accounting.schema.ts       ) *( Modificado )* - Esquema Zod de validación runtime y auditoría de partida doble.
*   [x] [ src/features/accounting/repositories/accountRepository.ts  ]( src/features/accounting/repositories/accountRepository.ts  ) *( Modificado )* - Capa de acceso a datos (DAL) para la tabla de cuentas contables.
*   [x] [ src/features/accounting/repositories/ledgerRepository.ts   ]( src/features/accounting/repositories/ledgerRepository.ts   ) *( Modificado )* - Capa de acceso a datos (DAL) para transacciones y asientos de diario.
*   [x] [ src/features/accounting/types.ts                           ]( src/features/accounting/types.ts                           ) *( Modificado )* - Tipos inferidos de Drizzle y contratos para el motor de partida doble.
*   [x] [ src/features/accounting/services/accountingService.ts      ]( src/features/accounting/services/accountingService.ts      ) *( Modificado )* - Motor transaccional ACID de partida doble con soporte para Result y outbox.
*   [x] [ src/features/accounting/actions/accountingActions.ts       ]( src/features/accounting/actions/accountingActions.ts       ) *( Modificado )* - Acciones de servidor con validación Zod y control de idempotencia (soporte para institution).
*   [x] [ src/features/accounting/services/accountingService.test.ts ]( src/features/accounting/services/accountingService.test.ts ) *( Modificado )* - Pruebas de integración contable actualizadas con Zod, idempotencia y reversiones.
*   [x] [ docs/proposals/018-double-entry-accounting-core.md         ]( docs/proposals/018-double-entry-accounting-core.md         ) *( Creado     )* - Propuesta de arquitectura borrador (RFC) para el Core Contable.
*   [x] [ src/app/[lang]/(main)/accounts/page.tsx                    ]( src/app/[lang]/(main)/accounts/page.tsx                    ) *( Modificado )* - Servidor de enrutamiento y contenedores para el catálogo de cuentas.
*   [x] [ src/app/[lang]/(main)/accounts/page.module.css             ]( src/app/[lang]/(main)/accounts/page.module.css             ) *( Modificado )* - Hoja de estilos responsiva del layout de la página de cuentas.
*   [x] [ src/features/accounting/components/AccountsContainer.tsx    ]( src/features/accounting/components/AccountsContainer.tsx    ) *( Creado     )* - Contenedor principal de cuentas con MetricCards, Tabs, y modal overlay.
*   [x] [ src/features/accounting/components/AccountsContainer.module.css ]( src/features/accounting/components/AccountsContainer.module.css ) *( Creado  )* - Hoja de estilos y animaciones del modal de cuentas.
*   [x] [ src/features/accounting/components/CreateAccountForm.tsx    ]( src/features/accounting/components/CreateAccountForm.tsx    ) *( Creado     )* - Componente del formulario cliente para registrar cuentas con entidad.
*   [x] [ src/features/accounting/components/CreateAccountForm.module.css ]( src/features/accounting/components/CreateAccountForm.module.css ) *( Creado  )* - Hoja de estilos para el formulario interactivo de nueva cuenta.
*   [x] [ src/features/accounting/components/AccountList.tsx          ]( src/features/accounting/components/AccountList.tsx          ) *( Discontinuado )* - Lógica migrada a AccountsContainer.tsx.
*   [x] [ src/features/accounting/components/AccountList.module.css   ]( src/features/accounting/components/AccountList.module.css   ) *( Discontinuado )* - CSS migrado a AccountsContainer.module.css.

### Dominio de Alertas y Notificaciones (Feature: Notifications)
*   [x] [ src/features/notifications/types.ts                       ]( src/features/notifications/types.ts                       ) *( Creado     )* - Modelos de datos e interfaces para deudas y recibos por eventos grupales.
*   [x] [ src/features/notifications/lib/notificationHelpers.ts      ]( src/features/notifications/lib/notificationHelpers.ts      ) *( Creado     )* - Funciones puras para procesar y contar notificaciones no leídas bajo Node.
*   [x] [ src/features/notifications/lib/notificationHelpers.test.ts ]( src/features/notifications/lib/notificationHelpers.test.ts ) *( Creado     )* - Pruebas unitarias nativas en Node para la cuenta de alertas.
*   [x] [ src/features/notifications/context/NotificationsContext.tsx ]( src/features/notifications/context/NotificationsContext.tsx ) *( Creado    )* - Proveedor de estado interactivo con persistencia local de demostración.
*   [x] [ src/features/notifications/context/NotificationsContext.test.tsx ]( src/features/notifications/context/NotificationsContext.test.tsx ) *( Creado )* - Test placeholder puro en Node para el contexto.
*   [x] [ src/features/notifications/components/NotificationsDropdown.tsx ]( src/features/notifications/components/NotificationsDropdown.tsx ) *( Creado  )* - Menú desplegable interactivo para el Header (Popup).
*   [x] [ src/features/notifications/components/NotificationsDropdown.module.css ]( src/features/notifications/components/NotificationsDropdown.module.css ) *( Creado )* - Estilos modulares del Popover del Header.
*   [x] [ src/features/notifications/components/DashboardAlerts.tsx  ]( src/features/notifications/components/DashboardAlerts.tsx  ) *( Creado     )* - Banners de alerta destacados anclados al inicio del panel del usuario.
*   [x] [ src/features/notifications/components/DashboardAlerts.module.css ]( src/features/notifications/components/DashboardAlerts.module.css ) *( Creado  )* - Estilos modulares para los banners interactivos del panel.