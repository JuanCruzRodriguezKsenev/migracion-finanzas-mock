/**
 * @file dispatchOutbox.ts
 * Script CLI para disparar manualmente el procesamiento y purga del Transactional Outbox.
 * Ejecutable mediante: pnpm db:outbox
 */
// Librerías externas
import * as dotenv from "dotenv" ;

// Cargar variables de entorno locales
dotenv.config( {path: ".env.local"} ) ;

// Feature: Accounting
import {
  dispatchPendingEvents ,
  purgeOldSentEvents
} from "@/features/accounting/services/outboxDispatcher" ;

async function main() {
  console.log( "Iniciando ciclo de despacho del Transactional Outbox..." ) ;

  try {
    const dispatchResult = await dispatchPendingEvents() ;
    console.log( "Despacho completado:" ) ;
    console.log( `  - Recuperados de PROCESSING: ${dispatchResult.recoveredStale}` ) ;
    console.log( `  - Procesados:                ${dispatchResult.processed}` ) ;
    console.log( `  - Exitosos (SENT):           ${dispatchResult.successful}` ) ;
    console.log( `  - Fallidos (reintento/fail): ${dispatchResult.failed}` ) ;

    const purgedCount = await purgeOldSentEvents() ;
    console.log( `  - Purgados históricos:       ${purgedCount}` ) ;

    process.exit( 0 ) ;
  } catch( error ) {
    console.error( "Error crítico durante el despacho de outbox:" , error ) ;
    process.exit( 1 ) ;
  }
}

main() ;
