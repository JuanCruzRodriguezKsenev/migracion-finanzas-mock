// Librerías externas
import { describe , it , expect , beforeEach , afterAll } from "vitest" ;
import { sql , eq }                                       from "drizzle-orm" ;

// Shared
import { crearOrganizacionRica , conteosDe } from "@/shared/db/testFixtures" ;
import { limpiarBase }           from "@/shared/db/testCleanup" ;
import { db }                    from "@/shared/db/client" ;

// Feature: Auth
import { organizationRepository , TABLAS_CON_ORGANIZACION } from "./organizationRepository" ;
import { organizations }                                    from "../schema.db" ;


describe( "organizationRepository" , () => {
  beforeEach( async () => {
    await limpiarBase() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "NFR-6: toda tabla con organization_id está en TABLAS_CON_ORGANIZACION (si falla, sumarla al borrado)" , async () => {
    const filas = await db.execute( sql`
      select distinct table_name from information_schema.columns
      where column_name = 'organization_id' and table_schema = 'public'
    ` ) as unknown as { table_name: string }[] ;

    const enBase = filas.map( ( f ) => f.table_name ).sort() ;
    expect( enBase ).toEqual( [ ...TABLAS_CON_ORGANIZACION ].sort() ) ;
  } ) ;

  it( "renombrar cambia el nombre y no el slug (RN-33)" , async () => {
    const [ org ] = await db.insert( organizations ).values( { name: "Prueba" , slug: "prueba-ren" } ).returning() ;

    expect( await organizationRepository.renombrar( org.id , "Taller" ) ).toBe( true ) ;

    const [ despues ] = await db.select().from( organizations ).where( eq( organizations.id , org.id ) ) ;
    expect( despues.name ).toBe( "Taller" ) ;
    expect( despues.slug ).toBe( "prueba-ren" ) ;
  } ) ;

  it( "AC-31: eliminarCompleta deja 0 filas en cada tabla de la organización y no toca las otras" , async () => {
    const [ a ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-del" } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-del"   } ).returning() ;
    await crearOrganizacionRica( a.id ) ;
    await crearOrganizacionRica( b.id ) ;

    const antesA = await conteosDe( a.id ) ;
    const antesB = await conteosDe( b.id ) ;

    // El armador es la precondición del test: sin una fila en cada tabla no se ejercita el orden RESTRICT.
    for( const [ tabla , cantidad ] of Object.entries( antesA ) ) {
      if( tabla === "memberships" ) { continue ; }
      expect( cantidad , `la organización rica no tiene filas en ${tabla}` ).toBeGreaterThan( 0 ) ;
    }

    await db.transaction( async ( tx ) => {
      await organizationRepository.eliminarCompleta( a.id , tx ) ;
    } ) ;

    const despuesA = await conteosDe( a.id ) ;
    for( const [ tabla , cantidad ] of Object.entries( despuesA ) ) {
      expect( cantidad , `quedaron filas en ${tabla}` ).toBe( 0 ) ;
    }

    expect( await conteosDe( b.id ) ).toEqual( antesB ) ;
    expect( await db.select().from( organizations ).where( eq( organizations.id , a.id ) ) ).toHaveLength( 0 ) ;
    expect( await db.select().from( organizations ).where( eq( organizations.id , b.id ) ) ).toHaveLength( 1 ) ;
  } ) ;
} ) ;
