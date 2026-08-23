# Resultados de la Auditoría: Patrones de Arquitectura

Este documento consolida el análisis de patrones arquitectónicos del proyecto FinanzIA, evaluado archivo por archivo según el plan establecido.

---

## Estado General del Progreso

*   **Fase 1: Configuración, Proxies y Núcleo de DB** $\rightarrow$ **Completado** (6 / 6 archivos)
*   **Fase 2: Librerías Compartidas y Servicios Globales** $\rightarrow$ **Completado** (7 / 7 archivos)
*   **Fase 3: Componentes Visuales Compartidos** $\rightarrow$ **Completado** (3 / 3 archivos)
*   **Fase 4: Dominio de Auth y Perfil de Usuario** $\rightarrow$ **Completado** (8 / 8 archivos)
*   **Fase 5: Dominio Contable (Modelos, Esquemas y Repositorios)** $\rightarrow$ **Completado** (6 / 6 archivos)
*   **Fase 6: Dominio Contable (Servicios y Pruebas Unitarias)** $\rightarrow$ **Completado** (2 / 2 archivos)
*   **Fase 7: Rutas, Layouts, CSS y Endpoints de Next.js** $\rightarrow$ **Completado** (8 / 8 archivos)

---

## Reporte Detallado: Fase 1 (Configuración, Proxies y Núcleo de DB)

### 1. [drizzle.config.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/drizzle.config.ts)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Es un archivo de configuración estático requerido por Drizzle Kit CLI para generar y ejecutar migraciones de base de datos. No forma parte de los flujos de ejecución en caliente del servidor o del cliente.

### 2. [vitest.config.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/vitest.config.ts)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Configuración técnica del entorno de pruebas unitarias (Vitest). No contiene lógica de negocio o datos.

### 3. [src/proxy.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/proxy.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:** 
    *   **Feature-Driven modularity (Parcial):** Centraliza la lógica de enrutamiento y guardias de seguridad consumiendo los locales de las vistas y tokens de NextAuth.
*   **Patrones Aplicables:**
    *   **Circuit Breaker (Bajo Impacto):** Se podría utilizar para mitigar fallas si la validación del JWT de NextAuth fallara recurrentemente contra un servidor de autenticación externo. Sin embargo, para mantener el Edge Middleware lo más liviano y rápido posible, es preferible mantenerlo sin dependencias externas complejas.
*   **Justificación:** Actúa puramente como un interceptor de red de bajo nivel (Middleware). No realiza mutaciones de datos, por lo que no requiere patrones transaccionales, de repositorio o de idempotencia.

### 4. [src/shared/db/client.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/db/client.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Centralizado en `shared/db/` como un recurso transversal disponible para todos los features del sistema.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Su única función es inicializar y proveer la instancia del pool de conexiones del ORM (`db`) y exportar el tipo compuesto `DBOrTx` para transacciones. La lógica operativa se delega a las capas superiores.

### 5. [src/shared/db/schema.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/db/schema.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Actúa como un *barrel file* que unifica todos los esquemas individuales declarados modularmente en cada feature (`src/features/{feature}/schema.db.ts`), sirviendo como entrada unificada para Drizzle sin acoplarlos físicamente.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Es un archivo puramente declarativo y estructural de esquemas de bases de datos.

### 6. [src/shared/db/seed.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/db/seed.ts)
*   **Estado:** Parcialmente Aplicado
*   **Patrones Aplicados:**
    *   **Idempotencia:** Limpia preventivamente los registros de base de datos en orden jerárquico inverso de claves foráneas antes de re-insertar, garantizando que el seed se pueda ejecutar repetidas veces de forma segura en desarrollo.
    *   **Transactional ACID Unit of Work:** Las transacciones contables insertadas de prueba se registran a través de la función `createLedgerTransaction()`, la cual ejecuta todas sus operaciones (inserción de cabecera, actualización de balances de cuentas y creación de entries) dentro de un bloque `db.transaction()` garantizando consistencia absoluta (débito/crédito).
*   **Patrones Aplicables:**
    *   **Result Pattern (Bajo Impacto):** Podría aplicarse si las inserciones básicas iniciales de usuarios, perfiles y organizaciones usaran helpers con retorno tipado en lugar de llamadas directas a `db.insert()`, aunque al ser un script de desarrollo que se corre bajo demanda, es aceptable manejar excepciones con `try/catch` tradicionales.
