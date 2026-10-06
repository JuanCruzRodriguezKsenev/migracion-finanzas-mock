import { migrate } from "drizzle-orm/postgres-js/migrator" ;
import { drizzle } from "drizzle-orm/postgres-js" ;
import postgres    from "postgres" ;
import path        from "path" ;
import dotenv      from "dotenv" ;

export default async function setup() {
  // Asegurar que las variables de entorno estén cargadas
  dotenv.config( {path: ".env.local"} ) ;

  const databaseUrl = ( process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db" ) ;
  const testDatabaseUrl = databaseUrl.replace( /\/([^/?]+?)(_test)?(\?|$)/ , "/$1_test$3" ) ;
  const testDbName      = new URL( testDatabaseUrl ).pathname.slice( 1 ) ;
  const adminDbUrl = databaseUrl.replace( /\/([^/?]+)(\?|$)/ , "/postgres$2" ) ;

  console.log( "\n⚙️ Preparando base de datos de prueba..." ) ;

  // 1. Crear base de datos de test si no existe
  const sqlAdmin = postgres( adminDbUrl , {max: 1} ) ;
  try {
    const dbs = await sqlAdmin`
      SELECT datname FROM pg_database WHERE datname = ${testDbName}
    ` ;

    if( dbs.length === 0 ) {
      console.log( `🔨 Creando base de datos '${testDbName}'...` ) ;
      await sqlAdmin.unsafe( `CREATE DATABASE "${testDbName}"` ) ;
    }
  } catch( e ) {
    console.error( "Error al verificar/crear base de datos de test:" , e ) ;
    throw( e ) ;
  } finally {
    await sqlAdmin.end() ;
  }

  // 2. Correr migraciones sobre la base de datos de test
  console.log( `🚀 Ejecutando migraciones sobre '${testDbName}'...` ) ;
  const sqlTest = postgres( testDatabaseUrl , {max: 1} ) ;
  const dbTest = drizzle( sqlTest ) ;

  try {
    await migrate( dbTest , {
      migrationsFolder: path.resolve( process.cwd() , "./drizzle/migrations" )
    } ) ;
    console.log( "✨ Migraciones aplicadas con éxito en la base de datos de test." ) ;
  } catch( e ) {
    console.error( "Error al ejecutar migraciones en la base de datos de test:" , e ) ;
    throw( e ) ;
  } finally {
    await sqlTest.end() ;
  }

  console.log( "✅ Entorno de pruebas de base de datos listo.\n" ) ;
}
