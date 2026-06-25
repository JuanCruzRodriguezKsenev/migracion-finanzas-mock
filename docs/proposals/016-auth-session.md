# RFC 016: Gestión de Autenticación y Sesión de Usuarios

*   **ID de la Propuesta:** 016
*   **Título:** Gestión de Autenticación, Registro y Sesiones con Auth.js (NextAuth) y Node Crypto
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-23
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para un SaaS financiero multi-tenant, la autenticación y la seguridad de las sesiones de los usuarios son el perímetro de defensa principal. Necesitamos asegurar que:
1. Las contraseñas se almacenen de forma segura e incomprensible (hashing criptográfico robusto).
2. La verificación de la sesión sea extremadamente veloz para no penalizar la carga de páginas y la API (Cold Starts mínimos).
3. La estructura de autenticación sea modular y encaje limpiamente en la Feature-Driven Architecture bajo `src/features/auth/`.
4. El sistema soporte multi-tenancy, vinculando de forma segura al usuario autenticado con su organización activa (`organization_id`).

---

## 2. Decisiones de Diseño

### A. Proveedor de Autenticación: Auth.js (NextAuth v5+)
Adoptamos Auth.js por ser el estándar oficial de Next.js, diseñado específicamente para funcionar con Server Actions, App Router y optimizado para entornos Edge/Serverless.

### B. Mecanismo de Sesión: JSON Web Tokens (JWT)
*   En lugar de almacenar sesiones de base de datos activas (que requieren lecturas a la DB en cada petición HTTP), utilizaremos **JWT firmados y cifrados**.
*   El token de sesión incluirá de manera segura:
    *   `userId` (UUID del usuario).
    *   `organizationId` (UUID de la organización activa del usuario para inyectarla en queries de forma transparente).
    *   `role` (Rol del usuario: 'owner', 'admin', 'member').
*   El tiempo de expiración por defecto será de 30 días, con renovación automática (sliding session).

### C. Hashing de Contraseñas: API Criptográfica Nativa (`crypto` de Node.js)
Evitamos librerías nativas como `bcrypt` que compilan código C++ en el sistema operativo y suelen fallar al desplegar en contenedores ligeros o Windows.
*   Utilizaremos el algoritmo nativo **`scrypt`** de Node.js.
*   **scrypt** es un algoritmo diseñado específicamente para ser intensivo en memoria y hardware, dificultando ataques de fuerza bruta y GPU acelerados.
*   Guardaremos dos valores por usuario:
    1.  `password_hash`: La contraseña hasheada y codificada en hexadecimal.
    2.  `salt`: Una cadena aleatoria única (16 bytes) generada al registrarse para prevenir ataques de tablas arcoíris.

---

## 3. Esquema de Base de Datos (`src/features/auth/schema.db.ts`)

La feature de autenticación encapsula su propia tabla de usuarios con las credenciales correspondientes. La tabla se complementará para Auth.js de la siguiente forma:

```typescript
import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { organizations } from "@/features/accounts/schema.db"; // Si estuvieran en accounts o shared

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 50 }).default("member").notNull(), // 'owner' | 'admin' | 'member'
  
  // Credenciales locales
  passwordHash: text("password_hash").notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

## 4. Arquitectura de Archivos de la Feature `auth`

Siguiendo las reglas de la Feature-Driven Architecture, todos los recursos de autenticación se agrupan en un solo módulo:

```text
src/features/auth/
├── components/
│   ├── LoginForm.tsx          # Componente React de Login (Client Component)
│   └── RegisterForm.tsx       # Componente React de Registro (Client Component)
├── services/
│   ├── authService.ts         # Métodos de negocio: hashing, verificación, creación de usuario
│   └── sessionService.ts      # Utilidades para interactuar con la sesión en el servidor
├── lib/
│   └── authOptions.ts         # Configuración de proveedores y callbacks para NextAuth
├── schema.db.ts               # Definición de tablas de Drizzle (users)
├── types.ts                   # Extensiones de tipo para JWT de NextAuth y tipos locales
└── actions.ts                 # Server Actions (loginAction, registerAction) para manejar los envíos de formulario
```

---

## 5. Implementación del Hashing (`src/features/auth/services/authService.ts`)

La lógica de hashing y verificación utiliza exclusivamente funciones estándar de Node.js:

```typescript
import crypto from "crypto";

