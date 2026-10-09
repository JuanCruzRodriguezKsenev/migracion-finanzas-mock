/**
 * @file seedCuentasPropias.ts
 * Ayudante para sembrar cuentas personales ancladas en su espacio Personal, con su entidad
 * financiera y compartición opcional hacia otra organización.
 */
// Librerías externas
import { eq , and } from "drizzle-orm" ;

// Feature: Accounting
import { accounts , accountShares , financialEntities } from "@/features/accounting/schema.db" ;
import { accountRepository }                            from "@/features/accounting/repositories/accountRepository" ;
import { getNextCode }                                  from "@/features/accounting/utils/accountCodes" ;
import type { Account }                                 from "@/features/accounting/types" ;

// Shared: base de datos
import type { DBOrTx } from "./client" ;

/** Datos para sembrar o actualizar una cuenta personal. */
export interface DatosCuentaPropiaSeed {
  usuarioId:          string ;
  personalOrgId:      string ;
  nombre:             string ;
  entidad: {
    nombre:  string ;
    logo?:   string | null ;
    color?:  string | null ;
  } ;
  saldo:              number ;
  compartirConOrgId?: string ;
}

/**
 * Siembra o actualiza una cuenta personal en el espacio Personal de un usuario, asegurando
 * la entidad financiera correspondiente y gestionando la compartición con otra organización.
 *
 * @param db - Instancia de conexión a la base de datos o transacción activa.
 * @param datos - Parámetros de la cuenta propia a sembrar.
 * @returns La cuenta creada o actualizada.
 */
export async function sembrarCuentaPropia(
  db:    DBOrTx ,
  datos: DatosCuentaPropiaSeed
): Promise< Account > {
  const { usuarioId , personalOrgId , nombre , entidad , saldo , compartirConOrgId } = datos ;

  // (a) Busca o crea la entidad del Personal por (organizationId = personalOrgId, name = entidad.nombre)
  let [ ent ] = await db
    .select()
    .from( financialEntities )
    .where( and( eq( financialEntities.organizationId , personalOrgId ) , eq( financialEntities.name , entidad.nombre ) ) ) ;

  if( !ent ) {
    [ ent ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: personalOrgId ,
        name:           entidad.nombre ,
        logo:           ( entidad.logo ?? null ) ,
        brandDomain:    null ,
        color:          ( entidad.color ?? null ) ,
      } )
      .returning() ;
  }

  // (b) Busca la cuenta previa por (organizationId = personalOrgId, ownerUserId = usuarioId, name = nombre)
  const [ previa ] = await db
    .select()
    .from( accounts )
    .where(
      and(
        eq( accounts.organizationId , personalOrgId ) ,
        eq( accounts.ownerUserId , usuarioId ) ,
        eq( accounts.name , nombre )
      )
    ) ;

  let cuenta: Account ;

  // (c) Si existe, la actualiza (saldo, entidad) y borra sus account_shares; si no, la crea
  if( previa ) {
    const [ actualizada ] = await db
      .update( accounts )
      .set( {
        balance:  saldo ,
        entityId: ent.id ,
      } )
      .where( eq( accounts.id , previa.id ) )
      .returning() ;

    cuenta = actualizada ;

    await db.delete( accountShares ).where( eq( accountShares.accountId , previa.id ) ) ;
  } else {
    const ancladas = await accountRepository.findTodasEnAncla( personalOrgId , db ) ;
    const code = getNextCode( "asset" , ancladas ) ;

    cuenta = await accountRepository.crearPersonal( {
      organizationId: personalOrgId ,
      ownerUserId:    usuarioId ,
      code ,
      name:           nombre ,
      balance:        saldo ,
      currency:       "ARS" ,
      entityId:       ent.id ,
    } , db ) ;
  }

  // (d) Si viene compartirConOrgId, inserta una fila en accountShares
  if( compartirConOrgId ) {
    await db
      .insert( accountShares )
      .values( { accountId: cuenta.id , organizationId: compartirConOrgId } ) ;
  }

  return( cuenta ) ;
}
