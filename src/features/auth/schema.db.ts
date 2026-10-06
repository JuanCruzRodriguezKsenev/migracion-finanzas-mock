// Librerías externas
import { pgTable , uuid , varchar , text , integer , timestamp , uniqueIndex , index } from "drizzle-orm/pg-core" ;


/**
 * Definición del esquema para la tabla de Organizaciones (Tenants).
 * Actúa como la entidad raíz para la delimitación lógica de datos de cada cliente.
 */
export const organizations = pgTable( "organizations" , {
  id:        uuid( "id" ).primaryKey().defaultRandom() , // Identificador único (UUID v7 generado por DB)
  name:      varchar( "name" , {length: 255} ).notNull() ,
  slug:      varchar( "slug" , {length: 255} ).notNull().unique() ,
  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull()
} ) ;

/**
 * Definición del esquema para la tabla de Usuarios.
 * Contiene los datos de perfil, credenciales criptográficas y pertenencia a organización.
 */
export const users = pgTable( "users" , {
  id:                 uuid( "id" ).primaryKey().defaultRandom() ,
  lastOrganizationId: uuid( "last_organization_id" ).references( () => organizations.id , {onDelete: "set null"} ) ,
  email:              varchar( "email" , {length: 255} ).notNull().unique() ,
  name:               varchar( "name"  , {length: 255} ) ,
  passwordHash:       text( "password_hash" ).notNull() ,
  salt:               varchar( "salt"  , {length: 64 } ).notNull() ,
  // Parámetros de costo con los que se derivó `password_hash`, en la forma `scrypt$N$r$p$keylen`.
  // Nulo en las filas anteriores a esta columna: authService las verifica con PARAMS_LEGADO y las
  // rehashea en su próximo login. Sin este dato, subir el costo criptográfico obligaría a resetear
  // todas las contraseñas de golpe.
  hashParams:         varchar( "hash_params" , {length: 100} ) ,
  createdAt:          timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:          timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull()
} ) ;

/**
 * Definición del esquema para la tabla de Membresías.
 * Modela la pertenencia de usuarios a organizaciones (N:M) y su rol específico en cada una.
 */
export const memberships = pgTable( "memberships" , {
  userId:         uuid( "user_id"         ).references( () => users.id         , {onDelete: "cascade"} ).notNull() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  role:           varchar( "role"         , {length: 50} ).default( "member" ).notNull() , // Rol del usuario: 'owner' | 'member' | 'viewer'
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueUserOrg: uniqueIndex( "memberships_user_id_organization_id_unique" ).on( table.userId , table.organizationId ) ,
  orgIdx:        index( "memberships_organization_id_idx" ).on( table.organizationId ) ,
} ) ; } ) ;

/**
 * Registro de intentos de autenticación fallidos, para frenar la fuerza bruta contra credenciales.
 *
 * Vive en la base y no en memoria del proceso a propósito: un contador en memoria se reinicia con
 * cada despliegue y no se comparte entre instancias, que es exactamente lo que un atacante
 * necesita para que el bloqueo no exista.
 *
 * `identifier` lleva su tipo adelante (`email:...` o `ip:...`) para poder limitar por cuenta y por
 * origen en la misma tabla: la primera protege una cuenta concreta, la segunda frena el barrido
 * de muchas cuentas desde un mismo origen.
 */
export const loginAttempts = pgTable( "login_attempts" , {
  identifier:    varchar( "identifier" , {length: 255} ).primaryKey() , // 'email:<normalizado>' | 'ip:<dirección>'
  failedCount:   integer( "failed_count" ).default( 0 ).notNull() ,
  firstFailedAt: timestamp( "first_failed_at" , {withTimezone: true} ).defaultNow().notNull() ,
  lastFailedAt:  timestamp( "last_failed_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  lockedUntil:   timestamp( "locked_until"    , {withTimezone: true} )
} ) ;