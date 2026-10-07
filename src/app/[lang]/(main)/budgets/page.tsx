/**
 * @file page.tsx
 * Ruta de Presupuestos (/budgets) (RFC 028 §5).
 * Server Component fino: valida ?month= y ?currency=, carga en paralelo y delega en BudgetsContainer.
 */
// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { PageHeader }        from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { getDictionary }     from "@/shared/lib/dictionary" ;
import { claveDeMesActual }  from "@/shared/lib/monthKey" ;
import { authOptions }       from "@/shared/lib/auth" ;
import styles                from "./page.module.css" ;

// Feature: Accounting
import { getCategoryTreeAction } from "@/features/accounting/actions/categoryActions" ;

// Feature: Budgets
import { resolverParametros }  from "@/features/budgets/utils/parametrosPagina" ;
import { budgetsRepository }   from "@/features/budgets/repositories/budgetsRepository" ;
import { budgetsService }      from "@/features/budgets/services/budgetsService" ;
import { getBudgetsAction }    from "@/features/budgets/actions/budgetsActions" ;
import { BudgetsContainer }    from "@/features/budgets/components/BudgetsContainer" ;


interface BudgetsPageProps {
  params:       Promise< {lang: string} > ;
  searchParams: Promise< {month?: string ; currency?: string} > ;
}

export default async function BudgetsPage( {params , searchParams}: BudgetsPageProps ) {
  const { lang }             = await params ;
  const { month , currency } = await searchParams ;

  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.organizationId ) {
    throw( new Error( "No autorizado para ver presupuestos." ) ) ;
  }

  // Zona y divisa del perfil, y divisas con presupuestos: definen mes y divisa por defecto
  const [ prefs , divisasConPresupuesto ] = await Promise.all( [
    budgetsService.preferenciasDe( session.user.id ) ,
    budgetsRepository.findCurrencies( session.user.organizationId ) ,
  ] ) ;

  const mesActual = claveDeMesActual( prefs.zona ) ;
  const parametros   = resolverParametros( {
    month ,
    currency ,
    mesActual ,
    divisaPerfil: prefs.currency ,
    divisasConPresupuesto ,
  } ) ;

  const [ dict , res , treeRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getBudgetsAction( parametros ) ,
    getCategoryTreeAction() ,
  ] ) ;

  if( !res.success ) {
    throw( new Error( res.error ) ) ;
  }

  const categoryTree = ( treeRes.success ? treeRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={dict.budgetsPage.title}
        subtitle={dict.budgetsPage.subtitle}
        showMonthSelector={true}
        dict={dict}
        lang={lang}
        currentMonthKey={mesActual}
      />
      <BudgetsContainer
        evaluacion={res.value}
        currency={parametros.currency}
        categoryTree={categoryTree}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
