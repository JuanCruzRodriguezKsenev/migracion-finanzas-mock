/**
 * @file habilitacionesActions.ts
 * Server Actions de habilitaciones: quién puede cargar movimientos a nombre de quién (RN-5, RN-6).
 * El otorgante es siempre la sesión y la organización sale de la sesión; el rol se lee de la base.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository }                           from "@/features/auth/repositories/habilitacionRepository" ;
import { membershipRepository }                             from "@/features/auth/repositories/membershipRepository" ;
import { nombreVisible , titularesPosibles , TitularPosible } from "@/features/auth/services/titularService" ;

// Feature: Organizations
import { habilitacionSchema , HabilitacionInput } from "../schemas/organization.schema" ;


export interface HabilitacionesListadas {
  /** Miembros que el usuario habilitó a cargar a su nombre. */
  otorgadas:  TitularPosible[] ;
  /** Miembros `member` de la organización (menos uno mismo): los que se pueden habilitar. */
  candidatos: TitularPosible[] ;
  /** Personas a cuyo nombre el usuario fue habilitado a cargar. */
  recibidas:  TitularPosible[] ;
}

/**
 * Otorga a un miembro la habilitación de cargar movimientos a nombre de la sesión.
 * El otorgante no puede ser `viewer`; el habilitado debe ser `member` (ni `owner`, ni `viewer`, ni uno mismo).
 * Es idempotente: si ya había una vigente, no duplica.
 *
 * @param rawInput - Miembro a habilitar.
 * @returns Result vacío, o `fail` con el motivo.
 */
export async function otorgarHabilitacionAction( rawInput: HabilitacionInput ): Promise< Result< null , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = habilitacionSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos inválidos." ) ) ;
  }

  const { habilitadoUserId } = validation.data ;
  const otorganteId          = session.user.id ;
  const organizationId       = session.user.organizationId ;

  if( habilitadoUserId === otorganteId ) {
    return( fail( "No podés habilitarte a vos mismo." ) ) ;
  }

  try {
    return( await db.transaction( async ( tx ) => {
      const membresiaOtorgante = await membershipRepository.findMembership( otorganteId , organizationId , tx ) ;

      if( !membresiaOtorgante || (membresiaOtorgante.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      const membresiaHabilitado = await membershipRepository.findMembership( habilitadoUserId , organizationId , tx ) ;

      if( !membresiaHabilitado ) {
        return( fail( "La persona elegida no es miembro de la organización." ) ) ;
      }

      if( membresiaHabilitado.role !== "member" ) {
        return( fail( "Sólo se puede habilitar a miembros con rol de miembro: propietarios y lectores no lo necesitan." ) ) ;
      }

      await habilitacionRepository.otorgar( organizationId , otorganteId , habilitadoUserId , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al otorgar una habilitación." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo otorgar la habilitación." ) ) ;
  }
}

/**
 * Revoca la habilitación vigente que la sesión dio a un miembro. Si no había ninguna, no escribe y responde `ok`.
 *
 * @param rawInput - Miembro cuya habilitación se revoca.
 * @returns Result vacío, o `fail` con el motivo.
 */
export async function revocarHabilitacionAction( rawInput: HabilitacionInput ): Promise< Result< null , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = habilitacionSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos inválidos." ) ) ;
  }

  const organizationId = session.user.organizationId ;

  try {
    await habilitacionRepository.revocar( organizationId , session.user.id , validation.data.habilitadoUserId ) ;

    return( ok( null ) ) ;
  } catch( error ) {
    logger.error( "Error al revocar una habilitación." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo revocar la habilitación." ) ) ;
  }
}

/**
 * Lista lo que muestra la pestaña «Habilitaciones»: lo otorgado, los candidatos y lo recibido.
 *
 * @returns Result con las tres listas de la sesión en su organización.
 */
export async function listarHabilitacionesAction(): Promise< Result< HabilitacionesListadas , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const userId         = session.user.id ;
  const organizationId = session.user.organizationId ;

  try {
    const [ miembros , otorgadas , recibidas ] = await Promise.all( [
      membershipRepository.findByOrganization( organizationId ) ,
      habilitacionRepository.listarOtorgadas( organizationId , userId ) ,
      habilitacionRepository.listarRecibidas( organizationId , userId ) ,
    ] ) ;

    const aTitular = ( u: { userId: string , nombre: string | null , email: string } ): TitularPosible => ( { userId: u.userId , nombre: nombreVisible( u.nombre , u.email ) } ) ;

    return( ok( {
      otorgadas:  otorgadas.map( aTitular ) ,
      candidatos: miembros.filter( ( m ) => (m.rol === "member") && (m.userId !== userId) ).map( aTitular ) ,
      recibidas:  recibidas.map( aTitular ) ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al listar habilitaciones." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudieron cargar las habilitaciones." ) ) ;
  }
}

/**
 * Lista a nombre de quiénes puede cargar la sesión, con uno mismo primero: `owner` = todos los miembros;
 * `member` = quienes lo habilitaron; `viewer` = sólo uno mismo.
 *
 * @returns Result con los titulares posibles (vacío si la sesión no es miembro).
 */
export async function listarTitularesPosiblesAction(): Promise< Result< TitularPosible[] , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    return( ok( await titularesPosibles( session.user.organizationId , session.user.id ) ) ) ;
  } catch( error ) {
    logger.error( "Error al listar titulares posibles." , { error: String( error ) } ) ;
    return( fail( "No se pudieron cargar los titulares." ) ) ;
  }
}
