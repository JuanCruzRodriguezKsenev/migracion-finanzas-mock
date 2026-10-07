// Librerías externas
import { pgTable , uuid , varchar , text , integer , timestamp , uniqueIndex , index , check } from "drizzle-orm/pg-core" ;
import { sql }                                                                                  from "drizzle-orm" ;


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
  googleSub:          varchar( "google_sub" , {length: 255} ).unique() ,
  image:              text( "image" ) ,
  passwordHash:       text( "password_hash" ) ,
  salt:               varchar( "salt"  , {length: 64 } ) ,
  // Parámetros de costo con los que se derivó `password_hash`, en la forma `scrypt$N$r$p$keylen`.
  // Nulo en las filas anteriores a esta columna: authService las verifica con PARAMS_LEGADO y las
  // rehashea en su próximo login. Sin este dato, subir el costo criptográfico obligaría a resetear
  // todas las contraseñas de golpe.
  hashParams:         varchar( "hash_params" , {length: 100} ) ,
  createdAt:          timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:          timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull()
} , ( table ) => { return( {
  authMethodCheck: check( "users_auth_method_check" , sql`${table.passwordHash} IS NOT NULL OR ${table.googleSub} IS NOT NULL` ) ,
} ) ; } ) ;

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
 * Definición del esquema para la tabla de Invitaciones.
 * Modela invitaciones pendientes o resueltas a organizaciones para nuevos o existentes usuarios.
 */
export const invitations = pgTable( "invitations" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  email:          varchar( "email" , {length: 255} ).notNull() ,
  role:           varchar( "role"  , {length: 50 } ).notNull() , // 'owner' | 'member' | 'viewer'
  invitedBy:      uuid( "invited_by" ).references( () => users.id , {onDelete: "set null"} ) ,
  status:         varchar( "status" , {length: 50} ).default( "pending" ).notNull() , // 'pending' | 'accepted' | 'revoked'
  expiresAt:      timestamp( "expires_at"  , {withTimezone: true} ).notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  acceptedAt:     timestamp( "accepted_at" , {withTimezone: true} )
} , ( table ) => { return( {
  // Un 'pending' vencido seguiría estorbando: por eso 'invitar' (plan 4) marca como 'revoked' los vencidos de ese par antes de insertar.
  uniquePendingOrgEmail: uniqueIndex( "invitations_organization_id_email_pending_unique" )
    .on( table.organizationId , table.email )
    .where( sql`${table.status} = 'pending'` ) ,
} ) ; } ) ;

/**
 * Definición del esquema para la tabla de Habilitaciones.
 * Una habilitación permite a un miembro (`grantee`) cargar movimientos a nombre de otro (`grantor`)
 * dentro de una organización. Se revoca con `revoked_at`; sólo puede haber una vigente por par.
 */
export const holderAuthorizations = pgTable( "holder_authorizations" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id"    ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  grantorUserId:  uuid( "grantor_user_id"    ).references( () => users.id         , {onDelete: "cascade"} ).notNull() ,
  granteeUserId:  uuid( "grantee_user_id"    ).references( () => users.id         , {onDelete: "cascade"} ).notNull() ,
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  revokedAt:      timestamp( "revoked_at" , {withTimezone: true} )
} , ( table ) => { return( {
  uniqueVigente: uniqueIndex( "holder_authorizations_org_grantor_grantee_active_unique" )
    .on( table.organizationId , table.grantorUserId , table.granteeUserId )
    .where( sql`${table.revokedAt} IS NULL` ) ,
  distintos:     check( "holder_authorizations_distintos_check" , sql`${table.grantorUserId} <> ${table.granteeUserId}` ) ,
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