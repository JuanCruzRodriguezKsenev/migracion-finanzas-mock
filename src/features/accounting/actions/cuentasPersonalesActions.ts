/**
 * @file cuentasPersonalesActions.ts
 * Server Actions de las cuentas personales (spec «Cuentas propias y compartidas»): crear, compartir con una
 * organización, dejar de compartir y listar las propias. Usuario y organización salen de la sesión; el rol
 * se lee de la base (`membershipRepository.findMembership`), nunca del token.
 * El saldo inicial de una personal se guarda directo, sin asiento de apertura (RN-2): un asiento en la
 * organización ancla haría visible en su libro una cuenta privada.
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
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Accounting
import { createPersonalAccountSchema , compartirCuentaSchema , CreateAccountInput } from "../schemas/accounting.schema" ;
import { accountRepository }                                                         from "../repositories/accountRepository" ;
import { Account , EtiquetaCuenta , etiquetaDeCuenta }                               from "../types" ;
import { getNextCode }                                                               from "../utils/accountCodes" ;


/** Una cuenta personal del usuario con su etiqueta y las organizaciones donde está compartida. */
export interface CuentaPersonalVista {
  cuenta:            Account ;
  etiqueta:          EtiquetaCuenta ;
  organizacionesIds: string[] ;
}

/** Roles que pueden crear y compartir cuentas personales (el `viewer` no, RN-3). */
const ROLES_QUE_ESCRIBEN = [ "owner" , "member" ] ;

/** Usuario y organización activa de la sesión, o `null` si no hay sesión. */
async function identidadDeSesion(): Promise< {userId: string ; organizationId: string} | null > {
  const sesion         = ( await getServerSession( authOptions ) ) as { user?: { id?: string ; organizationId?: string } } | null ;
  const userId         = sesion?.user?.id ;
  const organizationId = sesion?.user?.organizationId ;

  return( (userId && organizationId) ? {userId , organizationId} : null ) ;
}

/** ¿El usuario es `owner` o `member` de la organización, según la base? */
async function puedeEscribirEn( userId: string , organizationId: string ): Promise< boolean > {
  const membresia = await membershipRepository.findMembership( userId , organizationId ) ;

  return( !!membresia && ROLES_QUE_ESCRIBEN.includes( membresia.role ) ) ;
}

/**
 * Crea una cuenta personal anclada en la organización activa. Nace privada (RN-2, RN-6) y siempre es de
 * activo. El saldo inicial se guarda directo, sin asiento.
 *
 * @param input - Nombre, divisa, saldo inicial en centavos y entidad opcional.
 * @returns La cuenta creada.
 */
export async function crearCuentaPersonalAction( input: Omit< CreateAccountInput , "type" | "code" > ): Promise< Result< Account , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado para crear cuentas." ) ) ;
  }

  const { userId , organizationId } = identidad ;

  const validation = createPersonalAccountSchema.safeParse( input ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos de cuenta inválidos." ) ) ;
  }

  const { name , balance , currency , entityId } = validation.data ;

  try {
    if( !(await puedeEscribirEn( userId , organizationId )) ) {
      return( fail( "No tenés permiso para crear cuentas en esta organización." ) ) ;
    }

    // Dos intentos: si otra creación simultánea tomó el mismo código (23505) se recalcula una vez.
    for( let intento = 0 ; intento < 2 ; intento++ ) {
      try {
        const cuenta = await db.transaction( async ( tx ) => {
          // El código se calcula contra TODAS las cuentas ancladas (de la organización y personales): comparten índice único.
          const ancladas = await accountRepository.findTodasEnAncla( organizationId , tx ) ;

          return( await accountRepository.crearPersonal( {
            organizationId ,
            ownerUserId: userId ,
            code:        getNextCode( "asset" , ancladas ) ,
            name ,
            balance:     ( balance || 0 ) ,
            currency:    ( currency || "ARS" ) ,
            entityId:    ( entityId || null ) ,
          } , tx ) ) ;
        } ) ;

        return( ok( cuenta ) ) ;
      } catch( error ) {
        if( ((error as {code?: string})?.code === "23505") && (intento === 0) ) {
          continue ;
        }
        throw( error ) ;
      }
    }

    return( fail( "Error al crear la cuenta personal en el servidor." ) ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23505" ) {
      return( fail( "Ya existe una cuenta con ese código contable. Por favor, intente de nuevo." ) ) ;
    }
    logger.error( "Error al crear cuenta en crearCuentaPersonalAction." , {error: String( error )} ) ;
    return( fail( "Error al crear la cuenta personal en el servidor." ) ) ;
  }
}

