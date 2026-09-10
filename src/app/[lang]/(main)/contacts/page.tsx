/**
 * @file page.tsx
 * Página de visualización y gestión de la Agenda de Contactos (/contacts).
 * Server Component fino que orquesta la carga concurrente de contactos, entidades y diccionario.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Accounting
import { getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;

// Feature: Contacts
import { ContactsContainer } from "@/features/contacts/components/ContactsContainer" ;
import { getContactsAction } from "@/features/contacts/actions/contactsActions" ;


interface ContactsPageProps {
  params: Promise< { lang: string } > ;
}

export default async function ContactsPage( { params }: ContactsPageProps ) {
  const { lang } = await params ;

  // Carga concurrente en el servidor sin cascadas
  const [ dict , contactsRes , entitiesRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getContactsAction() ,
    getFinancialEntitiesAction() ,
  ] ) ;

  const contacts          = ( contactsRes.success ? contactsRes.value : [] ) ;
  const financialEntities = ( entitiesRes.success ? entitiesRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <ContactsContainer
        initialContacts={contacts}
        financialEntities={financialEntities}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
