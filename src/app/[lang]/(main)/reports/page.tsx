/**
 * @file page.tsx
 * Ruta de la pantalla de Estadísticas (/reports) (RFC 027 §6).
 * Server Component fino que valida searchParams, consulta getReportsAction y compone PageHeader con StatsContainer.
 */
// Shared
import { PageHeader }    from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Reports
import { getReportsAction } from "@/features/reports/actions/reportsActions" ;
import { StatsContainer }   from "@/features/reports/components/StatsContainer" ;

interface ReportsPageProps {
  params:       Promise< {lang: string} > ;
  searchParams: Promise< {month?: string ; currency?: string} > ;
}

export default async function ReportsPage( {params , searchParams}: ReportsPageProps ) {
  const { lang }             = await params ;
  const { month , currency } = await searchParams ;

  // Validar formato del mes (YYYY-MM); si es inválido, caer al mes actual
  const monthKey = ( month && /^\d{4}-\d{2}$/.test( month ) ) ? month : undefined ;

  const [ dict , res ] = await Promise.all( [
    getDictionary( lang ) ,
    getReportsAction( { monthKey , currency } ) ,
  ] ) ;

  if( !res.success ) {
    throw( new Error( res.error ) ) ;
  }

  const reportData = res.value ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={dict.reportsPage?.title || "Estadísticas"}
        subtitle={dict.reportsPage?.subtitle || "Métricas agregadas del libro diario"}
        showMonthSelector={true}
        dict={dict}
        lang={lang}
        currentMonthKey={reportData.monthKey}
        minKey={reportData.minKey}
      />
      <StatsContainer
        reportData={reportData}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
