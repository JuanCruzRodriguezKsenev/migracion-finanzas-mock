/**
 * @file organizationProvisioningService.ts
 * Servicio para aprovisionar el plan de cuentas inicial y el catálogo estándar
 * de categorías contables al crear una organización (RFC 022 y Spec Acceso con Google RN-18).
 */
// Shared
import type { DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { INITIAL_CATEGORIES_CATALOG }               from "../constants/initialCatalog" ;
import { categories , accounts , categoryAccounts } from "../schema.db" ;
import type { Category , Account }                  from "../types" ;


export interface ResultadoAprovisionamiento {
  categoriasPorCodigo: Map< string , Category > ;
  cuentasPorCodigo:    Map< string , Account > ;
  cuentaPatrimonio:    Account ;
}

/**
 * Aprovisiona el catálogo inicial de categorías contables y sus cuentas asociadas,
 * además de la cuenta estándar de Patrimonio Neto Inicial para una organización.
 *
 * No abre transacción propia: debe ser ejecutado dentro de la transacción del llamador
 * para garantizar atomicidad y permitir reversión completa en caso de fallo (AC-13).
 * No es idempotente: una invocación duplicada sobre la misma organización falla por clave única.
 *
 * @param organizationId - Identificador de la organización a aprovisionar.
 * @param tx - Conexión o transacción activa de la base de datos.
 * @returns Objeto con mapas de categorías y cuentas indexadas por código de catálogo y la cuenta de patrimonio.
 */
export async function provisionarOrganizacion(
  organizationId: string ,
  tx:             DBOrTx
): Promise< ResultadoAprovisionamiento > {
  const categoriasPorCodigo = new Map< string , Category >() ;
  const cuentasPorCodigo    = new Map< string , Account >() ;

  for( const catDef of INITIAL_CATEGORIES_CATALOG ) {
    const [ parentCat ] = await tx
      .insert( categories )
      .values( {
        organizationId ,
        name:         catDef.name ,
        type:         catDef.type ,
        accountCode:  catDef.code ,
        icon:         catDef.icon ,
        color:        catDef.color ,
        isSystemLeaf: false ,
      } )
      .returning() ;

    const [ parentAcc ] = await tx
      .insert( accounts )
      .values( {
        organizationId ,
        code:     `${catDef.code}-ARS` ,
        name:     `${catDef.name} (ARS)` ,
        type:     catDef.type ,
        balance:  0 ,
        currency: "ARS" ,
      } )
      .returning() ;

    await tx.insert( categoryAccounts ).values( {
      categoryId: parentCat.id ,
      accountId:  parentAcc.id ,
      currency:   "ARS" ,
    } ) ;

    categoriasPorCodigo.set( catDef.code , parentCat ) ;
    cuentasPorCodigo.set( catDef.code , parentAcc ) ;

    for( const subDef of catDef.subcategories ) {
      const [ subCat ] = await tx
        .insert( categories )
        .values( {
          organizationId ,
          parentId:     parentCat.id ,
          name:         subDef.name ,
          type:         catDef.type ,
          accountCode:  subDef.code ,
          icon:         subDef.icon || catDef.icon ,
          color:        subDef.color || catDef.color ,
          isSystemLeaf: false ,
        } )
        .returning() ;

      const [ subAcc ] = await tx
        .insert( accounts )
        .values( {
          organizationId ,
          code:     `${subDef.code}-ARS` ,
          name:     `${subDef.name} (ARS)` ,
          type:     catDef.type ,
          balance:  0 ,
          currency: "ARS" ,
        } )
        .returning() ;

      await tx.insert( categoryAccounts ).values( {
        categoryId: subCat.id ,
        accountId:  subAcc.id ,
        currency:   "ARS" ,
      } ) ;

      categoriasPorCodigo.set( subDef.code , subCat ) ;
      cuentasPorCodigo.set( subDef.code , subAcc ) ;
    }
  }

  // Cuentas de Patrimonio Inicial (3.1.01.01)
  const [ cuentaPatrimonio ] = await tx
    .insert( accounts )
    .values( {
      organizationId ,
      code:     "3.1.01.01" ,
      name:     "Patrimonio Neto Inicial" ,
      type:     "equity" ,
      balance:  0 ,
      currency: "ARS" ,
    } )
    .returning() ;

  cuentasPorCodigo.set( "3.1.01.01" , cuentaPatrimonio ) ;

  return( {
    categoriasPorCodigo ,
    cuentasPorCodigo ,
    cuentaPatrimonio ,
  } ) ;
}
