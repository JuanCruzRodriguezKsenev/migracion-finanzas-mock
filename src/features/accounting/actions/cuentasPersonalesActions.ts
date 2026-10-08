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
import { organizationRepository }   from "@/features/auth/repositories/organizationRepository" ;
import { membershipRepository }     from "@/features/auth/repositories/membershipRepository" ;
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Accounting
import { createPersonalAccountSchema , compartirCuentaSchema , CreateAccountInput } from "../schemas/accounting.schema" ;
import { Account , CuentaDeListado , EtiquetaCuenta , etiquetaDeCuenta }             from "../types" ;
import { accountRepository , CuentaConEtiqueta }                                     from "../repositories/accountRepository" ;
import { financialEntityRepository }                                                 from "../repositories/financialEntityRepository" ;
import { getNextCode }                                                               from "../utils/accountCodes" ;


/** Una cuenta personal del usuario con su etiqueta y las organizaciones donde está compartida. */
export interface CuentaPersonalVista {
  cuenta:            Account ;
  etiqueta:          EtiquetaCuenta ;
  organizacionesIds: string[] ;
}

/** Cuentas que ofrece el formulario de movimientos (RN-10). */
export interface CuentasParaMovimiento {
  usables:            CuentaConEtiqueta[] ;
  organizacionId:     string ;
  organizacionNombre: string ;
}

/** Organización donde el usuario puede compartir una cuenta propia (es `owner` o `member`). */
export interface OrganizacionParaCompartir {
  id:     string ;
  nombre: string ;
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
 * Crea una cuenta personal anclada en el espacio Personal del usuario (RN-9), y sólo se puede crear estando en
 * él (A3). Nace privada (RN-2, RN-6) y siempre es de activo. El saldo inicial se guarda directo, sin asiento.
 * Si trae `entityId`, la entidad tiene que ser del espacio Personal (RN-11).
 *
 * @param input - Nombre, divisa, saldo inicial en centavos y entidad opcional.
 * @returns La cuenta creada.
 */
export async function crearCuentaPersonalAction( input: Omit< CreateAccountInput , "type" | "code" > ): Promise< Result< Account , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const { userId , organizationId } = sesion.value ;

  const validation = createPersonalAccountSchema.safeParse( input ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos de cuenta inválidos." ) ) ;
  }

  const { name , balance , currency , entityId } = validation.data ;

