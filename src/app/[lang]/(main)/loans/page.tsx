/**
 * @file page.tsx
 * Página de visualización y gestión de Préstamos (/loans).
 * Server Component fino que orquesta la carga concurrente sin cascadas (Promise.all).
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Accounting
import { getAccountsAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;

// Feature: Contacts
import { getContactsAction } from "@/features/contacts/actions/contactsActions" ;

// Feature: Loans
import { LoansContainer } from "@/features/loans/components/LoansContainer" ;
import { getLoansAction } from "@/features/loans/actions/loansActions" ;


interface LoansPageProps {
  params: Promise< {lang: string} > ;
}

export default async function LoansPage( {params}: LoansPageProps ) {
  const { lang } = await params ;

  // Carga concurrente en el servidor sin cascadas (async-parallel de Vercel y RFC 007 §8D)
  const [ dict , loansRes , accountsRes , entitiesRes , contactsRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getLoansAction() ,
    getAccountsAction() ,
    getFinancialEntitiesAction() ,
    getContactsAction()
  ] ) ;

  const loans             = ( loansRes.success ? loansRes.value : [] ) ;
  const accounts          = ( accountsRes.success ? accountsRes.value : [] ) ;
  const financialEntities = ( entitiesRes.success ? entitiesRes.value : [] ) ;
  const contacts          = ( contactsRes.success ? contactsRes.value : [] ) ;

  const pendientes = loans.flatMap( ( l ) => l.pendientes ) ;
  pendientes.sort( ( a , b ) => a.fechaCuota.localeCompare( b.fechaCuota ) ) ;

  return(
    <div className={styles.container}>
      <LoansContainer
        initialLoans={loans}
        initialPending={pendientes}
        accounts={accounts}
        financialEntities={financialEntities}
        contacts={contacts}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
