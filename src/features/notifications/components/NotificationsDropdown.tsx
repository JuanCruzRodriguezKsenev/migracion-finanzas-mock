/**
 * @file NotificationsDropdown.tsx
 * Lista desplegable de avisos de la campana. Al abrirse los marca como leídos; no tiene botones
 * de leer ni de descartar. El texto se arma desde el tipo del aviso y el diccionario (NFR-4).
 * Incluye filtro por organización cuando el usuario pertenece a más de una.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useRef } from "react" ;

// Shared
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Notifications
import { useNotifications } from "../context/NotificationsContext" ;
import type { AvisoVista }  from "../types" ;
import styles               from "./NotificationsDropdown.module.css" ;


type NotificationsDict = Awaited< ReturnType< typeof getDictionary > >["notifications"] ;

interface NotificationsDropdownProps {
  dict: NotificationsDict ;
}

/** Plantilla del diccionario según el tipo de aviso; un tipo desconocido no se muestra con texto inventado. */
function plantillaDe( tipo: string , dict: NotificationsDict ): string | null {
  if( tipo === "charged_to_holder" )    { return( dict.chargedToHolder ) ; }
  if( tipo === "transaction_reversed" ) { return( dict.transactionReversed ) ; }
  if( tipo === "debt_created" )         { return( dict.debtCreated ) ; }
  if( tipo === "agreement_changed" )    { return( dict.agreementChanged ) ; }
  if( tipo === "payment_requested" )    { return( dict.paymentRequested ) ; }
  if( tipo === "payment_received" )     { return( dict.paymentReceived ) ; }
  return( null ) ;
}

/**
 * Reemplaza los marcadores `{actor}`, `{descripcion}` y `{monto}` de la plantilla, resaltando cada valor.
 */
function renderizarPlantilla( plantilla: string , valores: Record< string , string > ): React.ReactNode[] {
  return(
    plantilla.split( /(\{actor\}|\{descripcion\}|\{monto\})/ ).map( ( parte , i ) => {
      const clave = parte.slice( 1 , -1 ) ;
      if( parte.startsWith( "{" ) && (clave in valores) ) {
        return( <span key={i} className={styles.bold}>{valores[clave]}</span> ) ;
      }
      return( <React.Fragment key={i}>{parte}</React.Fragment> ) ;
    } )
  ) ;
}

export function NotificationsDropdown( {dict}: NotificationsDropdownProps ) {
  const { notifications , marcarLeidas , filtro , setFiltro , organizaciones } = useNotifications() ;
  const { profile }                                                            = useProfileContext() ;
  const locale                                                                 = ( profile?.numberFormat || "es-AR" ) ;

  // Los que estaban sin leer al abrir quedan resaltados mientras el desplegable siga abierto.
  const [ sinLeerAlAbrir ] = useState< Set< string > >( () => new Set( notifications.filter( ( n ) => !n.leida ).map( ( n ) => n.id ) ) ) ;

  // Abrir el desplegable es leer: se marcan todos una sola vez.
  const yaMarcado = useRef( false ) ;
  useEffect( () => {
    if( yaMarcado.current ) {
      return ;
    }
    yaMarcado.current = true ;
    void marcarLeidas() ;
  } , [ marcarLeidas ] ) ;

  const textoDe = ( n: AvisoVista ): React.ReactNode => {
    const plantilla = plantillaDe( n.tipo , dict ) ;
    if( !plantilla ) {
      return( null ) ;
    }

    const monto = ( (n.montoEnCentavos !== null) && n.divisa )
      ? formatCurrency( n.montoEnCentavos , n.divisa , locale )
      : "" ;

    return( renderizarPlantilla( plantilla , { actor: ( n.actor ?? "" ) , descripcion: n.descripcion , monto } ) ) ;
  } ;

  const hayMasDeUnaOrg     = organizaciones.length > 1 ;
  const mostrarOrganizacion = (filtro === null) && hayMasDeUnaOrg ;

  return(
    <div className={styles.dropdownWrap}>
      <div className={styles.header}>
        <span className={styles.title}>{dict.title}</span>
        {hayMasDeUnaOrg && (
          <select
            className={styles.filterSelect}
            aria-label={dict.filterLabel}
            value={filtro ?? ""}
            onChange={( e ) => {
              const valor = e.target.value ;
              setFiltro( valor === "" ? null : valor ) ;
            }}
          >
            <option value="">{dict.filterAll}</option>
            {organizaciones.map( ( org ) => (
              <option key={org.id} value={org.id}>
                {org.esPersonal ? dict.personal : org.nombre}
              </option>
            ) )}
          </select>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          {dict.empty}
        </div>
      ) : (
        <ul className={styles.list} tabIndex={0} aria-label={dict.title}>
          {notifications.map( ( n ) => {
            const texto = textoDe( n ) ;
            if( !texto ) {
              return( null ) ;
            }

            return(
              <li key={n.id} className={styles.card}>
                {sinLeerAlAbrir.has( n.id ) && (
                  <span className={styles.unreadDot} role="img" aria-label={dict.unreadAria} />
                )}
                <span className={styles.cardBody}>{texto}</span>
                <div className={styles.cardMeta}>
                  {mostrarOrganizacion && (
                    <span className={styles.cardOrg}>
                      {n.organizacionEsPersonal ? dict.personal : n.organizacionNombre}
                    </span>
                  )}
                  <time className={styles.cardDate} dateTime={n.creadaEn}>
                    {new Date( n.creadaEn ).toLocaleDateString( locale )}
                  </time>
                </div>
              </li>
            ) ;
          } )}
        </ul>
      )}
    </div>
  ) ;
}