/**
 * Genera un salt y hashea una contraseña utilizando el algoritmo scrypt.
 * 
 * @param password - La contraseña en texto plano provista por el usuario.
 * @returns Un objeto que contiene el salt generado y el hash resultante en formato hexadecimal.
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  return new Promise((resolve, reject) => {
    // Generar un salt aleatorio de 16 bytes codificado en hexadecimal
    const salt = crypto.randomBytes(16).toString("hex");
    
    // Generar el hash de la contraseña usando scrypt
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({
        hash: derivedKey.toString("hex"),
        salt,
      });
    });
  });
}

/**
 * Compara una contraseña en texto plano con un hash almacenado para verificar su validez.
 * 
 * @param password - La contraseña ingresada por el usuario en texto plano.
 * @param hash - El hash de contraseña almacenado en la base de datos.
 * @param salt - El salt correspondiente almacenado en la base de datos.
 * @returns Booleano que indica si la contraseña coincide con el hash.
 */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex") === hash);
    });
  });
}
```

---

## 6. Configuración de Auth.js y Control de Acceso (Middleware)

### Extensiones de Tipado de Sesión (`src/features/auth/types.ts`)
Debemos extender los tipos de NextAuth para inyectar y usar tipado seguro de `organizationId`:

```typescript
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    organizationId: string;
    role: string;
  }

  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    role: string;
  }
}
```

### Middleware Global de Seguridad (`src/middleware.ts`)
Ubicado en la raíz del código (`src/middleware.ts`), protege dinámicamente las rutas del panel de control redireccionando al usuario no autenticado e inyectando las redirecciones idiomáticas requeridas:

```typescript
import { auth } from "@/shared/lib/auth"; // Instancia configurada de Auth.js
import { NextResponse } from "next/server";

const locales = ["es", "en"];
const defaultLocale = "es";

export const middleware = auth((req) => {
  const { pathname } = req.nextUrl;

  // 1. Retorno temprano para recursos estáticos y rutas internas de la API
  const isExcluded = pathname.startsWith("/api") ||
                     pathname.startsWith("/_next") ||
                     pathname.startsWith("/favicon.ico") ||
                     pathname.match(/\.[a-zA-Z0-9]+$/);

  if (isExcluded) {
    return NextResponse.next();
  }

  // 2. Detectar si el locale ya existe en la ruta actual
  const urlLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // Calcular el idioma deseado basado en el encabezado Accept-Language
  const acceptLanguage = req.headers.get("accept-language") || "";
  let desiredLocale = defaultLocale;
  const match = acceptLanguage.match(/([a-zA-Z]{2})/);
  if (match) {
    const lang = match[1].toLowerCase();
    if (locales.includes(lang)) {
      desiredLocale = lang;
    }
  }

  // 3. Redireccionar si la ruta carece del prefijo de idioma
  if (!urlLocale) {
    const url = req.nextUrl.clone();
    url.pathname = `/${desiredLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // 4. Barreras de autenticación (Client Guards)
  const isLoggedIn = !!req.auth;
  
  // Rutas privadas: están bajo un locale pero no contienen "/auth/"
  const isOnDashboard = locales.some((locale) => pathname.startsWith(`/${locale}`)) && !pathname.includes("/auth");
  
  // Rutas de autenticación pública (login, registro)
  const isOnAuth = locales.some((locale) => pathname.startsWith(`/${locale}/auth`));

  // Si intenta acceder a rutas privadas sin estar logueado
  if (isOnDashboard && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = `/${urlLocale}/auth/login`;
    return NextResponse.redirect(url);
  }

  // Si intenta acceder al login/registro ya estando autenticado
  if (isOnAuth && isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = `/${urlLocale}`; // Redirige a la raíz del dashboard correspondiente
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Excluir assets estáticos y endpoints de API, ejecutar el middleware en todo lo demás
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\..*).*)",
  ],
};

export default middleware;
```

> [!IMPORTANT]
> **Alineación con `server-serialization` (Vercel):**
> Al configurar la sesión en los callbacks de NextAuth, se deben seleccionar estrictamente los campos indispensables de la UI (`id`, `organizationId`, `role`, `name`, `email`). Nunca debe propagarse el objeto de usuario completo de la base de datos para evitar la serialización de datos confidenciales y la fuga del hash de contraseña o salt hacia el cliente.


---

## 7. Preguntas para el Debate y Alternativas

1.  **¿Uso de Proveedores OAuth (Google, GitHub)?**
    *   *Propuesta:* Para el MVP y desarrollo inicial local, nos enfocamos en el email/password. Posteriormente, NextAuth nos permite añadir proveedores externos de forma muy simple configurando variables de entorno sin modificar el esquema principal.
2.  **¿Políticas de Contraseña Segura?**
    *   *Propuesta:* Exigir en los formularios de registro (vía Zod) una longitud mínima de 12 caracteres, al menos un número, una mayúscula y un carácter especial.
