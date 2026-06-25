import { defineConfig } from "vitest/config" ;
import react  from "@vitejs/plugin-react" ;
import dotenv from "dotenv" ;
import path   from "path" ;

// Cargar variables de entorno desde .env.local para los tests
dotenv.config( {path: ".env.local"} ) ;

export default defineConfig( {
  plugins: [
    // Permite a Vitest entender la sintaxis de React y JSX/TSX si alguna librería la utiliza
    react()
  ] ,
  test: {
    // Usamos el entorno "node" porque es extremadamente rápido y tus pruebas
    // actuales están enfocadas en lógica pura (servicios y utilidades)
    environment: "node" ,
    
    // Habilita el uso de APIs globales como `describe`, `test` y `expect` sin tener que importarlas en cada archivo
    globals: true ,
    
    // Define exactamente qué archivos de prueba debe buscar y ejecutar Vitest.
    // Buscará archivos de prueba (.test.ts o .test.tsx) dentro de las utilidades compartidas y características.
    include: [
      "src/shared/lib/**/*.test.ts" ,
      "src/shared/services/**/*.test.ts" ,
      "src/features/**/*.test.ts" ,
      "src/features/**/*.test.tsx"
    ]
  } ,
  resolve: {
    alias: {
      // Configura el alias "@" para apuntar a la carpeta "src" ,
      // resolviendo las rutas absolutas tal como lo hace Next.js
      "@": path.resolve( __dirname , "./src" )
    }
  }
} ) ;