*   **Justificación:** Script de desarrollo y poblamiento local. No está expuesto a peticiones concurrentes de producción ni flujos de negocio en caliente.

---

## Reporte Detallado: Fase 2 (Librerías Compartidas y Servicios Globales)

### 7. [src/shared/lib/auth.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/auth.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Configuración centralizada de NextAuth desacoplada de la ruta física del middleware y de los endpoints de la API.
    *   **Repository Pattern (Parcial):** Consume de forma directa la tabla física mediante `db.select().from(users)`, pero desacoplado al utilizar los esquemas y servicios de la feature `auth` para la verificación de credenciales (`verifyPassword`).
*   **Patrones Aplicables:**
    *   **Repository Pattern (Mejora):** Delegar la consulta del email del usuario a un repositorio de usuarios o un servicio del módulo de autenticación para que el archivo de configuración de NextAuth no dependa directamente de sentencias SQL del ORM.
*   **Justificación:** Configuración y callbacks de autenticación. Se acepta provisionalmente el acoplamiento directo de base de datos como una **Deuda Técnica Bajo Monitoreo**, justificada al ser un único punto centralizado de acceso de solo lectura para la carga de sesión.

### 8. [src/shared/lib/circuitBreaker.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/circuitBreaker.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Circuit Breaker:** Implementa la infraestructura genérica y reutilizable del patrón Circuit Breaker para envolver peticiones inestables o de terceros con estados de control (`CLOSED`, `OPEN`, `HALF_OPEN`), umbrales de fallo y valor por defecto.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Implementación genérica del patrón.

### 9. [src/shared/lib/currencyFormatter.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/currencyFormatter.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Ubicado como utilidad genérica compartida en `shared/lib/`.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Utilidad de internacionalización pura para formateo numérico. No realiza persistencia ni mutaciones de estado de base de datos.

### 10. [src/shared/lib/currencyFormatter.test.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/currencyFormatter.test.ts)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Suite de pruebas unitarias para `currencyFormatter.ts`.

### 11. [src/shared/lib/logger.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/logger.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Servicio transversal en `shared/lib/`.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Logger central estructurado para la trazabilidad de la aplicación en producción (JSON) y desarrollo (Consola con color).

### 12. [src/shared/lib/result.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib/result.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Result Pattern:** Implementa el andamiaje técnico del patrón de resultados (`Result<T, E>`, `ok()`, `fail()`) que previene el uso de excepciones arrojadas en el dominio.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Infraestructura del patrón Result.

### 13. [src/shared/services/idempotencyService.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/services/idempotencyService.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Idempotencia / Idempotency Service:** Implementación transversal del servicio encargado de cachear y evitar transacciones duplicadas concurrentes.
    *   **Result Pattern:** Utiliza la firma `Result<T, string>` para retornar el resultado de la ejecución controlada.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Servicio core de idempotencia.

---

## Reporte Detallado: Fase 3 (Componentes Visuales Compartidos)

### 14. [src/shared/components/Header.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/components/Header.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Componente visual compartido ubicado en `shared/components/`.
    *   **App Shell Pattern:** Parte estructural del caparazón global que renderiza el saludo del usuario en la parte superior.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Componente React cliente de presentación simple. Consume datos del usuario de NextAuth en tiempo de ejecución. No realiza lógica de negocio ni persistencia.

### 15. [src/shared/components/Icons.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/components/Icons.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Centralización y optimización de SVG de iconos compartidos en un solo archivo para evitar redundancia y mejorar bundles.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Archivo declarativo de iconos SVG estructurados como componentes React.

### 16. [src/shared/components/Sidebar.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/components/Sidebar.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Barra lateral común y menú de usuario ubicados en `shared/components/`.
    *   **App Shell Pattern:** Componente primario de navegación y control de perfil en el diseño global.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Componente interactivo cliente. Consume datos de NextAuth y del `ProfileContext` para visualización del perfil.

---

## Reporte Detallado: Fase 4 (Dominio de Auth y Perfil de Usuario)

### 17. [src/features/auth/schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/auth/schema.db.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Declaración y aislamiento de las tablas del dominio `auth` (`organizations` y `users`) dentro del feature respectivo.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Definición estructural de esquemas de bases de datos.