  try {
    const personalOrgId = await organizationRepository.findPersonalDe( userId ) ;

    if( !personalOrgId ) {
      return( fail( "Todavía no tenés un espacio Personal. Volvé a iniciar sesión." ) ) ;
    }

    // A3: las cuentas personales se crean desde el espacio Personal, no desde una organización real
    if( organizationId !== personalOrgId ) {
      return( fail( "Las cuentas personales se crean desde tu espacio Personal." ) ) ;
    }

    if( !(await puedeEscribirEn( userId , personalOrgId )) ) {
      return( fail( "No tenés permiso para crear cuentas en tu espacio Personal." ) ) ;
    }

    // RN-11: la entidad elegida tiene que ser una entidad propia (del espacio Personal)
    if( entityId && !(await financialEntityRepository.findById( entityId , personalOrgId )) ) {
      return( fail( "La entidad elegida no es una de tus entidades propias." ) ) ;
    }

    // Dos intentos: si otra creación simultánea tomó el mismo código (23505) se recalcula una vez.
    for( let intento = 0 ; intento < 2 ; intento++ ) {
      try {
        const cuenta = await db.transaction( async ( tx ) => {
          // El código se calcula contra TODAS las cuentas ancladas (de la organización y personales): comparten índice único.
          const ancladas = await accountRepository.findTodasEnAncla( personalOrgId , tx ) ;

          return( await accountRepository.crearPersonal( {
            organizationId: personalOrgId ,
            ownerUserId:    userId ,
            code:           getNextCode( "asset" , ancladas ) ,
            name ,
            balance:        ( balance || 0 ) ,
            currency:       ( currency || "ARS" ) ,
            entityId:       ( entityId || null ) ,
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

/**
 * Cuentas de `/accounts` en la organización activa (RN-16): las de la organización más las personales que
 * sus dueños compartieron ahí. El saldo de una personal ajena **se omite acá, en el servidor** (RN-11), y la
 * etiqueta de una personal nombra sólo la organización activa: no revela en qué otras se comparte.
 *
 * @returns Las cuentas visibles, cada una con su etiqueta.
 */
export async function obtenerCuentasDeListadoAction(): Promise< Result< CuentaDeListado[] , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado para consultar las cuentas." ) ) ;
  }

  const { userId , organizationId } = identidad ;

  try {
    const [ visibles , membresias ] = await Promise.all( [
      accountRepository.findVisiblesEn( organizationId ) ,
      membershipRepository.findByUser( userId ) ,
    ] ) ;

    const nombreDeLaOrg = ( membresias.find( ( m ) => m.organizationId === organizationId )?.organizationName ?? "" ) ;

    return( ok( visibles.map( ( cuenta ) => {
      const etiqueta = etiquetaDeCuenta( cuenta , [ {id: organizationId , nombre: nombreDeLaOrg} ] ) ;

      if( cuenta.ownerUserId && (cuenta.ownerUserId !== userId) ) {
        return( {...cuenta , balance: null , etiqueta} ) ;
      }

      return( {...cuenta , etiqueta} ) ;
    } ) ) ) ;
  } catch( error ) {
    logger.error( "Error al consultar cuentas en obtenerCuentasDeListadoAction." , {error: String( error )} ) ;
    return( fail( "Error al consultar las cuentas en el servidor." ) ) ;
  }
}

/**
 * Cuentas que ofrece el formulario de movimientos al usuario de la sesión (RN-10): `usables` (las de la
 * organización, todas sus personales y las de otros compartidas).
 *
 * @returns Usables con su etiqueta.
 */
export async function obtenerCuentasParaMovimientoAction(): Promise< Result< CuentasParaMovimiento , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado para consultar las cuentas." ) ) ;
  }

  const { userId , organizationId } = identidad ;

  try {
    const [ usables , membresias ] = await Promise.all( [
      accountRepository.findUsablesPara( organizationId , userId ) ,
      membershipRepository.findByUser( userId ) ,
    ] ) ;

    const membresia = membresias.find( ( m ) => m.organizationId === organizationId ) ;

    return( ok( {
      usables ,
      organizacionId:     organizationId ,
      organizacionNombre: ( membresia?.organizationName ?? "" ) ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al consultar cuentas en obtenerCuentasParaMovimientoAction." , {error: String( error )} ) ;
    return( fail( "Error al consultar las cuentas en el servidor." ) ) ;
  }
}

/**
 * Organizaciones con las que el usuario puede compartir una cuenta suya: aquellas donde es `owner` o `member`
 * (RN-3). Alimenta el botón «Compartir con…» de «Mis cuentas».
 *
 * @returns Las organizaciones elegibles.
 */
export async function listarOrganizacionesParaCompartirAction(): Promise< Result< OrganizacionParaCompartir[] , string > > {
  const identidad = await identidadDeSesion() ;

  if( !identidad ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const membresias = await membershipRepository.findByUser( identidad.userId ) ;

    return( ok(
      membresias
        .filter( ( m ) => ROLES_QUE_ESCRIBEN.includes( m.role ) )
        .map( ( m ) => { return( {id: m.organizationId , nombre: m.organizationName} ) ; } )
    ) ) ;
  } catch( error ) {
    logger.error( "Error al listar organizaciones en listarOrganizacionesParaCompartirAction." , {error: String( error )} ) ;
    return( fail( "No se pudieron cargar las organizaciones." ) ) ;
  }
}
