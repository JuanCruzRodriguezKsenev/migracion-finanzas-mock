// Librerías externas
import react          from "@vitejs/plugin-react" ;
import { defineConfig } from "vitest/config" ;
import dotenv         from "dotenv" ;
import path           from "path" ;

// Cargar variables de entorno desde .env.local para los tests
dotenv.config( {path: ".env.local"} ) ;

// Redirigir la base de datos a la de tests para evitar borrar la de desarrollo
const databaseUrl     = ( process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db" ) ;
const testDatabaseUrl = databaseUrl.replace( /\/([^/?]+)(\?|$)/ , "/finanzas_db_test$2" ) ;
process.env.DATABASE_URL = testDatabaseUrl ;

export default defineConfig( {
  plugins: [
    react()
  ] ,
  test: {
    environment: "node" ,
    globals:     true ,
    globalSetup: "./src/shared/db/vitest.setup.ts" ,
    setupFiles:  [
      "./src/shared/lib/vitest.setup.dom.ts" ,
      "./src/shared/lib/vitest.setup.mocks.ts"
    ] ,
    // Las suites comparten finanzas_db_test: fileParallelism: false evita la colisión
    // simultánea entre archivos (el residuo entre archivos lo resuelve limpiarBase).
    fileParallelism: false ,
    include: [
      "src/shared/lib/**/*.test.ts" ,
      "src/shared/services/**/*.test.ts" ,
      "src/shared/ui/**/*.test.tsx" ,
      "src/features/**/*.test.ts" ,
      "src/features/**/*.test.tsx"
    ]
  } ,
  resolve: {
    alias: {
      "@" : path.resolve( __dirname , "./src" )
    }
  }
} ) ;