### 18. [src/features/auth/types.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/auth/types.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Definición y extensiones de tipos de NextAuth dentro del dominio correspondiente.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Archivo declarativo de tipos TypeScript.

### 19. [src/features/auth/services/authService.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/auth/services/authService.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Aislamiento de lógica y utilidades críticas de cifrado de contraseñas con `scrypt` dentro del dominio de autenticación.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Capa de servicios de negocio pura para seguridad.

### 20. [src/features/auth/services/authService.test.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/auth/services/authService.test.ts)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Suite de pruebas unitarias de Vitest para `authService.ts`.

### 21. [src/features/profile/schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/profile/schema.db.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Definición y aislamiento de la tabla `profiles` dentro del dominio correspondiente.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Definición estructural de base de datos.

### 22. [src/features/profile/types.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/profile/types.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Declaración de tipos del modelo de perfil (`ProfileData`) en su propio feature.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Archivo de definición de tipos.

### 23. [src/features/profile/actions/profileActions.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/profile/actions/profileActions.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Server Action de negocio exclusiva del perfil en su propia carpeta.
    *   **Result Pattern:** Retorna el resultado de la mutación tipado con `Result<ProfileData>`.
*   **Patrones Aplicables:**
    *   **Repository Pattern (Mejora):** Delegar la ejecución de `db.update()` en un repositorio de perfiles (`profileRepository`) para evitar acoplamiento directo de la acción con el ORM.
*   **Justificación:** Acción de servidor de actualización de perfiles de usuario. Se acepta esta **Deuda Técnica Temporal** postergando la capa de repositorio debido a que la mutación afecta únicamente a este feature aislado y no impacta en otras transacciones complejas.

### 24. [src/features/profile/context/ProfileContext.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/profile/context/ProfileContext.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** React Context del perfil ubicado en el dominio modular.
    *   **Optimistic Updates:** Realiza actualizaciones optimistas del estado de preferencias en el cliente y revierte el estado local si la Server Action falla.
    *   **Result Pattern:** Consume e interpreta el objeto `Result` de la Server Action para validar si confirma o revierte el cambio optimista.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Context Provider del perfil y del App Shell.

---

## Reporte Detallado: Fase 5 (Dominio Contable: Modelos, Esquemas y Repositorios)

### 25. [src/features/accounting/schema.db.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/schema.db.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Definición e integración modular de las tablas contables (`categories`, `accounts`, `ledger_transactions`, `ledger_entries`, `idempotency_keys`, `outbox_events`) en su propio feature.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Esquema declarativo físico relacional en Drizzle ORM.

### 26. [src/features/accounting/types.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/types.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Tipos inferidos de Drizzle y tipos específicos para parámetros de mutación contable en su dominio correspondiente.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Archivo declarativo de tipos de datos.

### 27. [src/features/accounting/actions/accountingActions.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/actions/accountingActions.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Server Actions del dominio contable estructuradas bajo el feature correspondiente.
    *   **Result Pattern:** Todas las acciones de negocio expuestas al cliente retornan un `Result` tipado.
    *   **Repository Pattern:** Delegación del acceso de consultas a los repositorios (`accountRepository`, `ledgerRepository`).
    *   **Idempotencia / Idempotency Service:** Integra el servicio de idempotencia en la Server Action de creación de transacciones contables.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Capa de Server Actions expuestas.

### 28. [src/features/accounting/schemas/accounting.schema.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/schemas/accounting.schema.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Esquema Zod de validación de partida doble en el dominio modular.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Reglas de validación en runtime (suma de débitos = suma de créditos).

### 29. [src/features/accounting/repositories/accountRepository.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/repositories/accountRepository.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Repositorio de cuentas ubicado en `features/accounting/repositories/`.
    *   **Repository Pattern:** Aísla el acceso de base de datos Drizzle para la tabla `accounts`. Admite `DBOrTx` para su ejecución dentro de transacciones.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Capa de acceso a datos (DAL).

### 30. [src/features/accounting/repositories/ledgerRepository.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/repositories/ledgerRepository.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Repositorio contable en el feature correspondiente.
    *   **Repository Pattern:** Encapsula todo el acceso SQL/Drizzle para transacciones y asientos contables. Admite `DBOrTx` para contextos transaccionales y optimiza N+1 consultas en memoria.
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Capa de acceso a datos (DAL).

---

