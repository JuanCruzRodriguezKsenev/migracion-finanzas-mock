// Librerías externas
import { eq , and , inArray , isNotNull } from "drizzle-orm" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository } from "../repositories/habilitacionRepository" ;
import { membershipRepository }   from "../repositories/membershipRepository" ;
import { nombreVisible }          from "../utils/nombreVisible" ;

// Feature: Accounting
import { accounts , accountShares } from "@/features/accounting/schema.db" ;


/**
 * Persona a cuyo nombre se puede cargar un movimiento.
 */
export interface TitularPosible {
  userId: string ;
  nombre: string ;
}

/**
 * Decide si `autorUserId` puede cargar un movimiento a nombre de `holderUserId` en la organización.
 *
 * - Sin titular, o el titular es el propio autor: se permite.
 * - Titular ajeno: tiene que ser **miembro** de la organización (A4) y no `viewer` (RN-17: un lector no
 *   escribe, no puede ser quien pagó). El rol del autor se lee de la base:
 *   `owner` puede a nombre de cualquiera (RN-5); `member` sólo con una habilitación vigente del titular (RN-6);
 *   cualquier otro rol, no.
 *
 * El rechazo del `viewer` como autor de movimientos propios es del plan 07, no de esta función.
 *
 * @param organizationId - Organización de la sesión.
 * @param autorUserId - Quien carga (la sesión).
 * @param holderUserId - Titular pedido, o nulo/indefinido.
 * @param tx - Instancia de transacción opcional.
 * @returns El titular a guardar (`null` si no hay), o `fail` con el motivo.
 */
export async function autorizarTitular(
  organizationId: string ,
  autorUserId:    string ,
  holderUserId:   string | null | undefined ,
  tx:             DBOrTx = db
): Promise< Result< string | null , string > > {
  if( !holderUserId ) {
    return( ok( null ) ) ;
  }

  if( holderUserId === autorUserId ) {
    return( ok( holderUserId ) ) ;
  }

  const membresiaTitular = await membershipRepository.findMembership( holderUserId , organizationId , tx ) ;

  if( !membresiaTitular ) {
    return( fail( "La persona elegida no es miembro de la organización." ) ) ;
  }

  if( membresiaTitular.role === "viewer" ) {
    return( fail( "Un lector no puede ser titular de un movimiento." ) ) ;
  }

  const membresiaAutor = await membershipRepository.findMembership( autorUserId , organizationId , tx ) ;

  if( !membresiaAutor ) {
    return( fail( "No autorizado." ) ) ;
  }

  if( membresiaAutor.role === "owner" ) {
    return( ok( holderUserId ) ) ;
  }

  if( (membresiaAutor.role === "member") && (await habilitacionRepository.existeVigente( organizationId , holderUserId , autorUserId , tx )) ) {
    return( ok( holderUserId ) ) ;
  }

  return( fail( "No tenés habilitación para cargar a nombre de esa persona." ) ) ;
}

/**
 * Autoriza el titular de un movimiento teniendo en cuenta las cuentas involucradas (RN-3, RN-9).
 * Si el `holder` es el dueño de alguna personal compartida con la organización entre `cuentaIds` (o la del
 * propio autor), valida sólo que el `holder` sea miembro no `viewer` y que el autor sea miembro no `viewer`.
 * En cualquier otro caso delega en `autorizarTitular` (habilitación incluida, sin cambios).
 *
 * @param organizationId - Organización de la sesión.
 * @param autorUserId - Quien carga (la sesión).
 * @param holderUserId - Titular pedido, o nulo/indefinido.
 * @param cuentaIds - IDs de las cuentas de los asientos del movimiento.
 * @param tx - Instancia de transacción opcional.
 * @returns El titular a guardar, o fail con el motivo.
 */
