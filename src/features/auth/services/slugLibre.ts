/**
 * @file slugLibre.ts
 * Genera un `slug` de organización que todavía no existe. Lo comparten la creación de organizaciones
 * y la del espacio Personal.
 */
// Librerías externas
import { eq } from "drizzle-orm" ;

// Shared
import { generarSlug } from "@/shared/db/bootstrap" ;
import { DBOrTx }      from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "../schema.db" ;


/**
 * Genera un slug libre: si el derivado del nombre ya existe, agrega un sufijo corto aleatorio.
 *
 * @param nombre - Texto del que se deriva el slug.
 * @param tx - Transacción activa.
 * @returns Un slug que no está en uso al momento de la consulta.
 */
export async function slugLibre( nombre: string , tx: DBOrTx ): Promise< string > {
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
