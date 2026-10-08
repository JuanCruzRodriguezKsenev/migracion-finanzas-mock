/**
 * @file espacioPersonalService.ts
 * Alta del espacio «Personal» de un usuario: una organización marcada con su dueño, con su catálogo contable,
 * donde viven sus cuentas personales y sus entidades propias.
 */
// Shared
import type { DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { provisionarOrganizacion } from "@/features/accounting/services/organizationProvisioningService" ;

// Feature: Auth
import { organizationRepository } from "../repositories/organizationRepository" ;
import { membershipRepository }   from "../repositories/membershipRepository" ;
import { organizations }          from "../schema.db" ;
import { slugLibre }              from "./slugLibre" ;


/** Nombre con el que se muestra el espacio en el selector de organizaciones. */
export const NOMBRE_ESPACIO_PERSONAL = "Personal" ;

/**
 * Crea el espacio Personal del usuario: organización marcada, catálogo, Patrimonio Neto y membresía `owner`.
 * No fija la organización activa del usuario: el destino al entrar nunca es «Personal» (RN-7).
 * Falla por el índice único si el usuario ya tiene uno; para el caso idempotente, `asegurarEspacioPersonal`.
 *
 * @param userId - Identificador del dueño.
 * @param tx - Transacción activa.
 * @returns El id de la organización creada.
 */
export async function crearEspacioPersonal( userId: string , tx: DBOrTx ): Promise< string > {
  const slug = await slugLibre( `personal-${userId.slice( 0 , 8 )}` , tx ) ;

  const [ org ] = await tx
    .insert( organizations )
    .values( { name: NOMBRE_ESPACIO_PERSONAL , slug , personalOwnerUserId: userId } )
    .returning() ;

  await provisionarOrganizacion( org.id , tx ) ;
  await membershipRepository.add( userId , org.id , "owner" , tx ) ;

  return( org.id ) ;
}

/**
 * Devuelve el espacio Personal del usuario, creándolo si todavía no existe. Idempotente.
 *
 * @param userId - Identificador del dueño.
 * @param tx - Transacción activa.
 * @returns El id de la organización personal.
 */
export async function asegurarEspacioPersonal( userId: string , tx: DBOrTx ): Promise< string > {
  const existente = await organizationRepository.findPersonalDe( userId , tx ) ;

  if( existente ) { return( existente ) ; }

  return( await crearEspacioPersonal( userId , tx ) ) ;
}