## Reporte Detallado: Fase 6 (Dominio Contable: Servicios y Pruebas Unitarias)

### 31. [src/features/accounting/services/accountingService.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/services/accountingService.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Capa de lógica y servicios contables aislada en el feature.
    *   **Transactional ACID Unit of Work:** Ejecuta toda la lógica de creación y eliminación contable dentro de un bloque `db.transaction()` de Drizzle, asegurando consistencia y balanceo.
    *   **Transactional Outbox:** Inserta de forma atómica un evento en `outbox_events` (como `TRANSACTION_CREATED` o `TRANSACTION_DELETED`) en la misma transacción física.
    *   **Result Pattern:** Utiliza la firma de retorno `Result<T, string>` para encapsular el éxito y el error descriptivo de negocio.
    *   **Repository Pattern:** Delega las operaciones individuales a los repositorios contables pasando el cliente transaccional (`tx`).
*   **Patrones Aplicables:** Ninguno adicional
*   **Justificación:** Core de negocio contable de partida doble.

### 32. [src/features/accounting/services/accountingService.test.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features/accounting/services/accountingService.test.ts)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Suite de pruebas unitarias y de integración de Vitest para `accountingService.ts`.

---

## Reporte Detallado: Fase 7 (Rutas, Layouts, CSS y Endpoints de Next.js)

### 33. [src/app/globals.css](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/globals.css)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **App Shell Pattern:** Define el diseño responsive, las variables CSS (:root) y el Bottom Nav de navegación móvil por debajo del breakpoint de 768px.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Archivo declarativo CSS que provee los tokens y la base fluida de diseño.

### 34. [src/app/api/auth/[...nextauth]/route.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/api/auth/[...nextauth]/route.ts)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Actúa como un proxy de llamadas delegando toda la configuración técnica al shared de Auth en `src/shared/lib/auth.ts`.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Manejador de rutas físico para la autenticación con NextAuth.

### 35. [src/app/[lang]/layout.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/layout.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Encapsula el `ProfileProvider` para todo el subárbol internacionalizado.
    *   **IIFE Theme Blocking Script:** Inyecta un script inline autoejecutable en el head que asigna de forma síncrona el atributo `data-theme` para prevenir el parpadeo de hidratación en el cliente.
    *   **App Shell Pattern:** Establece las fuentes base y envuelve el renderizado con los contextos fundamentales.
*   **Patrones Aplicables:**
    *   **Repository Pattern (Mejora):** Delegar la lectura de base de datos del perfil a un `profileRepository` en lugar de realizar la consulta SQL directa dentro del layout.
*   **Justificación:** Layout raíz de la aplicación para el ruteo internacionalizado. La consulta SQL directa aquí representa una **Deuda Técnica de Alta Prioridad**. Dado que este layout se ejecuta en cada ciclo de navegación física, la falta de abstracción de datos es crítica, por lo que se debe priorizar su refactorización a un repositorio de perfiles para evitar acoplamiento del renderizado.

### 36. [src/app/[lang]/auth/signin/page.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/auth/signin/page.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Estructura de login modular de autenticación.
    *   **Vercel React Best Practices:** Implementa un renderizado condicional con ternario para el banner de error (`{error ? (...) : null}`).
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Componente de formulario interactivo de cliente.

### 37. [src/app/[lang]/auth/signin/signin.module.css](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/auth/signin/signin.module.css)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** CSS Module con las reglas de estilo y diseño del formulario.

### 38. [src/app/[lang]/(main)/layout.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/(main)/layout.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Aislamiento del subgrupo de rutas principales.
    *   **App Shell Pattern:** Construye la estructura visual envolvente de la aplicación montando el `Sidebar` y el `Header` globales.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Layout contenedor estructural.

### 39. [src/app/[lang]/(main)/page.tsx](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/(main)/page.tsx)
*   **Estado:** Aplicado
*   **Patrones Aplicados:**
    *   **Feature-Driven modularity:** Renders de vista de dashboard por parámetro de localización.
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** Página raíz del panel financiero. Actúa como contenedor de la presentación.

### 40. [src/app/[lang]/(main)/page.module.css](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app/[lang]/(main)/page.module.css)
*   **Estado:** No Aplica
*   **Patrones Aplicados:** Ninguno
*   **Patrones Aplicables:** Ninguno
*   **Justificación:** CSS Module declarativo para la página de dashboard.
