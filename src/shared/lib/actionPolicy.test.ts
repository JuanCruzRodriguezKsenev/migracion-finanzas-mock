/**
 * @file actionPolicy.test.ts
 * Cierra el agujero de las acciones de escritura (AC-18 a AC-21), en dos mitades:
 *  1. Completitud: cada exportación de cada archivo de acciones está clasificada en el registro (fail-closed).
 *  2. Efecto: con la sesión de un `viewer` real, ninguna acción de escritura escribe y todas responden «sin permiso».
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                    from "next-auth" ;
import type { Session }                                        from "next-auth" ;
import { sql }                                                 from "drizzle-orm" ;

// Shared
import { POLITICA_DE_ACCIONES , accionesDeEscritura } from "@/shared/lib/actionPolicy" ;
import { crearUsuarioConMembresia }                   from "@/shared/db/testFixtures" ;
import { limpiarBase }                                from "@/shared/db/testCleanup" ;
import { db }                                         from "@/shared/db/client" ;

// Feature: Auth
import { ERROR_SIN_PERMISO_DE_ESCRITURA } from "@/features/auth/constants" ;
import { organizations }                  from "@/features/auth/schema.db" ;


vi.mock( "next-auth" , () => ( { getServerSession: vi.fn() } ) ) ;
vi.mock( "next/cache" , () => ( { revalidatePath: vi.fn() } ) ) ;

type Modulo = Record< string , unknown > ;

declare global {
  /** `import.meta.glob` lo resuelve Vite al transformar el archivo; el proyecto no incluye `vite/client` en sus tipos. */
  interface ImportMeta {
    glob< T >( patrones: string[] ): Record< string , () => Promise< T > > ;
  }
}

/** Todos los archivos de acciones del repositorio (sin sus tests), cargables bajo demanda. */
const CARGADORES = import.meta.glob< Modulo >( [ "../../features/*/actions/*.ts" , "!../../features/*/actions/*.test.ts" ] ) ;

/** `../../features/accounting/actions/accountingActions.ts` → `accounting/actions/accountingActions`. */
const claveDeRuta = ( ruta: string ): string => ruta.replace( "../../features/" , "" ).replace( /\.ts$/ , "" ) ;

const cargar = async ( archivo: string ): Promise< Modulo > => {
  const ruta = Object.keys( CARGADORES ).find( ( r ) => claveDeRuta( r ) === archivo ) ;

  if( !ruta ) { throw new Error( `No hay archivo de acciones ${archivo}` ) ; }

  return( await CARGADORES[ ruta ]() ) ;
} ;

describe( "actionPolicy — completitud del registro (fail-closed)" , () => {
  it( "todo archivo de acciones está en el registro, y todo archivo del registro existe" , () => {
    const enDisco    = Object.keys( CARGADORES ).map( claveDeRuta ).sort() ;
    const enRegistro = Object.keys( POLITICA_DE_ACCIONES ).sort() ;

    expect( enDisco.filter( ( f ) => !enRegistro.includes( f ) ) , "archivos de acciones sin clasificar" ).toEqual( [] ) ;
    expect( enRegistro.filter( ( f ) => !enDisco.includes( f ) ) , "archivos del registro que ya no existen" ).toEqual( [] ) ;
  } ) ;

  it.each( Object.keys( POLITICA_DE_ACCIONES ) )( "%s: las exportaciones coinciden con las claves del registro" , async ( archivo ) => {
    const modulo     = await cargar( archivo ) ;
    const exportadas = Object.keys( modulo ).filter( ( k ) => typeof modulo[ k ] === "function" ).sort() ;
    const registro   = Object.keys( POLITICA_DE_ACCIONES[ archivo ] ).sort() ;

    expect( exportadas.filter( ( n ) => !registro.includes( n ) ) , `exportaciones sin clasificar en ${archivo}` ).toEqual( [] ) ;
    expect( registro.filter( ( n ) => !exportadas.includes( n ) ) , `entradas del registro que ${archivo} ya no exporta` ).toEqual( [] ) ;
  } ) ;

  it( "toda exenta lleva su motivo" , () => {
    for( const [ archivo , acciones ] of Object.entries( POLITICA_DE_ACCIONES ) ) {
      for( const [ nombre , politica ] of Object.entries( acciones ) ) {
        if( typeof politica === "object" ) {
          expect( politica.exenta.trim().length , `${archivo}#${nombre}` ).toBeGreaterThan( 0 ) ;
        }
      }
    }
  } ) ;
} ) ;

/** Conteo de filas de cada tabla del esquema público, para comprobar que nada cambió. */
async function conteoDeTablas(): Promise< Record< string , number > > {
  const tablas = await db.execute< { tablename: string } >( sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename` ) ;
  const conteo: Record< string , number > = {} ;

  for( const { tablename } of tablas ) {
    const filas = await db.execute< { n: number } >( sql`SELECT count(*)::int AS n FROM ${sql.identifier( tablename )}` ) ;
    conteo[ tablename ] = filas[ 0 ].n ;
  }

  return( conteo ) ;
}

describe( "actionPolicy — efecto: un viewer real no escribe (AC-19)" , () => {
  let viewerId: string ;
  let orgId:    string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ org ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-politica" } ).returning() ;
    orgId    = org.id ;
    viewerId = ( await crearUsuarioConMembresia( { organizationId: orgId , role: "viewer" } ) ).id ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    { id: viewerId , organizationId: orgId , role: "viewer" } ,
      expires: new Date().toISOString() ,
    } as unknown as Session ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it.each( accionesDeEscritura() )( "%s#%s responde «sin permiso»" , async ( archivo , nombre ) => {
    const modulo = await cargar( archivo ) ;
    const accion = modulo[ nombre ] as ( ...args: unknown[] ) => Promise< { success: boolean ; error?: string } > ;

    const resultado = await accion( {} , {} ) ;

    expect( resultado.success ).toBe( false ) ;
    expect( resultado.error ).toBe( ERROR_SIN_PERMISO_DE_ESCRITURA ) ;
  } ) ;

  it( "ninguna tabla cambió después de invocar todas las acciones de escritura" , async () => {
    const antes = await conteoDeTablas() ;

    for( const [ archivo , nombre ] of accionesDeEscritura() ) {
      const modulo = await cargar( archivo ) ;
      await ( modulo[ nombre ] as ( ...args: unknown[] ) => Promise< unknown > )( {} , {} ) ;
    }

    expect( await conteoDeTablas() ).toEqual( antes ) ;
  } ) ;
} ) ;