export async function autorizarTitularPorCuenta(
  organizationId: string ,
  autorUserId:    string ,
  holderUserId:   string | null | undefined ,
  cuentaIds:      string[] ,
  tx:             DBOrTx = db
): Promise< Result< string | null , string > > {
  if( !holderUserId ) {
    return( autorizarTitular( organizationId , autorUserId , holderUserId , tx ) ) ;
  }

  if( cuentaIds.length > 0 ) {
    // Si el titular es el propio autor con su cuenta personal
    if( holderUserId === autorUserId ) {
      const [ cuentaPropia ] = await tx
        .select( { id: accounts.id } )
        .from( accounts )
        .where( and(
          inArray( accounts.id , cuentaIds ) ,
          eq( accounts.ownerUserId , autorUserId )
        ) )
        .limit( 1 ) ;

      if( cuentaPropia ) {
        const membresiaAutor = await membershipRepository.findMembership( autorUserId , organizationId , tx ) ;
        if( !membresiaAutor ) {
          return( fail( "No autorizado." ) ) ;
        }
        if( membresiaAutor.role === "viewer" ) {
          return( fail( "Un lector no puede operar cuentas personales." ) ) ;
        }
        return( ok( holderUserId ) ) ;
      }
    }

    // Si el titular es el dueño de una personal compartida con la organización
    const [ cuentaCompartida ] = await tx
      .select( { id: accounts.id } )
      .from( accounts )
      .innerJoin( accountShares , and(
        eq( accountShares.accountId      , accounts.id ) ,
        eq( accountShares.organizationId , organizationId )
      ) )
      .where( and(
        inArray( accounts.id , cuentaIds ) ,
        eq( accounts.ownerUserId , holderUserId )
      ) )
      .limit( 1 ) ;

    if( cuentaCompartida ) {
      const membresiaTitular = await membershipRepository.findMembership( holderUserId , organizationId , tx ) ;
      if( !membresiaTitular ) {
        return( fail( "La persona elegida no es miembro de la organización." ) ) ;
      }
      if( membresiaTitular.role === "viewer" ) {
        return( fail( "Un lector no puede ser titular de un movimiento." ) ) ;
      }

      const membresiaAutor = await membershipRepository.findMembership( autorUserId , organizationId , tx ) ;
      if( !membresiaAutor ) {
        return( fail( "No autorizado." ) ) ;
      }
      if( membresiaAutor.role === "viewer" ) {
        return( fail( "Un lector no puede operar cuentas personales." ) ) ;
      }

      return( ok( holderUserId ) ) ;
    }

    // Si entre las cuentas hay una personal compartida con la organización y el titular no es su dueño (RN-9)
    const [ personalAjenaCompartida ] = await tx
      .select( { id: accounts.id } )
      .from( accounts )
      .innerJoin( accountShares , and(
        eq( accountShares.accountId      , accounts.id ) ,
        eq( accountShares.organizationId , organizationId )
      ) )
      .where( and(
        inArray( accounts.id , cuentaIds ) ,
        isNotNull( accounts.ownerUserId )
      ) )
      .limit( 1 ) ;

    if( personalAjenaCompartida ) {
      return( fail( "Los movimientos con una cuenta personal ajena deben tener como titular al dueño de la cuenta." ) ) ;
    }
  }

  return( autorizarTitular( organizationId , autorUserId , holderUserId , tx ) ) ;
}

/**
 * Lista las personas a cuyo nombre puede cargar `userId`, con uno mismo primero.
 *
 * - `owner`: todos los miembros salvo los `viewer` (RN-5, RN-17).
 * - `member`: quienes lo habilitaron y siguen siendo miembros no `viewer` (RN-17).
 * - `viewer`: sólo uno mismo.
 *
 * @param organizationId - Organización de la sesión.
 * @param userId - Quien carga (la sesión).
 * @param tx - Instancia de transacción opcional.
 * @returns Titulares posibles; vacío si `userId` no es miembro.
 */
export async function titularesPosibles(
  organizationId: string ,
  userId:         string ,
  tx:             DBOrTx = db
): Promise< TitularPosible[] > {
  const miembros = await membershipRepository.findByOrganization( organizationId , tx ) ;
  const yo       = miembros.find( ( m ) => (m.userId === userId) ) ;

  if( !yo ) {
    return( [] ) ;
  }

  const propio: TitularPosible = { userId , nombre: nombreVisible( yo.nombre , yo.email ) } ;

  if( yo.rol === "owner" ) {
    const otros = miembros.filter( ( m ) => (m.userId !== userId) && (m.rol !== "viewer") ) ;

    return( [ propio , ...otros.map( ( m ) => ( { userId: m.userId , nombre: nombreVisible( m.nombre , m.email ) } ) ) ] ) ;
  }

  if( yo.rol === "member" ) {
    const recibidas = await habilitacionRepository.listarRecibidas( organizationId , userId , tx ) ;
    const vigentes  = new Set( miembros.filter( ( m ) => (m.rol !== "viewer") ).map( ( m ) => m.userId ) ) ;

    return( [ propio , ...recibidas.filter( ( r ) => vigentes.has( r.userId ) ).map( ( r ) => ( { userId: r.userId , nombre: nombreVisible( r.nombre , r.email ) } ) ) ] ) ;
  }

  return( [ propio ] ) ;
}