/**
 * Comparte una cuenta personal con una organización. Sólo su dueño, y sólo hacia una organización donde es
 * `owner` o `member` (RN-3). Idempotente.
 *
 * @param input - Cuenta y organización destino.
 */
export async function compartirCuentaAction( input: { accountId: string ; organizationId: string } ): Promise< Result< null , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = compartirCuentaSchema.safeParse( input ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos inválidos." ) ) ;
  }

  const { accountId , organizationId } = validation.data ;

  try {
    const cuenta = await accountRepository.findPersonal( accountId , identidad.userId ) ;

    if( !cuenta ) {
      return( fail( "No autorizado." ) ) ;
    }

    if( !(await puedeEscribirEn( identidad.userId , organizationId )) ) {
      return( fail( "No podés compartir una cuenta con una organización donde no tenés permiso de escritura." ) ) ;
    }

    await accountRepository.compartir( accountId , organizationId ) ;

    return( ok( null ) ) ;
  } catch( error ) {
    logger.error( "Error al compartir cuenta en compartirCuentaAction." , {error: String( error )} ) ;
    return( fail( "No se pudo compartir la cuenta." ) ) ;
  }
}

/**
 * Deja de compartir una cuenta personal con una organización (RN-13). Sólo su dueño. La cuenta y su
 * historial quedan intactos.
 *
 * @param input - Cuenta y organización.
 */
export async function dejarDeCompartirAction( input: { accountId: string ; organizationId: string } ): Promise< Result< null , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = compartirCuentaSchema.safeParse( input ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos inválidos." ) ) ;
  }

  const { accountId , organizationId } = validation.data ;

  try {
    const cuenta = await accountRepository.findPersonal( accountId , identidad.userId ) ;

    if( !cuenta ) {
      return( fail( "No autorizado." ) ) ;
    }

    await accountRepository.dejarDeCompartir( accountId , organizationId ) ;

    return( ok( null ) ) ;
  } catch( error ) {
    logger.error( "Error al dejar de compartir en dejarDeCompartirAction." , {error: String( error )} ) ;
    return( fail( "No se pudo dejar de compartir la cuenta." ) ) ;
  }
}

/**
 * Lista las cuentas personales del usuario con su etiqueta (RN-15) y las organizaciones donde están compartidas.
 *
 * @returns Las cuentas personales del usuario autenticado.
 */
export async function obtenerMisCuentasAction(): Promise< Result< CuentaPersonalVista[] , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const [ personales , membresias ] = await Promise.all( [
      accountRepository.listarPersonales( identidad.userId ) ,
      membershipRepository.findByUser( identidad.userId ) ,
    ] ) ;

    const nombres = new Map( membresias.map( ( m ) => { return( [ m.organizationId , m.organizationName ] as const ) ; } ) ) ;

    return( ok( personales.map( ( p ) => {
      const shares = p.organizacionesIds.map( ( id ) => { return( {id , nombre: nombres.get( id ) ?? ""} ) ; } ) ;

      return( {cuenta: p.cuenta , etiqueta: etiquetaDeCuenta( p.cuenta , shares ) , organizacionesIds: p.organizacionesIds} ) ;
    } ) ) ) ;
  } catch( error ) {
    logger.error( "Error al consultar cuentas en obtenerMisCuentasAction." , {error: String( error )} ) ;
    return( fail( "Error al consultar las cuentas en el servidor." ) ) ;
  }
}
