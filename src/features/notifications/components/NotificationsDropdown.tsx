/**
 * @file NotificationsDropdown.tsx
 * Lista desplegable de avisos de la campana. Al abrirse los marca como leídos; no tiene botones
 * de leer ni de descartar. El texto se arma desde el tipo del aviso y el diccionario (NFR-4).
 * Incluye filtro por organización y acciones de reclamos de pago («Ya pagué», confirmar, rechazar).
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useRef } from "react" ;
import { useRouter }                              from "next/navigation" ;

// Shared
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Goals
import { parseAmountToCents , centsToInput } from "@/features/goals/utils/goalAmount" ;

// Feature: Splits
import { reclamarPagoAction , confirmarReclamoAction , rechazarReclamoAction , cancelarReclamoAction } from "@/features/splits/actions/reclamosActions" ;

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
  if( tipo === "charged_to_holder" )      { return( dict.chargedToHolder ) ; }
  if( tipo === "transaction_reversed" )   { return( dict.transactionReversed ) ; }
  if( tipo === "debt_created" )           { return( dict.debtCreated ) ; }
  if( tipo === "agreement_changed" )      { return( dict.agreementChanged ) ; }
  if( tipo === "payment_requested" )      { return( dict.paymentRequested ) ; }
  if( tipo === "payment_received" )       { return( dict.paymentReceived ) ; }
  if( tipo === "payment_claimed" )        { return( dict.paymentClaimed ) ; }
  if( tipo === "payment_claim_rejected" ) { return( dict.paymentClaimRejected ) ; }
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
  const router = useRouter() ;
  const { notifications , marcarLeidas , refrescar , filtro , setFiltro , organizaciones } = useNotifications() ;
  const { profile }                                                                        = useProfileContext() ;
  const locale                                                                             = ( profile?.numberFormat || "es-AR" ) ;

  // Los que estaban sin leer al abrir quedan resaltados mientras el desplegable siga abierto.
  const [ sinLeerAlAbrir ]       = useState< Set< string > >( () => new Set( notifications.filter( ( n ) => !n.leida ).map( ( n ) => n.id ) ) ) ;
  const [ formularioAbiertoId , setFormularioAbiertoId ] = useState< string | null >( null ) ;
  const [ montosInput , setMontosInput ]                 = useState< Record< string , string > >( {} ) ;
  const [ erroresAccion , setErroresAccion ]             = useState< Record< string , string > >( {} ) ;
  const [ cargandoId , setCargandoId ]                   = useState< string | null >( null ) ;

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

  const ejecutarAccionReclamo = async ( avisoId: string , fn: () => Promise<{ success: boolean ; error?: string }> ) => {
    setCargandoId( avisoId ) ;
    setErroresAccion( ( prev ) => ( {...prev , [avisoId]: ""} ) ) ;

    try {
      const res = await fn() ;
      if( res.success ) {
        setFormularioAbiertoId( null ) ;
        await refrescar() ;
        router.refresh() ;
      } else {
        setErroresAccion( ( prev ) => ( {...prev , [avisoId]: res.error || dict.genericError} ) ) ;
      }
    } catch {
      setErroresAccion( ( prev ) => ( {...prev , [avisoId]: dict.genericError} ) ) ;
    } finally {
      setCargandoId( null ) ;
    }
  } ;

  const hayMasDeUnaOrg      = organizaciones.length > 1 ;
  const mostrarOrganizacion = (filtro === null) && hayMasDeUnaOrg ;

  const renderizarAccion = ( n: AvisoVista ) => {
    if( !n.accion ) {
      return( null ) ;
    }

    const estaCargando = ( cargandoId === n.id ) ;

    if( n.accion.tipo === "ya_pague" ) {
      if( n.accion.reclamoPendienteId ) {
        const reclamoId = n.accion.reclamoPendienteId ;
        return(
          <div className={styles.actionsRow}>
            <span className={styles.actionStatus}>{dict.waiting}</span>
            <button
              type="button"
              className={styles.actionBtn}
              disabled={estaCargando}
              onClick={() => ejecutarAccionReclamo( n.id , () => cancelarReclamoAction( { reclamoId } ) )}
            >
              {dict.cancel}
            </button>
          </div>
        ) ;
      }

      const saldoEnCentavos = n.accion.saldoEnCentavos ;
      const divisa          = ( n.divisa ?? "ARS" ) ;

      if( formularioAbiertoId === n.id ) {
        const valorMonto = ( montosInput[n.id] ?? centsToInput( saldoEnCentavos , divisa ) ) ;

        return(
          <div className={styles.inlineForm}>
            <div className={styles.formRow}>
              <input
                type="text"
                inputMode="decimal"
                className={styles.inlineInput}
                aria-label={dict.amountLabel}
                value={valorMonto}
                disabled={estaCargando}
                onChange={( e ) => {
                  const val = e.target.value ;
                  setMontosInput( ( prev ) => ( {...prev , [n.id]: val} ) ) ;
                }}
              />
              <button
                type="button"
                className={styles.actionBtnPrimary}
                disabled={estaCargando}
                onClick={() => {
                  const centavos = parseAmountToCents( valorMonto , divisa ) ;
                  if( !centavos || (centavos <= 0) ) {
                    setErroresAccion( ( prev ) => ( {...prev , [n.id]: dict.amountInvalid} ) ) ;
                    return ;
                  }
                  void ejecutarAccionReclamo( n.id , () => reclamarPagoAction( { avisoId: n.id , montoEnCentavos: centavos } ) ) ;
                }}
              >
                {dict.send}
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                disabled={estaCargando}
                onClick={() => {
                  setFormularioAbiertoId( null ) ;
                  setErroresAccion( ( prev ) => ( {...prev , [n.id]: ""} ) ) ;
                }}
              >
                {dict.cancel}
              </button>
            </div>
          </div>
        ) ;
      }

      return(
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.actionBtnPrimary}
            disabled={estaCargando}
            onClick={() => {
              setFormularioAbiertoId( n.id ) ;
              setMontosInput( ( prev ) => ( {...prev , [n.id]: centsToInput( saldoEnCentavos , divisa )} ) ) ;
              setErroresAccion( ( prev ) => ( {...prev , [n.id]: ""} ) ) ;
            }}
          >
            {dict.paidButton}
          </button>
        </div>
      ) ;
    }

    if( n.accion.tipo === "responder_reclamo" ) {
      const { reclamoId , estado } = n.accion ;

      if( estado === "pending" ) {
        return(
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.actionBtnPrimary}
              disabled={estaCargando}
              onClick={() => ejecutarAccionReclamo( n.id , () => confirmarReclamoAction( { reclamoId } ) )}
            >
              {dict.confirm}
            </button>
            <button
              type="button"
              className={styles.actionBtnDanger}
              disabled={estaCargando}
              onClick={() => ejecutarAccionReclamo( n.id , () => rechazarReclamoAction( { reclamoId } ) )}
            >
              {dict.reject}
            </button>
          </div>
        ) ;
      }

      const estadoTexto = ( estado === "confirmed" )
        ? dict.statusConfirmed
        : ( ( estado === "rejected" ) ? dict.statusRejected : dict.statusCancelled ) ;

      return(
        <div className={styles.actionsRow}>
          <span className={styles.actionStatus}>{estadoTexto}</span>
        </div>
      ) ;
    }

    return( null ) ;
  } ;

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
                {renderizarAccion( n )}
                {erroresAccion[n.id] && (
                  <span className={styles.actionError}>{erroresAccion[n.id]}</span>
                )}
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

