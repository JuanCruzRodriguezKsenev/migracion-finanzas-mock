/**
 * @file cajaRepository.ts
 * Repositorio de la caja común: aportes y retiros, y la marca `is_common_pot` de las cuentas (Capa DAL).
 * Toda consulta filtra por `organizationId`.
 */
// Librerías externas
import { eq , and , desc , sql , inArray , notInArray } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Splits
import { commonPotContributions } from "../schema.db" ;
import type { AporteParaCaja }    from "../utils/caja" ;


/** Aporte o retiro a insertar. */
export type NuevoAporteCaja = typeof commonPotContributions.$inferInsert ;

/** Aporte o retiro tal como se lista. */
export interface AporteListado {
  id:                 string ;
  userId:             string | null ;
  amountInCents:      number ;
  currency:           string ;
  note:               string | null ;
  registeredByUserId: string | null ;
  occurredAt:         Date ;
}

/** Cuenta de activo que puede marcarse como caja común. */
export interface CuentaMarcable {
  id:          string ;
  name:        string ;
  currency:    string ;
  isCommonPot: boolean ;
}

/**
 * Repositorio de la caja común.
 */
export const cajaRepository = {
  /**
   * Serializa los aportes y retiros de una organización dentro de la transacción (candado de aviso de Postgres,
   * liberado al terminar). Usa otra clave que el acuerdo: no se serializan entre sí.
   *
   * @param organizationId - Organización.
   * @param tx - Transacción activa.
   */
  async bloquear( organizationId: string , tx: DBOrTx ): Promise< void > {
    await tx.execute( sql`select pg_advisory_xact_lock( hashtext( ${"caja:" + organizationId} ) )` ) ;
  } ,

  /**
   * Todos los aportes y retiros de la organización, para calcular las participaciones. Incluye los de extremo
   * nulo (ex miembro).
   *
   * @param organizationId - Organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Aportes con quién, monto con signo y divisa.
   */
  async listarAportes( organizationId: string , tx: DBOrTx = db ): Promise< AporteParaCaja[] > {
    return(
      await tx
        .select( {
          userId: commonPotContributions.userId ,
          monto:  commonPotContributions.amountInCents ,
          divisa: commonPotContributions.currency ,
        } )
        .from( commonPotContributions )
        .where( eq( commonPotContributions.organizationId , organizationId ) )
    ) ;
  } ,

  /**
   * Los registros más recientes, del más nuevo al más viejo.
   *
   * @param organizationId - Organización.
   * @param limite - Cantidad máxima.
   * @param tx - Instancia de transacción opcional.
   * @returns Registros recientes.
   */
  async listarRecientes( organizationId: string , limite: number , tx: DBOrTx = db ): Promise< AporteListado[] > {
    return(
      await tx
        .select( {
          id:                 commonPotContributions.id ,
          userId:             commonPotContributions.userId ,
          amountInCents:      commonPotContributions.amountInCents ,
          currency:           commonPotContributions.currency ,
          note:               commonPotContributions.note ,
          registeredByUserId: commonPotContributions.registeredByUserId ,
          occurredAt:         commonPotContributions.occurredAt ,
        } )
        .from( commonPotContributions )
        .where( eq( commonPotContributions.organizationId , organizationId ) )
        .orderBy( desc( commonPotContributions.occurredAt ) , desc( commonPotContributions.createdAt ) )
        .limit( limite )
    ) ;
  } ,

  /**
   * Neto de un miembro (aportes menos retiros) en una divisa.
   *
   * @param organizationId - Organización.
   * @param userId - Miembro.
   * @param currency - Divisa.
   * @param tx - Instancia de transacción opcional.
   * @returns El neto en centavos (cero si no tiene registros).
   */
  async netoDe( organizationId: string , userId: string , currency: string , tx: DBOrTx = db ): Promise< number > {
    const [ fila ] = await tx
      .select( { neto: sql< string >`coalesce( sum( ${commonPotContributions.amountInCents} ) , 0 )` } )
      .from( commonPotContributions )
      .where(
        and(
          eq( commonPotContributions.organizationId , organizationId ) ,
          eq( commonPotContributions.userId         , userId ) ,
          eq( commonPotContributions.currency       , currency )
        )
      ) ;

    return( Number( fila?.neto ?? 0 ) ) ;
  } ,

  /**
   * Inserta un aporte o retiro.
   *
   * @param datos - Registro ya validado.
   * @param tx - Transacción activa.
   */
  async insertar( datos: NuevoAporteCaja , tx: DBOrTx ): Promise< void > {
    await tx.insert( commonPotContributions ).values( datos ) ;
  } ,

  /**
   * Cuentas de activo de la organización, con su marca de caja común.
   *
   * @param organizationId - Organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Cuentas `asset`, por nombre.
   */
  async cuentasMarcables( organizationId: string , tx: DBOrTx = db ): Promise< CuentaMarcable[] > {
    return(
      await tx
        .select( { id: accounts.id , name: accounts.name , currency: accounts.currency , isCommonPot: accounts.isCommonPot } )
        .from( accounts )
        .where( and( eq( accounts.organizationId , organizationId ) , eq( accounts.type , "asset" ) ) )
        .orderBy( accounts.name )
    ) ;
  } ,

  /**
   * Cuentas de la organización marcadas como caja común.
   *
   * @param organizationId - Organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Cuentas marcadas (cualquier tipo).
   */
  async cuentasDeCaja( organizationId: string , tx: DBOrTx = db ): Promise< CuentaMarcable[] > {
    return(
      await tx
        .select( { id: accounts.id , name: accounts.name , currency: accounts.currency , isCommonPot: accounts.isCommonPot } )
        .from( accounts )
        .where( and( eq( accounts.organizationId , organizationId ) , eq( accounts.isCommonPot , true ) ) )
        .orderBy( accounts.name )
    ) ;
  } ,

  /**
   * Deja marcadas como caja común exactamente las cuentas dadas, y desmarca el resto. Sólo toca cuentas de la
   * organización; con `ids` vacío las desmarca todas.
   *
   * @param organizationId - Organización.
   * @param ids - Cuentas a marcar.
   * @param tx - Transacción activa.
   */
  async marcarCuentas( organizationId: string , ids: string[] , tx: DBOrTx ): Promise< void > {
    if( ids.length === 0 ) {
      await tx.update( accounts ).set( { isCommonPot: false } ).where( eq( accounts.organizationId , organizationId ) ) ;
      return ;
    }

    await tx.update( accounts ).set( { isCommonPot: true } ).where( and( eq( accounts.organizationId , organizationId ) , inArray( accounts.id , ids ) ) ) ;
    await tx.update( accounts ).set( { isCommonPot: false } ).where( and( eq( accounts.organizationId , organizationId ) , notInArray( accounts.id , ids ) ) ) ;
  } ,
} ;
