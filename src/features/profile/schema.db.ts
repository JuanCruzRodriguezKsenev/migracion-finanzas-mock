/**
 * @file schema.db.ts
 * Definición del esquema de la tabla de perfiles y preferencias de usuario.
 */
// Librerías externas
import { pgTable , uuid , varchar , text , boolean } from "drizzle-orm/pg-core" ;

// Feature: Auth
import { users } from "@/features/auth/schema.db" ;

export const profiles = pgTable( "profiles" , {
  userId:           uuid( "user_id" ).primaryKey().references( () => users.id , {onDelete: "cascade"} ) ,
  phone:            varchar( "phone"    , {length: 50 } ) ,
  currency:         varchar( "currency" , {length: 100} ).default( "ARS"                            ).notNull() ,
  timezone:         varchar( "timezone" , {length: 100} ).default( "America/Argentina/Buenos_Aires" ).notNull() ,
  bio:              text( "bio" ) ,
  theme:            varchar( "theme"        , {length: 50 } ).default( "system"    ).notNull() , // 'light' | 'dark' | 'system'
  defaultView:      varchar( "default_view" , {length: 100} ).default( "dashboard" ).notNull() ,
  fastLogin:        boolean( "fast_login" ).default( true ).notNull() ,
  weeklyStart:      varchar( "weekly_start"  , {length: 50} ).default( "monday"     ).notNull() ,
  dateFormat:       varchar( "date_format"   , {length: 50} ).default( "DD/MM/YYYY" ).notNull() ,
  numberFormat:     varchar( "number_format" , {length: 50} ).default( "es-AR"      ).notNull() ,
  roundAmounts:     boolean( "round_amounts"     ).default( false ).notNull() ,
  includeTransfers: boolean( "include_transfers" ).default( true  ).notNull() ,
  defaultAccount:   varchar( "default_account"  , {length: 100} ) ,
  planName:         varchar( "plan_name"        , {length: 50 } ).default( "Básico"  ).notNull() ,
  planBilling:      varchar( "plan_billing"     , {length: 50 } ).default( "Mensual" ).notNull() ,
  planNextCharge:   varchar( "plan_next_charge" , {length: 100} ).default( ""        ).notNull()
} ) ;
