/**
 * @file page.tsx
 * Ruta de Metas (/goals) (RFC 011 §6).
 * Server Component fino: valida `?currency=` y `?filter=`, consulta getGoalsAction y delega en GoalsContainer.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Goals
import { getGoalsAction } from "@/features/goals/actions/goalsActions" ;
import { GoalsContainer } from "@/features/goals/components/GoalsContainer" ;
import type { GoalFilter } from "@/features/goals/types" ;


interface GoalsPageProps {
  params:       Promise< {lang: string} > ;
  searchParams: Promise< {currency?: string ; filter?: string} > ;
}

const FILTROS: GoalFilter[] = [ "all" , "active" , "completed" ] ;

export default async function GoalsPage( {params , searchParams}: GoalsPageProps ) {
  const { lang }             = await params ;
  const { currency , filter } = await searchParams ;

  // Divisa: sólo si tiene forma ISO; si falta o es inválida, la resuelve el servicio (perfil → primera con datos)
  const validCurrency = ( currency && /^[A-Za-z]{3}$/.test( currency ) ) ? currency.toUpperCase() : undefined ;
  const validFilter   = ( FILTROS.find( ( f ) => f === filter ) ?? "all" ) ;

  const [ dict , res ] = await Promise.all( [
    getDictionary( lang ) ,
    getGoalsAction( { currency: validCurrency , filter: validFilter } ) ,
  ] ) ;

  if( !res.success ) {
    throw( new Error( res.error ) ) ;
  }

  return(
    <div className={styles.container}>
      <GoalsContainer
        data={res.value}
        filter={validFilter}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
