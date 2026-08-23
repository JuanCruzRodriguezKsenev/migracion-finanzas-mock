// Librerías externas
import { pgTable , uuid , varchar , text , timestamp } from "drizzle-orm/pg-core" ;


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
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() , // Relación multi-tenant obligatoria
  email:          varchar( "email" , {length: 255} ).notNull().unique() ,
  name:           varchar( "name"  , {length: 255} ) ,
  role:           varchar( "role"  , {length: 50 } ).default( "member" ).notNull() , // Rol del usuario: 'owner' | 'admin' | 'member'
  passwordHash:   text( "password_hash" ).notNull() ,
  salt:           varchar( "salt"  , {length: 64 } ).notNull() ,
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:      timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull()
} ) ;