/**
 * @file organizationActions.ts
 * Server Actions para listar las organizaciones del usuario y crear una nueva (RN-17, RN-18, AC-12, AC-13).
 * No exigen `owner`: basta con tener sesión y membresía.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { eq }               from "drizzle-orm" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { generarSlug }        from "@/shared/db/bootstrap" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db , DBOrTx }        from "@/shared/db/client" ;

// Feature: Accounting
import { provisionarOrganizacion } from "@/features/accounting/services/organizationProvisioningService" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;
import { userRepository }       from "@/features/auth/repositories/userRepository" ;
import { organizations }        from "@/features/auth/schema.db" ;

// Feature: Organizations
import { crearOrganizacionSchema , CrearOrganizacionInput } from "../schemas/organization.schema" ;


export interface OrganizacionListada {
  id:     string ;
  nombre: string ;
  rol:    string ;
}

/**
 * Lista las organizaciones a las que pertenece el usuario de la sesión.
 *
 * @returns Result con `{ organizaciones , activaId }`.
 */
export async function listarOrganizacionesAction(): Promise<
  Result< { organizaciones: OrganizacionListada[] ; activaId: string } , string >
> {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const membresias = await membershipRepository.findByUser( session.user.id ) ;

  return( ok( {
    organizaciones: membresias.map( ( m ) => ( { id: m.organizationId , nombre: m.organizationName , rol: m.role } ) ) ,
    activaId:       session.user.organizationId ,
  } ) ) ;
}

/**
 * Genera un slug libre: si el derivado del nombre ya existe, agrega un sufijo corto aleatorio.
 */
async function slugLibre( nombre: string , tx: DBOrTx ): Promise< string > {
  const base = ( generarSlug( nombre ) || "organizacion" ) ;

  for( let intento = 0 ; intento < 5 ; intento++ ) {
    const candidato = ( intento === 0 ) ? base : `${base}-${Math.random().toString( 36 ).slice( 2 , 6 )}` ;
    const [ existente ] = await tx
      .select( { id: organizations.id } )
      .from( organizations )
      .where( eq( organizations.slug , candidato ) )
      .limit( 1 ) ;

    if( !existente ) { return( candidato ) ; }
  }

  return( `${base}-${Date.now().toString( 36 )}` ) ;
}

/**
 * Crea una organización con su catálogo y su cuenta de Patrimonio Neto, y deja al usuario como `owner`.
 * Todo ocurre en una transacción: si el aprovisionamiento falla no queda ni la organización ni la membresía.
 *
 * @param rawInput - Nombre de la organización.
 * @returns Result con el id de la organización creada. El cliente debe luego llamar `update( { organizationId } )`.
 */
export async function crearOrganizacionAction(
  rawInput: CrearOrganizacionInput
): Promise< Result< { organizationId: string } , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const userId = session.user.id ;

  // RN-17: quien crea debe pertenecer a alguna organización; la sesión por sí sola no basta.
  const actual = await membershipRepository.findMembership( userId , session.user.organizationId ) ;

  if( !actual ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = crearOrganizacionSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Nombre de organización inválido." ) ) ;
  }

  const nombre = validation.data.nombre ;

  try {
    const organizationId = await db.transaction( async ( tx ) => {
      const slug = await slugLibre( nombre , tx ) ;

      const [ org ] = await tx
        .insert( organizations )
        .values( { name: nombre , slug } )
        .returning() ;

      await provisionarOrganizacion( org.id , tx ) ;
      await membershipRepository.add( userId , org.id , "owner" , tx ) ;
      await userRepository.registrarUltimaOrganizacion( userId , org.id , tx ) ;

      return( org.id ) ;
    } ) ;

    return( ok( { organizationId } ) ) ;
  } catch( error ) {
    logger.error( "Error al crear la organización." , { userId , error: String( error ) } ) ;
    return( fail( "No se pudo crear la organización. No se guardó ningún cambio." ) ) ;
  }
}
